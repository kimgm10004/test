/**
 * 물리 엔진 - 도트 경마 v5.2 (흥미진진 버전)
 * 
 * 물리 기반 경주 시뮬레이션
 * - 정규분포 기반 무작위성
 * - 피로도 모델
 * - 날씨/컨디션 영향
 * - 돌발 이벤트 시스템
 * - 후반 역전 시스템
 * 
 * @version 5.2.1 (흥미진진 업데이트)
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  // 물리 상수 - 흥미진진 버전
  const PHYSICS = {
    // 속도 (m/s)
    BASE_VELOCITY: 60,
    MAX_VELOCITY: 100,
    MIN_VELOCITY: 40,
    
    // 가속도 (m/s²)
    BASE_ACCELERATION: 2.5,
    MAX_ACCELERATION: 6.0,
    
    // 피로 관련
    FATIGUE_RATE: 0.015,
    RECOVERY_RATE: 0.001,
    
    // 스퍼트 - 후반 폭발 강화
    BURST_THRESHOLD: 0.75,
    BURST_MULTIPLIER: 2.2,  // 1.8 → 2.2 (後반 스퍼트 강화)
    
    // 날씨
    RAIN_FRICTION: 0.94,  // 0.97 → 0.94 (날씨 영향 강화)
    SNOW_FRICTION: 0.90,  // 0.95 → 0.90
    
    // 무작위성 - Variance 증가
    RANDOM_FACTOR: 0.10,   // 0.08 → 0.10 (±5% → ±10%)
    
    // 돌발 이벤트 확률 (흥미진진 버전)
    SURGE_CHANCE: 0.08,     // 돌발가속 5% → 8%
    SURGE_BOOST: 1.25,       // 돌발가속 효과 20% → 25%
    STUMBLE_CHANCE: 0.003,   // 실신 확률 0.2% → 0.3%
    MAGIC_BURST_CHANCE: 0.02, // 마법의 한방 2%
    MAGIC_BURST_BOOST: 1.50,  // 마법의 한방 효과 50%
    
    // 후반 역전 시스템
    LATE_COMEBACK_BOOST: 1.15,  // 후반 모든 말 가속도 15% ↑
    CLOSE_RACE_THRESHOLD: 0.03, // 接戦認定 3%以内
    
    // 스타일 가중치 - 균형 조정
    STYLE_WEIGHTS: {
      '선행': { early: 1.08, mid: 1.0, late: 0.92 },  // 초반 우위 축소
      '선입': { early: 1.03, mid: 1.05, late: 0.98 }, // 균형
      '추입': { early: 0.88, mid: 0.95, late: 1.35 }, // 後반 대폭발
      '차입': { early: 0.92, mid: 1.0, late: 1.18 },  // 後반 강화
      '만능': { early: 1.0, mid: 1.0, late: 1.02 }   // 미세 후반 보정
    }
  };

  /**
   * 물리 엔진 클래스
   */
  class PhysicsEngine {
    constructor() {
      this.time = 0;
      this.finished = [];
      this.positions = [];
    }

    /**
     * 말 물리 초기화
     * @param {Object} horse - 말 데이터
     * @param {number} distance - 경기 거리
     * @returns {Object} 물리 상태
     */
    initHorse(horse, distance) {
      const MU = window.MathUtils;
      
      // 물리적 속성 계산
      const maxSpeed = PHYSICS.MIN_VELOCITY + 
        (horse.speed / 100) * (PHYSICS.MAX_VELOCITY - PHYSICS.MIN_VELOCITY);
      
      const acceleration = PHYSICS.BASE_ACCELERATION + 
        (horse.speed / 100) * (PHYSICS.MAX_ACCELERATION - PHYSICS.BASE_ACCELERATION);
      
      // 피로율 (지구력이 높을수록 피로도가 낮음)
      const fatigueRate = PHYSICS.FATIGUE_RATE * (1 - (horse.stamina - 50) / 100);
      
      // 가속 burst 능력
      const burstPower = (horse.burst - 50) / 50;
      
      return {
        horse,
        distance,
        currentPos: 0,
        velocity: 0,
        acceleration: 0,
        maxSpeed,
        accelerationPower: acceleration,
        fatigueRate: Math.max(0.005, fatigueRate),
        burstPower,
        finished: false,
        finishTime: null,
        stumble: 0,
        // 스탯 저장 (분석용)
        stats: {
          avgSpeed: 0,
          maxSpeedReached: 0,
          fatiguePoints: []
        }
      };
    }

    /**
     * 속도 계산 (물리 기반)
     * @param {Object} state - 물리 상태
     * @param {number} progress - 진행률 (0-1)
     * @param {Object} weather - 날씨
     * @returns {number} 현재 속도 (m/s)
     */
    calculateVelocity(state, progress, weather) {
      const MU = window.MathUtils || {
        randomNormalCLT: (m, s) => m + (Math.random() - 0.5) * s * 2,
        clamp: (v, min, max) => Math.max(min, Math.min(max, v))
      };
      
      const { horse, maxSpeed, accelerationPower, fatigueRate, burstPower } = state;
      const styleWeights = PHYSICS.STYLE_WEIGHTS[horse.style] || PHYSICS.STYLE_WEIGHTS['만능'];
      
      // 1. 구간별 스타일 영향
      let phaseMultiplier = 1;
      if (progress < 0.3) {
        phaseMultiplier = styleWeights.early;
      } else if (progress < 0.7) {
        phaseMultiplier = styleWeights.mid;
      } else {
        phaseMultiplier = styleWeights.late;
      }
      
      // 2. 피로도 모델 (지수衰減)
      const fatigue = Math.exp(progress * fatigueRate * 20);
      
      // 3. 후반 스퍼트 - 강화된 버전
      let burst = 1;
      if (progress > PHYSICS.BURST_THRESHOLD && burstPower > 0.3) {
        const burstProgress = (progress - PHYSICS.BURST_THRESHOLD) / (1 - PHYSICS.BURST_THRESHOLD);
        // 후반으로 갈수록 스퍼트 효과가 더 커짐
        burst = 1 + (burstPower * PHYSICS.BURST_MULTIPLIER * burstProgress);
      }
      
      // 4. 후반 역전 시스템 - 후반 20%에서 모든 말 가속도 UP
      let lateComeback = 1;
      if (progress > 0.80) {
        lateComeback = PHYSICS.LATE_COMEBACK_BOOST;
      }
      
      // 5. 마법의 한방 - 후반 20% 구간에서 랜덤 발생
      let magicBurst = 1;
      if (progress > 0.80 && !state.magicBurstUsed && Math.random() < PHYSICS.MAGIC_BURST_CHANCE) {
        magicBurst = PHYSICS.MAGIC_BURST_BOOST;
        state.magicBurstUsed = true;
        state.magicBurstActive = 120; // 2초간 (60fps × 2)
        if (window.addCast) {
          window.addCast('⚡⚡ ' + horse.name + ' 마법의 한방!', 'highlight');
        }
      }
      
      // 마법의 한방 효과 적용
      if (state.magicBurstActive > 0) {
        magicBurst = PHYSICS.MAGIC_BURST_BOOST;
        state.magicBurstActive--;
      }
      
      // 6. 날씨 영향 - 강화
      let weatherFactor = 1;
      if (weather && weather.wet) {
        weatherFactor = PHYSICS.RAIN_FRICTION + (horse.stamina / 200) * 0.03;
      } else if (weather && weather.snow) {
        weatherFactor = PHYSICS.SNOW_FRICTION;
      }
      
      // 7. 돌발 가속 이벤트
      let surgeBoost = 1;
      if (!state.surgeActive && Math.random() < PHYSICS.SURGE_CHANCE) {
        state.surgeActive = 180; // 3초간 (60fps × 3)
        state.surgeBoost = PHYSICS.SURGE_BOOST;
        if (window.addCast) {
          window.addCast('⚡ ' + horse.name + ' 돌발 가속!', 'highlight');
        }
      }
      
      if (state.surgeActive > 0) {
        surgeBoost = state.surgeBoost;
        state.surgeActive--;
      }
      
      // 8. 컨디션 영향
      const condFactor = (horse.horseCond || 1) * (horse.jockeyCond || 1);
      
      // 9. 시너지 보너스
      let synergyBonus = 1;
      if (horse.synergyBonus) {
        synergyBonus = 1 + (horse.synergyBonus.score || 0) / 100;
      }
      
      // 10. 무작위성 (정규분포) - 증가된 variance
      const randomFactor = MU.randomNormalCLT(1, PHYSICS.RANDOM_FACTOR);
      
      // 11. 말림 계산
      let stumbleFactor = 1;
      if (state.stumble > 0) {
        // 실신 시 더 큰 페널티
        stumbleFactor = 0.5 + (state.stumble / 100) * 0.3;
        state.stumble--;
      }
      
      // 최종 속도 계산 - 모든 효과 통합
      let velocity = maxSpeed * phaseMultiplier * fatigue * burst * lateComeback * magicBurst 
                   * weatherFactor * condFactor * synergyBonus * randomFactor * stumbleFactor * surgeBoost;
      
      // 속도 제한 - 마법의 한방을 위해 상한 완화
      velocity = MU.clamp(velocity, PHYSICS.MIN_VELOCITY, PHYSICS.MAX_VELOCITY * 1.5);
      
      // 랜덤 실신 발생 (흥미진진 버전: 0.8% → 1.5%)
      if (Math.random() < 0.015 && state.stumble === 0 && progress > 0.1 && progress < 0.9) {
        state.stumble = 40 + Math.floor(Math.random() * 50); // 40-90 프레임
        if (window.addCast) {
          window.addCast('💥 ' + horse.name + ' 실신!', 'highlight');
        }
      }
      
      return velocity;
    }

    /**
     * 경주 업데이트 (한 프레임)
     * @param {Array} states - 말 물리 상태 배열
     * @param {Object} weather - 날씨
     * @param {number} deltaTime - 델타 시간 (초)
     * @returns {Array} 업데이트된 상태
     */
    update(states, weather, deltaTime) {
      const MU = window.MathUtils || { clamp: (v, min, max) => Math.max(min, Math.min(max, v)) };
      
      states.forEach(state => {
        if (state.finished) return;
        
        // 현재 진행률
        const progress = state.currentPos / state.distance;
        
        // 속도 계산
        const velocity = this.calculateVelocity(state, progress, weather);
        
        // 가속도 계산
        const acceleration = (velocity - state.velocity) / deltaTime;
        state.acceleration = acceleration;
        
        // 위치 업데이트 (SP_SPEED_SCALE 적용 — 거리별 실제 경기 시간 보정)
        // SP_SPEED_SCALE은 sp_initRace()에서 거리에 따라 설정됨
        //   1200m 이하 → 0.42 (약 48초), 1600m 이하 → 0.48 (약 49초), 이상 → 0.54 (약 52~62초)
        const speedScale = window.SP_SPEED_SCALE || 1.0;
        state.currentPos += velocity * deltaTime * speedScale;
        
        // 통계 기록
        if (velocity > state.stats.maxSpeedReached) {
          state.stats.maxSpeedReached = velocity;
        }
        state.stats.fatiguePoints.push(1 - (state.currentPos / state.distance));
        
        // 도착 체크
        if (state.currentPos >= state.distance) {
          state.currentPos = state.distance;
          state.finished = true;
          state.finishTime = this.time;
          this.finished.push(state);
        }
        
        state.velocity = velocity;
      });
      
      this.time += deltaTime;
      return states;
    }

    /**
     * 현재 순위 계산
     * @param {Array} states - 말 물리 상태 배열
     * @returns {Array} 말 인덱스 배열 (순위순)
     */
    getPositions(states) {
      return states
        .map((state, index) => ({ index, pos: state.currentPos, finished: state.finished, finishTime: state.finishTime }))
        .sort((a, b) => {
          if (a.finished && b.finished) {
            return a.finishTime - b.finishTime;
          }
          return b.pos - a.pos;
        })
        .map(item => item.index);
    }

    /**
     * 1위와의 격차 계산
     * @param {Array} states - 말 물리 상태 배열
     * @returns {Object} 격차 정보
     */
    getGaps(states) {
      const positions = this.getPositions(states);
      const leaderState = states[positions[0]];
      
      if (!leaderState) return {};
      
      const gaps = {};
      states.forEach((state, i) => {
        const gap = leaderState.currentPos - state.currentPos;
        gaps[i] = gap > 0 ? gap.toFixed(1) : 0;
      });
      
      return gaps;
    }

    /**
     * 예상 시간 계산
     * @param {Object} state - 말 물리 상태
     * @returns {number} 예상 완료 시간 (초)
     */
    estimateFinishTime(state) {
      const avgSpeed = (state.velocity + state.maxSpeed) / 2;
      const remaining = state.distance - state.currentPos;
      const remainingTime = remaining / avgSpeed;
      return this.time + remainingTime;
    }
  }

  /**
   * 말 스탯 생성 (정규분포 기반)
   * @param {Object} grade - 등급 데이터
   * @param {Object} sireData - 혈통 데이터
   * @param {Object} jockeyData - 기수 데이터
   * @returns {Object} 말 스탯
   */
  function generateHorseStats(grade, sireData, jockeyData) {
    const MU = window.MathUtils || { 
      randomNormalCLT: (m, s) => m + (Math.random() - 0.5) * s * 2,
      clamp: (v, min, max) => Math.max(min, Math.min(max, v))
    };
    
    const rating = grade.rating;
    
    // 정규분포로 스탯 생성 (중심: grade 기준)
    let speed = MU.randomNormalCLT(rating[0] + 3, 8);
    let stamina = MU.randomNormalCLT(rating[0], 8);
    let burst = MU.randomNormalCLT(rating[0] - 3, 10);
    
    // 혈통 보너스 적용
    speed = MU.clamp(speed + sireData.speed, 50, 100);
    stamina = MU.clamp(stamina + sireData.stamina, 50, 100);
    burst = MU.clamp(burst + sireData.burst, 50, 100);
    
    // 상관관계: speed ↑ → stamina ↓ (Trade-off)
    const correlation = -0.2;
    const speedStaminaEffect = correlation * (speed - rating[0]) * 0.1;
    stamina += speedStaminaEffect;
    stamina = MU.clamp(stamina, 50, 100);
    
    // 기수 스킬 영향
    const jockeySkill = jockeyData.skill;
    const skillBonus = (jockeySkill - 80) / 20 * 3;
    
    // 최종 레이팅 계산
    const finalRating = Math.round(
      speed * 0.35 + 
      stamina * 0.30 + 
      burst * 0.20 + 
      jockeySkill * 0.15 + 
      skillBonus
    );
    
    return {
      speed: MU.clamp(speed, 50, 100),
      stamina: MU.clamp(stamina, 50, 100),
      burst: MU.clamp(burst, 50, 100),
      jockeySkill,
      rating: MU.clamp(finalRating, 50, 100)
    };
  }

  /**
   * 시너지 점수 계산 (개선된 버전)
   * @param {string} jockeyStyle - 기수 스타일
   * @param {number} horseSpeed - 말 속도
   * @param {number} horseStamina - 말 지구력
   * @param {number} horseBurst - 말 가속
   * @returns {Object} 시너지 정보
   */
  function calculateSynergy(jockeyStyle, horseSpeed, horseStamina, horseBurst) {
    const MU = window.MathUtils || { 
      randomNormalCLT: (m, s) => m + (Math.random() - 0.5) * s * 2 
    };
    
    // 말 스타일 결정
    const total = horseSpeed + horseStamina + horseBurst;
    const spdRatio = horseSpeed / total;
    const staRatio = horseStamina / total;
    const burRatio = horseBurst / total;
    
    let horseStyle = '만능';
    if (spdRatio >= 0.4) horseStyle = '선행';
    else if (burRatio >= 0.4) horseStyle = '추입';
    else if (staRatio >= 0.4) horseStyle = '차입';
    else if (spdRatio >= 0.35 && staRatio >= 0.3) horseStyle = '선입';
    
    // 스타일 궁합 점수
    const styleMatch = (jockeyStyle === horseStyle) || (jockeyStyle === '만능');
    let baseScore = styleMatch ? 15 : 5;
    
    // 비율별 보너스
    if (jockeyStyle === '선행' && spdRatio >= 0.35) baseScore += 5;
    if (jockeyStyle === '추입' && burRatio >= 0.35) baseScore += 5;
    if (jockeyStyle === '차입' && staRatio >= 0.35) baseScore += 5;
    if (jockeyStyle === '선입' && spdRatio >= 0.3 && staRatio >= 0.3) baseScore += 5;
    
    // 등급 결정
    let grade = 'C';
    if (baseScore >= 20) grade = 'S';
    else if (baseScore >= 15) grade = 'A';
    else if (baseScore >= 10) grade = 'B';
    
    // 보너스 계산 (연속 함수)
    const matchMultiplier = styleMatch ? 1.5 : 0.8;
    const speedBonus = Math.round(matchMultiplier * (jockeyStyle === '선행' || jockeyStyle === '선입' ? 3 : 1));
    const staminaBonus = Math.round(matchMultiplier * (jockeyStyle === '차입' ? 3 : 1));
    const burstBonus = Math.round(matchMultiplier * (jockeyStyle === '추입' ? 3 : 1));
    
    return {
      grade,
      score: baseScore,
      jockeyStyle,
      horseStyle,
      match: styleMatch,
      speedBonus,
      staminaBonus,
      burstBonus
    };
  }

  /**
   * 승률 계산 (수학적 모델)
   * @param {Array} roster - 말 배열
   * @returns {Array} 승률 배열
   */
  function calculateWinProbabilities(roster) {
    if (!roster || roster.length === 0) return [];
    
    const MU = window.MathUtils || { normalCDF: (x) => x > 0 ? 1 : 0 };
    
    // 각 말의 스탯 점수
    const scores = roster.map(h => {
      return (
        h.speed * 0.35 +
        h.stamina * 0.30 +
        h.burst * 0.20 +
        (h.synergyBonus?.score || 0) * 0.15
      );
    });
    
    // 평균과 표준편차
    const avgScore = MU.mean(scores);
    const sdScore = MU.standardDeviation(scores);
    
    // 정규분포 기반 확률로 변환
    let probabilities = scores.map(s => {
      const z = (s - avgScore) / (sdScore || 1);
      return MU.normalCDF(z);
    });
    
    // 정규화
    const sum = probabilities.reduce((a, b) => a + b, 0);
    probabilities = probabilities.map(p => p / sum);
    
    return probabilities;
  }

  /**
   * Fair 배당률 계산
   * @param {number} probability - 승률 (0-1)
   * @param {number} takeout - 테이크아웃 (0-1)
   * @returns {number} 배당률
   */
  function calculateFairOdds(probability, takeout) {
    if (probability <= 0 || probability >= 1) return 1;
    const fair = 1 / probability;
    return fair * (1 - takeout);
  }

  /**
   * Pool 생성 (기대값 기반)
   * @param {Array} roster - 말 배열
   * @param {number} totalPool - 총 Pool
   * @param {Object} takeouts - 테이크아웃
   * @returns {Object} Pool 데이터
   */
  function generatePool(roster, totalPool, takeouts) {
    const probabilities = calculateWinProbabilities(roster);
    const MU = window.MathUtils || { 
      randomNormalCLT: (m, s) => m + (Math.random() - 0.5) * s * 2,
      clamp: (v, min, max) => Math.max(min, Math.min(max, v))
    };
    
    // 변동성 추가 (±15%)
    const volatility = 0.15;
    
    const pools = {
      win: [],
      place: [],
      quin: {},
      exact: {},
      placeq: {},
      trifecta: {},
      triple: {}
    };
    
    // 단승/연승 Pool
    roster.forEach((horse, i) => {
      const prob = probabilities[i];
      const odd = calculateFairOdds(prob, takeouts.WIN);
      const amount = MU.clamp(
        totalPool * prob * MU.randomNormalCLT(1, volatility),
        1000,
        totalPool * 0.5
      );
      
      pools.win.push({ key: 'H' + i, amount });
      pools.place.push({ key: 'P' + i, amount: amount * 0.8 });
    });
    
    // 복승/쌍승/복연승 Pool
    for (let i = 0; i < roster.length; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const prob = probabilities[i] + probabilities[j];
        const key = i + '-' + j;
        
        pools.quin[key] = totalPool * prob * 0.7 * MU.randomNormalCLT(1, volatility);
        pools.placeq[key] = totalPool * prob * 0.5 * MU.randomNormalCLT(1, volatility);
      }
    }
    
    // Exact (순서)
    for (let i = 0; i < roster.length; i++) {
      for (let j = 0; j < roster.length; j++) {
        if (i === j) continue;
        const prob = probabilities[i] * probabilities[j] * 2;
        pools.exact[i + '>' + j] = totalPool * prob * 0.4 * MU.randomNormalCLT(1, volatility);
      }
    }
    
    return pools;
  }

  /**
   * 배당금 계산 (개선된 버전)
   * @param {Object} pools - Pool 데이터
   * @param {Array} order - 도착 순서
   * @param {Object} takeouts - 테이크아웃
   * @returns {Object} 배당금 정보
   */
  function calculatePayouts(pools, order, takeouts) {
    const first = order[0];
    const second = order[1];
    const third = order[2];
    
    const MU = window.MathUtils || { safeDivide: (a, b) => b === 0 ? 0 : a / b };
    
    // 단승
    const winTotal = pools.win.reduce((sum, p) => sum + p.amount, 0);
    const winPool = pools.win[first]?.amount || 1;
    const winOdds = MU.safeDivide(winTotal * (1 - takeouts.WIN), winPool);
    
    // 연승
    const placeTotal = pools.place.reduce((sum, p) => sum + p.amount, 0);
    const place1 = MU.safeDivide(placeTotal * (1 - takeouts.PLACE) / 3, pools.place[first]?.amount || 1);
    const place2 = MU.safeDivide(placeTotal * (1 - takeouts.PLACE) / 3, pools.place[second]?.amount || 1);
    const place3 = MU.safeDivide(placeTotal * (1 - takeouts.PLACE) / 3, pools.place[third]?.amount || 1);
    
    // 복승
    const quinKey = first < second ? first + '-' + second : second + '-' + first;
    const quinTotal = Object.values(pools.quin).reduce((a, b) => a + b, 0);
    const quinOdds = MU.safeDivide(quinTotal * (1 - takeouts.QUINELLA), pools.quin[quinKey] || 1);
    
    // 쌍승
    const exactKey = first + '>' + second;
    const exactTotal = Object.values(pools.exact).reduce((a, b) => a + b, 0);
    const exactOdds = MU.safeDivide(exactTotal * (1 - takeouts.EXACTA), pools.exact[exactKey] || 1);
    
    return {
      win: { odds: winOdds, amount: winPool },
      place: [
        { odds: place1, amount: pools.place[first]?.amount || 0 },
        { odds: place2, amount: pools.place[second]?.amount || 0 },
        { odds: place3, amount: pools.place[third]?.amount || 0 }
      ],
      quinella: { odds: quinOdds, amount: pools.quin[quinKey] || 0 },
      exacta: { odds: exactOdds, amount: pools.exact[exactKey] || 0 }
    };
  }

  // 전역 노출
  window.PhysicsEngine = PhysicsEngine;
  window.PhysicsUtils = {
    generateHorseStats,
    calculateSynergy,
    calculateWinProbabilities,
    calculateFairOdds,
    generatePool,
    calculatePayouts,
    PHYSICS
  };

  console.log('[PhysicsEngine v5.2.0] Loaded - Physics-based racing ready');
})();
