// The three galleries of Mothlight. Each level is a tile map plus the guards who
// walk it. Legend: '#' wall, '.' floor, 'C' crate (blocks sight and movement),
// 'P' pillar (blocks sight and movement), 'B' bush (hide in it: a guard only
// spots you there up close), 'S' the moth's start, 'E' the skylight exit,
// 'K' the moonshard that unlocks the exit, '*' a bonus firefly, 'L' a lamp
// (its light makes you easier to spot, so cross it quickly).
// Waypoints are tile coordinates; a guard walks them in order, pauses at each
// one and looks around, then walks on. Patrols are fixed, so they can be learned.

export const LEVELS = [
  {
    name: 'I · The Vestibule',
    hint: 'Slip past the two wardens. The moonshard unlocks the skylight exit.',
    map: [
      '##########################',
      '#S......C..........*....E#',
      '#........C...............#',
      '#..B.....................#',
      '#.............P..........#',
      '#..C....####.......C...K.#',
      '#..C....#..#...........#.#',
      '#.......#..#....C..L.....#',
      '#..B....#..#....C.....B..#',
      '#.......####.............#',
      '#.............P....C.....#',
      '#..C.....................#',
      '#..C....*.......B........#',
      '#..................C.....#',
      '#....B...................#',
      '##########################',
    ],
    guards: [
      { waypoints: [[4, 2], [4, 7], [4, 13]], speed: 1 },
      { waypoints: [[19, 3], [23, 3], [23, 11], [19, 11]], speed: 1 },
    ],
  },
  {
    name: 'II · The Long Gallery',
    hint: 'Three wardens walk the gallery. Bushes hide you; lamps betray you.',
    map: [
      '##########################',
      '#S....P.......C......*..E#',
      '#........................#',
      '#..B......C.......P...L..#',
      '#..........####..........#',
      '#..C......#....#....C....#',
      '#.........#.K..#.........#',
      '#..B...........#....B....#',
      '#..........####.....C....#',
      '#.....C.........P........#',
      '#........................#',
      '#..B.......C........B....#',
      '#..........P.............#',
      '#....*..........C........#',
      '#.......B................#',
      '##########################',
    ],
    guards: [
      { waypoints: [[3, 1], [3, 14], [12, 14], [12, 1]], speed: 1 },
      { waypoints: [[21, 2], [21, 13]], speed: 1.05 },
      { waypoints: [[8, 8], [17, 8], [17, 12], [8, 12]], speed: 0.95 },
    ],
  },
  {
    name: 'III · The Vault',
    hint: 'Four wardens, one vault. Wait for the gap, then move — never run in the light.',
    map: [
      '##########################',
      '#S...C.....P.......*....E#',
      '#........................#',
      '#..B....C......C....B....#',
      '#.......####..####.......#',
      '#..C....#........#...C...#',
      '#.......#.K......#.......#',
      '#..B....#........#...B...#',
      '#.......####..####.......#',
      '#..........P......C......#',
      '#..C..........L..........#',
      '#......B......P.....B....#',
      '#..........C.............#',
      '#....*..........C........#',
      '#.......B...........C....#',
      '##########################',
    ],
    guards: [
      { waypoints: [[6, 1], [5, 14], [10, 14], [10, 1]], speed: 1.05 },
      { waypoints: [[20, 1], [19, 14]], speed: 1.1 },
      { waypoints: [[2, 7], [12, 7], [12, 10], [2, 10]], speed: 1 },
      { waypoints: [[16, 3], [23, 4], [23, 12], [15, 12]], speed: 0.95 },
    ],
  },
];

/** Tile characters that stop movement and sight. */
export function isSolidTile(ch) {
  return ch === '#' || ch === 'C' || ch === 'P';
}

/** Find every tile holding `ch` in a level's map, as [col, row] pairs. */
export function findTiles(level, ch) {
  const out = [];
  for (let row = 0; row < level.map.length; row += 1) {
    for (let col = 0; col < level.map[row].length; col += 1) {
      if (level.map[row][col] === ch) out.push([col, row]);
    }
  }
  return out;
}
