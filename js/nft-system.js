/**
 * NFT Horse System v3.0
 * 도트경마 v5.2 - 새로운 NFT 말 시스템
 * 6단계 희귀도, 성별, 혈통, 빛 효과 시스템
 * 순서: 신화 > 전설 > 영웅 > 희귀 > 고급 > 일반
 */

const NFT_ABILITIES = {
  돌발가속: { name: '돌발가속', description: '경주 중 확률적으로 가속', icon: '⚡' },
  철마저항: { name: '철마저항', description: '피로도 증가 감소', icon: '🛡️' },
  막판스퍼트: { name: '막판스퍼트', description: '마지막 15% 구간 가속', icon: '🔥' },
  악천후내성: { name: '악천후내성', description: '악천후 영향 감소', icon: '🌧️' },
  초고속출발: { name: '초고속출발', description: '출발 시 초기 가속', icon: '💨' },
  위기회피: { name: '위기회피', description: '부상 확률 감소', icon: '🏥' }
};

const NFT_GLOW_STYLES = {
  none: { css: '', animation: '' },
  basic: { 
    css: 'box-shadow: 0 0 15px #FFD700, 0 0 30px #FFD70066;',
    animation: 'glow-basic 2s ease-in-out infinite'
  },
  enhanced: { 
    css: 'box-shadow: 0 0 20px #FF6B00, 0 0 40px #FFD700, 0 0 60px #FF6B0066;',
    animation: 'glow-enhanced 1.5s ease-in-out infinite'
  },
  ultimate: { 
    css: 'box-shadow: 0 0 25px #FF00FF, 0 0 50px #00FFFF, 0 0 75px #FFD700, 0 0 100px #FF6B00;',
    animation: 'glow-ultimate 1s ease-in-out infinite'
  }
};

// 순서: 신화 > 전설 > 영웅 > 희귀 > 고급 > 일반
const NFT_RARITIES = {
  MR: { 
    name: '신화', 
    key: 'MR',
    order: 1,
    color: '#FF00FF', 
    buffRatio: 0.30, 
    minStat: 90, 
    maxStat: 100,
    glowLevel: 'ultimate',
    bloodlineChance: 0.60
  },
  LR: { 
    name: '전설', 
    key: 'LR',
    order: 2,
    color: '#FFD700', 
    buffRatio: 0.20, 
    minStat: 80, 
    maxStat: 95,
    glowLevel: 'enhanced',
    bloodlineChance: 0.40
  },
  HR: { 
    name: '영웅', 
    key: 'HR',
    order: 3,
    color: '#E67E22', 
    buffRatio: 0.15, 
    minStat: 65, 
    maxStat: 78,
    glowLevel: 'basic',
    bloodlineChance: 0.20
  },
  SR: { 
    name: '희귀', 
    key: 'SR',
    order: 4,
    color: '#9B59B6', 
    buffRatio: 0.12, 
    minStat: 70, 
    maxStat: 85,
    glowLevel: 'none',
    bloodlineChance: 0.15
  },
  R: { 
    name: '고급', 
    key: 'R',
    order: 5,
    color: '#3498DB', 
    buffRatio: 0.08, 
    minStat: 55, 
    maxStat: 70,
    glowLevel: 'none',
    bloodlineChance: 0.10
  },
  N: { 
    name: '일반', 
    key: 'N',
    order: 6,
    color: '#95A5A6', 
    buffRatio: 0.05, 
    minStat: 40, 
    maxStat: 60,
    glowLevel: 'none',
    bloodlineChance: 0.05
  }
};

const NFT_BOXES = {
  BRONZE: {
    name: '브론즈',
    price: 10,
    failRate: 0.90,
    successRate: 0.10,
    successProbabilities: { N: 0.70, R: 0.30, SR: 0, HR: 0, LR: 0, MR: 0 },
    color: '#cd7f32',
    freePerDay: 1
  },
  SILVER: {
    name: '실버',
    price: 50,
    failRate: 0.80,
    successRate: 0.20,
    successProbabilities: { N: 0.50, R: 0.35, SR: 0.15, HR: 0, LR: 0, MR: 0 },
    color: '#c0c0c0',
    freePerDay: 0
  },
  GOLD: {
    name: '골드',
    price: 200,
    failRate: 0.70,
    successRate: 0.30,
    successProbabilities: { N: 0.10, R: 0.30, SR: 0.30, HR: 0.20, LR: 0.10, MR: 0 },
    color: '#ffd700',
    freePerDay: 0
  },
  DIAMOND: {
    name: '다이아몬드',
    price: 1000,
    failRate: 0.60,
    successRate: 0.40,
    successProbabilities: { N: 0, R: 0.10, SR: 0.25, HR: 0.30, LR: 0.25, MR: 0.10 },
    color: '#b9f2ff',
    freePerDay: 0
  }
};

const NFT_PREFIXES = [
  '빠른', '강인', '용감', '당돌', '날쌘', '근면', '성난', '침착', '뛰어난', '传奇적인',
  '위대한', '신속한', '활발한', '점질한', '끈질긴', '불같은', '차분한', '무적의',
  '전설의', '신화의', '금빛은', '은빛의', '폭풍의', '천둥의', '불꽃의', '서리의', '바다의', '산의'
];

const NFT_SUFFIXES = [
  '질주', '질풍', '경마', '군마', '번개', '폭풍', '천둥', '불꽃', '서리', '돌풍',
  '바람', 'молот', '疾風', '電光', '烈焰', '冰霜', '雷霆', '暴風', '神馬', '천마'
];

const NFT_GENDERS = ['수', '암'];

// 순서: 신화 > 전설 > 영웅 > 희귀 > 고급 > 일반
const NFT_RARITY_ORDER = ['MR', 'LR', 'HR', 'SR', 'R', 'N'];

class NFTSystem {
  constructor() {
    this.myNFTs = [];
    this.marketplaceNFTs = [];
    this.lastFreeBoxDate = null;
    this.freeBoxUsed = false;
    this.loadFromLocalStorage();
  }

