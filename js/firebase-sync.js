/**
 * Firebase 연동 시스템 - 도트 경마 v5.2
 * 
 * 사용자 데이터 클라우드 동기화
 * - 게임머니
 * - 통계 데이터
 * - 시즌 데이터
 * - 중독성 데이터
 * - 쿠폰 데이터
 * 
 * @version 5.2.0
 * @author 도겜유튜브
 */

class FirebaseSync {
  constructor() {
    this.isInitialized = false;
    this.unsubscribes = [];
    this.offlineMode = false;
  }

  /**
   * Firebase 초기화
   */
  async init() {
    if (this.isInitialized) return;

    console.log('[FirebaseSync] Initializing...');

    try {
      // Firebase 모듈 로드 확인
      if (!window.db || !window.uid) {
        console.log('[FirebaseSync] Waiting for Firebase init...');
        await this.waitForFirebase();
      }

      // 온라인 상태 감시
      this.setupOnlineListener();

      // 사용자 데이터 리스너 설정
      this.setupUserDataListeners();

      this.isInitialized = true;
      console.log('[FirebaseSync] Initialized successfully');

    } catch (error) {
      console.error('[FirebaseSync] Init failed:', error);
      this.offlineMode = true;
    }
  }

  /**
   * Firebase 준비 대기
   */
  async waitForFirebase() {
    let attempts = 0;
    while (!window.db && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.db) {
      throw new Error('Firebase not available');
    }
  }

