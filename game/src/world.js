// The world: the moth, the wardens, the shards and the exit, and the rules that
// move them. A fixed 1/60 s step keeps the game deterministic: the same inputs
// from the same seed always play the same way, which is what makes the
// screenshot scenes and the play-tests repeatable.
import { TILE, COLS, ROWS, PLAYER, GUARD, LEVEL, STEP } from './config.js';
import { LEVELS, findTiles, isSolidTile } from './levels.js';
import { canSeePlayer, hasLineOfSight, isSolidAt } from './vision.js';
import { findPath } from './pathfind.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1 << 0;
export const EVENT_SPOTTED = 1 << 1;
export const EVENT_SUSPICIOUS = 1 << 2;
export const EVENT_CAUGHT = 1 << 3;
export const EVENT_LEVEL_CLEAR = 1 << 4;
export const EVENT_GAME_OVER = 1 << 5;
export const EVENT_NOISE = 1 << 6;
export const EVENT_PEBBLE = 1 << 7;

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_INVESTIGATE = 'investigate';

const tileCenter = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

function tileOf(x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

function circleHitsSolid(level, x, y, radius) {
  // Check the four corners of the circle's box; a tile is solid or it is not.
  for (const [ox, oy] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    if (isSolidAt(level, x + ox, y + oy)) return true;
  }
  return false;
}

function moveWithCollision(level, body, dx, dy) {
  const nx = body.x + dx;
  if (!circleHitsSolid(level, nx, body.y, body.radius)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsSolid(level, body.x, ny, body.radius)) body.y = ny;
}

function makeGuard(def, index, random) {
  const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
  const second = tileCenter(def.waypoints[1][0], def.waypoints[1][1]);
  return {
    id: index,
    x: start.x,
    y: start.y,
    radius: GUARD.radius,
    facing: Math.atan2(second.y - start.y, second.x - start.x),
    state: GUARD_PATROL,
    waypointIndex: 1,
    waypoints: def.waypoints.map(([c, r]) => tileCenter(c, r)),
    // The walkable route to the next waypoint, followed node by node; a
    // straight line between waypoints can run into a crate, a path never does.
    path: null,
    pathIndex: 0,
    speed: GUARD.patrolSpeed * (def.speed ?? 1),
    detection: 0,
    pauseLeft: 0,
    lookTarget: null,
    lastSeen: null,
    loseSightLeft: 0,
    searchLeft: 0,
    investigateTarget: null,
    stepPhase: random.next() * Math.PI * 2,
    stepTimer: 0,
    heard: null,
  };
}

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    score: 0,
    lives: LEVEL.lives,
    levelTime: 0,
    totalTime: 0,
    ghost: true,
    levelClear: false,
    gameOver: false,
    gameWon: false,
    message: '',
    messageTimer: 0,
    pebbles: LEVEL.pebbles,
    // While true the wardens never notice the moth: attract mode behind the
    // title screen, and the title screenshot, walk the patrols in peace.
    peaceful: false,
    state: null,
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const level = LEVELS[index];
  const start = tileCenter(...findTiles(level, 'S')[0]);
  const exit = tileCenter(...findTiles(level, 'E')[0]);
  world.level = level;
  world.levelIndex = index;
  world.levelTime = 0;
  world.ghost = true;
  world.pebbles = LEVEL.pebbles;
  world.state = {
    player: {
      x: start.x,
      y: start.y,
      radius: PLAYER.radius,
      sneaking: false,
      running: false,
      moving: false,
      inBush: false,
      inLight: false,
      stepTimer: 0,
      noiseTimer: 0,
      facing: 0,
      lanternFlicker: 0,
    },
    guards: level.guards.map((def, i) => makeGuard(def, i, world.random)),
    shard: tileCenter(...findTiles(level, 'K')[0]),
    shardTaken: false,
    fireflies: findTiles(level, '*').map(([c, r]) => ({ ...tileCenter(c, r), taken: false })),
    lamps: findTiles(level, 'L').map(([c, r]) => tileCenter(c, r)),
    exit: { ...exit, open: false },
    pebbleFlights: [],
    noiseRings: [],
    start,
  };
  world.message = level.hint;
  world.messageTimer = 4;
}

