(function() {
  'use strict';

  if (!window.ReplayRecorder) {
    console.warn('[ReplayRecorder] replay-data.js not loaded');
    return;
  }

  let frameData = [];
  let raceInfo = null;
  let isRecording = false;
  let raceStartTime = 0;

  function startRaceRecording(info) {
    if (!info) return;

    raceInfo = {
      raceNo: info.raceNo || 1,
      track: info.track || '서울',
      grade: info.grade || 'OPEN',
      distance: info.distance || 1200,
      horses: []
    };

    frameData = [];
    isRecording = true;
    raceStartTime = Date.now();

    console.log('[ReplayRecorder] Recording started: R' + raceInfo.raceNo);
  }

  function recordFrame(positions) {
    if (!isRecording || !positions) return;

    frameData.push({
      time: Date.now() - raceStartTime,
      positions: positions.map(p => ({
        no: p.no,
        dist: p.dist || p.distance || 0,
        finished: p.finished || false,
        stumble: p.stumble || false
      }))
    });
  }

  function finishRaceRecording(finalOrder) {
    if (!isRecording) return;

    isRecording = false;

    const replayData = {
      raceNo: raceInfo.raceNo,
      track: raceInfo.track,
      grade: raceInfo.grade,
      distance: raceInfo.distance,
      horses: raceInfo.horses,
      frames: frameData,
      finalOrder: finalOrder || [],
      date: new Date().toISOString()
    };

    window.ReplayRecorder.save(replayData);
    console.log('[ReplayRecorder] Race finished and saved');

    raceInfo = null;
    frameData = [];
  }

  function hookGameFunctions() {
    const originalNewRace = window.newRace;
    if (typeof originalNewRace === 'function') {
      window.newRace = function(info) {
        startRaceRecording(info);
        return originalNewRace.apply(this, arguments);
      };
    }

    const originalUpdate = window.update;
    if (typeof originalUpdate === 'function') {
      window.update = function() {
        if (isRecording && typeof window.horses !== 'undefined') {
          const positions = window.horses.map(h => ({
            no: h.no,
            dist: h.dist,
            finished: h.finished,
            stumble: h.stumble
          }));
          recordFrame(positions);
        }
        return originalUpdate.apply(this, arguments);
      };
    }

    const originalFinishRace = window.finishRace;
    if (typeof originalFinishRace === 'function') {
      window.finishRace = function() {
        if (typeof window.finalOrder !== 'undefined') {
          finishRaceRecording(window.finalOrder);
        }
        return originalFinishRace.apply(this, arguments);
      };
    }

    console.log('[ReplayRecorder] Game functions hooked');
  }

  setTimeout(() => {
    if (document.readyState === 'complete') {
      hookGameFunctions();
    } else {
      window.addEventListener('load', hookGameFunctions);
    }
  }, 100);

  console.log('[ReplayRecorder] Injection script loaded');

})();