  /**
   * 온라인 상태 감시
   */
  setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('[FirebaseSync] Back online!');
      this.offlineMode = false;
      this.syncAllData();
    });

    window.addEventListener('offline', () => {
      console.log('[FirebaseSync] Offline mode');
      this.offlineMode = true;
    });
  }

  /**
   * 사용자 데이터 리스너 설정
   */
  setupUserDataListeners() {
    if (!window.uid || !window.db) return;

    const userId = window.uid;

    // 게임머니 리스너
    this.listenToDocument(`users/${userId}/data/wallet`, (data) => {
      if (data && data.amount !== undefined) {
        window.wallet = data.amount;
        if ($('wallet')) {
          $('wallet').textContent = window.fmt(window.wallet);
        }
      }
    });

    // 중독성 데이터 리스너
    this.listenToDocument(`users/${userId}/data/addiction`, (data) => {
      if (data && window.AddictionSystem) {
        // 로컬 데이터 업데이트
        Object.assign(window.AddictionSystem.data, data);
        window.AddictionSystem.saveData();
      }
    });

    // 쿠폰 데이터 리스너
    this.listenToDocument(`users/${userId}/data/coupons`, (data) => {
      if (data && window.CouponSystem) {
        // 로컬 데이터 업데이트
        Object.assign(window.CouponSystem.data, data);
        window.CouponSystem.saveData();
      }
    });

    // 시즌 데이터 리스너
    this.listenToDocument(`users/${userId}/stats/season`, (data) => {
      if (data && window.SeasonSystem) {
        window.SeasonSystem.refreshFromCloud(data);
      }
    });
  }

  /**
   * 문서 리스너 설정
   */
  listenToDocument(path, callback) {
    if (!window.db || !window.uid) return;

    const { doc, onSnapshot } = window.firestoreModule || {};
    if (!doc || !onSnapshot) return;

    try {
      const docRef = doc(window.db, path);
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data());
        }
      }, (error) => {
        console.warn('[FirebaseSync] Listen error:', error);
      });

      this.unsubscribes.push(unsubscribe);
    } catch (error) {
      console.warn('[FirebaseSync] Failed to setup listener:', error);
    }
  }

  /**
   * 게임머니 저장
   */
  async saveWallet(amount) {
    if (this.offlineMode) {
      console.log('[FirebaseSync] Offline - wallet saved locally');
      return false;
    }

    try {
      const { doc, setDoc, updateDoc } = window.firestoreModule || {};
      if (!doc || !setDoc) return false;

      const walletRef = doc(window.db, 'users', window.uid, 'data', 'wallet');
      
      await setDoc(walletRef, {
        amount: amount,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log('[FirebaseSync] Wallet saved:', amount);
      return true;
    } catch (error) {
      console.error('[FirebaseSync] Wallet save failed:', error);
      return false;
    }
  }

  /**
   * 게임머니 증가
   */
  async addWallet(amount) {
    const newAmount = window.wallet + amount;
    window.wallet = newAmount;
    
    if ($('wallet')) {
      $('wallet').textContent = window.fmt(newAmount);
    }

    return await this.saveWallet(newAmount);
  }

  /**
   * 중독성 데이터 저장
   */
  async saveAddictionData(data) {
    if (this.offlineMode) return false;

    try {
      const { doc, setDoc } = window.firestoreModule || {};
      if (!doc || !setDoc) return false;

      const addictionRef = doc(window.db, 'users', window.uid, 'data', 'addiction');
      
      await setDoc(addictionRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('[FirebaseSync] Addiction save failed:', error);
      return false;
    }
  }

  /**
   * 쿠폰 데이터 저장
   */
  async saveCouponData(data) {
    if (this.offlineMode) return false;

    try {
      const { doc, setDoc } = window.firestoreModule || {};
      if (!doc || !setDoc) return false;

      const couponRef = doc(window.db, 'users', window.uid, 'data', 'coupons');
      
      await setDoc(couponRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('[FirebaseSync] Coupon save failed:', error);
      return false;
    }
  }

  /**
   * 통계 데이터 저장
   */
  async saveStats(stats) {
    if (this.offlineMode) return false;

    try {
      const { doc, setDoc } = window.firestoreModule || {};
      if (!doc || !setDoc) return false;

      const statsRef = doc(window.db, 'users', window.uid, 'stats', 'current');
      
      await setDoc(statsRef, {
        ...stats,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('[FirebaseSync] Stats save failed:', error);
      return false;
    }
  }

  /**
   * 시즌 데이터 저장
   */
  async saveSeason(seasonData) {
    if (this.offlineMode) return false;

    try {
      const { doc, setDoc } = window.firestoreModule || {};
      if (!doc || !setDoc) return false;

      const seasonRef = doc(window.db, 'users', window.uid, 'stats', 'season');
      
      await setDoc(seasonRef, {
        ...seasonData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('[FirebaseSync] Season save failed:', error);
      return false;
    }
  }

  /**
   * 전체 데이터 동기화
   */
  async syncAllData() {
    console.log('[FirebaseSync] Syncing all data...');

    // 게임머니
    if (window.wallet !== undefined) {
      await this.saveWallet(window.wallet);
    }

    // 중독성
    if (window.AddictionSystem) {
      await this.saveAddictionData(window.AddictionSystem.data);
    }

    // 쿠폰
    if (window.CouponSystem) {
      await this.saveCouponData(window.CouponSystem.data);
    }

    console.log('[FirebaseSync] Sync complete');
  }

  /**
   * 클라우드에서 데이터 로드
   */
  async loadFromCloud() {
    if (!window.uid || !window.db) return null;

    try {
      const { doc, getDoc } = window.firestoreModule || {};
      if (!doc || !getDoc) return null;

      const walletRef = doc(window.db, 'users', window.uid, 'data', 'wallet');
      const snapshot = await getDoc(walletRef);

      if (snapshot.exists()) {
        return snapshot.data();
      }
    } catch (error) {
      console.error('[FirebaseSync] Load failed:', error);
    }

    return null;
  }

  /**
   * 정리
   */
  cleanup() {
    this.unsubscribes.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribes = [];
  }
}

// 전역 노출
window.FirebaseSync = new FirebaseSync();

// Firebase 초기화 완료 후 자동 시작
function initFirebaseSync() {
  // 기존 Firebase 초기화 대기
  const checkFirebase = setInterval(() => {
    if (window.uid && window.db) {
      clearInterval(checkFirebase);
      window.FirebaseSync.init();
    }
  }, 500);

  // 최대 10초 대기
  setTimeout(() => clearInterval(checkFirebase), 10000);
}

// 페이지 로드 시 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebaseSync);
} else {
  initFirebaseSync();
}

console.log('[FirebaseSync v5.2.0] Loaded');
