/**
 * Secure Store System v1.0 - 도트경마 v5.2
 * 해시 체인 + HMAC 서명 기반 데이터 무결성 시스템
 * 
 * 기능:
 * - SHA-256 해시 체인
 * - HMAC-SHA256 서명
 * - 데이터 변조 감지
 * - Firestore 연동
 * - Anti-Cheat 탐지
 */

(function() {
  'use strict';

  // ========== SHA-256 해시 함수 ==========
  const SecureStore = {
    VERSION: '1.0.0',
    
    // 상수
    DATA_TYPES: {
      WALLET: 'wallet',
      SEASON: 'season',
      STATS: 'stats',
      NFT: 'nft',
      MY_HORSES: 'myHorses',
      GAME_RECORD: 'gameRecord',
      DEVICE: 'device'
    },
    
    // 설정
    config: {
      maxBlockHistory: 100,
      genesisHash: '0000000000000000000000000000000000000000000000000000000000000000',
      validationEnabled: true,
      autoRestore: true
    },
    
    // 사용자 시크릿 키
    _userSecret: null,
    _userId: null,
    _deviceId: null,
    
    // ========== SHA-256 구현 ==========
    async sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // ========== HMAC-SHA256 구현 ==========
    async hmacSha256(message, key) {
      const keyBuffer = new TextEncoder().encode(key);
      const messageBuffer = new TextEncoder().encode(message);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBuffer
      );
      
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // ========== 블록 생성 ==========
    createBlock(dataType, data, previousHash, metadata = {}) {
      const block = {
        version: this.VERSION,
        dataType: dataType,
        data: data,
        previousHash: previousHash,
        nonce: 0,
        timestamp: Date.now(),
        metadata: {
          userId: this._userId || metadata.userId || 'anonymous',
          deviceId: this._deviceId || metadata.deviceId || 'unknown',
          ...metadata
        }
      };
      
      block.hash = this.calculateBlockHash(block);
      return block;
    },
    
    // ========== 블록 해시 계산 ==========
    async calculateBlockHash(block) {
      const content = JSON.stringify({
        version: block.version,
        dataType: block.dataType,
        data: block.data,
        previousHash: block.previousHash,
        nonce: block.nonce,
        timestamp: block.timestamp,
        metadata: block.metadata
      });
      
      return await this.sha256(content);
    },
    
    // ========== 블록 검증 ==========
    async verifyBlock(block) {
      if (!block || !block.hash) {
        return { valid: false, reason: '블록이 없습니다' };
      }
      
      // 해시 재계산
      const computedHash = await this.calculateBlockHash(block);
      
      if (computedHash !== block.hash) {
        return { valid: false, reason: '해시 불일치 (변조 감지)' };
      }
      
      // previousHash가 유효한지 확인
      if (block.previousHash !== this.config.genesisHash && 
          !/^[a-f0-9]{64}$/.test(block.previousHash)) {
        return { valid: false, reason: '이전 해시 형식 오류' };
      }
      
      return { valid: true };
    },
    
    // ========== HMAC 서명 생성 ==========
    async createSignature(data, secret) {
      if (!secret) {
        console.warn('[SecureStore] 서명 키가 없습니다');
        return null;
      }
      
      const payload = JSON.stringify(data);
      return await this.hmacSha256(payload, secret);
    },
    
    // ========== HMAC 서명 검증 ==========
    async verifySignature(data, signature, secret) {
      if (!signature || !secret) {
        return false;
      }
      
      const expectedSignature = await this.createSignature(data, secret);
      return signature === expectedSignature;
    },
    
    // ========== 시크릿 키 생성 ==========
    generateUserSecret(userId, deviceId) {
      const salt = 'dotRacing2026Secure';
      const input = `${userId}:${deviceId}:${salt}`;
      return this.sha256(input);
    },
    
    // ========== 사용자 설정 ==========
    setUser(userId, deviceId) {
      this._userId = userId;
      this._deviceId = deviceId;
      this._userSecret = this.generateUserSecret(userId, deviceId);
      console.log('[SecureStore] 사용자 설정:', userId);
    },
    
    // ========== 데이터 저장 (해시 체인) ==========
    async saveData(dataType, data, options = {}) {
      const { saveToCloud = true, saveToLocal = true } = options;
      
      const previousBlock = await this.getLatestBlock(dataType);
      const previousHash = previousBlock ? previousBlock.hash : this.config.genesisHash;
      
      // 블록 생성
      const block = this.createBlock(dataType, data, previousHash, {
        userId: this._userId,
        deviceId: this._deviceId
      });
      
      // HMAC 서명
      if (this._userSecret) {
        block.signature = await this.createSignature(data, this._userSecret);
      }
      
      // 로컬 저장
      if (saveToLocal) {
        await this.saveToLocalStorage(dataType, block);
      }
      
      // 클라우드 저장
      if (saveToCloud && window.db && this._userId) {
        await this.saveToFirestore(dataType, block);
      }
      
      console.log(`[SecureStore] 저장 완료: ${dataType}, 해시: ${block.hash.substring(0, 16)}...`);
      return block;
    },
    
    // ========== 데이터 불러오기 ==========
    async loadData(dataType, options = {}) {
      const { loadFromCloud = true, validate = true } = options;
      
      let block = null;
      
      // 클라우드에서 먼저 시도
      if (loadFromCloud && window.db && this._userId) {
        block = await this.loadFromFirestore(dataType);
      }
      
      // 클라우드 실패 시 로컬
      if (!block) {
        block = await this.loadFromLocalStorage(dataType);
      }
      
      if (!block) {
        console.log(`[SecureStore] 데이터 없음: ${dataType}`);
        return null;
      }
      
      // 검증
      if (validate && this.config.validationEnabled) {
        const validation = await this.validateData(dataType, block);
        
        if (!validation.valid) {
          console.error(`[SecureStore] 검증 실패: ${validation.reason}`);
          
          if (this.config.autoRestore) {
            // 복원 시도
            const restored = await this.attemptRestore(dataType);
            if (restored) {
              return restored;
            }
          }
          
          // 검증 실패 알림
          if (options.onTamperDetected) {
            options.onTamperDetected(validation);
          }
          
          return null;
        }
      }
      
      console.log(`[SecureStore] 로드 완료: ${dataType}`);
      return block.data;
    },
    
    // ========== 데이터 검증 ==========
    async validateData(dataType, block) {
      // 블록 기본 검증
      const blockValidation = await this.verifyBlock(block);
      if (!blockValidation.valid) {
        return blockValidation;
      }
      
      // HMAC 서명 검증
      if (block.signature && this._userSecret) {
        const signatureValid = await this.verifySignature(
          block.data,
          block.signature,
          this._userSecret
        );
        
        if (!signatureValid) {
          return { valid: false, reason: 'HMAC 서명 불일치' };
        }
      }
      
      return { valid: true };
    },
    
    // ========== 복원 시도 ==========
    async attemptRestore(dataType) {
      console.log(`[SecureStore] ${dataType} 복원 시도...`);
      
      // Firestore에서 다시 시도
      if (window.db && this._userId) {
        const cloudBlock = await this.loadFromFirestore(dataType);
        if (cloudBlock) {
          const validation = await this.verifyBlock(cloudBlock);
          if (validation.valid) {
            await this.saveToLocalStorage(dataType, cloudBlock);
            console.log(`[SecureStore] 클라우드에서 복원 완료: ${dataType}`);
            return cloudBlock.data;
          }
        }
      }
      
      // 로컬 히스토리에서 찾기
      const history = await this.getBlockHistory(dataType);
      for (let i = history.length - 1; i >= 0; i--) {
        const block = history[i];
        const validation = await this.verifyBlock(block);
        if (validation.valid) {
          await this.saveToLocalStorage(dataType, block);
          console.log(`[SecureStore] 히스토리에서 복원: ${dataType}, 블록 #${block.blockNumber}`);
          return block.data;
        }
      }
      
      console.error(`[SecureStore] 복원 실패: ${dataType}`);
      return null;
    },
    
    // ========== LocalStorage 저장 ==========
    async saveToLocalStorage(dataType, block) {
      const storageKey = `dotRacing_secure_${dataType}`;
      
      // 블록 번호 계산
      const history = await this.getBlockHistory(dataType);
      block.blockNumber = history.length + 1;
      
      // 히스토리에 추가
      history.push(block);
      
      // 초과 시 오래된 것 제거
      if (history.length > this.config.maxBlockHistory) {
        history.shift();
      }
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(block));
        localStorage.setItem(`${storageKey}_history`, JSON.stringify(history));
      } catch (e) {
        console.error('[SecureStore] LocalStorage 저장 실패:', e);
      }
    },
    
    // ========== LocalStorage 불러오기 ==========
    async loadFromLocalStorage(dataType) {
      const storageKey = `dotRacing_secure_${dataType}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('[SecureStore] LocalStorage 파싱 실패:', e);
        }
      }
      
      return null;
    },
    
    // ========== 블록 히스토리 가져오기 ==========
    async getBlockHistory(dataType) {
      const storageKey = `dotRacing_secure_${dataType}_history`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return [];
        }
      }
      
      return [];
    },
    
    // ========== 최신 블록 가져오기 ==========
    async getLatestBlock(dataType) {
      const history = await this.getBlockHistory(dataType);
      return history[history.length - 1] || null;
    },
    
    // ========== Firestore 저장 ==========
    async saveToFirestore(dataType, block) {
      // Firebase 초기화 대기
      if (!window.firebaseReady) {
        let attempts = 0;
        while (!window.firebaseReady && attempts < 50) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
      }
      
      if (!window.db || !this._userId) {
        console.warn('[SecureStore] Firestore 저장 불가: 사용자 없음');
        return false;
      }
      
      try {
        const userRef = window.db.collection('users').doc(this._userId);
        const dataRef = userRef.collection('secureData').doc(dataType);
        
        // 블록 번호 계산
        const history = await this.getBlockHistory(dataType);
        block.blockNumber = history.length + 1;
        
        await dataRef.set({
          ...block,
          updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp() || new Date()
        });
        
        // 히스토리 저장
        const historyRef = userRef.collection('secureHistory').doc(dataType);
        await historyRef.set({
          blocks: history.slice(-this.config.maxBlockHistory),
          lastUpdated: new Date()
        });
        
        console.log(`[SecureStore] Firestore 저장 완료: ${dataType}`);
        return true;
      } catch (e) {
        console.error('[SecureStore] Firestore 저장 실패:', e);
        return false;
      }
    },
    
    // ========== Firestore 불러오기 ==========
    async loadFromFirestore(dataType) {
      // Firebase 초기화 대기
      if (!window.firebaseReady) {
        console.log('[SecureStore] Firebase 대기중...');
        let attempts = 0;
        while (!window.firebaseReady && attempts < 50) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
        if (!window.firebaseReady) {
          console.warn('[SecureStore] Firebase 미준비, 로컬에서 로드');
          return null;
        }
      }
      
      if (!window.db || !this._userId) {
        return null;
      }
      
      try {
        const userRef = window.db.collection('users').doc(this._userId);
        const dataRef = userRef.collection('secureData').doc(dataType);
        
        const doc = await dataRef.get();
        
        if (doc.exists) {
          return doc.data();
        }
      } catch (e) {
        console.error('[SecureStore] Firestore 로드 실패:', e);
      }
      
      return null;
    },
    
    // ========== 변조 감지 알림 ==========
    showTamperAlert(reason, dataType) {
      alert(`⚠️ 데이터 변조 감지!\n\n데이터 유형: ${dataType}\n원인: ${reason}\n\n클라우드에서 복원합니다.`);
    },
    
    // ========== 모든 데이터 동기화 ==========
    async syncAllData() {
      const dataTypes = Object.values(this.DATA_TYPES);
      const results = {};
      
      for (const dataType of dataTypes) {
        try {
          const data = await this.loadData(dataType, { 
            loadFromCloud: true, 
            validate: true,
            onTamperDetected: (validation) => {
              this.showTamperAlert(validation.reason, dataType);
            }
          });
          results[dataType] = data;
        } catch (e) {
          console.error(`[SecureStore] ${dataType} 동기화 실패:`, e);
          results[dataType] = null;
        }
      }
      
      return results;
    },
    
    // ========== 초기화 ==========
    async initialize(userId, deviceId) {
      this.setUser(userId, deviceId);
      console.log('[SecureStore] 초기화 완료:', this.VERSION);
    }
  };

  // ========== Anti-Cheat 시스템 ==========
  const AntiCheat = {
    patterns: {
      walletSurge: {
        threshold: 5,
        windowMs: 60 * 60 * 1000, // 1시간
        action: 'alert'
      },
      consecutiveWins: {
        threshold: 10,
        windowMs: 24 * 60 * 60 * 1000, // 24시간
        action: 'flag'
      },
      fastGameplay: {
        minTimeMs: 5000,
        action: 'flag'
      },
      dataTampering: {
        action: 'ban'
      }
    },
    
    _events: [],
    _flags: {},
    
    // 이벤트 기록
    logEvent(eventType, data) {
      this._events.push({
        type: eventType,
        data: data,
        timestamp: Date.now()
      });
      
      // 분석
      this.analyzeEvent(eventType, data);
    },
    
    // 이벤트 분석
    analyzeEvent(eventType, data) {
      switch (eventType) {
        case 'wallet_change':
          this._checkWalletSurge(data);
          break;
        case 'win':
          this._checkConsecutiveWins();
          break;
        case 'game_complete':
          this._checkFastGameplay(data);
          break;
        case 'tamper_detected':
          this._handleTampering(data);
          break;
      }
    },
    
    // wallet 급증 감지
    _checkWalletSurge(change) {
      const recentChanges = this._events
        .filter(e => e.type === 'wallet_change' && 
                     Date.now() - e.timestamp < this.patterns.walletSurge.windowMs);
      
      const totalChange = recentChanges.reduce((sum, e) => sum + e.data.amount, 0);
      const avgChange = totalChange / recentChanges.length;
      
      if (Math.abs(change.amount) > avgChange * this.patterns.walletSurge.threshold) {
        this._flag('wallet_surge', {
          amount: change.amount,
          avg: avgChange,
          timestamp: Date.now()
        });
      }
    },
    
    // 연속 승리 감지
    _checkConsecutiveWins() {
      const recentWins = this._events
        .filter(e => e.type === 'win' && 
                     Date.now() - e.timestamp < this.patterns.consecutiveWins.windowMs);
      
      if (recentWins.length >= this.patterns.consecutiveWins.threshold) {
        this._flag('consecutive_wins', {
          count: recentWins.length,
          timestamp: Date.now()
        });
      }
    },
    
    // 빠른 게임 플레이 감지
    _checkFastGameplay(data) {
      if (data.duration && data.duration < this.patterns.fastGameplay.minTimeMs) {
        this._flag('fast_gameplay', {
          duration: data.duration,
          timestamp: Date.now()
        });
      }
    },
    
    // 변조 처리
    _handleTampering(data) {
      console.error('[AntiCheat] 변조 감지:', data);
      
      // 서버에 보고
      this.reportToServer({
        type: 'tamper_detected',
        data: data,
        userId: SecureStore._userId,
        deviceId: SecureStore._deviceId,
        timestamp: Date.now()
      });
      
      // 사용자에게 경고
      alert('⚠️ 비정상적인 활동이 감지되었습니다.\n\n관리자에게 보고되었습니다.');
    },
    
    // 플래그 설정
    _flag(type, data) {
      this._flags[type] = data;
      console.warn('[AntiCheat] 플래그 설정:', type, data);
    },
    
    // 서버에 보고
    async reportToServer(report) {
      // Firebase 초기화 대기
      if (!window.firebaseReady) {
        let attempts = 0;
        while (!window.firebaseReady && attempts < 50) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
      }
      
      if (window.db && report.userId) {
        try {
          const ref = window.db.collection('users').doc(report.userId)
            .collection('security').doc('reports');
          
          await ref.collection('events').add({
            ...report,
            createdAt: new Date()
          });
        } catch (e) {
          console.error('[AntiCheat] 보고 실패:', e);
        }
      }
    },
    
    // 플래그 가져오기
    getFlags() {
      return { ...this._flags };
    },
    
    // 초기화
    initialize() {
      this._events = [];
      this._flags = {};
      console.log('[AntiCheat] 초기화 완료');
    }
  };

  // ========== Rate Limiter ==========
  const RateLimiter = {
    limits: {
      wallet_update: { max: 10, windowMs: 60 * 1000 },
      game_start: { max: 5, windowMs: 60 * 1000 },
      coupon_use: { max: 1, windowMs: 24 * 60 * 60 * 1000 },
      nft_trade: { max: 5, windowMs: 60 * 1000 },
      session_create: { max: 3, windowMs: 5 * 60 * 1000 }
    },
    
    _requests: {},
    
    // 요청 허용 여부
    checkLimit(action) {
      const limit = this.limits[action];
      if (!limit) return true;
      
      const key = `${action}_${SecureStore._userId || 'anonymous'}`;
      const now = Date.now();
      
      // 초기화
      if (!this._requests[key]) {
        this._requests[key] = [];
      }
      
      // 오래된 요청 제거
      this._requests[key] = this._requests[key]
        .filter(t => now - t < limit.windowMs);
      
      //Limit 확인
      if (this._requests[key].length >= limit.max) {
        console.warn(`[RateLimiter] 제한 초과: ${action}`);
        return false;
      }
      
      // 요청 기록
      this._requests[key].push(now);
      return true;
    },
    
    // 제한 초과 대기 시간
    getWaitTime(action) {
      const limit = this.limits[action];
      if (!limit) return 0;
      
      const key = `${action}_${SecureStore._userId || 'anonymous'}`;
      const requests = this._requests[key] || [];
      
      if (requests.length < limit.max) return 0;
      
      const oldest = requests[0];
      return Math.max(0, limit.windowMs - (Date.now() - oldest));
    },
    
    // 초기화
    initialize() {
      this._requests = {};
      console.log('[RateLimiter] 초기화 완료');
    }
  };

  // ========== 전역 노출 ==========
  window.SecureStore = SecureStore;
  window.AntiCheat = AntiCheat;
  window.RateLimiter = RateLimiter;
  
  // 편의 함수
  window.secureSave = (dataType, data, options) => 
    SecureStore.saveData(dataType, data, options);
  
  window.secureLoad = (dataType, options) => 
    SecureStore.loadData(dataType, options);
  
  window.secureVerify = (dataType) => 
    SecureStore.validateData(dataType, SecureStore.loadFromLocalStorage(dataType));
  
  window.secureInit = (userId, deviceId) => 
    SecureStore.initialize(userId, deviceId);

  console.log('[SecureStore v1.0] 해시 체인 보안 시스템 로드 완료');
  
})();
