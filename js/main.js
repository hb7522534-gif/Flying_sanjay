/**
 * FLYING SANJAY - Main Entry Point
 * Initializes game engine upon DOM readiness with immediate readyState fallback.
 */

import { game } from './game.js?v=2.1';

function startApp() {
  try {
    game.init();
    console.log('Flying Sanjay initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Flying Sanjay:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
