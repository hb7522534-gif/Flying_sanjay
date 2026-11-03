/**
 * FLYING SANJAY - Constants & Configuration
 * Virtual canvas dimensions, game states, and physics presets.
 */

export const V_WIDTH = 400;
export const V_HEIGHT = 700;
export const GROUND_HEIGHT = 60;

export const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};

export const PHYSICS = {
  GRAVITY: 0.26,
  JUMP_FORCE: -5.8,
  MAX_FALL_SPEED: 5.2,
  PIPE_SPEED: 2.0,
  PIPE_GAP: 215,
  PIPE_WIDTH: 64,
  PIPE_INTERVAL: 145,
  INITIAL_SPAWN_TIMER: 35,
  PLAYER_W: 56,
  PLAYER_H: 60,
  PLAYER_INIT_X: 85,
  HIT_MARGIN_X: 10,
  HIT_MARGIN_Y: 10
};

export const STORAGE_KEYS = {
  HIGH_SCORE: 'flying_sanjay_best_score',
  SOUND_MUTED: 'flying_sanjay_sound_muted'
};
