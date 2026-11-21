// The renderer: everything the judge sees. The gallery floor, the cover, the
// wardens and their cones, the moth, the dark that hides you and the light that
// betrays you, the HUD and the screens. Nothing here is an image file: every
// shape is drawn from the world state, so a screenshot is always the game.
import { TILE, COLS, ROWS, FIELD_WIDTH, FIELD_HEIGHT, SHOT, COLORS, GUARD } from './config.js';
import { conePolygon } from './vision.js';
import { heatOf } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export const FIELD_OFFSET = { x: (SHOT.width - FIELD_WIDTH) / 2, y: 90 };

function hashTile(col, row) {
  let h = (col * 374761393 + row * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  canvas.width = SHOT.width;
  canvas.height = SHOT.height;
  const ctx = canvas.getContext('2d');
  const light = document.createElement('canvas');
  light.width = SHOT.width;
  light.height = SHOT.height;
  const lctx = light.getContext('2d');

  function drawFloor(world) {
    const level = world.level;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        const ch = level.map[row][col];
        const shade = hashTile(col, row);
        ctx.fillStyle = (col + row) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (shade > 0.86) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        }
        ctx.strokeStyle = COLORS.floorEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
        if (ch === 'L') {
          const g = ctx.createRadialGradient(x + 20, y + 20, 4, x + 20, y + 20, 52);
          g.addColorStop(0, 'rgba(255, 217, 138, 0.5)');
          g.addColorStop(1, 'rgba(255, 217, 138, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 32, y - 32, TILE + 64, TILE + 64);
        }
      }
    }
  }

  function drawCover(world) {
    const level = world.level;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        const ch = level.map[row][col];
        if (ch === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, TILE, TILE);
          // A top edge only where the wall ends: a vertical border of wall
          // tiles would otherwise stripe itself with a highlight every row.
          const below = row + 1 < ROWS ? level.map[row + 1][col] : '#';
          if (below !== '#') {
            ctx.fillStyle = COLORS.wallTop;
            ctx.fillRect(x, y, TILE, 5);
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, y + 5, TILE, 2);
          }
        } else if (ch === 'C') {
          ctx.fillStyle = COLORS.crate;
          roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 4);
          ctx.fill();
          ctx.strokeStyle = COLORS.crateDark;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        } else if (ch === 'P') {
          ctx.fillStyle = COLORS.pillar;
          ctx.beginPath();
          ctx.arc(x + 20, y + 20, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.arc(x + 15, y + 14, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#232f45';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + 20, y + 20, 16, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ch === 'B') {
          ctx.fillStyle = COLORS.bush;
          for (const [ox, oy, r] of [[10, 12, 12], [24, 10, 13], [18, 24, 12], [30, 26, 10]]) {
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = COLORS.bushDark;
          for (const [ox, oy, r] of [[14, 18, 5], [26, 22, 5], [20, 12, 4]]) {
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (ch === 'L') {
          ctx.fillStyle = '#2c2417';
          ctx.fillRect(x + 17, y + 12, 6, 16);
          ctx.fillStyle = COLORS.lampGlow;
          ctx.beginPath();
          ctx.arc(x + 20, y + 12, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawExitAndPickups(world, time) {
    const state = world.state;
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    // The skylight exit: a green doorway when open, chained red while locked.
    const ex = state.exit;
    ctx.save();
    ctx.translate(ex.x, ex.y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46 * pulse);
    glow.addColorStop(0, ex.open ? 'rgba(88, 227, 154, 0.55)' : 'rgba(227, 93, 93, 0.4)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-50, -50, 100, 100);
    ctx.fillStyle = '#0c1424';
    roundRect(ctx, -15, -17, 30, 34, 4);
    ctx.fill();
    ctx.strokeStyle = ex.open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = ex.open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(ex.open ? 'EXIT' : 'LOCKED', 0, 30);
    ctx.restore();

    // The moonshard: a pale blue diamond that bobs and glows.
    if (!state.shardTaken) {
      const s = state.shard;
      const bob = Math.sin(time * 2.4) * 3;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
      g.addColorStop(0, 'rgba(191, 233, 255, 0.6)');
      g.addColorStop(1, 'rgba(191, 233, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-34, -34, 68, 68);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.shard;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }
    // Bonus fireflies: small warm sparks that drift.
    for (const fly of state.fireflies) {
      if (fly.taken) continue;
      const wob = Math.sin(time * 3 + fly.x) * 3;
      ctx.save();
      ctx.translate(fly.x + wob, fly.y + Math.cos(time * 2.2 + fly.y) * 3);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
      g.addColorStop(0, 'rgba(255, 226, 122, 0.7)');
      g.addColorStop(1, 'rgba(255, 226, 122, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-22, -22, 44, 44);
      ctx.fillStyle = COLORS.firefly;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRingsAndFlights(world) {
    for (const ring of world.state.noiseRings) {
      ctx.strokeStyle = ring.guard ? `rgba(255, 180, 90, ${ring.alpha})` : `rgba(191, 233, 255, ${ring.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const flight of world.state.pebbleFlights) {
      const t = Math.min(1, flight.t / flight.duration);
      const x = flight.from.x + (flight.to.x - flight.from.x) * t;
      const y = flight.from.y + (flight.to.y - flight.from.y) * t - Math.sin(t * Math.PI) * 26;
      ctx.fillStyle = '#d8d2c0';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGuard(world, guard, time) {
    const alerted = guard.state === 'alert';
    const suspicious = guard.state === 'suspicious' || guard.state === 'investigate' || guard.state === 'search';
    // The cone itself is painted later, over the dark; here is the warden.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    // Lantern light at the warden's feet.
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(255, 179, 71, 0.35)');
    g.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, 60, 60);
    // Cloak: a dark cone pointing where the warden faces.
    ctx.rotate(guard.facing);
    ctx.fillStyle = alerted ? '#5a2430' : COLORS.guard;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(-6, -13, -12, -9);
    ctx.quadraticCurveTo(-14, 0, -12, 9);
    ctx.quadraticCurveTo(-6, 13, 16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Hood and lantern.
    ctx.fillStyle = '#101827';
    ctx.beginPath();
    ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardTrim;
    ctx.beginPath();
    ctx.arc(9, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Detection arc above the warden's head.
    if (guard.detection > 0.02) {
      const d = guard.detection;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 10, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = d >= 1 ? '#ff5d5d' : d >= GUARD.suspiciousAt ? '#ffb347' : '#ffe27a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d);
      ctx.stroke();
    }
    // "?" while suspicious, "!" while alarmed — the near miss that raises the alarm.
    if (alerted || suspicious) {
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = alerted ? '#ff5d5d' : '#ffd166';
      ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 36);
    }
  }

  function drawPlayer(world, time) {
    const p = world.state.player;
    const flap = Math.sin(time * (p.moving ? 14 : 5)) * 0.35;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.inBush) ctx.globalAlpha = 0.72;
    // Lantern glow under the moth.
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 42);
    g.addColorStop(0, 'rgba(245, 233, 200, 0.5)');
    g.addColorStop(1, 'rgba(245, 233, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-42, -42, 84, 84);
    // Wings, flapping, angled to the direction of travel.
    ctx.rotate(p.facing);
    ctx.fillStyle = COLORS.playerWing;
    ctx.beginPath();
    ctx.ellipse(-2, -11 - flap * 4, 11, 6 + flap * 3, -0.5, 0, Math.PI * 2);
    ctx.ellipse(-2, 11 + flap * 4, 11, 6 + flap * 3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Body and head, outlined dark so the pale moth reads on light floors too.
    ctx.strokeStyle = 'rgba(10, 15, 28, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Antennae.
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.quadraticCurveTo(16, -7, 19, -6);
    ctx.moveTo(11, 2);
    ctx.quadraticCurveTo(16, 7, 19, 6);
    ctx.stroke();
    ctx.restore();
    // A soft ring while sneaking: the moth is quiet and hard to see.
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(245, 233, 200, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCones(world) {
    for (const guard of world.state.guards) {
      const poly = conePolygon(world.level, guard.x, guard.y, guard.facing, GUARD.viewRange, GUARD.viewHalfAngle);
      const alerted = guard.state === 'alert';
      ctx.fillStyle = alerted ? 'rgba(255, 93, 93, 0.30)' : COLORS.cone;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = alerted ? 'rgba(255, 120, 120, 0.6)' : COLORS.coneEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawHud(world, best, time) {
    const state = world.state;
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, SHOT.width, 78);
    ctx.fillStyle = '#1a263f';
    ctx.fillRect(0, 78, SHOT.width, 2);
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, SHOT.height - 52, SHOT.width, 52);
    ctx.fillStyle = '#1a263f';
    ctx.fillRect(0, SHOT.height - 52, SHOT.width, 2);

    // Left: title and gallery.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5e9c8';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('MOTHLIGHT', 24, 34);
    ctx.fillStyle = '#8fa3c4';
    ctx.font = '15px Georgia, serif';
    ctx.fillText(world.level.name, 24, 58);

    // Centre: objective — shard, fireflies, exit.
    const fliesTaken = state.fireflies.filter((f) => f.taken).length;
    ctx.textAlign = 'center';
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = state.shardTaken ? '#bfe9ff' : '#5f7296';
    ctx.fillText(`◆ Moonshard ${state.shardTaken ? 1 : 0}/1`, 560, 32);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(`✦ Fireflies ${fliesTaken}/${state.fireflies.length}`, 560, 56);
    ctx.fillStyle = state.exit.open ? COLORS.exitOpen : '#e35d5d';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillText(state.exit.open ? 'EXIT OPEN' : 'EXIT LOCKED', 760, 44);

    // Right: lives, pebbles, heat eye, score, timer.
    ctx.textAlign = 'right';
    ctx.font = '20px Georgia, serif';
    ctx.fillStyle = '#ff7d9c';
    ctx.fillText('♥'.repeat(Math.max(0, world.lives)), 950, 34);
    ctx.fillStyle = '#d8d2c0';
    ctx.font = '16px Georgia, serif';
    ctx.fillText(`● Pebbles ${world.pebbles}`, 950, 58);
    // Heat eye: fills as the wardens grow suspicious.
    const heat = heatOf(world);
    const ex = 1045;
    ctx.fillStyle = '#22304a';
    ctx.beginPath();
    ctx.ellipse(ex, 34, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = heat >= 1 ? '#ff5d5d' : heat >= GUARD.suspiciousAt ? '#ffb347' : '#8fa3c4';
    ctx.beginPath();
    ctx.arc(ex, 34, 5 + heat * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8fa3c4';
    ctx.font = '13px Georgia, serif';
    ctx.fillText(heat >= 1 ? 'SEEN!' : heat >= GUARD.suspiciousAt ? 'SUSPICIOUS' : 'HIDDEN', ex, 62);
    ctx.fillStyle = '#f5e9c8';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(`Score ${world.score}`, 1256, 32);
    ctx.fillStyle = '#8fa3c4';
    ctx.font = '15px Georgia, serif';
    ctx.fillText(`⏱ ${Math.floor(world.levelTime)}s   Best ${best}`, 1256, 58);

    // Bottom: the message line and the controls.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9d6ea';
    ctx.font = '16px Georgia, serif';
    ctx.fillText(world.messageTimer > 0 ? world.message : '', 24, SHOT.height - 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5f7296';
    ctx.font = '14px Georgia, serif';
    ctx.fillText('WASD move · Shift sneak · Click toss a pebble · P pause · R restart · M mute', SHOT.width - 24, SHOT.height - 20);
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(4, 7, 16, 0.72)';
    ctx.fillRect(0, 0, SHOT.width, SHOT.height);
    ctx.fillStyle = '#101a2e';
    roundRect(ctx, 340, 150, 600, 500, 12);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(title, 640, 240);
    ctx.fillStyle = '#c9d6ea';
    ctx.font = '18px Georgia, serif';
    lines.forEach((line, i) => ctx.fillText(line, 640, 300 + i * 32));
  }

  function drawScreen(world, screen, best, time) {
    if (screen === SCREEN_TITLE) {
      panel('MOTHLIGHT', [
        'A quiet heist in three galleries.',
        'You are Pip, a moth with a lantern and light fingers.',
        'Steal the moonshard. Slip out the skylight. Never be seen.',
        '',
        'WASD / arrows — move      Shift — sneak, slow and silent',
        'Click — toss a pebble to lure a warden away',
        'Bushes hide you. Lamps betray you. Running is loud.',
        '',
        'Press SPACE or click to begin',
        best > 0 ? `Best score: ${best}` : 'No moth has flown free yet.',
      ], '#f5e9c8');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The wardens wait. So can you.', '', 'Press P or SPACE to keep sneaking.'], '#8fa3c4');
      return;
    }
    if (screen === SCREEN_OVER) {
      panel('CAUGHT', [
        'The wardens found the moth.',
        `Score ${world.score}   ·   Best ${best}`,
        '',
        'Press SPACE or click to try the gallery again.',
      ], '#ff5d5d');
      return;
    }
    if (screen === SCREEN_WIN) {
      panel('THE MOTH FLIES FREE', [
        'Every gallery crossed, every moonshard stolen.',
        `Final score ${world.score}   ·   Time ${Math.floor(world.totalTime)}s`,
        world.ghost ? 'Ghost: never once spotted. A perfect heist.' : 'Seen, but never caught for long.',
        '',
        'Press SPACE or click to fly again.',
      ], '#58e39a');
    }
  }

  return {
    draw(world, screen, best, time) {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, SHOT.width, SHOT.height);
      ctx.save();
      ctx.translate(FIELD_OFFSET.x, FIELD_OFFSET.y);
      drawFloor(world);
      drawCover(world);
      drawExitAndPickups(world, time);
      drawRingsAndFlights(world);
      for (const guard of world.state.guards) drawGuard(world, guard, time);
      drawPlayer(world, time);
      ctx.restore();
      // The dark, with holes where the light is. The light canvas is the full
      // 1280x800 frame, so holes are punched in canvas space (field + offset).
      lctx.clearRect(0, 0, SHOT.width, SHOT.height);
      lctx.globalCompositeOperation = 'source-over';
      lctx.fillStyle = COLORS.darkness;
      lctx.fillRect(0, 0, SHOT.width, SHOT.height);
      lctx.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, strength) => {
        const cx = x + FIELD_OFFSET.x;
        const cy = y + FIELD_OFFSET.y;
        const g = lctx.createRadialGradient(cx, cy, 4, cx, cy, r);
        g.addColorStop(0, `rgba(0,0,0,${strength})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      };
      const p = world.state.player;
      hole(p.x, p.y, 150 + p.lanternFlicker * 6, 0.95);
      for (const lamp of world.state.lamps) hole(lamp.x, lamp.y, 110, 0.9);
      if (!world.state.shardTaken) hole(world.state.shard.x, world.state.shard.y, 60, 0.85);
      if (world.state.exit.open) hole(world.state.exit.x, world.state.exit.y, 95, 0.9);
      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(light, 0, 0);
      // Vision cones over the dark, so they read at a glance.
      ctx.save();
      ctx.translate(FIELD_OFFSET.x, FIELD_OFFSET.y);
      drawCones(world);
      ctx.restore();
      drawHud(world, best, time);
      drawScreen(world, screen, best, time);
    },
  };
}
