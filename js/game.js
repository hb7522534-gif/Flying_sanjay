/**
 * FLYING SANJAY - Core Game Engine
 * Coordinates vibrant arcade environment, sky, clouds, skyline, bushes,
 * grassy ground, input handling, game loop, rendering, particles, and collisions.
 * Features fixed-timestep physics and zero-layout-thrashing 60fps canvas rendering.
 */

import { V_WIDTH, V_HEIGHT, GROUND_HEIGHT, STATES, PHYSICS } from './constants.js';
import { state } from './state.js';
import { ui } from './ui.js?v=2.1';
import { audioManager } from './audio.js';
import { player } from './player.js';
import { obstacleManager } from './obstacles.js';

export class GameEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.containerWidth = V_WIDTH;
    this.containerHeight = V_HEIGHT;
    this.scale = 1;
    this.groundOffset = 0;
    this.clouds = [];
    this.skylineBuildings = [];
    this.skylineCanvas = null;
    this.particles = [];
    this.lastTime = 0;
    this.accumulator = 0;
    this.isRunning = false;
    this.isInputBound = false;
    this.animFrameId = null;

    // Cached gradients for zero-allocation rendering
    this.skyGrad = null;
    this.earthGrad = null;
    this.grassGrad = null;
  }

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('game-container');

    this.initClouds();
    this.initSkyline();
    this.handleResize();

    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => this.handleResize());
    document.addEventListener('visibilitychange', () => {
      this.lastTime = 0;
      this.accumulator = 0;
    });
    window.addEventListener('focus', () => {
      this.lastTime = 0;
      this.accumulator = 0;
    });

    ui.init({
      onRestart: () => this.startGame(),
      onStart: () => this.startGame()
    });
    audioManager.init();

    this.bindInputs();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  initClouds() {
    this.clouds = [
      { x: 30, y: 70, speed: 0.35, scale: 1.1 },
      { x: 190, y: 120, speed: 0.25, scale: 0.85 },
      { x: 320, y: 55, speed: 0.40, scale: 1.25 }
    ];
  }

  initSkyline() {
    // Generate retro arcade buildings along horizon
    this.skylineBuildings = [];
    let curX = 0;
    const groundY = V_HEIGHT - GROUND_HEIGHT;

    while (curX < V_WIDTH + 80) {
      const bWidth = 24 + Math.floor(Math.random() * 22);
      const bHeight = 45 + Math.floor(Math.random() * 65);
      this.skylineBuildings.push({
        x: curX,
        y: groundY - bHeight,
        w: bWidth,
        h: bHeight
      });
      curX += bWidth + 2;
    }

    // Pre-render skyline to an offscreen canvas to eliminate per-frame layout and window fill loops
    this.prerenderSkyline(groundY);
  }

  prerenderSkyline(groundY) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = V_WIDTH + 80;
    offCanvas.height = V_HEIGHT;
    const offCtx = offCanvas.getContext('2d');

    offCtx.fillStyle = '#93c5fd';
    offCtx.strokeStyle = '#60a5fa';
    offCtx.lineWidth = 1;

    this.skylineBuildings.forEach(b => {
      offCtx.fillRect(b.x, b.y, b.w, b.h);
      offCtx.strokeRect(b.x, b.y, b.w, b.h);

      // Subtle window rows
      offCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (let wy = b.y + 6; wy < groundY - 10; wy += 9) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 6) {
          offCtx.fillRect(wx, wy, 3, 4);
        }
      }
      offCtx.fillStyle = '#93c5fd';
    });

    this.skylineCanvas = offCanvas;
  }

  initCachedGradients() {
    if (!this.ctx) return;
    const groundY = V_HEIGHT - GROUND_HEIGHT;

    // 1. Sky Gradient
    this.skyGrad = this.ctx.createLinearGradient(0, 0, 0, groundY);
    this.skyGrad.addColorStop(0.0, '#38bdf8');
    this.skyGrad.addColorStop(0.5, '#7dd3fc');
    this.skyGrad.addColorStop(0.85, '#bae6fd');
    this.skyGrad.addColorStop(1.0, '#e0f2fe');

    // 2. Earth Bedding Gradient
    this.earthGrad = this.ctx.createLinearGradient(0, groundY + 14, 0, V_HEIGHT);
    this.earthGrad.addColorStop(0.0, '#eab308');
    this.earthGrad.addColorStop(0.3, '#d97706');
    this.earthGrad.addColorStop(1.0, '#b45309');

    // 3. Grass Gradient
    this.grassGrad = this.ctx.createLinearGradient(0, groundY, 0, groundY + 14);
    this.grassGrad.addColorStop(0.0, '#a3e635');
    this.grassGrad.addColorStop(0.5, '#65a30d');
    this.grassGrad.addColorStop(1.0, '#3f6212');
  }

  bindInputs() {
    if (this.isInputBound) return;
    this.isInputBound = true;

    // Keyboard support: Space, ArrowUp, W
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        audioManager.unlockAudio();

        if (state.currentState === STATES.START) {
          this.startGame();
        } else if (state.currentState === STATES.PLAYING) {
          this.flapPlayer();
        } else if (state.currentState === STATES.GAMEOVER && ui.isGameOverActive()) {
          this.startGame();
        }
      }
    });

    // Pointer support (Touch, Mouse click)
    if (this.container) {
      this.container.addEventListener('pointerdown', (e) => {
        audioManager.unlockAudio();

        const target = e.target;
        const isInteractiveTarget = target instanceof Element && (
          target.closest('#sound-toggle') ||
          target.closest('#btn-retry') ||
          target.closest('#btn-play')
        );

        // Exclude specific UI buttons so their dedicated listeners fire
        if (isInteractiveTarget) {
          return;
        }

        // When on Start screen or Game Over modal, clicking outside buttons must NOT start/restart the game
        if (state.currentState === STATES.START || state.currentState === STATES.GAMEOVER) {
          return;
        }

        // During active flight, tapping anywhere on the game container flaps the bird
        if (state.currentState === STATES.PLAYING) {
          e.preventDefault();
          this.flapPlayer();
        }
      });
    }
  }

  startGame() {
    if (state.currentState === STATES.PLAYING) return;
    audioManager.unlockAudio();
    audioManager.stopAll();
    state.reset();
    player.reset();
    obstacleManager.reset();
    this.particles = [];

    state.currentState = STATES.PLAYING;
    ui.hideStartScreen();
    ui.hideGameOver();
    ui.updateScore(0);

    this.flapPlayer();
  }

  flapPlayer() {
    if (state.currentState !== STATES.PLAYING) return;
    player.flap();
    audioManager.playJump();

    // Spawn subtle propulsion air puffs (capped to prevent excess memory allocation)
    for (let i = 0; i < 3; i++) {
      if (this.particles.length > 30) {
        this.particles.shift();
      }
      this.particles.push({
        x: player.x + 10 + Math.random() * 18,
        y: player.y + player.h - 4,
        vx: -1.2 - Math.random() * 1.5,
        vy: 0.6 + Math.random() * 1.5,
        size: 3 + Math.random() * 3,
        color: ['#ffffff', '#e0f2fe', '#bae6fd'][Math.floor(Math.random() * 3)],
        alpha: 0.85,
        decay: 0.045
      });
    }
  }

  handleScore() {
    state.score++;
    ui.updateScore(state.score);
    audioManager.playScore();
  }

  triggerGameOver() {
    if (state.currentState === STATES.GAMEOVER) return;

    state.currentState = STATES.GAMEOVER;
    state.screenShake = 14;
    audioManager.playHit();

    // Impact burst particles
    for (let i = 0; i < 20; i++) {
      if (this.particles.length > 35) {
        this.particles.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4.8;
      this.particles.push({
        x: player.x + player.w / 2,
        y: player.y + player.h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 5,
        color: ['#ef4444', '#f59e0b', '#facc15', '#ffffff'][Math.floor(Math.random() * 4)],
        alpha: 1,
        decay: 0.032
      });
    }

    const isNewRecord = state.saveHighScore(state.score);

    setTimeout(() => {
      if (state.currentState === STATES.GAMEOVER) {
        ui.showGameOver(state.score, isNewRecord);
        audioManager.playGameOver();
      }
    }, 350);
  }

  handleResize() {
    if (!this.canvas || !this.container) return;

    // Cache container dimensions to completely eliminate getBoundingClientRect reflows inside render loop
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.containerWidth = rect.width || this.container.clientWidth || V_WIDTH;
    this.containerHeight = rect.height || this.container.clientHeight || V_HEIGHT;

    this.canvas.width = this.containerWidth * dpr;
    this.canvas.height = this.containerHeight * dpr;

    this.scale = Math.min(this.containerWidth / V_WIDTH, this.containerHeight / V_HEIGHT);
    this.initCachedGradients();
  }

  update(delta) {
    if (state.screenShake > 0) {
      state.screenShake *= 0.88;
      if (state.screenShake < 0.2) state.screenShake = 0;
    }

    // Cloud drift across sunny sky
    this.clouds.forEach(c => {
      c.x -= c.speed;
      if (c.x < -120) c.x = V_WIDTH + 80;
    });

    // Ground scroll
    if (state.currentState !== STATES.GAMEOVER) {
      this.groundOffset = (this.groundOffset + PHYSICS.PIPE_SPEED) % 24;
    }

    // Particle lifecycle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Active gameplay updates
    if (state.currentState === STATES.PLAYING) {
      const hitFloor = player.update(delta);
      if (hitFloor) {
        this.triggerGameOver();
        return;
      }

      obstacleManager.update(
        player,
        () => this.handleScore(),
        () => this.triggerGameOver()
      );
    } else if (state.currentState === STATES.GAMEOVER) {
      player.updateGameOverFall();
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this.containerWidth || (this.canvas.width / dpr);
    const height = this.containerHeight || (this.canvas.height / dpr);

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // Screen shake
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * state.screenShake;
      const shakeY = (Math.random() - 0.5) * state.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }

    // Virtual resolution mapping
    const scaleX = width / V_WIDTH;
    const scaleY = height / V_HEIGHT;
    this.ctx.scale(scaleX, scaleY);

    const groundY = V_HEIGHT - GROUND_HEIGHT;

    // 1. Colourful Bright Blue Sky Gradient (cached)
    if (!this.skyGrad) this.initCachedGradients();
    this.ctx.fillStyle = this.skyGrad;
    this.ctx.fillRect(0, 0, V_WIDTH, groundY);

    // 2. City Skyline Layer (pre-rendered offscreen)
    this.renderSkyline(this.ctx, groundY);

    // 3. Clouds
    this.renderClouds(this.ctx);

    // 4. Bushes Layer along horizon
    this.renderBushes(this.ctx, groundY);

    // 5. Moving Green Pipes
    obstacleManager.draw(this.ctx);

    // 6. Air particles (batched)
    if (this.particles.length > 0) {
      this.particles.forEach(p => {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
    }

    // 7. Grassy Ground Platform
    this.renderGround(this.ctx, groundY);

    // 8. Flying Sanjay Bird Character & Poop Animation
    if (state.currentState !== STATES.START) {
      player.draw(this.ctx);
    }

    this.ctx.restore();
  }

  renderSkyline(ctx) {
    if (this.skylineCanvas) {
      ctx.drawImage(this.skylineCanvas, 0, 0);
    }
  }

  renderClouds(ctx) {
    ctx.save();
    this.clouds.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);

      // Fluffy cartoon cumulus cloud (clean geometry without expensive shadowBlur Gaussian filters)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.arc(16, -6, 22, 0, Math.PI * 2);
      ctx.arc(38, -4, 18, 0, Math.PI * 2);
      ctx.arc(52, 2, 14, 0, Math.PI * 2);
      ctx.arc(26, 8, 20, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      // Soft underside shading
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(26, 10, 32, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
    ctx.restore();
  }

  renderBushes(ctx, groundY) {
    ctx.save();
    const bushHeight = 18;
    const startY = groundY - bushHeight;

    // Foliage back wave
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= V_WIDTH + 30; x += 30) {
      ctx.quadraticCurveTo(x + 15, startY - 8, x + 30, groundY);
    }
    ctx.lineTo(V_WIDTH, groundY);
    ctx.closePath();
    ctx.fill();

    // Foliage front highlight wave
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = -15; x <= V_WIDTH + 30; x += 30) {
      ctx.quadraticCurveTo(x + 15, startY - 4, x + 30, groundY);
    }
    ctx.lineTo(V_WIDTH, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderGround(ctx, groundY) {
    ctx.save();

    // A. Warm Earth Bedding with Pattern (cached gradient)
    ctx.fillStyle = this.earthGrad;
    ctx.fillRect(0, groundY + 14, V_WIDTH, GROUND_HEIGHT - 14);

    // Warm honeycomb / brick texture scrolling with groundOffset (single batched path)
    ctx.fillStyle = 'rgba(180, 83, 9, 0.35)';
    const tileW = 20;
    const tileH = 10;
    ctx.beginPath();
    for (let y = groundY + 16; y < V_HEIGHT; y += tileH) {
      const rowOffset = ((y - groundY) % (tileH * 2) === 0) ? 0 : tileW / 2;
      for (let x = -this.groundOffset - tileW + rowOffset; x < V_WIDTH + tileW; x += tileW) {
        if (ctx.roundRect) {
          ctx.roundRect(x + 1, y + 1, tileW - 2, tileH - 2, 2);
        } else {
          ctx.rect(x + 1, y + 1, tileW - 2, tileH - 2);
        }
      }
    }
    ctx.fill();

    // B. Lush Green Scalloped Grass Layer (cached gradient)
    ctx.fillStyle = this.grassGrad;
    ctx.fillRect(0, groundY, V_WIDTH, 12);

    // Scalloped green teeth border (single batched path)
    ctx.fillStyle = '#65a30d';
    const scallopW = 16;
    ctx.beginPath();
    for (let x = -this.groundOffset; x < V_WIDTH + scallopW; x += scallopW) {
      ctx.arc(x + scallopW / 2, groundY + 12, scallopW / 2, 0, Math.PI);
    }
    ctx.fill();

    // Top trim highlight
    ctx.strokeStyle = '#bef264';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(V_WIDTH, groundY);
    ctx.stroke();

    ctx.restore();
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    if (!this.lastTime) {
      this.lastTime = timestamp;
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    const elapsed = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Discard large frame time jumps (e.g. tab switch or system pauses)
    if (elapsed > 0.1) {
      this.accumulator = 0;
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    // Limit accumulator to at most 2 steps (0.034s) to eliminate stutter and prevent speed bursts
    const FIXED_STEP = 1 / 60;
    this.accumulator = Math.min((this.accumulator || 0) + elapsed, 0.034);

    while (this.accumulator >= FIXED_STEP) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }

    this.render();

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }
}

export const game = new GameEngine();
