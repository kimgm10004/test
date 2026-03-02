/**
 * 통계 시스템 - 도트 경마 v5.1.1 (개선판)
 * 
 * 기능:
 * - 경기 결과 자동 기록 및 분석
 * - 말/기수/혈통별 승률 추적
 * - 베팅 유형별 수익 분석
 * - DataManager 통합 (원자적 저장)
 * 
 * 저장소: DataManager (Firestore + IndexedDB + LocalStorage)
 * 
 * @version 5.1.1
 * @author 도겜유튜브
 */

(function() {
  'use strict';

  // 현재 통계 데이터 (캐시)
  let stats = null;
  let isInitialized = false;

  // 거리 목록
  const DISTANCES = [1000, 1200, 1300, 1400, 1700, 1800, 1900, 2000];

  /**
   * 기본 통계 데이터 구조
   */
  function getDefaultStats() {
    const byDistance = {};
    DISTANCES.forEach(d => { byDistance[d] = { races: 0, wins: 0 }; });

    return {
      totalRaces: 0,
      totalWins: 0,
      totalPlaces: 0,
      totalThird: 0,
      totalBet: 0,
      totalWin: 0,
      roi: 0,
      byTrack: { 
        seoul: { races: 0, wins: 0 }, 
        busan: { races: 0, wins: 0 }, 
        jeju: { races: 0, wins: 0 } 
      },
      byDistance: byDistance,
      byHorse: {},
      byJockey: {},
      bySire: {},
      byGrade: { 
        G1: { races: 0, wins: 0 }, 
        G2: { races: 0, wins: 0 }, 
        G3: { races: 0, wins: 0 }, 
        OPEN: { races: 0, wins: 0 }, 
        '1등급': { races: 0, wins: 0 }, 
        '2등급': { races: 0, wins: 0 } 
      },
      byBetType: { 
        WIN: { bet: 0, win: 0 },
        PLACE: { bet: 0, win: 0 },
        QUINELLA: { bet: 0, win: 0 },
        EXACTA: { bet: 0, win: 0 },
        PLACEQ: { bet: 0, win: 0 }
      },
      history: [],
      lastUpdate: null,
      version: '5.1.1'
    };
  }

  /**
   * 통계 시스템 초기화
   */
  async function initStats() {
    if (isInitialized && stats) return stats;
    
    console.log('[StatsSystem v5.1.1] Initializing...');
    
    try {
      // DataManager에서 로드
      if (window.DataManager) {
        stats = await window.DataManager.load('stats');
      }
      
      // 마이그레이션
      if (!stats) {
        stats = await migrateFromLegacy();
      }
      
      // 데이터 검증
      if (!validateStatsData(stats)) {
        console.warn('[StatsSystem] Invalid stats data, resetting...');
        stats = getDefaultStats();
      }
      
      // 버전 체크 및 마이그레이션
      if (window.GameUtils?.needsMigration('5.1.1', stats.version)) {
        stats = migrateStats(stats);
      }
      
      isInitialized = true;
      console.log('[StatsSystem v5.1.1] Initialized - Races:', stats.totalRaces);
      
    } catch (error) {
      console.error('[StatsSystem] Init failed:', error);
      stats = getDefaultStats();
    }
    
    return stats;
  }

  /**
   * 기존 LocalStorage에서 마이그레이션
   */
  async function migrateFromLegacy() {
    try {
      const legacy = window.Storage.getItem('stats');
      if (legacy) {
        const parsed = legacy;
        console.log('[StatsSystem] Migrating from legacy storage...');
        
        if (window.DataManager) {
          await window.DataManager.save('stats', parsed);
        }
        
        return parsed;
      }
    } catch (e) {
      console.warn('[StatsSystem] Legacy migration failed:', e);
    }
    return null;
  }

  /**
   * 통계 데이터 검증
   */
  function validateStatsData(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.totalRaces !== 'number' || data.totalRaces < 0) return false;
    if (typeof data.totalBet !== 'number' || data.totalBet < 0) return false;
    if (!Array.isArray(data.history)) return false;
    return true;
  }

  /**
   * 통계 데이터 마이그레이션
   */
  function migrateStats(data) {
    const defaults = getDefaultStats();
    const migrated = { ...defaults };
    
    Object.keys(data).forEach(key => {
      if (key === 'history') {
        migrated[key] = Array.isArray(data[key]) ? [...data[key]] : [];
      } else if (['byHorse', 'byJockey', 'bySire', 'byTrack', 'byDistance', 'byGrade', 'byBetType'].includes(key)) {
        // 객체는 깊은 복사
        migrated[key] = data[key] ? JSON.parse(JSON.stringify(data[key])) : defaults[key];
      } else {
        migrated[key] = data[key] !== undefined ? data[key] : defaults[key];
      }
    });
    
    // 거리별 통계 마이그레이션
    DISTANCES.forEach(d => { 
      if (!migrated.byDistance[d]) migrated.byDistance[d] = { races: 0, wins: 0 }; 
    });
    
    migrated.version = '5.1.1';
    console.log('[StatsSystem] Migrated to v5.1.1');
    return migrated;
  }

  /**
   * 통계 저장
   */
  async function saveStats() {
    if (!stats) return false;
    
    stats.lastUpdate = new Date().toISOString();
    
    if (window.DataManager) {
      const success = await window.DataManager.save('stats', stats);
      if (success) return true;
    }
    
    // Fallback to StorageManager
    try {
      window.Storage.setItem('stats', stats);
      return true;
    } catch (e) {
      console.error('[StatsSystem] Save failed:', e);
      return false;
    }
  }

  /**
   * 통계 업데이트
   */
  async function updateStats(params) {
    if (!stats) await initStats();
    
    const { 
      order = [], 
      betInfo = {}, 
      grade = 'OPEN', 
      distance = 1200, 
      track = 'seoul', 
      horses = [] 
    } = params;
    
    const { totalBet = 0, totalReturn = 0, tickets = [] } = betInfo;

    // 기본 통계 업데이트
    stats.totalRaces++;
    stats.totalBet += totalBet;
    stats.totalWin += totalReturn;

    // 등급/트랙/거리별 출전 수 증가
    if (!stats.byGrade[grade]) stats.byGrade[grade] = { races: 0, wins: 0 };
    stats.byGrade[grade].races++;
    
    if (!stats.byTrack[track]) stats.byTrack[track] = { races: 0, wins: 0 };
    stats.byTrack[track].races++;
    
    if (!stats.byDistance[distance]) stats.byDistance[distance] = { races: 0, wins: 0 };
    stats.byDistance[distance].races++;

    // 말/기수/혈통별 통계 업데이트
    horses.forEach((h, idx) => {
      const rank = order.indexOf(idx) + 1;
      const isWin = rank === 1;
      
      // 말별 통계
      if (!stats.byHorse[h.name]) {
        stats.byHorse[h.name] = { races: 0, wins: 0, places: 0, bet: 0, win: 0 };
      }
      stats.byHorse[h.name].races++;
      if (isWin) stats.byHorse[h.name].wins++;
      
      // 기수별 통계
      if (!stats.byJockey[h.jockey]) {
        stats.byJockey[h.jockey] = { races: 0, wins: 0, places: 0 };
      }
      stats.byJockey[h.jockey].races++;
      if (isWin) stats.byJockey[h.jockey].wins++;
      
      // 혈통별 통계
      if (!stats.bySire[h.sire]) {
        stats.bySire[h.sire] = { races: 0, wins: 0, places: 0 };
      }
      stats.bySire[h.sire].races++;
      if (isWin) stats.bySire[h.sire].wins++;
    });

    // 1/2/3위 말 통계
    if (order.length >= 1) {
      const firstHorse = horses[order[0]];
      if (firstHorse) {
        stats.totalWins++;
        stats.byTrack[track].wins++;
        stats.byGrade[grade].wins++;
        stats.byDistance[distance].wins++;
      }
    }
    
    if (order.length >= 3) {
      stats.totalPlaces++;
    }

    // 베팅 유형별 통계
    tickets.forEach(t => {
      const typeStats = stats.byBetType[t.type];
      if (typeStats) {
        typeStats.bet += t.amount;
        const ret = calculateTicketReturn(t, order);
        if (ret > 0) typeStats.win += ret;
      }
    });

    // 히스토리 추가
    const pnl = totalReturn - totalBet;
    const gradePrizes = { 
      'G1': 600000000, 'G2': 360000000, 'G3': 180000000, 
      'OPEN': 96000000, '1등급': 60000000, '2등급': 36000000 
    };
    const prize = gradePrizes[grade] || 96000000;
    
    stats.history.unshift({ 
      raceNo: stats.totalRaces, 
      pnl, 
      totalBet: totalBet,
      totalReturn: totalReturn,
      date: new Date().toISOString(),
      order: order,  // 전체 순위 배열 저장
      tickets: tickets.map(t => ({  // 베팅 내역 저장
        type: t.type,
        a: t.a,
        b: t.b,
        c: t.c,
        amount: t.amount
      })),
      horses: horses.map((h, idx) => {
        const rank = order.indexOf(idx) + 1;
        let prizeAmount = 0;
        
        if (rank === 1) prizeAmount = Math.floor(prize * 0.40);
        else if (rank === 2) prizeAmount = Math.floor(prize * 0.25);
        else if (rank === 3) prizeAmount = Math.floor(prize * 0.15);
        else if (rank >= 4 && rank < 16) {
          const weights = [1.5, 1.3, 1.1, 0.9, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1];
          const sumWeights = weights.reduce((a, b) => a + b, 0);
          const weightIndex = rank - 4;
          if (weightIndex < weights.length) {
            prizeAmount = Math.floor(prize * 0.20 * weights[weightIndex] / sumWeights);
          }
        }
        return { name: h.name, position: rank, prize: prizeAmount };
      })
    });
    
    // 히스토리 50개 유지
    if (stats.history.length > 50) stats.history.pop();
    
    // ROI 계산
    stats.roi = stats.totalBet > 0 
      ? ((stats.totalWin - stats.totalBet) / stats.totalBet * 100) 
      : 0;
    
    await saveStats();
    
    // Firestore 동기화
    await syncToFirestore();
  }

  /**
   * 티켓 수익금 계산
   */
  function calculateTicketReturn(ticket, order) {
    const { type, a, b, amount } = ticket;
    const first = order[0], second = order[1], third = order[2];
    
    if (type === 'WIN') return first === (a - 1) ? amount * 2 : 0;
    
    if (type === 'PLACE') {
      if ((a - 1) === first) return amount * 1.5;
      if ((a - 1) === second) return amount * 1.3;
      if ((a - 1) === third) return amount * 1.2;
      return 0;
    }
    
    if (type === 'QUINELLA') {
      const i = Math.min(a - 1, b - 1), j = Math.max(a - 1, b - 1);
      const fi = Math.min(first, second), fj = Math.max(first, second);
      return (i === fi && j === fj) ? amount * 3 : 0;
    }
    
    if (type === 'EXACTA') return ((a - 1) === first && (b - 1) === second) ? amount * 5 : 0;
    
    if (type === 'PLACEQ') {
      const top3 = new Set([first, second, third]);
      return (top3.has(a - 1) && top3.has(b - 1)) ? amount * 2.5 : 0;
    }
    
    return 0;
  }

  /**
   * Firestore에 통계 동기화
   */
  async function syncToFirestore() {
    if (!window.ReplayRecorder?.saveUserStats) return;
    
    try {
      const formattedStats = {
        horseStats: {},
        jockeyStats: {},
        distanceStats: {},
        trackStats: {},
        gradeStats: {},
        weatherStats: {},
        timeStats: {},
        summary: {
          totalGames: stats.totalRaces || 0,
          totalPrize: stats.totalWin || 0,
          totalBet: stats.totalBet || 0,
          totalReturn: stats.totalWin || 0
        },
        history: stats.history || []
      };
      
      // 말별 통계 변환
      for (const [name, data] of Object.entries(stats.byHorse || {})) {
        formattedStats.horseStats[name] = {
          name: name,
          races: data.races || 0,
          wins: data.wins || 0,
          places: data.places || 0,
          totalScore: (data.wins || 0) * 100 + (data.places || 0) * 25,
          bet: data.bet || 0,
          win: data.win || 0
        };
      }
      
      // 기수별 통계 변환
      for (const [name, data] of Object.entries(stats.byJockey || {})) {
        formattedStats.jockeyStats[name] = {
          name: name,
          rides: data.races || 0,
          wins: data.wins || 0,
          top3: data.places || 0,
          totalScore: (data.wins || 0) * 100 + (data.places || 0) * 25
        };
      }
      
      // 거리별 통계
      for (const [key, data] of Object.entries(stats.byDistance || {})) {
        formattedStats.distanceStats[key] = {
          distance: key,
          races: data.races || 0,
          wins: data.wins || 0
        };
      }
      
      // 트랙별 통계
      for (const [key, data] of Object.entries(stats.byTrack || {})) {
        formattedStats.trackStats[key] = {
          track: key,
          races: data.races || 0,
          wins: data.wins || 0
        };
      }
      
      // 등급별 통계
      for (const [key, data] of Object.entries(stats.byGrade || {})) {
        formattedStats.gradeStats[key] = {
          grade: key,
          races: data.races || 0,
          wins: data.wins || 0
        };
      }
      
      await window.ReplayRecorder.saveUserStats(formattedStats, 'StatsSystem_v5.1.1');
      console.log('[StatsSystem] Synced to Firestore');
    } catch (e) {
      console.warn('[StatsSystem] Firestore sync failed:', e);
    }
  }

  /**
   * 현재 통계 반환
   */
  function getStats() { 
    if (!stats) initStats(); 
    return stats; 
  }

  /**
   * ROI 포맷팅
   */
  function fmtRoi(v) { 
    const sign = v >= 0 ? '+' : ''; 
    return sign + v.toFixed(1) + '%'; 
  }

  /**
   * 대시보드 렌더링
   */
  function renderDashboard() {
    if (!stats) {
      console.warn('[StatsSystem] Stats not initialized, calling initStats...');
      initStats();
    }
    
    // stats가 여전히 null이면 기본값 사용
    const s = stats || getDefaultStats();
    
    const winRate = s.totalRaces > 0 ? (s.totalWins / s.totalRaces * 100).toFixed(1) : '0.0';
    const roi = s.totalBet > 0 ? ((s.totalWin - s.totalBet) / s.totalBet * 100).toFixed(1) : '0.0';

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('statTotalRaces', s.totalRaces);
    setText('statWins', s.totalWins);
    setText('statWinRate', winRate + '%');
    setText('statTotalPnl', (s.totalWin - s.totalBet >= 0 ? '+' : '') + Math.floor(s.totalWin - s.totalBet).toLocaleString());

    renderProfitChart(s.history);
    renderHorseStats(s.byHorse);
    renderJockeyStats(s.byJockey);
    renderTrackStats(s.byTrack);
    renderDistanceStats(s.byDistance);
    renderBetTypeStats(s.byBetType);
    renderAnalysis(s);
  }

  /**
   * 수익 추이 차트 렌더링
   */
  function renderProfitChart(history) {
    const container = document.getElementById('chartProfit');
    if (!container || !history || history.length === 0) {
      if (container) container.innerHTML = '<div style="padding:40px;text-align:center;color:#8890b0;">경기 데이터가 없습니다</div>';
      return;
    }
    
    let cumulative = 0;
    const data = history.map((h, i) => { 
      cumulative += h.pnl; 
      return { label: '경' + h.raceNo, value: cumulative }; 
    }).reverse();
    
    const profits = data.map(d => d.value);
    const maxP = Math.max(...profits), minP = Math.min(...profits), avgP = profits.reduce((a, b) => a + b, 0) / profits.length;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('statMaxProfit', '+' + Math.floor(maxP));
    setText('statAvgProfit', (avgP >= 0 ? '+' : '') + Math.floor(avgP));
    setText('statMinProfit', Math.floor(minP));

    container.innerHTML = window.ChartEngine?.createLineChart({
      data, 
      width: Math.min(700, container.offsetWidth || 600), 
      height: 180,
      title: '누적 수익 추이', 
      color: '#6C5CE7', 
      showArea: true, 
      showPoints: true, 
      showTrendLine: true, 
      animated: true
    }) || '';
  }

  /**
   * 말별 승률 차트 렌더링
   */
  function renderHorseStats(byHorse) {
    const container = document.getElementById('chartHorseStats');
    if (!container) return;
    
    const sorted = Object.entries(byHorse || {})
      .filter(([_, d]) => d.races >= 3)
      .map(([name, d]) => ({ 
        label: name, 
        value: d.wins, 
        races: d.races, 
        percent: d.races > 0 ? (d.wins / d.races * 100) : 0 
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
    
    if (sorted.length === 0) { 
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8890b0;">데이터 부족</div>'; 
      return; 
    }
    
    container.innerHTML = window.ChartEngine?.createBarChart({ 
      data: sorted.map(s => ({ label: s.label, value: s.percent, suffix: '%' })), 
      width: Math.min(350, container.offsetWidth || 300), 
      height: 160, 
      horizontal: true, 
      showValues: true 
    }) || '';
  }

  /**
   * 기수별 승률 차트 렌더링
   */
  function renderJockeyStats(byJockey) {
    const container = document.getElementById('chartJockeyStats');
    if (!container) return;
    
    const sorted = Object.entries(byJockey || {})
      .filter(([_, d]) => d.races >= 3)
      .map(([name, d]) => ({ 
        label: name, 
        value: d.wins, 
        races: d.races, 
        percent: d.races > 0 ? (d.wins / d.races * 100) : 0 
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
    
    if (sorted.length === 0) { 
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8890b0;">데이터 부족</div>'; 
      return; 
    }
    
    container.innerHTML = window.ChartEngine?.createBarChart({ 
      data: sorted.map(s => ({ label: s.label, value: s.percent, suffix: '%' })), 
      width: Math.min(350, container.offsetWidth || 300), 
      height: 160, 
      horizontal: true, 
      showValues: true 
    }) || '';
  }

  /**
   * 트랙별 출전 수 차트 렌더링
   */
  function renderTrackStats(byTrack) {
    const container = document.getElementById('chartTrackStats');
    if (!container) return;
    
    const trackNames = { seoul: '서울', busan: '부산', jeju: '제주' };
    const data = Object.entries(byTrack || {})
      .filter(([_, d]) => d.races > 0)
      .map(([k, d]) => ({ 
        label: trackNames[k] || k, 
        value: d.races, 
        suffix: '경' 
      }));
    
    if (data.length === 0) { 
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8890b0;">데이터 부족</div>'; 
      return; 
    }
    
    container.innerHTML = window.ChartEngine?.createBarChart({ 
      data, 
      width: Math.min(280, container.offsetWidth || 250), 
      height: 140, 
      colorArray: ['#54a0ff', '#ff9ff3', '#1dd1a1'] 
    }) || '';
  }

  /**
   * 거리별 출전 수 차트 렌더링
   */
  function renderDistanceStats(byDistance) {
    const container = document.getElementById('chartDistanceStats');
    if (!container) return;
    
    const data = Object.entries(byDistance || {})
      .filter(([_, d]) => d.races > 0)
      .map(([k, d]) => ({ 
        label: k + 'm', 
        value: d.races, 
        suffix: '경' 
      }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));
    
    if (data.length === 0) { 
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8890b0;">데이터 부족</div>'; 
      return; 
    }
    
    container.innerHTML = window.ChartEngine?.createBarChart({ 
      data, 
      width: Math.min(280, container.offsetWidth || 250), 
      height: 140 
    }) || '';
  }

  /**
   * 베팅 유형별 수익 차트 렌더링
   */
  function renderBetTypeStats(byBetType) {
    const containerBars = document.getElementById('chartBetTypeBars');
    const containerPie = document.getElementById('chartBetTypePie');
    if (!containerBars) return;
    
    const betNames = { WIN: '단승', PLACE: '연승', QUINELLA: '복승', EXACTA: '쌍승', PLACEQ: '복연승' };
    const barData = Object.entries(byBetType || {})
      .filter(([_, d]) => d.bet > 0)
      .map(([k, d]) => ({ 
        label: betNames[k], 
        value: Math.floor(d.win), 
        suffix: '원' 
      }));
    
    containerBars.innerHTML = barData.length > 0 
      ? window.ChartEngine?.createBarChart({ 
          data: barData, 
          width: Math.min(300, containerBars.offsetWidth || 280), 
          height: 180 
        }) || ''
      : '<div style="padding:40px;text-align:center;color:#8890b0;">베팅 데이터 없음</div>';
    
    if (containerPie) {
      const pieData = Object.entries(byBetType || {})
        .filter(([_, d]) => d.win > 0)
        .map(([k, d]) => ({ 
          label: betNames[k], 
          value: Math.floor(d.win) 
        }));
      containerPie.innerHTML = pieData.length > 0 
        ? window.ChartEngine?.createPieChart({ 
            data: pieData, 
            width: 200, 
            height: 180, 
            donut: true 
          }) || ''
        : '';
    }
  }

  /**
   * AI 분석 텍스트 생성
   */
  function renderAnalysis(s) {
    const container = document.getElementById('statsAnalysis');
    if (!container) return;
    
    const lines = [];
    const winRate = s.totalRaces > 0 ? (s.totalWins / s.totalRaces * 100).toFixed(1) : 0;
    
    lines.push('총 ' + s.totalRaces + '경주 출전, 승률 ' + winRate + '%');
    
    const topHorse = Object.entries(s.byHorse || {})
      .filter(([_, d]) => d.races >= 5)
      .sort((a, b) => (b[1].wins / b[1].races) - (a[1].wins / a[1].races))[0];
    if (topHorse) lines.push('TOP 말: ' + topHorse[0] + ' (' + (topHorse[1].wins / topHorse[1].races * 100).toFixed(0) + '%)');
    
    const topJockey = Object.entries(s.byJockey || {})
      .filter(([_, d]) => d.races >= 5)
      .sort((a, b) => (b[1].wins / b[1].races) - (a[1].wins / a[1].races))[0];
    if (topJockey) lines.push('TOP 기수: ' + topJockey[0] + ' (' + (topJockey[1].wins / topJockey[1].races * 100).toFixed(0) + '%)');
    
    if (s.history && s.history.length >= 5) {
      const recent5 = s.history.slice(0, 5).reduce((sum, h) => sum + h.pnl, 0);
      if (recent5 > 0) lines.push('📈 최근 5경주 상승 추세 (+' + recent5 + '원)');
      else if (recent5 < 0) lines.push('📉 최근 5경주 하락 추세 (' + recent5 + '원)');
    }
    
    const roi = s.totalBet > 0 ? ((s.totalWin - s.totalBet) / s.totalBet * 100).toFixed(1) : 0;
    lines.push('총 수익률: ' + (roi >= 0 ? '+' : '') + roi + '%');
    
    container.innerHTML = lines.join('<br>');
  }

  // 전역 객체로 노출
  window.StatsSystem = { 
    init: initStats,
    update: updateStats,
    get: getStats,
    save: saveStats,
    render: renderDashboard,
    fmtRoi: fmtRoi
  };

  console.log('[StatsSystem v5.1.1] Loaded');
})();
