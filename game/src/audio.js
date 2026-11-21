// Sound, synthesized live with WebAudio — no audio files, nothing to download.
// Footsteps tell you where a warden is: a step pans left or right with the
// guard and gets louder as it gets closer. The drone underneath tightens when
// the gallery is alarmed.
export function createAudio() {
  let context = null;
  let master = null;
  let drone = null;
  let droneGain = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return context;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    // The night drone: two detuned sines through a low filter, barely there.
    drone = context.createOscillator();
    const drone2 = context.createOscillator();
    drone.frequency.value = 55;
    drone2.frequency.value = 55.7;
    droneGain = context.createGain();
    droneGain.gain.value = 0.018;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    drone.connect(filter);
    drone2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    drone2.start();
    return context;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, pan, lowpass) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** A soft moth step; a warden's step is heavier, panned, and louder up close. */
    footstep(isGuard, pan, distance) {
      if (isGuard) {
        const vol = Math.max(0.02, 0.22 * (1 - distance / 520));
        noiseBurst(0.07, vol, pan, 320);
      } else {
        noiseBurst(0.05, 0.05, 0, 900);
      }
    },
    pebble() {
      noiseBurst(0.08, 0.3, 0, 2400);
      tone(1400, 0.09, 'sine', 0.12, 0.05, 700);
    },
    pickup() {
      tone(880, 0.14, 'sine', 0.16);
      tone(1318, 0.2, 'sine', 0.14, 0.09);
    },
    suspicious() {
      tone(520, 0.18, 'triangle', 0.14, 0, 660);
    },
    spotted() {
      tone(196, 0.5, 'sawtooth', 0.16, 0, 98);
      tone(392, 0.35, 'square', 0.1, 0.02, 523);
    },
    caught() {
      tone(220, 0.7, 'sawtooth', 0.18, 0, 55);
      tone(110, 0.9, 'sawtooth', 0.14, 0.1, 41);
    },
    levelClear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.15, i * 0.11));
    },
    win() {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.42, 'sine', 0.15, i * 0.13));
    },
    click() {
      tone(660, 0.06, 'sine', 0.1);
    },
    /** The drone tightens while any warden is alarmed. */
    setTension(heat) {
      if (!droneGain || !context || muted) return;
      droneGain.gain.setTargetAtTime(0.018 + heat * 0.05, context.currentTime, 0.4);
    },
  };
}