  checkFirebaseReady() {
    return window.db && window.uid;
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('myNFTs', JSON.stringify(this.myNFTs));
      localStorage.setItem('nftFreeBox', JSON.stringify({
        date: this.lastFreeBoxDate,
        used: this.freeBoxUsed
      }));
    } catch (err) {
      console.error('[NFT] localStorage 저장 실패:', err);
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('myNFTs');
      if (stored) this.myNFTs = JSON.parse(stored);
      
      const freeData = JSON.parse(localStorage.getItem('nftFreeBox') || '{}');
      this.lastFreeBoxDate = freeData.date;
      this.freeBoxUsed = freeData.used;
      
      this.checkFreeBoxReset();
    } catch (err) {
      this.myNFTs = [];
    }
  }

  checkFreeBoxReset() {
    const today = new Date().toDateString();
    if (this.lastFreeBoxDate !== today) {
      this.freeBoxUsed = false;
      this.lastFreeBoxDate = today;
      this.saveToLocalStorage();
    }
  }

  canUseFreeBox() {
    this.checkFreeBoxReset();
    return !this.freeBoxUsed;
  }

  useFreeBox() {
    if (!this.canUseFreeBox()) return false;
    this.freeBoxUsed = true;
    this.saveToLocalStorage();
    return true;
  }

  getFreeBoxRemainingTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}시간 ${minutes}분`;
  }

  generateKoreanName(id) {
    const hash = this.simpleHash(id);
    const prefixIndex = hash % NFT_PREFIXES.length;
    const suffixIndex = Math.floor(hash / NFT_PREFIXES.length) % NFT_SUFFIXES.length;
    return NFT_PREFIXES[prefixIndex] + NFT_SUFFIXES[suffixIndex];
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  generateUniqueColor(nftId) {
    const hash = this.simpleHash(nftId);
    const hue = hash % 360;
    const saturation = 50 + (hash % 40);
    const lightness = 40 + (hash % 30);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  getRandomGender() {
    return NFT_GENDERS[Math.floor(Math.random() * NFT_GENDERS.length)];
  }

  determineBloodline(rarity) {
    const rarityData = NFT_RARITIES[rarity.key];
    return Math.random() < rarityData.bloodlineChance;
  }

  getRandomAbility() {
    const abilities = Object.keys(NFT_ABILITIES);
    return abilities[Math.floor(Math.random() * abilities.length)];
  }

  getRandomRarityWithFailure(boxType) {
    const box = NFT_BOXES[boxType];
    
    if (Math.random() < box.failRate) {
      return { isSuccess: false, rarity: null };
    }
    
    const rand = Math.random();
    let cumulative = 0;
    const probs = box.successProbabilities;
    
    for (const key of NFT_RARITY_ORDER) {
      cumulative += probs[key] || 0;
      if (rand < cumulative) {
        return { isSuccess: true, rarity: { key, ...NFT_RARITIES[key] } };
      }
    }
    
    return { isSuccess: true, rarity: { key: 'N', ...NFT_RARITIES.N } };
  }

  getRandomStats(rarity) {
    const gender = this.getRandomGender();
    const baseStats = {
      speed: Math.floor(Math.random() * (rarity.maxStat - rarity.minStat + 1)) + rarity.minStat,
      stamina: Math.floor(Math.random() * (rarity.maxStat - rarity.minStat + 1)) + rarity.minStat,
      burst: Math.floor(Math.random() * (rarity.maxStat - rarity.minStat + 1)) + rarity.minStat
    };
    
    if (gender === '수') {
      baseStats.speed = Math.min(100, baseStats.speed + Math.floor(Math.random() * 5));
      baseStats.burst = Math.min(100, baseStats.burst + Math.floor(Math.random() * 5));
    } else {
      baseStats.stamina = Math.min(100, baseStats.stamina + Math.floor(Math.random() * 5));
    }
    
    return baseStats;
  }

  // 서버에서 NFT 생성 (Cloud Functions 연동)
  async createNFTFromServer(boxType = 'BRONZE', isFree = false) {
    if (!window.firebaseFunctions) {
      console.warn('[NFT] 서버 함수 사용 불가, 로컬 생성으로 대체');
      return this.createNFT(boxType, isFree);
    }

    try {
      const createNFT = window.firebaseFunctions.httpsCallable('createNFT');
      const result = await createNFT({ boxType, isFree });
      
      if (result.data.success) {
        const nft = result.data.nft;
        nft.imageUrl = await this.generateNFTImage(nft);
        
        // 로컬에도 저장
        this.myNFTs.push(nft);
        this.saveToLocalStorage();
        
        // wallet 업데이트 (서버에서 이미 처리됨)
        if (!isFree) {
          window.wallet = result.data.newBalance || window.wallet;
          this.updateWalletDisplay();
        }
        
        console.log('[NFT] 서버에서 생성 완료:', nft.rarity.name);
        return nft;
      } else {
        // 실패
        return {
          isFail: true,
          boxType,
          isFree,
          message: result.data.message || '실패했습니다'
        };
      }
    } catch (err) {
      console.error('[NFT] 서버 생성 실패:', err);
      // 서버 실패 시 로컬 생성으로 대체
      return this.createNFT(boxType, isFree);
    }
  }

  // 로컬 NFT 생성 (폴백)
  async createNFT(boxType = 'BRONZE', isFree = false) {
    const box = NFT_BOXES[boxType];
    if (!isFree && (!window.wallet || window.wallet < box.price)) {
      throw new Error('잔액 부족');
    }

    const { isSuccess, rarity } = this.getRandomRarityWithFailure(boxType);
    
    if (!isSuccess || !rarity) {
      return { 
        isFail: true, 
        boxType, 
        isFree,
        message: '아쉽게도 실패했습니다... 다음 기회에!' 
      };
    }

    const nftId = 'nft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const gender = this.getRandomGender();
    const hasBloodline = this.determineBloodline(rarity);
    const ability = hasBloodline ? this.getRandomAbility() : null;
    
    const nft = {
      id: nftId,
      type: 'HORSE',
      name: this.generateKoreanName(nftId),
      rarity: rarity,
      gender: gender,
      bloodline: hasBloodline,
      ability: ability,
      abilityData: ability ? NFT_ABILITIES[ability] : null,
      glowLevel: rarity.glowLevel,
      color: this.generateUniqueColor(nftId),
      stats: this.getRandomStats(rarity),
      createdAt: Date.now(),
      ownerId: window.uid || 'anonymous',
      boxType: boxType,
      isFree: isFree,
      isListed: false,
      listedPrice: 0,
      exchangeCode: null,
      exchangeMeta: null,
      parents: null,
      // [v5.3 Phase4] 경주 전적 & 가치 상승
      wins: 0,
      races: 0,
      marketValue: 0      // getNFTMarketValue() 계산값 캐시
    };

    nft.imageUrl = await this.generateNFTImage(nft);

    if (!isFree) {
      window.wallet -= box.price;
      this.updateWalletDisplay();
    }

    this.myNFTs.push(nft);
    this.saveToLocalStorage();

    if (this.checkFirebaseReady()) {
      try {
        await window.db.collection('users').doc(window.uid).collection('nfts').doc(nftId).set(nft);
        console.log('[NFT] Firestore에 저장됨:', nftId);
      } catch (err) {
        console.warn('[NFT] Firebase 저장 실패, localStorage만 사용:', err.message);
        // 사용자에게 알림
        if (typeof alert === 'function') {
          alert('⚠️ NFT가 localStorage에만 저장되었습니다.\n네트워크 연결을 확인해 주세요.\n계속这样的话 NFT가 유실될 수 있습니다.');
        }
      }
    }

    return nft;
  }

  async generateNFTImage(nft) {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');

      // 배경 그라데이션
      const bgGradient = ctx.createRadialGradient(150, 150, 0, 150, 150, 200);
      if (nft.glowLevel === 'ultimate') {
        bgGradient.addColorStop(0, '#1a0a2e');
        bgGradient.addColorStop(0.5, '#16082a');
        bgGradient.addColorStop(1, '#0d0518');
      } else if (nft.glowLevel === 'enhanced') {
        bgGradient.addColorStop(0, '#1a1a0a');
        bgGradient.addColorStop(0.5, '#16160a');
        bgGradient.addColorStop(1, '#0d0d05');
      } else {
        bgGradient.addColorStop(0, this.lightenColor(nft.color, 40));
        bgGradient.addColorStop(1, this.darkenColor(nft.color, 20));
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 300, 300);

      // 빛 효과 (영웅 이상)
      if (nft.glowLevel === 'ultimate') {
        this.drawAuroraEffect(ctx, 150, 150);
      } else if (nft.glowLevel === 'enhanced') {
        this.drawGlowEffect(ctx, 150, 150, nft.rarity.color);
      } else if (nft.glowLevel === 'basic') {
        this.drawBasicGlow(ctx, 150, 150, nft.rarity.color);
      }

      // 말 그리기
      this.drawCuteHorse(ctx, 150, 160, nft.color, nft.gender, nft.glowLevel, nft.rarity.key);

      // 상단 힌지
      ctx.fillStyle = nft.rarity.color;
      ctx.fillRect(0, 0, 300, 12);
      ctx.fillRect(0, 288, 300, 12);

      // 말 이름
      ctx.font = 'bold 16pxPretendard, Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(nft.name, 150, 265);
      ctx.shadowBlur = 0;

      //性别 및 혈통
      ctx.font = 'bold 12pxPretendard, Arial, sans-serif';
      const genderText = nft.gender === '수' ? '♂ 수' : '♀ 암';
      const bloodlineText = nft.bloodline ? ' 🩸혈통' : '';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(genderText + bloodlineText, 150, 282);

      // 희귀도 배지
      if (nft.glowLevel !== 'none') {
        this.drawRarityBadge(ctx, nft.glowLevel, nft.rarity.name, nft.rarity.color);
      }

      resolve(canvas.toDataURL('image/png'));
    });
  }

  drawAuroraEffect(ctx, x, y) {
    const colors = ['#FF00FF', '#00FFFF', '#FFD700', '#FF6B00', '#00FF00'];
    for (let i = 0; i < 5; i++) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 150 + i * 20);
      gradient.addColorStop(0, colors[i] + '40');
      gradient.addColorStop(0.5, colors[i] + '20');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 300, 300);
    }
  }

  drawGlowEffect(ctx, x, y, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 120);
    gradient.addColorStop(0, color + '60');
    gradient.addColorStop(0.5, color + '30');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
  }

  drawBasicGlow(ctx, x, y, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 80);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
  }

  drawRarityBadge(ctx, glowLevel, rarityName, color) {
    const y = 35;
    ctx.font = 'bold 11pxPretendard, Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // 배지 배경
    ctx.fillStyle = color + '40';
    ctx.beginPath();
    ctx.roundRect(100, y - 10, 100, 20, 10);
    ctx.fill();
    
    // 테두리
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(100, y - 10, 100, 20, 10);
    ctx.stroke();
    
    // 텍스트
    const icon = glowLevel === 'ultimate' ? '✨' : glowLevel === 'enhanced' ? '★' : '☆';
    ctx.fillStyle = color;
    ctx.fillText(icon + ' ' + rarityName + ' ' + icon, 150, y + 4);
  }

  drawCuteHorse(ctx, x, y, color, gender, glowLevel, rarityKey) {
    ctx.save();
    ctx.translate(x, y);

    const isMale = gender === '수';
    const scale = isMale ? 1.1 : 0.9;
    ctx.scale(scale, scale);

    // 빛 효과 (뒤)
    if (glowLevel !== 'none') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
    }

    // 몸체
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 10, 55, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 몸체 하단阴影
    ctx.fillStyle = this.darkenColor(color, 20);
    ctx.beginPath();
    ctx.ellipse(0, 35, 45, 15, 0, 0, Math.PI);
    ctx.fill();

    ctx.shadowBlur = 0;

    // 가슴
    ctx.fillStyle = this.lightenColor(color, 15);
    ctx.beginPath();
    ctx.ellipse(-25, 20, 25, 28, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 목
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-40, -10);
    ctx.quadraticCurveTo(-55, -30, -45, -55);
    ctx.quadraticCurveTo(-35, -70, -20, -75);
    ctx.lineTo(-10, -70);
    ctx.quadraticCurveTo(-20, -40, -15, -10);
    ctx.closePath();
    ctx.fill();

    // 귀
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-30, -70, 8, 18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-10, -75, 8, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 귀 내부
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.ellipse(-30, -70, 4, 12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-10, -75, 4, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 얼굴 (앞)
    ctx.fillStyle = this.lightenColor(color, 10);
    ctx.beginPath();
    ctx.ellipse(10, -45, 30, 25, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 볼 (귀여운 듯)
    ctx.fillStyle = '#FF9999';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(-5, -35, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -40, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 눈 (크고 귀여운 카투스 스타일)
    const eyeY = -50;
    
    // 왼쪽 눈
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, eyeY, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(2, eyeY + 2, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, eyeY - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽 눈
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(20, eyeY - 3, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.ellipse(22, eyeY - 1, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(18, eyeY - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // 눈썹
    ctx.strokeStyle = this.darkenColor(color, 30);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, eyeY - 18);
    ctx.quadraticCurveTo(0, eyeY - 22, 8, eyeY - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, eyeY - 21);
    ctx.quadraticCurveTo(20, eyeY - 25, 28, eyeY - 21);
    ctx.stroke();

    // 코
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.ellipse(10, -30, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 입 (미소)
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, -22, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // 갈기 (성별에 따라)
    ctx.fillStyle = isMale ? this.darkenColor(color, 10) : this.lightenColor(color, 20);
    if (isMale) {
      // 수: 짧고 Contractors 갈기
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-35 + i * 8, -65);
        ctx.quadraticCurveTo(-35 + i * 8, -50, -30 + i * 8, -45);
        ctx.lineTo(-28 + i * 8, -50);
        ctx.quadraticCurveTo(-33 + i * 8, -60, -33 + i * 8, -65);
        ctx.fill();
      }
    } else {
      // 암: 긴 갈기 + 리본
      ctx.beginPath();
      ctx.moveTo(-30, -65);
      ctx.quadraticCurveTo(-40, -40, -35, -20);
      ctx.lineTo(-25, -20);
      ctx.quadraticCurveTo(-30, -40, -20, -65);
      ctx.fill();
      
      // 리본
      ctx.fillStyle = '#FF6B9D';
      ctx.beginPath();
      ctx.moveTo(-30, -65);
      ctx.lineTo(-38, -72);
      ctx.lineTo(-30, -70);
      ctx.lineTo(-22, -72);
      ctx.closePath();
      ctx.fill();
    }

    // 다리 (앞)
    ctx.fillStyle = color;
    const legPositions = [
      { x: -30, y: 40, angle: -0.1 },
      { x: -10, y: 42, angle: 0.1 },
      { x: 10, y: 42, angle: -0.1 },
      { x: 30, y: 40, angle: 0.1 }
    ];
    legPositions.forEach(leg => {
      ctx.save();
      ctx.translate(leg.x, leg.y);
      ctx.rotate(leg.angle);
      ctx.fillRect(-6, 0, 12, 35);
      ctx.fillStyle = this.darkenColor(color, 15);
      ctx.beginPath();
      ctx.ellipse(0, 35, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.restore();
    });

    // 꼬리
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.quadraticCurveTo(75, 0, 80, 25);
    ctx.quadraticCurveTo(85, 50, 70, 60);
    ctx.stroke();
    
    // 꼬리 털 끝
    ctx.strokeStyle = this.lightenColor(color, 20);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(75, 15);
    ctx.quadraticCurveTo(85, 25, 82, 40);
    ctx.stroke();

    // 날개 (영웅 이상)
    if (glowLevel !== 'none') {
      const wingColor = glowLevel === 'ultimate' ? '#FFD700' : 
                       glowLevel === 'enhanced' ? '#87CEEB' : '#C0C0C0';
      ctx.fillStyle = wingColor + 'CC';
      
      // 왼쪽 날개
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.quadraticCurveTo(-80, -20, -70, -40);
      ctx.quadraticCurveTo(-60, -30, -55, -35);
      ctx.quadraticCurveTo(-65, -15, -50, 0);
      ctx.fill();
      
      // 오른쪽 날개
      ctx.beginPath();
      ctx.moveTo(50, -5);
      ctx.quadraticCurveTo(80, -25, 70, -45);
      ctx.quadraticCurveTo(60, -35, 55, -40);
      ctx.quadraticCurveTo(65, -20, 50, -5);
      ctx.fill();
    }

    ctx.restore();
  }

  lightenColor(hslColor, percent) {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return hslColor;
    const h = parseInt(match[1]);
    const s = parseInt(match[2]);
    const l = Math.min(100, parseInt(match[3]) + percent);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  darkenColor(hslColor, percent) {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return hslColor;
    const h = parseInt(match[1]);
    const s = parseInt(match[2]);
    const l = Math.max(0, parseInt(match[3]) - percent);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  updateWalletDisplay() {
    const walletEl = document.getElementById('wallet');
    if (walletEl && window.fmt) {
      walletEl.textContent = window.fmt(window.wallet || 0);
    }
  }

  getNFTBuff(nft) {
    if (!nft || nft.type !== 'HORSE') return { speed: 0, stamina: 0, burst: 0 };
    const ratio = nft.rarity.buffRatio;
    return {
      speed: Math.floor(nft.stats.speed * ratio),
      stamina: Math.floor(nft.stats.stamina * ratio),
      burst: Math.floor(nft.stats.burst * ratio)
    };
  }

  selectNFTForRace(nftId) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft || nft.type !== 'HORSE') return null;
    window.selectedNFTForRace = nft;
    return nft;
  }

  // ── [v5.3 Phase4] NFT 시장 가치 계산 ──────────────────────
  // 기준가 × 혈통 1.5배 × (1 + wins×5%, 최대 200%)
  // ── [v5.3 Phase4] NFT 가치 산정 공식 (로드맵 §5 준수) ──────────
  //  가치 = 기준DOT × (1 + 혈통보너스) × (1 + 우승프리미엄) × (1 + 스탯프리미엄) × (1 + 강화보너스)
  //  • 기준DOT: 등급별 기본값 (N~MR)
  //  • 혈통 보너스: +30% (bloodline=true)
  //  • 우승 프리미엄: wins × 5%, 최대 200%
  //  • 스탯 프리미엄: 평균 스탯 80 이상 +5%, 90 이상 +15%
  //  • 강화 보너스: enhanceLevel × 8%
  getNFTMarketValue(nft) {
    const rarityBase = {
      MR: 250000, LR: 60000, HR: 6000,
      SR: 1500,   R:  500,   N:  120
    };
    const rKey = nft.rarity?.key || (typeof nft.rarity === 'string' ? nft.rarity : 'N');
    let base = rarityBase[rKey] || 120;

    // ① 혈통 보너스 +30%
    if (nft.bloodline) base = Math.floor(base * 1.30);

    // ② 우승 프리미엄: wins × 5%, 최대 200%
    const wins = nft.wins || 0;
    const winPremium = Math.min(wins * 0.05, 2.0);

    // ③ 스탯 프리미엄
    let statPremium = 0;
    if (nft.stats) {
      const avgStat = Math.round((( nft.stats.speed||0) + (nft.stats.stamina||0) + (nft.stats.burst||0)) / 3);
      if      (avgStat >= 90) statPremium = 0.15;
      else if (avgStat >= 80) statPremium = 0.05;
    }

    // ④ 강화 보너스: enhanceLevel × 8%
    const enhanceBonus = Math.min((nft.enhanceLevel || 0) * 0.08, 0.80); // 최대 +80% (Lv10)

    const finalValue = Math.round(base * (1 + winPremium) * (1 + statPremium) * (1 + enhanceBonus));
    return finalValue;
  }

  // NFT 경주 결과 업데이트
  updateNFTRaceResult(nftId, won) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return;
    nft.races = (nft.races || 0) + 1;
    if (won) nft.wins = (nft.wins || 0) + 1;
    nft.marketValue = this.getNFTMarketValue(nft);
    this.saveToLocalStorage();
    // Firebase 동기화
    if (this.checkFirebaseReady() && nft.ownerId === window.uid) {
      window.db.collection('users').doc(window.uid)
        .collection('nfts').doc(nft.id)
        .update({ wins: nft.wins, races: nft.races, marketValue: nft.marketValue })
        .catch(e => console.warn('[NFT] wins 동기화 실패:', e));
    }
  }

  generateExchangeCode(nftId) {
    return 'EX-' + nftId.slice(4, 12).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  // [v5.3 Phase4] askPriceDot: 0=무료증여, >0=유료거래
  async setExchangeCode(nftId, askPriceDot = 0) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false };

    const code = this.generateExchangeCode(nftId);
    nft.exchangeCode = code;

    // 교환 메타데이터 저장
    nft.exchangeMeta = {
      askPrice:    Math.max(0, Math.floor(Number(askPriceDot) || 0)),
      marketValue: this.getNFTMarketValue(nft),
      grade:       nft.rarity?.key || 'N',
      wins:        nft.wins || 0,
      bloodline:   nft.bloodline || false,
      createdAt:   Date.now()
    };

    this.saveToLocalStorage();

    // Firebase 동기화
    if (this.checkFirebaseReady() && nft.ownerId === window.uid) {
      try {
        await window.db.collection('users').doc(window.uid)
          .collection('nfts').doc(nft.id)
          .update({ exchangeCode: code, exchangeMeta: nft.exchangeMeta });
      } catch(e) { console.warn('[NFT] 교환코드 Firebase 저장 실패:', e); }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(()=>{});
    }

    return { success: true, code, meta: nft.exchangeMeta };
  }

  // [v5.3 Phase4] 교환 코드 사용 — DOT 자동 차감 + 가격 미리보기
  async redeemExchangeCode(code) {
    const normalizedCode = code.trim().toUpperCase();

    // 내 NFT에 동일 코드 있으면 거부
    if (this.myNFTs.find(n => n.exchangeCode === normalizedCode)) {
      return { success: false, message: '본인 소유 NFT 코드는 사용 불가' };
    }

    if (!this.checkFirebaseReady()) {
      return { success: false, message: '네트워크 연결 필요' };
    }

    try {
      const snapshot = await window.db.collectionGroup('nfts')
        .where('exchangeCode', '==', normalizedCode).get();

      if (snapshot.empty) {
        return { success: false, message: '유효하지 않은 코드입니다' };
      }

      const sourceDoc  = snapshot.docs[0];
      const sourceNft  = sourceDoc.data();
      const meta       = sourceNft.exchangeMeta || {};
      const askPrice   = meta.askPrice || 0;
      const marketVal  = meta.marketValue || this.getNFTMarketValue(sourceNft);

      // [v5.3 Phase4] 가격 확인 & DOT 차감
      if (askPrice > 0) {
        const myWallet = window.wallet || 0;
        if (myWallet < askPrice) {
          return {
            success: false,
            message: `DOT 부족! 필요: ${askPrice.toLocaleString()} DOT / 보유: ${myWallet.toLocaleString()} DOT`
          };
        }
        // DOT 차감 (구매자)
        window.wallet = myWallet - askPrice;
        this.updateWalletDisplay();
        // TODO: 판매자에게 DOT 이전은 Firebase Function에서 처리
        console.log('[NFT P2P] 구매 완료. 차감:', askPrice, 'DOT');
      }

      // NFT 소유권 이전
      const newNft = { ...sourceNft };
      newNft.id          = 'nft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      newNft.exchangeCode = null;
      newNft.exchangeMeta = null;
      newNft.ownerId     = window.uid;
      newNft.createdAt   = Date.now();
      newNft.prevOwner   = sourceNft.ownerId;   // 이전 소유자 기록

      this.myNFTs.push(newNft);
      this.saveToLocalStorage();

      return {
        success:  true,
        nft:      newNft,
        askPrice,
        marketValue: marketVal
      };

    } catch (err) {
      console.log('[NFT] 코드 교환 오류:', err);
      return { success: false, message: '오류 발생: ' + err.message };
    }
  }

  // [v5.3 Phase4] 환전 가치 = getNFTMarketValue() × 0.9 (10% 수수료)
  convertToMoney(nftId) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false };

    // 시장 가치 기반 환전 (우승·혈통 프리미엄 반영)
    const marketValue = this.getNFTMarketValue(nft);
    const fee    = Math.floor(marketValue * 0.1);
    const actual = marketValue - fee;

    window.wallet = (window.wallet || 0) + actual;
    this.myNFTs   = this.myNFTs.filter(n => n.id !== nftId);
    this.saveToLocalStorage();
    this.updateWalletDisplay();

    console.log('[NFT] 환전:', nft.name, '시장가치:', marketValue, '수령:', actual, 'DOT');
    return { success: true, amount: actual, fee, marketValue };
  }

  // ── [v5.3 Phase4] NFT 강화 ─────────────────────────────────────
  // DOTT 소비: Lv0→1: 300, Lv1→2: 450, ... × 1.5 배씩 증가
  // 성공 시: 스탯 +3 (전 능력치), 가치 +enhanceLevel×8%
  // 최대 강화 레벨: 10
  ENHANCE_MAX_LEVEL = 10;
  ENHANCE_BASE_DOTT = 300;

  getEnhanceCost(nft) {
    const level = nft.enhanceLevel || 0;
    if (level >= this.ENHANCE_MAX_LEVEL) return null;
    return Math.round(this.ENHANCE_BASE_DOTT * Math.pow(1.5, level));
  }

  enhanceNFT(nftId) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false, message: 'NFT를 찾을 수 없습니다' };

    const level = nft.enhanceLevel || 0;
    if (level >= this.ENHANCE_MAX_LEVEL) {
      return { success: false, message: '최대 강화 레벨입니다 (Lv.10)' };
    }

    const cost = this.getEnhanceCost(nft);

    // stable-manager의 StableState.dottWallet 접근
    const stableState = window.StableState || window._StableState;
    const dottWallet  = (stableState?.dottWallet) || 0;
    if (dottWallet < cost) {
      return { success: false, message: 'DOTT 부족! 필요: ' + cost + ' DOTT (보유: ' + dottWallet + ' DOTT)' };
    }

    // DOTT 차감
    if (stableState) {
      stableState.dottWallet -= cost;
      if (typeof window.addDottHistory === 'function') {
        window.addDottHistory('nft_enhance', -cost, 'NFT 강화: ' + (nft.name||'?') + ' Lv.' + level + '→Lv.' + (level+1));
      }
    }

    // 강화 적용
    nft.enhanceLevel = level + 1;
    const statGain = 3;
    if (nft.stats) {
      nft.stats.speed   = Math.min(100, (nft.stats.speed   || 0) + statGain);
      nft.stats.stamina = Math.min(100, (nft.stats.stamina || 0) + statGain);
      nft.stats.burst   = Math.min(100, (nft.stats.burst   || 0) + statGain);
    }

    // 가치 갱신
    nft.marketValue = this.getNFTMarketValue(nft);

    this.saveToLocalStorage();

    // Firebase 동기화
    if (this.checkFirebaseReady() && nft.ownerId === window.uid) {
      window.db.collection('users').doc(window.uid)
        .collection('nfts').doc(nft.id)
        .update({ enhanceLevel: nft.enhanceLevel, stats: nft.stats, marketValue: nft.marketValue })
        .catch(e => console.warn('[NFT] 강화 동기화 실패:', e));
    }

    return {
      success: true,
      newLevel: nft.enhanceLevel,
      statGain,
      newMarketValue: nft.marketValue,
      cost
    };
  }

  listNFT(nftId, price) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false };
    
    nft.isListed = true;
    nft.listedPrice = price;
    this.saveToLocalStorage();
    
    return { success: true };
  }

  buyFromMarketplace(nftId, price) {
    if (!window.wallet || window.wallet < price) {
      return { success: false, message: '잔액 부족' };
    }
    
    window.wallet -= price;
    this.updateWalletDisplay();
    
    return { success: true };
  }
}

let nftSystem = null;

async function initNFTSystem() {
  if (nftSystem) return nftSystem;
  
  nftSystem = new NFTSystem();
  console.log('[NFT System v3.0] 초기화 완료');
  
  nftSystem.loadFromLocalStorage();
  
  let retries = 0;
  while (!window.db && retries < 20) {
    await new Promise(resolve => setTimeout(resolve, 500));
    retries++;
  }
  
  if (window.db && window.uid) {
    try {
      await loadNFTsFromFirestore();
    } catch (err) {
      console.log('[NFT] Firebase 로드 실패');
    }
  }
  
  return nftSystem;
}

async function loadNFTsFromFirestore() {
  if (!nftSystem || !window.db || !window.uid) return;
  
  try {
    const snapshot = await window.db.collection('users').doc(window.uid).collection('nfts').get();
    nftSystem.myNFTs = [];
    snapshot.forEach(doc => {
      nftSystem.myNFTs.push({ id: doc.id, ...doc.data() });
    });
    nftSystem.saveToLocalStorage();
  } catch (err) {
    console.log('[NFT] Firestore 로드 오류:', err);
  }
}

function renderNFTTab() {
  const container = document.getElementById('nftTabContent');
  if (!container) return;
  
  container.innerHTML = `
    <div style="padding: 15px;">
      <h3 style="margin: 0 0 15px 0; color: #ffd700;">🎁 랜덤 박스</h3>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        ${renderBoxCard('BRONZE')}
        ${renderBoxCard('SILVER')}
        ${renderBoxCard('GOLD')}
        ${renderBoxCard('DIAMOND')}
      </div>
      
      <div id="freeBoxStatus" style="background: #1a1a2e; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
        ${renderFreeBoxStatus()}
      </div>
      
      <h3 style="margin: 20px 0 15px 0; color: #4ECDC4;">📦 내 보관함 (${nftSystem?.myNFTs?.length || 0}개)</h3>
      <div id="nftInventory"></div>
      
      <h3 style="margin: 20px 0 15px 0; color: #9B59B6;">🔄 DOT 전환</h3>
      <div id="nftConvertList"></div>
      
      <h3 style="margin: 20px 0 15px 0; color: #e74c3c;">🔀 NFT 교환</h3>
      <div style="background: #1a1a2e; padding: 15px; border-radius: 8px;">
        <input type="text" id="exchangeCodeInput" placeholder="교환 코드 입력" style="width: 70%; padding: 10px; border-radius: 6px; border: 1px solid #333; background: #0d1330; color: #fff;">
        <button onclick="redeemExchangeCode()" style="width: 25%; padding: 10px; border-radius: 6px; background: #e74c3c; color: #fff; border: none;">교환</button>
      </div>
    </div>
  `;
  
  renderNFTInventory();
  renderNFTConvertList();
}

function renderBoxCard(boxType) {
  const box = NFT_BOXES[boxType];
  return `
    <div style="background: linear-gradient(135deg, ${box.color}22, ${box.color}44); border: 2px solid ${box.color}; border-radius: 12px; padding: 15px; text-align: center; cursor: pointer; transition: transform 0.2s;" onclick="openBox('${boxType}')">
      <div style="font-size: 24px; margin-bottom: 5px;">${getBoxEmoji(boxType)}</div>
      <div style="font-weight: bold; color: ${box.color};">${box.name} 박스</div>
      <div style="font-size: 14px; color: #888; margin-top: 5px;">${box.price} DOT</div>
      <div style="font-size: 11px; color: #ff7a9e; margin-top: 3px;">실패 ${Math.round(box.failRate * 100)}%</div>
      <div style="font-size: 11px; color: #9df7c7; margin-top: 3px;">성공 ${Math.round(box.successRate * 100)}%</div>
    </div>
  `;
}

function getBoxEmoji(boxType) {
  const emojis = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', DIAMOND: '💎' };
  return emojis[boxType] || '📦';
}

function getBoxProbText(boxType) {
  const box = NFT_BOXES[boxType];
  const texts = [];
  
  for (const key of NFT_RARITY_ORDER) {
    const prob = box.successProbabilities[key];
    if (prob > 0) {
      texts.push(`${NFT_RARITIES[key].name} ${Math.round(prob * 100)}%`);
    }
  }
  
  return texts.join(', ');
}

function renderFreeBoxStatus() {
  if (!nftSystem) return '로딩 중...';
  
  if (nftSystem.canUseFreeBox()) {
    return `<span style="color: #9df7c7;">✅ 무료 브론즈 박스 사용 가능!</span>
            <button onclick="openBox('BRONZE', true)" style="margin-left: 10px; padding: 8px 16px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer;">무료 오픈</button>`;
  } else {
    return `<span style="color: #ff7a9e;">❌ 오늘의 무료 브론즈 박스 사용 완료</span>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">다음 무료 오픈까지: ${nftSystem.getFreeBoxRemainingTime()}</div>`;
  }
}

