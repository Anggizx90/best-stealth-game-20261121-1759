// Keyboard and mouse: WASD or arrows to move, Shift to sneak, click to toss a
// pebble toward the mouse, P or Escape to pause, R to restart the gallery,
// M to mute. The input is read fresh every frame and the actions are taken once.

export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_RESTART = 1 << 2;
export const ACTION_MUTE = 1 << 3;

export function createInput(canvas, fieldOffset) {
  const keys = new Set();
  const actions = { bits: 0, throwAt: null };

  function keyName(event) {
    const k = event.key.toLowerCase();
    if (k === ' ') return 'space';
    return k;
  }

  window.addEventListener('keydown', (event) => {
    const k = keyName(event);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(k)) event.preventDefault();
    if (event.repeat) return;
    keys.add(k);
    if (k === 'space' || k === 'enter') actions.bits |= ACTION_CONFIRM;
    if (k === 'p' || k === 'escape') actions.bits |= ACTION_PAUSE;
    if (k === 'r') actions.bits |= ACTION_RESTART;
    if (k === 'm') actions.bits |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    // Undo the CSS stretch, then the field's offset inside the canvas.
    const px = ((event.clientX - rect.left) * canvas.width) / rect.width - fieldOffset.x;
    const py = ((event.clientY - rect.top) * canvas.height) / rect.height - fieldOffset.y;
    actions.throwAt = { x: px, y: py };
    actions.bits |= ACTION_CONFIRM;
  });

  return {
    /** WASD / arrows as a unit-ish vector, plus whether Shift is held to sneak. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y, sneak: keys.has('shift') };
    },
    takeActions() {
      const out = { bits: actions.bits, throwAt: actions.throwAt };
      actions.bits = 0;
      actions.throwAt = null;
      return out;
    },
  };
}