function playerTileFlags(world) {
  const { col, row } = tileOf(world.state.player.x, world.state.player.y);
  const ch = world.level.map[row]?.[col] ?? '#';
  world.state.player.inBush = ch === 'B';
  world.state.player.inLight = world.state.lamps.some(
    (lamp) => Math.hypot(lamp.x - world.state.player.x, lamp.y - world.state.player.y) < 95,
  );
}

function say(world, text, seconds = 3) {
  world.message = text;
  world.messageTimer = seconds;
}

function guardTargetPoint(guard) {
  if (guard.state === GUARD_ALERT && guard.lastSeen) return guard.lastSeen;
  if ((guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) && guard.investigateTarget) return guard.investigateTarget;
  return guard.waypoints[guard.waypointIndex];
}

function guardSpeed(guard) {
  if (guard.state === GUARD_ALERT) return GUARD.chaseSpeed;
  if (guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH) return GUARD.investigateSpeed;
  return guard.speed;
}

function moveGuardToward(world, guard, target, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const speed = guardSpeed(guard);
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  // Guards slide along walls the same way the player does.
  const body = { x: guard.x, y: guard.y, radius: guard.radius };
  moveWithCollision(world.level, body, nx - guard.x, 0);
  moveWithCollision(world.level, body, 0, ny - guard.y);
  guard.x = body.x;
  guard.y = body.y;
  guard.facing = Math.atan2(dy, dx);
  guard.stepTimer -= dt;
  if (guard.stepTimer <= 0) {
    guard.stepTimer = guard.state === GUARD_ALERT ? 0.3 : 0.45;
    guard.stepPhase += Math.PI;
    world.state.noiseRings.push({ x: guard.x, y: guard.y, radius: 8, alpha: 0.5, guard: true });
  }
  return dist - step < 6;
}

function investigate(world, guard, point, why) {
  if (guard.state === GUARD_ALERT) return;
  guard.state = GUARD_INVESTIGATE;
  guard.path = null;
  guard.investigateTarget = { x: point.x, y: point.y };
  guard.detection = Math.max(guard.detection, GUARD.suspiciousAt);
  if (why) say(world, why);
}

