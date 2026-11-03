/**
 * FLYING SANJAY - UI Controller
 * Manages HUD, overlays, score counters, responsive modals, and sound toggle.
 */

import { state } from './state.js';
import { audioManager } from './audio.js';

class UIController {
  constructor() {
    this.elements = {};
    this.scoreTimeout = null;
  }

  init(callbacks = {}) {
    this.callbacks = callbacks;
    this.elements = {
      gameContainer: document.getElementById('game-container'),
      startOverlay: document.getElementById('start-overlay'),
      failModal: document.getElementById('fail-modal'),
      scorePanel: document.querySelector('.score-panel'),
      scoreDisplay: document.getElementById('score-display'),
      soundToggle: document.getElementById('sound-toggle'),
      finalScore: document.getElementById('final-score'),
      highScore: document.getElementById('high-score'),
      newRecordBadge: document.getElementById('new-record-badge'),
      btnRetry: document.getElementById('btn-retry'),
      btnPlay: document.getElementById('btn-play'),
      startBestBadge: document.getElementById('start-best-badge'),
      startBestVal: document.getElementById('start-best-val')
    };

    this.bindEvents();
    this.updateSoundButton();
    this.updateScore(0);
    this.updateStartBestScore();
    if (this.elements.scorePanel) {
      this.elements.scorePanel.style.display = 'none';
      this.elements.scorePanel.classList.remove('visible');
    }
  }

  bindEvents() {
    if (this.elements.soundToggle) {
      this.elements.soundToggle.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        audioManager.toggleMute();
        this.updateSoundButton();
      });
    }

    const attachButtonHandler = (btn, action) => {
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        audioManager.unlockAudio();
        if (typeof action === 'function') {
          action();
        }
      });
    };

    attachButtonHandler(this.elements.btnPlay, () => {
      if (typeof this.callbacks.onStart === 'function') {
        this.callbacks.onStart();
      }
    });

    attachButtonHandler(this.elements.btnRetry, () => {
      if (typeof this.callbacks.onRestart === 'function') {
        this.callbacks.onRestart();
      }
    });
  }

  updateSoundButton() {
    if (this.elements.soundToggle) {
      this.elements.soundToggle.textContent = state.isMuted ? '🔇' : '🔊';
      this.elements.soundToggle.setAttribute(
        'title',
        state.isMuted ? 'Unmute Sound' : 'Mute Sound'
      );
    }
  }

  updateScore(score) {
    if (this.elements.scoreDisplay) {
      this.elements.scoreDisplay.textContent = score;

      if (score > 0) {
        if (this.scoreTimeout) clearTimeout(this.scoreTimeout);
        this.elements.scoreDisplay.style.transform = 'scale(1.22)';
        this.scoreTimeout = setTimeout(() => {
          if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.style.transform = 'scale(1)';
          }
        }, 140);
      }
    }
  }

  showStartScreen() {
    if (this.elements.startOverlay) {
      this.elements.startOverlay.classList.remove('hidden');
    }
    if (this.elements.failModal) {
      this.elements.failModal.classList.remove('active');
    }
    if (this.elements.scorePanel) {
      this.elements.scorePanel.style.display = 'none';
      this.elements.scorePanel.classList.remove('visible');
    }
    this.updateStartBestScore();
  }

  updateStartBestScore() {
    if (this.elements.startBestVal) {
      this.elements.startBestVal.textContent = state.highScore;
    }
    if (this.elements.startBestBadge) {
      if (state.highScore > 0) {
        this.elements.startBestBadge.style.display = 'inline-flex';
      } else {
        this.elements.startBestBadge.style.display = 'none';
      }
    }
  }

  hideStartScreen() {
    if (this.elements.startOverlay) {
      this.elements.startOverlay.classList.add('hidden');
    }
    if (this.elements.scorePanel) {
      this.elements.scorePanel.style.display = 'flex';
      this.elements.scorePanel.classList.add('visible');
    }
  }

  showGameOver(score, isNewRecord) {
    if (this.elements.scorePanel) {
      this.elements.scorePanel.style.display = 'none';
      this.elements.scorePanel.classList.remove('visible');
    }
    if (this.elements.failModal) {
      if (this.elements.finalScore) {
        this.elements.finalScore.textContent = score;
      }
      if (this.elements.highScore) {
        this.elements.highScore.textContent = state.highScore;
      }
      if (this.elements.newRecordBadge) {
        if (isNewRecord && score > 0) {
          this.elements.newRecordBadge.classList.add('visible');
        } else {
          this.elements.newRecordBadge.classList.remove('visible');
        }
      }
      this.elements.failModal.classList.add('active');
    }
  }

  hideGameOver() {
    if (this.elements.failModal) {
      this.elements.failModal.classList.remove('active');
    }
    if (this.elements.scorePanel) {
      this.elements.scorePanel.style.display = 'flex';
      this.elements.scorePanel.classList.add('visible');
    }
  }

  isGameOverActive() {
    return this.elements.failModal
      ? this.elements.failModal.classList.contains('active')
      : false;
  }
}

export const ui = new UIController();
