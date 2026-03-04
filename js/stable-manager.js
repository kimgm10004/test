/**
 * Stable Manager System v1.0.0
 * Dot Racing v5.2 - Full Stable Game System
 *
 * Features:
 * - Horse purchase / sell / management
 * - Training system with cooldown (speed / stamina / burst stats growth)
 * - Breeding system (two horses -> offspring with grade inheritance)
 * - Medical / recovery system
 * - Facility upgrades (Barn / Training / Medical / Breeding)
 * - Firebase Firestore sync
 * - Integration with main racing game (export horse to race)
 *
 * v0.2.0 -> v1.0.0 major upgrade
 */

(function () {
  'use strict';
  const TRAINING_COOLDOWN_MS = window.GAME_CONFIG?.TRAINING_COOLDOWN_MS ?? 2 * 60 * 60 * 1000; // [game-config.js]
  const TRAINING_STAT_GAIN   = window.GAME_CONFIG?.TRAINING_STAT_GAIN   ?? { min: 1, max: 4 }; // [game-config.js]
  const TRAINING_FATIGUE     = window.GAME_CONFIG?.TRAINING_FATIGUE     ?? 20; // [game-config.js]
  const MEDICAL_COOLDOWN_MS  = window.GAME_CONFIG?.MEDICAL_COOLDOWN_MS  ?? 1 * 60 * 60 * 1000; // [game-config.js]
  const MEDICAL_RECOVER      = window.GAME_CONFIG?.MEDICAL_RECOVER      ?? 50; // [game-config.js]
  const BREED_BASE_COST      = window.GAME_CONFIG?.BREED_BASE_COST      ?? 200000; // [game-config.js]
  const MARKET_REFRESH_COST  = window.GAME_CONFIG?.MARKET_REFRESH_COST  ?? 50000; // [game-config.js]
  const MARKET_REFRESH_COST_DOTT = (window.GAME_CONFIG?.MARKET_REFRESH_COST ?? 50000); // [Rate v2] 50,000 DOTT

  // [game-config.js] HORSE_GRADES는 GAME_CONFIG.HORSE_GRADES 참조
const HORSE_GRADES = window.GAME_CONFIG?.HORSE_GRADES ?? {
    C:   { price: [50000,   100000],  stats: [30, 55],  weight: 40 },
    B:   { price: [100000,  200000],  stats: [55, 70],  weight: 30 },
    A:   { price: [200000,  400000],  stats: [70, 80],  weight: 15 },
    S:   { price: [400000,  800000],  stats: [80, 90],  weight: 10 },
    SS:  { price: [800000,  1500000], stats: [90, 95],  weight: 4  },
    SSS: { price: [1500000, 3000000], stats: [95, 100], weight: 1  }
  };

  const BREED_OUTCOME = {
    'C+C':    { C: 70, B: 30 },
    'C+B':    { C: 40, B: 50, A: 10 },
    'B+B':    { C: 20, B: 55, A: 25 },
    'B+A':    { B: 30, A: 50, S: 20 },
    'A+A':    { B: 10, A: 55, S: 35 },
    'A+S':    { A: 30, S: 50, SS: 20 },
    'S+S':    { A: 10, S: 50, SS: 38, SSS: 2 },
    'S+SS':   { S: 30, SS: 55, SSS: 15 },
    'SS+SS':  { S: 10, SS: 55, SSS: 35 },
    'SS+SSS': { SS: 30, SSS: 70 },
    'SSS+SSS':{ SS: 10, SSS: 90 }
  };

  const HORSE_NAMES = {
    prefixes: ['태','무','천','카이','동','에','드','스','로','유','금','은','철','화','수','목','토','신','명','봉'],
    suffixes: ['왕','적','마','룡','날','풍','광','철','한','우','성','빛','결','혼','령','양','진','강','호','운']
  };

  const COAT_COLORS = ['갈색','흰색','검은색','얼룩','황토색','회색','적갈색','연갈색'];

  const GRADE_COLORS = {
    C:'#8a9bb5', B:'#3dd68c', A:'#4f8ef7', S:'#9b7ef8', SS:'#f5c842', SSS:'#f26b6b'
  };

  const FACILITY_META = {
    barn:     { name:'마방',   icon:'🏠', desc:'보유 가능한 말 수 +3', maxLevel:10 },
    training: { name:'훈련장', icon:'🏋️', desc:'훈련 슬롯 수 & 훈련 효율 증가', maxLevel:10 },
    medical:  { name:'의료실', icon:'🏥', desc:'치료 슬롯 수 & 회복량 증가', maxLevel:10 },
    breeding: { name:'번식장', icon:'🐴', desc:'번식 슬롯 수 & 고등급 확률 증가', maxLevel:5  }
  };

  // ── [v5.3 DOT Fix] 베팅 메인 지갑 헬퍼 ───────────────────────
  // 목장 내 DOT는 window.wallet(베팅 메인 지갑)을 참조합니다.
  // StableState.wallet은 제거됨 — 절대 직접 사용 금지.
  function getMainWallet()  { return window.wallet || 0; }
  function setMainWallet(v) {
    window.wallet = Math.max(0, Number(v) || 0);
    const el = document.getElementById('wallet');
    if (el && window.fmt) el.textContent = window.fmt(window.wallet);
    if (window.FirebaseSync && typeof window.FirebaseSync.saveWallet === 'function')
      window.FirebaseSync.saveWallet(window.wallet);
  }

  let StableState = {
    userId: null, horses: [], // [DOT Fix] wallet 항목 제거 — DOT는 window.wallet 사용
    facilities: { barn:1, training:1, medical:1, breeding:0 },
    marketHorses: [], marketLastRefresh: 0,
    breedingSlots: [], trainingSlots: [], medicalSlots: [],
    raceEntryHorseId: null, lastSaved: 0,
    // ── [v5.3 Phase2] DOTT 코인 시스템
    dottWallet: 0,
    dottHistory: [],
    // ── [v5.3 Phase3] 은행
    bankLastExchange: 0,
    // ── [v5.3 Phase5] 일일 퀘스트
    dailyQuests: [],
    questLastReset: 0,
    questCompleted: 0,    // 누적 완료 퀘스트 수
    achievements: [],     // [v5.3 Phase5] 달성한 업적 id 목록
    achieveLog: [],       // 최근 업적 달성 로그
    // ── [v5.3 Phase5] 말 강화
    enhanceLog: [],
    // ── [v5.3 Phase5] 명예의 전당
    hallOfFame: []        // [{name, grade, wins, retiredAt}]
  };

  let stableTimers = {};
  let marketHorses = [];

  /* ---- Firebase ---- */
  function getFirebaseUid() {
    try { return firebase?.auth?.()?.currentUser?.uid || null; } catch(e) { return null; }
  }
  function getStableRef() {
    const uid = getFirebaseUid();
    if (!uid || !firebase?.firestore) return null;
    return firebase.firestore().collection('stables').doc(uid);
  }
  async function saveGame() {
    const ref = getStableRef();
    if (!ref) { try { localStorage.setItem('dotStableData_v2', JSON.stringify(StableState)); } catch(e){} return; }
    try {
      await ref.set({ ...StableState, lastSaved: Date.now() }, { merge: true });
    } catch(err) {
      console.warn('[Stable] Firebase save failed:', err.message);
      try { localStorage.setItem('dotStableData_v2', JSON.stringify(StableState)); } catch(e){}
    }
  }
  async function loadGame() {
    const ref = getStableRef();
    if (!ref) {
      try {
        const raw = localStorage.getItem('dotStableData_v2');
        if (raw) Object.assign(StableState, JSON.parse(raw));
      } catch(e){}
      return;
    }
    try {
      const snap = await ref.get();
      if (snap.exists) Object.assign(StableState, snap.data());
      else {
        try { const raw = localStorage.getItem('dotStableData_v2'); if(raw) Object.assign(StableState, JSON.parse(raw)); } catch(e){}
      }
    } catch(err) {
      console.warn('[Stable] Firebase load failed:', err.message);
      try { const raw = localStorage.getItem('dotStableData_v2'); if(raw) Object.assign(StableState, JSON.parse(raw)); } catch(e){}
    }
    // [v5.3 DOT Fix] 레거시 wallet(DOT) 값 → 메인 지갑으로 이관
    if (StableState.wallet && StableState.wallet > 0) {
      console.log('[Stable] 레거시 wallet 이관:', StableState.wallet, 'DOT');
      setMainWallet(getMainWallet() + StableState.wallet);
    }
    delete StableState.wallet;
  }

  /* ---- Horse Factory ---- */
  function weightedGrade() {
    const grades = Object.keys(HORSE_GRADES);
    const total  = grades.reduce((s,g) => s + HORSE_GRADES[g].weight, 0);
    let rand = Math.random() * total;
    for (const g of grades) { rand -= HORSE_GRADES[g].weight; if (rand <= 0) return g; }
    return 'C';
  }
  function rng(mn, mx) { return Math.floor(Math.random() * (mx - mn + 1)) + mn; }
  function createHorse(gradeOverride) {
    const grade = gradeOverride || weightedGrade();
    const data  = HORSE_GRADES[grade];
    const baseVal = rng(data.price[0], data.price[1]);
    return {
      id:      'horse_' + Date.now() + '_' + rng(1000,9999),
      name:    HORSE_NAMES.prefixes[rng(0,HORSE_NAMES.prefixes.length-1)] + HORSE_NAMES.suffixes[rng(0,HORSE_NAMES.suffixes.length-1)],
      gender:  Math.random() < 0.5 ? 'male' : 'female',
      age:     rng(2,5), coat: COAT_COLORS[rng(0,COAT_COLORS.length-1)], grade,
      stats:   { speed:rng(data.stats[0],data.stats[1]), stamina:rng(data.stats[0],data.stats[1]), burst:rng(data.stats[0],data.stats[1]) },
      value:   baseVal,
      baseValue: baseVal,     // [v5.3] 기준가 (우승 프리미엄 계산용)
      winPremium: 0,          // [v5.3] 우승 프리미엄율 (0.0~1.5)
      honorTitle: '⭐ 신인',  // [v5.3] 명예 칭호
      fitness: 100, status:'available', trainCount:0, wins:0, races:0,
      acquired:{ method:'market', date:new Date().toISOString() }
    };
  }

  /* ---- Market ---- */
  function refreshMarket(paid) {
    if (paid) {
      if ((StableState.dottWallet||0) < MARKET_REFRESH_COST_DOTT) { showToast('DOTT 부족! 시장 새로고침: '+MARKET_REFRESH_COST_DOTT+' DOTT 필요','warn'); return; }
      StableState.dottWallet -= MARKET_REFRESH_COST_DOTT;
      addDottHistory('market_refresh', -MARKET_REFRESH_COST_DOTT, '시장 새로고침');
    }
    const count = 4 + Math.min(StableState.facilities.barn, 4);
    marketHorses = [];
    for (let i = 0; i < count; i++) marketHorses.push(createHorse());
    StableState.marketHorses = [...marketHorses];
    StableState.marketLastRefresh = Date.now();
    progressQuest('market', 1);
    renderMarket(); renderWallet();
    if (paid) saveGame();
  }
  function buyHorse(index) {
    const horse = marketHorses[index]; if (!horse) return;
    if (StableState.horses.length >= getMaxHorses()) { showToast('마방 부족!','warn'); return; }
    const dottPrice = horse.value; // [Rate v2] DOT 가격 수치 = DOTT 가격 수치 (1:1 수치, 단위 DOTT)
    if ((StableState.dottWallet||0) < dottPrice) { showToast('DOTT 부족! 필요: '+dottPrice+' DOTT','warn'); return; }
    StableState.dottWallet -= dottPrice;
    addDottHistory('buy_horse', -dottPrice, horse.name+' 구매 ('+horse.grade+'등급)');
    horse.id = 'horse_' + Date.now() + '_' + rng(1000,9999);
    horse.status = 'available';
    horse.acquired = { method:'purchase', date:new Date().toISOString() };
    StableState.horses.push(horse);
    marketHorses.splice(index,1);
    StableState.marketHorses = [...marketHorses];
    saveGame(); updateAllUI();
    checkAchievements(false);
    showToast('✅ ' + horse.name + ' 구매 완료! -'+dottPrice+' DOTT','good');
  }
  function sellHorse(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId); if (!horse) return;
    if (horse.status !== 'available') { showToast('작업중인 말은 판매 불가','warn'); return; }
    const dottSell = Math.floor(horse.value * 0.7); // [Rate v2] 판매가 70% DOTT
    if (!confirm(horse.name + ' 을(를) ' + fmtDott(dottSell) + '에 판매? (말 가치의 70%)')) return;
    StableState.dottWallet = (StableState.dottWallet||0) + dottSell;
    addDottHistory('sell_horse', dottSell, horse.name+' 판매 +'+dottSell+' DOTT');
    StableState.horses = StableState.horses.filter(h=>h.id!==horseId);
    StableState.trainingSlots = StableState.trainingSlots.filter(s=>s.horseId!==horseId);
    StableState.medicalSlots  = StableState.medicalSlots.filter(s=>s.horseId!==horseId);
    StableState.breedingSlots = StableState.breedingSlots.filter(s=>s.horseAId!==horseId&&s.horseBId!==horseId);
    if (StableState.raceEntryHorseId===horseId) StableState.raceEntryHorseId=null;
    saveGame(); closeModal('horseDetailModal'); updateAllUI();
    showToast('💰 ' + horse.name + ' 판매! +' + fmtDott(dottSell),'good'); // [DOT Fix]
  }

  /* ---- Training ---- */
  function startTraining(horseId, stat) {
    const horse = StableState.horses.find(h=>h.id===horseId); if (!horse) return;
    if (horse.status !== 'available') { showToast('다른 작업 중','warn'); return; }
    if (horse.fitness < 30) { showToast('컨디션 30% 이상 필요!','warn'); return; }
    const maxSlots = StableState.facilities.training;
    if (StableState.trainingSlots.length >= maxSlots) { showToast('훈련 슬롯 부족! 훈련장 업그레이드 필요','warn'); return; }
    const now = Date.now();
    const dur = TRAINING_COOLDOWN_MS * (1-(StableState.facilities.training-1)*0.05);
    StableState.trainingSlots.push({ horseId, stat, startAt:now, finishAt:now+dur });
    horse.status  = 'training';
    horse.fitness = Math.max(0, horse.fitness - TRAINING_FATIGUE);
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🏋️ ' + horse.name + ' 훈련 시작! (' + statLabel(stat) + ')','good');
    startTrainingTimer(horseId);
  }
  function startTrainingTimer(horseId) {
    if (stableTimers['train_'+horseId]) clearTimeout(stableTimers['train_'+horseId]);
    const slot = StableState.trainingSlots.find(s=>s.horseId===horseId); if (!slot) return;
    const rem  = slot.finishAt - Date.now();
    if (rem <= 0) { finishTraining(horseId); return; }
    stableTimers['train_'+horseId] = setTimeout(()=>finishTraining(horseId), rem);
  }
  function finishTraining(horseId) {
    const slotIdx = StableState.trainingSlots.findIndex(s=>s.horseId===horseId); if (slotIdx===-1) return;
    const slot  = StableState.trainingSlots[slotIdx];
    const horse = StableState.horses.find(h=>h.id===horseId); if (!horse) return;
    const bonus = 1+(StableState.facilities.training-1)*0.1;
    const gain  = Math.round((TRAINING_STAT_GAIN.min+Math.random()*(TRAINING_STAT_GAIN.max-TRAINING_STAT_GAIN.min))*bonus);
    horse.stats[slot.stat] = Math.min(99, horse.stats[slot.stat]+gain);
    horse.trainCount = (horse.trainCount||0)+1;
    horse.status = 'available';
    StableState.trainingSlots.splice(slotIdx,1);
    saveGame(); updateAllUI();
    progressQuest('trains', 1);
    showToast('🎉 ' + horse.name + ' 훈련 완료! ' + statLabel(slot.stat) + ' +' + gain,'good');
  }

  /* ---- Medical ---- */
  function startMedical(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId); if (!horse) return;
    if (horse.status !== 'available') { showToast('다른 작업 중','warn'); return; }
    if (horse.fitness >= 100) { showToast('이미 최상 컨디션!','good'); return; }
    const maxSlots = StableState.facilities.medical;
    if (StableState.medicalSlots.length >= maxSlots) { showToast('의료실 슬롯 부족','warn'); return; }
    const now = Date.now();
    const dur = MEDICAL_COOLDOWN_MS*(1-(StableState.facilities.medical-1)*0.05);
    StableState.medicalSlots.push({ horseId, startAt:now, finishAt:now+dur });
    horse.status = 'medical';
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🏥 ' + horse.name + ' 치료 시작!','good');
    startMedicalTimer(horseId);
  }
  function startMedicalTimer(horseId) {
    if (stableTimers['medical_'+horseId]) clearTimeout(stableTimers['medical_'+horseId]);
    const slot = StableState.medicalSlots.find(s=>s.horseId===horseId); if (!slot) return;
    const rem  = slot.finishAt - Date.now();
    if (rem<=0) { finishMedical(horseId); return; }
    stableTimers['medical_'+horseId] = setTimeout(()=>finishMedical(horseId), rem);
  }
  function finishMedical(horseId) {
    const slotIdx = StableState.medicalSlots.findIndex(s=>s.horseId===horseId); if(slotIdx===-1) return;
    const horse = StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    const bonus = 1+(StableState.facilities.medical-1)*0.1;
    horse.fitness = Math.min(100, horse.fitness+Math.round(MEDICAL_RECOVER*bonus));
    horse.status  = 'available';
    StableState.medicalSlots.splice(slotIdx,1);
    saveGame(); updateAllUI();
    progressQuest('heal', 1);
    if (horse.fitness >= 80) progressQuest('fitness', horse.fitness);
    showToast('💊 ' + horse.name + ' 치료 완료! 컨디션 ' + horse.fitness + '%','good');
  }

  /* ---- Breeding ---- */
  function openBreedingUI() {
    if (StableState.facilities.breeding < 1) { showToast('번식장이 없습니다! 건설 필요','warn'); return; }
    renderBreedingModal(); openModal('breedingModal');
  }
  function renderBreedingModal() {
    const avail   = StableState.horses.filter(h=>h.status==='available');
    const males   = avail.filter(h=>h.gender==='male');
    const females = avail.filter(h=>h.gender==='female');
    const opt = function(h) {
      return '<option value="'+h.id+'">'+h.name+' ['+h.grade+'] ⚡'+h.stats.speed+' 💨'+h.stats.stamina+' 🔥'+h.stats.burst+(h.wins?(' '+h.wins+'승'):'')+'</option>';
    };
    const mc = document.getElementById('breedingModalContent'); if(!mc) return;
    const dotCost  = breedCost();
    const dottCost = breedCostDott();
    const hasDott  = (StableState.dottWallet||0) >= dottCost;
    const lvl      = StableState.facilities.breeding;

    // 특수 이벤트 확률 표시
    const eventRows = [
      ['🌟 천재 혈통','부모 모두 SS↑','5%','스탯 +10%'],
      ['🥇 황금 유전자','합산 우승 20↑','8%','등급 +1'],
      ['🧬 열성 유전','등급 차이 3단계↑','15%','스탯 +20%'],
      ['💥 돌연변이','무작위','3%','SSS 출현']
    ];
    const eventHtml = eventRows.map(function(r){
      return '<tr><td style="padding:4px 6px;color:#c8d0ff;">'+r[0]+'</td><td style="padding:4px 6px;color:#7f8fb5;font-size:11px;">'+r[1]+'</td><td style="padding:4px 6px;color:#f5c842;font-weight:700;">'+r[2]+'</td><td style="padding:4px 6px;color:#3dd68c;font-size:11px;">'+r[3]+'</td></tr>';
    }).join('');

    mc.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        // 부모 선택
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div>' +
            '<label style="font-size:12px;color:#7f8fb5;font-weight:700;">🔵 수말</label>' +
            '<select id="breedSelectMale" onchange="updateBreedPreview()" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid #1a2540;background:#0f1422;color:#dde4f5;font-size:12px;">' +
              '<option value="">-- 수말 선택 --</option>'+males.map(opt).join('') +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:12px;color:#7f8fb5;font-weight:700;">🔴 암말</label>' +
            '<select id="breedSelectFemale" onchange="updateBreedPreview()" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid #1a2540;background:#0f1422;color:#dde4f5;font-size:12px;">' +
              '<option value="">-- 암말 선택 --</option>'+females.map(opt).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        // 자식 스탯 예상 미리보기
        '<div id="breedPreview" style="background:#0b0f1c;border:1px solid #1a2540;border-radius:10px;padding:12px;font-size:12px;color:#7f8fb5;text-align:center;">← 부모를 선택하면 예상 스탯 범위가 표시됩니다</div>' +
        // 특수 이벤트
        '<div style="background:#0b0f1c;border:1px solid rgba(155,126,248,.2);border-radius:10px;padding:10px;">' +
          '<div style="font-size:12px;font-weight:700;color:#9b7ef8;margin-bottom:6px;">✨ 특수 유전 이벤트</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>'+eventHtml+'</tbody></table>' +
        '</div>' +
        // 비용 & 번식장 정보
        '<div style="background:#0b0f1c;border:1px solid #1a2540;border-radius:10px;padding:12px;font-size:12.5px;color:#7f8fb5;line-height:2;">' +
          '🏗️ 번식장 레벨: <strong style="color:#4f8ef7;">Lv.'+lvl+'</strong><br>' +
          '💰 비용 (DOTT 우선): ' +
            '<strong style="color:#ff9f43;">'+dottCost+' DOTT</strong>' +
            ' <span style="font-size:11px;">(없으면 </span>' +
            '' + // [DOT Fix] DOT 가격 표시 제거
            '<span style="font-size:11px;"> DOT)</span><br>' +
          '🕐 번식 시간: <strong style="color:#4f8ef7;">약 30분</strong>' +
        '</div>' +
        // 버튼
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="confirmBreeding()" style="flex:1;background:#9b7ef8;color:#fff;border:0;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">💕 번식 시작</button>' +
          '<button onclick="closeModal(\'breedingModal\')" style="flex:1;background:transparent;border:1px solid #1a2540;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;color:#7f8fb5;">취소</button>' +
        '</div>' +
      '</div>';
  }
  // [v5.3 Phase3] 번식 미리보기 — 부모 선택 시 자식 예상 스탯 범위
  window.updateBreedPreview = function() {
    const maleId   = document.getElementById('breedSelectMale')?.value;
    const femaleId = document.getElementById('breedSelectFemale')?.value;
    const previewEl = document.getElementById('breedPreview'); if(!previewEl) return;
    if (!maleId || !femaleId) {
      previewEl.innerHTML = '<span style="color:#5a6a90;">← 부모를 선택하면 예상 스탯 범위가 표시됩니다</span>';
      return;
    }
    const horseA = StableState.horses.find(h=>h.id===maleId);
    const horseB = StableState.horses.find(h=>h.id===femaleId);
    if (!horseA || !horseB) return;

    // 예상 등급
    const resultGrade = determineBreedGrade(horseA.grade, horseB.grade);
    // 예상 스탯 범위 (85%~115% × 배율)
    const preview = function(a, b) {
      const avg = (a+b)/2;
      return { min: Math.round(avg*0.85), max: Math.round(avg*1.15) };
    };
    const sp = preview(horseA.stats.speed,   horseB.stats.speed);
    const st = preview(horseA.stats.stamina, horseB.stats.stamina);
    const bu = preview(horseA.stats.burst,   horseB.stats.burst);

    // 특수 이벤트 가능성
    const bothHigh = ['SS','SSS'].includes(horseA.grade) && ['SS','SSS'].includes(horseB.grade);
    const totalWins = (horseA.wins||0)+(horseB.wins||0);
    const events = [];
    if (bothHigh)       events.push('<span style="color:#f5c842;">🌟 천재혈통 가능</span>');
    if (totalWins >= 20) events.push('<span style="color:#3dd68c;">🥇 황금유전자 가능</span>');

    const GRADE_COLORS_LOCAL = {C:'#8a9bb5',B:'#3dd68c',A:'#4f8ef7',S:'#9b7ef8',SS:'#f5c842',SSS:'#f26b6b'};
    const gc = GRADE_COLORS_LOCAL[resultGrade]||'#fff';

    previewEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<span style="font-size:12px;color:#7f8fb5;">예상 등급</span>' +
        '<span style="font-weight:900;color:'+gc+';font-size:15px;">'+resultGrade+'</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">' +
        '<div style="background:#060c18;border-radius:6px;padding:6px;text-align:center;">' +
          '<div style="font-size:10px;color:#7f8fb5;">⚡ 속도</div>' +
          '<div style="font-size:12px;font-weight:700;color:#4f8ef7;">'+sp.min+'~'+sp.max+'</div>' +
        '</div>' +
        '<div style="background:#060c18;border-radius:6px;padding:6px;text-align:center;">' +
          '<div style="font-size:10px;color:#7f8fb5;">💨 지구력</div>' +
          '<div style="font-size:12px;font-weight:700;color:#3dd68c;">'+st.min+'~'+st.max+'</div>' +
        '</div>' +
        '<div style="background:#060c18;border-radius:6px;padding:6px;text-align:center;">' +
          '<div style="font-size:10px;color:#7f8fb5;">🔥 폭발력</div>' +
          '<div style="font-size:12px;font-weight:700;color:#f26b6b;">'+bu.min+'~'+bu.max+'</div>' +
        '</div>' +
      '</div>' +
      (events.length ? '<div style="font-size:11px;text-align:center;">'+events.join(' &nbsp; ')+'</div>' : '');
  };

  function breedCost() { return Math.floor(BREED_BASE_COST*(1-(StableState.facilities.breeding-1)*0.05)); }
  // [v5.3 Phase3] DOTT 번식 비용: 번식장 Lv1=200, 할인율 5%/레벨
  function breedCostDott() { return Math.max(50000, Math.floor(200000*(1-(StableState.facilities.breeding-1)*0.05))); } // [Rate v2]
  function confirmBreeding() {
    const maleId   = document.getElementById('breedSelectMale')?.value;
    const femaleId = document.getElementById('breedSelectFemale')?.value;
    if (!maleId||!femaleId) { showToast('수말과 암말 모두 선택하세요','warn'); return; }
    if (maleId===femaleId)  { showToast('같은 말끼리 번식 불가','warn'); return; }
    if (StableState.breedingSlots.length >= StableState.facilities.breeding) { showToast('번식 슬롯 부족','warn'); return; }
    const horseA = StableState.horses.find(h=>h.id===maleId);
    const horseB = StableState.horses.find(h=>h.id===femaleId);
    if (!horseA||!horseB) return;
    // [v5.3 DOT Fix] DOTT 단독 결제 — DOT 폴백 제거
    const dottCost = breedCostDott();
    if ((StableState.dottWallet||0) < dottCost) {
      showToast('DOTT 부족! 번식 비용: '+dottCost+' DOTT (보유: '+fmtDott(StableState.dottWallet||0)+')','warn'); return;
    }
    StableState.dottWallet -= dottCost;
    addDottHistory('breed_cost', -dottCost, '번식 비용: '+horseA.name+' × '+horseB.name);
    horseA.status='breeding'; horseB.status='breeding';

    // [v5.3 Phase3] 유전 알고리즘으로 등급 결정
    const resultGrade = determineBreedGrade(horseA.grade, horseB.grade);
    // 특수 이벤트 미리 결정해 slot에 저장
    const previewResult = breedOffspring(horseA, horseB, resultGrade);

    const now = Date.now(); const dur = 30*60*1000;
    const slot = {
      horseAId:maleId, horseBId:femaleId, startAt:now, finishAt:now+dur,
      resultGrade: previewResult.grade,   // 특수이벤트 반영 등급
      eventMsg: previewResult.eventMsg    // 이벤트 메시지 (완료 시 표시)
    };
    StableState.breedingSlots.push(slot);
    saveGame(); closeModal('breedingModal'); updateAllUI();
    const costStr = dottCost+' DOTT'; // [DOT Fix] DOTT 단독
    showToast('💕 번식 시작! '+horseA.name+' × '+horseB.name+' → 30분 후 결과','good');
    if (previewResult.eventMsg) setTimeout(()=>showToast('✨ '+previewResult.eventMsg,'good'), 800);
    progressQuest('breed', 1);
    startBreedingTimer(slot);
  }
  // ── [v5.3 Phase3] 유전 알고리즘 강화 ────────────────────────
  // 부모 스탯 유전 + 특수 이벤트 4종
  function breedOffspring(horseA, horseB, resultGrade) {
    const GRADE_ORDER = ['C','B','A','S','SS','SSS'];
    let finalGrade = resultGrade;
    let statMultiplier = 1.0;
    let eventMsg = null;

    // ① 천재 혈통: 부모 모두 SS↑, 5% 확률 → 스탯 +10%
    const bothHigh = ['SS','SSS'].includes(horseA.grade) && ['SS','SSS'].includes(horseB.grade);
    if (bothHigh && Math.random() < 0.05) {
      statMultiplier = 1.10;
      eventMsg = '🌟 천재 혈통 발현! 스탯 +10%';
    }
    // ② 황금 유전자: 합산 우승 20↑, 8% 확률 → 등급 +1
    else if ((horseA.wins||0)+(horseB.wins||0) >= 20 && Math.random() < 0.08) {
      const idx = GRADE_ORDER.indexOf(finalGrade);
      if (idx < GRADE_ORDER.length-1) finalGrade = GRADE_ORDER[idx+1];
      eventMsg = '🥇 황금 유전자! 등급 ' + resultGrade + ' → ' + finalGrade + '!';
    }
    // ③ 열성 유전: 등급 차이 3단계↑, 15% 확률 → 낮은 부모 등급 +20% 스탯
    else {
      const gapA = GRADE_ORDER.indexOf(horseA.grade);
      const gapB = GRADE_ORDER.indexOf(horseB.grade);
      if (Math.abs(gapA - gapB) >= 3 && Math.random() < 0.15) {
        statMultiplier = 1.20;
        eventMsg = '🧬 열성 유전! 낮은 부모 스탯 발현 +20%';
      }
    }
    // ④ 변이: 3% 확률 → SSS 출현 (위 이벤트 없을 때만)
    if (!eventMsg && Math.random() < 0.03) {
      finalGrade = 'SSS';
      statMultiplier = 1.05;
      eventMsg = '💥 돌연변이 발생! SSS 출현!';
    }

    // 스탯 유전: 부모 평균 × 랜덤(0.85~1.15) × 특수배율
    const gradeBase = HORSE_GRADES[finalGrade].stats[0];
    function genStat(a, b) {
      const avg = (a + b) / 2;
      const rand = 0.85 + Math.random() * 0.30; // 0.85~1.15
      return Math.round(Math.min(99, Math.max(gradeBase, avg * rand * statMultiplier)));
    }
    const childStats = {
      speed:   genStat(horseA.stats.speed,   horseB.stats.speed),
      stamina: genStat(horseA.stats.stamina, horseB.stats.stamina),
      burst:   genStat(horseA.stats.burst,   horseB.stats.burst)
    };

    // 유망주↑ 부모의 자식 스탯 보너스 (+1 per 유망주 이상)
    const honorBonus = (h) => (h.wins||0)>=5 ? 1 : 0;
    const bonus = honorBonus(horseA) + honorBonus(horseB);
    if (bonus > 0) {
      childStats.speed   = Math.min(99, childStats.speed   + bonus);
      childStats.stamina = Math.min(99, childStats.stamina + bonus);
      childStats.burst   = Math.min(99, childStats.burst   + bonus);
    }

    return { grade: finalGrade, stats: childStats, eventMsg };
  }

  function determineBreedGrade(gradeA, gradeB) {
    const grades=['C','B','A','S','SS','SSS'];
    const iA=grades.indexOf(gradeA), iB=grades.indexOf(gradeB);
    const keyA=iA<=iB?gradeA:gradeB, keyB=iA<=iB?gradeB:gradeA;
    const table = BREED_OUTCOME[keyA+'+'+keyB] || {C:60,B:30,A:10};
    const facilityBonus = StableState.facilities.breeding-1;
    const shifted = applyFacilityBonus(table, facilityBonus);
    let rand=Math.random()*100;
    for (const [grade,prob] of Object.entries(shifted)) { rand-=prob; if(rand<=0) return grade; }
    return Object.keys(shifted)[0];
  }
  function applyFacilityBonus(table, bonusLevels) {
    const shift=bonusLevels*2; const entries=Object.entries(table);
    if (entries.length<2||shift===0) return table;
    const result={...table};
    const low=entries[0][0]; const high=entries[entries.length-1][0];
    const taken=Math.min(result[low],shift);
    result[low]-=taken; result[high]+=taken;
    return result;
  }
  function startBreedingTimer(slot) {
    const key='breed_'+slot.horseAId+'_'+slot.horseBId;
    if(stableTimers[key]) clearTimeout(stableTimers[key]);
    const rem=slot.finishAt-Date.now();
    if(rem<=0){finishBreeding(slot);return;}
    stableTimers[key]=setTimeout(()=>finishBreeding(slot),rem);
  }
  function finishBreeding(slot) {
    const idx=StableState.breedingSlots.findIndex(s=>s.horseAId===slot.horseAId&&s.horseBId===slot.horseBId);
    if(idx===-1) return;
    const horseA=StableState.horses.find(h=>h.id===slot.horseAId);
    const horseB=StableState.horses.find(h=>h.id===slot.horseBId);
    if(horseA) horseA.status='available';
    if(horseB) horseB.status='available';
    if (StableState.horses.length >= getMaxHorses()) {
      showToast('마방이 꽉 차 자식 말을 받을 수 없음! 마방 업그레이드 필요','warn');
      StableState.breedingSlots.splice(idx,1); saveGame(); updateAllUI(); return;
    }
    // [v5.3 Phase3] 유전 알고리즘으로 자식 생성
    const geneticResult = (horseA && horseB)
      ? breedOffspring(horseA, horseB, slot.resultGrade)
      : { grade: slot.resultGrade, stats: null, eventMsg: slot.eventMsg };

    const offspring = createHorse(geneticResult.grade);
    offspring.status  = 'available';
    offspring.acquired = {
      method:'breeding',
      parentA: horseA?.name||'?', parentB: horseB?.name||'?',
      parentAId: horseA?.id||null, parentBId: horseB?.id||null,
      date: new Date().toISOString()
    };
    // 유전 스탯 적용 (알고리즘 결과 우선)
    if (geneticResult.stats) {
      offspring.stats.speed   = geneticResult.stats.speed;
      offspring.stats.stamina = geneticResult.stats.stamina;
      offspring.stats.burst   = geneticResult.stats.burst;
    }
    // 계보(족보) 기록
    offspring.ancestry = {
      fatherId: horseA?.id   || null, fatherName: horseA?.name  || '?',
      fatherGrade: horseA?.grade || '?',
      motherId: horseB?.id   || null, motherName: horseB?.name  || '?',
      motherGrade: horseB?.grade || '?'
    };

    StableState.horses.push(offspring);
    StableState.breedingSlots.splice(idx,1);
    saveGame(); updateAllUI();

    // 완료 알림 + 특수 이벤트 메시지
    const evMsg = geneticResult.eventMsg || slot.eventMsg;
    showToast('🐣 번식 완료! '+offspring.name+' ['+offspring.grade+'등급] 탄생!','good');
    if (evMsg) setTimeout(()=>showToast('✨ '+evMsg,'good'), 600);
    setTimeout(()=>checkAchievements(false), 400); // [P5] 번식 업적 체크
  }

  /* ---- Facilities ---- */
  // [v5.3 DOT Fix] 시설 업그레이드 비용을 DOTT 단위로 반환
  function upgradeCostDott(type) {
    const level = StableState.facilities[type] || 0;
    const baseDot = window.GAME_CONFIG?.STABLE_UPGRADE_BASE ?? { barn:50000, training:70000, medical:60000, breeding:150000 };
    const baseDott = { barn:50000, training:70000, medical:60000, breeding:150000 }; // [Rate v2] DOT 수치 = DOTT 수치
    const base = baseDott[type] || (baseDot[type]||50000); // [Rate v2] 수치 동일
    return Math.ceil(base * Math.pow(window.GAME_CONFIG?.STABLE_UPGRADE_RATE ?? 1.8, level));
  }
  function upgradeCost(type) { // 하위호환성 유지 (DOT 단위 — 내부 참조용)
    const level = StableState.facilities[type] || 0;
    const bases = window.GAME_CONFIG?.STABLE_UPGRADE_BASE ?? { barn:50000, training:70000, medical:60000, breeding:150000 };
    return Math.floor((bases[type]||50000) * Math.pow(window.GAME_CONFIG?.STABLE_UPGRADE_RATE ?? 1.8, level));
  }
  function upgradeFacility(type) {
    const meta = FACILITY_META[type]; const level = StableState.facilities[type] || 0;
    if (level >= meta.maxLevel) { showToast('최대 레벨!','warn'); return; }
    const dottCost = upgradeCostDott(type);
    if ((StableState.dottWallet||0) < dottCost) {
      showToast('DOTT 부족! '+meta.name+' 업그레이드: '+dottCost+' DOTT (보유: '+fmtDott(StableState.dottWallet||0)+')','warn'); return;
    }
    if (!confirm(meta.name+' Lv.'+level+' → Lv.'+(level+1)+'\n비용: '+fmtDott(dottCost))) return;
    StableState.dottWallet -= dottCost;
    addDottHistory('facility', -dottCost, meta.name+' Lv.'+(level+1)+' 업그레이드');
    StableState.facilities[type] = level + 1;
    saveGame(); updateAllUI();
    showToast('⬆️ '+meta.name+' Lv.'+(level+1)+' 완료! -'+dottCost+' DOTT','good');
    setTimeout(()=>checkAchievements(false), 200); // [P5] 시설 업적 체크
  }

  /* ---- Race Entry ---- */
  function setRaceEntry(horseId) {
    const horse=StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    if(horse.status!=='available'){showToast('출전 가능한 말만 등록 가능','warn');return;}
    if(horse.fitness<30){showToast('피로도 부족! 치료 후 출전 가능 (현재 '+horse.fitness+'%)','warn');return;}
    if(StableState.raceEntryHorseId){
      const prev=StableState.horses.find(h=>h.id===StableState.raceEntryHorseId);
      if(prev&&prev.status==='racing') prev.status='available';
    }
    StableState.raceEntryHorseId=horseId; horse.status='racing';

    // [v5.3 Phase1] 버프율 계산: 0.2%~0.5% (speed 30→100 기준)
    const buffRate = 0.002 + (horse.stats.speed / 100) * 0.003;
    const buffDisplay = (buffRate * 100).toFixed(3) + '%';

    window.stableRaceHorse={
      id:horse.id, name:horse.name, grade:horse.grade,
      stats:{...horse.stats}, fitness:horse.fitness,
      buffRate,        // 0.002~0.005
      buffDisplay,     // UI 표시용 "0.XXX%"
      honorTitle: horse.honorTitle || '⭐ 신인'
    };
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🏁 '+horse.name+' 출전 등록! 버프 +'+buffDisplay,'good');
  }

  function clearRaceEntry() {
    if(!StableState.raceEntryHorseId) return;
    const horse=StableState.horses.find(h=>h.id===StableState.raceEntryHorseId);
    if(horse&&horse.status==='racing') horse.status='available';
    StableState.raceEntryHorseId=null; window.stableRaceHorse=null;
    saveGame(); updateAllUI();
    showToast('출전 등록 취소됨','warn');
  }

  // [v5.3 Phase1] 경주 결과 처리 — 전적·피로도·칭호 자동 갱신
  window.stableOnRaceResult=function(horseId, won, prizeAmount){
    progressQuest('races', 1); // [v5.3 P5] 경주 출전 퀘스트
    setTimeout(()=>checkAchievements(false), 500); // [P5] 경주 업적 체크
    const horse=StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    horse.races = (horse.races||0) + 1;
    horse.fitness = Math.max(0, (horse.fitness||100) - 20);

    if(won){
      horse.wins = (horse.wins||0) + 1;
      // 우승 프리미엄 가치 (wins × 3%, 최대 150%)
      horse.winPremium = Math.round(Math.min(horse.wins * 0.03, 1.5) * 10000) / 10000;
      horse.value = Math.floor((horse.baseValue||horse.value||50000) * (1 + horse.winPremium));
      // 명예 칭호 갱신
      horse.honorTitle = calcHonorTitle(horse.wins);
      // [v5.3 Phase2] DOTT 우승 적립: 상금 1% ÷ 1000
      if(prizeAmount && prizeAmount > 0){
        const dottReward = Math.floor(prizeAmount * 0.01); // [Rate v2] 상금 1% = DOTT
        if(dottReward > 0){
          StableState.dottWallet = (StableState.dottWallet||0) + dottReward;
          horse.dottEarned = (horse.dottEarned||0) + dottReward;
          addDottHistory('race_win', dottReward, horse.name+' 우승! '+fmtDot(prizeAmount)+' DOT 상금의 1%');
          showToast('🏆 '+horse.name+' 우승! +'+dottReward+' DOTT 획득!','good');
        } else {
          progressQuest('wins', 1);
      showToast('🏆 '+horse.name+' 우승! '+horse.honorTitle,'good');
        }
      } else {
        showToast('🏆 '+horse.name+' 우승! '+horse.honorTitle,'good');
      }
    }

    horse.status='available';
    StableState.raceEntryHorseId=null;
    window.stableRaceHorse=null;
    saveGame(); updateAllUI();
  };

  // 명예 칭호 계산
  function calcHonorTitle(wins){
    if(wins>=50) return '🌟 불멸의 영웅';
    if(wins>=30) return '👑 레전드';
    if(wins>=20) return '🏆 챔피언';
    if(wins>=10) return '⭐⭐⭐ 강자';
    if(wins>=5)  return '⭐⭐ 유망주';
    return '⭐ 신인';
  }

  // ── [v5.3 Phase2] DOTT 내역 기록
  function addDottHistory(type, amount, desc){
    StableState.dottHistory.unshift({ type, amount, desc, ts: Date.now() });
    if(StableState.dottHistory.length > 50) StableState.dottHistory.pop();
  }

  // DOTT 잔액 포맷
  function fmtDott(n){ return (n||0).toLocaleString() + ' DOTT'; }

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] 일일 퀘스트 시스템
  // ══════════════════════════════════════════════════════════
  const QUEST_POOL = [
    { id:'q_race1',   title:'첫 출전',     desc:'말을 경주에 1회 출전시키기',   req:{type:'races',  n:1},  reward:{dott:50000,  dot:0} },
    { id:'q_race3',   title:'레이스 삼연전',desc:'말을 경주에 3회 출전시키기',   req:{type:'races',  n:3},  reward:{dott:150000, dot:0} },
    { id:'q_win1',    title:'첫 우승',      desc:'경주에서 1번 우승하기',         req:{type:'wins',   n:1},  reward:{dott:100000, dot:50000} },
    { id:'q_win3',    title:'3연승 도전',   desc:'경주에서 3번 우승하기',         req:{type:'wins',   n:3},  reward:{dott:300000, dot:100000} },
    { id:'q_train2',  title:'훈련 열정',    desc:'말을 2회 훈련시키기',           req:{type:'trains', n:2},  reward:{dott:80000,  dot:0} },
    { id:'q_breed1',  title:'번식 시작',    desc:'번식을 1회 시작하기',           req:{type:'breed',  n:1},  reward:{dott:200000, dot:0} },
    { id:'q_heal1',   title:'건강 관리',    desc:'말을 1회 치료하기',             req:{type:'heal',   n:1},  reward:{dott:60000,  dot:0} },
    { id:'q_market1', title:'시장 구경',    desc:'말 시장을 새로고침하기',        req:{type:'market', n:1},  reward:{dott:30000,  dot:0} },
    { id:'q_enhance1',title:'강화 도전',    desc:'말을 1회 강화하기',             req:{type:'enhance',n:1},  reward:{dott:150000, dot:0} },
    { id:'q_fitness', title:'컨디션 회복',  desc:'말 컨디션을 80% 이상으로 만들기',req:{type:'fitness',n:80}, reward:{dott:100000, dot:0} },
  ];

  function initDailyQuests() {
    const now = Date.now();
    const dayStart = new Date(); dayStart.setHours(0,0,0,0);
    if (StableState.questLastReset >= dayStart.getTime()) return; // 오늘 이미 초기화
    // 매일 3개 랜덤 퀘스트 선택
    const shuffled = [...QUEST_POOL].sort(()=>Math.random()-0.5);
    StableState.dailyQuests = shuffled.slice(0,3).map(q=>({
      ...q, progress:0, completed:false, claimed:false
    }));
    StableState.questLastReset = dayStart.getTime();
    saveGame();
  }

  function progressQuest(type, amount) {
    if (!StableState.dailyQuests?.length) return;
    let updated = false;
    StableState.dailyQuests.forEach(q=>{
      if (q.completed || q.req.type !== type) return;
      q.progress = (q.progress||0) + (amount||1);
      if (q.progress >= q.req.n) {
        q.progress = q.req.n;
        q.completed = true;
        updated = true;
        showToast('✅ 퀘스트 완료: '+q.title+'! 보상 수령 가능','good');
      }
    });
    if (updated) { saveGame(); renderQuestTab(); }
  }
  window.progressQuest = progressQuest;

  function claimQuestReward(questId) {
    const q = StableState.dailyQuests?.find(q=>q.id===questId);
    if (!q || !q.completed || q.claimed) { showToast('수령 불가','warn'); return; }
    q.claimed = true;
    if (q.reward.dott > 0) {
      StableState.dottWallet = (StableState.dottWallet||0) + q.reward.dott;
      addDottHistory('quest', q.reward.dott, '퀘스트 보상: '+q.title);
    }
    if (q.reward.dot > 0) {
      setMainWallet(getMainWallet() + q.reward.dot); // [DOT Fix] 메인 지갑 적립
    }
    StableState.questCompleted = (StableState.questCompleted||0) + 1;
    showToast('🎁 '+q.title+' 보상! '+(q.reward.dott?'+'+q.reward.dott+' DOTT':'')+
              (q.reward.dot?' +'+fmtDot(q.reward.dot):''), 'good');
    saveGame(); updateAllUI();
  }
  window.claimQuestReward = claimQuestReward;

  function renderQuestTab() {
    const el = document.getElementById('stable-tab-quest'); if(!el) return;
    initDailyQuests();
    const quests = StableState.dailyQuests || [];
    const now = Date.now();
    const tomorrow = new Date(); tomorrow.setHours(24,0,0,0);
    const rem = Math.max(0, tomorrow.getTime()-now);
    const hh=String(Math.floor(rem/3600000)).padStart(2,'0');
    const mm=String(Math.floor((rem%3600000)/60000)).padStart(2,'0');

    var questHtml = quests.map(function(q){
      var pct = Math.min(100, Math.round((q.progress||0)/q.req.n*100));
      var statusBtn = '';
      if (q.claimed) {
        statusBtn = '<span style="font-size:11px;color:#3d4f72;padding:4px 10px;">✓ 수령완료</span>';
      } else if (q.completed) {
        statusBtn = '<button onclick="claimQuestReward(&#39;' + q.id + '&#39;)" style="padding:5px 12px;border-radius:6px;border:0;background:#f5c842;color:#000;font-size:11px;font-weight:700;cursor:pointer;">🎁 수령</button>';
      }
      var rwStr = (q.reward.dott?q.reward.dott+' DOTT':'')+(q.reward.dot&&q.reward.dott?' + ':'')+
                 (q.reward.dot?fmtDot(q.reward.dot):'');
      return '<div style="background:#0f1422;border:1px solid '+(q.completed?'rgba(245,200,66,.4)':'#1a2540')+
        ';border-radius:10px;padding:12px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<div><div style="font-size:13px;font-weight:700;color:#dde4f5;">'+q.title+'</div>' +
          '<div style="font-size:11px;color:#7f8fb5;">'+q.desc+'</div></div>' +
          statusBtn +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="flex:1;height:4px;background:#1a2540;border-radius:4px;overflow:hidden;">' +
            '<div style="width:'+pct+'%;height:100%;background:'+(q.completed?'#f5c842':'#4f8ef7')+';border-radius:4px;transition:width .5s;"></div>' +
          '</div>' +
          '<span style="font-size:10px;color:#5a6a90;white-space:nowrap;">'+(q.progress||0)+'/'+q.req.n+'</span>' +
        '</div>' +
        '<div style="font-size:10px;color:#ff9f43;margin-top:4px;">🎁 '+rwStr+'</div>' +
        '</div>';
    }).join('');

    el.innerHTML =
      '<div style="background:#0b0f1c;border:1px solid #1a2540;border-radius:10px;padding:12px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="font-size:13px;font-weight:700;color:#fff;">📋 일일 퀘스트</div>' +
          '<div style="font-size:11px;color:#5a6a90;">초기화: '+hh+'시간 '+mm+'분 후</div>' +
        '</div>' +
        '<div style="font-size:11px;color:#7f8fb5;margin-top:4px;">누적 완료: '+(StableState.questCompleted||0)+'개</div>' +
      '</div>' +
      questHtml +
      (quests.length===0?'<div style="text-align:center;padding:30px;color:#3d4f72;">퀘스트 로딩 중...</div>':'');
  }
  window.renderQuestTab = renderQuestTab;

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] 말 강화 시스템 (DOTT 소비)
  // ══════════════════════════════════════════════════════════
  const ENHANCE_COST_DOTT = 300000; // [Rate v2] 기본 강화 비용
  const ENHANCE_MAX_LEVEL = 10;    // 최대 강화 레벨

  function enhanceHorse(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId);
    if (!horse) return;
    if (horse.status !== 'available') { showToast('훈련/경주 중인 말은 강화 불가','warn'); return; }
    const level = horse.enhanceLevel || 0;
    if (level >= ENHANCE_MAX_LEVEL) { showToast('이미 최대 강화 레벨입니다','warn'); return; }
    const cost = Math.round(ENHANCE_COST_DOTT * Math.pow(1.5, level)); // 300→450→675→... [v5.3 통일: Math.round]
    if ((StableState.dottWallet||0) < cost) {
      showToast('DOTT 부족! 필요: '+cost+' DOTT (보유: '+fmtDott(StableState.dottWallet)+')','warn'); return;
    }
    if (!confirm('🔨 말 강화\n'+horse.name+' (현재 Lv.'+level+'→Lv.'+(level+1)+')\n비용: '+cost+' DOTT\n\n강화 성공 시 스탯 +3 (세 능력치 모두)\n진행하시겠습니까?')) return;

    StableState.dottWallet -= cost;
    addDottHistory('enhance', -cost, '말 강화: '+horse.name+' Lv.'+level+'→Lv.'+(level+1));

    // 강화 성공 (100% 성공률, 레벨별 상승폭)
    const statGain = 3;
    horse.stats.speed   = Math.min(99, horse.stats.speed   + statGain);
    horse.stats.stamina = Math.min(99, horse.stats.stamina + statGain);
    horse.stats.burst   = Math.min(99, horse.stats.burst   + statGain);
    horse.enhanceLevel  = level + 1;
    horse.value = Math.floor((horse.baseValue||horse.value||50000) * (1 + (horse.enhanceLevel * 0.1))); // 10%/레벨

    StableState.enhanceLog = StableState.enhanceLog || [];
    StableState.enhanceLog.unshift({ horseId, name:horse.name, from:level, to:level+1, cost, ts:Date.now() });
    if (StableState.enhanceLog.length > 20) StableState.enhanceLog.pop();

    progressQuest('enhance', 1);
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🔨 강화 성공! '+horse.name+' Lv.'+(level+1)+' 스탯 +'+statGain+' 전 항목','good');
    setTimeout(()=>checkAchievements(false), 200); // [P5] 강화 업적 체크
  }
  window.enhanceHorse = enhanceHorse;

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] 명예의 전당 + 목장 랭킹
  // ══════════════════════════════════════════════════════════
  function retireHorse(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId);
    if (!horse) return;
    if (!confirm('🏅 명예의 전당 은퇴\n'+horse.name+'\n('+horse.wins+'승/'+horse.races+'전, '+horse.grade+'등급)\n\n은퇴하면 목장에서 사라지며 명예의 전당에 영구 등록됩니다.\n계속하시겠습니까?')) return;
    StableState.hallOfFame = StableState.hallOfFame || [];
    StableState.hallOfFame.push({
      id: horse.id, name: horse.name, grade: horse.grade,
      wins: horse.wins||0, races: horse.races||0,
      honorTitle: horse.honorTitle||'⭐ 신인',
      value: horse.value||0, enhanceLevel: horse.enhanceLevel||0,
      ancestry: horse.ancestry||null,
      retiredAt: Date.now()
    });
    StableState.horses = StableState.horses.filter(h=>h.id!==horseId);
    if (StableState.raceEntryHorseId === horseId) {
      StableState.raceEntryHorseId = null; window.stableRaceHorse = null;
    }
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🏅 '+horse.name+' 명예의 전당 등록!','good');
    setTimeout(()=>checkAchievements(false), 200); // [P5] 명예 업적 체크
  }
  window.retireHorse = retireHorse;

  function renderHallOfFame() {
    const el = document.getElementById('stable-tab-fame'); if(!el) return;
    const hall = StableState.hallOfFame || [];
    const GRADE_COLORS_L = {C:'#8a9bb5',B:'#3dd68c',A:'#4f8ef7',S:'#9b7ef8',SS:'#f5c842',SSS:'#f26b6b'};
    var rows = hall.slice().sort((a,b)=>b.wins-a.wins).map(function(h,i){
      var dt = new Date(h.retiredAt).toLocaleDateString('ko-KR');
      var gc = GRADE_COLORS_L[h.grade]||'#fff';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #111827;">' +
        '<div style="font-size:18px;min-width:28px;text-align:center;">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅')+'</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:13px;font-weight:700;color:#dde4f5;">'+h.name+
            ' <span style="color:'+gc+';font-size:11px;">['+h.grade+']</span></div>' +
          '<div style="font-size:11px;color:#7f8fb5;">'+h.honorTitle+' | '+h.wins+'승/'+h.races+'전</div>' +
          (h.ancestry?'<div style="font-size:10px;color:#5a6a90;">부: '+h.ancestry.fatherName+' × 모: '+h.ancestry.motherName+'</div>':'') +
        '</div>' +
        '<div style="text-align:right;font-size:11px;color:#5a6a90;">'+dt+'</div>' +
      '</div>';
    }).join('');
    el.innerHTML =
      '<div style="background:#0b0f1c;border:1px solid rgba(245,200,66,.2);border-radius:10px;padding:12px;margin-bottom:12px;">' +
        '<div style="font-size:13px;font-weight:700;color:#f5c842;margin-bottom:4px;">🏆 명예의 전당</div>' +
        '<div style="font-size:11px;color:#7f8fb5;">은퇴한 말들의 영구 기록 ('+hall.length+'마리)</div>' +
      '</div>' +
      (rows ? '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;overflow:hidden;">'+rows+'</div>'
             : '<div style="text-align:center;padding:30px;color:#3d4f72;"><div style="font-size:36px;margin-bottom:10px;">🏅</div><div>은퇴한 말이 없습니다</div><div style="font-size:11px;margin-top:6px;">말 상세보기에서 은퇴 처리가 가능합니다</div></div>');
  }
  window.renderHallOfFame = renderHallOfFame;

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] 목장 점수 & 랭킹 시스템
  // 점수 = 우승합산 × 100 + 말 수 × 50 + 총 DOTT 획득 × 0.1 + 시설 레벨 합산 × 200 + 명예의 전당 입성 × 300
  // ══════════════════════════════════════════════════════════
  function calcStableScore() {
    const totalWins   = StableState.horses.reduce((s,h)=>s+(h.wins||0),0)
                      + (StableState.hallOfFame||[]).reduce((s,h)=>s+(h.wins||0),0);
    const horseCount  = StableState.horses.length;
    const totalDott   = StableState.dottHistory
                          ? StableState.dottHistory.filter(h=>h.amount>0).reduce((s,h)=>s+h.amount,0)
                          : 0;
    const facScore    = Object.values(StableState.facilities||{}).reduce((s,v)=>s+(v||0),0);
    const fameCount   = (StableState.hallOfFame||[]).length;
    const questScore  = (StableState.questCompleted||0) * 20;
    return Math.floor(
      totalWins * 100 +
      horseCount * 50 +
      totalDott * 0.1 +
      facScore * 200 +
      fameCount * 300 +
      questScore
    );
  }
  window.calcStableScore = calcStableScore;

  // 랭킹 탭 — 내 목장 점수 + 순위 항목별 분석
  function renderRanking() {
    const el = document.getElementById('stable-tab-rank'); if (!el) return;
    const score     = calcStableScore();
    const horses    = StableState.horses;
    const hall      = StableState.hallOfFame || [];
    const totalWins = horses.reduce((s,h)=>s+(h.wins||0),0) + hall.reduce((s,h)=>s+(h.wins||0),0);
    const facTotal  = Object.values(StableState.facilities||{}).reduce((s,v)=>s+(v||0),0);
    const fameCount = hall.length;
    const questDone = StableState.questCompleted || 0;
    const dottEarned = StableState.dottHistory
      ? StableState.dottHistory.filter(h=>h.amount>0).reduce((s,h)=>s+h.amount,0) : 0;

    // 등급 산정
    function getStableRank(s) {
      if (s >= 50000) return { name:'🌟 신화 목장',  color:'#FF00FF' };
      if (s >= 20000) return { name:'👑 전설 목장',  color:'#FFD700' };
      if (s >=  8000) return { name:'🏆 영웅 목장',  color:'#E67E22' };
      if (s >=  3000) return { name:'⭐ 성장 목장',  color:'#9B59B6' };
      if (s >=   800) return { name:'🌱 초급 목장',  color:'#3498DB' };
      return               { name:'🥚 신규 목장',  color:'#95A5A6' };
    }
    const rank = getStableRank(score);

    // 다음 등급까지
    const thresholds = [800,3000,8000,20000,50000];
    const nextT = thresholds.find(t => t > score);
    const nextStr = nextT
      ? '<div style="font-size:11px;color:#5a6a90;margin-top:4px;">다음 등급까지: ' + (nextT - score).toLocaleString() + ' 점</div>'
      : '<div style="font-size:11px;color:#f5c842;margin-top:4px;">✨ 최고 등급 달성!</div>';

    // 점수 구성 항목
    var items = [
      ['🏁 우승 합산',    totalWins + '회',    (totalWins*100).toLocaleString()],
      ['🐴 보유 말',      horses.length + '마리', (horses.length*50).toLocaleString()],
      ['🏗️ 시설 레벨',   facTotal + ' 레벨', (facTotal*200).toLocaleString()],
      ['🏅 명예의 전당',  fameCount + '마리',  (fameCount*300).toLocaleString()],
      ['🪙 DOTT 획득',   dottEarned.toLocaleString() + ' DOTT', Math.floor(dottEarned*0.1).toLocaleString()],
      ['📋 퀘스트 완료', questDone + '개',    (questDone*20).toLocaleString()],
    ];
    var itemHtml = items.map(function(r){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #111827;">' +
        '<div style="font-size:12px;color:#7f8fb5;">'+r[0]+' <span style="color:#dde4f5;">'+r[1]+'</span></div>' +
        '<div style="font-size:12px;font-weight:700;color:#ff9f43;">+'+r[2]+' pt</div>' +
      '</div>';
    }).join('');

    // 말 TOP3 (우승 기준)
    var top3 = horses.slice().sort((a,b)=>(b.wins||0)-(a.wins||0)).slice(0,3);
    var top3Html = top3.length === 0
      ? '<div style="text-align:center;color:#3d4f72;padding:12px;">보유 말 없음</div>'
      : top3.map(function(h,i){
          var GRADE_COLORS_L = {C:'#8a9bb5',B:'#3dd68c',A:'#4f8ef7',S:'#9b7ef8',SS:'#f5c842',SSS:'#f26b6b'};
          var medal = ['🥇','🥈','🥉'][i] || '🏅';
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;">' +
            '<div style="font-size:16px;">'+medal+'</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:12px;font-weight:700;color:#dde4f5;">'+h.name+
                ' <span style="color:'+(GRADE_COLORS_L[h.grade]||'#fff')+';font-size:10px;">['+h.grade+']</span></div>' +
              '<div style="font-size:10px;color:#7f8fb5;">'+(h.honorTitle||'⭐ 신인')+' | '+(h.wins||0)+'승/'+(h.races||0)+'전</div>' +
            '</div>' +
            '<div style="font-size:11px;color:#ff9f43;font-weight:700;">'+(h.enhanceLevel?'🔨Lv.'+h.enhanceLevel:'')+'</div>' +
          '</div>';
        }).join('');

    el.innerHTML =
      // 목장 등급 카드
      '<div style="background:linear-gradient(135deg,#0f1422,#1a1035);border:2px solid '+rank.color+'44;border-radius:14px;padding:18px;margin-bottom:14px;text-align:center;">' +
        '<div style="font-size:28px;font-weight:900;color:'+rank.color+';">'+rank.name+'</div>' +
        '<div style="font-size:32px;font-weight:900;color:#fff;margin:8px 0;">'+score.toLocaleString()+' <span style="font-size:14px;color:#7f8fb5;">점</span></div>' +
        nextStr +
      '</div>' +
      // 점수 구성
      '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:14px;margin-bottom:14px;">' +
        '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px;">📊 점수 구성</div>' +
        itemHtml +
      '</div>' +
      // 말 TOP3
      '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:14px;">' +
        '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;">🏆 내 말 TOP 3</div>' +
        top3Html +
      '</div>';
  }
  window.renderRanking = renderRanking;

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] 업적(Achievement) 시스템
  // ══════════════════════════════════════════════════════════
  const ACHIEVEMENT_LIST = [
    // 경주 업적
    { id:'ach_first_race',   cat:'경주', icon:'🏁', name:'첫 출전',       desc:'경주에 처음 출전하기',              check: s => (s.horses||[]).some(h=>(h.races||0)>=1) || (s.hallOfFame||[]).some(h=>(h.races||0)>=1),  reward:{dott:100000} },
    { id:'ach_first_win',    cat:'경주', icon:'🥇', name:'첫 우승',       desc:'경주에서 처음 우승하기',            check: s => (s.horses||[]).some(h=>(h.wins||0)>=1)  || (s.hallOfFame||[]).some(h=>(h.wins||0)>=1),   reward:{dott:200000} },
    { id:'ach_10wins',       cat:'경주', icon:'⭐',  name:'10승 달성',     desc:'한 말로 10승 달성하기',             check: s => (s.horses||[]).some(h=>(h.wins||0)>=10) || (s.hallOfFame||[]).some(h=>(h.wins||0)>=10),  reward:{dott:500000,dot:100000} },
    { id:'ach_30wins',       cat:'경주', icon:'👑',  name:'30승 레전드',   desc:'한 말로 30승 달성하기',             check: s => (s.horses||[]).some(h=>(h.wins||0)>=30) || (s.hallOfFame||[]).some(h=>(h.wins||0)>=30),  reward:{dott:1000000,dot:500000} },
    { id:'ach_50wins',       cat:'경주', icon:'🌟',  name:'50승 신화',     desc:'한 말로 50승 달성하기',             check: s => (s.horses||[]).some(h=>(h.wins||0)>=50) || (s.hallOfFame||[]).some(h=>(h.wins||0)>=50),  reward:{dott:3000000,dot:1000000} },
    // 목장 업적
    { id:'ach_5horses',      cat:'목장', icon:'🐴', name:'5마리 목장',    desc:'말 5마리 보유하기',                 check: s => (s.horses||[]).length >= 5,            reward:{dott:200000} },
    { id:'ach_breed1',       cat:'목장', icon:'🐣', name:'첫 번식',       desc:'번식을 1회 완료하기',               check: s => (s.horses||[]).some(h=>h.acquired?.method==='breeding'), reward:{dott:300000} },
    { id:'ach_sss_born',     cat:'목장', icon:'💫', name:'SSS 탄생',      desc:'SSS 등급 말 번식하기',              check: s => (s.horses||[]).concat(s.hallOfFame||[]).some(h=>h.grade==='SSS'&&h.acquired?.method==='breeding'), reward:{dott:2000000,dot:500000} },
    { id:'ach_enhance5',     cat:'목장', icon:'🔨', name:'강화 Lv5',      desc:'말을 Lv.5까지 강화하기',            check: s => (s.horses||[]).some(h=>(h.enhanceLevel||0)>=5), reward:{dott:500000} },
    { id:'ach_enhance10',    cat:'목장', icon:'⚡',  name:'최대 강화',     desc:'말을 Lv.10 최대 강화하기',          check: s => (s.horses||[]).some(h=>(h.enhanceLevel||0)>=10), reward:{dott:2000000,dot:300000} },
    // 명예 업적
    { id:'ach_retire1',      cat:'명예', icon:'🏅', name:'첫 은퇴',       desc:'말을 명예의 전당에 은퇴시키기',     check: s => (s.hallOfFame||[]).length >= 1,        reward:{dott:400000} },
    { id:'ach_retire5',      cat:'명예', icon:'🏆', name:'전당 5마리',    desc:'명예의 전당에 5마리 등록하기',      check: s => (s.hallOfFame||[]).length >= 5,        reward:{dott:1500000,dot:200000} },
    // 경제 업적
    { id:'ach_dott1000',     cat:'경제', icon:'🪙', name:'DOTT 1,000',   desc:'DOTT 1,000개 이상 보유하기',         check: s => (s.dottWallet||0) >= 1000,             reward:{dot:50000} },
    { id:'ach_dott10000',    cat:'경제', icon:'💎', name:'DOTT 10,000',  desc:'DOTT 10,000개 이상 보유하기',        check: s => (s.dottWallet||0) >= 10000,            reward:{dot:500000} },
    { id:'ach_quest10',      cat:'경제', icon:'📋', name:'퀘스트 10회',  desc:'퀘스트를 10개 완료하기',             check: s => (s.questCompleted||0) >= 10,           reward:{dott:300000} },
    { id:'ach_quest30',      cat:'경제', icon:'📜', name:'퀘스트 달인',  desc:'퀘스트를 30개 완료하기',             check: s => (s.questCompleted||0) >= 30,           reward:{dott:1000000,dot:100000} },
    // 시설 업적
    { id:'ach_allLv3',       cat:'시설', icon:'🏗️', name:'시설 Lv3',     desc:'모든 시설을 Lv.3 이상으로 올리기',  check: s => Object.values(s.facilities||{}).every(v=>(v||0)>=3), reward:{dott:600000} },
    { id:'ach_allLv5',       cat:'시설', icon:'🏰', name:'최강 목장',    desc:'모든 시설을 Lv.5 이상으로 올리기',   check: s => Object.values(s.facilities||{}).every(v=>(v||0)>=5), reward:{dott:2000000,dot:1000000} },
    // 점수 업적
    { id:'ach_score3000',    cat:'목장', icon:'⭐',  name:'성장 목장',    desc:'목장 점수 3,000점 달성',             check: s => calcStableScore() >= 3000,             reward:{dott:500000} },
    { id:'ach_score20000',   cat:'목장', icon:'🌟',  name:'전설 목장',    desc:'목장 점수 20,000점 달성',            check: s => calcStableScore() >= 20000,            reward:{dott:3000000,dot:2000000} },
  ];

  function checkAchievements(silent) {
    const achieved = StableState.achievements || [];
    let newlyAchieved = [];

    ACHIEVEMENT_LIST.forEach(function(ach) {
      if (achieved.includes(ach.id)) return; // 이미 달성
      try {
        if (ach.check(StableState)) {
          achieved.push(ach.id);
          newlyAchieved.push(ach);
          // 보상 지급
          if (ach.reward.dott) {
            StableState.dottWallet = (StableState.dottWallet||0) + ach.reward.dott;
            addDottHistory('achievement', ach.reward.dott, '업적 달성: '+ach.name);
          }
          if (ach.reward.dot) {
            setMainWallet(getMainWallet() + ach.reward.dot); // [DOT Fix] 메인 지갑 적립
          }
          // 업적 로그 기록
          StableState.achieveLog = StableState.achieveLog || [];
          StableState.achieveLog.unshift({ id:ach.id, name:ach.name, icon:ach.icon, ts:Date.now() });
          if (StableState.achieveLog.length > 30) StableState.achieveLog.pop();
        }
      } catch(e) {}
    });

    StableState.achievements = achieved;
    if (newlyAchieved.length > 0) {
      saveGame();
      if (!silent) {
        newlyAchieved.forEach(function(ach) {
          setTimeout(function(){
            showToast('🏆 업적 달성! '+ach.icon+' '+ach.name+
              (ach.reward.dott?' +'+ach.reward.dott+' DOTT':'')+
              (ach.reward.dot?' +'+fmtDot(ach.reward.dot):''), 'good');
          }, 300);
        });
        updateAllUI();
      }
    }
    return newlyAchieved.length;
  }
  window.checkAchievements = checkAchievements;

  function renderAchievements() {
    const el = document.getElementById('stable-tab-achieve'); if (!el) return;
    const achieved = StableState.achievements || [];
    const total = ACHIEVEMENT_LIST.length;
    const done  = achieved.length;

    // 카테고리별 그룹
    var cats = {};
    ACHIEVEMENT_LIST.forEach(function(a) {
      if (!cats[a.cat]) cats[a.cat] = [];
      cats[a.cat].push(a);
    });

    var catHtml = Object.entries(cats).map(function([cat,list]){
      var catDone = list.filter(a=>achieved.includes(a.id)).length;
      var rows = list.map(function(a){
        var isDone = achieved.includes(a.id);
        var rwStr  = (a.reward.dott?'+'+a.reward.dott+' DOTT':'')+(a.reward.dot?(a.reward.dott?' ':'')+'+'+fmtDot(a.reward.dot):'');
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #0d1120;opacity:'+(isDone?'1':'0.45')+'">' +
          '<div style="font-size:20px;min-width:28px;text-align:center;">'+(isDone?a.icon:'🔒')+'</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:12px;font-weight:700;color:'+(isDone?'#dde4f5':'#5a6a90')+';">'+(isDone?a.name:'???')+'</div>' +
            '<div style="font-size:10px;color:#5a6a90;">'+(isDone?a.desc:'???')+'</div>' +
          '</div>' +
          '<div style="font-size:10px;color:'+(isDone?'#ff9f43':'#3d4f72')+';text-align:right;">'+
            (isDone?rwStr:'보상 미공개')+
          '</div>' +
        '</div>';
      }).join('');

      return '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;overflow:hidden;margin-bottom:10px;">' +
        '<div style="background:#060c18;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="font-size:12px;font-weight:700;color:#4f8ef7;">'+cat+'</div>' +
          '<div style="font-size:11px;color:#7f8fb5;">'+catDone+'/'+list.length+'</div>' +
        '</div>' +
        rows +
      '</div>';
    }).join('');

    // 최근 달성 로그
    var recentLog = (StableState.achieveLog||[]).slice(0,5).map(function(l){
      var dt = new Date(l.ts).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #0d1120;">' +
        '<span style="font-size:14px;">'+l.icon+'</span>' +
        '<span style="font-size:11px;color:#dde4f5;flex:1;">'+l.name+'</span>' +
        '<span style="font-size:10px;color:#5a6a90;">'+dt+'</span>' +
      '</div>';
    }).join('');

    el.innerHTML =
      // 진행도 헤더
      '<div style="background:#0b0f1c;border:1px solid rgba(255,159,67,.2);border-radius:10px;padding:14px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div style="font-size:13px;font-weight:700;color:#ff9f43;">🏆 업적 달성</div>' +
          '<div style="font-size:13px;font-weight:900;color:#fff;">'+done+' / '+total+'</div>' +
        '</div>' +
        '<div style="height:6px;background:#1a2540;border-radius:6px;overflow:hidden;">' +
          '<div style="width:'+Math.round(done/total*100)+'%;height:100%;background:linear-gradient(90deg,#ff9f43,#f5c842);border-radius:6px;transition:width .5s;"></div>' +
        '</div>' +
        '<div style="font-size:10px;color:#5a6a90;margin-top:4px;">'+Math.round(done/total*100)+'% 달성</div>' +
      '</div>' +
      // 최근 달성
      (recentLog
        ? '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:12px;margin-bottom:12px;">' +
            '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px;">⏱ 최근 달성</div>' +
            recentLog +
          '</div>'
        : '') +
      // 카테고리별 목록
      catHtml;
  }
  window.renderAchievements = renderAchievements;

  // ══════════════════════════════════════════════════════════
  // [v5.3 Phase5] NFT↔목장 이관 시스템
  // - 목장말 → NFT 민팅: DOTT 500 소비, 말 등급 기반 NFT 생성
  // - NFT → 목장 이관: NFT를 목장 말로 변환 (단방향 소모)
  // ══════════════════════════════════════════════════════════
  const HORSE_TO_NFT_RARITY = { C:'N', B:'R', A:'SR', S:'HR', SS:'LR', SSS:'MR' };
  const NFT_TO_HORSE_GRADE  = { N:'C', R:'B', SR:'A', HR:'S', LR:'SS', MR:'SSS' };
  const MINT_COST_DOTT = 500000; // [Rate v2] 목장말→NFT 민팅 비용

  // 목장말 → NFT 민팅
  function mintHorseAsNFT(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId);
    if (!horse) return;
    if (horse.status !== 'available') { showToast('사용 가능 상태의 말만 민팅 가능','warn'); return; }

    const cost = MINT_COST_DOTT;
    if ((StableState.dottWallet||0) < cost) {
      showToast('DOTT 부족! 필요: '+cost+' DOTT','warn'); return;
    }

    const nftRarity = HORSE_TO_NFT_RARITY[horse.grade] || 'N';
    const winPctStr = (horse.wins||0) > 0 ? ' | '+horse.wins+'승' : '';

    if (!confirm('🐴→🎴 NFT 민팅\n'+horse.name+' ['+horse.grade+'등급]\n→ NFT ['+nftRarity+'] 등급으로 변환\n\n비용: '+cost+' DOTT\n⚠️ 목장에서 사라지며 NFT로 변환됩니다.\n계속하시겠습니까?')) return;

    StableState.dottWallet -= cost;
    addDottHistory('mint', -cost, 'NFT 민팅: '+horse.name+' →['+nftRarity+']');

    // NFT 시스템에 새 NFT 추가
    if (window.nftSystem) {
      const rarity = window.NFT_RARITIES?.[nftRarity] || { key:nftRarity, name:nftRarity, buffRatio:0.05, minStat:20, maxStat:50, glowLevel:'none', bloodlineChance:0 };
      const newNFT = {
        id:        'nft_mint_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),
        name:      horse.name + ' (목장)',
        rarity:    rarity,
        gender:    horse.gender==='male' ? '수' : '암',
        color:     '#8B4513',
        bloodline: (horse.ancestry != null),
        ability:   null,
        glowLevel: rarity.glowLevel || 'none',
        stats:     { speed: horse.stats.speed||50, stamina: horse.stats.stamina||50, burst: horse.stats.burst||50 },
        wins:      horse.wins || 0,
        races:     horse.races || 0,
        enhanceLevel: horse.enhanceLevel || 0,
        exchangeCode: null, exchangeMeta: null,
        ownerId:   window.uid || 'local',
        createdAt: Date.now(),
        fromStable: true,
        stableGrade: horse.grade,
        honorTitle:  horse.honorTitle || '⭐ 신인'
      };
      window.nftSystem.myNFTs.push(newNFT);
      window.nftSystem.saveToLocalStorage();
    }

    // 목장에서 말 제거
    StableState.horses = StableState.horses.filter(h=>h.id!==horseId);
    if (StableState.raceEntryHorseId === horseId) {
      StableState.raceEntryHorseId = null; window.stableRaceHorse = null;
    }

    progressQuest('mint', 1);
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🎴 NFT 민팅 완료! '+horse.name+' ['+nftRarity+'] NFT 생성','good');
  }
  window.mintHorseAsNFT = mintHorseAsNFT;

  // NFT → 목장 이관 (전역 함수로 HTML에서 호출 가능)
  window.importNFTToStable = function(nftId) {
    if (!window.nftSystem) { showToast('NFT 시스템 준비 중','warn'); return; }
    const nft = window.nftSystem.myNFTs.find(n=>n.id===nftId);
    if (!nft) { showToast('NFT를 찾을 수 없습니다','warn'); return; }

    const maxH = getMaxHorses();
    if (StableState.horses.length >= maxH) {
      showToast('마방이 꽉 찼습니다! 마방을 업그레이드하세요','warn'); return;
    }

    const horseGrade = NFT_TO_HORSE_GRADE[nft.rarity?.key || 'N'] || 'C';
    if (!confirm('🎴→🐴 NFT→목장 이관\n'+nft.name+' ['+nft.rarity?.name+']\n→ 목장 말 ['+horseGrade+'등급] 변환\n\n⚠️ NFT가 소멸되고 목장 말로 이관됩니다.\n계속하시겠습니까?')) return;

    // 목장 말 생성
    const horse = createHorse(horseGrade);
    horse.name   = nft.name.replace(' (목장)','').replace(' (NFT)','');
    horse.gender = nft.gender === '수' ? 'male' : 'female';
    horse.stats  = { speed: nft.stats?.speed||50, stamina: nft.stats?.stamina||50, burst: nft.stats?.burst||50 };
    horse.wins   = nft.wins  || 0;
    horse.races  = nft.races || 0;
    horse.enhanceLevel = nft.enhanceLevel || 0;
    horse.acquired = { method:'nft_import', nftId, date:new Date().toISOString() };
    horse.honorTitle = nft.honorTitle || calcHonorTitle(horse.wins);
    horse.status = 'available';

    StableState.horses.push(horse);

    // NFT 소멸
    window.nftSystem.myNFTs = window.nftSystem.myNFTs.filter(n=>n.id!==nftId);
    window.nftSystem.saveToLocalStorage();

    saveGame(); updateAllUI();
    showToast('🐴 NFT 이관 완료! '+horse.name+' ['+horseGrade+'등급] 목장 입성','good');
    setTimeout(()=>checkAchievements(false), 300);
  };


  // ── [v5.3 Phase3] 은행 — DOT→DOTT 일방향 환전 (역환전 없음)
  function exchangeDotToDott(dotAmount){
    const amount = Math.floor(Number(dotAmount));
    if(!amount || amount < 1)         { showToast('최소 1 DOT 필요','warn'); return; } // [Rate v2]
    // [Rate v2] 1 DOT 단위 허용 — 단위 제한 없음
    if(getMainWallet() < amount)      { showToast('DOT 잔액 부족! (보유: '+fmtDot(getMainWallet())+')','warn'); return; }
    const dott = amount * 1000; // [Rate v2] 1 DOT = 1,000 DOTT
    setMainWallet(getMainWallet() - amount); // [DOT Fix] 메인 지갑 차감 + DOM/Firebase 동기화
    StableState.dottWallet  = (StableState.dottWallet||0) + dott;
    StableState.bankLastExchange = Date.now();
    addDottHistory('exchange', dott, 'DOT→DOTT 환전: '+fmtDot(amount)+' → '+dott+' DOTT');
    showToast('💱 환전 완료! +'+dott+' DOTT','good');
    saveGame(); updateAllUI(); renderBank();
  }
  window.exchangeDotToDott = exchangeDotToDott;

  // 은행 탭 렌더링
  function renderBank(){
    var c = document.getElementById('stable-tab-bank'); if(!c) return;
    var hist = (StableState.dottHistory||[]).slice(0,15);
    var histHtml = '';
    if(hist.length === 0){
      histHtml = '<div style="text-align:center;color:#3d4f72;padding:20px;">내역 없음</div>';
    } else {
      hist.forEach(function(h){
        var isPlus = h.amount > 0;
        var dt = new Date(h.ts).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
        var color = isPlus ? '#3dd68c' : '#f26b6b';
        var sign  = isPlus ? '+' : '';
        histHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #111827;font-size:12px;">' +
          '<div style="color:#7f8fb5;">' + dt + ' &nbsp;<span style="color:#c8d0ff;">' + h.desc + '</span></div>' +
          '<div style="font-weight:700;color:' + color + ';">' + sign + h.amount + ' DOTT</div>' +
          '</div>';
      });
    }
    c.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">' +
        '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:14px;text-align:center;">' +
          '<div style="font-size:11px;color:#7f8fb5;margin-bottom:4px;">💎 보유 DOT</div>' +
          '<div style="font-size:16px;font-weight:900;color:#4ecdc4;font-family:monospace;">' + fmtDot(getMainWallet()) + '</div>' + // [DOT Fix]
        '</div>' +
        '<div style="background:#0f1422;border:1px solid rgba(255,159,67,.3);border-radius:10px;padding:14px;text-align:center;">' +
          '<div style="font-size:11px;color:#7f8fb5;margin-bottom:4px;">🪙 보유 DOTT</div>' +
          '<div style="font-size:16px;font-weight:900;color:#ff9f43;font-family:monospace;">' + fmtDott(StableState.dottWallet) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:14px;margin-bottom:14px;">' +
        '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px;">💱 DOT → DOTT 환전</div>' +
        '<div style="font-size:11px;color:#7f8fb5;margin-bottom:8px;">환율: 1 DOT = 1,000 DOTT &nbsp;|&nbsp; DOTT→DOT 역환전 불가</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input id="bankDotInput" type="number" min="1" step="1" placeholder="DOT 입력"' +
          ' style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid #1a2540;background:#060c18;color:#dde4f5;font-size:13px;"' +
          ' oninput="var v=Math.floor(Number(this.value)*1000);var el=document.getElementById(\'bankPreview\');if(el)el.textContent=v>0?\'→ \'+v.toLocaleString()+\' DOTT\':\'\';"/>' +
          '<span id="bankPreview" style="min-width:80px;font-size:12px;color:#ff9f43;font-weight:700;"></span>' +
          '<button onclick="exchangeDotToDott(document.getElementById(\'bankDotInput\').value)"' +
          ' style="padding:9px 16px;border-radius:8px;border:0;background:#ff9f43;color:#000;font-size:13px;font-weight:700;cursor:pointer;">환전</button>' +
        '</div>' +
      '</div>' +
      '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:14px;">' +
        '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px;">📋 DOTT 내역 (최근 15건)</div>' +
        histHtml +
      '</div>';
  }
  window.renderBank = renderBank;

  // ── [v5.3 Phase3] 번식장 서브탭 렌더링 ──────────────────────
  function renderBreedingTab() {
    const ct = document.getElementById('breedingTabContent'); if(!ct) return;
    const lvl     = StableState.facilities.breeding;
    const dotCost = breedCost();
    const dottCost= breedCostDott();
    const hasDott = (StableState.dottWallet||0) >= dottCost; // [DOT Fix] DOTT만 체크
    const slots   = StableState.breedingSlots;
    const avail   = StableState.horses.filter(h=>h.status==='available');
    const males   = avail.filter(h=>h.gender==='male');
    const females = avail.filter(h=>h.gender==='female');

    if (lvl < 1) {
      ct.innerHTML =
        '<div style="text-align:center;padding:40px;color:#3d4f72;">' +
          '<div style="font-size:48px;margin-bottom:12px;">🏗️</div>' +
          '<div style="font-size:14px;margin-bottom:12px;">번식장이 없습니다</div>' +
          '<button onclick="switchStableTab(\'facility\')" style="background:#9b7ef8;color:#fff;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;">🏗️ 시설 탭에서 건설</button>' +
        '</div>';
      return;
    }

    // 진행 중 슬롯
    var slotsHtml = '';
    if (slots.length > 0) {
      slots.forEach(function(slot) {
        var ha = StableState.horses.find(function(h){return h.id===slot.horseAId;});
        var hb = StableState.horses.find(function(h){return h.id===slot.horseBId;});
        var rem = Math.max(0, slot.finishAt - Date.now());
        var mins = Math.floor(rem/60000), secs = Math.floor((rem%60000)/1000);
        var timeStr = rem <= 0 ? '완료 대기중' : mins+'분 '+secs+'초';
        var prog    = rem <= 0 ? 100 : Math.round((1-(rem/(30*60*1000)))*100);
        var GRADE_COLORS_L = {C:'#8a9bb5',B:'#3dd68c',A:'#4f8ef7',S:'#9b7ef8',SS:'#f5c842',SSS:'#f26b6b'};
        var gc = GRADE_COLORS_L[slot.resultGrade]||'#9b7ef8';
        slotsHtml +=
          '<div style="background:#0f1422;border:1px solid rgba(155,126,248,.3);border-radius:10px;padding:12px;margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span style="font-size:13px;font-weight:700;color:#9b7ef8;">💕 번식 진행중</span>' +
              '<span style="font-size:11px;color:#f5c842;">⏱ '+timeStr+'</span>' +
            '</div>' +
            '<div style="font-size:12px;color:#dde4f5;margin-bottom:8px;">' +
              (ha?ha.name:'?')+' × '+(hb?hb.name:'?') +
              ' → <span style="color:'+gc+';font-weight:700;">['+slot.resultGrade+' 예상]</span>' +
            '</div>' +
            '<div style="height:4px;background:#1a2540;border-radius:4px;overflow:hidden;">' +
              '<div style="width:'+prog+'%;height:100%;background:#9b7ef8;border-radius:4px;transition:width 1s;"></div>' +
            '</div>' +
            (slot.eventMsg ? '<div style="font-size:11px;color:#f5c842;margin-top:6px;">✨ '+slot.eventMsg+'</div>' : '') +
          '</div>';
      });
    } else {
      slotsHtml = '<div style="text-align:center;padding:16px;color:#3d4f72;font-size:12px;">진행중인 번식 없음</div>';
    }

    // 부모 선택 옵션
    var optHtml = function(arr) {
      return arr.map(function(h){
        return '<option value="'+h.id+'">'+h.name+' ['+h.grade+'] ⚡'+h.stats.speed+' 💨'+h.stats.stamina+(h.wins?' '+h.wins+'승':'')+'</option>';
      }).join('');
    };

    // 특수 이벤트 확률표
    var evRows = [
      ['🌟 천재 혈통','부모 모두 SS↑','5%','스탯 +10%'],
      ['🥇 황금 유전자','합산 우승 20↑','8%','등급 +1'],
      ['🧬 열성 유전','등급 차이 3↑','15%','스탯 +20%'],
      ['💥 돌연변이','무작위','3%','SSS 출현']
    ];
    var evHtml = evRows.map(function(r){
      return '<tr>'+
        '<td style="padding:4px 6px;color:#c8d0ff;font-size:11px;">'+r[0]+'</td>'+
        '<td style="padding:4px 6px;color:#7f8fb5;font-size:10px;">'+r[1]+'</td>'+
        '<td style="padding:4px 6px;color:#f5c842;font-weight:700;font-size:11px;">'+r[2]+'</td>'+
        '<td style="padding:4px 6px;color:#3dd68c;font-size:10px;">'+r[3]+'</td>'+
      '</tr>';
    }).join('');

    ct.innerHTML =
      // 번식장 상태
      '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:10px;padding:12px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div><div style="font-size:11px;color:#7f8fb5;">번식장 레벨</div>' +
            '<div style="font-size:16px;font-weight:900;color:#9b7ef8;">Lv.'+lvl+' / 5</div></div>' +
          '<div style="text-align:center;"><div style="font-size:11px;color:#7f8fb5;">슬롯</div>' +
            '<div style="font-size:16px;font-weight:900;color:#4f8ef7;">'+slots.length+' / '+lvl+'</div></div>' +
          '<div style="text-align:right;"><div style="font-size:11px;color:#7f8fb5;">비용</div>' +
            '<div style="font-size:13px;font-weight:700;color:#ff9f43;">'+dottCost+' DOTT</div>' +
            '' + // [DOT Fix] DOT 표시 제거 (DOTT 단독)
        '</div>' +
      '</div>' +
      // 진행중 슬롯
      '<div style="margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px;">📋 진행중 ('+slots.length+'/'+lvl+')</div>' +
        slotsHtml +
      '</div>' +
      // 새 번식 시작
      (slots.length < lvl ?
        '<div style="background:#0f1422;border:1px solid rgba(155,126,248,.2);border-radius:10px;padding:14px;margin-bottom:12px;">' +
          '<div style="font-size:13px;font-weight:700;color:#9b7ef8;margin-bottom:12px;">💕 새 번식 시작</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
            '<div><div style="font-size:11px;color:#7f8fb5;margin-bottom:4px;">🔵 수말</div>' +
              '<select id="breedSelectMale" onchange="updateBreedPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid #1a2540;background:#060c18;color:#dde4f5;font-size:12px;">' +
                '<option value="">-- 선택 --</option>'+optHtml(males)+
              '</select></div>' +
            '<div><div style="font-size:11px;color:#7f8fb5;margin-bottom:4px;">🔴 암말</div>' +
              '<select id="breedSelectFemale" onchange="updateBreedPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid #1a2540;background:#060c18;color:#dde4f5;font-size:12px;">' +
                '<option value="">-- 선택 --</option>'+optHtml(females)+
              '</select></div>' +
          '</div>' +
          '<div id="breedPreview" style="background:#060c18;border:1px solid #1a2540;border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px;color:#5a6a90;text-align:center;">부모를 선택하면 예상 스탯 범위가 표시됩니다</div>' +
          '<button onclick="confirmBreeding()" style="width:100%;padding:10px;border-radius:8px;border:0;background:#9b7ef8;color:#fff;cursor:pointer;font-size:13px;font-weight:700;">💕 번식 시작</button>' +
        '</div>'
        :
        '<div style="text-align:center;padding:16px;color:#f5c842;font-size:12px;">⚠️ 슬롯이 가득 찼습니다 — 번식 완료 후 추가 가능</div>'
      ) +
      // 특수 유전 이벤트표
      '<div style="background:#0b0f1c;border:1px solid rgba(155,126,248,.15);border-radius:10px;padding:12px;">' +
        '<div style="font-size:12px;font-weight:700;color:#9b7ef8;margin-bottom:8px;">✨ 특수 유전 이벤트</div>' +
        '<table style="width:100%;border-collapse:collapse;"><tbody>'+evHtml+'</tbody></table>' +
      '</div>';

    // 진행중 타이머 갱신 (1초)
    clearTimeout(window._breedTabTimer);
    if (slots.length > 0) {
      window._breedTabTimer = setTimeout(function(){ renderBreedingTab(); }, 1000);
    }
  }
  window.renderBreedingTab = renderBreedingTab;

  /* ---- UI ---- */
  function updateAllUI(){renderWallet();renderHorseList();renderFacilityList();renderStatusPanel();renderMarket();renderBank();renderBreedingTab();renderQuestTab();renderHallOfFame();renderRanking();renderAchievements();}
  function renderWallet(){
    const el=document.getElementById('stableWallet'); if(el) el.textContent=fmtDot(getMainWallet()); // [DOT Fix] 메인 지갑 참조
    const se=document.getElementById('stableScore'); if(se) se.textContent=(calcStableScore()||0).toLocaleString()+' pt'; // [P5]
    const ce=document.getElementById('stableHorseCount'); if(ce) ce.textContent=StableState.horses.length+'/'+getMaxHorses();
    // [v5.3 Phase2] DOTT 잔액 헤더 표시
    const de=document.getElementById('stableDottWallet'); if(de) de.textContent=fmtDott(StableState.dottWallet);
  }
  function getStatusBadge(status){
    const m={available:['#3dd68c','대기'],training:['#4f8ef7','🏋️ 훈련중'],medical:['#f5c842','🏥 치료중'],breeding:['#9b7ef8','💕 번식중'],racing:['#f26b6b','🏁 출전중']};
    const [color,label]=m[status]||['#7f8fb5',status];
    return '<span style="font-size:11px;font-weight:700;color:'+color+';">'+label+'</span>';
  }
  function fitnessBarHtml(f){
    const c=f>=70?'#3dd68c':f>=40?'#f5c842':'#f26b6b';
    return '<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#7f8fb5;"><span>컨디션</span><div style="flex:1;height:4px;background:#1a2540;border-radius:4px;overflow:hidden;"><div style="width:'+f+'%;height:100%;background:'+c+';border-radius:4px;"></div></div><span style="color:'+c+';font-weight:700;">'+f+'%</span></div>';
  }
  function statBarHtml(label,val,color){
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12.5px;"><span style="width:64px;color:#7f8fb5;">'+label+'</span><div style="flex:1;height:6px;background:#1a2540;border-radius:4px;overflow:hidden;"><div style="width:'+val+'%;height:100%;background:'+color+';border-radius:4px;"></div></div><span style="width:28px;text-align:right;font-weight:700;color:'+color+';font-family:monospace;">'+val+'</span></div>';
  }
  function infoRow(label,value){
    return '<div style="background:#0b0f1c;border:1px solid #1a2540;border-radius:8px;padding:8px 12px;"><div style="font-size:11px;color:#3d4f72;">'+label+'</div><div style="font-size:13px;color:#dde4f5;font-weight:600;">'+value+'</div></div>';
  }
  function renderHorseList(){
    const c=document.getElementById('stableHorseList'); if(!c) return;
    if(StableState.horses.length===0){c.innerHTML='<div style="text-align:center;padding:32px;color:#3d4f72;"><div style="font-size:48px;margin-bottom:12px;">🐴</div><div>보유한 말이 없습니다</div><button onclick="switchStableTab(\'market\')" style="margin-top:12px;background:#4f8ef7;color:#fff;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;">🛒 말 구매하기</button></div>';return;}
    c.innerHTML=StableState.horses.map(horse=>{
      const isRacing=StableState.raceEntryHorseId===horse.id;
      return '<div onclick="showHorseDetail(\''+horse.id+'\')" style="background:#0f1422;border:1px solid '+(isRacing?'#f5c842':'#1a2540')+';border-radius:12px;padding:14px;cursor:pointer;margin-bottom:10px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
          '<div style="display:flex;align-items:center;gap:8px;"><span style="font-weight:700;font-size:14px;color:#fff;">'+horse.name+'</span>'+
          '<span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:'+GRADE_COLORS[horse.grade]+'22;color:'+GRADE_COLORS[horse.grade]+';border:1px solid '+GRADE_COLORS[horse.grade]+'66;">'+horse.grade+'</span>'+
          (isRacing?'<span style="font-size:11px;color:#f5c842;">🏁 출전중</span>':'')+'</div>'+
          getStatusBadge(horse.status)+'</div>'+
        '<div style="font-size:12px;color:#7f8fb5;margin-bottom:4px;">'+(horse.honorTitle||'⭐ 신인')+' &nbsp;|&nbsp; '+(horse.gender==='male'?'🔵 수말':'🔴 암말')+' '+horse.age+'세</div>'+
        '<div style="font-size:11px;color:#5a6a90;margin-bottom:8px;">'+horse.coat+' | 훈련 '+(horse.trainCount||0)+'회 | '+(horse.wins||0)+'승/'+(horse.races||0)+'전 | 가치 '+fmtDot(horse.value)+'</div>'+
        '<div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;"><span>⚡ <strong style="color:#4f8ef7;">'+horse.stats.speed+'</strong></span><span>💨 <strong style="color:#3dd68c;">'+horse.stats.stamina+'</strong></span><span>🔥 <strong style="color:#f26b6b;">'+horse.stats.burst+'</strong></span></div>'+
        fitnessBarHtml(horse.fitness)+'</div>';
    }).join('');
  }
  function renderFacilityList(){
    const c=document.getElementById('stableFacilityList'); if(!c) return;
    c.innerHTML=Object.entries(FACILITY_META).map(([type,meta])=>{
      const level=StableState.facilities[type]||0; const cost=upgradeCost(type);
      const dottCostUi=upgradeCostDott(type); const maxed=level>=meta.maxLevel; const canAfford=(StableState.dottWallet||0)>=dottCostUi; // [DOT Fix]
      return '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:12px;padding:16px;margin-bottom:10px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
          '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">'+meta.icon+'</span>'+
          '<div><div style="font-weight:700;color:#fff;font-size:14px;">'+meta.name+'</div><div style="font-size:11px;color:#7f8fb5;">'+meta.desc+'</div></div></div>'+
          '<div style="text-align:right;"><div style="font-size:18px;font-weight:900;color:#4f8ef7;font-family:monospace;">Lv.'+level+'</div><div style="font-size:11px;color:#3d4f72;">/ '+meta.maxLevel+'</div></div></div>'+
        '<button onclick="upgradeFacility(\''+type+'\')" '+(maxed||!canAfford?'disabled':'')+
          ' style="width:100%;padding:8px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;'+
          'background:'+(maxed?'#1a2540':canAfford?'#4f8ef7':'#1a2540')+';color:'+(maxed?'#3d4f72':canAfford?'#fff':'#3d4f72')+';">'+
          (maxed?'🔒 최대 레벨':'⬆️ 업그레이드 '+fmtDott(dottCostUi))+'</button></div>'; // [DOT Fix]
    }).join('');
  }
  function renderStatusPanel(){
    const c=document.getElementById('stableStatusPanel'); if(!c) return;
    const now=Date.now(); const items=[];
    StableState.trainingSlots.forEach(slot=>{
      const horse=StableState.horses.find(h=>h.id===slot.horseId); if(!horse) return;
      const rem=Math.max(0,slot.finishAt-now);
      items.push('<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0b0f1c;border-radius:8px;margin-bottom:6px;"><div><span style="color:#4f8ef7;font-weight:700;">🏋️ 훈련중</span><span style="color:#fff;margin-left:8px;">'+horse.name+'</span><span style="color:#7f8fb5;font-size:12px;margin-left:6px;">('+statLabel(slot.stat)+')</span></div><span style="font-size:12px;color:#7f8fb5;font-family:monospace;">'+fmtMs(rem)+'</span></div>');
    });
    StableState.medicalSlots.forEach(slot=>{
      const horse=StableState.horses.find(h=>h.id===slot.horseId); if(!horse) return;
      const rem=Math.max(0,slot.finishAt-now);
      items.push('<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0b0f1c;border-radius:8px;margin-bottom:6px;"><div><span style="color:#f5c842;font-weight:700;">🏥 치료중</span><span style="color:#fff;margin-left:8px;">'+horse.name+'</span></div><span style="font-size:12px;color:#7f8fb5;font-family:monospace;">'+fmtMs(rem)+'</span></div>');
    });
    StableState.breedingSlots.forEach(slot=>{
      const hA=StableState.horses.find(h=>h.id===slot.horseAId);
      const hB=StableState.horses.find(h=>h.id===slot.horseBId);
      const rem=Math.max(0,slot.finishAt-now);
      items.push('<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0b0f1c;border-radius:8px;margin-bottom:6px;"><div><span style="color:#9b7ef8;font-weight:700;">💕 번식중</span><span style="color:#fff;margin-left:8px;">'+(hA?.name||'?')+' × '+(hB?.name||'?')+'</span><span style="font-size:11px;color:#f5c842;margin-left:6px;">[예상: '+slot.resultGrade+']</span></div><span style="font-size:12px;color:#7f8fb5;font-family:monospace;">'+fmtMs(rem)+'</span></div>');
    });
    c.innerHTML=items.length?items.join(''):'<div style="text-align:center;padding:16px;color:#3d4f72;font-size:13px;">진행 중인 작업이 없습니다.</div>';
  }
  function renderMarket(){
    const c=document.getElementById('stableMarketList'); if(!c) return;
    if(marketHorses.length===0){c.innerHTML='<div style="text-align:center;padding:32px;color:#3d4f72;"><div style="font-size:40px;margin-bottom:12px;">🏪</div><div>시장에 말이 없습니다</div><button onclick="refreshMarket(false)" style="margin-top:12px;background:#4f8ef7;color:#fff;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;">🔄 새로고침</button></div>';return;}
    c.innerHTML=marketHorses.map((horse,i)=>'<div style="background:#0f1422;border:1px solid #1a2540;border-radius:12px;padding:14px;cursor:pointer;margin-bottom:10px;" onclick="buyHorse('+i+')">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
        '<div style="display:flex;align-items:center;gap:8px;"><span style="font-weight:700;color:#fff;">'+horse.name+'</span>'+
        '<span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:'+GRADE_COLORS[horse.grade]+'22;color:'+GRADE_COLORS[horse.grade]+';border:1px solid '+GRADE_COLORS[horse.grade]+'66;">'+horse.grade+'</span></div>'+
        '<span style="font-size:13px;font-weight:700;color:#f5c842;">'+(horse.value||0).toLocaleString()+' DOTT'+'</span></div>'+
      '<div style="font-size:12px;color:#7f8fb5;margin-bottom:8px;">'+(horse.gender==='male'?'🔵 수말':'🔴 암말')+' | '+horse.age+'세 | '+horse.coat+'</div>'+
      '<div style="display:flex;gap:10px;font-size:13px;"><span>⚡ <strong style="color:#4f8ef7;">'+horse.stats.speed+'</strong></span><span>💨 <strong style="color:#3dd68c;">'+horse.stats.stamina+'</strong></span><span>🔥 <strong style="color:#f26b6b;">'+horse.stats.burst+'</strong></span></div></div>'
    ).join('');
  }

  /* ---- Detail Modal ---- */
  window.showHorseDetail = function(horseId) {
    const horse=StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    const isRacing=StableState.raceEntryHorseId===horse.id;
    const canTrain=horse.status==='available'&&horse.fitness>=30;
    const canHeal =horse.status==='available'&&horse.fitness<100;
    const canRace =horse.status==='available';
    const c=document.getElementById('horseDetailContent'); if(!c) return;
    c.innerHTML=
      '<div style="padding:4px;">'+
      '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:52px;margin-bottom:8px;">🐴</div>'+
      '<div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:6px;">'+horse.name+'</div>'+
      '<span style="padding:4px 14px;border-radius:999px;font-size:13px;font-weight:700;background:'+GRADE_COLORS[horse.grade]+'22;color:'+GRADE_COLORS[horse.grade]+';border:1px solid '+GRADE_COLORS[horse.grade]+'66;">'+horse.grade+' 등급</span></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">'+
        infoRow('성별',horse.gender==='male'?'🔵 수말':'🔴 암말')+
        infoRow('나이',horse.age+'세')+
        infoRow('훈련 횟수',(horse.trainCount||0)+'회')+
        infoRow('전적',(horse.wins||0)+'승/'+(horse.races||0)+'전')+
      '</div>'+
      '<div style="margin-bottom:16px;">'+
        statBarHtml('⚡ 속도',horse.stats.speed,'#4f8ef7')+
        statBarHtml('💨 지구력',horse.stats.stamina,'#3dd68c')+
        statBarHtml('🔥 폭발력',horse.stats.burst,'#f26b6b')+
      '</div>'+
      '<div style="margin-bottom:16px;">'+fitnessBarHtml(horse.fitness)+'</div>'+
      '<div style="background:#0b0f1c;border:1px solid #1a2540;border-radius:10px;padding:12px;margin-bottom:14px;">'+
        '<div style="font-size:12px;color:#4f8ef7;font-weight:700;margin-bottom:8px;">🏋️ 훈련 (스탯 선택)</div>'+
        '<div style="display:flex;gap:6px;">'+
          '<button onclick="startTraining(\''+horse.id+'\',\'speed\')" '+(canTrain?'':'disabled')+' style="flex:1;padding:7px;border-radius:7px;border:0;cursor:pointer;font-size:12px;background:'+(canTrain?'rgba(79,142,247,.2)':'#1a2540')+';color:'+(canTrain?'#4f8ef7':'#3d4f72')+';font-weight:600;">⚡ 속도</button>'+
          '<button onclick="startTraining(\''+horse.id+'\',\'stamina\')" '+(canTrain?'':'disabled')+' style="flex:1;padding:7px;border-radius:7px;border:0;cursor:pointer;font-size:12px;background:'+(canTrain?'rgba(61,214,140,.2)':'#1a2540')+';color:'+(canTrain?'#3dd68c':'#3d4f72')+';font-weight:600;">💨 지구력</button>'+
          '<button onclick="startTraining(\''+horse.id+'\',\'burst\')" '+(canTrain?'':'disabled')+' style="flex:1;padding:7px;border-radius:7px;border:0;cursor:pointer;font-size:12px;background:'+(canTrain?'rgba(242,107,107,.2)':'#1a2540')+';color:'+(canTrain?'#f26b6b':'#3d4f72')+';font-weight:600;">🔥 폭발력</button>'+
        '</div>'+(canTrain?'':'<div style="font-size:11px;color:#f5c842;margin-top:6px;">⚠️ 컨디션 30% 이상 필요</div>')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">'+
        '<button onclick="startMedical(\''+horse.id+'\')" '+(canHeal?'':'disabled')+' style="padding:10px;border-radius:8px;border:0;cursor:pointer;font-size:13px;font-weight:600;background:'+(canHeal?'rgba(245,200,66,.2)':'#1a2540')+';color:'+(canHeal?'#f5c842':'#3d4f72')+';">🏥 치료하기</button>'+
        (isRacing
          ?'<button onclick="clearRaceEntry()" style="padding:10px;border-radius:8px;border:0;cursor:pointer;font-size:13px;font-weight:600;background:rgba(242,107,107,.2);color:#f26b6b;">🚫 출전 취소</button>'
          :'<button onclick="setRaceEntry(\''+horse.id+'\')" '+(canRace?'':'disabled')+' style="padding:10px;border-radius:8px;border:0;cursor:pointer;font-size:13px;font-weight:600;background:'+(canRace?'rgba(61,214,140,.2)':'#1a2540')+';color:'+(canRace?'#3dd68c':'#3d4f72')+';">🏁 경주 출전</button>')+
      '</div>'+
      '<div style="background:#0b0f1c;border:1px solid rgba(245,200,66,.2);border-radius:10px;padding:12px;margin-bottom:10px;">'+
        '<div style="font-size:12px;color:#f5c842;font-weight:700;margin-bottom:8px;">🏅 명예 & 가치</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">'+
          '<div style="background:#060c18;border-radius:6px;padding:8px;text-align:center;">'+
            '<div style="color:#7f8fb5;margin-bottom:3px;">칭호</div>'+
            '<div style="color:#f5c842;font-weight:700;font-size:12px;">'+(horse.honorTitle||'⭐ 신인')+'</div>'+
          '</div>'+
          '<div style="background:#060c18;border-radius:6px;padding:8px;text-align:center;">'+
            '<div style="color:#7f8fb5;margin-bottom:3px;">시장 가치</div>'+
            '<div style="color:#4ecdc4;font-weight:700;font-size:12px;">'+(horse.value||0).toLocaleString()+' DOTT'+'</div>'+
          '</div>'+
          '<div style="background:#060c18;border-radius:6px;padding:8px;text-align:center;">'+
            '<div style="color:#7f8fb5;margin-bottom:3px;">누적 DOTT</div>'+
            '<div style="color:#ff9f43;font-weight:700;font-size:12px;">'+(horse.dottEarned||0)+' DOTT</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      (horse.ancestry ? (
        '<div style="background:#0b0f1c;border:1px solid rgba(155,126,248,.2);border-radius:10px;padding:12px;margin-bottom:10px;">'+
          '<div style="font-size:12px;color:#9b7ef8;font-weight:700;margin-bottom:8px;">🌳 계보 (족보)</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">'+
            '<div style="background:#060c18;border-radius:6px;padding:8px;">'+
              '<div style="color:#7f8fb5;font-size:10px;margin-bottom:3px;">🔵 부 (Father)</div>'+
              '<div style="color:#4f8ef7;font-weight:700;">'+horse.ancestry.fatherName+'</div>'+
              '<div style="color:#5a6a90;font-size:10px;">['+horse.ancestry.fatherGrade+'등급]</div>'+
            '</div>'+
            '<div style="background:#060c18;border-radius:6px;padding:8px;">'+
              '<div style="color:#7f8fb5;font-size:10px;margin-bottom:3px;">🔴 모 (Mother)</div>'+
              '<div style="color:#f26b6b;font-weight:700;">'+horse.ancestry.motherName+'</div>'+
              '<div style="color:#5a6a90;font-size:10px;">['+horse.ancestry.motherGrade+'등급]</div>'+
            '</div>'+
          '</div>'+
        '</div>'
      ) : '') +
      '<button onclick="sellHorse(\''+horse.id+'\')" style="width:100%;padding:9px;border-radius:8px;border:1px solid #1a2540;background:transparent;color:#7f8fb5;cursor:pointer;font-size:12.5px;">💰 판매 ('+Math.ceil(Math.floor(horse.value*0.7)/1000).toLocaleString()+' DOTT)</button>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">'+
        '<button onclick="enhanceHorse(\''+horse.id+'\')" style="padding:9px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;background:rgba(255,159,67,.2);color:#ff9f43;">🔨 강화 (Lv.'+(horse.enhanceLevel||0)+') '+(Math.round(ENHANCE_COST_DOTT*Math.pow(1.5,horse.enhanceLevel||0)))+' DOTT</button>'+
        '<button onclick="retireHorse(\''+horse.id+'\')" style="padding:9px;border-radius:8px;border:1px solid rgba(242,107,107,.3);background:transparent;color:#f26b6b;cursor:pointer;font-size:12.5px;">🏅 명예 은퇴</button>'+
        '<button onclick="mintHorseAsNFT(\''+horse.id+'\')" style="padding:9px;border-radius:8px;border:0;background:rgba(155,126,248,.15);color:#9b7ef8;cursor:pointer;font-size:12.5px;font-weight:600;">🎴 NFT 민팅 ('+MINT_COST_DOTT+' DOTT)</button>'+
      '</div>'+
      '</div>';
    openModal('horseDetailModal');
  };

  /* ---- Tab Nav ---- */
  window.switchStableTab=function(tabId){
    document.querySelectorAll('.stable-tab-btn').forEach(btn=>{btn.style.background='transparent';btn.style.color='#7f8fb5';btn.style.borderColor='#1a2540';});
    document.querySelectorAll('.stable-tab-content').forEach(t=>{t.style.display='none';});
    const ab=document.querySelector('[data-stable-tab="'+tabId+'"]');
    const at=document.getElementById('stable-tab-'+tabId);
    if(ab){ab.style.background='rgba(79,142,247,.15)';ab.style.color='#4f8ef7';ab.style.borderColor='rgba(79,142,247,.4)';}
    if(at) at.style.display='block';
    if(tabId==='market'&&marketHorses.length===0) refreshMarket(false);
    if(tabId==='breeding') renderBreedingTab();
    if(tabId==='bank') renderBank();
    if(tabId==='breeding') renderBreedingTab();
    if(tabId==='quest') renderQuestTab();
    if(tabId==='fame') renderHallOfFame();
    if(tabId==='rank') renderRanking();
    if(tabId==='achieve') { checkAchievements(false); renderAchievements(); }
  };

  /* ---- Modals ---- */
  window.openModal=function(id){const el=document.getElementById(id);if(el)el.style.display='flex';};
  window.closeModal=function(id){const el=document.getElementById(id);if(el)el.style.display='none';};

  /* ---- Toast ---- */
  function showToast(msg,type){
    const colors={good:'#3dd68c',bad:'#f26b6b',warn:'#f5c842',info:'#4f8ef7'};
    const color=colors[type]||colors.good;
    const t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#0f1422;border:1px solid '+color+';color:'+color+';padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:99999;max-width:420px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.5);';
    document.body.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s';},2500);
    setTimeout(()=>t.remove(),2800);
  }

  /* ---- Util ---- */
  function fmtDot(n){return Number(n).toLocaleString()+' DOT';}
  function fmtMs(ms){
    if(ms<=0) return '완료';
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
    if(h>0) return h+'시간 '+m+'분';
    if(m>0) return m+'분 '+s+'초';
    return s+'초';
  }
  function statLabel(stat){return{speed:'속도',stamina:'지구력',burst:'폭발력'}[stat]||stat;}
  function getMaxHorses(){return 5+(StableState.facilities.barn-1)*3;}

  /* ---- Expose globals ---- */
  window.StableManager=window.refreshMarket=refreshMarket;
  window.buyHorse=buyHorse; window.sellHorse=sellHorse;
  window.startTraining=startTraining; window.startMedical=startMedical;
  // [v5.3 Phase4] StableState & addDottHistory를 전역으로 노출 (NFT 강화 시스템 연동)
  window.StableState      = StableState;
  window._StableState     = StableState;
  window.addDottHistory   = addDottHistory;
  // stableStateReady 이벤트 발행
  document.dispatchEvent(new CustomEvent('stableStateReady', { detail: StableState }));

  window.openBreedingUI=openBreedingUI; window.confirmBreeding=confirmBreeding;
  window.upgradeFacility=upgradeFacility;
  window.setRaceEntry=setRaceEntry; window.clearRaceEntry=clearRaceEntry;

  /* ---- Timer restore ---- */
  function restoreTimers(){
    StableState.trainingSlots.forEach(s=>startTrainingTimer(s.horseId));
    StableState.medicalSlots.forEach(s=>startMedicalTimer(s.horseId));
    StableState.breedingSlots.forEach(s=>startBreedingTimer(s));
  }
  // [메모리 누수 수정] setInterval 중복 방지 — 최초 1회만 등록
  if (!window._stablePanelTimerStarted) {
    window._stablePanelTimerStarted = true;
    setInterval(renderStatusPanel, window.GAME_CONFIG?.STABLE_REFRESH_MS ?? 10000); // [game-config.js]
  }

  /* ---- Init ---- */
  async function initStable(){
    StableState.userId=getFirebaseUid();
    await loadGame();
    if(StableState.marketHorses&&StableState.marketHorses.length>0) marketHorses=StableState.marketHorses;
    else refreshMarket(false);
    restoreTimers();
    initDailyQuests();          // [v5.3 Phase5] 일일 퀘스트 초기화
    checkAchievements(true);    // [v5.3 Phase5] 업적 상태 갱신
    updateAllUI();
    console.log('[Stable] 도트 목장 v5.3.0 초기화 완료');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initStable);
  else initStable();

})();
