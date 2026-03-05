/**
 * 중앙 데이터 관리자 - 도트 경마 v5.1
 * 
 * 모든 데이터 저장/조회를 중앙에서 관리하여 일관성 보장
 * 
 * 기능:
 * - 원자적 저장 (Atomic Save)
 * - 자동 롤백
 * - 데이터 검증
 * - 오프라인/온라인 동기화
 * 
 * @version 5.1.1
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  // 저장소 키 정의
  const STORAGE_KEYS = {
    SEASON: 'dot_racing_season',
    STATS: 'dot_racing_stats',
    GAME_MODE: 'gameMode',
    VERSION: 'gameVersion'
  };

  // 트랜잭션 상태
  const TRANSACTION_STATE = {
    IDLE: 'idle',
    PENDING: 'pending',
    COMMITTED: 'committed',
    ROLLBACK: 'rollback'
  };

  class DataManager {
    constructor() {
      this.state = TRANSACTION_STATE.IDLE;
      this.pendingData = null;
      this.backupData = null;
      this.db = null;
      this.currentUserId = null;
    }

    /**
     * 데이터 관리자 초기화
     */
    async init() {
      console.log('[DataManager] Initializing...');
      
      // IndexedDB 초기화
      await this.initIndexedDB();
      
      // Firebase Auth 상태 감시
      this.watchAuthState();
      
      console.log('[DataManager] Initialized');
    }

    /**
     * IndexedDB 초기화
     */
    async initIndexedDB() {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      const dbName = `DotRacing_${userId}`;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 3);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // 스토어 생성
          if (!db.objectStoreNames.contains('season')) {
            db.createObjectStore('season', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('stats')) {
            db.createObjectStore('stats', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('replays')) {
            const replayStore = db.createObjectStore('replays', { keyPath: 'id' });
            replayStore.createIndex('byDate', 'date', { unique: false });
          }
          if (!db.objectStoreNames.contains('transactions')) {
            db.createObjectStore('transactions', { keyPath: 'id' });
          }
        };
      });
    }

    /**
     * 현재 사용자 ID 가져오기
     */
    getCurrentUserId() {
      if (window.uid) return window.uid;
      if (window.currentUser?.uid) return window.currentUser.uid;
      return null;
    }

    /**
     * Auth 상태 감시
     */
    watchAuthState() {
      // Firebase Auth 상태 변경 시 IndexedDB 재초기화
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged((user) => {
          if (user && user.uid !== this.currentUserId) {
            this.currentUserId = user.uid;
            this.initIndexedDB();
          }
        });
      }
    }

    /**
     * 원자적 저장 (Atomic Save)
     * Firestore와 LocalStorage를 동시에 업데이트
     * 
     * @param {string} type - 데이터 타입 ('season', 'stats')
     * @param {Object} data - 저장할 데이터
     * @returns {Promise<boolean>} 성공 여부
     */
    async save(type, data) {
      if (this.state !== TRANSACTION_STATE.IDLE) {
        console.warn('[DataManager] Transaction already in progress');
        return false;
      }

      // 데이터 검증
      if (!window.GameUtils?.validateData(data, type)) {
        console.error('[DataManager] Data validation failed');
        return false;
      }

      this.state = TRANSACTION_STATE.PENDING;
      this.pendingData = { type, data, timestamp: Date.now() };

      try {
        // 1. 백업 생성
        await this.createBackup(type);

        // 2. Firestore 저장 (원본)
        const firestoreSuccess = await this.saveToFirestore(type, data);
        
        if (!firestoreSuccess) {
          throw new Error('Firestore save failed');
        }

        // 3. IndexedDB 저장 (로컬 캐시)
        await this.saveToIndexedDB(type, data);

        // 4. LocalStorage 백업
        const localKey = type === 'season' ? STORAGE_KEYS.SEASON : STORAGE_KEYS.STATS;
        window.GameUtils?.saveWithQuotaCheck(localKey, data);

        // 5. 트랜잭션 완료
        this.state = TRANSACTION_STATE.COMMITTED;
        this.pendingData = null;
        this.backupData = null;

        console.log(`[DataManager] ${type} saved successfully`);
        return true;

      } catch (error) {
        console.error('[DataManager] Save failed:', error);
        
        // 롤백 실행
        await this.rollback(type);
        
        this.state = TRANSACTION_STATE.ROLLBACK;
        this.pendingData = null;
        
        return false;
      } finally {
        setTimeout(() => {
          this.state = TRANSACTION_STATE.IDLE;
        }, 100);
      }
    }

    /**
     * Firestore에 저장
     */
    async saveToFirestore(type, data) {
      if (!window.db || !window.uid || !window.firestoreModule) {
        console.log('[DataManager] Firestore not available');
        return false;
      }

      try {
        const { doc, setDoc } = window.firestoreModule;
        const ref = doc(window.db, 'users', window.uid, 'data', type);
        
        await setDoc(ref, {
          ...data,
          _updatedAt: new Date().toISOString(),
          _version: window.GameUtils?.VERSION || '5.1.1'
        }, { merge: true });

        return true;
      } catch (error) {
        console.error('[DataManager] Firestore save error:', error);
        return false;
      }
    }

    /**
     * IndexedDB에 저장
     */
    async saveToIndexedDB(type, data) {
      if (!this.db) return false;

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([type], 'readwrite');
        const store = transaction.objectStore(type);
        
        const request = store.put({
          id: type,
          data: data,
          timestamp: Date.now()
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }

    /**
     * 백업 생성
     */
    async createBackup(type) {
      const current = await this.load(type);
      this.backupData = { type, data: current };
    }

    /**
     * 롤백 실행
     */
    async rollback(type) {
      console.warn('[DataManager] Rolling back...');
      
      if (this.backupData && this.backupData.type === type) {
        // LocalStorage 복원
        const localKey = type === 'season' ? STORAGE_KEYS.SEASON : STORAGE_KEYS.STATS;
        localStorage.setItem(localKey, JSON.stringify(this.backupData.data));
        
        console.log('[DataManager] Rollback completed');
      }
    }

    /**
     * 데이터 로드 (우선순위: Firestore > IndexedDB > LocalStorage)
     */
    async load(type) {
      // 1. Firestore에서 로드 (로그인 시)
      if (window.uid) {
        const firestoreData = await this.loadFromFirestore(type);
        if (firestoreData) {
          // 로컬 캐시 업데이트
          await this.saveToIndexedDB(type, firestoreData);
          return firestoreData;
        }
      }

      // 2. IndexedDB에서 로드
      const indexedDBData = await this.loadFromIndexedDB(type);
      if (indexedDBData) return indexedDBData;

      // 3. LocalStorage에서 로드
      return this.loadFromLocalStorage(type);
    }

    /**
     * Firestore에서 로드
     */
    async loadFromFirestore(type) {
      if (!window.db || !window.uid || !window.firestoreModule) return null;

      try {
        const { doc, getDoc } = window.firestoreModule;
        const ref = doc(window.db, 'users', window.uid, 'data', type);
        const snap = await getDoc(ref);
        
        if (snap.exists) {
          return snap.data();
        }
      } catch (error) {
        console.warn('[DataManager] Firestore load error:', error);
      }
      return null;
    }

    /**
     * IndexedDB에서 로드
     */
    async loadFromIndexedDB(type) {
      if (!this.db) return null;

      return new Promise((resolve) => {
        const transaction = this.db.transaction([type], 'readonly');
        const store = transaction.objectStore(type);
        const request = store.get(type);

        request.onsuccess = () => {
          resolve(request.result?.data || null);
        };
        request.onerror = () => resolve(null);
      });
    }

    /**
     * LocalStorage에서 로드
     */
    loadFromLocalStorage(type) {
      const key = type === 'season' ? STORAGE_KEYS.SEASON : STORAGE_KEYS.STATS;
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[DataManager] LocalStorage load error:', error);
        return null;
      }
    }

    /**
     * 시즌 데이터 업데이트
     */
    async updateSeason(updateFn) {
      const season = await this.load('season') || this.getDefaultSeasonData();
      const updated = updateFn(season);
      return this.save('season', updated);
    }

    /**
     * 통계 데이터 업데이트
     */
    async updateStats(updateFn) {
      const stats = await this.load('stats') || this.getDefaultStatsData();
      const updated = updateFn(stats);
      return this.save('stats', updated);
    }

    /**
     * 기본 시즌 데이터
     */
    getDefaultSeasonData() {
      return {
        year: 2026,
        week: 1,
        totalPrize: 0,
        races: [],
        seasonId: '2026_S1',
        startDate: new Date().toISOString(),
        totalBet: 0,
        totalWin: 0,
        currentRank: null,
        rankHistory: [],
        totalEntries: 0,
        g1Count: 0, g2Count: 0, g3Count: 0, 
        openCount: 0, grade1Count: 0, grade2Count: 0,
        wins: 0, places: 0, totalScore: 0,
        seasonHistory: [],
        titles: [], badges: [], tier: null,
        pendingRewards: [], totalRewards: 0,
        lastRewardDate: null, last10RacesTrend: 0,
        version: window.GameUtils?.VERSION || '5.1.1'
      };
    }

    /**
     * 기본 통계 데이터
     */
    getDefaultStatsData() {
      const distances = [1000, 1200, 1300, 1400, 1700, 1800, 1900, 2000];
      const byDistance = {};
      distances.forEach(d => { byDistance[d] = { races: 0, wins: 0 }; });

      return {
        totalRaces: 0, totalWins: 0, totalPlaces: 0, totalThird: 0,
        totalBet: 0, totalWin: 0, roi: 0,
        byTrack: { seoul: { races: 0, wins: 0 }, busan: { races: 0, wins: 0 }, jeju: { races: 0, wins: 0 } },
        byDistance: byDistance,
        byHorse: {}, byJockey: {}, bySire: {},
        byGrade: { G1: { races: 0, wins: 0 }, G2: { races: 0, wins: 0 }, G3: { races: 0, wins: 0 }, 
                   OPEN: { races: 0, wins: 0 }, '1등급': { races: 0, wins: 0 }, '2등급': { races: 0, wins: 0 } },
        byBetType: { WIN: { bet: 0, win: 0 }, PLACE: { bet: 0, win: 0 }, QUINELLA: { bet: 0, win: 0 }, 
                     EXACTA: { bet: 0, win: 0 }, PLACEQ: { bet: 0, win: 0 } },
        history: [], lastUpdate: null,
        version: window.GameUtils?.VERSION || '5.1.1'
      };
    }

    /**
     * 전체 동기화 (Firestore → Local)
     */
    async syncAll() {
      console.log('[DataManager] Starting full sync...');
      
      try {
        // 시즌 동기화
        const season = await this.load('season');
        if (season) {
          await this.saveToIndexedDB('season', season);
          window.GameUtils?.saveWithQuotaCheck(STORAGE_KEYS.SEASON, season);
        }

        // 통계 동기화
        const stats = await this.load('stats');
        if (stats) {
          await this.saveToIndexedDB('stats', stats);
          window.GameUtils?.saveWithQuotaCheck(STORAGE_KEYS.STATS, stats);
        }

        console.log('[DataManager] Full sync completed');
        return true;
      } catch (error) {
        console.error('[DataManager] Sync failed:', error);
        return false;
      }
    }
  }

  // 전역 인스턴스 생성
  window.DataManager = new DataManager();
  
  console.log('[DataManager] v5.1.1 loaded');
})();
