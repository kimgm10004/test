/**
 * 중독성 시스템 - 도트 경마 v5.2
 * 
 * 연승 보너스, 일일 퀘스트, 업적, 레벨 시스템
 * 
 * @version 5.2.0
 * @author 도겜유튜브
 */
(function() {
  'use strict';

  // 중독성 시스템 설정
  const ADDICTION_CONFIG = {
    // 연승 시스템
    STREAK: {
      bonusPerWin: 1000,        // 연승 시 마다 보너스
      maxStreakBonus: 50000,   // 최대 연승 보너스
      streakMultiplier: [1, 1.5, 2, 2.5, 3, 4, 5], // 연승별 배수
      streakMilestones: [3, 5, 10, 20, 50, 100]  // 연승 마일스톤
    },

    // 레벨 시스템
    LEVEL: {
      baseXP: 100,           // 기본 XP
      xpPerWin: 50,          //获胜 시 XP
      xpPerBet: 10,          // 베팅 시 XP
      xpPerPrize: 100,       // 상금 XP
      levelMultiplier: 1.2    // 레벨당 요구 XP 증가율
    },

    // 일일 퀘스트
    DAILY_QUESTS: {
      resetHour: 0,          // 자정 리셋 (한국 시간)
      maxQuests: 3,          // 일일 최대 퀘스트 수
      refreshCost: 0         // 퀘스트 새로고침 비용
    },

    // 업적
    ACHIEVEMENTS: {
      categories: ['race', 'win', 'money', 'streak', 'special']
    },

    // 시즌 보상
    SEASON_REWARDS: {
      weeksPerSeason: 52,
      racesPerWeek: 6,
      tierBonus: {
        gold: 500000,
        silver: 300000,
        bronze: 100000,
        normal: 50000
      }
    }
  };

  /**
   * 중독성 시스템 클래스
   */
  class AddictionSystem {
    constructor() {
      this.data = this.loadData();
      this.questRefreshTimer = null;
    }

    /**
     * 데이터 로드
     */
    loadData() {
      const saved = window.Storage.getItem('addiction');
      if (saved) {
        try {
          return saved;
        } catch (e) {
          console.warn('[Addiction] Failed to load data');
        }
      }
      return this.getDefaultData();
    }

    /**
     * 기본 데이터
     */
    getDefaultData() {
      return {
        // 연승 시스템
        currentStreak: 0,
        bestStreak: 0,
        totalWins: 0,
        lastWinDate: null,
        streakFlameActive: false,
        
        // 레벨 시스템
        level: 1,
        xp: 0,
        totalXP: 0,
        
        // 일일 퀘스트
        dailyQuests: [],
        lastQuestRefresh: null,
        completedQuestsToday: 0,
        
        // 업적
        achievements: [],
        unlockedAchievements: [],
        
        // 일일 로그인
        loginStreak: 0,
        lastLoginDate: null,
        totalLoginDays: 0,
        
        // 통계
        totalRaces: 0,
        totalBetAmount: 0,
        totalPrize: 0,
        
        //徽章
        badges: []
      };
    }

    /**
     * 데이터 저장
     */
    saveData() {
      try {
        window.Storage.setItem('addiction', this.data);
        
        // [v5.2] Firebase 동기화
        if (window.FirebaseSync) {
          window.FirebaseSync.saveAddictionData(this.data);
        }
      } catch (e) {
        console.warn('[Addiction] Failed to save data');
      }
    }

    /**
     * 레벨 계산
     */
    calculateLevel(xp) {
      let level = 1;
      let requiredXP = ADDICTION_CONFIG.LEVEL.baseXP;
      let totalRequired = 0;
      
      while (totalRequired + requiredXP <= xp) {
        totalRequired += requiredXP;
        level++;
        requiredXP = Math.floor(requiredXP * ADDICTION_CONFIG.LEVEL.levelMultiplier);
      }
      
      return {
        level,
        currentXP: xp - totalRequired,
        requiredXP,
        progress: (xp - totalRequired) / requiredXP * 100
      };
    }

    /**
     * XP 추가
     */
    addXP(amount, reason = 'race') {
      this.data.xp += amount;
      this.data.totalXP += amount;
      
      const levelInfo = this.calculateLevel(this.data.xp);
      
      if (levelInfo.level > this.data.level) {
        const oldLevel = this.data.level;
        this.data.level = levelInfo.level;
        
        // 레벨업 보상
        const bonus = this.data.level * 5000;
        this.showLevelUpNotification(oldLevel, this.data.level, bonus);
        
        return { leveledUp: true, newLevel: this.data.level, bonus };
      }
      
      return { leveledUp: false, levelInfo };
    }

    /**
     * 레벨업 알림
     */
    showLevelUpNotification(oldLevel, newLevel, bonus) {
      const message = `
        🎉 레벨업! 
        ${oldLevel}Lv → ${newLevel}Lv
        보너스: ${bonus.toLocaleString()}원
      `;
      
      if (window.addCast) {
        window.addCast(message, 'highlight');
      }
      
      // 지갑에 보너스 추가
      if (window.handleWallet) {
        window.handleWallet(bonus);
      }
    }

    /**
     * 경주获胜 시 호출
     */
    onRaceWin(prize = 0) {
      const now = new Date();
      const today = now.toDateString();
      
      // 연승 업데이트
      if (this.data.lastWinDate !== today) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (this.data.lastWinDate === yesterday.toDateString()) {
          this.data.currentStreak++;
        } else {
          this.data.currentStreak = 1;
        }
      }
      
      this.data.lastWinDate = today;
      this.data.totalWins++;
      
      if (this.data.currentStreak > this.data.bestStreak) {
        this.data.bestStreak = this.data.currentStreak;
      }
      
      // 연속 Flame 활성화
      this.data.streakFlameActive = this.data.currentStreak >= 3;
      
      // 연승 보너스 계산
      const streakBonus = this.calculateStreakBonus();
      
      // XP 추가
      this.addXP(ADDICTION_CONFIG.LEVEL.xpPerWin, 'win');
      if (prize > 0) {
        this.addXP(ADDICTION_CONFIG.LEVEL.xpPerPrize, 'prize');
      }
      
      // 퀘스트 업데이트
      this.updateQuests('win', 1);
      
      // 업적 체크
      this.checkAchievements('wins', this.data.totalWins);
      
      this.saveData();
      
      return {
        streak: this.data.currentStreak,
        bestStreak: this.data.bestStreak,
        streakBonus,
        flameActive: this.data.streakFlameActive
      };
    }

    /**
     * 연승 보너스 계산
     */
    calculateStreakBonus() {
      const streak = this.data.currentStreak;
      if (streak === 0) return 0;
      
      let multiplier = 1;
      if (streak >= 100) multiplier = 5;
      else if (streak >= 50) multiplier = 4;
      else if (streak >= 20) multiplier = 3;
      else if (streak >= 10) multiplier = 2.5;
      else if (streak >= 5) multiplier = 2;
      else if (streak >= 3) multiplier = 1.5;
      
      const baseBonus = ADDICTION_CONFIG.STREAK.bonusPerWin;
      const bonus = Math.floor(baseBonus * streak * multiplier);
      
      return Math.min(bonus, ADDICTION_CONFIG.STREAK.maxStreakBonus);
    }

    /**
     * 베팅 시 호출
     */
    onBet(amount) {
      this.data.totalBetAmount += amount;
      this.data.totalRaces++;
      
      // XP 추가
      this.addXP(ADDICTION_CONFIG.LEVEL.xpPerBet, 'bet');
      
      // 퀘스트 업데이트
      this.updateQuests('bet', amount);
      
      // 업적 체크
      this.checkAchievements('bets', this.data.totalRaces);
      this.checkAchievements('betAmount', this.data.totalBetAmount);
      
      this.saveData();
    }

    /**
     * 일일 로그인 체크
     */
    checkDailyLogin() {
      const now = new Date();
      const today = now.toDateString();
      
      if (this.data.lastLoginDate !== today) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (this.data.lastLoginDate === yesterday.toDateString()) {
          this.data.loginStreak++;
        } else {
          this.data.loginStreak = 1;
        }
        
        this.data.lastLoginDate = today;
        this.data.totalLoginDays++;
        
        // 일일 로그인 보너스
        const loginBonus = this.calculateLoginBonus();
        
        // 퀘스트 새로고침
        this.refreshDailyQuests();
        
        this.saveData();
        
        return {
          loginStreak: this.data.loginStreak,
          bonus: loginBonus,
          isNewDay: true
        };
      }
      
      return { isNewDay: false };
    }

    /**
     * 로그인 보너스 계산
     */
    calculateLoginBonus() {
      const streak = this.data.loginStreak;
      let bonus = 5000; // 기본
      
      if (streak >= 30) bonus = 50000;
      else if (streak >= 14) bonus = 20000;
      else if (streak >= 7) bonus = 10000;
      else if (streak >= 3) bonus = 7000;
      
      return bonus;
    }

    /**
     * 일일 퀘스트 생성
     */
    generateDailyQuests() {
      const questTemplates = [
        { type: 'win', target: 1, desc: '경주 1회 승리', reward: 5000 },
        { type: 'win', target: 3, desc: '경주 3회 승리', reward: 15000 },
        { type: 'bet', target: 100000, desc: '베팅 10만원', reward: 10000 },
        { type: 'bet', target: 500000, desc: '베팅 50만원', reward: 50000 },
        { type: 'profit', target: 100000, desc: '수익 10만원 달성', reward: 20000 },
        { type: 'streak', target: 3, desc: '연속 3회 승리', reward: 10000 },
        { type: 'place', target: 3, desc: '연승 3위以内 3회', reward: 8000 },
        { type: 'highOdds', target: 5, desc: '배당 5배 이상 적중', reward: 15000 }
      ];
      
      // 무작위로 3개 선택
      const shuffled = [...questTemplates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, ADDICTION_CONFIG.DAILY_QUESTS.maxQuests);
      
      return selected.map((q, i) => ({
        id: `quest_${Date.now()}_${i}`,
        ...q,
        progress: 0,
        completed: false,
        claimed: false
      }));
    }

    /**
     * 일일 퀘스트 새로고침
     */
    refreshDailyQuests() {
      const now = new Date();
      const today = now.toDateString();
      
      if (this.data.lastQuestRefresh !== today) {
        this.data.dailyQuests = this.generateDailyQuests();
        this.data.lastQuestRefresh = today;
        this.data.completedQuestsToday = 0;
      }
    }

    /**
     * 퀘스트 업데이트
     */
    updateQuests(type, value) {
      let updated = false;
      
      this.data.dailyQuests.forEach(quest => {
        if (quest.claimed || quest.completed) return;
        
        if (quest.type === type) {
          quest.progress += value;
          
          if (quest.progress >= quest.target) {
            quest.completed = true;
            this.data.completedQuestsToday++;
            updated = true;
          }
        }
      });
      
      if (updated) this.saveData();
    }

    /**
     * 퀘스트 보상 클레임
     */
    claimQuestReward(questId) {
      const quest = this.data.dailyQuests.find(q => q.id === questId);
      
      if (!quest || !quest.completed || quest.claimed) {
        return { success: false, message: '퀘스트를 완료하지 않았습니다' };
      }
      
      quest.claimed = true;
      
      // 보상 지급
      if (window.handleWallet) {
        window.handleWallet(quest.reward);
      }
      
      this.addXP(quest.reward / 100, 'quest');
      
      this.saveData();
      
      return {
        success: true,
        reward: quest.reward,
        message: `${quest.reward.toLocaleString()}원 보상 획득!`
      };
    }

    /**
     * 업적 정의
     */
    getAchievementList() {
      return [
        // 승리 관련
        { id: 'win_1', name: '첫 승리', desc: '첫 번째 승리', category: 'win', target: 1, reward: 1000 },
        { id: 'win_10', name: '초보 승자', desc: '10회 승리', category: 'win', target: 10, reward: 5000 },
        { id: 'win_50', name: '숙련 승자', desc: '50회 승리', category: 'win', target: 50, reward: 25000 },
        { id: 'win_100', name: '마스터', desc: '100회 승리', category: 'win', target: 100, reward: 50000 },
        { id: 'win_500', name: '전설', desc: '500회 승리', category: 'win', target: 500, reward: 500000 },
        
        // 연승 관련
        { id: 'streak_3', name: '연속、初', desc: '3연승', category: 'streak', target: 3, reward: 3000 },
        { id: 'streak_5', name: '연속 5', desc: '5연승', category: 'streak', target: 5, reward: 10000 },
        { id: 'streak_10', name: '연속 10', desc: '10연승', category: 'streak', target: 10, reward: 30000 },
        { id: 'streak_20', name: '연속 20', desc: '20연승', category: 'streak', target: 20, reward: 100000 },
        { id: 'streak_50', name: '연속 50', desc: '50연승', category: 'streak', target: 50, reward: 500000 },
        
        // 베팅 관련
        { id: 'bet_1m', name: '첫 베팅', desc: '베팅 100만', category: 'money', target: 1000000, reward: 5000 },
        { id: 'bet_10m', name: '베팅러', desc: '베팅 1000만', category: 'money', target: 10000000, reward: 50000 },
        { id: 'bet_100m', name: '고수', desc: '베팅 1억', category: 'money', target: 100000000, reward: 500000 },
        
        // 특별
        { id: 'login_7', name: '주간 충성', desc: '7일 연속 로그인', category: 'special', target: 7, reward: 10000 },
        { id: 'login_30', name: '월간 충성', desc: '30일 연속 로그인', category: 'special', target: 30, reward: 50000 },
        
        // 레벨
        { id: 'level_10', name: '레벨 10', desc: '레벨 10 달성', category: 'race', target: 10, reward: 10000 },
        { id: 'level_30', name: '레벨 30', desc: '레벨 30 달성', category: 'race', target: 30, reward: 50000 },
        { id: 'level_50', name: '레벨 50', desc: '레벨 50 달성', category: 'race', target: 50, reward: 100000 }
      ];
    }

    /**
     * 업적 체크
     */
    checkAchievements(category, value) {
      const achievements = this.getAchievementList();
      const unlocked = [];
      
      achievements.forEach(ach => {
        if (this.data.unlockedAchievements.includes(ach.id)) return;
        if (ach.category !== category) return;
        
        if (value >= ach.target) {
          this.data.unlockedAchievements.push(ach.id);
          
          // 보상 지급
          if (window.handleWallet) {
            window.handleWallet(ach.reward);
          }
          
          this.addXP(ach.reward / 100, 'achievement');
          
          unlocked.push(ach);
        }
      });
      
      if (unlocked.length > 0) {
        this.saveData();
        
        // 알림
        if (window.addCast) {
          unlocked.forEach(ach => {
            window.addCast(`🏆 업적 달성: ${ach.name}! 보상: ${ach.reward.toLocaleString()}원`, 'highlight');
          });
        }
      }
      
      return unlocked;
    }

    /**
     * 통계 데이터 반환
     */
    getStats() {
      return {
        level: this.data.level,
        xp: this.data.xp,
        levelInfo: this.calculateLevel(this.data.xp),
        streak: this.data.currentStreak,
        bestStreak: this.data.bestStreak,
        totalWins: this.data.totalWins,
        totalRaces: this.data.totalRaces,
        loginStreak: this.data.loginStreak,
        totalLoginDays: this.data.totalLoginDays,
        achievementsUnlocked: this.data.unlockedAchievements.length,
        flameActive: this.data.streakFlameActive
      };
    }

    /**
     * 대시보드 HTML 생성
     */
    renderDashboard() {
      const stats = this.getStats();
      const levelInfo = stats.levelInfo;
      
      return `
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 16px; margin-top: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #6C5CE7, #a29bfe); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: white;">
                ${stats.level}
              </div>
              <div>
                <div style="color: #fff; font-weight: bold;">Lv.${stats.level}</div>
                <div style="color: #888; font-size: 11px;">XP: ${levelInfo.currentXP.toLocaleString()} / ${levelInfo.requiredXP.toLocaleString()}</div>
              </div>
            </div>
            ${stats.flameActive ? '<div style="font-size: 24px;">🔥</div>' : ''}
          </div>
          
          <div class="progress-bar" style="height: 8px; background: #333; border-radius: 4px; margin-bottom: 16px;">
            <div class="progress-fill" style="height: 100%; background: linear-gradient(90deg, #6C5CE7, #a29bfe); border-radius: 4px; width: ${levelInfo.progress}%;"></div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
            <div style="background: #0f0f23; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #ff6b9d;">연승</div>
              <div style="color: #fff; font-size: 16px; font-weight: bold;">${stats.streak}</div>
            </div>
            <div style="background: #0f0f23; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #9df7c7;">승리</div>
              <div style="color: #fff; font-size: 16px; font-weight: bold;">${stats.totalWins}</div>
            </div>
            <div style="background: #0f0f23; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="color: #ffd26e;">로그인</div>
              <div style="color: #fff; font-size: 16px; font-weight: bold;">${stats.loginStreak}일</div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * 퀘스트 패널 HTML 생성
     */
    renderQuestPanel() {
      this.refreshDailyQuests();
      
      let html = `
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 16px; margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="color: #fff; font-weight: bold;">📋 일일 퀘스트</div>
            <div style="color: #888; font-size: 11px;">${this.data.completedQuestsToday}/${ADDICTION_CONFIG.DAILY_QUESTS.maxQuests}</div>
          </div>
      `;
      
      this.data.dailyQuests.forEach(quest => {
        const progress = Math.min(100, (quest.progress / quest.target) * 100);
        const status = quest.claimed ? '✅ 완료' : (quest.completed ? '🎁 수령 가능' : '📝 진행 중');
        
        html += `
          <div style="background: #0f0f23; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="color: #fff; font-size: 12px;">${quest.desc}</div>
              <div style="color: #ffd26e; font-size: 11px;">${quest.reward.toLocaleString()}원</div>
            </div>
            <div class="progress-bar" style="height: 4px; background: #333; border-radius: 2px; margin-bottom: 4px;">
              <div class="progress-fill" style="height: 100%; background: ${quest.completed ? '#9df7c7' : '#6C5CE7'}; border-radius: 2px; width: ${progress}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="color: #888; font-size: 10px;">${quest.progress}/${quest.target}</div>
              ${quest.completed && !quest.claimed ? 
                `<button onclick="window.AddictionSystem?.claimQuest('${quest.id}')" style="background: #9df7c7; color: #000; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">수령</button>` :
                `<div style="color: ${quest.claimed ? '#9df7c7' : '#666'}; font-size: 10px;">${status}</div>`
              }
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      return html;
    }

    /**
     * 업적 패널 HTML 생성
     */
    renderAchievementPanel() {
      const achievements = this.getAchievementList();
      
      let html = `
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 16px; margin-top: 12px;">
          <div style="color: #fff; font-weight: bold; margin-bottom: 12px;">🏆 업적 (${this.data.unlockedAchievements.length}/${achievements.length})</div>
      `;
      
      achievements.forEach(ach => {
        const unlocked = this.data.unlockedAchievements.includes(ach.id);
        
        html += `
          <div style="background: ${unlocked ? '#1a1a2e' : '#0f0f23'}; padding: 8px; border-radius: 6px; margin-bottom: 6px; opacity: ${unlocked ? 1 : 0.5};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="font-size: 16px;">${unlocked ? '🏆' : '🔒'}</div>
                <div>
                  <div style="color: #fff; font-size: 12px;">${ach.name}</div>
                  <div style="color: #888; font-size: 10px;">${ach.desc}</div>
                </div>
              </div>
              <div style="color: #ffd26e; font-size: 10px;">${ach.reward.toLocaleString()}원</div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      return html;
    }
  }

  // 전역 노출
  window.AddictionSystem = new AddictionSystem();

  // 퀘스트 클레임 함수
  window.claimQuest = function(questId) {
    const result = window.AddictionSystem.claimQuestReward(questId);
    if (result.success) {
      alert(result.message);
      // UI 새로고침
      if (window.refreshAddictionUI) {
        window.refreshAddictionUI();
      }
    }
  };

  console.log('[AddictionSystem v5.2.0] Loaded - Addiction mechanics ready');
})();
