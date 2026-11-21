// Mothlight: the numbers that tune the whole game. One place, so a play-test can
// retune a feel without hunting through the world, the guards or the renderer.
export const TILE = 40;
export const COLS = 26;
export const ROWS = 16;
export const FIELD_WIDTH = COLS * TILE;
export const FIELD_HEIGHT = ROWS * TILE;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 155,
  sneakSpeed: 88,
  // A running moth is loud: guards hear it this far away.
  noiseRadius: 105,
  noiseEvery: 0.34,
  // How far a pebble can be thrown with the mouse.
  throwRange: 280,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  investigateSpeed: 95,
  chaseSpeed: 118,
  // Vision cone: how far a guard sees and how wide the cone opens.
  viewRange: 195,
  viewHalfAngle: 0.56,
  // A guard that gets this close to a moth in a bush spots it anyway.
  bushSpotRange: 72,
  catchRange: 27,
  // How fast suspicion grows when the moth is seen, at point blank and at full range.
  detectNear: 1.25,
  detectFar: 0.5,
  detectDrain: 0.55,
  // Multipliers on the detection rate.
  detectSneak: 0.55,
  detectRunning: 1.25,
  detectLit: 1.35,
  detectDark: 0.7,
  // Suspicion pauses a patrol and turns the guard to look; full suspicion chases.
  suspiciousAt: 0.35,
  // Seconds a chasing guard keeps hunting after losing sight.
  loseSightAfter: 3.0,
  searchTime: 2.6,
  // How long a guard waits at each patrol waypoint, looking around.
  pauseAtWaypoint: 1.4,
};

export const LEVEL = {
  lives: 3,
  pebbles: 3,
  shardScore: 100,
  fireflyScore: 50,
  ghostBonus: 150,
  // Seconds of level time that still earn a full time bonus.
  timeBonusAt: 75,
};

export const SHOT = { width: 1280, height: 800 };
export const BEST_KEY = 'mothlight-best';

// Colours, kept in one place so the night palette stays consistent.
export const COLORS = {
  floorA: '#26344f',
  floorB: '#222f47',
  floorEdge: '#2e3d5c',
  wall: '#0a0f1c',
  wallTop: '#31435f',
  crate: '#6b4a2b',
  crateDark: '#4c3018',
  pillar: '#3a4a63',
  bush: '#1e4d2e',
  bushDark: '#143722',
  lampGlow: '#ffd98a',
  cone: 'rgba(255, 196, 92, 0.34)',
  coneEdge: 'rgba(255, 214, 130, 0.55)',
  exitOpen: '#58e39a',
  exitLocked: '#e35d5d',
  player: '#f5e9c8',
  playerWing: '#c9a86a',
  guard: '#2c3a55',
  guardTrim: '#ffb347',
  shard: '#bfe9ff',
  firefly: '#ffe27a',
  darkness: 'rgba(4, 7, 16, 0.45)',
};
