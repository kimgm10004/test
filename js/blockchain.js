/**
 * Blockchain Simulation System v1.0
 * 도트경마 v5.2 - 게임 내 블록체인 시뮬레이션
 * 
 * - 블록 생성 및 해시 계산
 * - 트랜잭션 기록
 * - 월렛 관리
 * - 게임 내 투명성 확보
 */

// 간단한 해시 함수 (SHA-256 대신 사용)
function simpleHash(data) {
  let hash = 0;
  const str = JSON.stringify(data);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // 해시를 16진수 문자열로 변환
  let hexHash = Math.abs(hash).toString(16);
  // 길이를 64자로 맞춤 (SHA-256 느낌)
  while (hexHash.length < 64) {
    hexHash = hexHash + Math.floor(Math.random() * 16).toString(16);
  }
  return hexHash.substring(0, 64);
}

// 트랜잭션 타입
const TX_TYPES = {
  BET_PLACE: 'BET_PLACE',           // 베팅
  BET_WIN: 'BET_WIN',               // 당첨
  BET_LOSE: 'BET_LOSE',             // 패배
  WALLET_DEPOSIT: 'WALLET_DEPOSIT', // 지갑 충전
  AI_PURCHASE: 'AI_PURCHASE',       // AI 구매
  SEASON_REWARD: 'SEASON_REWARD'    // 시즌 보상
};

// 블록 클래스
class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash() {
    const data = {
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions,
      previousHash: this.previousHash,
      nonce: this.nonce
    };
    return simpleHash(data);
  }

  mineBlock(difficulty = 1) {
    // 시뮬레이션이므로 실제 마이닝 없이 즉시 해시 생성
    // (실제 암호화폐의 proof-of-work는 제거)
    this.hash = this.calculateHash();
    console.log(`[Block ${this.index}] 생성 완료: ${this.hash.substring(0, 16)}...`);
  }
}

// 블록체인 클래스
class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 1;
    this.pendingTransactions = [];
    this.userAddress = 'USER_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), [{ type: 'GENESIS', amount: 0, description: '도트경마 블록체인 시작' }], '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    return newBlock;
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions() {
    if (this.pendingTransactions.length === 0) return null;

    const block = new Block(
      this.chain.length,
      Date.now(),
      [...this.pendingTransactions],
      this.getLatestBlock().hash
    );

    this.addBlock(block);
    const minedBlock = block;
    this.pendingTransactions = [];
    return minedBlock;
  }

  verifyChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.error(`[Blockchain] 블록 ${i} 해시 불일치!`);
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error(`[Blockchain] 블록 ${i-1}->${i} 연결 불일치!`);
        return false;
      }
    }
    return true;
  }

  getTransactionHistory(limit = 20) {
    const allTransactions = [];
    for (let i = this.chain.length - 1; i >= 0; i--) {
      for (const tx of this.chain[i].transactions) {
        allTransactions.push({
          ...tx,
          blockIndex: this.chain[i].index,
          blockHash: this.chain[i].hash,
          timestamp: this.chain[i].timestamp
        });
      }
    }
    return allTransactions.slice(0, limit);
  }

  getChainLength() {
    return this.chain.length;
  }

  getTotalTransactions() {
    let total = 0;
    for (const block of this.chain) {
      total += block.transactions.length;
    }
    return total;
  }
}

// 전역 블록체인 인스턴스
let gameBlockchain = null;

// 블록체인 초기화
function initBlockchain() {
  gameBlockchain = new Blockchain();
  console.log('[Blockchain v1.0] 초기화 완료');
  console.log('[Blockchain] 사용자 주소:', gameBlockchain.userAddress);
  return gameBlockchain;
}

