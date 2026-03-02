/**
 * Logger - 도트 경마 v5.2
 * 
 * 중앙집중식 로깅 시스템
 * - 로그 레벨 관리 (DEBUG, INFO, WARN, ERROR)
 * - 프로덕션 모드에서 선택적 로그 활성화
 * - 모듈별 로그 컨트롤
 * 
 * @version 1.0.0
 * @author 도겜유튜브
 */

(function() {
  'use strict';

  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };

  class Logger {
    constructor(moduleName) {
      this.moduleName = moduleName || 'App';
      this.prefix = `[${this.moduleName}]`;
      
      // 기본 레벨: 개발 환경에서는 DEBUG, 프로덕션에서는 WARN
      this.level = Logger.globalLevel !== undefined 
        ? Logger.globalLevel 
        : (Logger.isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);
    }

    static init(options = {}) {
      Logger.isProduction = options.isProduction || false;
      Logger.globalLevel = options.level !== undefined 
        ? options.level 
        : (Logger.isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);
      
      // 프로덕션 모드에서 console 메서드 대체
      if (Logger.isProduction) {
        this._patchConsole();
      }
      
      console.log(`[Logger] Initialized - Mode: ${Logger.isProduction ? 'Production' : 'Development'}, Level: ${Logger.globalLevel}`);
    }

    static _patchConsole() {
      // 프로덕션에서는 console.log/info 를 noop으로 대체
      const noop = function() {};
      
      // 디버그 정보만 남기고 나머지는 제한적으로 표시
      // 실제 에러와 경고는 그대로 유지
    }

    debug(...args) {
      if (this.level <= LOG_LEVELS.DEBUG) {
        console.debug(this.prefix, ...args);
      }
    }

    info(...args) {
      if (this.level <= LOG_LEVELS.INFO) {
        console.info(this.prefix, ...args);
      }
    }

    warn(...args) {
      if (this.level <= LOG_LEVELS.WARN) {
        console.warn(this.prefix, ...args);
      }
    }

    error(...args) {
      if (this.level <= LOG_LEVELS.ERROR) {
        console.error(this.prefix, ...args);
      }
    }

    // 로깅 레벨 동적 변경
    setLevel(level) {
      this.level = level;
    }

    // 모듈별 로그 활성화/비활성화
    enable() {
      this.level = LOG_LEVELS.DEBUG;
    }

    disable() {
      this.level = LOG_LEVELS.NONE;
    }
  }

  // 전역 로그 레벨 설정
  Logger.isProduction = false;
  Logger.globalLevel = LOG_LEVELS.DEBUG;

  // Logger 인스턴스 생성 헬퍼
  window.createLogger = function(moduleName) {
    return new Logger(moduleName);
  };

  // 기본 로거 (모듈 없이 바로 사용)
  window.Logger = Logger;

  // 편의 함수 (기존 console.log 패턴 호환)
  window.log = function(...args) {
    if (!Logger.isProduction || Logger.globalLevel <= LOG_LEVELS.INFO) {
      console.log(...args);
    }
  };

  console.log('[Logger] v1.0.0 initialized');

})();
