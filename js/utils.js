/**
 * 공통 유틸리티 함수 - 도트 경마 v5.1
 * 
 * 여러 모듈에서 공유하는 유틸리티 함수들
 * 
 * @version 5.1.1
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  /**
   * 점수 계산 함수 (승점제)
   * 1위=100점, 2위=50점, 3위=25점, 4위=14점...16위=2점, 출전 안 함=10점
   * 
   * @param {number} position - 순위 (1-16)
   * @returns {number} 점수
   */
  function calculateScore(position) {
    if (!position || position > 16) return 10;
    
    // 명확한 점수 매핑
    const scoreMap = {
      1: 100,   // 1위
      2: 50,    // 2위
      3: 25,    // 3위
      4: 14,    // 4위
      5: 13,    // 5위
      6: 12,    // 6위
      7: 11,    // 7위
      8: 10,    // 8위
      9: 9,     // 9위
      10: 8,    // 10위
      11: 7,    // 11위
      12: 6,    // 12위
      13: 5,    // 13위
      14: 4,    // 14위
      15: 3,    // 15위
      16: 2     // 16위
    };
    
    return scoreMap[position] || 10;
  }

  /**
   * 데이터 검증 함수
   * 
   * @param {Object} data - 검증할 데이터
   * @param {string} type - 데이터 타입 ('season', 'stats', 'horse')
   * @returns {boolean} 유효성 여부
   */
  function validateData(data, type) {
    if (!data || typeof data !== 'object') {
      console.error('[Validation] Invalid data type:', typeof data);
      return false;
    }

    switch (type) {
      case 'season':
        if (typeof data.week !== 'number' || data.week < 1 || data.week > 52) {
          console.error('[Validation] Invalid week:', data.week);
          return false;
        }
        if (typeof data.totalScore !== 'number' || data.totalScore < 0 || data.totalScore > 999999) {
          console.error('[Validation] Invalid totalScore:', data.totalScore);
          return false;
        }
        if (typeof data.totalEntries !== 'number' || data.totalEntries < 0) {
          console.error('[Validation] Invalid totalEntries:', data.totalEntries);
          return false;
        }
        return true;

      case 'stats':
        if (typeof data.totalRaces !== 'number' || data.totalRaces < 0) {
          console.error('[Validation] Invalid totalRaces:', data.totalRaces);
          return false;
        }
        if (typeof data.totalBet !== 'number' || data.totalBet < 0) {
          console.error('[Validation] Invalid totalBet:', data.totalBet);
          return false;
        }
        return true;

      case 'horse':
        if (!data.name || typeof data.name !== 'string') {
          console.error('[Validation] Invalid horse name:', data.name);
          return false;
        }
        if (typeof data.speed !== 'number' || data.speed < 0 || data.speed > 100) {
          console.error('[Validation] Invalid speed:', data.speed);
          return false;
        }
        return true;

      default:
        return true;
    }
  }

  /**
   * LocalStorage 용량 체크 및 관리
   * 
   * @param {string} key - 저장 키
   * @param {Object} data - 저장할 데이터
   * @returns {boolean} 저장 성공 여부
   */
  function saveWithQuotaCheck(key, data) {
    const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5MB (5MB 제한 고려)
    
    try {
      let serialized = JSON.stringify(data);
      
      // 용량 체크
      if (serialized.length > MAX_SIZE) {
        console.warn('[Storage] Data too large, cleaning up...');
        
        // 히스토리 데이터 정리
        if (data.history && data.history.length > 20) {
          data.history = data.history.slice(0, 20);
          serialized = JSON.stringify(data);
        }
        
        // 여전히 크면 더 정리
        if (serialized.length > MAX_SIZE && data.races && data.races.length > 10) {
          data.races = data.races.slice(-10);
          serialized = JSON.stringify(data);
        }
      }
      
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('[Storage] Quota exceeded for key:', key);
        
        // Emergency cleanup - oldest data removal
        emergencyCleanup();
        
        // Retry once
        try {
          localStorage.setItem(key, JSON.stringify(data));
          return true;
        } catch (retryError) {
          console.error('[Storage] Retry failed:', retryError);
        }
      }
      return false;
    }
  }

  /**
   * Emergency cleanup for LocalStorage
   */
  function emergencyCleanup() {
    const keys = Object.keys(localStorage);
    const gameKeys = keys.filter(k => k.includes('dot_racing') || k.includes('racing'));
    
    // Sort by size (approximate) and remove largest
    gameKeys.sort((a, b) => {
      return localStorage.getItem(b).length - localStorage.getItem(a).length;
    });
    
    // Remove top 2 largest items
    gameKeys.slice(0, 2).forEach(key => {
      console.warn('[Storage] Emergency removing:', key);
      localStorage.removeItem(key);
    });
  }

  /**
   * 깊은 복사 함수
   * 
   * @param {Object} obj - 복사할 객체
   * @returns {Object} 깊은 복사된 객체
   */
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * 버전 비교 및 마이그레이션 필요 여부 체크
   * 
   * @param {string} currentVersion - 현재 버전
   * @param {string} dataVersion - 데이터 버전
   * @returns {boolean} 마이그레이션 필요 여부
   */
  function needsMigration(currentVersion, dataVersion) {
    if (!dataVersion) return true;
    
    const current = currentVersion.split('.').map(Number);
    const data = dataVersion.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if ((data[i] || 0) < (current[i] || 0)) return true;
      if ((data[i] || 0) > (current[i] || 0)) return false;
    }
    return false;
  }

  // 전역 객체로 노출
  window.GameUtils = {
    calculateScore: calculateScore,
    validateData: validateData,
    saveWithQuotaCheck: saveWithQuotaCheck,
    deepClone: deepClone,
    needsMigration: needsMigration,
    VERSION: '5.1.1'
  };

  console.log('[GameUtils] v5.1.1 loaded');
})();