// 트랜잭션 추가 (베팅 시)
function addBetTransaction(betType, horseNumber, amount) {
  if (!gameBlockchain) initBlockchain();

  const tx = {
    type: TX_TYPES.BET_PLACE,
    betType: betType,
    horseNumber: horseNumber,
    amount: -amount,
    description: `${betType} ${horseNumber}번 말에 ${amount.toLocaleString()}원 베팅`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] 트랜잭션 추가:', tx.description);
  return tx;
}

// 트랜잭션 추가 (당첨 시)
function addWinTransaction(betType, horseNumber, winAmount) {
  if (!gameBlockchain) initBlockchain();

  const tx = {
    type: TX_TYPES.BET_WIN,
    betType: betType,
    horseNumber: horseNumber,
    amount: winAmount,
    description: `${betType} ${horseNumber}번 말 당첨! +${winAmount.toLocaleString()}원`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] 당첨 트랜잭션:', tx.description);
  return tx;
}

// 트랜잭션 추가 (패배 시)
function addLoseTransaction(betType, horseNumber) {
  if (!gameBlockchain) initBlockchain();

  const tx = {
    type: TX_TYPES.BET_LOSE,
    betType: betType,
    horseNumber: horseNumber,
    amount: 0,
    description: `${betType} ${horseNumber}번 말 패배`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] 패배 트랜잭션:', tx.description);
  return tx;
}

// 트랜잭션 추가 (AI 구매 시)
function addAiPurchaseTransaction() {
  if (!gameBlockchain) initBlockchain();

  const cost = window.AI_ANALYSIS_COST || 250;
  const tx = {
    type: TX_TYPES.AI_PURCHASE,
    amount: -cost,
    description: `마르코프 AI 분석 구매 -${cost.toLocaleString()}원`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] AI 구매 트랜잭션:', tx.description);
  return tx;
}

// 트랜잭션 추가 (지갑 충전 시)
function addDepositTransaction(amount) {
  if (!gameBlockchain) initBlockchain();

  const tx = {
    type: TX_TYPES.WALLET_DEPOSIT,
    amount: amount,
    description: `지갑 충전 +${amount.toLocaleString()}원`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] 충전 트랜잭션:', tx.description);
  return tx;
}

// 트랜잭션 추가 (시즌 보상 시)
function addSeasonRewardTransaction(amount) {
  if (!gameBlockchain) initBlockchain();

  const tx = {
    type: TX_TYPES.SEASON_REWARD,
    amount: amount,
    description: `시즌 보상 +${amount.toLocaleString()}원`,
    raceNo: window.raceNo || 1,
    timestamp: Date.now()
  };

  gameBlockchain.addTransaction(tx);
  console.log('[Blockchain] 시즌 보상 트랜잭션:', tx.description);
  return tx;
}

// 블록 마이닝 (트랜잭션들을 블록으로 묶기)
function mineBlock() {
  if (!gameBlockchain) initBlockchain();
  
  const block = gameBlockchain.minePendingTransactions();
  if (block) {
    console.log('[Blockchain] 블록 생성 완료! #' + block.index);
    updateBlockchainPanel();
  }
  return block;
}