async function openBox(boxType, isFree = false) {
  if (!nftSystem) {
    await initNFTSystem();
  }
  
  const box = NFT_BOXES[boxType];
  
  if (isFree) {
    if (boxType !== 'BRONZE') {
      alert('무료 박스는 브론즈만 가능합니다');
      return;
    }
    if (!nftSystem.canUseFreeBox()) {
      alert('오늘의 무료 브론즈 박스를 이미 사용했습니다\n다음 오픈까지: ' + nftSystem.getFreeBoxRemainingTime());
      return;
    }
  } else {
    if (!window.wallet || window.wallet < box.price) {
      alert('잔액이 부족합니다!\n필요: ' + box.price + ' DOT\n보유: ' + (window.wallet || 0) + ' DOT');
      return;
    }
  }
  
  showBoxOpeningAnimation(boxType, async () => {
    try {
      // 서버 NFT 생성 시도 (서버 사용 가능 시)
      let result;
      if (window.firebaseFunctions) {
        result = await nftSystem.createNFTFromServer(boxType, isFree);
      } else {
        result = await nftSystem.createNFT(boxType, isFree);
      }
      
      if (result.isFail) {
        showNFTFailResult(result);
      } else {
        if (isFree) {
          nftSystem.useFreeBox();
        }
        showNFTOpenResult(result);
      }
      renderNFTTab();
    } catch (err) {
      alert('박스 오픈 실패: ' + err.message);
    }
  });
}

