// The screenshot scenes behind ?shot=cover|play|alert|title. Each one plays the
// real rules forward from a fresh world — a stealth autopilot that pathfinds to
// the moonshard and then the exit, waiting in the dark when a cone covers the
// way — and freezes the frame at its most readable moment, so every screenshot
// is what a short game really looks like and the same seed always gives the
// same frame.
import { TILE, STEP, GUARD } from './config.js';
import { findTiles } from './levels.js';
import { canSeePlayer } from './vision.js';
import { findPath } from './pathfind.js';
import { loadLevel, stepWorld, EVENT_LEVEL_CLEAR } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const SAMPLE = 1 / 30;

/** Would any warden see a moth standing at this point right now? */
function pointWatched(world, x, y) {
  const fake = { x, y, inBush: false };
  for (const guard of world.state.guards) {
    if (canSeePlayer(world.level, guard, fake, GUARD).seen) return true;
  }
  return false;
}

function nearestGuardDist(world) {
  const p = world.state.player;
  return Math.min(...world.state.guards.map((g) => Math.hypot(g.x - p.x, g.y - p.y)));
}

/**
 * One autopilot decision: head for the target tile, wait when the next step is
 * watched, sneak when a warden is near. Returns {x, y, sneak} for stepWorld.
 */
function autopilot(world, targetTile) {
  const p = world.state.player;
  const fromCol = Math.floor(p.x / TILE);
  const fromRow = Math.floor(p.y / TILE);
  const path = findPath(world.level, fromCol, fromRow, targetTile[0], targetTile[1]);
  if (!path || path.length < 2) return { x: 0, y: 0, sneak: false };
  // Walk toward the second tile of the path (the first is the one we stand on),
  // but wait in the dark when the way ahead is watched.
  const next = path[1];
  const nx = next[0] * TILE + TILE / 2;
  const ny = next[1] * TILE + TILE / 2;
  if (pointWatched(world, nx, ny)) return { x: 0, y: 0, sneak: true };
  const dx = nx - p.x;
  const dy = ny - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, sneak: nearestGuardDist(world) < 280 };
}

function shardTile(world) {
  return findTiles(world.level, 'K')[0];
}

function exitTile(world) {
  return findTiles(world.level, 'E')[0];
}

/** Play the autopilot toward the shard, then the exit, for at most `seconds`. */
function playTowardExit(world, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const target = world.state.shardTaken ? exitTile(world) : shardTile(world);
    const events = stepWorld(world, autopilot(world, target), null, SAMPLE);
    if (events & EVENT_LEVEL_CLEAR) break;
    if (world.state.exit.open && Math.hypot(world.state.player.x - world.state.exit.x, world.state.player.y - world.state.exit.y) < 120) break;
  }
}

/** Let the wardens patrol with no input for `seconds`. */
function idle(world, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) stepWorld(world, { x: 0, y: 0, sneak: false }, null, SAMPLE);
}

/** Find a bush tile near a patrol route to hide the moth in for the cover shot. */
function hidingBush(world) {
  const bushes = findTiles(world.level, 'B');
  const guards = world.state.guards;
  let best = bushes[0];
  let bestScore = -Infinity;
  for (const [c, r] of bushes) {
    const x = c * TILE + TILE / 2;
    const y = r * TILE + TILE / 2;
    const near = Math.min(...guards.flatMap((g) => g.waypoints.map((w) => Math.hypot(w.x - x, w.y - y))));
    const score = -Math.abs(near - 170);
    if (score > bestScore) {
      bestScore = score;
      best = [c, r];
    }
  }
  return best;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: cover (a near miss from a bush), play (mid-heist, shard in hand),
 * alert (spotted, running for the dark), title (the vault at night).
 */
export function stageShot(name, world) {
  if (name === 'title') {
    loadLevel(world, 2);
    world.peaceful = true;
    idle(world, 9);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'cover') {
    loadLevel(world, 1);
    const [c, r] = hidingBush(world);
    world.state.player.x = c * TILE + TILE / 2;
    world.state.player.y = r * TILE + TILE / 2;
    // Step the patrols and keep the frame where a warden sweeps closest past
    // the bush without spotting the moth: the near miss the cover sells.
    let bestStep = 0;
    let bestScore = -Infinity;
    for (let s = 0; s < 40 * 30; s += 1) {
      stepWorld(world, { x: 0, y: 0, sneak: true }, null, SAMPLE);
      if (s < 90) continue; // let the patrols spread out before judging the frame
      const guard = world.state.guards.reduce((a, b) =>
        Math.hypot(b.x - world.state.player.x, b.y - world.state.player.y) <
        Math.hypot(a.x - world.state.player.x, a.y - world.state.player.y) ? b : a);
      const d = Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y);
      const facing = Math.abs(((Math.atan2(world.state.player.y - guard.y, world.state.player.x - guard.x) - guard.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const score = d > 90 && d < 260 && facing < 1.1 && guard.detection < 0.3 ? 300 - Math.abs(d - 170) : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        bestStep = s;
      }
    }
    // Re-run from the start to the best frame: the steps are deterministic.
    loadLevel(world, 1);
    world.state.player.x = c * TILE + TILE / 2;
    world.state.player.y = r * TILE + TILE / 2;
    for (let s = 0; s <= bestStep; s += 1) stepWorld(world, { x: 0, y: 0, sneak: true }, null, SAMPLE);
    // The hint line expired during the long probe run; put it back for the frame.
    world.message = world.level.hint;
    world.messageTimer = 999;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    loadLevel(world, 1);
    // Stand the moth on the second warden's patrol path — a straight, clear
    // column — ahead of it, so the warden walks straight into the moth:
    // spotted, then running for the dark.
    const guard = world.state.guards[1];
    const target = guard.waypoints[guard.waypointIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const len = Math.hypot(dx, dy) || 1;
    world.state.player.x = guard.x + (dx / len) * 130;
    world.state.player.y = guard.y + (dy / len) * 130;
    let spottedAt = -1;
    for (let s = 0; s < 12 * 30; s += 1) {
      stepWorld(world, { x: 0, y: 0, sneak: false }, null, SAMPLE);
      if (guard.state === 'alert') {
        spottedAt = s;
        break;
      }
      if (world.lives < 3) break;
    }
    if (spottedAt >= 0) {
      // Flee straight away from the warden and freeze mid-chase: the '!'
      // above the warden and the red cone are the shot, not the hiding after.
      const livesBefore = world.lives;
      for (let s = 0; s < 0.4 / SAMPLE; s += 1) {
        const p = world.state.player;
        const ddx = p.x - guard.x;
        const ddy = p.y - guard.y;
        const llen = Math.hypot(ddx, ddy) || 1;
        stepWorld(world, { x: ddx / llen, y: ddy / llen, sneak: false }, null, SAMPLE);
        if (world.lives !== livesBefore) break;
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // 'play': the heist itself — shard taken, heading for the skylight.
  loadLevel(world, 0);
  playTowardExit(world, 45);
  return { screen: SCREEN_PLAY, best: 0 };
}

export const SHOT_NAMES = ['cover', 'play', 'alert', 'title'];