// 블록체인 패널 업데이트
function updateBlockchainPanel() {
  if (!gameBlockchain) return;

  const blockCount = gameBlockchain.getChainLength();
  const totalTx = gameBlockchain.getTotalTransactions();
  const history = gameBlockchain.getTransactionHistory(20);

  // 블록 수 업데이트
  const blockCountEl = document.getElementById('blockchainBlockCount');
  if (blockCountEl) blockCountEl.textContent = blockCount;

  // 트랜잭션 수 업데이트
  const txCountEl = document.getElementById('blockchainTxCount');
  if (txCountEl) txCountEl.textContent = totalTx;

  // 검증 상태 업데이트
  const verifyStatusEl = document.getElementById('blockchainVerifyStatus');
  if (verifyStatusEl) {
    const verified = history.filter(tx => tx.verified).length;
    const total = history.length;
    if (verified === total && total > 0) {
      verifyStatusEl.textContent = '✅ 검증됨';
      verifyStatusEl.style.color = '#00ff88';
    } else if (verified > 0) {
      verifyStatusEl.textContent = `⚠️ ${verified}/${total} 검증됨`;
      verifyStatusEl.style.color = '#ffd700';
    } else {
      verifyStatusEl.textContent = '⏳ 검증 대기';
      verifyStatusEl.style.color = '#888';
    }
  }

  // 트랜잭션 목록 업데이트
  const txListEl = document.getElementById('blockchainTxList');
  if (txListEl) {
    txListEl.innerHTML = '';
    
    history.forEach((tx, idx) => {
      const item = document.createElement('div');
      item.className = 'blockchain-tx-item';
      
      const typeIcon = getTxTypeIcon(tx.type);
      const typeColor = getTxTypeColor(tx.type);
      const shortHash = tx.blockHash ? tx.blockHash.substring(0, 8) + '...' : '...';
      
      // 검증 상태 표시
      const verifyIcon = tx.verified ? '✅' : (tx.firebaseMatch === false ? '❌' : '⏳');
      const verifyText = tx.verified ? '검증됨' : (tx.firebaseMatch === false ? '불일치' : '대기중');
      
      item.innerHTML = `
        <div class="tx-header">
          <span class="tx-icon">${typeIcon}</span>
          <span class="tx-type" style="color:${typeColor}">${tx.type}</span>
          <span class="tx-time">${formatTime(tx.timestamp)}</span>
        </div>
        <div class="tx-desc">${tx.description}</div>
        <div class="tx-hash">해시: ${shortHash} ${verifyIcon}</div>
      `;
      
      txListEl.appendChild(item);
    });
  }
}

// 트랜잭션 타입 아이콘
function getTxTypeIcon(type) {
  switch (type) {
    case 'BET_PLACE': return '🎯';
    case 'BET_WIN': return '🏆';
    case 'BET_LOSE': return '❌';
    case 'WALLET_DEPOSIT': return '💰';
    case 'AI_PURCHASE': return '🤖';
    case 'SEASON_REWARD': return '🎁';
    case 'GENESIS': return '🌟';
    default: return '📝';
  }
}

// 트랜잭션 타입 색상
function getTxTypeColor(type) {
  switch (type) {
    case 'BET_PLACE': return '#ffd700';
    case 'BET_WIN': return '#00ff88';
    case 'BET_LOSE': return '#ff6b6b';
    case 'WALLET_DEPOSIT': return '#4ecdc4';
    case 'AI_PURCHASE': return '#a29bfe';
    case 'SEASON_REWARD': return '#fd79a8';
    case 'GENESIS': return '#fff';
    default: return '#ccc';
  }
}

// 시간 포맷
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// 블록 생성 애니메이션 표시 (숨김 - 배경에서만 작동)
function showBlockMiningAnimation(callback) {
  // 애니메이션 숨김 - 바로 블록 생성
  mineBlock();
  if (callback) callback();
}

// 블록체인 검증
function verifyBlockchain() {
  if (!gameBlockchain) return false;
  return gameBlockchain.verifyChain();
}

// [v5.2] Firebase 블록체인 연동
const MAX_FIREBASE_TRANSACTIONS = 1000;
let firebaseTransactions = []; // Firebase에서 로드한 트랜잭션
let localTransactionCache = []; // 로컬 트랜잭션 캐시

// Firebase 사용자 ID 가져오기
function getFirebaseUserId() {
  return window.uid || window.currentUserId || window.Storage.getItem('userId') || 'anonymous';
}

