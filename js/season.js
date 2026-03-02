/**
 * 시즌 보상 시스템 - 도트 경마 v5.1.1 (개선판)
 * 
 * 기능:
 * - 52주 시즌 진행 및 추적
 * - 순위 및 티어 시스템
 * - 시즌 종료 보상 계산 및 지급
 * - 랭킹 히스토리 관리
 * - DataManager 통합 (원자적 저장, 롤백 지원)
 * 
 * 저장소: DataManager (Firestore + IndexedDB + LocalStorage)
 * 
 * @version 5.1.1
 * @author 도겜유튜브
 */

(function() {
  'use strict';

  /**
   * 시즌 보상 설정
   */
  const REWARDS = {
    // 순위별 보상
    ranking: {
      1: { money: 500000, title: '챔피언', badge: 'gold', tier: 'G1_CHAMPION' },
      2: { money: 300000, title: '러너업', badge: 'silver', tier: 'G2_MASTER' },
      3: { money: 200000, title: '메달리스트', badge: 'bronze', tier: 'G3_EXPERT' },
      4: { money: 100000, title: 'TOP 10' },
      5: { money: 80000, title: 'TOP 10' },
      6: { money: 70000, title: 'TOP 10' },
      7: { money: 60000, title: 'TOP 10' },
      8: { money: 50000, title: 'TOP 10' },
      9: { money: 50000, title: 'TOP 10' },
      10: { money: 50000, title: 'TOP 10' }
    },
    // 추가 보상
    bonuses: {
      endBonusRate: 0.10,              // 시즌 수익의 10% 별너스
      g1Participation: { count: 5, reward: 50000 },  // G1 5회 출전 달성
      undefeatedWin: 100000              // 무승부 우승 (미사용)
    },
    // 티어 조건
    tiers: {
      G1_CHAMPION: { rank: 1, g1Races: 5 },
      G2_MASTER: { rankPercent: 0.05, g2Races: 8 },
      G3_EXPERT: { rankPercent: 0.15, g3Races: 10 }
    }
  };

  // 현재 시즌 데이터 (캐시)
  let seasonData = null;
  let isInitialized = false;

  /**
   * 시즌 시스템 초기화
   * DataManager와 통합하여 일관성 보장
   * 
   * @returns {Object} 현재 시즌 데이터
   */
  async function initSeason() {
    if (isInitialized && seasonData) return seasonData;
    
    console.log('[SeasonSystem v5.1.1] Initializing...');
    
    try {
      // DataManager 초기화
      if (window.DataManager && !window.DataManager.db) {
        await window.DataManager.init();
      }
      
      // DataManager에서 시즌 데이터 로드
      if (window.DataManager) {
        seasonData = await window.DataManager.load('season');
      }
      
      // DataManager에 없으면 로컬에서 로드 (마이그레이션)
      if (!seasonData) {
        seasonData = await migrateFromLegacy();
      }
      
      // 데이터 검증 및 기본값 설정
      if (!validateSeasonData(seasonData)) {
        console.warn('[SeasonSystem] Invalid season data, resetting...');
        seasonData = window.DataManager?.getDefaultSeasonData() || getDefaultSeasonData();
      }
      
      // 버전 체크 및 마이그레이션
      if (window.GameUtils?.needsMigration('5.1.1', seasonData.version)) {
        seasonData = migrateSeason(seasonData);
      }
      
      isInitialized = true;
      console.log('[SeasonSystem v5.1.1] Initialized - Week:', seasonData.week, 'Score:', seasonData.totalScore);
      
    } catch (error) {
      console.error('[SeasonSystem] Init failed:', error);
      seasonData = getDefaultSeasonData();
    }
    
    return seasonData;
  }

  /**
   * 기존 LocalStorage에서 마이그레이션
   */
  async function migrateFromLegacy() {
    try {
      const legacy = window.Storage.getItem('season');
      if (legacy) {
        const parsed = legacy;
        console.log('[SeasonSystem] Migrating from legacy storage...');
        
        // DataManager에 저장
        if (window.DataManager) {
          await window.DataManager.save('season', parsed);
        }
        
        return parsed;
      }
    } catch (e) {
      console.warn('[SeasonSystem] Legacy migration failed:', e);
    }
    return null;
  }

  /**
   * 시즌 데이터 검증
   */
  function validateSeasonData(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.week !== 'number' || data.week < 1 || data.week > 52) return false;
    if (typeof data.totalScore !== 'number' || data.totalScore < 0) return false;
    if (typeof data.totalEntries !== 'number' || data.totalEntries < 0) return false;
    return true;
  }

  /**
   * 시즌 데이터 마이그레이션
   */
  function migrateSeason(data) {
    const defaults = getDefaultSeasonData();
    const migrated = { ...defaults };
    
    // 안전하게 데이터 복사 (깊은 복사)
    Object.keys(data).forEach(key => {
      if (key === 'races' || key === 'rankHistory' || key === 'seasonHistory') {
        // 배열은 깊은 복사
        migrated[key] = Array.isArray(data[key]) ? [...data[key]] : [];
      } else if (key === 'titles' || key === 'badges') {
        migrated[key] = Array.isArray(data[key]) ? [...data[key]] : [];
      } else {
        migrated[key] = data[key] !== undefined ? data[key] : defaults[key];
      }
    });
    
    migrated.version = '5.1.1';
    console.log('[SeasonSystem] Migrated to v5.1.1');
    return migrated;
  }

  /**
   * 기본 시즌 데이터
   */
  function getDefaultSeasonData() {
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
      version: '5.1.1'
    };
  }

  /**
   * 시즌 데이터 저장 (원자적 저장)
   */
  async function saveSeason() {
    if (!seasonData) return false;
    
    // DataManager 사용
    if (window.DataManager) {
      const success = await window.DataManager.save('season', seasonData);
      if (success) {
        console.log('[SeasonSystem] Saved via DataManager');
      return true;
    }
    
    // Fallback to StorageManager
    try {
      window.Storage.setItem('season', seasonData);
      return true;
    } catch (e) {
      console.error('[SeasonSystem] Save failed:', e);
      return false;
    }
  }
    
    // Fallback to localStorage
    try {
      localStorage.setItem('dot_racing_season', JSON.stringify(seasonData));
      return true;
    } catch (e) {
      console.error('[SeasonSystem] Save failed:', e);
      return false;
    }
  }

  /**
   * 시즌 업데이트
   * 경기 종료 후 호출
   */
  async function updateSeason(params) {
    if (!seasonData) await initSeason();
    
    const { order = [], betInfo = {}, grade = 'OPEN', distance = 1200, track = 'seoul' } = params;
    const { totalBet = 0, totalReturn = 0 } = betInfo;
    
    // 베팅 체크
    let hasBet = false;
    let rank = null;
    
    if (typeof userTickets !== 'undefined' && userTickets.length > 0) {
      hasBet = true;
      const userHorseIdx = userTickets[0].a - 1; // 번호를 인덱스로 변환
      if (userHorseIdx >= 0 && order.includes(userHorseIdx)) {
        rank = order.indexOf(userHorseIdx) + 1;
      }
    }
    
    // 등급별 출전 수 증가
    if (grade === 'G1') seasonData.g1Count++;
    else if (grade === 'G2') seasonData.g2Count++;
    else if (grade === 'G3') seasonData.g3Count++;
    else if (grade === 'OPEN') seasonData.openCount++;
    else if (grade === '1등급') seasonData.grade1Count++;
    else if (grade === '2등급') seasonData.grade2Count++;
    
    seasonData.totalEntries++;
    
    // 베팅 안 했으면 점수 기록 안 함
    if (!hasBet) {
      await saveSeason();
      return;
    }
    
    const pnl = totalReturn - totalBet;
    seasonData.totalBet += totalBet;
    seasonData.totalWin += pnl;
    
    // 점수 계산 (GameUtils 사용)
    const score = window.GameUtils?.calculateScore(rank) || calculateScoreFallback(rank);
    
    seasonData.races.push({
      raceNo: seasonData.totalEntries,
      grade, distance, rank: rank || order.length, pnl, track, score,
      date: new Date().toISOString()
    });
    
    seasonData.rankHistory.push(rank || order.length);
    seasonData.totalScore += score;
    
    // 히스토리 50개 유지
    if (seasonData.rankHistory.length > 50) seasonData.rankHistory.shift();
    
    if (rank === 1) seasonData.wins++;
    else if (rank && rank <= 3) seasonData.places++;
    
    updateTrend();
    seasonData.currentRank = calculateVirtualRank();
    
    console.log('[SeasonSystem] Updated - Rank:', rank, 'Score:', score, 'TotalScore:', seasonData.totalScore);
    
    await saveSeason();
  }

  /**
   * Fallback 점수 계산 (GameUtils 없을 때)
   */
  function calculateScoreFallback(position) {
    if (!position || position > 16) return 10;
    
    const scoreMap = {
      1: 100, 2: 50, 3: 25, 4: 14, 5: 13, 6: 12, 7: 11, 8: 10,
      9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2
    };
    
    return scoreMap[position] || 10;
  }

  /**
   * 추세 업데이트
   */
  function updateTrend() {
    const recent = seasonData.rankHistory.slice(-10);
    if (recent.length < 5) {
      seasonData.last10RacesTrend = 0;
      return;
    }
    
    const mid = Math.floor(recent.length / 2);
    const recentAvg = recent.slice(mid).reduce((a, b) => a + b, 0) / recent.slice(mid).length;
    const prevAvg = recent.slice(0, mid).reduce((a, b) => a + b, 0) / recent.slice(0, mid).length;
    seasonData.last10RacesTrend = parseFloat((prevAvg - recentAvg).toFixed(2));
  }

  /**
   * 가상 순위 계산
   */
  function calculateVirtualRank() {
    if (seasonData.totalEntries === 0) return null;
    const winRate = seasonData.wins / seasonData.totalEntries;
    const baseRank = Math.floor(Math.random() * 100) + 1;
    return Math.min(Math.max(1, Math.floor(baseRank * (1 - winRate * 0.3))), 200);
  }

  /**
   * 보상 계산
   */
  function calculateRewards() {
    if (!seasonData) initSeason();
    
    const rewards = [];
    const rank = seasonData.currentRank || 100;
    const pnl = seasonData.totalWin;

    if (rank <= 10 && REWARDS.ranking[rank]) {
      const r = REWARDS.ranking[rank];
      rewards.push({ type: 'rank', rank, title: r.title, badge: r.badge, tier: r.tier, money: r.money });
    }

    if (pnl > 0) {
      const bonus = Math.floor(pnl * REWARDS.bonuses.endBonusRate);
      rewards.push({ type: 'bonus', name: '시즌 수익 보너스', money: bonus });
    }

    if (seasonData.g1Count >= REWARDS.bonuses.g1Participation.count) {
      rewards.push({ type: 'bonus', name: 'G1 출전 달성', money: REWARDS.bonuses.g1Participation.reward });
    }

    if (seasonData.wins >= 10) rewards.push({ type: 'title', title: 'Decade Winner', icon: '🏆' });
    if (seasonData.g1Count >= 5) rewards.push({ type: 'badge', name: 'G1 Veteran', icon: '⭐' });
    if (seasonData.last10RacesTrend > 2) rewards.push({ type: 'title', title: ' 상승세', icon: '📈' });

    const totalMoney = rewards.reduce((sum, r) => sum + (r.money || 0), 0);
    return { rank, totalEntries: seasonData.totalEntries, rewards, totalMoney };
  }

  /**
   * 보상 청구
   */
  function claimRewards() {
    if (!seasonData) initSeason();
    
    const rewardInfo = calculateRewards();
    
    if (rewardInfo.totalMoney > 0 && typeof window.handleWallet === 'function') {
      window.handleWallet(rewardInfo.totalMoney);
    }
    
    rewardInfo.rewards.filter(r => r.title && !seasonData.titles.includes(r.title))
      .forEach(r => seasonData.titles.push(r.title));
    
    rewardInfo.rewards.filter(r => r.badge && !seasonData.badges.includes(r.badge))
      .forEach(r => seasonData.badges.push(r.badge));
    
    const topReward = rewardInfo.rewards.find(r => r.tier);
    if (topReward) seasonData.tier = topReward.tier;

    seasonData.pendingRewards = [];
    seasonData.totalRewards += rewardInfo.totalMoney;
    seasonData.lastRewardDate = new Date().toISOString();
    saveSeason();
    
    return rewardInfo.totalMoney;
  }

  /**
   * 시즌 종료 확인
   */
  function checkSeasonEnd() {
    if (!seasonData) initSeason();
    if (seasonData.week > 52) {
      showSeasonEndModal();
      return true;
    }
    return false;
  }

  /**
   * 시즌 종료 모달 표시
   */
  function showSeasonEndModal() {
    const modal = document.getElementById('seasonEndModal');
    const rewardInfo = calculateRewards();
    
    if (!modal) {
      alert('시즌 종료! ' + rewardInfo.totalMoney.toLocaleString() + '원 보상');
      return;
    }
    
    const rankEl = document.getElementById('finalRank');
    if (rankEl) rankEl.textContent = rewardInfo.rank;
    
    const rewardsEl = document.getElementById('seasonEndRewards');
    if (rewardsEl) {
      rewardsEl.innerHTML = rewardInfo.rewards.map(r => {
        if (r.type === 'rank') {
          return `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f2940;">
            <span>${r.rank}위 - ${r.title}</span>
            <span class="money">+${r.money.toLocaleString()}원</span></div>`;
        }
        if (r.type === 'bonus') {
          return `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f2940;">
            <span>${r.name}</span>
            <span class="money">+${r.money.toLocaleString()}원</span></div>`;
        }
        return '';
      }).join('');
    }
    
    const pnlEl = document.getElementById('endTotalPnl');
    if (pnlEl) pnlEl.textContent = (seasonData.totalWin >= 0 ? '+' : '') + seasonData.totalWin.toLocaleString();
    
    const rewardTotalEl = document.getElementById('endTotalReward');
    if (rewardTotalEl) rewardTotalEl.textContent = '+' + rewardInfo.totalMoney.toLocaleString();
    
    modal.style.display = 'flex';
  }

  /**
   * 새 시즌 시작
   */
  function startNewSeason() {
    claimRewards();
    
    const modal = document.getElementById('seasonEndModal');
    if (modal) modal.style.display = 'none';
    
    const seasonHistoryEntry = {
      seasonNumber: Math.floor((seasonData.totalEntries || 0) / 6) + 1,
      year: seasonData.year,
      totalEntries: seasonData.totalEntries,
      wins: seasonData.wins,
      places: seasonData.places,
      totalScore: seasonData.totalScore,
      totalPnl: seasonData.totalWin,
      totalPrize: seasonData.totalPrize,
      g1Count: seasonData.g1Count,
      g2Count: seasonData.g2Count,
      g3Count: seasonData.g3Count,
      endDate: new Date().toISOString()
    };
    
    if (!seasonData.seasonHistory) seasonData.seasonHistory = [];
    seasonData.seasonHistory.push(seasonHistoryEntry);
    if (seasonData.seasonHistory.length > 10) seasonData.seasonHistory.shift();
    
    const newYear = seasonData.year + (Math.floor((seasonData.week) / 52) > 0 ? 1 : 0);
    
    seasonData = {
      ...getDefaultSeasonData(),
      year: newYear,
      week: seasonData.week > 52 ? 1 : seasonData.week,
      seasonId: seasonData.year + '_S' + Math.ceil(seasonData.week / 52),
      startDate: new Date().toISOString(),
      totalRewards: seasonData.totalRewards,
      titles: [...seasonData.titles],
      badges: [...seasonData.badges],
      tier: seasonData.tier,
      seasonHistory: [...seasonData.seasonHistory]
    };
    
    saveSeason();
    renderSeasonPanel();
  }

  /**
   * 시즌 패널 렌더링
   */
  function renderSeasonPanel() {
    if (!seasonData) initSeason();
    const s = seasonData;
    
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    
    setText('seasonWeek', s.week);
    setText('seasonRank', s.currentRank || '-');
    setText('seasonEntries', s.totalEntries);
    setText('seasonG1', s.g1Count);
    setText('seasonWins', s.wins);
    setText('seasonScore', s.totalScore || 0);
    setText('seasonPnl', (s.totalWin >= 0 ? '+' : '') + s.totalWin.toLocaleString());
    
    const progressEl = document.getElementById('seasonProgressBar');
    if (progressEl) progressEl.style.width = ((s.week / 52) * 100) + '%';
    
    const tierEl = document.getElementById('seasonTier');
    if (tierEl) {
      const tierNames = { G1_CHAMPION: '챔피언', G2_MASTER: '마스터', G3_EXPERT: '익스퍼트' };
      const tierColors = { G1_CHAMPION: '#FFD700', G2_MASTER: '#C0C0C0', G3_EXPERT: '#CD7F32' };
      tierEl.textContent = s.tier ? (tierNames[s.tier] || s.tier) : '일반';
      tierEl.style.background = s.tier ? tierColors[s.tier] : '#1e2a53';
      tierEl.style.color = s.tier ? '#333' : '#dbe1ff';
    }
    
    const trendEl = document.getElementById('seasonTrend');
    if (trendEl) {
      if (s.last10RacesTrend > 1) trendEl.textContent = '📈 상승 (+' + s.last10RacesTrend + ')';
      else if (s.last10RacesTrend < -1) trendEl.textContent = '📉 하락 (' + s.last10RacesTrend + ')';
      else trendEl.textContent = '➡️ 보합';
    }
    
    const titlesEl = document.getElementById('seasonTitles');
    if (titlesEl) {
      const allTitles = [...s.titles];
      if (s.wins >= 10) allTitles.push('🏆 Decade Winner');
      if (s.g1Count >= 5) allTitles.push('⭐ G1 Veteran');
      titlesEl.innerHTML = allTitles.length === 0 
        ? '<span class="badge" style="opacity:0.5;">아직 없음</span>' 
        : allTitles.map(t => '<span class="badge" style="background:#6C5CE7;color:#fff;">' + t + '</span>').join(' ');
    }
    
    renderSeasonTrendChart();
  }

  /**
   * 시즌 추세 차트 렌더링
   */
  function renderSeasonTrendChart() {
    const container = document.getElementById('chartSeasonTrend');
    if (!container || !seasonData || seasonData.races.length < 5) {
      if (container) container.innerHTML = '<div style="padding:20px;text-align:center;color:#8890b0;">데이터 부족</div>';
      return;
    }
    
    const data = seasonData.races.slice(-20).map((r, i) => ({ 
      label: 'R' + (seasonData.totalEntries - 20 + i + 1), 
      value: r.pnl 
    }));
    
    container.innerHTML = window.ChartEngine?.createLineChart({ 
      data, 
      width: Math.min(500, container.offsetWidth || 450), 
      height: 120, 
      color: '#6C5CE7', 
      showArea: true, 
      showPoints: true 
    }) || '';
  }

  /**
   * 전체 시즌 데이터 반환
   */
  function getSeasonData() {
    return {
      seasonNumber: seasonData?.seasonNumber || 1,
      week: seasonData?.week || 1,
      year: seasonData?.year || 2026,
      gameCount: seasonData?.totalEntries || 0,
      totalPrize: seasonData?.totalPrize || 0,
      wins: seasonData?.wins || 0,
      g1Count: seasonData?.g1Count || 0,
      g2Count: seasonData?.g2Count || 0,
      g3Count: seasonData?.g3Count || 0,
      openCount: seasonData?.openCount || 0,
      grade1Count: seasonData?.grade1Count || 0,
      grade2Count: seasonData?.grade2Count || 0,
      totalEntries: seasonData?.totalEntries || 0,
      totalBet: seasonData?.totalBet || 0,
      totalWin: seasonData?.totalWin || 0,
      totalScore: seasonData?.totalScore || 0,
      currentRank: seasonData?.currentRank || null,
      tier: seasonData?.tier || null,
      titles: seasonData?.titles || [],
      badges: seasonData?.badges || [],
      totalRewards: seasonData?.totalRewards || 0,
      startDate: seasonData?.startDate || new Date().toISOString()
    };
  }

  // 전역 객체로 노출
  window.SeasonSystem = { 
    init: initSeason,
    update: updateSeason,
    get: () => seasonData,
    getSeasonData: getSeasonData,
    save: saveSeason,
    calculateRewards: calculateRewards,
    claimRewards: claimRewards,
    checkSeasonEnd: checkSeasonEnd,
    showEndModal: showSeasonEndModal,
    startNewSeason: startNewSeason,
    render: renderSeasonPanel
  };

  console.log('[SeasonSystem v5.1.1] Loaded');
})();