function showBoxOpeningAnimation(boxType, callback) {
  const overlay = document.createElement('div');
  overlay.id = 'boxOpeningOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,30,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
  
  const box = NFT_BOXES[boxType];
  const emojis = ['🎁', '📦', '👜', '🎀', '✨', '🌟'];
  
  let count = 0;
  const interval = setInterval(() => {
    overlay.innerHTML = `
      <div style="font-size: 80px; animation: shake 0.5s infinite;">${emojis[count % emojis.length]}</div>
      <div style="color: ${box.color}; font-size: 24px; font-weight: bold; margin-top: 20px;">${box.name} 박스 오픈 중...</div>
      <div style="color: #888; margin-top: 10px;">${'.'.repeat(count % 4)}</div>
    `;
    count++;
  }, 200);
  
  overlay.innerHTML += `
    <style>
      @keyframes shake {
        0%, 100% { transform: translateX(0) rotate(0); }
        25% { transform: translateX(-10px) rotate(-5deg); }
        75% { transform: translateX(10px) rotate(5deg); }
      }
    </style>
  `;
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    clearInterval(interval);
    overlay.remove();
    callback();
  }, 1500);
}

function showNFTFailResult(result) {
  const modal = document.createElement('div');
  modal.id = 'nftFailModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,30,.95);display:flex;align-items:center;justify-content:center;z-index:99999;';
  
  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #333, #555); border-radius: 20px; padding: 30px; text-align: center; max-width: 350px; animation: shake 0.5s;">
      <style>
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
      <div style="font-size: 64px; margin-bottom: 10px;">😢</div>
      <div style="font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 10px;">아쉽게도 실패...</div>
      <div style="font-size: 16px; color: #aaa; margin-bottom: 20px;">${result.boxType} 박스에서 실패했습니다<br>다음 기회에 다시 도전하세요!</div>
      <button onclick="document.getElementById('nftFailModal').remove()" style="padding: 12px 30px; background: #666; color: #fff; border: none; border-radius: 25px; font-weight: bold; cursor: pointer;">확인</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function showNFTOpenResult(nft) {
  const modal = document.createElement('div');
  modal.id = 'nftResultModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,30,.95);display:flex;align-items:center;justify-content:center;z-index:99999;';
  
  const rarityColors = {
    MR: 'linear-gradient(135deg, #FF00FF, #00FFFF)',
    LR: 'linear-gradient(135deg, #FFD700, #FF6B00)',
    HR: 'linear-gradient(135deg, #E67E22, #F39C12)',
    SR: 'linear-gradient(135deg, #9B59B6, #E74C3C)',
    R: 'linear-gradient(135deg, #3498DB, #2ECC71)',
    N: 'linear-gradient(135deg, #95A5A6, #7F8C8D)'
  };
  
  const rarityText = {
    MR: '🎉 신화 !!!',
    LR: '✨ 전설 !!',
    HR: '⭐ 영웅 !',
    SR: '♦ 희귀 ♦',
    R: '▣ 고급',
    N: '일반'
  };
  
  const glowStyle = NFT_GLOW_STYLES[nft.glowLevel] || NFT_GLOW_STYLES.none;
  
  modal.innerHTML = `
    <div style="background: ${rarityColors[nft.rarity.key]}; border-radius: 20px; padding: 30px; text-align: center; max-width: 350px; animation: popIn 0.5s; ${glowStyle.css}">
      <style>
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        ${glowStyle.animation ? `
        @keyframes ${glowStyle.animation.split(' ')[0]} {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
        ` : ''}
      </style>
      <div style="font-size: 48px; margin-bottom: 10px;">🐴</div>
      <div style="font-size: 28px; font-weight: bold; color: #fff; margin-bottom: 10px;">${rarityText[nft.rarity.key]}</div>
      <div style="font-size: 20px; color: #fff; margin-bottom: 5px;">${nft.name}</div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 5px;">
        ${nft.gender === '수' ? '♂ 수컷' : '♀ 암컷'} 
        ${nft.bloodline ? ' | 🩸혈통' : ''}
      </div>
      ${nft.ability ? `<div style="font-size: 12px; color: #ffd700; margin-bottom: 10px;">${NFT_ABILITIES[nft.ability].icon} ${nft.ability}</div>` : ''}
      <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 15px;">${nft.color}</div>
      <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 15px; margin-bottom: 15px;">
        <div style="color: #fff; font-size: 12px;">스탯 버프 +${Math.round(nft.rarity.buffRatio * 100)}%</div>
        <div style="display: flex; justify-content: space-around; margin-top: 10px;">
          <div style="text-align: center;"><div style="color: #ff6b6b;">${nft.stats.speed}</div><div style="color: #888; font-size: 10px;">속도</div></div>
          <div style="text-align: center;"><div style="color: #4ECDC4;">${nft.stats.stamina}</div><div style="color: #888; font-size: 10px;">지구력</div></div>
          <div style="text-align: center;"><div style="color: #ffd26e;">${nft.stats.burst}</div><div style="color: #888; font-size: 10px;">스퍼트</div></div>
        </div>
      </div>
      <button onclick="document.getElementById('nftResultModal').remove()" style="padding: 12px 30px; background: #fff; color: #333; border: none; border-radius: 25px; font-weight: bold; cursor: pointer;">확인</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function renderNFTInventory() {
  const container = document.getElementById('nftInventory');
  if (!container || !nftSystem) return;
  
  const nfts = nftSystem.myNFTs || [];
  
  if (nfts.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 30px; color: #888;">보유한 NFT가 없습니다<br>위 박스를 구매하세요!</div>';
    return;
  }
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
      ${nfts.map(nft => renderNFTCard(nft)).join('')}
    </div>
  `;
}

function renderNFTCard(nft) {
  const rarityColors = {
    MR: '#FF00FF',
    LR: '#FFD700',
    HR: '#E67E22',
    SR: '#9B59B6',
    R: '#3498DB',
    N: '#95A5A6'
  };
  
  const isSelected = window.selectedNFTForRace && window.selectedNFTForRace.id === nft.id;
  const glowStyle = NFT_GLOW_STYLES[nft.glowLevel] || NFT_GLOW_STYLES.none;
  
  return `
    <div style="background: #1a1a2e; border: 2px solid ${rarityColors[nft.rarity.key] || '#333'}; border-radius: 10px; padding: 10px; ${isSelected ? glowStyle.css : ''}">
      <div style="background: ${nft.color}; border-radius: 8px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 40px; position: relative;">
        🐴
        ${nft.glowLevel !== 'none' ? `<div style="position: absolute; top: 5px; right: 5px; font-size: 10px;">✨</div>` : ''}
      </div>
      <div style="font-size: 12px; margin-top: 8px; color: ${rarityColors[nft.rarity.key]}; font-weight: bold;">
        ${nft.rarity.name} ${nft.gender === '수' ? '♂' : '♀'} ${nft.bloodline ? '🩸' : ''}
      </div>
      <div style="font-size: 13px; font-weight: bold; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nft.name}</div>
      ${nft.ability ? `<div style="font-size: 10px; color: #ffd700;">${NFT_ABILITIES[nft.ability].icon} ${nft.ability}</div>` : ''}
      <div style="font-size: 10px; color: #888; margin-top: 3px;">${nft.stats.speed} / ${nft.stats.stamina} / ${nft.stats.burst}</div>
      <!-- [v5.3 Phase4] 전적 & 시장 가치 -->
      ${(nft.wins||nft.races) ? `<div style="font-size:10px;color:#f5c842;margin-top:2px;">🏆 ${nft.wins||0}승/${nft.races||0}전</div>` : ''}
      ${nftSystem ? `<div style="font-size:10px;color:#4ecdc4;margin-top:1px;">💎 ${(nftSystem.getNFTMarketValue(nft)||0).toLocaleString()} DOT</div>` : ''}
      <!-- [v5.3 Phase4] 강화 레벨 표시 -->
      ${(nft.enhanceLevel > 0) ? `<div style="font-size:10px;color:#ff9f43;margin-top:2px;">🔨 강화 Lv.${nft.enhanceLevel}</div>` : ''}
      <div style="display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;">
        <button onclick="toggleNFTForRace('${nft.id}')" style="flex: 1; background: ${isSelected ? '#e74c3c' : '#27ae60'}; color: #fff; border: none; padding: 5px; border-radius: 4px; font-size: 10px; cursor: pointer;">${isSelected ? '사용중지' : '사용'}</button>
        <button onclick="showEnhanceModal('${nft.id}')" style="flex: 1; background: #ff9f43; color: #000; border: none; padding: 5px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight:700;">🔨 강화</button>
        <button onclick="showConvertModal('${nft.id}')" style="flex: 1; background: #e74c3c; color: #fff; border: none; padding: 5px; border-radius: 4px; font-size: 10px; cursor: pointer;">환전</button>
        <button onclick="showExchangeModal('${nft.id}')" style="flex: 1; background: #9b59b6; color: #fff; border: none; padding: 5px; border-radius: 4px; font-size: 10px; cursor: pointer;">교환</button>
      </div>
    </div>
  `;
}

function renderNFTConvertList() {
  const container = document.getElementById('nftConvertList');
  if (!container || !nftSystem) return;
  
  const nfts = nftSystem.myNFTs || [];
  
  if (nfts.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">환전할 NFT가 없습니다</div>';
    return;
  }
  
  // 희귀도에 따른 DOT 가격 (1000원 = 1 DOT)
  // 순서: 신화 > 전설 > 영웅 > 희귀 > 고급 > 일반
  const rarityPricesDOT = {
    MR: [100000, 300000],
    LR: [30000, 80000],
    HR: [3000, 7000],
    SR: [800, 2000],
    R: [200, 800],
    N: [50, 200],
    LEGENDARY: [100000, 300000],
    EPIC: [800, 2000],
    RARE: [200, 800],
    COMMON: [50, 200]
  };
  
  container.innerHTML = nfts.map(nft => {
    // [v5.3 Phase4] 시장 가치 기반 표시 (우승·혈통 프리미엄 반영)
    const marketVal = nftSystem.getNFTMarketValue(nft);
    const actual    = marketVal - Math.floor(marketVal * 0.1);
    const winStr    = nft.wins ? ` 🏆${nft.wins}승` : '';
    
    return `
      <div style="background: #1a1a2e; padding: 10px; margin: 5px 0; border-radius: 8px; display: flex; align-items: center;">
        <div style="background: ${nft.color}; width: 40px; height: 40px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🐴</div>
        <div style="flex: 1; margin-left: 10px;">
          <div style="color: #fff; font-size: 12px; font-weight: bold;">${nft.name}${winStr}</div>
          <div style="color: ${NFT_RARITIES[nft.rarity.key]?.color || '#888'}; font-size: 11px;">${nft.rarity.name} ${nft.gender === '수' ? '♂' : '♀'} ${nft.bloodline ? '🩸혈통' : ''}</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #9df7c7; font-size: 12px; font-weight: bold;">${actual.toLocaleString()} DOT</div>
          <div style="color: #5a6a90; font-size: 10px;">시가 ${marketVal.toLocaleString()}</div>
          <button onclick="showConvertModal('${nft.id}')" style="background: #e74c3c; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 10px; cursor: pointer; margin-top:3px;">환전</button>
        </div>
      </div>
    `;
  }).join('');
}

function selectNFTForRace(nftId) {
  if (!nftSystem) return;
  const nft = nftSystem.selectNFTForRace(nftId);
  if (nft) {
    let buffInfo = `버프: 속도 +${Math.floor(nft.stats.speed * nft.rarity.buffRatio)}, 지구력 +${Math.floor(nft.stats.stamina * nft.rarity.buffRatio)}, 스퍼트 +${Math.floor(nft.stats.burst * nft.rarity.buffRatio)}`;
    if (nft.bloodline && nft.ability) {
      buffInfo += `\n특수능력: ${NFT_ABILITIES[nft.ability].icon} ${nft.ability}`;
    }
    alert(`${nft.name} 말을 경주에 사용합니다!\n${buffInfo}`);
    renderNFTInventory();
  }
}

function toggleNFTForRace(nftId) {
  if (!nftSystem) return;
  
  const nft = nftSystem.myNFTs.find(n => n.id === nftId);
  if (!nft) return;
  
  const isSelected = window.selectedNFTForRace && window.selectedNFTForRace.id === nftId;
  
  if (isSelected) {
    window.selectedNFTForRace = null;
    console.log('[NFT] 말 사용 중지:', nft.name);
  } else {
    const result = nftSystem.selectNFTForRace(nftId);
    if (result) {
      console.log('[NFT] 말 사용 시작:', nft.name, '버프:', nftSystem.getNFTBuff(nft));
    }
  }
  
  renderNFTInventory();
  
  const status = window.selectedNFTForRace ? '사용 중' : '사용 중지';
  console.log('[NFT] 상태:', status);
}

function showConvertModal(nftId) {
  const nft = nftSystem.myNFTs.find(n => n.id === nftId);
  if (!nft) return;
  
  // 희귀도에 따른 DOT 가격
  const rarityPricesDOT = {
    MR: [100000, 300000],
    LR: [30000, 80000],
    HR: [3000, 7000],
    SR: [800, 2000],
    R: [200, 800],
    N: [50, 200],
    LEGENDARY: [100000, 300000],
    EPIC: [800, 2000],
    RARE: [200, 800],
    COMMON: [50, 200]
  };
  
  // [v5.3 Phase4] 시장 가치 기반 환전
  const marketValue = nftSystem.getNFTMarketValue(nft);
  const fee    = Math.floor(marketValue * 0.1);
  const actual = marketValue - fee;
  const winStr = nft.wins ? ` | ${nft.wins}승` : '';
  const bloStr = nft.bloodline ? ' 🩸혈통' : '';

  if (!confirm(`${nft.name} (${nft.rarity.name} ${nft.gender === '수' ? '수' : '암'}${bloStr}${winStr})\n\n시장 가치: ${marketValue.toLocaleString()} DOT\n수수료(10%): ${fee.toLocaleString()} DOT\n수령 금액: ${actual.toLocaleString()} DOT\n\n환전하시겠습니까?`)) {
    return;
  }
  
  const result = nftSystem.convertToMoney(nftId);
  if (result.success) {
    alert(`${result.amount.toLocaleString()} DOT가 지갑에 추가되었습니다!`);
    renderNFTTab();
  }
}

// [v5.3 Phase4] 교환 코드 생성 — 가격 설정 UI
function showExchangeModal(nftId) {
  const nft = nftSystem?.myNFTs.find(n => n.id === nftId);
  if (!nft) return;

  const marketVal = nftSystem.getNFTMarketValue(nft);
  const rarityColors = {MR:'#FF00FF',LR:'#FFD700',HR:'#E67E22',SR:'#9B59B6',R:'#3498DB',N:'#95A5A6'};
  const rKey = nft.rarity?.key || 'N';
  const rc   = rarityColors[rKey] || '#95A5A6';

  // 기존 모달 제거
  const old = document.getElementById('nftExchangeModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'nftExchangeModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,20,.8);display:flex;align-items:center;justify-content:center;z-index:99999;';
  modal.innerHTML =
    '<div style="background:#0f1422;border:2px solid '+rc+';border-radius:16px;padding:24px;width:320px;max-width:95vw;">' +
      '<div style="text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:24px;margin-bottom:6px;">🐴</div>' +
        '<div style="font-size:16px;font-weight:900;color:#fff;">'+nft.name+'</div>' +
        '<div style="font-size:12px;color:'+rc+';margin-top:4px;">'+nft.rarity.name+' '+
          (nft.gender==='수'?'♂':'♀')+(nft.bloodline?' 🩸혈통':'')+
          (nft.wins?' | '+nft.wins+'승':'')+
        '</div>' +
        '<div style="font-size:13px;color:#4ecdc4;font-weight:700;margin-top:4px;">시장 가치: '+marketVal.toLocaleString()+' DOT</div>' +
      '</div>' +
      '<div style="background:#060c18;border:1px solid #1a2540;border-radius:10px;padding:14px;margin-bottom:14px;">' +
        '<div style="font-size:12px;color:#7f8fb5;margin-bottom:8px;">희망 판매가 설정 (0 = 무료 증여)</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input id="nftAskPrice" type="number" min="0" step="1000" placeholder="0 = 무료"' +
            ' style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid #1a2540;background:#0b0f1c;color:#dde4f5;font-size:13px;"' +
            ' oninput="var v=Number(this.value)||0;document.getElementById(\'nftAskPreview\').textContent=v>0?\'수령: \'+(Math.floor(v*0.0)).toLocaleString()+\' DOT\':\' 무료 증여\'"/>' +
          '<span style="font-size:11px;color:#7f8fb5;">DOT</span>' +
        '</div>' +
        '<div id="nftAskPreview" style="font-size:11px;color:#ff9f43;margin-top:6px;"> 무료 증여</div>' +
        '<div style="font-size:10px;color:#3d4f72;margin-top:4px;">* 시장 가치의 80~120% 권장</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button id="nftExchangeConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#9b7ef8;color:#fff;cursor:pointer;font-size:13px;font-weight:700;">🔑 코드 생성</button>' +
        '<button onclick="document.getElementById(\'nftExchangeModal\').remove()" style="flex:1;padding:10px;border-radius:8px;border:1px solid #1a2540;background:transparent;color:#7f8fb5;cursor:pointer;font-size:13px;">취소</button>' +
      '</div>' +
      '<div id="nftExchangeResult" style="display:none;margin-top:12px;background:#060c18;border:1px solid rgba(155,126,248,.3);border-radius:10px;padding:12px;text-align:center;">' +
        '<div style="font-size:11px;color:#7f8fb5;margin-bottom:6px;">교환 코드 (클립보드 복사됨)</div>' +
        '<div id="nftExchangeCode" style="font-size:16px;font-weight:900;color:#9b7ef8;letter-spacing:2px;"></div>' +
        '<div id="nftExchangePrice" style="font-size:11px;color:#ff9f43;margin-top:4px;"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('nftExchangeConfirm').addEventListener('click', function() {
    const askPrice = Math.max(0, Number(document.getElementById('nftAskPrice').value) || 0);
    nftSystem.setExchangeCode(nftId, askPrice).then(function(result) {
      if (result.success) {
        document.getElementById('nftExchangeResult').style.display = 'block';
        document.getElementById('nftExchangeCode').textContent = result.code;
        document.getElementById('nftExchangePrice').textContent =
          askPrice > 0 ? '판매가: ' + askPrice.toLocaleString() + ' DOT' : '무료 증여 코드';
        document.getElementById('nftExchangeConfirm').disabled = true;
        document.getElementById('nftExchangeConfirm').style.background = '#3d4f72';
      }
    });
  });

  // 배경 클릭 닫기
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
}