// Firebase에서 트랜잭션 로드
async function loadTransactionsFromFirebase() {
  const userId = getFirebaseUserId();
  if (!window.db || !userId || userId === 'anonymous') {
    console.log('[Blockchain Firebase] Firebase 또는 사용자 ID 없음');
    return [];
  }

  try {
    const userRef = window.db.collection('users').doc(userId)
      .collection('blockchain').doc('transactions');
    
    const doc = await userRef.get();
    if (doc.exists && doc.data().txList) {
      firebaseTransactions = doc.data().txList;
      console.log('[Blockchain Firebase] 로드 완료:', firebaseTransactions.length, '건');
      return firebaseTransactions;
    }
  } catch (err) {
    console.error('[Blockchain Firebase] 로드 실패:', err);
  }
  return [];
}

// Firebase에 트랜잭션 저장
async function saveTransactionToFirebase(tx) {
  // Firebase 초기화 대기
  if (!window.firebaseReady) {
    let attempts = 0;
    while (!window.firebaseReady && attempts < 50) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
  }
  
  const userId = getFirebaseUserId();
  if (!window.db || !userId || userId === 'anonymous') {
    console.log('[Blockchain Firebase] Firebase 또는 사용자 ID 없음 - 로컬에만 저장');
    tx.verified = false;
    localTransactionCache.push(tx);
    return tx;
  }

  try {
    const userRef = window.db.collection('users').doc(userId)
      .collection('blockchain').doc('transactions');
    
    // 기존 트랜잭션 로드
    const doc = await userRef.get();
    let txList = [];
    
    if (doc.exists && doc.data().txList) {
      txList = doc.data().txList;
    }
    
    // 새 트랜잭션 추가
    tx.txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    tx.verified = true; // Firebase 저장 시 검증 완료
    tx.syncedAt = Date.now();
    
    txList.push(tx);
    
    // 1000건 초과 시古い 것 삭제
    if (txList.length > MAX_FIREBASE_TRANSACTIONS) {
      txList = txList.slice(-MAX_FIREBASE_TRANSACTIONS);
    }
    
    // Firebase에 저장
    await userRef.set({
      txList: txList,
      lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('[Blockchain Firebase] 저장 완료:', tx.type, tx.txId);
    return tx;
    
  } catch (err) {
    console.error('[Blockchain Firebase] 저장 실패:', err);
    // 실패 시 로컬에만 저장
    tx.verified = false;
    localTransactionCache.push(tx);
    return tx;
  }
}

// 트랜잭션 검증 (로컬 vs Firebase)
async function verifyTransaction(localTx) {
  const firebaseList = await loadTransactionsFromFirebase();
  
  // Firebase에서 찾기
  const found = firebaseList.find(fbTx => 
    fbTx.raceNo === localTx.raceNo && 
    fbTx.type === localTx.type && 
    fbTx.amount === localTx.amount &&
    fbTx.timestamp === localTx.timestamp
  );
  
  if (found) {
    return { verified: true, match: found };
  }
  
  // 로컬 캐시에서도 찾기
  const localFound = localTransactionCache.find(lcTx =>
    lcTx.raceNo === localTx.raceNo &&
    lcTx.type === localTx.type &&
    lcTx.amount === localTx.amount
  );
  
  if (localFound) {
    return { verified: false, reason: 'Firebase 동기화 대기 중', local: localFound };
  }
  
  return { verified: false, reason: '트랜잭션 없음', local: localTx };
}

// 전체 자동 검증
async function autoVerifyAllTransactions() {
  console.log('[Blockchain] 자동 검증 시작...');
  
  const localHistory = gameBlockchain ? gameBlockchain.getTransactionHistory(100) : [];
  const firebaseList = await loadTransactionsFromFirebase();
  
  let verifiedCount = 0;
  let failedCount = 0;
  
  // 각 트랜잭션 검증
  for (const localTx of localHistory) {
    const found = firebaseList.find(fbTx => 
      fbTx.raceNo === localTx.raceNo && 
      fbTx.type === localTx.type && 
      fbTx.timestamp === localTx.timestamp
    );
    
    if (found) {
      localTx.verified = true;
      localTx.firebaseMatch = true;
      verifiedCount++;
    } else {
      localTx.verified = false;
      localTx.firebaseMatch = false;
      failedCount++;
    }
  }
  
  console.log(`[Blockchain] 검증 완료: ${verifiedCount}건 검증됨, ${failedCount}건 불일치`);
  
  // 패널 업데이트
  updateBlockchainPanel();
  
  return { verified: verifiedCount, failed: failedCount };
}

// 오래된 트랜잭션 정리 (1000건 초과 시)
async function cleanupOldTransactions() {
  const userId = getFirebaseUserId();
  if (!window.db || !userId || userId === 'anonymous') return;
  
  try {
    const userRef = window.db.collection('users').doc(userId)
      .collection('blockchain').doc('transactions');
    
    const doc = await userRef.get();
    if (doc.exists && doc.data().txList) {
      let txList = doc.data().txList;
      
      if (txList.length > MAX_FIREBASE_TRANSACTIONS) {
        txList = txList.slice(-MAX_FIREBASE_TRANSACTIONS);
        await userRef.set({ txList: txList });
        console.log('[Blockchain] 오래된 트랜잭션 정리 완료:', txList.length, '건 유지');
      }
    }
  } catch (err) {
    console.error('[Blockchain] 정리 실패:', err);
  }
}

// 트랜잭션 저장 통합 함수 (기존 함수들을 수정)
async function saveBetTransactionToBlockchain(betType, horseNumber, amount) {
  const tx = addBetTransaction(betType, horseNumber, amount);
  mineBlock();
  await saveTransactionToFirebase(tx);
  updateBlockchainPanel();
  return tx;
}

async function saveWinTransactionToBlockchain(betType, horseNumber, winAmount) {
  const tx = addWinTransaction(betType, horseNumber, winAmount);
  mineBlock();
  await saveTransactionToFirebase(tx);
  updateBlockchainPanel();
  return tx;
}

async function saveLoseTransactionToBlockchain(betType, horseNumber) {
  const tx = addLoseTransaction(betType, horseNumber);
  mineBlock();
  await saveTransactionToFirebase(tx);
  updateBlockchainPanel();
  return tx;
}

async function saveAiPurchaseTransactionToBlockchain() {
  const tx = addAiPurchaseTransaction();
  mineBlock();
  await saveTransactionToFirebase(tx);
  updateBlockchainPanel();
  return tx;
}

// 전역 노출
window.Blockchain = Blockchain;
window.Block = Block;
window.initBlockchain = initBlockchain;
window.addBetTransaction = addBetTransaction;
window.addWinTransaction = addWinTransaction;
window.addLoseTransaction = addLoseTransaction;
window.addAiPurchaseTransaction = addAiPurchaseTransaction;
window.addDepositTransaction = addDepositTransaction;
window.addSeasonRewardTransaction = addSeasonRewardTransaction;
window.mineBlock = mineBlock;
window.updateBlockchainPanel = updateBlockchainPanel;
window.showBlockMiningAnimation = showBlockMiningAnimation;
window.verifyBlockchain = verifyBlockchain;
window.TX_TYPES = TX_TYPES;

// [v5.2] Firebase 연동 함수 전역 노출
window.loadTransactionsFromFirebase = loadTransactionsFromFirebase;
window.saveTransactionToFirebase = saveTransactionToFirebase;
window.verifyTransaction = verifyTransaction;
window.autoVerifyAllTransactions = autoVerifyAllTransactions;
window.cleanupOldTransactions = cleanupOldTransactions;
window.saveBetTransactionToBlockchain = saveBetTransactionToBlockchain;
window.saveAiPurchaseTransactionToBlockchain = saveAiPurchaseTransactionToBlockchain;
window.MAX_FIREBASE_TRANSACTIONS = MAX_FIREBASE_TRANSACTIONS;

console.log('[Blockchain v1.0] Firebase 연동 모듈 로드 완료');
