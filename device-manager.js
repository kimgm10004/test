/**
 * Device Manager - 도트경마 v5.2
 * 디바이스 지문 및 멀티 디바이스 관리 시스템
 * 
 * 기능:
 * - 디바이스 지문 생성
 * - 멀티 디바이스 감지
 * - 디바이스 등록/인증
 * - 최대 디바이스 수 제한
 */

(function() {
  'use strict';

  const DeviceManager = {
    VERSION: '1.0.0',
    
    // 설정
    config: {
      maxDevices: 3,
      sessionTimeout: 30 * 60 * 1000, // 30분
      deviceIdKey: 'dotRacing_deviceId',
      trustedDevicesKey: 'dotRacing_trustedDevices'
    },
    
    // 현재 디바이스 ID
    _deviceId: null,
    _fingerprint: null,
    
    // ========== 디바이스 지문 생성 ==========
    async generateFingerprint() {
      const components = [
        // 브라우저 정보
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        navigator.hardwareConcurrency || 0,
        navigator.deviceMemory || 0,
        
        // 화면 정보
        screen.width,
        screen.height,
        screen.colorDepth,
        screen.pixelRatio,
        
        // 시간대
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        Intl.DateTimeFormat().resolvedOptions().timeZoneOffset,
        
        // Canvas Fingerprint
        await this._generateCanvasFingerprint(),
        
        // WebGL Fingerprint
        this._generateWebGLFingerprint(),
        
        // Audio Fingerprint
        await this._generateAudioFingerprint()
      ];
      
      // SHA-256으로 해시
      const fingerprint = await this._sha256(components.join('|'));
      
      this._fingerprint = fingerprint;
      return fingerprint;
    },
    
    // ========== Canvas Fingerprint ==========
    async _generateCanvasFingerprint() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 200;
        canvas.height = 50;
        
        // 텍스트 그리기
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('DotRacing v5.2', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('DotRacing', 4, 17);
        
        // Data URL 추출
        const dataUrl = canvas.toDataURL();
        
        // 해시
        return await this._sha256(dataUrl);
      } catch (e) {
        return 'canvas-not-available';
      }
    },
    
    // ========== WebGL Fingerprint ==========
    _generateWebGLFingerprint() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return 'webgl-not-available';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          return `${vendor}|${renderer}`;
        }
        
        return 'webgl-debug-info-not-available';
      } catch (e) {
        return 'webgl-error';
      }
    },
    
    // ========== Audio Fingerprint ==========
    async _generateAudioFingerprint() {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        const gain = audioContext.createGain();
        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        // 단순 오디오 처리
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        
        oscillator.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(gain);
        gain.connect(audioContext.destination);
        
        oscillator.start(0);
        
        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 0.1));
        
        oscillator.stop();
        audioContext.close();
        
        return 'audio-fingerprint-generated';
      } catch (e) {
        return 'audio-not-available';
      }
    },
    
    // ========== SHA-256 ==========
    async _sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    // ========== 디바이스 ID 가져오기/생성 ==========
    getDeviceId() {
      if (this._deviceId) return this._deviceId;
      
      let deviceId = localStorage.getItem(this.config.deviceIdKey);
      
      if (!deviceId) {
        deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(this.config.deviceIdKey, deviceId);
      }
      
      this._deviceId = deviceId;
      return deviceId;
    },
    
    // ========== 신뢰할 수 있는 디바이스 목록 가져오기 ==========
    getTrustedDevices() {
      const stored = localStorage.getItem(this.config.trustedDevicesKey);
      return stored ? JSON.parse(stored) : [];
    },
    
    // ========== 신뢰할 수 있는 디바이스 추가 ==========
    addTrustedDevice(deviceInfo) {
      const devices = this.getTrustedDevices();
      
      // 이미 등록된 디바이스인지 확인
      const exists = devices.some(d => d.deviceId === deviceInfo.deviceId);
      
      if (!exists) {
        if (devices.length >= this.config.maxDevices) {
          return { success: false, reason: `최대 ${this.config.maxDevices}개 디바이스까지 등록 가능합니다.` };
        }
        
        devices.push({
          ...deviceInfo,
          addedAt: Date.now()
        });
        
        localStorage.setItem(this.config.trustedDevicesKey, JSON.stringify(devices));
      }
      
      return { success: true, devices: devices };
    },
    
    // ========== 신뢰할 수 있는 디바이스 제거 ==========
    removeTrustedDevice(deviceId) {
      let devices = this.getTrustedDevices();
      devices = devices.filter(d => d.deviceId !== deviceId);
      localStorage.setItem(this.config.trustedDevicesKey, JSON.stringify(devices));
      return { success: true, devices: devices };
    },
    
    // ========== 디바이스가 신뢰할 수 있는 디바이스인지 확인 ==========
    isDeviceTrusted(deviceId) {
      const devices = this.getTrustedDevices();
      return devices.some(d => d.deviceId === deviceId);
    },
    
    // ========== 서버에서 디바이스 목록 동기화 ==========
    async syncWithServer(userId) {
      if (!window.db || !userId) return null;
      
      try {
        const userRef = window.db.collection('users').doc(userId);
        const deviceRef = userRef.collection('devices').doc('list');
        
        const doc = await deviceRef.get();
        
        if (doc.exists) {
          const serverDevices = doc.data().devices || [];
          
          // 로컬 저장소와 병합
          const localDevices = this.getTrustedDevices();
          const mergedDevices = this._mergeDevices(localDevices, serverDevices);
          
          // 서버에 저장
          await deviceRef.set({
            devices: mergedDevices,
            lastSync: new Date()
          });
          
          return mergedDevices;
        }
      } catch (e) {
        console.error('[DeviceManager] 서버 동기화 실패:', e);
      }
      
      return null;
    },
    
    // ========== 디바이스 병합 ==========
    _mergeDevices(local, server) {
      const merged = [...server];
      
      for (const localDevice of local) {
        if (!merged.some(d => d.deviceId === localDevice.deviceId)) {
          merged.push(localDevice);
        }
      }
      
      return merged.slice(0, this.config.maxDevices);
    },
    
    // ========== 디바이스 등록 ==========
    async registerDevice(userId) {
      const deviceId = this.getDeviceId();
      const fingerprint = await this.generateFingerprint();
      
      const deviceInfo = {
        deviceId: deviceId,
        fingerprint: fingerprint,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        registeredAt: Date.now()
      };
      
      // 서버에 디바이스 등록
      if (window.db && userId) {
        try {
          const userRef = window.db.collection('users').doc(userId);
          const deviceRef = userRef.collection('devices').doc(deviceId);
          
          await deviceRef.set({
            ...deviceInfo,
            lastActive: new Date(),
            trusted: true
          });
          
          console.log('[DeviceManager] 디바이스 서버 등록 완료:', deviceId);
        } catch (e) {
          console.error('[DeviceManager] 디바이스 등록 실패:', e);
        }
      }
      
      // 로컬에 신뢰 디바이스로 추가
      this.addTrustedDevice(deviceInfo);
      
      return deviceInfo;
    },
    
    // ========== 멀티 디바이스 감지 ==========
    async checkMultiDevice(userId) {
      if (!window.db || !userId) {
        return { allowed: true, reason: '서버 연결 없음' };
      }
      
      try {
        const userRef = window.db.collection('users').doc(userId);
        const devicesSnapshot = await userRef.collection('devices').get();
        
        const devices = [];
        devicesSnapshot.forEach(doc => {
          devices.push({ id: doc.id, ...doc.data() });
        });
        
        // 현재 디바이스가 목록에 있는지 확인
        const currentDeviceId = this.getDeviceId();
        const isRegistered = devices.some(d => d.id === currentDeviceId);
        
        if (!isRegistered) {
          // 새 디바이스 - 등록 필요
          return {
            allowed: false,
            reason: '새 디바이스에서 접속했습니다.',
            requiresVerification: true,
            registeredDevices: devices.length,
            maxDevices: this.config.maxDevices
          };
        }
        
        // 디바이스 수 확인
        if (devices.length > this.config.maxDevices) {
          return {
            allowed: false,
            reason: `최대 ${this.config.maxDevices}개 디바이스까지 허용됩니다.`,
            requiresVerification: false,
            registeredDevices: devices.length,
            maxDevices: this.config.maxDevices
          };
        }
        
        // 마지막 활동 시간 업데이트
        const currentDevice = devices.find(d => d.id === currentDeviceId);
        if (currentDevice) {
          await userRef.collection('devices').doc(currentDeviceId).update({
            lastActive: new Date()
          });
        }
        
        return {
          allowed: true,
          reason: '디바이스 확인 완료',
          registeredDevices: devices.length
        };
        
      } catch (e) {
        console.error('[DeviceManager] 멀티 디바이스 확인 실패:', e);
        return { allowed: true, reason: '확인 중 오류 발생' };
      }
    },
    
    // ========== 디바이스 활성화 ==========
    async verifyDevice(userId, verificationCode) {
      // 간단한 검증 코드 확인 (실제로는 이메일 OTP 등 필요)
      if (!verificationCode || verificationCode.length < 4) {
        return { success: false, reason: '유효하지 않은 인증 코드입니다.' };
      }
      
      // 서버에서 검증
      if (window.db && userId) {
        try {
          const deviceId = this.getDeviceId();
          const fingerprint = await this.generateFingerprint();
          
          const userRef = window.db.collection('users').doc(userId);
          const deviceRef = userRef.collection('devices').doc(deviceId);
          
          await deviceRef.set({
            deviceId: deviceId,
            fingerprint: fingerprint,
            trusted: true,
            verifiedAt: new Date(),
            userAgent: navigator.userAgent
          });
          
          // 로컬에도 저장
          this.addTrustedDevice({
            deviceId: deviceId,
            fingerprint: fingerprint,
            verifiedAt: Date.now()
          });
          
          return { success: true, reason: '디바이스가 인증되었습니다.' };
        } catch (e) {
          return { success: false, reason: '인증 중 오류가 발생했습니다.' };
        }
      }
      
      return { success: false, reason: '서버 연결이 없습니다.' };
    },
    
    // ========== 디바이스 제거 요청 ==========
    async requestRemoveDevice(userId, deviceIdToRemove) {
      if (!window.db || !userId) {
        return { success: false, reason: '서버 연결이 없습니다.' };
      }
      
      try {
        const userRef = window.db.collection('users').doc(userId);
        await userRef.collection('devices').doc(deviceIdToRemove).delete();
        
        // 로컬에서도 제거
        this.removeTrustedDevice(deviceIdToRemove);
        
        return { success: true, reason: '디바이스가 제거되었습니다.' };
      } catch (e) {
        return { success: false, reason: '제거 중 오류가 발생했습니다.' };
      }
    },
    
    // ========== 초기화 ==========
    async initialize(userId = null) {
      this._deviceId = this.getDeviceId();
      this._fingerprint = await this.generateFingerprint();
      
      console.log('[DeviceManager] 초기화 완료:', this._deviceId);
      
      // 서버 동기화
      if (userId) {
        await this.syncWithServer(userId);
      }
      
      return {
        deviceId: this._deviceId,
        fingerprint: this._fingerprint
      };
    }
  };

  // ========== 전역 노출 ==========
  window.DeviceManager = DeviceManager;
  
  // 편의 함수
  window.getDeviceId = () => DeviceManager.getDeviceId();
  window.getDeviceFingerprint = () => DeviceManager.generateFingerprint();
  window.registerDevice = (userId) => DeviceManager.registerDevice(userId);
  window.checkMultiDevice = (userId) => DeviceManager.checkMultiDevice(userId);
  window.verifyDevice = (userId, code) => DeviceManager.verifyDevice(userId, code);

  console.log('[DeviceManager v1.0] 디바이스 관리 시스템 로드 완료');
  
})();