// [v5.3 Phase4] 교환 코드 사용 — DOT 차감 확인 포함
function redeemExchangeCode() {
  const code = document.getElementById('exchangeCodeInput')?.value.trim();
  if (!code) { alert('교환 코드를 입력하세요'); return; }
  if (!nftSystem) { alert('NFT 시스템 로딩 중...'); return; }

  // 먼저 코드 정보 조회 (Firebase에서)
  if (!window.db || !window.uid) {
    alert('로그인이 필요합니다'); return;
  }

  const normalizedCode = code.trim().toUpperCase();
  window.db.collectionGroup('nfts')
    .where('exchangeCode', '==', normalizedCode).get()
    .then(function(snapshot) {
      if (snapshot.empty) {
        alert('유효하지 않은 교환 코드입니다');
        return;
      }

      const sourceNft = snapshot.docs[0].data();
      const meta      = sourceNft.exchangeMeta || {};
      const askPrice  = meta.askPrice || 0;
      const marketVal = meta.marketValue || 0;
      const rName     = sourceNft.rarity?.name || '?';
      const bloodStr  = sourceNft.bloodline ? ' 🩸혈통' : '';
      const winStr    = meta.wins ? (' | ' + meta.wins + '승') : '';

      // 자기 자신 소유 체크
      if (sourceNft.ownerId === window.uid) {
        alert('본인 소유 NFT 코드는 사용 불가합니다'); return;
      }

      // 구매 확인 모달
      var confirmMsg = sourceNft.name + ' (' + rName + bloodStr + winStr + ')\n' +
        '시장 가치: ' + (marketVal > 0 ? marketVal.toLocaleString() + ' DOT' : '계산 중') + '\n';
      if (askPrice > 0) {
        confirmMsg += '\n💰 구매 가격: ' + askPrice.toLocaleString() + ' DOT\n' +
          '내 보유 DOT: ' + (window.wallet || 0).toLocaleString() + ' DOT\n\n구매하시겠습니까?';
      } else {
        confirmMsg += '\n🎁 무료 증여 NFT입니다. 받으시겠습니까?';
      }

      if (!confirm(confirmMsg)) return;

      // 실제 교환 실행
      nftSystem.redeemExchangeCode(code).then(function(result) {
        if (result.success) {
          var msg = 'NFT 교환 성공!\n받으신 말: ' + result.nft.name + ' (' + result.nft.rarity.name + ')';
          if (result.askPrice > 0) {
            msg += '\n지불: ' + result.askPrice.toLocaleString() + ' DOT';
          }
          alert(msg);
          if (document.getElementById('exchangeCodeInput')) {
            document.getElementById('exchangeCodeInput').value = '';
          }
          renderNFTTab();
        } else {
          alert('교환 실패: ' + result.message);
        }
      });
    })
    .catch(function(err) {
      console.error('[NFT] 코드 조회 오류:', err);
      // Firebase 실패 시 직접 redeem 시도
      nftSystem.redeemExchangeCode(code).then(function(result) {
        if (result.success) {
          alert('NFT 교환 성공!\n받으신 말: ' + result.nft.name);
          renderNFTTab();
        } else {
          alert('교환 실패: ' + result.message);
        }
      });
    });
}

