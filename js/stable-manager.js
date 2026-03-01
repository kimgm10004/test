/**
 * 도트 목장 - 단순 버전 v0.2.0
 * Stable Manager Game
 */

// 게임 상태
const GameState = {
  user: { wallet: 1000000 },
  horses: [],
  facilities: {
    barn: 1,
    training: 1,
    medical: 1,
    breeding: 0
  }
};

// 말 등급 데이터
const HORSE_GRADES = {
  C: { price: [50000, 100000], stats: [30, 55] },
  B: { price: [100000, 200000], stats: [55, 70] },
  A: { price: [200000, 400000], stats: [70, 80] },
  S: { price: [400000, 800000], stats: [80, 90] },
  SS: { price: [800000, 1500000], stats: [90, 95] },
  SSS: { price: [1500000, 3000000], stats: [95, 100] }
};

const HORSE_NAMES = {
  prefixes: ['태', '무', '천', '카이', '동', '에', '드', '스', '로', '유'],
  suffixes: ['왕', '적', '마', '룡', '날', '풍', '광', '철', '한', '우']
};

const COAT_COLORS = ['갈색', '흰색', '검은색', '얼룩', '황토색', '회색'];

// 시장 말들
let marketHorses = [];

// 초기화
function initGame() {
  loadGame();
  openMarket(); // 시장 초기화
  updateAllUI();
  console.log('🎮 게임 초기화 완료');
}

// 저장/불러오기
function saveGame() {
  localStorage.setItem('dotStableData', JSON.stringify(GameState));
}

function loadGame() {
  const data = localStorage.getItem('dotStableData');
  if (data) {
    const parsed = JSON.parse(data);
    Object.assign(GameState, parsed);
  }
}

// UI 업데이트
function updateAllUI() {
  document.getElementById('walletDisplay').textContent = formatCurrency(GameState.user.wallet);
  document.getElementById('horseCount').textContent = `${GameState.horses.length}/${getMaxHorses()}`;
  renderHorseList();
  renderFacilityList();
}

// 형식화
function formatCurrency(amount) {
  return amount.toLocaleString() + ' DOT';
}

// 말 생성
function createHorse() {
  const grades = Object.keys(HORSE_GRADES);
  const selectedGrade = grades[Math.floor(Math.random() * grades.length)];
  const data = HORSE_GRADES[selectedGrade];
  
  const speed = Math.floor(Math.random() * (data.stats[1] - data.stats[0])) + data.stats[0];
  const stamina = Math.floor(Math.random() * (data.stats[1] - data.stats[0])) + data.stats[0];
  const burst = Math.floor(Math.random() * (data.stats[1] - data.stats[0])) + data.stats[0];
  const price = Math.floor(Math.random() * (data.price[1] - data.price[0])) + data.price[0];
  
  const prefix = HORSE_NAMES.prefixes[Math.floor(Math.random() * HORSE_NAMES.prefixes.length)];
  const suffix = HORSE_NAMES.suffixes[Math.floor(Math.random() * HORSE_NAMES.suffixes.length)];
  
  return {
    id: 'horse_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    name: prefix + suffix,
    gender: Math.random() < 0.5 ? 'male' : 'female',
    age: 3,
    coat: COAT_COLORS[Math.floor(Math.random() * COAT_COLORS.length)],
    grade: selectedGrade,
    stats: { speed, stamina, burst },
    value: price,
    condition: { fitness: 100 }
  };
}

// 시장 열기
function openMarket() {
  marketHorses = [];
  for (let i = 0; i < 6; i++) {
    marketHorses.push(createHorse());
  }
  renderMarket();
}

