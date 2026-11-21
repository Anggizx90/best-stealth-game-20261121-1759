// Breadth-first pathfinding over walkable tiles, shared by the wardens' patrols
// and the screenshot autopilot. A straight line between two patrol waypoints
// can run into a crate; a path never does.
import { COLS, ROWS } from './config.js';
import { isSolidTile } from './levels.js';

/** The shortest walkable route from one tile to another, as [col, row] pairs, or null. */
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  const key = (c, r) => r * COLS + c;
  const walkable = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !isSolidTile(level.map[r][c]);
  if (!walkable(toCol, toRow) || !walkable(fromCol, fromRow)) return null;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = key(c, r);
      while (cur !== null) {
        path.unshift([cur % COLS, Math.floor(cur / COLS)]);
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (walkable(nc, nr) && !prev.has(key(nc, nr))) {
        prev.set(key(nc, nr), key(c, r));
        queue.push([nc, nr]);
      }
    }
  }
  return null;
}
