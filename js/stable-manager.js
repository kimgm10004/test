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

  const TRAINING_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  const TRAINING_STAT_GAIN   = { min: 1, max: 4 };
  const TRAINING_FATIGUE     = 20;
  const MEDICAL_COOLDOWN_MS  = 1 * 60 * 60 * 1000;
  const MEDICAL_RECOVER      = 50;
  const BREED_BASE_COST      = 200000;
  const MARKET_REFRESH_COST  = 50000;

  const HORSE_GRADES = {
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

  let StableState = {
    userId: null, wallet: 1000000, horses: [],
    facilities: { barn:1, training:1, medical:1, breeding:0 },
    marketHorses: [], marketLastRefresh: 0,
    breedingSlots: [], trainingSlots: [], medicalSlots: [],
    raceEntryHorseId: null, lastSaved: 0
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
    if (!ref) { try { window.Storage.setItem('stableData_v2', StableState); } catch(e){} return; }
    try {
      await ref.set({ ...StableState, lastSaved: Date.now() }, { merge: true });
    } catch(err) {
      console.warn('[Stable] Firebase save failed:', err.message);
      try { window.Storage.setItem('stableData_v2', StableState); } catch(e){}
    }
  }
  async function loadGame() {
    const ref = getStableRef();
    if (!ref) {
      try {
        const raw = window.Storage.getItem('stableData_v2');
        if (raw) Object.assign(StableState, raw);
      } catch(e){}
      return;
    }
    try {
      const snap = await ref.get();
      if (snap.exists) Object.assign(StableState, snap.data());
      else {
        try { const raw = window.Storage.getItem('stableData_v2'); if(raw) Object.assign(StableState, raw); } catch(e){}
      }
    } catch(err) {
      console.warn('[Stable] Firebase load failed:', err.message);
      try { const raw = window.Storage.getItem('stableData_v2'); if(raw) Object.assign(StableState, raw); } catch(e){}
    }
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
    return {
      id:      'horse_' + Date.now() + '_' + rng(1000,9999),
      name:    HORSE_NAMES.prefixes[rng(0,HORSE_NAMES.prefixes.length-1)] + HORSE_NAMES.suffixes[rng(0,HORSE_NAMES.suffixes.length-1)],
      gender:  Math.random() < 0.5 ? 'male' : 'female',
      age:     rng(2,5), coat: COAT_COLORS[rng(0,COAT_COLORS.length-1)], grade,
      stats:   { speed:rng(data.stats[0],data.stats[1]), stamina:rng(data.stats[0],data.stats[1]), burst:rng(data.stats[0],data.stats[1]) },
      value:   rng(data.price[0],data.price[1]),
      fitness: 100, status:'available', trainCount:0, wins:0, races:0,
      acquired:{ method:'market', date:new Date().toISOString() }
    };
  }

  /* ---- Market ---- */
  function refreshMarket(paid) {
    if (paid) {
      if (StableState.wallet < MARKET_REFRESH_COST) { showToast('DOT 부족!','bad'); return; }
      StableState.wallet -= MARKET_REFRESH_COST;
    }
    const count = 4 + Math.min(StableState.facilities.barn, 4);
    marketHorses = [];
    for (let i = 0; i < count; i++) marketHorses.push(createHorse());
    StableState.marketHorses = [...marketHorses];
    StableState.marketLastRefresh = Date.now();
    renderMarket(); renderWallet();
    if (paid) saveGame();
  }
  function buyHorse(index) {
    const horse = marketHorses[index]; if (!horse) return;
    if (StableState.horses.length >= getMaxHorses()) { showToast('마방 부족!','warn'); return; }
    if (StableState.wallet < horse.value) { showToast('DOT 부족!','bad'); return; }
    StableState.wallet -= horse.value;
    horse.id = 'horse_' + Date.now() + '_' + rng(1000,9999);
    horse.status = 'available';
    horse.acquired = { method:'purchase', date:new Date().toISOString() };
    StableState.horses.push(horse);
    marketHorses.splice(index,1);
    StableState.marketHorses = [...marketHorses];
    saveGame(); updateAllUI();
    showToast('✅ ' + horse.name + ' 구매 완료!','good');
  }
  function sellHorse(horseId) {
    const horse = StableState.horses.find(h=>h.id===horseId); if (!horse) return;
    if (horse.status !== 'available') { showToast('작업중인 말은 판매 불가','warn'); return; }
    const sellPrice = Math.floor(horse.value * 0.7);
    if (!confirm(horse.name + ' 을(를) ' + fmtDot(sellPrice) + '에 판매?')) return;
    StableState.wallet += sellPrice;
    StableState.horses = StableState.horses.filter(h=>h.id!==horseId);
    StableState.trainingSlots = StableState.trainingSlots.filter(s=>s.horseId!==horseId);
    StableState.medicalSlots  = StableState.medicalSlots.filter(s=>s.horseId!==horseId);
    StableState.breedingSlots = StableState.breedingSlots.filter(s=>s.horseAId!==horseId&&s.horseBId!==horseId);
    if (StableState.raceEntryHorseId===horseId) StableState.raceEntryHorseId=null;
    saveGame(); closeModal('horseDetailModal'); updateAllUI();
    showToast('💰 ' + horse.name + ' 판매! +' + fmtDot(sellPrice),'good');
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
    const opt     = h => '<option value="'+h.id+'">'+h.name+' ['+h.grade+'] ⚡'+h.stats.speed+'</option>';
    const c = document.getElementById('breedingModalContent'); if(!c) return;
    const cost = breedCost();
    c.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:12px;color:#7f8fb5;font-weight:700;">🔵 수말</label>
          <select id="breedSelectMale" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid #1a2540;background:#0f1422;color:#dde4f5;font-size:13px;">
            <option value="">-- 수말 선택 --</option>${males.map(opt).join('')}</select></div>
        <div>
          <label style="font-size:12px;color:#7f8fb5;font-weight:700;">🔴 암말</label>
          <select id="breedSelectFemale" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:8px;border:1px solid #1a2540;background:#0f1422;color:#dde4f5;font-size:13px;">
            <option value="">-- 암말 선택 --</option>${females.map(opt).join('')}</select></div>
        <div style="background:#0b0f1c;border:1px solid #1a2540;border-radius:10px;padding:12px;font-size:12.5px;color:#7f8fb5;line-height:1.8;">
          💡 번식 비용: <strong style="color:#f5c842;">${fmtDot(cost)}</strong><br>
          💡 번식 시간: <strong style="color:#4f8ef7;">약 30분</strong><br>
          💡 번식장 레벨이 높을수록 고등급 자식 확률 증가</div>
        <div style="display:flex;gap:8px;">
          <button onclick="confirmBreeding()" style="flex:1;background:#9b7ef8;color:#fff;border:0;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">💕 번식 시작</button>
          <button onclick="closeModal('breedingModal')" style="flex:1;background:transparent;border:1px solid #1a2540;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;color:#7f8fb5;">취소</button>
        </div>
      </div>`;
  }
  function breedCost() { return Math.floor(BREED_BASE_COST*(1-(StableState.facilities.breeding-1)*0.05)); }
  function confirmBreeding() {
    const maleId   = document.getElementById('breedSelectMale')?.value;
    const femaleId = document.getElementById('breedSelectFemale')?.value;
    if (!maleId||!femaleId) { showToast('수말과 암말 모두 선택하세요','warn'); return; }
    if (maleId===femaleId)  { showToast('같은 말끼리 번식 불가','warn'); return; }
    const cost = breedCost();
    if (StableState.wallet < cost) { showToast('DOT 부족!','bad'); return; }
    if (StableState.breedingSlots.length >= StableState.facilities.breeding) { showToast('번식 슬롯 부족','warn'); return; }
    const horseA = StableState.horses.find(h=>h.id===maleId);
    const horseB = StableState.horses.find(h=>h.id===femaleId);
    if (!horseA||!horseB) return;
    StableState.wallet -= cost;
    horseA.status='breeding'; horseB.status='breeding';
    const resultGrade = determineBreedGrade(horseA.grade, horseB.grade);
    const now = Date.now(); const dur = 30*60*1000;
    const slot = { horseAId:maleId, horseBId:femaleId, startAt:now, finishAt:now+dur, resultGrade };
    StableState.breedingSlots.push(slot);
    saveGame(); closeModal('breedingModal'); updateAllUI();
    showToast('💕 번식 시작! ' + horseA.name + ' x ' + horseB.name + ' → 30분 후 결과','good');
    startBreedingTimer(slot);
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
    const offspring = createHorse(slot.resultGrade);
    offspring.status='available';
    offspring.acquired={method:'breeding',parentA:horseA?.name||'?',parentB:horseB?.name||'?',date:new Date().toISOString()};
    if(horseA&&horseB){
      const g=HORSE_GRADES[offspring.grade].stats[0];
      offspring.stats.speed  =Math.max(offspring.stats.speed,  Math.floor((horseA.stats.speed+horseB.stats.speed)/2*0.5+g*0.5));
      offspring.stats.stamina=Math.max(offspring.stats.stamina,Math.floor((horseA.stats.stamina+horseB.stats.stamina)/2*0.5+g*0.5));
      offspring.stats.burst  =Math.max(offspring.stats.burst,  Math.floor((horseA.stats.burst+horseB.stats.burst)/2*0.5+g*0.5));
    }
    StableState.horses.push(offspring);
    StableState.breedingSlots.splice(idx,1);
    saveGame(); updateAllUI();
    showToast('🐣 번식 완료! ' + offspring.name + ' ['+offspring.grade+'등급] 탄생!','good');
  }

  /* ---- Facilities ---- */
  function upgradeCost(type) {
    const level=StableState.facilities[type]||0;
    const bases={barn:50000,training:70000,medical:60000,breeding:150000};
    return Math.floor((bases[type]||50000)*Math.pow(1.8,level));
  }
  function upgradeFacility(type) {
    const meta=FACILITY_META[type]; const level=StableState.facilities[type]||0;
    if(level>=meta.maxLevel){showToast('최대 레벨!','warn');return;}
    const cost=upgradeCost(type);
    if(StableState.wallet<cost){showToast('DOT 부족!','bad');return;}
    if(!confirm(meta.name+' Lv.'+level+' → Lv.'+(level+1)+'\n비용: '+fmtDot(cost))) return;
    StableState.wallet-=cost; StableState.facilities[type]=level+1;
    saveGame(); updateAllUI();
    showToast('⬆️ '+meta.name+' Lv.'+level+' → Lv.'+(level+1),'good');
  }

  /* ---- Race Entry ---- */
  function setRaceEntry(horseId) {
    const horse=StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    if(horse.status!=='available'){showToast('출전 가능한 말만 등록 가능','warn');return;}
    if(StableState.raceEntryHorseId){
      const prev=StableState.horses.find(h=>h.id===StableState.raceEntryHorseId);
      if(prev&&prev.status==='racing') prev.status='available';
    }
    StableState.raceEntryHorseId=horseId; horse.status='racing';
    window.stableRaceHorse={id:horse.id,name:horse.name,grade:horse.grade,stats:{...horse.stats},fitness:horse.fitness};
    saveGame(); updateAllUI(); closeModal('horseDetailModal');
    showToast('🏁 '+horse.name+' 경주 출전 등록!','good');
  }
  function clearRaceEntry() {
    if(!StableState.raceEntryHorseId) return;
    const horse=StableState.horses.find(h=>h.id===StableState.raceEntryHorseId);
    if(horse&&horse.status==='racing') horse.status='available';
    StableState.raceEntryHorseId=null; window.stableRaceHorse=null;
    saveGame(); updateAllUI();
    showToast('출전 등록 취소됨','warn');
  }
  window.stableOnRaceResult=function(horseId,won){
    const horse=StableState.horses.find(h=>h.id===horseId); if(!horse) return;
    horse.races=(horse.races||0)+1;
    if(won) horse.wins=(horse.wins||0)+1;
    horse.fitness=Math.max(0,horse.fitness-15);
    horse.status='available'; StableState.raceEntryHorseId=null; window.stableRaceHorse=null;
    saveGame(); updateAllUI();
  };

  /* ---- UI ---- */
  function updateAllUI(){renderWallet();renderHorseList();renderFacilityList();renderStatusPanel();renderMarket();}
  function renderWallet(){
    const el=document.getElementById('stableWallet'); if(el) el.textContent=fmtDot(StableState.wallet);
    const ce=document.getElementById('stableHorseCount'); if(ce) ce.textContent=StableState.horses.length+'/'+getMaxHorses();
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
        '<div style="font-size:12px;color:#7f8fb5;margin-bottom:8px;">'+(horse.gender==='male'?'🔵 수말':'🔴 암말')+' | '+horse.age+'세 | '+horse.coat+' | 훈련 '+(horse.trainCount||0)+'회 | '+(horse.wins||0)+'승/'+(horse.races||0)+'전</div>'+
        '<div style="display:flex;gap:10px;margin-bottom:8px;font-size:13px;"><span>⚡ <strong style="color:#4f8ef7;">'+horse.stats.speed+'</strong></span><span>💨 <strong style="color:#3dd68c;">'+horse.stats.stamina+'</strong></span><span>🔥 <strong style="color:#f26b6b;">'+horse.stats.burst+'</strong></span></div>'+
        fitnessBarHtml(horse.fitness)+'</div>';
    }).join('');
  }
  function renderFacilityList(){
    const c=document.getElementById('stableFacilityList'); if(!c) return;
    c.innerHTML=Object.entries(FACILITY_META).map(([type,meta])=>{
      const level=StableState.facilities[type]||0; const cost=upgradeCost(type);
      const maxed=level>=meta.maxLevel; const canAfford=StableState.wallet>=cost;
      return '<div style="background:#0f1422;border:1px solid #1a2540;border-radius:12px;padding:16px;margin-bottom:10px;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
          '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">'+meta.icon+'</span>'+
          '<div><div style="font-weight:700;color:#fff;font-size:14px;">'+meta.name+'</div><div style="font-size:11px;color:#7f8fb5;">'+meta.desc+'</div></div></div>'+
          '<div style="text-align:right;"><div style="font-size:18px;font-weight:900;color:#4f8ef7;font-family:monospace;">Lv.'+level+'</div><div style="font-size:11px;color:#3d4f72;">/ '+meta.maxLevel+'</div></div></div>'+
        '<button onclick="upgradeFacility(\''+type+'\')" '+(maxed||!canAfford?'disabled':'')+
          ' style="width:100%;padding:8px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;'+
          'background:'+(maxed?'#1a2540':canAfford?'#4f8ef7':'#1a2540')+';color:'+(maxed?'#3d4f72':canAfford?'#fff':'#3d4f72')+';">'+
          (maxed?'🔒 최대 레벨':'⬆️ 업그레이드 '+fmtDot(cost))+'</button></div>';
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
        '<span style="font-size:13px;font-weight:700;color:#f5c842;">'+fmtDot(horse.value)+'</span></div>'+
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
      '<button onclick="sellHorse(\''+horse.id+'\')" style="width:100%;padding:9px;border-radius:8px;border:1px solid #1a2540;background:transparent;color:#7f8fb5;cursor:pointer;font-size:12.5px;">💰 판매 ('+fmtDot(Math.floor(horse.value*0.7))+')</button>'+
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
    if(tabId==='breeding') renderBreedingModal();
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
  window.openBreedingUI=openBreedingUI; window.confirmBreeding=confirmBreeding;
  window.upgradeFacility=upgradeFacility;
  window.setRaceEntry=setRaceEntry; window.clearRaceEntry=clearRaceEntry;

  /* ---- Timer restore ---- */
  function restoreTimers(){
    StableState.trainingSlots.forEach(s=>startTrainingTimer(s.horseId));
    StableState.medicalSlots.forEach(s=>startMedicalTimer(s.horseId));
    StableState.breedingSlots.forEach(s=>startBreedingTimer(s));
  }
  setInterval(renderStatusPanel, 10000);

  /* ---- Init ---- */
  async function initStable(){
    StableState.userId=getFirebaseUid();
    await loadGame();
    if(StableState.marketHorses&&StableState.marketHorses.length>0) marketHorses=StableState.marketHorses;
    else refreshMarket(false);
    restoreTimers(); updateAllUI();
    console.log('[Stable] 도트 목장 v1.0.0 초기화 완료');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initStable);
  else initStable();

})();
