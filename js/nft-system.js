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
      window.Storage.setItem('myNFTs', this.myNFTs);
      window.Storage.setItem('nftFreeBox', {
        date: this.lastFreeBoxDate,
        used: this.freeBoxUsed
      });
    } catch (err) {
      console.error('[NFT] localStorage 저장 실패:', err);
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = window.Storage.getItem('myNFTs');
      if (stored) this.myNFTs = stored;
      
      const freeData = window.Storage.getItem('nftFreeBox') || {};
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
      parents: null
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

  generateExchangeCode(nftId) {
    return 'EX-' + nftId.slice(4, 12).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  async setExchangeCode(nftId) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false };
    
    const code = this.generateExchangeCode(nftId);
    nft.exchangeCode = code;
    this.saveToLocalStorage();
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    
    return { success: true, code };
  }

  async redeemExchangeCode(code) {
    const normalizedCode = code.trim().toUpperCase();
    const nft = this.myNFTs.find(n => n.exchangeCode === normalizedCode);
    
    if (nft) {
      return { success: false, message: '이미 등록된 코드입니다' };
    }

    if (this.checkFirebaseReady()) {
      try {
        const snapshot = await window.db.collectionGroup('nfts')
          .where('exchangeCode', '==', normalizedCode).get();
        
        if (!snapshot.empty) {
          const sourceNft = snapshot.docs[0].data();
          const newNft = { ...sourceNft };
          newNft.id = 'nft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          newNft.exchangeCode = null;
          newNft.ownerId = window.uid;
          newNft.createdAt = Date.now();
          
          this.myNFTs.push(newNft);
          this.saveToLocalStorage();
          
          return { success: true, nft: newNft };
        }
      } catch (err) {
        console.log('[NFT] 코드 교환 오류:', err);
      }
    }
    
    return { success: false, message: '유효하지 않은 코드입니다' };
  }

  convertToMoney(nftId) {
    const nft = this.myNFTs.find(n => n.id === nftId);
    if (!nft) return { success: false };
    
    // 희귀도에 따른 DOT 가격 (1000원 = 1 DOT)
    // 순서: 신화 > 전설 > 영웅 > 희귀 > 고급 > 일반
    const rarityPricesDOT = {
      MR: [100000, 300000],  // 신화: 1억~3억
      LR: [30000, 80000],    // 전설: 3000만~8000만
      HR: [3000, 7000],     // 영웅: 300만~700만
      SR: [800, 2000],      // 희귀: 80만~200만
      R: [200, 800],        // 고급: 20만~80만
      N: [50, 200],         // 일반: 5만~20만
      // 하위 호환
      LEGENDARY: [100000, 300000],
      EPIC: [800, 2000],
      RARE: [200, 800],
      COMMON: [50, 200]
    };
    
    const rarityKey = nft.rarity?.key || nft.rarity;
    const [minPrice, maxPrice] = rarityPricesDOT[rarityKey] || [50, 200];
    const amount = Math.floor((minPrice + maxPrice) / 2 * 0.9);
    const fee = Math.floor(amount * 0.1);
    const actual = amount - fee;
    
    window.wallet = (window.wallet || 0) + actual;
    this.myNFTs = this.myNFTs.filter(n => n.id !== nftId);
    this.saveToLocalStorage();
    this.updateWalletDisplay();
    
    return { success: true, amount: actual, fee };
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
      <div style="display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;">
        <button onclick="toggleNFTForRace('${nft.id}')" style="flex: 1; background: ${isSelected ? '#e74c3c' : '#27ae60'}; color: #fff; border: none; padding: 5px; border-radius: 4px; font-size: 10px; cursor: pointer;">${isSelected ? '사용중지' : '사용'}</button>
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
    const rarityKey = nft.rarity?.key || nft.rarity;
    const [minPrice, maxPrice] = rarityPricesDOT[rarityKey] || [50, 200];
    const avgPrice = Math.floor((minPrice + maxPrice) / 2 * 0.9);
    
    return `
      <div style="background: #1a1a2e; padding: 10px; margin: 5px 0; border-radius: 8px; display: flex; align-items: center;">
        <div style="background: ${nft.color}; width: 40px; height: 40px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🐴</div>
        <div style="flex: 1; margin-left: 10px;">
          <div style="color: #fff; font-size: 12px; font-weight: bold;">${nft.name}</div>
          <div style="color: ${NFT_RARITIES[nft.rarity.key]?.color || '#888'}; font-size: 11px;">${nft.rarity.name} ${nft.gender === '수' ? '♂' : '♀'} ${nft.bloodline ? '🩸' : ''}</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #9df7c7; font-size: 12px; font-weight: bold;">≈${avgPrice.toLocaleString()} DOT</div>
          <button onclick="showConvertModal('${nft.id}')" style="background: #e74c3c; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 10px; cursor: pointer;">환전</button>
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
  
  const rarityKey = nft.rarity?.key || nft.rarity;
  const [minPrice, maxPrice] = rarityPricesDOT[rarityKey] || [50, 200];
  const avgPrice = Math.floor((minPrice + maxPrice) / 2 * 0.9);
  const fee = Math.floor(avgPrice * 0.1);
  const actual = avgPrice - fee;
  
  if (!confirm(`${nft.name} (${nft.rarity.name} ${nft.gender === '수' ? '수' : '암'}${nft.bloodline ? ' 혈통' : ''})을(를) DOT로 환전하시겠습니까?\n\n예상 수령금: ${actual.toLocaleString()} DOT\n(수수료 10%: ${fee.toLocaleString()} DOT)`)) {
    return;
  }
  
  const result = nftSystem.convertToMoney(nftId);
  if (result.success) {
    alert(`${result.amount.toLocaleString()} DOT가 지갑에 추가되었습니다!`);
    renderNFTTab();
  }
}

function showExchangeModal(nftId) {
  const nft = nftSystem.myNFTs.find(n => n.id === nftId);
  if (!nft) return;
  
  nftSystem.setExchangeCode(nftId).then(result => {
    if (result.success) {
      alert(`교환 코드: ${result.code}\n이 코드를 다른 플레이어에게 공유하세요!\n코드가 클립보드에 복사되었습니다.`);
    }
  });
}

function redeemExchangeCode() {
  const code = document.getElementById('exchangeCodeInput')?.value.trim();
  if (!code) {
    alert('교환 코드를 입력하세요');
    return;
  }
  
  if (!nftSystem) {
    alert('NFT 시스템 로딩 중...');
    return;
  }
  
  nftSystem.redeemExchangeCode(code).then(result => {
    if (result.success) {
      alert(`NFT 교환 성공!\n받으신 말: ${result.nft.name} (${result.nft.rarity.name})`);
      renderNFTTab();
    } else {
      alert(`교환 실패: ${result.message}`);
    }
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
window.showConvertModal = showConvertModal;
window.showExchangeModal = showExchangeModal;
window.redeemExchangeCode = redeemExchangeCode;

console.log('[NFT System v3.0] 모듈 로드 완료');
