// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), the wardens'
// footsteps sound where they are, and the renderer paints what is there. The
// game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the patrols' little hesitations. ?shot=cover|play|alert|title
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, stepWorld, loadLevel, heatOf, EVENT_PICKUP, EVENT_SPOTTED, EVENT_SUSPICIOUS, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_GAME_OVER, EVENT_PEBBLE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, FIELD_OFFSET, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, FIELD_OFFSET);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    loadLevel(world, 0);
    world.score = 0;
    world.lives = 3;
    world.totalTime = 0;
    world.gameOver = false;
    world.gameWon = false;
    world.levelClear = false;
    world.peaceful = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce(`Playing. ${world.level.name}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_PEBBLE) audio.pebble();
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_LEVEL_CLEAR) {
      if (world.gameWon) {
        screen = SCREEN_WIN;
        audio.win();
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
        announce(`You win! Final score ${world.score}.`);
      } else {
        banner = 'Gallery cleared — on to the next!';
        bannerTimer = 1.6;
        audio.levelClear();
        announce(banner);
      }
    }
    if (events & EVENT_GAME_OVER) {
      screen = SCREEN_OVER;
      if (world.score > best) {
        best = world.score;
        saveBest(best);
      }
      announce(`Caught. Game over. Score ${world.score}.`);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the wardens walk the first gallery behind the title.
      world.peaceful = true;
      stepWorld(world, { x: 0, y: 0, sneak: false }, null, STEP);
      return;
    }
    const dir = input.direction();
    const events = stepWorld(world, dir, null, STEP);
    handleEvents(events);
    audio.setTension(heatOf(world));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    const actions = input.takeActions();
    if (actions.bits & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions.bits & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions.bits & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions.bits & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions.bits & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      startGame();
    }
    // A pebble is thrown where the mouse clicked, while the game is running.
    if (actions.throwAt && screen === SCREEN_PLAY) {
      const events = stepWorld(world, { x: 0, y: 0, sneak: false }, actions.throwAt, 0);
      handleEvents(events);
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) banner = null;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, now / 1000);
    // The level-clear banner floats over the new gallery for a moment.
    if (banner) {
      const ctx = canvas.getContext('2d');
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(4, 7, 16, 0.75)';
      ctx.fillRect(340, 330, 600, 64);
      ctx.fillStyle = '#58e39a';
      ctx.font = 'bold 30px Georgia, serif';
      ctx.fillText(banner, 640, 372);
    }
  }

  // Leaving the tab pauses a running game rather than letting wardens walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mothlight. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
