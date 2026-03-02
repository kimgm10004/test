/**
 * db-helper.js — Firestore 접근 통합 헬퍼
 * =====================================================
 * Firebase/Firestore 접근 패턴을 한 곳에서 관리합니다.
 *
 * 기존: window.firestoreModule.doc(window.db, 'users', window.uid)
 * 이후: DB.updateUser({ ... })
 *
 * Firebase 구조가 바뀌면 이 파일만 수정하면 됩니다.
 * =====================================================
 */

(function() {
  'use strict';

  const DB = {

    // ─────────────────────────────────────────────
    // § 1. 상태 확인
    // ─────────────────────────────────────────────

    /** Firebase + DB + UID 모두 준비됐는지 확인 */
    isReady() {
      return !!(window.firebaseReady && window.db && window.uid && window.firestoreModule);
    },

    /** Firebase 준비될 때까지 대기 (최대 5초) */
    async waitReady(maxAttempts = 50) {
      let attempts = 0;
      while (!this.isReady() && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      return this.isReady();
    },

    /** 준비 안 됐을 때 경고 출력 후 false 반환 */
    _check(label = 'DB') {
      if (!this.isReady()) {
        console.warn(`[${label}] Firebase not ready`);
        return false;
      }
      return true;
    },


    // ─────────────────────────────────────────────
    // § 2. 문서 참조 헬퍼
    // ─────────────────────────────────────────────

    /** 사용자 문서 참조 */
    userRef(uid = window.uid) {
      return window.firestoreModule.doc(window.db, 'users', uid);
    },

    /** 임의 컬렉션의 문서 참조 */
    ref(collection, docId) {
      return window.firestoreModule.doc(window.db, collection, docId);
    },


    // ─────────────────────────────────────────────
    // § 3. 사용자 데이터 CRUD
    // ─────────────────────────────────────────────

    /** 사용자 데이터 읽기 */
    async getUser(uid = window.uid) {
      if (!this._check('DB.getUser')) return null;
      try {
        const snap = await window.firestoreModule.getDoc(this.userRef(uid));
        return snap.exists() ? snap.data() : null;
      } catch(e) {
        console.warn('[DB.getUser]', e.message);
        return null;
      }
    },

    /** 사용자 데이터 업데이트 (merge: true) */
    async updateUser(data, uid = window.uid) {
      if (!this._check('DB.updateUser')) return false;
      try {
        await window.firestoreModule.updateDoc(
          window.firestoreModule.doc(window.db, 'users', uid),
          data
        );
        return true;
      } catch(e) {
        console.warn('[DB.updateUser]', e.message);
        return false;
      }
    },

    /** 사용자 데이터 생성/덮어쓰기 (setDoc) */
    async setUser(data, uid = window.uid, merge = true) {
      if (!this._check('DB.setUser')) return false;
      try {
        await window.firestoreModule.setDoc(
          window.firestoreModule.doc(window.db, 'users', uid),
          data,
          { merge }
        );
        return true;
      } catch(e) {
        console.warn('[DB.setUser]', e.message);
        return false;
      }
    },


    // ─────────────────────────────────────────────
    // § 4. 자주 쓰는 업데이트 단축키
    // ─────────────────────────────────────────────

    /** 세션 정보 초기화 (로그아웃 시) */
    async clearSession(uid = window.uid) {
      return this.updateUser({
        lastLogoutTime:   new Date(),
        currentDeviceId:  null,
        lastActiveTime:   null,
        lastActiveSession: null,
      }, uid);
    },

    /** 지갑 금액 업데이트 */
    async saveWallet(amount, uid = window.uid) {
      return this.updateUser({ wallet: amount, updatedAt: new Date() }, uid);
    },


    // ─────────────────────────────────────────────
    // § 5. 일반 컬렉션 접근
    // ─────────────────────────────────────────────

    /** 임의 컬렉션 문서 읽기 */
    async get(collection, docId) {
      if (!this._check('DB.get')) return null;
      try {
        const snap = await window.firestoreModule.getDoc(this.ref(collection, docId));
        return snap.exists() ? snap.data() : null;
      } catch(e) {
        console.warn('[DB.get]', e.message);
        return null;
      }
    },

    /** 임의 컬렉션 문서 업데이트 */
    async update(collection, docId, data) {
      if (!this._check('DB.update')) return false;
      try {
        await window.firestoreModule.updateDoc(this.ref(collection, docId), data);
        return true;
      } catch(e) {
        console.warn('[DB.update]', e.message);
        return false;
      }
    },

    /** 임의 컬렉션 문서 set */
    async set(collection, docId, data, merge = true) {
      if (!this._check('DB.set')) return false;
      try {
        await window.firestoreModule.setDoc(this.ref(collection, docId), data, { merge });
        return true;
      } catch(e) {
        console.warn('[DB.set]', e.message);
        return false;
      }
    },

  };

  // 전역으로 노출
  window.DB = DB;

  console.log('[DB] db-helper.js 로드 완료 ✅');

})();
