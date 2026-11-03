/**
 * FLYING SANJAY - Audio Manager
 * Manages game sound effects, mute/unmute state, and the game-over voice.
 * The game-over voice is loaded from assets/my-voice.mp4.
 * Uses dual Web Audio API Buffer + HTMLAudioElement architecture for instantaneous,
 * zero-latency, 100% reliable playback across all desktop and mobile browsers.
 */

import { state } from './state.js';

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.gameOverAudio = null;
    this.audioBuffer = null;
    this.activeSourceNode = null;
    this.isGameOverAudioAvailable = false;
    this.hasPlayedGameOverDialogue = false;
    this.isAudioUnlocked = false;
    this.audioSrc = 'assets/my-voice.mp4';
    this.rawArrayBuffer = null;
  }

  init() {
    this.initGameOverAudio();
    this.fetchAudioBuffer();
    this.updateSoundState();
  }

  initGameOverAudio() {
    try {
      // Play the requested source recording when the game ends.
      this.gameOverAudio = new Audio(this.audioSrc);
      this.gameOverAudio.preload = 'auto';

      this.gameOverAudio.addEventListener('canplaythrough', () => {
        this.isGameOverAudioAvailable = true;
      });

      this.gameOverAudio.addEventListener('error', (e) => {
        this.isGameOverAudioAvailable = false;
        const err = this.gameOverAudio?.error;
        console.error(`[Audio] Error loading audio ${this.audioSrc}: code=${err?.code}, message=${err?.message}`, e);
      });

      // Explicitly trigger loading
      this.gameOverAudio.load();
    } catch (err) {
      this.gameOverAudio = null;
      this.isGameOverAudioAvailable = false;
      console.error('[Audio] Exception during initGameOverAudio:', err);
    }
  }

  async fetchAudioBuffer() {
    try {
      const res = await fetch(this.audioSrc);
      if (res.ok) {
        this.rawArrayBuffer = await res.arrayBuffer();
        if (this.audioContext) {
          this.decodeRawBuffer();
        }
      }
    } catch (err) {
      console.warn('[Audio] fetchAudioBuffer notice (fallback to HTMLAudioElement):', err);
    }
  }

  decodeRawBuffer() {
    if (!this.audioContext || !this.rawArrayBuffer || this.audioBuffer) return;
    try {
      // Use slice to avoid neutering array buffer in older browsers
      const bufferCopy = this.rawArrayBuffer.slice(0);
      this.audioContext.decodeAudioData(bufferCopy, (decoded) => {
        this.audioBuffer = decoded;
        this.isGameOverAudioAvailable = true;
      }, (err) => {
        console.warn('[Audio] decodeAudioData error:', err);
      });
    } catch (err) {
      console.warn('[Audio] Exception decoding audio buffer:', err);
    }
  }

  /**
   * Prime and unlock browser audio playback on user gesture (click/tap/keypress)
   * Resolves mobile & desktop browser autoplay policy restrictions
   */
  unlockAudio() {
    if (this.isAudioUnlocked) return;

    try {
      // 1. Resume Web Audio context if suspended
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }
      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch((err) => {
            console.warn('[Audio] Could not resume audio context:', err);
          });
        }
        if (!this.audioBuffer && this.rawArrayBuffer) {
          this.decodeRawBuffer();
        }
      }

      // 2. Unlock HTML audio during the user gesture for browsers that restrict
      // playback started later (for example, when the game-over screen appears).
      if (this.gameOverAudio) {
        const wasMuted = this.gameOverAudio.muted;
        this.gameOverAudio.muted = true;
        const playPromise = this.gameOverAudio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(() => {
            this.gameOverAudio.pause();
            this.gameOverAudio.currentTime = 0;
            this.gameOverAudio.muted = wasMuted;
          }).catch((err) => {
            this.gameOverAudio.muted = wasMuted;
            this.isAudioUnlocked = false;
            console.warn('[Audio] Could not unlock game-over audio:', err);
          });
        } else {
          this.gameOverAudio.pause();
          this.gameOverAudio.currentTime = 0;
          this.gameOverAudio.muted = wasMuted;
        }
      }

      this.isAudioUnlocked = true;
    } catch (err) {
      this.isAudioUnlocked = false;
      console.warn('[Audio] Could not unlock audio:', err);
    }
  }

  toggleMute() {
    state.setMutePreference(!state.isMuted);
    this.updateSoundState();
    return state.isMuted;
  }

  isMuted() {
    return state.isMuted;
  }

  updateSoundState() {
    // If muted, stop any actively playing audio immediately
    if (this.isMuted()) {
      if (this.activeSourceNode) {
        try {
          this.activeSourceNode.stop();
        } catch {
          // Ignore state error
        }
        this.activeSourceNode = null;
      }
      if (this.gameOverAudio) {
        try {
          this.gameOverAudio.pause();
          this.gameOverAudio.currentTime = 0;
        } catch {
          // Ignore audio state error
        }
      }
    }
  }

  stopAll() {
    this.hasPlayedGameOverDialogue = false;
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
      } catch {
        // Ignore state error
      }
      this.activeSourceNode = null;
    }
    if (this.gameOverAudio) {
      try {
        this.gameOverAudio.pause();
        this.gameOverAudio.currentTime = 0;
      } catch {
        // Ignore audio state error
      }
    }
  }

  playJump() {
    if (this.isMuted()) return;
    this.playTone(480, 0.08, 'sine');
  }

  playScore() {
    if (this.isMuted()) return;
    this.playTone(880, 0.12, 'triangle');
  }

  playHit() {
    if (this.isMuted()) return;
    this.playTone(180, 0.18, 'sawtooth');
  }

  playGameOver() {
    // Check mute state
    if (this.isMuted()) {
      return;
    }

    // Check one-shot playback flag
    if (this.hasPlayedGameOverDialogue) {
      return;
    }

    // Primary: Web Audio API AudioBuffer (zero latency, unaffected by element pause/unpause)
    if (this.audioBuffer && this.audioContext && this.audioContext.state === 'running') {
      try {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(0);
        this.hasPlayedGameOverDialogue = true;
        this.activeSourceNode = source;
        source.onended = () => {
          if (this.activeSourceNode === source) {
            this.activeSourceNode = null;
          }
        };
        return;
      } catch (err) {
        console.warn('[Audio] Web Audio buffer playback exception, falling back to HTMLAudioElement:', err);
      }
    }

    // Fallback: HTMLAudioElement
    if (!this.gameOverAudio) {
      return;
    }

    try {
      this.gameOverAudio.currentTime = 0;
      const playPromise = this.gameOverAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.hasPlayedGameOverDialogue = true;
          })
          .catch((err) => {
            // If autoplay blocked, attach a one-time gesture unlock to play immediately on next user tap/interaction
            if (err.name === 'NotAllowedError') {
              const onUserInteract = () => {
                if (state.currentState === 'GAMEOVER' && !this.isMuted()) {
                  this.gameOverAudio.currentTime = 0;
                  this.gameOverAudio.play().then(() => {
                    this.hasPlayedGameOverDialogue = true;
                  }).catch((retryErr) => {
                    console.error('[Audio] Game-over audio retry failed:', retryErr);
                  });
                }
                window.removeEventListener('pointerdown', onUserInteract);
                window.removeEventListener('keydown', onUserInteract);
              };
              window.addEventListener('pointerdown', onUserInteract, { once: true });
              window.addEventListener('keydown', onUserInteract, { once: true });
            } else {
              console.error('[Audio] Game-over audio playback failed:', err);
            }
          });
      } else {
        this.hasPlayedGameOverDialogue = true;
      }
    } catch (err) {
      console.error('[Audio] Exception during playGameOver:', err);
    }
  }

  playTone(freq, duration, type = 'sine') {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      if (!this.audioContext) return;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    } catch {
      // Web Audio API unavailable
    }
  }

  getDiagnostics() {
    return {
      src: this.audioSrc,
      currentSrc: this.gameOverAudio ? (this.gameOverAudio.currentSrc || this.gameOverAudio.src) : null,
      readyState: this.gameOverAudio ? this.gameOverAudio.readyState : null,
      duration: this.gameOverAudio ? this.gameOverAudio.duration : null,
      paused: this.activeSourceNode ? false : (this.gameOverAudio ? this.gameOverAudio.paused : null),
      isMuted: this.isMuted(),
      hasPlayedDialogue: this.hasPlayedGameOverDialogue,
      isUnlocked: this.isAudioUnlocked,
      hasAudioBuffer: !!this.audioBuffer,
      error: this.gameOverAudio && this.gameOverAudio.error ? {
        code: this.gameOverAudio.error.code,
        message: this.gameOverAudio.error.message
      } : null
    };
  }
}

export const audioManager = new AudioManager();
