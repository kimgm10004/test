/**
 * 쿠폰 시스템 - 도트 경마 v5.2
 * 
 * 게임머니 충전, 쿠폰 구매, 관리 시스템
 * 
 * @version 5.2.0
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  // 쿠폰 설정
  const COUPON_CONFIG = {
    // 쿠폰 상품
    products: [
      { id: 'coupon_1k', name: '1,000원권', price: 1000, money: 1000, bonus: 0, bonusPercent: 0 },
      { id: 'coupon_5k', name: '5,000원권', price: 5000, money: 5500, bonus: 500, bonusPercent: 10 },
      { id: 'coupon_10k', name: '10,000원권', price: 10000, money: 12000, bonus: 2000, bonusPercent: 20 },
      { id: 'coupon_30k', name: '30,000원권', price: 30000, money: 39000, bonus: 9000, bonusPercent: 30 },
      { id: 'coupon_50k', name: '50,000원권', price: 50000, money: 70000, bonus: 20000, bonusPercent: 40 },
      { id: 'coupon_100k', name: '100,000원권', price: 100000, money: 150000, bonus: 50000, bonusPercent: 50 }
    ],
    
    // 무료 쿠폰 (일일)
    freeCoupons: [
      { code: 'DAILY100', money: 100, name: '일일 무료 100원', oneTime: false },
      { code: 'WELCOME500', money: 500, name: '환영 쿠폰 500원', oneTime: true },
      { code: 'FIRST1000', money: 1000, name: '첫 충전 보너스 1000원', oneTime: true }
    ],
    
    // 관리자 쿠폰 접두사
    adminPrefix: 'ADMIN_',
    
    // 쿠폰 사용 기록 보관 기간 (일)
    historyDays: 30
  };

  /**
   * 쿠폰 시스템 클래스
   */
  class CouponSystem {
    constructor() {
      this.data = this.loadData();
      this.modalShown = false;
    }

    /**
     * 데이터 로드
     */
    loadData() {
      const saved = window.Storage.getItem('coupons');
      if (saved) {
        try {
          return saved;
        } catch (e) {
          console.warn('[Coupon] Failed to load data');
        }
      }
      return this.getDefaultData();
    }

    /**
     * 기본 데이터
     */
    getDefaultData() {
      return {
        usedCoupons: [],          // 사용한 쿠폰 코드
        purchaseHistory: [],      // 구매 이력
        totalSpent: 0,            // 총 지출
        totalMoneyReceived: 0,   // 총 충전 금액
        couponHistory: [],        // 쿠폰 사용 이력
        firstPurchase: false,     // 첫 구매 여부
        lastDaily: null           // 마지막 일일 쿠폰领取时间
      };
    }

    /**
     * 데이터 저장
     */
    saveData() {
      try {
        window.Storage.setItem('coupons', this.data);
        
        // [v5.2] Firebase 동기화
        if (window.FirebaseSync) {
          window.FirebaseSync.saveCouponData(this.data);
        }
      } catch (e) {
        console.warn('[Coupon] Failed to save data');
      }
    }

    /**
     * 쿠폰 사용
     */
    useCoupon(code) {
      const normalizedCode = code.trim().toUpperCase();
      
      if (!normalizedCode) {
        return { success: false, message: '쿠폰 코드를 입력해주세요.' };
      }

      // 이미 사용한 쿠폰인지 확인
      if (this.data.usedCoupons.includes(normalizedCode)) {
        return { success: false, message: '이미 사용한 쿠폰입니다.' };
      }

      // 무료 쿠폰 체크
      const freeCoupon = COUPON_CONFIG.freeCoupons.find(c => 
        c.code === normalizedCode
      );
      
      if (freeCoupon) {
        if (freeCoupon.oneTime && this.data.usedCoupons.includes(normalizedCode)) {
          return { success: false, message: '이미 사용한 쿠폰입니다.' };
        }
        
        // 쿠폰 사용 기록
        this.data.usedCoupons.push(normalizedCode);
        this.data.couponHistory.push({
          code: normalizedCode,
          money: freeCoupon.money,
          name: freeCoupon.name,
          date: new Date().toISOString()
        });
        
        // 게임머니 지급
        this.addMoney(freeCoupon.money, '쿠폰 사용: ' + freeCoupon.name);
        
        this.saveData();
        
        return {
          success: true,
          money: freeCoupon.money,
          name: freeCoupon.name,
          message: `${freeCoupon.name} 사용완료! ${freeCoupon.money.toLocaleString()}원 충전됨!`
        };
      }

      // 관리자 쿠폰 체크
      if (normalizedCode.startsWith(COUPON_CONFIG.adminPrefix)) {
        return this.useAdminCoupon(normalizedCode);
      }

      // 알 수 없는 쿠폰
      return { success: false, message: '유효하지 않은 쿠폰 코드입니다.' };
    }

    /**
     * 관리자 쿠폰 사용
     */
    useAdminCoupon(code) {
      // 관리자 쿠폰 형식: ADMIN_금액 (예: ADMIN_50000)
      const amount = parseInt(code.replace(COUPON_CONFIG.adminPrefix, ''));
      
      if (isNaN(amount) || amount <= 0) {
        return { success: false, message: '유효하지 않은 관리자 쿠폰입니다.' };
      }

      // 쿠폰 사용 기록
      this.data.usedCoupons.push(code);
      this.data.couponHistory.push({
        code: code,
        money: amount,
        name: `관리자 쿠폰 ${amount}원`,
        date: new Date().toISOString(),
        isAdmin: true
      });
      
      // 게임머니 지급
      this.addMoney(amount, '관리자 쿠폰 사용');
      
      this.saveData();
      
      return {
        success: true,
        money: amount,
        name: `관리자 쿠폰 ${amount}원`,
        message: `관리자 쿠폰 사용완료! ${amount.toLocaleString()}원 충전됨!`
      };
    }

    /**
     * 게임머니 추가
     */
    addMoney(amount, reason) {
      if (window.handleWallet) {
        window.handleWallet(amount);
      }
      
      // 쿠폰 통계 업데이트
      this.data.totalMoneyReceived += amount;
    }

    /**
     * 구매 기록 추가
     */
    addPurchase(product) {
      this.data.purchaseHistory.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        money: product.money,
        bonus: product.bonus,
        date: new Date().toISOString()
      });
      
      this.data.totalSpent += product.price;
      this.data.totalMoneyReceived += product.money;
      
      if (!this.data.firstPurchase) {
        this.data.firstPurchase = true;
      }
      
      this.saveData();
    }

    /**
     * 일일 무료 쿠폰领取
     */
    claimDailyCoupon() {
      const now = new Date();
      const today = now.toDateString();
      
      if (this.data.lastDaily === today) {
        return { success: false, message: '오늘 이미 무료 쿠폰을 받았습니다.' };
      }
      
      // 일일 쿠폰 지급 (DAILY100)
      const dailyMoney = 100;
      
      this.data.lastDaily = today;
      this.addMoney(dailyMoney, '일일 무료 쿠폰');
      
      this.saveData();
      
      return {
        success: true,
        money: dailyMoney,
        message: `일일 무료 쿠폰 사용완료! ${dailyMoney.toLocaleString()}원 충전됨!`
      };
    }

    /**
     * 상품 목록 가져오기
     */
    getProducts() {
      return COUPON_CONFIG.products;
    }

    /**
     * 통계 가져오기
     */
    getStats() {
      return {
        totalSpent: this.data.totalSpent,
        totalMoneyReceived: this.data.totalMoneyReceived,
        couponsUsed: this.data.usedCoupons.length,
        purchaseCount: this.data.purchaseHistory.length,
        firstPurchase: this.data.firstPurchase
      };
    }

    /**
     * 쿠폰 Modal HTML 생성
     */
    renderCouponModal() {
      const products = this.getProducts();
      const stats = this.getStats();
      
      let html = `
        <div class="modal" id="couponModal" style="display:flex;">
          <div class="box" style="max-width:500px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h2 style="margin:0;color:#fff;">🎫 쿠폰 구매</h2>
              <button onclick="document.getElementById('couponModal').style.display='none'" style="background:#e74c3c;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">✕ 닫기</button>
            </div>
            
            <!-- 무료 쿠폰 버튼 -->
            <div style="margin-bottom:16px;">
              <button onclick="window.CouponSystem?.claimDaily()" style="width:100%;background:linear-gradient(135deg, #9df7c7, #48dbfb);color:#000;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">
                🎁 오늘의 무료 쿠폰 받기
              </button>
            </div>
            
            <!-- 쿠폰 코드 입력 -->
            <div style="margin-bottom:16px;">
              <div style="color:#888;font-size:12px;margin-bottom:4px;">쿠폰 코드 입력</div>
              <div style="display:flex;gap:8px;">
                <input type="text" id="couponCode" placeholder="쿠폰 코드 입력" style="flex:1;padding:10px;border-radius:8px;border:1px solid #2a3557;background:#0d1330;color:#dbe1ff;font-size:14px;">
                <button onclick="window.CouponSystem?.useCouponInput()" style="background:#6C5CE7;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">사용</button>
              </div>
            </div>
            
            <div style="border-bottom:1px solid #333;margin:16px 0;"></div>
            
            <!-- 유료 쿠폰 목록 -->
            <div style="color:#888;font-size:12px;margin-bottom:8px;">💎 유료 쿠폰</div>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
      `;
      
      products.forEach(p => {
        const bonusText = p.bonusPercent > 0 ? `<span style="color:#9df7c7;font-size:10px;">+${p.bonusPercent}%</span>` : '';
        
        html += `
          <div style="background:#1a2332;border:1px solid #333;border-radius:8px;padding:12px;cursor:pointer;transition:0.2s;" 
                onmouseover="this.style.borderColor='#6C5CE7'" 
                onmouseout="this.style.borderColor='#333'"
                onclick="window.CouponSystem?.purchase('${p.id}')">
            <div style="color:#fff;font-weight:bold;font-size:14px;">${p.name}</div>
            <div style="color:#ffd26e;font-size:18px;font-weight:bold;">${p.money.toLocaleString()}원</div>
            <div style="color:#888;font-size:11px;">${p.price.toLocaleString()}원 결제 ${bonusText}</div>
          </div>
        `;
      });
      
      html += `
            </div>
            
            <!-- 통계 -->
            <div style="border-top:1px solid #333;margin:16px 0;padding-top:12px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;">
                <span>총 구매: ${stats.purchaseCount}회</span>
                <span>총 충전: ${stats.totalMoneyReceived.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>
      `;
      
      return html;
    }

    /**
     * 쿠폰 Modal 표시
     */
    showModal() {
      // 이미 표시되어 있으면 제거
      const existing = document.getElementById('couponModal');
      if (existing) {
        existing.remove();
      }
      
      // Modal 추가
      const div = document.createElement('div');
      div.innerHTML = this.renderCouponModal();
      document.body.appendChild(div.firstElementChild);
    }

    /**
     * 쿠폰 코드 입력 후 사용
     */
    useCouponInput() {
      const input = document.getElementById('couponCode');
      if (!input) return;
      
      const code = input.value.trim();
      if (!code) {
        alert('쿠폰 코드를 입력해주세요.');
        return;
      }
      
      const result = this.useCoupon(code);
      
      if (result.success) {
        alert(result.message);
        input.value = '';
        
        // 게임머니 업데이트
        if (window.updateWalletDisplay) {
          window.updateWalletDisplay();
        }
      } else {
        alert(result.message);
      }
    }

    /**
     * 일일 쿠폰领取
     */
    claimDaily() {
      const result = this.claimDailyCoupon();
      
      if (result.success) {
        alert(result.message);
        
        // 게임머니 업데이트
        if (window.updateWalletDisplay) {
          window.updateWalletDisplay();
        }
      } else {
        alert(result.message);
      }
    }

    /**
     * 구매 시뮬레이션 (실제 결제 연동은 별도 구현 필요)
     */
    purchase(productId) {
      const product = COUPON_CONFIG.products.find(p => p.id === productId);
      
      if (!product) {
        alert('존재하지 않는 상품입니다.');
        return;
      }
      
      // 확인 메시지
      const confirmMsg = `${product.name}\n결제金额: ${product.price.toLocaleString()}원\n충전金额: ${product.money.toLocaleString()}원\n\n정말 구매하시겠습니까?`;
      
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // 실제 결제 로직은 여기에 구현
      // (PG 연동, 아이돌 결제 등의 실제 시스템 연동 필요)
      
      // 현재는 테스트 목적으로 바로 충전
      // TODO: 실제 결제 연동 시 아래 코드 대체
      /*
      // 예: PG사 연동 코드
      const paymentResult = await callPaymentAPI(product);
      if (paymentResult.success) {
        this.addPurchase(product);
        this.addMoney(product.money, '쿠폰 구매');
      }
      */
      
      // 테스트: 바로 충전 (실제 사용시 위 주석 해제)
      this.addPurchase(product);
      this.addMoney(product.money, '쿠폰 구매: ' + product.name);
      
      alert(`${product.name} 구매완료!\n${product.money.toLocaleString()}원 충전되었습니다!`);
      
      // 게임머니 업데이트
      if (window.updateWalletDisplay) {
        window.updateWalletDisplay();
      }
    }
  }

  // 전역 노출
  window.CouponSystem = new CouponSystem();

  // 쿠폰 코드 사용 함수 (전역)
  window.useCouponCode = function() {
    window.CouponSystem.useCouponInput();
  };

  // 쿠폰 Modal 표시 함수
  window.showCouponModal = function() {
    window.CouponSystem.showModal();
  };

  console.log('[CouponSystem v5.2.0] Loaded - Coupon system ready');
})();