function updateGuard(world, guard, dt) {
  const player = world.state.player;
  const seen = world.peaceful ? { seen: false, dist: Infinity } : canSeePlayer(world.level, guard, player, GUARD);

  // --- Detection: suspicion grows while the moth is seen, drains while hidden.
  if (seen.seen) {
    let rate = GUARD.detectFar + (GUARD.detectNear - GUARD.detectFar) * (1 - seen.dist / GUARD.viewRange);
    if (player.sneaking) rate *= GUARD.detectSneak;
    if (player.running) rate *= GUARD.detectRunning;
    if (player.inLight) rate *= GUARD.detectLit;
    if (!player.inLight) rate *= GUARD.detectDark;
    guard.detection = Math.min(1, guard.detection + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightLeft = GUARD.loseSightAfter;
  } else {
    guard.detection = Math.max(0, guard.detection - GUARD.detectDrain * dt);
    if (guard.state === GUARD_ALERT) {
      guard.loseSightLeft -= dt;
      if (guard.loseSightLeft <= 0) {
        guard.state = GUARD_SEARCH;
        guard.searchLeft = GUARD.searchTime;
        guard.investigateTarget = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
      }
    }
  }

  // --- State changes on the detection meter.
  if (guard.detection >= 1 && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    guard.path = null;
    world.ghost = false;
    say(world, 'Spotted! Break line of sight and hide!', 3);
    return EVENT_SPOTTED;
  }
  if (guard.state === GUARD_PATROL && guard.detection >= GUARD.suspiciousAt) {
    guard.state = GUARD_SUSPICIOUS;
    guard.path = null;
    guard.pauseLeft = 1.1;
    guard.lookTarget = { x: player.x, y: player.y };
    say(world, 'A warden is suspicious… stay out of the light.', 2.5);
    return EVENT_SUSPICIOUS;
  }
  if (guard.state === GUARD_SUSPICIOUS) {
    guard.pauseLeft -= dt;
    if (guard.lookTarget) {
      const want = Math.atan2(guard.lookTarget.y - guard.y, guard.lookTarget.x - guard.x);
      guard.facing = want;
    }
    if (guard.pauseLeft <= 0) {
      if (guard.detection >= GUARD.suspiciousAt && guard.lastSeen) {
        investigate(world, guard, guard.lastSeen, null);
      } else {
        guard.state = GUARD_PATROL;
        guard.lookTarget = null;
      }
    }
    return EVENT_NONE;
  }

  // --- Movement for the chasing, searching and investigating states.
  if (guard.state === GUARD_ALERT) {
    if (seen.seen) guard.lastSeen = { x: player.x, y: player.y };
    const target = guard.lastSeen ?? { x: guard.x, y: guard.y };
    moveGuardToward(world, guard, target, dt);
    const d = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (d < GUARD.catchRange) return EVENT_CAUGHT;
    return EVENT_NONE;
  }
  if (guard.state === GUARD_SEARCH) {
    const arrived = moveGuardToward(world, guard, guard.investigateTarget, dt);
    if (arrived) {
      guard.searchLeft -= dt;
      guard.facing += dt * 1.8;
      if (guard.searchLeft <= 0) {
        guard.state = GUARD_PATROL;
        guard.investigateTarget = null;
        guard.detection = 0;
      }
    }
    return EVENT_NONE;
  }
  if (guard.state === GUARD_INVESTIGATE) {
    const arrived = moveGuardToward(world, guard, guard.investigateTarget, dt);
    if (arrived) {
      guard.state = GUARD_SEARCH;
      guard.searchLeft = GUARD.searchTime;
    }
    return EVENT_NONE;
  }

  // --- Patrol: walk the waypoints along a walkable path, pause and look
  // around at each one.
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    guard.facing += dt * 0.9;
    return EVENT_NONE;
  }
  if (!guard.path || guard.pathIndex >= guard.path.length) {
    const from = tileOf(guard.x, guard.y);
    const target = guard.waypoints[guard.waypointIndex];
    const raw = findPath(world.level, from.col, from.row, Math.floor(target.x / TILE), Math.floor(target.y / TILE));
    guard.path = raw ? raw.map(([c, r]) => tileCenter(c, r)) : [target];
    guard.pathIndex = 0;
  }
  const node = guard.path[guard.pathIndex];
  const arrived = moveGuardToward(world, guard, node, dt);
  if (arrived) {
    guard.pathIndex += 1;
    if (guard.pathIndex >= guard.path.length) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pauseLeft = GUARD.pauseAtWaypoint;
      guard.path = null;
    }
  }
  return EVENT_NONE;
}

/**
 * One fixed step. `input` is {x, y, sneak} from the keyboard and `throwAt`
 * is a point to toss a pebble at, or null. Returns an event bitmask.
 */
