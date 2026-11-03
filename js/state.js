/**
 * FLYING SANJAY - State Management
 * Holds runtime variables, scoring, and preferences.
 */

import { STATES, STORAGE_KEYS } from './constants.js';

class GameState {
  constructor() {
    this.currentState = STATES.START;
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.isMuted = this.loadMutePreference();
    this.screenShake = 0;
  }

  loadHighScore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  saveHighScore(score) {
    if (score > this.highScore) {
      this.highScore = score;
      try {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(score));
      } catch {
        // Storage unavailable or disabled
      }
      return true;
    }
    return false;
  }

  loadMutePreference() {
    try {
      return localStorage.getItem(STORAGE_KEYS.SOUND_MUTED) === 'true';
    } catch {
      return false;
    }
  }

  setMutePreference(muted) {
    this.isMuted = muted;
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_MUTED, String(muted));
    } catch {
      // Storage unavailable or disabled
    }
  }

  reset() {
    this.score = 0;
    this.screenShake = 0;
  }
}

export const state = new GameState();
