// Sight: whether a guard can see a point, and the cone shape the renderer draws.
// Sight is blocked by walls, crates and pillars; bushes hide you but do not block
// a cone. The checks run on the tile grid with a short step ray, which is exact
// enough for a 40 px tile and cheap enough to run every frame for every guard.
import { TILE, COLS, ROWS } from './config.js';

function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return level.map[row][col];
}

export function isSolidAt(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === '#' ||
    tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === 'C' ||
    tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === 'P';
}

/** True when no wall, crate or pillar stands between the two points. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isSolidAt(level, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * How far a ray from (x, y) along `angle` travels before it hits something solid.
 * Stepped in small hops; the cone is drawn from these lengths.
 */
export function rayLength(level, x, y, angle, maxRange) {
  const step = 5;
  for (let d = step; d <= maxRange; d += step) {
    if (isSolidAt(level, x + Math.cos(angle) * d, y + Math.sin(angle) * d)) return d - step / 2;
  }
  return maxRange;
}

/** The cone's outline as points, so the renderer can fill it and punch it into the dark. */
export function conePolygon(level, x, y, angle, range, halfAngle) {
  const points = [{ x, y }];
  const rays = 14;
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const len = rayLength(level, x, y, a, range);
    points.push({ x: x + Math.cos(a) * len, y: y + Math.sin(a) * len });
  }
  return points;
}

/**
 * Can this guard see the player right now? Inside the cone, inside the range,
 * with a clear line of sight — and not hidden in a bush unless the guard is
 * close enough to spot the rustle.
 */
export function canSeePlayer(level, guard, player, config) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > config.viewRange) return { seen: false, dist };
  const angle = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angle, guard.facing)) > config.viewHalfAngle) return { seen: false, dist };
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return { seen: false, dist };
  if (player.inBush && dist > config.bushSpotRange) return { seen: false, dist };
  return { seen: true, dist };
}
