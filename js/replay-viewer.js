(function() {
  'use strict';

  let player = null;
  let currentReplayIndex = -1;

  async function init() {
    const canvas = document.getElementById('replayCanvas');
    if (!canvas) {
      console.error('[ReplayViewer] Canvas element not found');
      return;
    }

    player = new ReplayPlayer(canvas);

    bindEvents();
    initStatsTabs();
    await loadReplayList();
    await loadDashboardStats();  // 누적 통계 로드
    await loadSeasonInfo();  // 시즌 정보 로드
    showEmptyState();

    console.log('[ReplayViewer] Viewer initialized');
  }

  // 시즌 정보 로드 및 표시
  async function loadSeasonInfo() {
    try {
      if (!window.ReplayRecorder?.getCurrentSeason) {
        console.warn('[ReplayViewer] getCurrentSeason not available');
        return;
      }

      const season = await window.ReplayRecorder.getCurrentSeason();
      console.log('[ReplayViewer] Current season:', season);

      // 시즌 정보 표시
      const seasonEl = document.getElementById('current-season');
      const weekEl = document.getElementById('current-week');
      const gameEl = document.getElementById('current-game');
      const progressEl = document.getElementById('season-progress');

      if (seasonEl) seasonEl.textContent = season.seasonNumber;
      if (weekEl) weekEl.textContent = season.week;
      if (gameEl) gameEl.textContent = season.gameCount;

      // 진행률 계산 (전체 시즌 기준)
      const totalGames = (season.week - 1) * 6 + season.gameCount;
      const maxGames = 52 * 6; // 52주 × 6게임
      const progress = (totalGames / maxGames * 100).toFixed(1);
      
      if (progressEl) progressEl.style.width = progress + '%';

      // 시즌 히스토리도 함께 로드
      await loadSeasonHistory();

    } catch (e) {
      console.error('[ReplayViewer] Failed to load season info:', e);
    }
  }

  // 시즌 히스토리 로드 및 드롭다운 설정
  async function loadSeasonHistory() {
    try {
      if (!window.ReplayRecorder?.getAllSeasonStats) {
        console.warn('[ReplayViewer] getAllSeasonStats not available');
        return;
      }

      const history = await window.ReplayRecorder.getAllSeasonStats();
      const select = document.getElementById('seasonHistorySelect');
      
      if (!select) return;

      // 현재 옵션 유지 ("현재 시즌")
      select.innerHTML = '<option value="current">현재 시즌</option>';

      // 히스토리 추가 (최신부터)
      history.forEach(season => {
        const option = document.createElement('option');
        option.value = season.seasonNumber;
        option.textContent = `시즌 ${season.seasonNumber} (완료)`;
        select.appendChild(option);
      });

      console.log('[ReplayViewer] Season history loaded:', history.length, 'seasons');

    } catch (e) {
      console.error('[ReplayViewer] Failed to load season history:', e);
    }
  }

  // 선택된 시즌 통계 표시
  async function showSelectedSeasonStats() {
    const select = document.getElementById('seasonHistorySelect');
    const container = document.getElementById('seasonHistoryStats');
    
    if (!select || !container) return;

    const selectedValue = select.value;
    
    if (selectedValue === 'current') {
      container.innerHTML = '<div class="empty-message" style="font-size: 11px;">현재 시즌 진행 중</div>';
      return;
    }

    try {
      const seasonNumber = parseInt(selectedValue);
      const seasonData = await window.ReplayRecorder?.getSeasonStats(seasonNumber);
      
      if (!seasonData || !seasonData.stats) {
        container.innerHTML = '<div class="empty-message" style="font-size: 11px;">통계 데이터 없음</div>';
        return;
      }

      const stats = seasonData.stats;
      const summary = stats.summary || {};

      container.innerHTML = `
        <div class="season-stat-row">
          <span class="season-stat-label">총 경기:</span>
          <span class="season-stat-value">${summary.totalGames || 0}회</span>
        </div>
        <div class="season-stat-row">
          <span class="season-stat-label">총 상금:</span>
          <span class="season-stat-value">${(summary.totalPrize || 0).toLocaleString()}원</span>
        </div>
        <div class="season-stat-row">
          <span class="season-stat-label">총 베팅:</span>
          <span class="season-stat-value">${(summary.totalBet || 0).toLocaleString()}원</span>
        </div>
        <div class="season-stat-row">
          <span class="season-stat-label">수익률:</span>
          <span class="season-stat-value">${summary.totalBet > 0 ? (((summary.totalReturn - summary.totalBet) / summary.totalBet) * 100).toFixed(1) : 0}%</span>
        </div>
        <div class="season-stat-row">
          <span class="season-stat-label">보관일:</span>
          <span class="season-stat-value">${new Date(seasonData.archivedAt).toLocaleDateString()}</span>
        </div>
      `;

    } catch (e) {
      console.error('[ReplayViewer] Failed to show season stats:', e);
      container.innerHTML = '<div class="empty-message" style="font-size: 11px; color: #e74c3c;">통계 로드 실패</div>';
    }
  }

  function bindEvents() {
    document.getElementById('btnPlay')?.addEventListener('click', play);
    document.getElementById('btnPause')?.addEventListener('click', pause);
    document.getElementById('btnStop')?.addEventListener('click', stop);
    document.getElementById('btnPrev')?.addEventListener('click', prevFrame);
    document.getElementById('btnNext')?.addEventListener('click', nextFrame);

    document.getElementById('speedSelect')?.addEventListener('change', function() {
      const speed = parseFloat(this.value);
      player?.setSpeed(speed);
    });

    document.getElementById('progressSlider')?.addEventListener('input', function() {
      const frame = Math.floor(this.value);
      player?.seek(frame);
      updateProgressDisplay();
    });

    document.getElementById('btnRefresh')?.addEventListener('click', loadReplayList);
    document.getElementById('btnClearAll')?.addEventListener('click', clearAllReplays);

    // 시즌 히스토리 드롭다운 이벤트
    document.getElementById('seasonHistorySelect')?.addEventListener('change', showSelectedSeasonStats);

    window.addEventListener('keydown', handleKeyboard);
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;

    switch(e.key) {
      case ' ':
        e.preventDefault();
        player?.isPlaying ? pause() : play();
        break;
      case 'ArrowLeft':
        prevFrame();
        break;
      case 'ArrowRight':
        nextFrame();
        break;
      case 'Home':
        stop();
        break;
    }
  }

  // 통계 탭 전환 기능
  function initStatsTabs() {
    const tabs = document.querySelectorAll('.stats-tab');
    const contents = document.querySelectorAll('.stats-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // 모든 탭 비활성화
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // 선택한 탭 활성화
        tab.classList.add('active');
        document.getElementById(`tab-${targetTab}`)?.classList.add('active');
      });
    });
  }

  async function loadReplayList() {
    const container = document.getElementById('replayList');
    if (!container) return;

    container.innerHTML = '<div class="empty-message">불러오는 중...</div>';

    try {
      const replays = window.ReplayRecorder?.getAll() ? await window.ReplayRecorder.getAll() : [];
      container.innerHTML = '';

      if (replays.length === 0) {
        container.innerHTML = '<div class="empty-message">저장된 리플레이가 없습니다.</div>';
        updateStats(0);
        return;
      }

      replays.forEach((replay, index) => {
        const item = document.createElement('div');
        item.className = 'replay-item';
        item.dataset.index = index;

        const date = new Date(replay.date);
        const dateStr = date.toLocaleDateString('ko-KR');
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        item.innerHTML = `
          <div class="replay-info">
            <span class="race-no">R${replay.raceNo || '-'}</span>
            <span class="track">${replay.track || '-'}</span>
            <span class="grade">${replay.grade || '-'}</span>
            <span class="distance">${replay.distance || 0}m</span>
          </div>
          <div class="replay-meta">
            <span>${dateStr} ${timeStr}</span>
            <span>프레임: ${replay.frameCount || 0}</span>
          </div>
        `;

        item.addEventListener('click', () => selectReplay(index));
        container.appendChild(item);
      });

      updateStats(replays.length);

      if (currentReplayIndex >= 0 && currentReplayIndex < replays.length) {
        highlightReplay(currentReplayIndex);
      }
    } catch (e) {
      console.error('[ReplayViewer] 불러오기 실패:', e);
      container.innerHTML = '<div class="empty-message">불러오기 실패</div>';
    }
  }

  async function selectReplay(index) {
    const replays = window.ReplayRecorder?.getAll() ? await window.ReplayRecorder.getAll() : [];
    const replay = replays[index];

    if (!replay) {
      console.error('[ReplayViewer] No replay found at index:', index);
      return;
    }

    console.log('[ReplayViewer] Selected replay:', replay.raceNo, 'has stats:', !!replay.stats);
    if (replay.stats) {
      console.log('[ReplayViewer] Replay stats:', JSON.stringify(replay.stats, null, 2));
    }

    currentReplayIndex = index;

    player?.stop();

    if (player?.load(replay)) {
      showPlayerState(replay);
      updateControls();
      highlightReplay(index);
    }
  }

  function highlightReplay(index) {
    document.querySelectorAll('.replay-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  function showEmptyState() {
    const info = document.getElementById('replayInfo');
    if (info) {
      info.innerHTML = '<div class="empty-message">리플레이를 선택해주세요</div>';
    }
    disableControls();
  }

  function showPlayerState(replay) {
    const info = document.getElementById('replayInfo');
    if (info) {
      info.innerHTML = `
        <span>R${replay.raceNo}</span>
        <span>|</span>
        <span>${replay.track}</span>
        <span>${replay.grade}</span>
        <span>${replay.distance}m</span>
        <span>|</span>
        <span>${replay.horses?.length || 0}마리</span>
      `;
    }
    
    // 통계 패널 표시
    showStatsPanel(replay);
    enableControls();
  }

  function showStatsPanel(replay) {
    const statsPanel = document.getElementById('statsPanel');
    if (!statsPanel) {
      console.error('[ReplayViewer] statsPanel element not found');
      return;
    }
    
    // 항상 표시
    statsPanel.style.display = 'block';
    
    console.log('[ReplayViewer] Replay data:', replay);
    console.log('[ReplayViewer] Stats data:', replay.stats);
    
    const stats = replay.stats;
    if (!stats) {
      // 통계 데이터가 없을 때
      console.log('[ReplayViewer] No stats data available');
      document.getElementById('tab-summary').innerHTML = '<div class="empty-message">통계 데이터가 없습니다.<br>새로 녹화된 리플레이부터 통계가 표시됩니다.</div>';
      document.getElementById('tab-horses').innerHTML = '<div class="empty-message">통계 데이터가 없습니다.</div>';
      document.getElementById('tab-betting').innerHTML = '<div class="empty-message">통계 데이터가 없습니다.</div>';
      return;
    }
    
    console.log('[ReplayViewer] Displaying stats:', stats);
    
    // 요약 탭 데이터 표시
    const totalBet = stats.totalBet || 0;
    const totalReturn = stats.totalReturn || 0;
    const pnl = stats.pnl || 0;
    const prize = stats.prize || 0;
    const ticketCount = stats.ticketCount || 0;
    const roi = totalBet > 0 ? ((totalReturn - totalBet) / totalBet * 100).toFixed(1) : 0;
    
    updateStatValue('stat-total-bet', totalBet, false, true);
    updateStatValue('stat-total-return', totalReturn, false, true);
    updateStatValue('stat-pnl', pnl, true, true);
    updateStatValue('stat-prize', prize, false, true);
    
    document.getElementById('stat-ticket-count').textContent = ticketCount + '장';
    document.getElementById('stat-roi').textContent = roi + '%';
    document.getElementById('stat-roi').style.color = roi >= 0 ? '#27ae60' : '#e74c3c';
    
    // 말 성적 탭 데이터 표시
    showHorseResults(stats.horseResults);
    
    // 베팅 탭 데이터 표시
    if (stats.prizeDistribution) {
      updateStatValue('prize-first', stats.prizeDistribution.first || 0, false, true);
      updateStatValue('prize-second', stats.prizeDistribution.second || 0, false, true);
      updateStatValue('prize-third', stats.prizeDistribution.third || 0, false, true);
    }
  }

  function updateStatValue(elementId, value, showSign = false, formatNumber = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let displayValue = value;
    if (formatNumber) {
      displayValue = value.toLocaleString('ko-KR');
    }
    if (showSign && value > 0) {
      displayValue = '+' + displayValue;
    }
    
    element.textContent = displayValue;
    
    // 색상 설정
    if (showSign) {
      element.classList.remove('positive', 'negative');
      if (value > 0) element.classList.add('positive');
      else if (value < 0) element.classList.add('negative');
    }
  }

  function showHorseResults(horseResults) {
    const container = document.getElementById('horse-list');
    if (!container || !horseResults) return;
    
    container.innerHTML = '';
    
    // 순위별로 정렬
    const sorted = [...horseResults].sort((a, b) => a.finalPosition - b.finalPosition);
    
    sorted.forEach(horse => {
      const item = document.createElement('div');
      item.className = `horse-item rank-${horse.finalPosition}`;
      
      const medal = horse.finalPosition === 1 ? '🥇' : 
                    horse.finalPosition === 2 ? '🥈' : 
                    horse.finalPosition === 3 ? '🥉' : `${horse.finalPosition}위`;
      
      item.innerHTML = `
        <div>
          <div class="horse-name">${medal} ${horse.no}번 ${horse.name}</div>
          <div class="horse-info">${horse.jockey} | ${horse.sire} | R${horse.rating}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#888;">속도 ${(horse.speed*100).toFixed(0)}</div>
          <div style="font-size:11px;color:#888;">지구력 ${(horse.stamina*100).toFixed(0)}</div>
          ${horse.stumble ? '<span style="color:#e74c3c;font-size:11px;">⚠ 실신</span>' : ''}
        </div>
      `;
      
      container.appendChild(item);
    });
  }

  function updateControls() {
    const slider = document.getElementById('progressSlider');
    const frameDisplay = document.getElementById('frameDisplay');

    if (slider && player) {
      slider.max = Math.max(0, player.totalFrames - 1);
      slider.value = player.currentFrame;
    }

    if (frameDisplay && player) {
      frameDisplay.textContent = `${player.currentFrame + 1} / ${player.totalFrames}`;
    }

    updateProgressDisplay();
  }

  function updateProgressDisplay() {
    const progress = document.getElementById('progressPercent');
    if (progress && player) {
      progress.textContent = Math.round(player.getProgress() * 100) + '%';
    }
  }

  async function updateStats(count) {
    const countEl = document.getElementById('replayCount');
    const usageEl = document.getElementById('storageUsage');

    if (countEl) countEl.textContent = count + '개';
    if (usageEl && window.ReplayRecorder?.usage) {
      try {
        const usage = await window.ReplayRecorder.usage();
        usageEl.textContent = usage.total || '0 KB';
      } catch (e) {
        usageEl.textContent = '-';
      }
    }
  }

  function play() {
    if (!player?.replay) return;
    player.play();
    updatePlayButtons(true);
  }

  function pause() {
    player?.pause();
    updatePlayButtons(false);
  }

  function stop() {
    player?.stop();
    updatePlayButtons(false);
    updateControls();
  }

  function prevFrame() {
    player?.seek(player.currentFrame - 1);
    updateControls();
  }

  function nextFrame() {
    player?.seek(player.currentFrame + 1);
    updateControls();
  }

  function updatePlayButtons(isPlaying) {
    const playBtn = document.getElementById('btnPlay');
    const pauseBtn = document.getElementById('btnPause');

    if (playBtn) playBtn.style.display = isPlaying ? 'none' : 'inline-block';
    if (pauseBtn) pauseBtn.style.display = isPlaying ? 'inline-block' : 'none';
  }

  function enableControls() {
    const btns = ['btnPlay', 'btnPause', 'btnStop', 'btnPrev', 'btnNext'];
    btns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });

    const slider = document.getElementById('progressSlider');
    if (slider) slider.disabled = false;
  }

  function disableControls() {
    const btns = ['btnPlay', 'btnPause', 'btnStop', 'btnPrev', 'btnNext'];
    btns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });

    const slider = document.getElementById('progressSlider');
    if (slider) {
      slider.disabled = true;
      slider.value = 0;
    }

    const frameDisplay = document.getElementById('frameDisplay');
    if (frameDisplay) frameDisplay.textContent = '0 / 0';
  }

  async function clearAllReplays() {
    if (!confirm('모든 리플레이를 삭제하시겠습니까?')) return;

    await window.ReplayRecorder?.clear();
    player?.destroy();
    currentReplayIndex = -1;
    showEmptyState();
    await loadReplayList();
    console.log('[ReplayViewer] All replays cleared');
  }

  function restoreLastViewed() {
    try {
      const last = window.Storage.getItem('last_replay');
      if (last) {
        const index = parseInt(last, 10);
        selectReplay(index);
      }
    } catch (e) {
      console.warn('[ReplayViewer] Failed to restore last viewed:', e);
    }
  }

  function saveLastViewed(index) {
    window.Storage.setItem('last_replay', index);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
    setTimeout(restoreLastViewed, 500);
  }

  // 누적 통계 대시보드 로드
  async function loadDashboardStats() {
    console.log('[ReplayViewer] Loading dashboard stats...');
    
    if (!window.ReplayStats) {
      console.error('[ReplayViewer] ReplayStats module not found');
      return;
    }

    try {
      const stats = await window.ReplayStats.calculateAllStats();
      
      if (!stats) {
        // 리플레이 없음
        document.getElementById('dashboardContent').style.display = 'none';
        document.getElementById('dashboardEmpty').style.display = 'block';
        return;
      }

      // 대시보드 표시
      document.getElementById('dashboardContent').style.display = 'block';
      document.getElementById('dashboardEmpty').style.display = 'none';

      // 요약 통계 표시
      showSummaryStats(stats.summary);
      
      // 말별 통계 표시 (번호 기준 TOP 10)
      showHorseStats(stats.horseStats);
      
      // 기수별 통계 표시
      showJockeyStats(stats.jockeyStats);
      
      // 거리별 통계 표시
      showDistanceStats(stats.distanceStats);
      
      // 날씨별 통계 표시
      showWeatherStats(stats.weatherStats);
      
      // 트랙 위치별 통계 표시
      showTrackLocationStats(stats.trackLocationStats);
      
      // 등급별 통계 표시
      showGradeStats(stats.gradeStats);
      
      // 시간대별 통계 표시
      showTimeStats(stats.timeStats);
      
      // 최근 추세 표시
      showTrendStats(stats.recentTrend);

      console.log('[ReplayViewer] Dashboard stats loaded');
    } catch (e) {
      console.error('[ReplayViewer] Failed to load dashboard stats:', e);
    }
  }

  function showSummaryStats(summary) {
    updateElement('dash-total-races', summary.totalRaces);
    updateElement('dash-win-rate', summary.winRate + '%');
    updateElement('dash-roi', summary.roi + '%');
    
    const pnlElement = document.getElementById('dash-total-pnl');
    if (pnlElement) {
      pnlElement.textContent = (summary.pnl > 0 ? '+' : '') + summary.pnl.toLocaleString('ko-KR') + '원';
      pnlElement.className = 'stat-value ' + (summary.pnl >= 0 ? 'positive' : 'negative');
    }
    
    updateElement('dash-total-prize', summary.totalPrize.toLocaleString('ko-KR') + '원');
    
    const avgElement = document.getElementById('dash-avg-pnl');
    if (avgElement) {
      avgElement.textContent = (summary.avgPnlPerRace > 0 ? '+' : '') + summary.avgPnlPerRace.toLocaleString('ko-KR') + '원';
      avgElement.className = 'stat-value ' + (summary.avgPnlPerRace >= 0 ? 'positive' : 'negative');
    }
  }

  function showHorseStats(horseStats) {
    const container = document.getElementById('dash-horse-stats');
    if (!container || !horseStats || horseStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    // TOP 5만 표시
    container.innerHTML = horseStats.slice(0, 5).map((horse, index) => `
      <div class="horse-stat-item rank-${index + 1}" style="padding:8px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:700;color:#FFD700;font-size:14px;">${horse.no}번</span>
          <span style="font-size:11px;color:#888;">${horse.totalRaces}회 출전</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:12px;color:#4ECDC4;font-weight:600;">${horse.winRate}%</span>
          <span style="font-size:10px;color:#888;">승률</span>
        </div>
      </div>
    `).join('');
  }

  function showGradeStats(gradeStats) {
    const container = document.getElementById('dash-grade-stats');
    if (!container || !gradeStats || gradeStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    // 주요 등급만 표시 (G1~G3, OPEN, 1등급)
    const priorityGrades = ['G1', 'G2', 'G3', 'OPEN', '1등급'];
    const filtered = gradeStats.filter(g => priorityGrades.includes(g.grade)).slice(0, 5);

    container.innerHTML = filtered.map(grade => `
      <div class="grade-stat-item" style="padding:6px 8px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:12px;color:#6C5CE7;">${grade.grade}</span>
          <span style="font-size:10px;color:#888;">${grade.totalRaces}회</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#4ECDC4;">${grade.winRate}%</span>
        </div>
      </div>
    `).join('');
  }

  // 기수별 통계 표시 (TOP 3)
  function showJockeyStats(jockeyStats) {
    const container = document.getElementById('dash-jockey-stats');
    if (!container || !jockeyStats || jockeyStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    // TOP 3만 표시
    container.innerHTML = jockeyStats.slice(0, 3).map((jockey, index) => `
      <div class="jockey-stat-item rank-${index + 1}" style="padding:8px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:13px;">${jockey.name}</span>
          <span style="font-size:10px;color:#888;">${jockey.totalRides}회 기승</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:12px;color:#4ECDC4;font-weight:600;">${jockey.winRate}%</span>
        </div>
      </div>
    `).join('');
  }

  // 거리별 통계 표시 (컴팩트)
  function showDistanceStats(distanceStats) {
    const container = document.getElementById('dash-distance-stats');
    if (!container || !distanceStats || distanceStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    container.innerHTML = distanceStats.slice(0, 3).map(dist => `
      <div class="distance-stat-item" style="padding:6px 8px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:12px;">${dist.distance}</span>
          <span style="font-size:10px;color:#888;">${dist.totalRaces}회</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#4ECDC4;">${dist.winRate}%</span>
        </div>
      </div>
    `).join('');
  }

  // 날씨별 통계 표시 (컴팝트)
  function showWeatherStats(weatherStats) {
    const container = document.getElementById('dash-weather-stats');
    if (!container || !weatherStats || weatherStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    container.innerHTML = weatherStats.map(weather => `
      <div class="weather-stat-item">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">${weather.weather === '맑음' ? '☀️' : '🌧️'}</span>
          <span style="font-size:12px;">${weather.weather}</span>
          <span style="font-size:10px;color:#888;">${weather.totalRaces}회</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#4ECDC4;">${weather.winRate}%</span>
        </div>
      </div>
    `).join('');
  }

  // 트랙 위치별 통계 표시 (컴팩트)
  function showTrackLocationStats(trackStats) {
    const container = document.getElementById('dash-track-stats');
    if (!container || !trackStats || trackStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    container.innerHTML = trackStats.slice(0, 3).map(track => `
      <div class="track-stat-item" style="padding:6px 8px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;">📍</span>
          <span style="font-weight:600;font-size:12px;">${track.location}</span>
          <span style="font-size:10px;color:#888;">${track.totalRaces}회</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#4ECDC4;">${track.winRate}%</span>
        </div>
      </div>
    `).join('');
  }

  // 시간대별 통계 표시 (컴팩트)
  function showTimeStats(timeStats) {
    const container = document.getElementById('dash-time-stats');
    if (!container || !timeStats || timeStats.length === 0) {
      if (container) container.innerHTML = '<div class="empty-message" style="font-size:12px;padding:10px;">데이터 없음</div>';
      return;
    }

    container.innerHTML = timeStats.slice(0, 3).map(time => `
      <div class="time-stat-item" style="padding:6px 8px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">${time.timeSlot === '오전' ? '🌅' : time.timeSlot === '오후' ? '☀️' : '🌙'}</span>
          <span style="font-size:12px;">${time.timeSlot}</span>
          <span style="font-size:10px;color:#888;">${time.totalRaces}회</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#4ECDC4;">${time.winRate}%</span>
        </div>
       </div>
     `).join('');
   }

   function showTrendStats(trend) {
    updateElement('dash-recent-winrate', trend.recentWinRate + '%');
    
    const pnlElement = document.getElementById('dash-recent-pnl');
    if (pnlElement) {
      pnlElement.textContent = (trend.recentTotalPnl > 0 ? '+' : '') + trend.recentTotalPnl.toLocaleString('ko-KR') + '원';
      pnlElement.className = 'stat-value ' + (trend.recentTotalPnl >= 0 ? 'positive' : 'negative');
    }
    
    const trendElement = document.getElementById('dash-trend');
    if (trendElement) {
      trendElement.textContent = trend.trend;
      trendElement.className = 'stat-value ' + 
        (trend.trend === '상승' ? 'positive' : 
         trend.trend === '하락' ? 'negative' : '');
    }
  }

  function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  // 새로고침 버튼 이벤트
  document.getElementById('btnRefreshStats')?.addEventListener('click', loadDashboardStats);

  console.log('[ReplayViewer] Module loaded');

})();
