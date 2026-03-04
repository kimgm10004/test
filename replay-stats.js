/**
 * 세분화된 통계 분석 모듈
 * 말, 기수, 거리, 날씨, 트랙, 등급 등 다양한 기준별 통계
 */
(function() {
  'use strict';

  // ==================== 기본 통계 함수들 ====================

  // 요약 통계 계산
  function calculateSummary(replays) {
    let totalBet = 0;
    let totalReturn = 0;
    let winCount = 0;
    let totalPrize = 0;
    let totalWins = 0;  // 1위 횟수
    let totalPlace = 0; // 연승(3위내) 횟수

    replays.forEach(replay => {
      if (replay.stats) {
        totalBet += replay.stats.totalBet || 0;
        totalReturn += replay.stats.totalReturn || 0;
        totalPrize += replay.stats.prize || 0;
        
        if ((replay.stats.pnl || 0) > 0) winCount++;
        
        // 베팅 성공 여부
        if (replay.stats.ticketCount > 0) {
          // 실제로는 베팅 결과를 확인해야 하지만, pnl로 대체
        }
      }
    });

    const pnl = totalReturn - totalBet;
    const winRate = replays.length > 0 ? (winCount / replays.length * 100).toFixed(1) : 0;
    const roi = totalBet > 0 ? ((pnl / totalBet) * 100).toFixed(1) : 0;

    return {
      totalBet,
      totalReturn,
      pnl,
      totalPrize,
      winCount,
      totalRaces: replays.length,
      winRate,
      roi,
      avgPnlPerRace: replays.length > 0 ? Math.floor(pnl / replays.length) : 0
    };
  }

  // ==================== 말별 통계 (번호 기준 TOP 10) ====================
  function calculateHorseStatsByNumber(replays) {
    const horseMap = new Map();

    replays.forEach(replay => {
      if (replay.stats?.horseResults) {
        replay.stats.horseResults.forEach(horse => {
          const key = horse.no.toString(); // 번호 기준
          
          if (!horseMap.has(key)) {
            horseMap.set(key, {
              no: horse.no,
              totalRaces: 0,
              wins: 0,
              second: 0,
              third: 0,
              top3: 0,
              avgRank: 0,
              rankSum: 0,
              names: new Set(), // 여러 이름 저장
              sires: new Set(),
              bestSpeed: 0
            });
          }

          const stats = horseMap.get(key);
          stats.totalRaces++;
          stats.names.add(horse.name);
          stats.sires.add(horse.sire);
          
          if (horse.finalPosition === 1) stats.wins++;
          if (horse.finalPosition === 2) stats.second++;
          if (horse.finalPosition === 3) stats.third++;
          if (horse.finalPosition <= 3) stats.top3++;
          
          stats.rankSum += horse.finalPosition;
          stats.bestSpeed = Math.max(stats.bestSpeed, horse.speed || 0);
        });
      }
    });

    // 평균 순위 계산 및 정렬 (출전 횟수 기준 TOP 10)
    const horseList = Array.from(horseMap.values()).map(h => {
      h.avgRank = h.totalRaces > 0 ? (h.rankSum / h.totalRaces).toFixed(1) : 0;
      h.winRate = h.totalRaces > 0 ? (h.wins / h.totalRaces * 100).toFixed(1) : 0;
      h.top3Rate = h.totalRaces > 0 ? (h.top3 / h.totalRaces * 100).toFixed(1) : 0;
      h.names = Array.from(h.names).slice(0, 3); // 최대 3개 이름
      h.sires = Array.from(h.sires).slice(0, 2);
      return h;
    });

    return horseList
      .sort((a, b) => b.totalRaces - a.totalRaces)
      .slice(0, 10);
  }

  // ==================== 기수별 통계 (TOP 5) ====================
  function calculateJockeyStats(replays) {
    const jockeyMap = new Map();

    replays.forEach(replay => {
      if (replay.stats?.horseResults) {
        replay.stats.horseResults.forEach(horse => {
          if (!horse.jockey) return;
          
          const key = horse.jockey;
          
          if (!jockeyMap.has(key)) {
            jockeyMap.set(key, {
              name: horse.jockey,
              totalRides: 0,
              wins: 0,
              second: 0,
              third: 0,
              top3: 0,
              avgRank: 0,
              rankSum: 0,
              totalEarnings: 0
            });
          }

          const stats = jockeyMap.get(key);
          stats.totalRides++;
          
          if (horse.finalPosition === 1) {
            stats.wins++;
            // 1위 상금 (실제로는 분배 로직이 더 복잡함)
            stats.totalEarnings += (replay.stats?.prizeDistribution?.first || 0) * 0.05; // 5% 기수 수당
          }
          if (horse.finalPosition === 2) stats.second++;
          if (horse.finalPosition === 3) stats.third++;
          if (horse.finalPosition <= 3) stats.top3++;
          
          stats.rankSum += horse.finalPosition;
        });
      }
    });

    const jockeyList = Array.from(jockeyMap.values()).map(j => {
      j.avgRank = j.totalRides > 0 ? (j.rankSum / j.totalRides).toFixed(1) : 0;
      j.winRate = j.totalRides > 0 ? (j.wins / j.totalRides * 100).toFixed(1) : 0;
      j.top3Rate = j.totalRides > 0 ? (j.top3 / j.totalRides * 100).toFixed(1) : 0;
      return j;
    });

    return jockeyList
      .sort((a, b) => b.totalRides - a.totalRides)
      .slice(0, 5);
  }

  // ==================== 거리별 통계 ====================
  function calculateDistanceStats(replays) {
    const distanceMap = new Map();

    replays.forEach(replay => {
      const distance = replay.distance || 0;
      const key = distance + 'm';
      
      if (!distanceMap.has(key)) {
        distanceMap.set(key, {
          distance: distance + 'm',
          totalRaces: 0,
          wins: 0, // 수익이 +인 경기
          totalPnl: 0,
          totalBet: 0,
          firstPlaceWins: 0 // 1위한 횟수
        });
      }

      const stats = distanceMap.get(key);
      stats.totalRaces++;
      
      if (replay.stats) {
        if ((replay.stats.pnl || 0) > 0) stats.wins++;
        stats.totalPnl += replay.stats.pnl || 0;
        stats.totalBet += replay.stats.totalBet || 0;
        
        // 베팅에서 1위한 경우 체크 (간단화)
        if (replay.stats.horseResults) {
          // 실제로는 베팅한 말이 1위인지 체크해야 함
        }
      }
    });

    return Array.from(distanceMap.values()).map(d => ({
      ...d,
      winRate: d.totalRaces > 0 ? (d.wins / d.totalRaces * 100).toFixed(1) : 0,
      roi: d.totalBet > 0 ? ((d.totalPnl / d.totalBet) * 100).toFixed(1) : 0
    })).sort((a, b) => a.distance.localeCompare(b.distance));
  }

  // ==================== 날씨별 통계 ====================
  function calculateWeatherStats(replays) {
    const weatherMap = new Map();

    replays.forEach(replay => {
      // 날씨 정보가 저장되어 있지 않으므로 추정
      // 실제로는 replay에 weather 필드가 필요
      const weather = '맑음'; // 기본값, 실제 데이터 필요
      
      if (!weatherMap.has(weather)) {
        weatherMap.set(weather, {
          weather: weather,
          totalRaces: 0,
          wins: 0,
          totalPnl: 0
        });
      }

      const stats = weatherMap.get(weather);
      stats.totalRaces++;
      
      if (replay.stats) {
        if ((replay.stats.pnl || 0) > 0) stats.wins++;
        stats.totalPnl += replay.stats.pnl || 0;
      }
    });

    return Array.from(weatherMap.values()).map(w => ({
      ...w,
      winRate: w.totalRaces > 0 ? (w.wins / w.totalRaces * 100).toFixed(1) : 0
    }));
  }

  // ==================== 트랙별 통계 (서울/제주/부산) ====================
  function calculateTrackLocationStats(replays) {
    const locationMap = new Map();

    replays.forEach(replay => {
      const location = replay.track || '알수없음';
      
      if (!locationMap.has(location)) {
        locationMap.set(location, {
          location: location,
          totalRaces: 0,
          wins: 0,
          totalPnl: 0,
          totalBet: 0,
          avgPrize: 0,
          totalPrize: 0
        });
      }

      const stats = locationMap.get(location);
      stats.totalRaces++;
      
      if (replay.stats) {
        if ((replay.stats.pnl || 0) > 0) stats.wins++;
        stats.totalPnl += replay.stats.pnl || 0;
        stats.totalBet += replay.stats.totalBet || 0;
        stats.totalPrize += replay.stats.prize || 0;
      }
    });

    return Array.from(locationMap.values()).map(t => ({
      ...t,
      winRate: t.totalRaces > 0 ? (t.wins / t.totalRaces * 100).toFixed(1) : 0,
      roi: t.totalBet > 0 ? ((t.totalPnl / t.totalBet) * 100).toFixed(1) : 0,
      avgPrize: t.totalRaces > 0 ? Math.floor(t.totalPrize / t.totalRaces) : 0
    })).sort((a, b) => b.totalRaces - a.totalRaces);
  }

  // ==================== 등급별 통계 (G1, G2, G3, OPEN, 1등급...) ====================
  function calculateGradeStatsDetailed(replays) {
    const gradeMap = new Map();

    // 등급 우선순위 정의
    const gradeOrder = ['G1', 'G2', 'G3', 'OPEN', '1등급', '2등급', '3등급', '4등급', '5등급'];

    replays.forEach(replay => {
      const grade = replay.grade || '알수없음';
      
      if (!gradeMap.has(grade)) {
        gradeMap.set(grade, {
          grade: grade,
          totalRaces: 0,
          wins: 0,
          totalPnl: 0,
          totalBet: 0,
          totalPrize: 0,
          avgPrize: 0,
          bestPnl: -999999999,
          worstPnl: 999999999
        });
      }

      const stats = gradeMap.get(grade);
      stats.totalRaces++;
      
      if (replay.stats) {
        if ((replay.stats.pnl || 0) > 0) stats.wins++;
        stats.totalPnl += replay.stats.pnl || 0;
        stats.totalBet += replay.stats.totalBet || 0;
        stats.totalPrize += replay.stats.prize || 0;
        stats.bestPnl = Math.max(stats.bestPnl, replay.stats.pnl || 0);
        stats.worstPnl = Math.min(stats.worstPnl, replay.stats.pnl || 0);
      }
    });

    const gradeList = Array.from(gradeMap.values()).map(g => ({
      ...g,
      winRate: g.totalRaces > 0 ? (g.wins / g.totalRaces * 100).toFixed(1) : 0,
      roi: g.totalBet > 0 ? ((g.totalPnl / g.totalBet) * 100).toFixed(1) : 0,
      avgPrize: g.totalRaces > 0 ? Math.floor(g.totalPrize / g.totalRaces) : 0
    }));

    // 등급 순서대로 정렬
    return gradeList.sort((a, b) => {
      const aIndex = gradeOrder.indexOf(a.grade);
      const bIndex = gradeOrder.indexOf(b.grade);
      if (aIndex === -1 && bIndex === -1) return a.grade.localeCompare(b.grade);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  // ==================== 시간대별 통계 ====================
  function calculateTimeStats(replays) {
    const hourMap = new Map();

    replays.forEach(replay => {
      const date = new Date(replay.date);
      const hour = date.getHours();
      const timeSlot = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';
      
      if (!hourMap.has(timeSlot)) {
        hourMap.set(timeSlot, {
          timeSlot: timeSlot,
          totalRaces: 0,
          wins: 0,
          totalPnl: 0
        });
      }

      const stats = hourMap.get(timeSlot);
      stats.totalRaces++;
      
      if (replay.stats) {
        if ((replay.stats.pnl || 0) > 0) stats.wins++;
        stats.totalPnl += replay.stats.pnl || 0;
      }
    });

    return Array.from(hourMap.values()).map(t => ({
      ...t,
      winRate: t.totalRaces > 0 ? (t.wins / t.totalRaces * 100).toFixed(1) : 0
    }));
  }

  // ==================== 최근 추세 ====================
  function calculateRecentTrend(replays) {
    const recent = replays.slice(0, 10);
    const pnls = recent.map(r => r.stats?.pnl || 0);
    
    return {
      recentPnls: pnls,
      recentWinRate: recent.length > 0 
        ? (recent.filter(r => (r.stats?.pnl || 0) > 0).length / recent.length * 100).toFixed(1)
        : 0,
      recentTotalPnl: pnls.reduce((a, b) => a + b, 0),
      trend: pnls[0] > 0 ? '상승' : pnls[0] < 0 ? '하락' : '보합',
      streak: calculateStreak(replays)
    };
  }

  // 연승/연패 계산
  function calculateStreak(replays) {
    let currentStreak = 0;
    let streakType = '';
    
    for (let i = 0; i < replays.length; i++) {
      const pnl = replays[i].stats?.pnl || 0;
      const isWin = pnl > 0;
      
      if (i === 0) {
        currentStreak = 1;
        streakType = isWin ? '승' : '패';
      } else {
        const prevPnl = replays[i-1].stats?.pnl || 0;
        const prevIsWin = prevPnl > 0;
        
        if (isWin === prevIsWin) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
    
    return {
      type: streakType,
      count: currentStreak
    };
  }

  // ==================== 메인 계산 함수 ====================

  async function calculateAllStats() {
    const replays = await window.ReplayRecorder?.getAll() || [];
    
    if (replays.length === 0) {
      return null;
    }

    console.log('[ReplayStats] Calculating detailed stats for', replays.length, 'replays');

    return {
      totalReplays: replays.length,
      summary: calculateSummary(replays),
      
      // 세분화된 통계들
      horseStats: calculateHorseStatsByNumber(replays),
      jockeyStats: calculateJockeyStats(replays),
      distanceStats: calculateDistanceStats(replays),
      weatherStats: calculateWeatherStats(replays),
      trackLocationStats: calculateTrackLocationStats(replays),
      gradeStats: calculateGradeStatsDetailed(replays),
      timeStats: calculateTimeStats(replays),
      
      recentTrend: calculateRecentTrend(replays)
    };
  }

  // 전역 객체로 노출
  window.ReplayStats = {
    calculateAllStats,
    calculateHorseStatsByNumber,
    calculateJockeyStats,
    calculateDistanceStats,
    calculateWeatherStats,
    calculateTrackLocationStats,
    calculateGradeStatsDetailed,
    calculateTimeStats,
    calculateRecentTrend
  };

  console.log('[ReplayStats] Detailed statistics module loaded');
})();