export function stepWorld(world, input, throwAt, dt = STEP) {
  if (world.levelClear || world.gameOver) return EVENT_NONE;
  const state = world.state;
  const player = state.player;
  world.levelTime += dt;
  world.totalTime += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;

  // --- The moth moves.
  const moving = input.x !== 0 || input.y !== 0;
  player.moving = moving;
  // Crouching counts even while still: a moth pressed flat is harder to see.
  player.sneaking = !!input.sneak;
  player.running = moving && !player.sneaking;
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(input.x, input.y);
    const dx = (input.x / len) * speed * dt;
    const dy = (input.y / len) * speed * dt;
    moveWithCollision(world.level, player, dx, dy);
    player.facing = Math.atan2(dy, dx);
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      player.stepTimer = player.sneaking ? 0.42 : 0.3;
      if (player.running) {
        player.noiseTimer -= dt;
        if (player.noiseTimer <= 0) {
          player.noiseTimer = PLAYER.noiseEvery;
          state.noiseRings.push({ x: player.x, y: player.y, radius: 6, alpha: 0.45, guard: false });
          for (const guard of state.guards) {
            if (guard.state === GUARD_PATROL || guard.state === GUARD_SUSPICIOUS) {
              const d = Math.hypot(guard.x - player.x, guard.y - player.y);
              if (d < PLAYER.noiseRadius) investigate(world, guard, { x: player.x, y: player.y }, 'A warden heard footsteps…');
            }
          }
        }
      }
    }
  }
  playerTileFlags(world);
  player.lanternFlicker = Math.sin(world.totalTime * 7) * 0.5 + Math.sin(world.totalTime * 13.7) * 0.5;

  // --- A thrown pebble flies, lands, and rings out.
  if (throwAt && world.pebbles > 0) {
    const dx = throwAt.x - player.x;
    const dy = throwAt.y - player.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, PLAYER.throwRange);
    const land = { x: player.x + (dx / (dist || 1)) * range, y: player.y + (dy / (dist || 1)) * range };
    world.pebbles -= 1;
    state.pebbleFlights.push({ from: { x: player.x, y: player.y }, to: land, t: 0, duration: 0.45 });
    state.noiseRings.push({ x: land.x, y: land.y, radius: 10, alpha: 0.7, guard: false, max: 135 });
    for (const guard of state.guards) {
      if (guard.state !== GUARD_ALERT && Math.hypot(guard.x - land.x, guard.y - land.y) < 135) {
        investigate(world, guard, land, 'Something clinked in the dark…');
      }
    }
    return EVENT_PEBBLE;
  }

  // Pebble flights animate, then fade.
  for (const flight of state.pebbleFlights) flight.t += dt;
  state.pebbleFlights = state.pebbleFlights.filter((f) => f.t < f.duration + 0.15);
  for (const ring of state.noiseRings) {
    ring.radius += dt * 160;
    ring.alpha -= dt * 0.9;
  }
  state.noiseRings = state.noiseRings.filter((r) => r.alpha > 0 && ringRadiusOk(r));

  // --- The wardens think and walk.
  let events = EVENT_NONE;
  for (const guard of state.guards) {
    events |= updateGuard(world, guard, dt);
    if (events & EVENT_CAUGHT) break;
  }
  if (events & EVENT_CAUGHT) {
    world.lives -= 1;
    if (world.lives <= 0) {
      world.gameOver = true;
      say(world, 'Caught by the wardens. The gallery keeps its secrets…', 6);
      return events | EVENT_GAME_OVER;
    }
    say(world, 'Caught! Back to the door — one fewer wing.', 3);
    loadLevel(world, world.levelIndex);
    // loadLevel resets the message; keep the caught one.
    say(world, 'Caught! Back to the door — one fewer wing.', 3);
    return events;
  }

  // --- Pickups: the moonshard, then the fireflies.
  if (!state.shardTaken && Math.hypot(player.x - state.shard.x, player.y - state.shard.y) < 26) {
    state.shardTaken = true;
    state.exit.open = true;
    world.score += LEVEL.shardScore;
    say(world, 'The moonshard is yours — the skylight exit is open!', 3.5);
    events |= EVENT_PICKUP;
  }
  for (const fly of state.fireflies) {
    if (!fly.taken && Math.hypot(player.x - fly.x, player.y - fly.y) < 24) {
      fly.taken = true;
      world.score += LEVEL.fireflyScore;
      events |= EVENT_PICKUP;
    }
  }

  // --- The exit, reached unseen.
  if (state.exit.open && Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < 26) {
    const timeBonus = Math.max(0, Math.round((LEVEL.timeBonusAt - world.levelTime) * 2));
    const ghostBonus = world.ghost ? LEVEL.ghostBonus : 0;
    world.score += timeBonus + ghostBonus;
    events |= EVENT_LEVEL_CLEAR;
    if (world.levelIndex + 1 < LEVELS.length) {
      const next = world.levelIndex + 1;
      loadLevel(world, next);
      say(world, `${LEVELS[next].name} — ${LEVELS[next].hint}`, 4);
    } else {
      world.gameWon = true;
      world.levelClear = true;
      say(world, 'Every gallery crossed. The moth flies free.', 8);
    }
  }
  return events;
}

function ringRadiusOk(ring) {
  return !ring.max || ring.radius < ring.max;
}

/** The highest detection among the wardens: the HUD's heat eye reads this. */
export function heatOf(world) {
  return world.state.guards.reduce((max, g) => Math.max(max, g.detection), 0);
}

export function shardsLeft(world) {
  return world.state.fireflies.filter((f) => !f.taken).length + (world.state.shardTaken ? 0 : 1);
}
