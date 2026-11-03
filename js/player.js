/**
 * FLYING SANJAY - Player Entity & Sanjay Real Face Integration
 * Mounts Sanjay's authentic cropped face naturally as the bird's head onto
 * a cartoon flying bird body with flapping wings, tail feathers, and poop animation.
 * Optimized for 60fps rendering without composite pipeline stalls.
 */

import { V_WIDTH, V_HEIGHT, GROUND_HEIGHT, PHYSICS } from './constants.js';

export class Player {
  constructor() {
    this.w = PHYSICS.PLAYER_W;
    this.h = PHYSICS.PLAYER_H;
    this.x = PHYSICS.PLAYER_INIT_X;
    this.y = V_HEIGHT * 0.42;
    this.vy = 0;
    this.rotation = 0;
    this.trail = [];

    // Sanjay Face Asset
    this.faceImage = null;
    this.isFaceLoaded = false;
    this.loadFaceImage();

    // Small cartoon poop particles
    this.poopEffects = [];

    // Wing flapping animation
    this.wingPhase = 0;

    // Cached gradient
    this.auraGrad = null;
  }

  loadFaceImage() {
    const img = new Image();
    img.onload = () => {
      this.faceImage = img;
      this.isFaceLoaded = true;
    };
    img.onerror = () => {
      this.isFaceLoaded = false;
    };
    img.src = 'assets/sanjay-face.png';
    if (img.complete && img.naturalWidth > 0) {
      this.faceImage = img;
      this.isFaceLoaded = true;
    }
  }

  reset() {
    this.w = PHYSICS.PLAYER_W;
    this.h = PHYSICS.PLAYER_H;
    this.x = PHYSICS.PLAYER_INIT_X;
    this.y = V_HEIGHT * 0.42;
    this.vy = 0;
    this.rotation = 0;
    this.trail = [];
    this.poopEffects = [];
    this.wingPhase = 0;
  }

  flap() {
    this.vy = PHYSICS.JUMP_FORCE;
    this.spawnPoop();
  }

  spawnPoop() {
    // Keep poop particle pool capped to prevent GC pressure
    if (this.poopEffects.length > 10) {
      this.poopEffects.shift();
    }

    // Emits one small cartoon poop particle from behind the bird's tail
    this.poopEffects.push({
      x: this.x - 6,
      y: this.y + this.h * 0.52,
      vx: -2.6 - Math.random() * 0.5,
      vy: 0.5 + Math.random() * 0.7,
      rotation: Math.random() * 0.4 - 0.2,
      scale: 1,
      alpha: 1,
      decay: 0.024
    });
  }

  update() {
    // Gravity and terminal velocity
    this.vy = Math.min(this.vy + PHYSICS.GRAVITY, PHYSICS.MAX_FALL_SPEED);
    this.y += this.vy;

    // Smooth rotational response to velocity
    const targetRotation = Math.min(Math.PI / 2.2, Math.max(-0.45, this.vy * 0.09));
    this.rotation += (targetRotation - this.rotation) * 0.18;

    // Wing flap oscillation
    if (this.vy < 0) {
      this.wingPhase += 0.38;
    } else {
      this.wingPhase += 0.14;
    }

    // Motion trail history (bounded strictly to 4 items)
    this.trail.unshift({
      x: this.x,
      y: this.y,
      rotation: this.rotation
    });
    if (this.trail.length > 4) {
      this.trail.pop();
    }

    // Ceiling clamp
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }

    // Update active poop particles
    for (let i = this.poopEffects.length - 1; i >= 0; i--) {
      const p = this.poopEffects[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.alpha -= p.decay;
      p.scale = Math.max(0.4, p.scale - 0.006);

      if (p.alpha <= 0 || p.x < -40 || p.y > V_HEIGHT) {
        this.poopEffects.splice(i, 1);
      }
    }

    // Floor collision check
    const floorY = V_HEIGHT - GROUND_HEIGHT;
    if (this.y + this.h >= floorY) {
      this.y = floorY - this.h;
      return true;
    }

    return false;
  }

  updateGameOverFall() {
    const floorY = V_HEIGHT - GROUND_HEIGHT;
    if (this.y + this.h < floorY) {
      this.vy += PHYSICS.GRAVITY * 1.2;
      this.y += this.vy;
      this.rotation = Math.min(Math.PI / 1.8, this.rotation + 0.1);
    } else {
      this.y = floorY - this.h;
    }

    for (let i = this.poopEffects.length - 1; i >= 0; i--) {
      const p = this.poopEffects[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) this.poopEffects.splice(i, 1);
    }
  }

  getHitbox() {
    return {
      x: this.x + 8,
      y: this.y + 6,
      w: this.w - 16,
      h: this.h - 12
    };
  }

