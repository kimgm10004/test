/**
 * 서버 사이드 베팅 클라이언트 모듈
 * Cloud Functions 연동
 */
(function() {
  'use strict';

  // ===== 서버 상태 관리 =====
  const ServerState = {
    currentRace: null,
    isProcessing: false,
    pendingBets: []
  };

  // ===== 베팅 함수 (서버 호출) =====
  async function placeBetServer(betData) {
    const { type, horses, amount } = betData;
    
    try {
      // Cloud Function 호출
      const placeBet = firebase.functions().httpsCallable('placeBet');
      const result = await placeBet({
        raceId: ServerState.currentRace?.id || 'race_' + Date.now(),
        betType: type,
        horses: horses,
        amount: amount
      });
      
      if (result.data.success) {
        return {
          success: true,
          betId: result.data.data.betId,
          newBalance: result.data.data.newBalance
        };
      } else {
        return {
          success: false,
          error: result.data.error?.message || '베팅 처리 중 오류가 발생했습니다'
        };
      }
      
    } catch (error) {
      console.error('[placeBetServer] Error:', error);
      return {
        success: false,
        error: '네트워크 오류가 발생했습니다'
      };
    }
  }

  // ===== 쿠폰 사용 (서버 호출) =====
  async function redeemCouponServer(code) {
    try {
      const redeemCoupon = firebase.functions().httpsCallable('redeemCoupon');
      const result = await redeemCoupon({ code });
      
      if (result.data.success) {
        return {
          success: true,
          amount: result.data.data.amount
        };
      } else {
        return {
          success: false,
          error: result.data.error?.message || '쿠폰 처리 중 오류가 발생했습니다'
        };
      }
      
    } catch (error) {
      console.error('[redeemCouponServer] Error:', error);
      return {
        success: false,
        error: '네트워크 오류가 발생했습니다'
      };
    }
  }

  // ===== 지갑 동기화 =====
  async function syncWallet() {
    try {
      const getWallet = firebase.functions().httpsCallable('getWallet');
      const result = await getWallet({});
      
      if (result.data.success) {
        const wallet = result.data.data.wallet;
        window.wallet = wallet;
        
        // UI 업데이트
        const walletEl = document.getElementById('wallet');
        if (walletEl && window.fmt) {
          walletEl.textContent = window.fmt(wallet);
        }
        
        return wallet;
      }
      
    } catch (error) {
      console.error('[syncWallet] Error:', error);
    }
    return null;
  }

  // ===== 기존 베팅 함수 오버라이드 =====
  window.overrideBetFunctions = function() {
    // 원래의 btnAdd 클릭 핸들러 저장
    const originalBtnAdd = document.getElementById('btnAdd');
    
    if (originalBtnAdd) {
      // 새로운 베팅 핸들러
      const newBetHandler = async () => {
        try {
          if (!(window.phase === 'betting' || window.phase === 'closing')) {
            alert('베팅 마감');
            return;
          }
          
          if (ServerState.isProcessing) {
            alert('이전 베팅을 처리 중입니다');
            return;
          }
          
          const betType = document.getElementById('betType').value;
          const pickA = parseInt(document.getElementById('pickA').value, 10) - 1;
          const pickB = parseInt(document.getElementById('pickB').value, 10) - 1;
          const pickC = parseInt(document.getElementById('pickC').value, 10) - 1;
          const amount = Math.max(100, Math.floor((Number(document.getElementById('amount').value) || 0) / 100) * 100);
          
          if (!amount || window.wallet < amount) {
            alert('베팅 금액 확인!');
            return;
          }
          
          // 말 선택 검증
          const N = window.roster ? window.roster.length : 10;
          let horses = [];
          
          if (betType === 'WIN' || betType === 'PLACE') {
            if (pickA < 0 || pickA >= N) {
              alert('말 번호 확인!');
              return;
            }
            horses = [pickA];
          } else if (['QUINELLA', 'EXACTA'].includes(betType)) {
            if (pickA < 0 || pickA >= N || pickB < 0 || pickB >= N || pickA === pickB) {
              alert('두 말 번호 확인!');
              return;
            }
            horses = [pickA, pickB];
          } else {
            if (pickA < 0 || pickA >= N || pickB < 0 || pickB >= N || pickC < 0 || pickC >= N || 
                pickA === pickB || pickB === pickC || pickA === pickC) {
              alert('세 말 번호 확인! (중복 불가)');
              return;
            }
            horses = [pickA, pickB, pickC];
          }
          
          ServerState.isProcessing = true;
          originalBtnAdd.disabled = true;
          originalBtnAdd.textContent = '처리 중...';
          
          // 서버에 베팅 요청
          const result = await placeBetServer({
            type: betType,
            horses: horses,
            amount: amount
          });
          
          if (result.success) {
            // 서버 응답 성공 - 로컬 상태 업데이트
            window.wallet = result.newBalance;
            document.getElementById('wallet').textContent = window.fmt(result.newBalance);
            
            // 로컬 티켓 추가 (UI 용)
            const ticket = {
              type: betType,
              a: pickA,
              b: pickB,
              c: pickC,
              amount: amount,
              serverBetId: result.betId
            };
            
            window.userTickets.push(ticket);
            
            // 기존 UI 업데이트 함수 호출
            if (window.rebuildTickets) window.rebuildTickets();
            if (window.renderPayoutPreview) window.renderPayoutPreview();
            if (window.renderPoolTotals) window.renderPoolTotals();
            
            console.log('[Bet] Success:', result.betId);
            
          } else {
            alert('베팅 실패: ' + result.error);
            // 지갑 동기화 (서버와 클라이언트 불일치 가능성)
            await syncWallet();
          }
          
        } catch (err) {
          console.error('[Bet Handler] Error:', err);
          alert('베팅 처리 중 오류가 발생했습니다');
        } finally {
          ServerState.isProcessing = false;
          originalBtnAdd.disabled = false;
          originalBtnAdd.textContent = '베팅';
        }
      };
      
      // 기존 이벤트 리스너 제거 후 새로 등록
      const newBtn = originalBtnAdd.cloneNode(true);
      originalBtnAdd.parentNode.replaceChild(newBtn, originalBtnAdd);
      newBtn.addEventListener('click', newBetHandler);
      newBtn.id = 'btnAdd';
    }
  };

  // ===== 쿠폰 함수 오버라이드 =====
  window.overrideCouponFunctions = function() {
    const btnConfirm = document.getElementById('btnConfirmCoupon');
    
    if (btnConfirm) {
      const newCouponHandler = async () => {
        const code = document.getElementById('couponInput').value.trim();
        
        if (!code) {
          alert('쿠폰 코드를 입력하세요');
          return;
        }
        
        btnConfirm.disabled = true;
        btnConfirm.textContent = '처리 중...';
        
        const result = await redeemCouponServer(code);
        
        if (result.success) {
          alert(`쿠폰 사용 완료! ${result.amount.toLocaleString()}원이 충전되었습니다`);
          await syncWallet();
          document.getElementById('couponPreview').style.display = 'none';
          document.getElementById('couponInput').value = '';
        } else {
          alert('쿠폰 사용 실패: ' + result.error);
        }
        
        btnConfirm.disabled = false;
        btnConfirm.textContent = '쿠폰 확인';
      };
      
      const newBtn = btnConfirm.cloneNode(true);
      btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
      newBtn.addEventListener('click', newCouponHandler);
      newBtn.id = 'btnConfirmCoupon';
    }
  };

  // ===== 초기화 =====
  window.addEventListener('load', () => {
    // Firebase가 로드된 후 함수 오버라이드
    const checkFirebase = setInterval(() => {
      if (window.firebase && window.firebase.functions) {
        clearInterval(checkFirebase);
        
        // Functions 엔드포인트 설정 (아시아 지역)
        firebase.app().functions('asia-northeast3');
        
        // 함수 오버라이드
        setTimeout(() => {
          window.overrideBetFunctions();
          window.overrideCouponFunctions();
          console.log('[ServerClient] Functions overridden');
        }, 2000);
      }
    }, 500);
  });

  // ===== 전역 노출 =====
  window.ServerClient = {
    placeBet: placeBetServer,
    redeemCoupon: redeemCouponServer,
    syncWallet: syncWallet,
    getState: () => ServerState
  };

  console.log('[ServerClient] Module loaded');

})();