window.NFT_RARITIES = NFT_RARITIES;
window.NFT_BOXES = NFT_BOXES;
window.NFT_ABILITIES = NFT_ABILITIES;
window.NFT_GLOW_STYLES = NFT_GLOW_STYLES;
window.NFT_RARITY_ORDER = NFT_RARITY_ORDER;
window.NFTSystem = NFTSystem;
window.initNFTSystem = initNFTSystem;
window.nftSystem = nftSystem;
window.renderNFTTab = renderNFTTab;
window.openBox = openBox;
window.selectNFTForRace = selectNFTForRace;
window.toggleNFTForRace = toggleNFTForRace;
// ── [v5.3 Phase4] NFT 강화 모달 ────────────────────────────────
function showEnhanceModal(nftId) {
  const nft = nftSystem?.myNFTs.find(n => n.id === nftId);
  if (!nft) return;

  const level      = nft.enhanceLevel || 0;
  const cost       = nftSystem.getEnhanceCost(nft);
  const marketNow  = nftSystem.getNFTMarketValue(nft);
  const stableState = window.StableState || window._StableState;
  const dottBal    = stableState?.dottWallet || 0;
  const rarityColors = {MR:'#FF00FF',LR:'#FFD700',HR:'#E67E22',SR:'#9B59B6',R:'#3498DB',N:'#95A5A6'};
  const rc = rarityColors[nft.rarity?.key || 'N'] || '#95A5A6';

  const old = document.getElementById('nftEnhanceModal'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'nftEnhanceModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,20,.85);display:flex;align-items:center;justify-content:center;z-index:99999;';

  if (level >= 10) {
    modal.innerHTML =
      '<div style="background:#0f1422;border:2px solid #ff9f43;border-radius:16px;padding:24px;width:300px;text-align:center;">' +
        '<div style="font-size:24px;margin-bottom:8px;">🔨</div>' +
        '<div style="font-size:16px;font-weight:900;color:#ff9f43;">최대 강화 완료!</div>' +
        '<div style="font-size:13px;color:#7f8fb5;margin:12px 0;">Lv.10은 최대 강화 레벨입니다</div>' +
        '<button onclick="document.getElementById(&#39;nftEnhanceModal&#39;).remove()" style="padding:10px 24px;border-radius:8px;border:1px solid #1a2540;background:transparent;color:#7f8fb5;cursor:pointer;">닫기</button>' +
      '</div>';
  } else {
    // 강화 후 예상 가치 계산
    const simulatedNFT = Object.assign({}, nft, {enhanceLevel: level + 1});
    if (simulatedNFT.stats) {
      simulatedNFT.stats = {
        speed:   Math.min(100, (nft.stats.speed||0)   + 3),
        stamina: Math.min(100, (nft.stats.stamina||0) + 3),
        burst:   Math.min(100, (nft.stats.burst||0)   + 3)
      };
    }
    const marketAfter = nftSystem.getNFTMarketValue(simulatedNFT);
    const hasEnough   = dottBal >= cost;

    modal.innerHTML =
      '<div style="background:#0f1422;border:2px solid '+rc+';border-radius:16px;padding:24px;width:320px;max-width:95vw;">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="font-size:30px;margin-bottom:6px;">🔨</div>' +
          '<div style="font-size:16px;font-weight:900;color:#fff;">'+nft.name+' 강화</div>' +
          '<div style="font-size:12px;color:'+rc+';margin-top:4px;">'+nft.rarity.name+' Lv.'+(level)+'→Lv.'+(level+1)+'</div>' +
        '</div>' +
        // 현재 vs 강화 후 비교
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">' +
          '<div style="background:#060c18;border-radius:8px;padding:10px;text-align:center;">' +
            '<div style="font-size:10px;color:#7f8fb5;margin-bottom:4px;">현재</div>' +
            '<div style="font-size:11px;color:#dde4f5;">⚡'+(nft.stats?.speed||0)+' 💨'+(nft.stats?.stamina||0)+' 🔥'+(nft.stats?.burst||0)+'</div>' +
            '<div style="font-size:12px;color:#4ecdc4;font-weight:700;margin-top:4px;">'+marketNow.toLocaleString()+' DOT</div>' +
          '</div>' +
          '<div style="background:#060c18;border:1px solid rgba(255,159,67,.3);border-radius:8px;padding:10px;text-align:center;">' +
            '<div style="font-size:10px;color:#ff9f43;margin-bottom:4px;">강화 후</div>' +
            '<div style="font-size:11px;color:#dde4f5;">⚡'+(Math.min(100,(nft.stats?.speed||0)+3))+' 💨'+(Math.min(100,(nft.stats?.stamina||0)+3))+' 🔥'+(Math.min(100,(nft.stats?.burst||0)+3))+'</div>' +
            '<div style="font-size:12px;color:#ff9f43;font-weight:700;margin-top:4px;">'+marketAfter.toLocaleString()+' DOT</div>' +
          '</div>' +
        '</div>' +
        // 비용
        '<div style="background:#060c18;border:1px solid '+(hasEnough?'rgba(255,159,67,.3)':'rgba(242,107,107,.3)')+';border-radius:8px;padding:12px;margin-bottom:14px;text-align:center;">' +
          '<div style="font-size:12px;color:#7f8fb5;margin-bottom:4px;">강화 비용</div>' +
          '<div style="font-size:18px;font-weight:900;color:#ff9f43;">'+cost+' DOTT</div>' +
          '<div style="font-size:11px;color:'+(hasEnough?'#3dd68c':'#f26b6b')+';margin-top:4px;">보유: '+dottBal+' DOTT</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button id="nftEnhanceConfirm" '+(hasEnough?'':'disabled')+' style="flex:1;padding:10px;border-radius:8px;border:0;background:'+(hasEnough?'#ff9f43':'#3d4f72')+';color:'+(hasEnough?'#000':'#7f8fb5')+';cursor:'+(hasEnough?'pointer':'not-allowed')+';font-size:13px;font-weight:700;">🔨 강화하기</button>' +
          '<button onclick="document.getElementById(&#39;nftEnhanceModal&#39;).remove()" style="flex:1;padding:10px;border-radius:8px;border:1px solid #1a2540;background:transparent;color:#7f8fb5;cursor:pointer;font-size:13px;">취소</button>' +
        '</div>' +
      '</div>';
  }

  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });

  const btn = document.getElementById('nftEnhanceConfirm');
  if (btn) {
    btn.addEventListener('click', function() {
      const result = nftSystem.enhanceNFT(nftId);
      if (result.success) {
        modal.remove();
        alert('✨ 강화 성공! Lv.' + result.newLevel + '\n스탯 +' + result.statGain + ' (전 능력치)\n새 가치: ' + result.newMarketValue.toLocaleString() + ' DOT');
        renderNFTInventory();
        if (typeof renderNFTConvertList === 'function') renderNFTConvertList();
        if (typeof window.renderBank === 'function') window.renderBank();
      } else {
        alert('❌ ' + result.message);
      }
    });
  }
}
window.showEnhanceModal = showEnhanceModal;

// ── [v5.3 Phase4] StableState 브리지 — NFT 강화가 DOTT 지갑 접근
// stable-manager.js가 로드되면 자동으로 StableState 노출됨
// nft-system.js에서는 window.StableState 또는 window._StableState 로 접근
if (typeof window._stableBridgeReady === 'undefined') {
  window._stableBridgeReady = false;
  document.addEventListener('stableStateReady', function(e) {
    window.StableState = e.detail;
    window._stableBridgeReady = true;
  });
}

window.showConvertModal = showConvertModal;
window.showExchangeModal = showExchangeModal;
window.redeemExchangeCode = redeemExchangeCode;

console.log('[NFT System v3.0] 모듈 로드 완료');