  initAura(ctx) {
    if (this.auraGrad) return;
    this.auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, this.w * 0.7);
    this.auraGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
    this.auraGrad.addColorStop(0.7, 'rgba(250, 204, 21, 0.1)');
    this.auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }

  draw(ctx) {
    // 1. Draw poop particles (behind the bird)
    this.drawPoopEffects(ctx);

    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    // 2. Motion trail (rendered as lightweight ghost silhouette for optimal 60fps pacing)
    if (this.trail.length > 0) {
      for (let idx = 0; idx < this.trail.length; idx++) {
        const t = this.trail[idx];
        ctx.save();
        ctx.translate(t.x + this.w / 2, t.y + this.h / 2);
        ctx.rotate(t.rotation);
        ctx.globalAlpha = Math.max(0, 0.20 - idx * 0.05);
        this.renderTrailGhost(ctx);
        ctx.restore();
      }
    }

    // 3. Active flying character
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    // Subtle soft glow with cached gradient
    this.initAura(ctx);
    ctx.fillStyle = this.auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.w * 0.7, 0, Math.PI * 2);
    ctx.fill();

    this.renderCharacter(ctx);

    ctx.restore();
  }

  renderTrailGhost(ctx) {
    const bw = this.w;
    const bh = this.h;

    // Body ghost shape
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(-bw * 0.06, bh * 0.10, bw * 0.34, bh * 0.30, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Tail ghost shape
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-bw * 0.28, bh * 0.04);
    ctx.lineTo(-bw * 0.50, 0);
    ctx.lineTo(-bw * 0.25, bh * 0.20);
    ctx.closePath();
    ctx.fill();
  }

  renderCharacter(ctx) {
    const bw = this.w; // 56
    const bh = this.h; // 60

    // --- A. Red / Orange Tail Feathers (rear-left) ---
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    ctx.moveTo(-bw * 0.28, bh * 0.04);
    ctx.lineTo(-bw * 0.52, -bh * 0.04);
    ctx.lineTo(-bw * 0.44, bh * 0.14);
    ctx.lineTo(-bw * 0.54, bh * 0.22);
    ctx.lineTo(-bw * 0.25, bh * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner orange feather highlight
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-bw * 0.26, bh * 0.06);
    ctx.lineTo(-bw * 0.42, bh * 0.02);
    ctx.lineTo(-bw * 0.36, bh * 0.14);
    ctx.lineTo(-bw * 0.44, bh * 0.18);
    ctx.lineTo(-bw * 0.24, bh * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- B. Golden Yellow Cartoon Bird Body ---
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;

    ctx.beginPath();
    // Rounded plump body shape matching reference
    ctx.ellipse(-bw * 0.06, bh * 0.10, bw * 0.34, bh * 0.30, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // --- C. Animated Cartoon Wing (Yellow with Red/Orange tip) ---
    ctx.save();
    const wingAngle = Math.sin(this.wingPhase) * 0.42;
    ctx.translate(-bw * 0.12, bh * 0.06);
    ctx.rotate(wingAngle);

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;

    // Wing base
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.26, bh * 0.16, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wing feather tip layers (red and orange)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(-bw * 0.08, -bh * 0.02, bw * 0.12, bh * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(-bw * 0.02, bh * 0.02, bw * 0.10, bh * 0.06, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // --- D. Sanjay's Real Face Attachment ---
    if (this.isFaceLoaded && this.faceImage) {
      ctx.save();
      // Mount Sanjay's face naturally on front-top of the bird body
      const faceW = bw * 0.78; // ~44px
      const faceH = (faceW * this.faceImage.height) / this.faceImage.width; // ~52px
      const faceX = bw * 0.04;
      const faceY = -bh * 0.44;

      ctx.translate(faceX + faceW / 2, faceY + faceH / 2);

      ctx.drawImage(
        this.faceImage,
        -faceW / 2,
        -faceH / 2,
        faceW,
        faceH
      );

      ctx.restore();
    } else {
      // Fallback cartoon head outline if image is still loading
      const headRadius = bw * 0.30;
      const headX = bw * 0.14;
      const headY = -bh * 0.16;

      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX + 4, headY - 3, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(headX + 6, headY - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPoopEffects(ctx) {
    this.poopEffects.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scale, p.scale);
      ctx.globalAlpha = Math.max(0, p.alpha);

      // Speed streak lines behind poop
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-6, -2);
      ctx.moveTo(-12, 3);
      ctx.lineTo(-4, 3);
      ctx.stroke();

      // Cartoon Poop Character Swirl (Brown with outline)
      ctx.fillStyle = '#8d5b28';
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1.8;

      // Base blob
      ctx.beginPath();
      ctx.ellipse(0, 4, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mid blob
      ctx.beginPath();
      ctx.ellipse(0, -1, 5.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Swirl crest
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.quadraticCurveTo(0, -10, 4, -7);
      ctx.quadraticCurveTo(1, -3, 1, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cute white cartoon eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-2, 2, 1.8, 0, Math.PI * 2);
      ctx.arc(2, 2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Tiny pupils
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-2, 2, 0.9, 0, Math.PI * 2);
      ctx.arc(2, 2, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Glossy shine highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(-2, -1, 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

export const player = new Player();
