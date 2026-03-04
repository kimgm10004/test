(function() {
  'use strict';

  class ReplayPlayer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.replay = null;
      this.currentFrame = 0;
      this.totalFrames = 0;
      this.isPlaying = false;
      this.speed = 1;
      this.animationId = null;
      this.lastTime = 0;
      this.onFrameChange = null;
      this.onComplete = null;
      this.preloadedImages = [];
    }

    load(replayData) {
      if (!replayData || !replayData.frames || replayData.frames.length === 0) {
        console.error('[ReplayPlayer] Invalid replay data');
        return false;
      }

      this.replay = replayData;
      this.currentFrame = 0;
      this.totalFrames = replayData.frames.length;
      this.isPlaying = false;

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      this.preloadImages();
      this.render();
      console.log('[ReplayPlayer] Loaded: R' + replayData.raceNo + ', ' + this.totalFrames + ' frames');
      return true;
    }

    preloadImages() {
      this.preloadedImages = [];
      const frames = this.replay.frames;

      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        img.src = frames[i].image;
        this.preloadedImages.push(img);
      }
    }

    play() {
      if (!this.replay) return;
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animate();
    }

    pause() {
      this.isPlaying = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    stop() {
      this.pause();
      this.currentFrame = 0;
      this.render();
    }

    seek(frame) {
      this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames - 1));
      this.render();
      if (this.onFrameChange) {
        this.onFrameChange(this.currentFrame);
      }
    }

    setSpeed(speed) {
      this.speed = speed;
    }

    animate() {
      if (!this.isPlaying) return;

      const now = performance.now();
      const delta = now - this.lastTime;
      const frameInterval = 50 / this.speed;

      if (delta >= frameInterval) {
        this.currentFrame++;
        this.lastTime = now;

        if (this.currentFrame >= this.totalFrames) {
          this.currentFrame = this.totalFrames - 1;
          this.pause();
          if (this.onComplete) {
            this.onComplete();
          }
          return;
        }

        this.render();
        if (this.onFrameChange) {
          this.onFrameChange(this.currentFrame);
        }
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }

    render() {
      if (!this.replay || !this.replay.frames) return;

      const ctx = this.ctx;
      const frame = this.replay.frames[this.currentFrame];

      ctx.fillStyle = '#0b0e16';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      if (!frame || !frame.image) {
        this.drawPlaceholder();
        return;
      }

      const img = this.preloadedImages[this.currentFrame];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      } else if (frame.image) {
        const tempImg = new Image();
        tempImg.onload = () => {
          ctx.drawImage(tempImg, 0, 0, this.canvas.width, this.canvas.height);
        };
        tempImg.src = frame.image;
      }

      this.drawInfo();
    }

    drawPlaceholder() {
      const ctx = this.ctx;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = '#4ECDC4';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('로딩중...', this.canvas.width / 2, this.canvas.height / 2);
      ctx.textAlign = 'left';
    }

    drawInfo() {
      const ctx = this.ctx;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 220, 80);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px sans-serif';

      if (this.replay) {
        ctx.fillText('경기: R' + (this.replay.raceNo || '-') + ' | ' + (this.replay.track || '-'), 20, 35);
        ctx.fillText('거리: ' + (this.replay.distance || 0) + 'm | ' + (this.replay.grade || '-'), 20, 55);
        ctx.fillText('프레임: ' + (this.currentFrame + 1) + '/' + this.totalFrames, 20, 75);
      }
    }

    getProgress() {
      return this.totalFrames > 0 ? this.currentFrame / (this.totalFrames - 1) : 0;
    }

    destroy() {
      this.pause();
      this.replay = null;
      this.preloadedImages = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  window.ReplayPlayer = ReplayPlayer;

  console.log('[ReplayPlayer] Image-based player loaded');

})();