// 말 목록 렌더링
function renderHorseList() {
  const container = document.getElementById('horseList');
  
  if (GameState.horses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐴</div>
        <div>보유한 말이 없습니다</div>
        <button class="primary" style="margin-top:12px;" onclick="switchTab('market')">🛒 말 구매하기</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = GameState.horses.map(horse => `
    <div class="horse-card" onclick="showHorseDetail('${horse.id}')">
      <div class="horse-header">
        <span class="horse-name">${horse.name}</span>
        <span class="horse-grade grade-${horse.grade.toLowerCase()}">${horse.grade}</span>
      </div>
      <div class="horse-info">${horse.gender === 'male' ? '수' : '암'} | ${horse.age}세 | ${horse.coat}</div>
      <div class="horse-stats">
        <span>⚡${horse.stats.speed}</span>
        <span>💨${horse.stats.stamina}</span>
        <span>🔥${horse.stats.burst}</span>
      </div>
      <div class="horse-value">${formatCurrency(horse.value)}</div>
    </div>
  `).join('');
}

// 시설 목록 렌더링
function renderFacilityList() {
  const container = document.getElementById('facilityList');
  const facilities = [
    { type: 'barn', name: '마방', icon: '🏠', bonus: '보유' },
    { type: 'training', name: '훈련장', icon: '🏋️', bonus: '효율' },
    { type: 'medical', name: '의료실', icon: '🏥', bonus: '회복' },
    { type: 'breeding', name: '번식장', icon: '🐴', bonus: '성공률' }
  ];
  
  container.innerHTML = facilities.map(f => {
    const level = GameState.facilities[f.type] || 0;
    const cost = Math.floor(50000 * Math.pow(1.8, level));
    const canUpgrade = GameState.user.wallet >= cost && level < 10;
    
    return `
      <div class="facility-card">
        <div class="facility-icon">${f.icon}</div>
        <div class="facility-name">${f.name}</div>
        <div class="facility-level">Lv.${level}</div>
        <div class="facility-bonus">${f.bonus} +${level * 10}%</div>
        <button class="ghost" style="width:100%;" onclick="upgradeFacility('${f.type}')" ${!canUpgrade ? 'disabled' : ''}>
          ${canUpgrade ? '⬆️ ' + formatCurrency(cost) : '최대'}
        </button>
      </div>
    `;
  }).join('');
}

// 시장 렌더링
function renderMarket() {
  const container = document.getElementById('horseMarketList');
  container.innerHTML = marketHorses.map((horse, i) => `
    <div class="horse-card market-card" onclick="buyHorse(${i})">
      <div class="horse-header">
        <span class="horse-name">${horse.name}</span>
        <span class="horse-grade grade-${horse.grade.toLowerCase()}">${horse.grade}</span>
      </div>
      <div class="horse-info">${horse.gender === 'male' ? '수' : '암'} | ${horse.age}세 | ${horse.coat}</div>
      <div class="horse-stats">
        <span>⚡${horse.stats.speed}</span>
        <span>💨${horse.stats.stamina}</span>
        <span>🔥${horse.stats.burst}</span>
      </div>
      <div class="horse-price">${formatCurrency(horse.value)}</div>
    </div>
  `).join('');
}

// 말 구매
function buyHorse(index) {
  const horse = marketHorses[index];
  if (!horse) return;
  
  if (GameState.horses.length >= getMaxHorses()) {
    alert('마방이 부족합니다!');
    return;
  }
  
  if (GameState.user.wallet < horse.value) {
    alert('DOT가 부족합니다!');
    return;
  }
  
  GameState.user.wallet -= horse.value;
  horse.id = 'horse_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  horse.status = 'available';
  horse.acquired = { method: 'purchase', date: new Date().toISOString() };
  
  GameState.horses.push(horse);
  marketHorses.splice(index, 1);
  
  saveGame();
  updateAllUI();
  renderMarket();
  alert(`${horse.name} 구매 완료!`);
}

// 말 상세 보기
function showHorseDetail(horseId) {
  const horse = GameState.horses.find(h => h.id === horseId);
  if (!horse) return;
  
  document.getElementById('horseDetailContent').innerHTML = `
    <div style="text-align:center; padding:20px;">
      <div style="font-size:48px; margin-bottom:16px;">🐴</div>
      <div style="font-size:24px; font-weight:700; margin-bottom:8px;">${horse.name}</div>
      <span class="horse-grade grade-${horse.grade.toLowerCase()}">${horse.grade}</span>
      
      <div style="margin-top:20px; text-align:left;">
        <div class="info-row"><span>성별</span><span>${horse.gender === 'male' ? '수말' : '암말'}</span></div>
        <div class="info-row"><span>나이</span><span>${horse.age}세</span></div>
        <div class="info-row"><span>가치</span><span>${formatCurrency(horse.value)}</span></div>
      </div>
      
      <div style="margin-top:20px;">
        <div style="font-weight:600; margin-bottom:8px;">능력치</div>
        <div class="horse-stats" style="justify-content:center;">
          <span>⚡ ${horse.stats.speed}</span>
          <span>💨 ${horse.stats.stamina}</span>
          <span>🔥 ${horse.stats.burst}</span>
        </div>
      </div>
      
      <div style="margin-top:20px; display:flex; gap:8px;">
        <button class="secondary" style="flex:1;" onclick="sellHorse('${horse.id}')">💰 판매</button>
        <button class="ghost" style="flex:1;" onclick="closeModal('horseDetailModal')">닫기</button>
      </div>
    </div>
  `;
  
  openModal('horseDetailModal');
}

// 말 판매
function sellHorse(horseId) {
  const index = GameState.horses.findIndex(h => h.id === horseId);
  if (index === -1) return;
  
  const horse = GameState.horses[index];
  const sellPrice = Math.floor(horse.value * 0.7);
  
  if (confirm(`${horse.name}을(를) ${formatCurrency(sellPrice)}에 판매하시겠습니까?`)) {
    GameState.user.wallet += sellPrice;
    GameState.horses.splice(index, 1);
    
    saveGame();
    updateAllUI();
    closeModal('horseDetailModal');
    alert(`${horse.name} 판매 완료!`);
  }
}

// 시설 업그레이드
function upgradeFacility(type) {
  const level = GameState.facilities[type] || 0;
  const cost = Math.floor(50000 * Math.pow(1.8, level));
  
  if (level >= 10) {
    alert('최대 레벨입니다!');
    return;
  }
  
  if (GameState.user.wallet < cost) {
    alert('DOT가 부족합니다!');
    return;
  }
  
  GameState.user.wallet -= cost;
  GameState.facilities[type] = level + 1;
  
  saveGame();
  updateAllUI();
  
  const names = { barn: '마방', training: '훈련장', medical: '의료실', breeding: '번식장' };
  alert(`${names[type]} Lv.${level} → Lv.${level+1}`);
}

// 최대 말 수
function getMaxHorses() {
  return 5 + (GameState.facilities.barn - 1) * 3;
}

// 탭 전환
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
}

// 모달
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// 게임 시작
document.addEventListener('DOMContentLoaded', initGame);
