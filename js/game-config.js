/**
 * game-config.js — 도트 경마 v5.2 전역 설정 파일
 * =====================================================
 * 게임 밸런스, 타이밍, 경제 수치를 한 곳에서 관리합니다.
 * 수정 시 이 파일만 열면 됩니다.
 *
 * 사용법: window.GAME_CONFIG.INITIAL_WALLET
 * =====================================================
 */

(function() {
  'use strict';

  const GAME_CONFIG = {

    // ─────────────────────────────────────────────
    // § 1. 경제 (Economy)
    // ─────────────────────────────────────────────

    /** 신규 유저 초기 지갑 금액 (DOT) */
    INITIAL_WALLET: 10000,

    /** 마구간 시장 새로고침 비용 (DOT) */
    MARKET_REFRESH_COST: 50000,

    /** AI 분석 구매 비용 (DOT) */
    AI_ANALYSIS_COST: 250,

    /** AI 분석 새로고침 최대 횟수 */
    AI_MAX_REFRESH: 2,

    /** 게임당 최대 베팅 횟수 */
    MAX_BETS_PER_GAME: 3,

    /** 말 번식 기본 비용 (DOT) */
    BREED_BASE_COST: 200000,


    // ─────────────────────────────────────────────
    // § 2. 마구간 쿨타임 (Stable Cooldowns)
    // ─────────────────────────────────────────────

    /** 훈련 쿨타임 (ms) = 2시간 */
    TRAINING_COOLDOWN_MS: 2 * 60 * 60 * 1000,

    /** 치료 쿨타임 (ms) = 1시간 */
    MEDICAL_COOLDOWN_MS: 1 * 60 * 60 * 1000,

    /** 번식 쿨타임 (ms) = 30분 */
    BREED_COOLDOWN_MS: 30 * 60 * 1000,

    /** 훈련 시 능력치 상승 범위 */
    TRAINING_STAT_GAIN: { min: 1, max: 4 },

    /** 훈련 시 피로도 증가 */
    TRAINING_FATIGUE: 20,

    /** 치료 시 피로도 회복 */
    MEDICAL_RECOVER: 50,


    // ─────────────────────────────────────────────
    // § 3. 타이밍 (Timing)
    // ─────────────────────────────────────────────

    /** 경주 대기 시간 (ms) = 120초 */
    RACE_WAIT_MS: 120 * 1000,

    /** 출전마 소개 간격 (ms) */
    ANNOUNCE_INTERVAL_MS: 4500,

    /** 출전마 소개 시작 딜레이 (ms) */
    ANNOUNCE_DELAY_MS: 3000,

    /** 뉴스 표시 간격 (ms) */
    NEWS_INTERVAL_MS: 12000,

    /** 마구간 패널 자동 갱신 주기 (ms) */
    STABLE_REFRESH_MS: 10000,

    /** 세션 활성화 상태 갱신 주기 (ms) */
    SESSION_PING_MS: 30000,

    /** 리플레이 자동 닫기 시간 (ms) = 5초 */
    REPLAY_AUTOCLOSE_MS: 5000,


    // ─────────────────────────────────────────────
    // § 4. 자동 로그아웃 (Auto Logout)
    // ─────────────────────────────────────────────

    /** 비활동 시 자동 로그아웃 시간 (ms) = 30분 */
    AUTO_LOGOUT_MS: 30 * 60 * 1000,

    /** 로그아웃 경고 표시 시점 — 로그아웃 몇 ms 전 (ms) = 5분 전 */
    AUTO_LOGOUT_WARN_MS: 5 * 60 * 1000,

    /** 디바이스 세션 타임아웃 (ms) = 30분 */
    SESSION_TIMEOUT_MS: 30 * 60 * 1000,


    // ─────────────────────────────────────────────
    // § 5. 경주 설정 (Race)
    // ─────────────────────────────────────────────

    /** 게임 루프 목표 FPS */
    TARGET_FPS: 60,

    /** 게임 루프 최대 delta 클램프 (ms) — 탭 전환 복귀 시 튐 방지 */
    MAX_DELTA_MS: 250,


    // ─────────────────────────────────────────────
    // § 6. 말 등급별 가격/능력치 범위 (Horse Grades)
    // ─────────────────────────────────────────────

    HORSE_GRADES: {
      C: { price: [50000,   100000], stats: [30, 55], weight: 40 },
      B: { price: [100000,  200000], stats: [55, 70], weight: 30 },
      A: { price: [200000,  400000], stats: [70, 80], weight: 15 },
      S: { price: [400000,  800000], stats: [80, 90], weight: 10 },
      SS:{ price: [800000, 1500000], stats: [90, 99], weight:  5 },
    },

    /** 마구간 업그레이드 기본 비용 */
    STABLE_UPGRADE_BASE: { barn: 50000, training: 70000, medical: 60000, breeding: 150000 },

    /** 마구간 업그레이드 비용 증가율 (레벨당) */
    STABLE_UPGRADE_RATE: 1.8,


    // ─────────────────────────────────────────────
    // § 7. 베팅 수수료율 (Takeout Rates)
    //      실제 BET_TYPES 객체는 main script에 유지
    //      — 여기서는 참조용으로만 명시
    // ─────────────────────────────────────────────

    TAKEOUT: {
      WIN:      0.165,
      PLACE:    0.180,
      QUINELLA: 0.215,
      EXACTA:   0.240,
      PLACEQ:   0.215,
      TRIFECTA: 0.250,
      TRIPLE:   0.280,
    },

  };

  // 전역으로 노출
  window.GAME_CONFIG = GAME_CONFIG;

  // 하위 호환성 — 기존 코드에서 직접 쓰던 상수도 그대로 동작하게 유지
  // (기존 코드를 한꺼번에 바꾸지 않아도 되도록 브릿지 제공)
  window._CONFIG_COMPAT = true;

  console.log('[Config] game-config.js 로드 완료 ✅');

})();

// ─────────────────────────────────────────────
// § 개발 모드 설정 (Dev Mode)
// ─────────────────────────────────────────────
// true: 콘솔 로그 전부 출력 (개발 중)
// false: 경고/에러만 출력 (배포 시)
window.DEV_MODE = false; // [Security Fix] 배포 환경 — 콘솔 로그 비활성화

// 개발 모드 전용 로거
window.devLog = function(...args) {
  if (window.DEV_MODE) console.log(...args);
};
window.devWarn = function(...args) {
  if (window.DEV_MODE) console.warn(...args);
};
