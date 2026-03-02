/**
 * Storage Manager - 도트 경마 v5.2
 * 
 * 중앙집중식 저장소 관리자
 * - 모든 localStorage 접근을 한 곳에서 관리
 * - 자동 JSON 파싱/직렬화
 * - 오류 처리 및 로깅
 * - 키 접두사 관리
 * 
 * @version 1.0.0
 * @author 도겜유튜브
 */

(function() {
  'use strict';

  const STORAGE_PREFIX = 'dot_racing_';

  const KNOWN_KEYS = {
    LAST_REPLAY: 'last_replay',
    SEASON: 'season',
    STATS: 'stats',
    STABLE_DATA: 'stableData_v2',
    MY_NFTS: 'myNFTs',
    NFT_FREE_BOX: 'nftFreeBox',
    ADDICTION: 'addiction',
    USER_ID: 'userId',
    COUPONS: 'coupons'
  };

  class StorageManager {
    constructor() {
      this.prefix = STORAGE_PREFIX;
      this.enabled = this._checkAvailability();
      this._initKeys();
    }

    _checkAvailability() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        console.warn('[StorageManager] localStorage not available:', e.message);
        return false;
      }
    }

    _initKeys() {
      this.keys = { ...KNOWN_KEYS };
    }

    _getKey(key) {
      if (key.startsWith(this.prefix)) {
        return key;
      }
      return this.prefix + key;
    }

    setItem(key, value) {
      if (!this.enabled) {
        console.warn('[StorageManager] Storage disabled, cannot save:', key);
        return false;
      }

      try {
        const storageKey = this._getKey(key);
        const serialized = JSON.stringify(value);
        localStorage.setItem(storageKey, serialized);
        return true;
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          console.error('[StorageManager] Storage quota exceeded for key:', key);
          this._handleQuotaExceeded(key);
        } else {
          console.error('[StorageManager] Failed to save:', key, error.message);
        }
        return false;
      }
    }

    getItem(key, defaultValue = null) {
      if (!this.enabled) {
        console.warn('[StorageManager] Storage disabled, cannot load:', key);
        return defaultValue;
      }

      try {
        const storageKey = this._getKey(key);
        const item = localStorage.getItem(storageKey);
        
        if (item === null) {
          return defaultValue;
        }
        
        return JSON.parse(item);
      } catch (error) {
        console.error('[StorageManager] Failed to load:', key, error.message);
        return defaultValue;
      }
    }

    removeItem(key) {
      if (!this.enabled) {
        return false;
      }

      try {
        const storageKey = this._getKey(key);
        localStorage.removeItem(storageKey);
        return true;
      } catch (error) {
        console.error('[StorageManager] Failed to remove:', key, error.message);
        return false;
      }
    }

    hasItem(key) {
      if (!this.enabled) {
        return false;
      }

      try {
        const storageKey = this._getKey(key);
        return localStorage.getItem(storageKey) !== null;
      } catch (error) {
        return false;
      }
    }

    clear(prefix = null) {
      if (!this.enabled) {
        return false;
      }

      try {
        const targetPrefix = prefix ? this._getKey(prefix) : this.prefix;
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(targetPrefix)) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        return keysToRemove.length;
      } catch (error) {
        console.error('[StorageManager] Failed to clear:', error.message);
        return 0;
      }
    }

    getAllKeys(prefix = null) {
      if (!this.enabled) {
        return [];
      }

      try {
        const targetPrefix = prefix ? this._getKey(prefix) : this.prefix;
        const keys = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(targetPrefix)) {
            keys.push(key);
          }
        }
        
        return keys;
      } catch (error) {
        console.error('[StorageManager] Failed to get keys:', error.message);
        return [];
      }
    }

    getSize(key = null) {
      try {
        if (key) {
          const storageKey = this._getKey(key);
          const item = localStorage.getItem(storageKey);
          return item ? item.length : 0;
        }

        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.prefix)) {
            const item = localStorage.getItem(key);
            if (item) totalSize += item.length;
          }
        }
        return totalSize;
      } catch (error) {
        return 0;
      }
    }

    _handleQuotaExceeded(key) {
      console.warn('[StorageManager] Attempting to free space...');
      
      const keys = this.getAllKeys();
      if (keys.length > 10) {
        const oldestKeys = keys.slice(0, 5);
        oldestKeys.forEach(k => {
          console.log('[StorageManager] Removing old key:', k);
          localStorage.removeItem(k);
        });
        
        try {
          const testKey = '__storage_test__';
          localStorage.setItem(testKey, 'test');
          localStorage.removeItem(testKey);
          console.log('[StorageManager] Space freed, retrying save...');
        } catch (e) {
          console.error('[StorageManager] Still quota exceeded after cleanup');
        }
      }
    }

    migrate(oldKey, newKey) {
      try {
        const oldStorageKey = oldKey.startsWith(this.prefix) ? oldKey : oldKey;
        const newStorageKey = newKey.startsWith(this.prefix) ? newKey : this._getKey(newKey);
        
        const data = localStorage.getItem(oldStorageKey);
        if (data) {
          localStorage.setItem(newStorageKey, data);
          localStorage.removeItem(oldStorageKey);
          console.log('[StorageManager] Migrated:', oldStorageKey, '->', newStorageKey);
          return true;
        }
        return false;
      } catch (error) {
        console.error('[StorageManager] Migration failed:', error.message);
        return false;
      }
    }

    exportData() {
      const data = {};
      const keys = this.getAllKeys();
      
      keys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            data[key] = JSON.parse(item);
          }
        } catch (e) {
          data[key] = null;
        }
      });
      
      return data;
    }

    importData(dataObject) {
      let imported = 0;
      
      for (const [key, value] of Object.entries(dataObject)) {
        try {
          const storageKey = key.startsWith(this.prefix) ? key : this._getKey(key);
          localStorage.setItem(storageKey, JSON.stringify(value));
          imported++;
        } catch (e) {
          console.error('[StorageManager] Import failed for key:', key);
        }
      }
      
      return imported;
    }
  }

  const Storage = new StorageManager();

  window.StorageManager = Storage;
  window.Storage = Storage;

  console.log('[StorageManager] v1.0.0 initialized');

})();
