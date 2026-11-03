/**
 * FLYING SANJAY - Obstacles Manager
 * Generates moving obstacles with pass-through gaps, handles scoring and collisions.
 * Rendered with classic vibrant arcade green pipes with high-performance gradient caching.
 */

import { V_WIDTH, V_HEIGHT, GROUND_HEIGHT, PHYSICS } from './constants.js';

export class ObstacleManager {
  constructor() {
    this.pipes = [];
    this.spawnTimer = PHYSICS.INITIAL_SPAWN_TIMER;
    this.shaftGrad = null;
    this.capGrad = null;
  }

  reset() {
    this.pipes = [];
    this.spawnTimer = PHYSICS.INITIAL_SPAWN_TIMER;
  }

  initGradients(ctx) {
    if (this.shaftGrad && this.capGrad) return;
    const pw = PHYSICS.PIPE_WIDTH;
    const capOverhang = 4;
    const capW = pw + capOverhang * 2;

    this.shaftGrad = ctx.createLinearGradient(0, 0, pw, 0);
    this.shaftGrad.addColorStop(0.0, '#2c5a0f');
    this.shaftGrad.addColorStop(0.12, '#55a021');
    this.shaftGrad.addColorStop(0.28, '#a3e635');
    this.shaftGrad.addColorStop(0.48, '#65a30d');
    this.shaftGrad.addColorStop(0.85, '#4d7c0f');
    this.shaftGrad.addColorStop(1.0, '#1a3a0a');

    this.capGrad = ctx.createLinearGradient(-capOverhang, 0, capW - capOverhang, 0);
    this.capGrad.addColorStop(0.0, '#2c5a0f');
    this.capGrad.addColorStop(0.12, '#55a021');
    this.capGrad.addColorStop(0.28, '#bef264');
    this.capGrad.addColorStop(0.48, '#65a30d');
    this.capGrad.addColorStop(0.85, '#4d7c0f');
    this.capGrad.addColorStop(1.0, '#1a3a0a');
  }

  spawnPipe() {
    const minTop = 60;
    const maxTop = V_HEIGHT - PHYSICS.PIPE_GAP - 120;
    const topHeight = minTop + Math.random() * (maxTop - minTop);
    const bottomY = topHeight + PHYSICS.PIPE_GAP;
    const bottomHeight = V_HEIGHT - GROUND_HEIGHT - bottomY;

    this.pipes.push({
      x: V_WIDTH + 10,
      topHeight: topHeight,
      bottomY: bottomY,
      bottomHeight: bottomHeight,
      width: PHYSICS.PIPE_WIDTH,
      passed: false
    });
  }

  update(player, onScore, onCollision) {
    this.spawnTimer++;
    if (this.spawnTimer >= PHYSICS.PIPE_INTERVAL) {
      this.spawnTimer = 0;
      this.spawnPipe();
    }

    const hb = player.getHitbox();
    const hitMarginX = PHYSICS.HIT_MARGIN_X;
    const hitMarginY = PHYSICS.HIT_MARGIN_Y;

    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= PHYSICS.PIPE_SPEED;

      // 1. Scoring check - strictly once per pipe
      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        if (typeof onScore === 'function') {
          onScore();
        }
      }

      // 2. Collision checks
      const withinPipeX =
        hb.x + hb.w > pipe.x + hitMarginX &&
        hb.x < pipe.x + pipe.width - hitMarginX;

      if (withinPipeX) {
        // Top pipe collision
        if (hb.y < pipe.topHeight - hitMarginY) {
          if (typeof onCollision === 'function') {
            onCollision();
          }
          return;
        }

        // Bottom pipe collision
        if (hb.y + hb.h > pipe.bottomY + hitMarginY) {
          if (typeof onCollision === 'function') {
            onCollision();
          }
          return;
        }
      }

      // Cleanup offscreen pipe
      if (pipe.x + pipe.width < -60) {
        this.pipes.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    this.initGradients(ctx);

    const capHeight = 24;
    const capOverhang = 4;
    const pw = PHYSICS.PIPE_WIDTH;
    const capW = pw + capOverhang * 2;

    this.pipes.forEach(pipe => {
      ctx.save();
      ctx.translate(pipe.x, 0);

      // --- TOP PIPE (hanging downward) ---
      if (pipe.topHeight > 0) {
        const bodyH = Math.max(0, pipe.topHeight - capHeight);

        // Pipe shaft
        ctx.fillStyle = this.shaftGrad;
        ctx.fillRect(0, 0, pw, bodyH);

        ctx.strokeStyle = '#143008';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(0, 0, pw, bodyH);

        // Pipe collar cap at bottom edge
        const capY = pipe.topHeight - capHeight;
        ctx.fillStyle = this.capGrad;
        ctx.fillRect(-capOverhang, capY, capW, capHeight);
        ctx.strokeRect(-capOverhang, capY, capW, capHeight);
      }

      // --- BOTTOM PIPE (rising upward) ---
      if (pipe.bottomHeight > 0) {
        const capY = pipe.bottomY;

        // Pipe collar cap at opening
        ctx.fillStyle = this.capGrad;
        ctx.fillRect(-capOverhang, capY, capW, capHeight);

        ctx.strokeStyle = '#143008';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(-capOverhang, capY, capW, capHeight);

        // Main pipe shaft below cap
        const colY = pipe.bottomY + capHeight;
        const colH = pipe.bottomHeight - capHeight;

        if (colH > 0) {
          ctx.fillStyle = this.shaftGrad;
          ctx.fillRect(0, colY, pw, colH);
          ctx.strokeRect(0, colY, pw, colH);
        }
      }

      ctx.restore();
    });
  }
}

export const obstacleManager = new ObstacleManager();
