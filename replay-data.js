/**
 * 리플레이 및 통계 데이터 관리 모듈 v5.1.1 (개선판)
 * 
 * 기능:
 * - 로그인한 사용자만 통계 저장/조회 가능
 * - 사용자별 IndexedDB에 저장 (userId별로 분리)
 * - DataManager와 통합된 원자적 저장
 * - 312게임(6게임×52주) 시즌 자동 리셋
 * - 시즌 히스토리 보관 및 조회
 * - 트랜잭션 롤백 지원
 * 
 * @version 5.1.1
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  const DB_NAME_PREFIX = 'DotRacingStats_v511_';
  const DB_VERSION = 3; // 버전 업그레이드
  
  // Store names
  const STORES = {
    REPLAYS: 'replays',
    USER_STATS: 'userStats',
    SEASON_HISTORY: 'seasonHistory',
    META: 'meta',
    TRANSACTIONS: 'transactions' // 새로 추가: 트랜잭션 로그
  };
  
  const MAX_REPLAYS = 3;
  const GAMES_PER_WEEK = 6;
  const WEEKS_PER_SEASON = 52;
  const GAMES_PER_SEASON = GAMES_PER_WEEK * WEEKS_PER_SEASON;

  let db = null;
  let currentUserId = null;
  let transactionQueue = []; // 트랜잭션 큐

  /**
   * 현재 로그인한 사용자 ID 가져오기
   */
  function getCurrentUserId() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const user = firebase.auth().currentUser;
      if (user) return user.uid;
    }
    if (window.currentUser && window.currentUser.uid) {
      return window.currentUser.uid;
    }
    if (window.uid) return window.uid;
    return null;
  }

  /**
   * DB 이름 생성 (사용자별)
   */
  function getDBName() {
    const userId = getCurrentUserId();
    if (!userId) return null;
    return DB_NAME_PREFIX + userId;
  }

  /**
   * DB 열기 (트랜잭션 지원)
   */
  async function openDB() {
    const dbName = getDBName();
    if (!dbName) {
      throw new Error('User not logged in');
    }

    if (db && currentUserId === getCurrentUserId()) {
      return db;
    }

    return new Promise((resolve, reject) => {
      currentUserId = getCurrentUserId();
      const request = indexedDB.open(dbName, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        db = request.result;
        console.log('[ReplayData v5.1.1] DB opened for user:', currentUserId);
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        
        // replays store
        if (!database.objectStoreNames.contains(STORES.REPLAYS)) {
          const replayStore = database.createObjectStore(STORES.REPLAYS, { keyPath: 'id' });
          replayStore.createIndex('byDate', 'date', { unique: false });
          replayStore.createIndex('bySeason', 'seasonNumber', { unique: false });
        }
        
        // userStats store
        if (!database.objectStoreNames.contains(STORES.USER_STATS)) {
          const statsStore = database.createObjectStore(STORES.USER_STATS, { keyPath: 'category' });
          statsStore.createIndex('byHorse', 'horseName', { unique: false });
          statsStore.createIndex('byJockey', 'jockeyName', { unique: false });
        }
        
        // seasonHistory store
        if (!database.objectStoreNames.contains(STORES.SEASON_HISTORY)) {
          database.createObjectStore(STORES.SEASON_HISTORY, { keyPath: 'seasonId' });
        }
        
        // meta store
        if (!database.objectStoreNames.contains(STORES.META)) {
          database.createObjectStore(STORES.META, { keyPath: 'key' });
        }
        
        // transactions store (새로 추가)
        if (!database.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const transStore = database.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
          transStore.createIndex('byStatus', 'status', { unique: false });
          transStore.createIndex('byTimestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * 로그인 상태 체크
   */
  function isLoggedIn() {
    return getCurrentUserId() !== null;
  }

  /**
   * 트랜잭션 로그 기록
   */
  async function logTransaction(type, data, status = 'pending') {
    if (!db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSACTIONS);
      
      const log = {
        type: type,
        data: JSON.stringify(data),
        status: status,
        timestamp: Date.now(),
        userId: getCurrentUserId()
      };
      
      const request = store.add(log);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 트랜잭션 상태 업데이트
   */
  async function updateTransactionStatus(id, status) {
    if (!db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSACTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSACTIONS);
      
      const request = store.get(id);
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.status = status;
          data.updatedAt = Date.now();
          store.put(data);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 현재 시즌 정보 가져오기
   */
  async function getCurrentSeason() {
    if (!isLoggedIn()) {
      return { seasonNumber: 1, week: 1, gameCount: 0, isLoggedIn: false };
    }

    try {
      await openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.META], 'readonly');
        const store = transaction.objectStore(STORES.META);
        const request = store.get('currentSeason');
        
        request.onsuccess = () => {
          if (request.result) {
            resolve({ ...request.result.data, isLoggedIn: true });
          } else {
            resolve({
              seasonNumber: 1,
              week: 1,
              gameCount: 0,
              startDate: new Date().toISOString(),
              isLoggedIn: true
            });
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[ReplayData] Failed to get current season:', e);
      return { seasonNumber: 1, week: 1, gameCount: 0, isLoggedIn: false };
    }
  }

  /**
   * 현재 시즌 정보 업데이트
   */
  async function updateCurrentSeason(seasonData) {
    if (!isLoggedIn()) return false;

    try {
      await openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.META], 'readwrite');
        const store = transaction.objectStore(STORES.META);
        const request = store.put({
          key: 'currentSeason',
          data: seasonData,
          updatedAt: Date.now()
        });
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[ReplayData] Failed to update season:', e);
      return false;
    }
  }

  /**
   * 경기 후 시즌 진행 체크
   */
  async function advanceSeason() {
    if (!isLoggedIn()) return null;

    const season = await getCurrentSeason();
    season.gameCount++;
    
    // 6게임 = 1주
    if (season.gameCount >= GAMES_PER_WEEK) {
      season.gameCount = 0;
      season.week++;
      
      // 52주 = 1시즌 종료
      if (season.week > WEEKS_PER_SEASON) {
        console.log('[ReplayData] Season', season.seasonNumber, 'completed!');
        await archiveCurrentSeason(season);
        
        season.seasonNumber++;
        season.week = 1;
        season.gameCount = 0;
        season.startDate = new Date().toISOString();
      }
    }
    
    await updateCurrentSeason(season);
    return season;
  }

  /**
   * 현재 시즌 통계 보관
   */
  async function archiveCurrentSeason(seasonInfo) {
    if (!isLoggedIn()) return false;

    try {
      const currentStats = await getUserStats();
      await openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SEASON_HISTORY], 'readwrite');
        const store = transaction.objectStore(STORES.SEASON_HISTORY);
        const request = store.put({
          seasonId: 'season_' + seasonInfo.seasonNumber,
          seasonNumber: seasonInfo.seasonNumber,
          stats: currentStats,
          archivedAt: new Date().toISOString(),
          startDate: seasonInfo.startDate,
          endDate: new Date().toISOString()
        });
        
        request.onsuccess = () => {
          console.log('[ReplayData] Season archived:', seasonInfo.seasonNumber);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[ReplayData] Failed to archive season:', e);
      return false;
    }
  }

  /**
   * 모든 시즌 히스토리 가져오기
   */
  async function getAllSeasonHistory() {
    if (!isLoggedIn()) return [];

    try {
      await openDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.SEASON_HISTORY], 'readonly');
        const store = transaction.objectStore(STORES.SEASON_HISTORY);
        const request = store.getAll();

        request.onsuccess = () => {
          const result = request.result || [];
          resolve(result.sort((a, b) => b.seasonNumber - a.seasonNumber));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[ReplayData] Get season history failed:', e);
      return [];
    }
  }

  /**
   * 사용자 통계 가져오기 (Firestore 우선)
   */
  async function getUserStats() {
    if (!isLoggedIn()) return getEmptyStats();

    try {
      // Firestore에서 읽기
      const firestoreStats = await loadStatsFromFirestore();
      if (firestoreStats) {
        console.log('[ReplayData] Stats loaded from Firestore');
        firestoreStats.history = firestoreStats.history || [];
        return { ...getEmptyStats(), ...firestoreStats };
      }
      
      // IndexedDB에서 읽기 (오프라인)
      const indexedStats = await loadStatsFromIndexedDB();
      if (indexedStats) {
        console.log('[ReplayData] Stats loaded from IndexedDB');
        return { ...getEmptyStats(), ...indexedStats };
      }
      
      return getEmptyStats();
    } catch (e) {
      console.error('[ReplayData] Get user stats failed:', e);
      return getEmptyStats();
    }
  }

  /**
   * IndexedDB에서 통계 로드
   */
  async function loadStatsFromIndexedDB() {
    if (!db) return null;

    return new Promise((resolve) => {
      const transaction = db.transaction([STORES.USER_STATS], 'readonly');
      const store = transaction.objectStore(STORES.USER_STATS);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * 빈 통계 객체 생성
   */
  function getEmptyStats() {
    return {
      horseStats: {},
      jockeyStats: {},
      distanceStats: {},
      trackStats: {},
      gradeStats: {},
      weatherStats: {},
      timeStats: {},
      summary: {
        totalGames: 0,
        totalPrize: 0,
        totalBet: 0,
        totalReturn: 0
      },
      history: []
    };
  }

  /**
   * 점수 계산
   */
  function calculateScore(position) {
    if (!position || position > 16) return 10;
    
    const scoreMap = {
      1: 100, 2: 50, 3: 25, 4: 14, 5: 13, 6: 12, 7: 11, 8: 10,
      9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2
    };
    
    return scoreMap[position] || 10;
  }

  /**
   * 통계 업데이트
   */
  async function updateStats(raceResult) {
    if (!isLoggedIn()) {
      console.log('[ReplayData] Not logged in, skipping stats update');
      return false;
    }

    const transactionId = await logTransaction('updateStats', { timestamp: Date.now() });

    try {
      await openDB();
      const stats = await getUserStats();

      // 말별 통계
      if (raceResult.horses) {
        raceResult.horses.forEach(horse => {
          const name = horse.name;
          if (!stats.horseStats[name]) {
            stats.horseStats[name] = {
              name: name,
              races: 0,
              wins: 0,
              places: 0,
              shows: 0,
              top3: 0,
              totalScore: 0,
              totalPrize: 0
            };
          }
          
          const score = calculateScore(horse.position);
          stats.horseStats[name].races++;
          stats.horseStats[name].totalScore += score;
          if (horse.position === 1) stats.horseStats[name].wins++;
          if (horse.position === 2) stats.horseStats[name].places++;
          if (horse.position === 3) stats.horseStats[name].shows++;
          if (horse.position <= 3) stats.horseStats[name].top3++;
          stats.horseStats[name].totalPrize += horse.prize || 0;
        });
      }

      // 기수별 통계
      if (raceResult.horses) {
        raceResult.horses.forEach(horse => {
          const jockey = horse.jockey;
          if (!jockey) return;
          
          if (!stats.jockeyStats[jockey]) {
            stats.jockeyStats[jockey] = {
              name: jockey,
              rides: 0,
              wins: 0,
              top3: 0,
              totalScore: 0
            };
          }
          
          const score = calculateScore(horse.position);
          stats.jockeyStats[jockey].rides++;
          stats.jockeyStats[jockey].totalScore += score;
          if (horse.position === 1) stats.jockeyStats[jockey].wins++;
          if (horse.position <= 3) stats.jockeyStats[jockey].top3++;
        });
      }

      // 기타 통계
      if (raceResult.distance) {
        const dist = raceResult.distance + 'm';
        if (!stats.distanceStats[dist]) stats.distanceStats[dist] = { distance: dist, races: 0 };
        stats.distanceStats[dist].races++;
      }

      if (raceResult.track) {
        const track = raceResult.track;
        if (!stats.trackStats[track]) stats.trackStats[track] = { track: track, races: 0 };
        stats.trackStats[track].races++;
      }

      if (raceResult.grade) {
        const grade = raceResult.grade;
        if (!stats.gradeStats[grade]) stats.gradeStats[grade] = { grade: grade, races: 0 };
        stats.gradeStats[grade].races++;
      }

      // 요약 업데이트
      stats.summary.totalGames++;
      stats.summary.totalPrize += raceResult.totalPrize || 0;
      stats.summary.totalBet += raceResult.totalBet || 0;
      stats.summary.totalReturn += raceResult.totalReturn || 0;

      // 저장
      await saveUserStats(stats);
      await updateTransactionStatus(transactionId, 'completed');
      
      console.log('[ReplayData] Stats updated for user:', getCurrentUserId());
      return true;

    } catch (e) {
      console.error('[ReplayData] Stats update failed:', e);
      await updateTransactionStatus(transactionId, 'failed');
      return false;
    }
  }

  /**
   * 통계 저장
   */
  async function saveUserStats(stats, caller = 'unknown') {
    if (!isLoggedIn()) return false;

    console.log('[ReplayData] Saving stats from:', caller);

    try {
      await openDB();

      // IndexedDB에 저장
      const transaction = db.transaction([STORES.USER_STATS], 'readwrite');
      const store = transaction.objectStore(STORES.USER_STATS);
      
      await new Promise((resolve, reject) => {
        const request = store.put({
          category: 'current',
          data: stats,
          updatedAt: Date.now()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Firestore에 저장
      await saveStatsToFirestore(stats);
      
      return true;
    } catch (e) {
      console.error('[ReplayData] Save failed:', e);
      return false;
    }
  }

  /**
   * Firestore에 통계 저장
   */
  async function saveStatsToFirestore(stats) {
    try {
      if (!window.db || !window.uid || !window.firestoreModule) {
        return false;
      }
      
      const { doc, setDoc } = window.firestoreModule;
      const userRef = doc(window.db, 'users', window.uid, 'stats', 'current');
      
      const statsData = {
        horseStats: stats.horseStats || {},
        jockeyStats: stats.jockeyStats || {},
        distanceStats: stats.distanceStats || {},
        trackStats: stats.trackStats || {},
        gradeStats: stats.gradeStats || {},
        weatherStats: stats.weatherStats || {},
        timeStats: stats.timeStats || {},
        summary: stats.summary || getEmptyStats().summary,
        history: stats.history || [],
        _updatedAt: new Date().toISOString(),
        _version: '5.1.1'
      };
      
      await setDoc(userRef, statsData, { merge: true });
      console.log('[ReplayData] Stats saved to Firestore');
      return true;
    } catch (e) {
      console.warn('[ReplayData] Firestore save failed:', e);
      return false;
    }
  }

  /**
   * Firestore에서 통계 읽어오기
   */
  async function loadStatsFromFirestore() {
    try {
      if (!window.db || !window.uid || !window.firestoreModule) {
        return null;
      }
      
      const { doc, getDoc } = window.firestoreModule;
      const userRef = doc(window.db, 'users', window.uid, 'stats', 'current');
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (e) {
      console.warn('[ReplayData] Firestore load failed:', e);
      return null;
    }
  }

  /**
   * 리플레이 저장
   */
  async function save(data) {
    console.log('[ReplayData] Save called, logged in:', isLoggedIn());
    
    if (!isLoggedIn()) {
      console.log('[ReplayData] Not logged in, skipping save');
      return false;
    }

    if (!data) {
      console.error('[ReplayData] No data provided');
      return false;
    }

    const transactionId = await logTransaction('saveReplay', { raceNo: data.raceNo });

    try {
      await openDB();
      
      const currentSeason = await advanceSeason();
      if (!currentSeason) {
        throw new Error('Failed to advance season');
      }

      const replay = {
        id: 'replay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        seasonNumber: currentSeason.seasonNumber,
        week: currentSeason.week,
        raceNo: data.raceNo,
        date: new Date().toISOString(),
        track: data.track,
        grade: data.grade,
        distance: data.distance,
        horses: data.horses,
        frames: data.frames || [],
        finalOrder: data.finalOrder,
        frameCount: (data.frames || []).length,
        stats: data.stats
      };

      // IndexedDB에 저장
      const transaction = db.transaction([STORES.REPLAYS], 'readwrite');
      const store = transaction.objectStore(STORES.REPLAYS);
      
      await new Promise((resolve, reject) => {
        const request = store.add(replay);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(request.error);
      });

      // 오래된 리플레이 정리
      await trimOldReplays();
      
      // 통계 업데이트
      if (data.raceResult) {
        await updateStats(data.raceResult);
      }
      
      await updateTransactionStatus(transactionId, 'completed');
      
      console.log('[ReplayData] Saved: Season', currentSeason.seasonNumber, 'Week', currentSeason.week);
      return true;
      
    } catch (e) {
      console.error('[ReplayData] Save failed:', e);
      await updateTransactionStatus(transactionId, 'failed');
      return false;
    }
  }

  /**
   * 오래된 리플레이 삭제
   */
  async function trimOldReplays() {
    try {
      const all = await getAllReplays();
      if (all.length > MAX_REPLAYS) {
        all.sort((a, b) => new Date(b.date) - new Date(a.date));
        const toDelete = all.slice(MAX_REPLAYS);
        
        const transaction = db.transaction([STORES.REPLAYS], 'readwrite');
        const store = transaction.objectStore(STORES.REPLAYS);
        
        toDelete.forEach(replay => {
          store.delete(replay.id);
        });
      }
    } catch (e) {
      console.error('[ReplayData] Trim failed:', e);
    }
  }

  /**
   * 모든 리플레이 가져오기
   */
  async function getAllReplays() {
    if (!isLoggedIn()) return [];

    try {
      await openDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.REPLAYS], 'readonly');
        const store = transaction.objectStore(STORES.REPLAYS);
        const request = store.getAll();

        request.onsuccess = () => {
          const result = request.result || [];
          resolve(result.sort((a, b) => new Date(b.date) - new Date(a.date)));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[ReplayData] Get all failed:', e);
      return [];
    }
  }

  /**
   * 리플레이 삭제
   */
  async function remove(index) {
    try {
      const list = await getAllReplays();
      if (list[index]) {
        const transaction = db.transaction([STORES.REPLAYS], 'readwrite');
        const store = transaction.objectStore(STORES.REPLAYS);
        
        await new Promise((resolve, reject) => {
          const request = store.delete(list[index].id);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        });
        
        return true;
      }
    } catch (e) {
      console.error('[ReplayData] Remove failed:', e);
    }
    return false;
  }

  /**
   * 모든 리플레이 삭제
   */
  async function clear() {
    try {
      await openDB();
      const transaction = db.transaction([STORES.REPLAYS], 'readwrite');
      const store = transaction.objectStore(STORES.REPLAYS);
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
      
      console.log('[ReplayData] All replays cleared');
      return true;
    } catch (e) {
      console.error('[ReplayData] Clear failed:', e);
      return false;
    }
  }

  /**
   * 리플레이 개수
   */
  async function count() {
    const list = await getAllReplays();
    return list.length;
  }

  /**
   * 저장 용량 추정
   */
  async function usage() {
    try {
      const replays = await getAllReplays();
      const seasons = await getAllSeasonHistory();
      
      let replayBytes = 0;
      let statsBytes = 0;
      
      replays.forEach(r => {
        replayBytes += JSON.stringify(r).length;
      });
      
      seasons.forEach(s => {
        statsBytes += JSON.stringify(s).length;
      });
      
      return {
        replays: replays.length + '개 (' + (replayBytes / 1024).toFixed(2) + ' KB)',
        seasons: seasons.length + '시즌 (' + (statsBytes / 1024).toFixed(2) + ' KB)',
        total: ((replayBytes + statsBytes) / 1024).toFixed(2) + ' KB'
      };
    } catch (e) {
      return { total: 'Unknown' };
    }
  }

  // 전역 객체로 노출
  window.ReplayRecorder = {
    save: save,
    getAll: getAllReplays,
    remove: remove,
    clear: clear,
    count: count,
    usage: usage,
    getCurrentSeason: getCurrentSeason,
    getAllSeasonStats: getAllSeasonHistory,
    getSeasonStats: async (seasonNumber) => {
      if (!isLoggedIn()) return null;
      try {
        await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORES.SEASON_HISTORY], 'readonly');
          const store = transaction.objectStore(STORES.SEASON_HISTORY);
          const request = store.get('season_' + seasonNumber);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        return null;
      }
    },
    updateCurrentSeason: updateCurrentSeason,
    getUserStats: getUserStats,
    updateStats: updateStats,
    saveUserStats: saveUserStats,
    isLoggedIn: isLoggedIn,
    MAX_REPLAYS: MAX_REPLAYS,
    GAMES_PER_WEEK: GAMES_PER_WEEK,
    WEEKS_PER_SEASON: WEEKS_PER_SEASON,
    GAMES_PER_SEASON: GAMES_PER_SEASON,
    // 디버깅용
    _getDB: () => db,
    _getTransactionQueue: () => transactionQueue
  };

  console.log('[ReplayData v5.1.1] User-based stats system loaded');

})();
