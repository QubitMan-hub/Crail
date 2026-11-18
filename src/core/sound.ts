/**
 * Sound effects and music, made in code: no audio files, nothing to license, nothing to
 * load. Every sound is a small Web Audio graph, so the same code plays live in the game
 * and renders offline (frame-exact) for video.
 *
 * Features ask for a sound with ctx.events.emit('sfx', { kind, ... }), and for the
 * fight music with ctx.events.emit('sfx:music', true / false).
 */

export type SfxKind =
  | 'punch' | 'heavy' | 'whoosh' | 'dash' | 'boom' | 'crack' | 'charge' | 'beam' | 'power' | 'swat'
  | 'splash' | 'land' | 'ink' | 'chime' | 'stinger' | 'slowmo' | 'rumble' | 'bars' | 'drone' | 'riser' | 'tick';

export interface SfxEvent {
  kind: SfxKind;
  /** Seconds, for sounds that last (a charge, a beam, a rumble). */
  dur?: number;
  /** Loudness, 1 is normal. */
  gain?: number;
  /** Pitch multiplier, 1 is normal. */
  pitch?: number;
  /** Left (-1) to right (1). */
  pan?: number;
}

interface Bus {
  ac: BaseAudioContext;
  /** Dry input. */
  dry: AudioNode;
  /** Reverb send. */
  wet: AudioNode;
  /** Music input (its own level). */
  music: GainNode;
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  let b = noises.get(ac);
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = b.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = s / 2147483648 - 1;
    }
    noises.set(ac, b);
  }
  return b;
}

/** A space for the sounds to ring in: a generated hall, about two seconds long. */
function impulse(ac: BaseAudioContext, seconds = 2.2): AudioBuffer {
  const len = Math.round(ac.sampleRate * seconds);
  const b = ac.createBuffer(2, len, ac.sampleRate);
  let s = 777;
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const k = i / len;
      d[i] = (s / 2147483648 - 1) * Math.pow(1 - k, 2.6) * (i < 200 ? i / 200 : 1);
    }
  }
  return b;
}

/** Master chain: everything into a compressor, with a hall reverb on the side. */
export function makeBus(ac: BaseAudioContext, out: AudioNode): Bus {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 8;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  const master = ac.createGain();
  master.gain.value = 0.85;
  comp.connect(master).connect(out);
  const dry = ac.createGain();
  dry.connect(comp);
  const verb = ac.createConvolver();
  verb.buffer = impulse(ac);
  const wet = ac.createGain();
  wet.gain.value = 0.32;
  wet.connect(verb).connect(comp);
  const music = ac.createGain();
  music.gain.value = 0.5;
  music.connect(comp);
  const musicVerb = ac.createGain();
  musicVerb.gain.value = 0.12;
  music.connect(musicVerb).connect(wet);
  return { ac, dry, wet, music };
}

// ---- Building blocks ---------------------------------------------------------------------
type Out = { node: AudioNode; send: number };

/** A gain envelope: attack to a peak, then an exponential fall to silence. */
function env(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function route(bus: Bus, node: AudioNode, pan: number, send: number) {
  const ac = bus.ac;
  let last: AudioNode = node;
  if (pan && 'createStereoPanner' in ac) {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    last = p;
  }
  last.connect(bus.dry);
  if (send > 0) {
    const s = ac.createGain();
    s.gain.value = send;
    last.connect(s).connect(bus.wet);
  }
}

function tone(bus: Bus, o: Out & { pan: number }, t: number, type: OscillatorType, f0: number, f1: number, slide: number, peak: number, attack: number, decay: number, detune = 0) {
  const ac = bus.ac;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + slide);
  const g = ac.createGain();
  env(g.gain, t, peak, attack, decay);
  osc.connect(g);
  route(bus, g, o.pan, o.send);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  return g;
}

function noise(bus: Bus, o: Out & { pan: number }, t: number, filter: BiquadFilterType, f0: number, f1: number, slide: number, q: number, peak: number, attack: number, decay: number) {
  const ac = bus.ac;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  const bq = ac.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + slide);
  const g = ac.createGain();
  env(g.gain, t, peak, attack, decay);
  src.connect(bq).connect(g);
  route(bus, g, o.pan, o.send);
  src.start(t, Math.random() * 1.5);
  src.stop(t + attack + decay + 0.05);
}

/** A swept band of noise: air moving past, fast. */
function sweep(bus: Bus, pan: number, t: number, dur: number, lo: number, hi: number, peak: number, send = 0.25) {
  const ac = bus.ac;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  const bq = ac.createBiquadFilter();
  bq.type = 'bandpass';
  bq.Q.value = 1.6;
  bq.frequency.setValueAtTime(lo, t);
  bq.frequency.exponentialRampToValueAtTime(hi, t + dur * 0.6);
  bq.frequency.exponentialRampToValueAtTime(lo * 1.4, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g);
  route(bus, g, pan, send);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

// ---- The sounds ----------------------------------------------------------------------------
export function playSfx(bus: Bus, e: SfxEvent, t: number): void {
  const g = e.gain ?? 1;
  const p = e.pitch ?? 1;
  const pan = e.pan ?? 0;
  const o = (send: number) => ({ node: bus.dry, send, pan });
  switch (e.kind) {
    case 'punch': {
      // A thump in the chest, a smack on top, a click at the very front.
      tone(bus, o(0.15), t, 'sine', 190 * p, 55 * p, 0.09, 0.9 * g, 0.002, 0.2);
      noise(bus, o(0.2), t, 'bandpass', 2000 * p, 900 * p, 0.06, 0.9, 0.75 * g, 0.001, 0.07);
      noise(bus, o(0), t, 'highpass', 4500, 4500, 0.01, 0.7, 0.35 * g, 0.0005, 0.014);
      break;
    }
    case 'heavy': {
      // A big hit: deeper, longer, with a crack and a tail in the hall.
      tone(bus, o(0.3), t, 'sine', 150 * p, 38 * p, 0.16, 1.0 * g, 0.002, 0.42);
      tone(bus, o(0.2), t, 'triangle', 320 * p, 90 * p, 0.08, 0.35 * g, 0.001, 0.16);
      noise(bus, o(0.35), t, 'bandpass', 1500 * p, 500 * p, 0.12, 0.7, 0.9 * g, 0.001, 0.16);
      noise(bus, o(0.1), t, 'highpass', 3000, 3000, 0.01, 0.7, 0.55 * g, 0.0005, 0.05);
      break;
    }
    case 'crack': {
      noise(bus, o(0.45), t, 'highpass', 1400, 2600, 0.05, 0.8, 1.0 * g, 0.0005, 0.16);
      tone(bus, o(0.2), t, 'square', 1800 * p, 300 * p, 0.05, 0.12 * g, 0.0005, 0.06);
      tone(bus, o(0.3), t, 'sine', 120 * p, 40 * p, 0.2, 0.7 * g, 0.002, 0.35);
      break;
    }
    case 'boom': {
      // Something enormous: a falling sub, a roar of low noise, and the hall.
      tone(bus, o(0.5), t, 'sine', 120 * p, 28 * p, 0.7, 1.1 * g, 0.003, 1.3);
      tone(bus, o(0.3), t, 'triangle', 70 * p, 30 * p, 0.5, 0.5 * g, 0.003, 0.9);
      noise(bus, o(0.6), t, 'lowpass', 900, 70, 0.9, 0.7, 0.9 * g, 0.004, 1.1);
      noise(bus, o(0.2), t, 'highpass', 2500, 2500, 0.01, 0.7, 0.4 * g, 0.001, 0.08);
      break;
    }
    case 'whoosh':
      sweep(bus, pan, t, e.dur ?? 0.45, 260 * p, 2400 * p, 0.6 * g);
      break;
    case 'dash':
      sweep(bus, pan, t, e.dur ?? 0.22, 700 * p, 5200 * p, 0.55 * g, 0.15);
      tone(bus, o(0.1), t, 'sine', 900 * p, 2400 * p, (e.dur ?? 0.22) * 0.8, 0.06 * g, 0.01, e.dur ?? 0.22);
      break;
    case 'swat':
      sweep(bus, pan, t, 0.26, 180 * p, 1100 * p, 0.55 * g, 0.2);
      tone(bus, o(0.25), t + 0.12, 'sine', 140 * p, 45 * p, 0.12, 0.9 * g, 0.002, 0.3);
      noise(bus, o(0.3), t + 0.12, 'lowpass', 2400, 600, 0.1, 0.8, 0.8 * g, 0.001, 0.14);
      break;
    case 'land':
      tone(bus, o(0.2), t, 'sine', 140 * p, 42 * p, 0.14, 0.85 * g, 0.002, 0.28);
      noise(bus, o(0.25), t, 'lowpass', 1400, 220, 0.2, 0.7, 0.6 * g, 0.002, 0.3);
      break;
    case 'splash': {
      noise(bus, o(0.3), t, 'bandpass', 1300, 320, 0.5, 0.9, 0.7 * g, 0.004, 0.55);
      noise(bus, o(0.2), t, 'highpass', 3000, 5000, 0.3, 0.7, 0.25 * g, 0.002, 0.35);
      for (let i = 0; i < 5; i++) {
        const f = (450 + ((i * 271) % 600)) * p;
        tone(bus, o(0.3), t + 0.04 + i * 0.05, 'sine', f, f * 1.9, 0.05, 0.12 * g, 0.002, 0.06);
      }
      break;
    }
    case 'ink':
      tone(bus, o(0.2), t, 'sine', 460 * p, 80 * p, 0.25, 0.6 * g, 0.004, 0.3);
      noise(bus, o(0.2), t, 'lowpass', 1100, 250, 0.25, 2, 0.5 * g, 0.004, 0.3);
      break;
    case 'chime': {
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => {
        tone(bus, o(0.6), t + i * 0.07, 'sine', f * p, f * p, 0.01, 0.16 * g, 0.004, 1.4);
        tone(bus, o(0.6), t + i * 0.07, 'triangle', f * 2 * p, f * 2 * p, 0.01, 0.03 * g, 0.004, 0.6);
      });
      break;
    }
    case 'charge': {
      // Energy gathering: a buzz and a whine climbing together, faster and faster.
      const d = e.dur ?? 1.3;
      const ac = bus.ac;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.32 * g, t + d);
      out.gain.linearRampToValueAtTime(0.0001, t + d + 0.04);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 7;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(4200, t + d);
      lp.connect(out);
      for (const det of [-8, 8]) {
        const s = ac.createOscillator();
        s.type = 'sawtooth';
        s.detune.value = det;
        s.frequency.setValueAtTime(80 * p, t);
        s.frequency.exponentialRampToValueAtTime(520 * p, t + d);
        s.connect(lp);
        s.start(t);
        s.stop(t + d + 0.06);
      }
      const whine = ac.createOscillator();
      whine.frequency.setValueAtTime(400 * p, t);
      whine.frequency.exponentialRampToValueAtTime(2600 * p, t + d);
      const trem = ac.createGain();
      trem.gain.value = 0.5;
      const lfo = ac.createOscillator();
      lfo.frequency.setValueAtTime(6, t);
      lfo.frequency.linearRampToValueAtTime(22, t + d);
      const depth = ac.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(trem.gain);
      const wg = ac.createGain();
      wg.gain.value = 0.25;
      whine.connect(trem).connect(wg).connect(out);
      for (const n of [whine, lfo]) {
        n.start(t);
        n.stop(t + d + 0.06);
      }
      route(bus, out, pan, 0.3);
      break;
    }
    case 'beam': {
      // The beam itself: a fat, wobbling buzz with a hiss of energy on top.
      const d = e.dur ?? 0.8;
      const ac = bus.ac;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.42 * g, t + 0.03);
      out.gain.setValueAtTime(0.42 * g, t + d);
      out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.value = 2200;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 11;
      const depth = ac.createGain();
      depth.gain.value = 900;
      lfo.connect(depth).connect(lp.frequency);
      lp.connect(out);
      const parts: [OscillatorType, number][] = [['sawtooth', 82], ['sawtooth', 83.6], ['square', 164], ['sawtooth', 41]];
      const oscs = parts.map(([type, f]) => {
        const s = ac.createOscillator();
        s.type = type;
        s.frequency.value = f * p;
        s.connect(lp);
        return s;
      });
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      src.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800;
      bp.Q.value = 0.7;
      const ng = ac.createGain();
      ng.gain.value = 0.5;
      src.connect(bp).connect(ng).connect(out);
      for (const n of [...oscs, lfo, src]) {
        n.start(t);
        n.stop(t + d + 0.3);
      }
      route(bus, out, pan, 0.35);
      break;
    }
    case 'power': {
      // Powering up: a drone that rises and opens up, with wind building underneath.
      const d = e.dur ?? 2.4;
      const ac = bus.ac;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.4 * g, t + d);
      out.gain.linearRampToValueAtTime(0.0001, t + d + 0.08);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 5;
      lp.frequency.setValueAtTime(160, t);
      lp.frequency.exponentialRampToValueAtTime(3000, t + d);
      lp.connect(out);
      for (const [f, det] of [[55, -10], [55, 10], [110, 0], [82.4, 5]] as const) {
        const s = ac.createOscillator();
        s.type = 'sawtooth';
        s.detune.value = det;
        s.frequency.setValueAtTime(f * p, t);
        s.frequency.exponentialRampToValueAtTime(f * 1.5 * p, t + d);
        s.connect(lp);
        s.start(t);
        s.stop(t + d + 0.1);
      }
      route(bus, out, pan, 0.3);
      sweep(bus, pan, t, d, 200, 3000, 0.3 * g, 0.4);
      break;
    }
    case 'rumble':
      noise(bus, o(0.2), t, 'lowpass', 110, 80, e.dur ?? 2, 1, 0.55 * g, (e.dur ?? 2) * 0.5, (e.dur ?? 2) * 0.6);
      tone(bus, o(0.1), t, 'sine', 38, 34, e.dur ?? 2, 0.35 * g, (e.dur ?? 2) * 0.5, (e.dur ?? 2) * 0.6);
      break;
    case 'stinger': {
      // The film "braam": a reversed swell, then a huge low brass chord that slowly closes.
      sweep(bus, pan, t, 0.5, 300, 6000, 0.35 * g, 0.4);
      const at = t + 0.45;
      const ac = bus.ac;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, at);
      out.gain.linearRampToValueAtTime(0.5 * g, at + 0.06);
      out.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(180, at);
      lp.frequency.exponentialRampToValueAtTime(1600, at + 0.22);
      lp.frequency.exponentialRampToValueAtTime(260, at + 2.8);
      lp.connect(out);
      for (const [f, det] of [[36.7, 0], [36.7, 12], [55, -8], [73.4, 6], [73.4, -6], [110, 4]] as const) {
        const s = ac.createOscillator();
        s.type = 'sawtooth';
        s.detune.value = det;
        s.frequency.value = f * p;
        s.connect(lp);
        s.start(at);
        s.stop(at + 3.3);
      }
      route(bus, out, pan, 0.55);
      tone(bus, o(0.5), at, 'sine', 70, 30, 0.6, 0.9 * g, 0.004, 1.6);
      break;
    }
    case 'slowmo':
      // Time bending: a low "whoom" falling away.
      tone(bus, o(0.5), t, 'sine', 320 * p, 60 * p, 0.7, 0.3 * g, 0.02, 0.8);
      noise(bus, o(0.5), t, 'lowpass', 1800, 160, 0.8, 1.5, 0.4 * g, 0.02, 0.8);
      break;
    case 'bars':
      sweep(bus, pan, t, 0.7, 120, 700, 0.3 * g, 0.4);
      break;
    case 'drone': {
      const d = e.dur ?? 4;
      const ac = bus.ac;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.22 * g, t + Math.min(1.5, d * 0.4));
      out.gain.setValueAtTime(0.22 * g, t + d - 0.6);
      out.gain.linearRampToValueAtTime(0.0001, t + d);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, t);
      lp.frequency.linearRampToValueAtTime(700, t + d);
      lp.connect(out);
      for (const [f, det] of [[36.7, -6], [36.7, 6], [55, 0], [43.65, 3]] as const) {
        const s = ac.createOscillator();
        s.type = 'sawtooth';
        s.detune.value = det;
        s.frequency.value = f * p;
        s.connect(lp);
        s.start(t);
        s.stop(t + d + 0.05);
      }
      route(bus, out, pan, 0.5);
      break;
    }
    case 'riser': {
      const d = e.dur ?? 1.5;
      sweep(bus, pan, t, d, 200, 7000, 0.4 * g, 0.4);
      tone(bus, o(0.4), t, 'sawtooth', 110 * p, 880 * p, d, 0.08 * g, d * 0.9, 0.12);
      break;
    }
    case 'tick':
      tone(bus, o(0.1), t, 'square', 1500 * p, 1400 * p, 0.02, 0.08 * g, 0.001, 0.04);
      break;
  }
}

// ---- Battle music ----------------------------------------------------------------------------
/**
 * A driving fight cue in D minor at 150 bpm: kick and snare, hats, a pulsing bass, brass
 * stabs on the changes, a quick string ostinato, and taiko fills every fourth bar.
 * `bar` counts from the start of the cue (the first two bars build up).
 */
export const BAR = 1.6;
const EIGHTH = BAR / 8;
const CHORDS = [
  [73.42, [293.66, 349.23, 440.0]], // Dm
  [73.42, [293.66, 349.23, 440.0]], // Dm
  [58.27, [233.08, 293.66, 349.23]], // Bb
  [65.41, [261.63, 329.63, 392.0]], // C
] as const;

export function scoreBar(bus: Bus, t: number, bar: number, level = 1): void {
  const ac = bus.ac;
  const m = (node: AudioNode) => node.connect(bus.music);
  const o = { node: bus.music, send: 0, pan: 0 };
  const hit = (when: number, f0: number, f1: number, slide: number, peak: number, decay: number, type: OscillatorType = 'sine') => {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, when);
    osc.frequency.exponentialRampToValueAtTime(f1, when + slide);
    const g = ac.createGain();
    env(g.gain, when, peak * level, 0.002, decay);
    osc.connect(g);
    m(g);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  };
  const hiss = (when: number, f: number, type: BiquadFilterType, peak: number, decay: number, q = 0.8) => {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const bq = ac.createBiquadFilter();
    bq.type = type;
    bq.frequency.value = f;
    bq.Q.value = q;
    const g = ac.createGain();
    env(g.gain, when, peak * level, 0.001, decay);
    src.connect(bq).connect(g);
    m(g);
    src.start(when, (bar * 0.37 + when) % 1.5);
    src.stop(when + decay + 0.05);
  };
  void o;
  const [root, triad] = CHORDS[bar % 4];
  const build = bar < 2;
  for (let i = 0; i < 8; i++) {
    const at = t + i * EIGHTH;
    // Drums.
    if (i === 0 || i === 3 || i === 4 || (i === 7 && bar % 2 === 1)) hit(at, 150, 42, 0.08, 0.9, 0.3);
    if (!build && (i === 2 || i === 6)) {
      hiss(at, 1900, 'bandpass', 0.55, 0.16, 0.7);
      hit(at, 230, 160, 0.05, 0.3, 0.1, 'triangle');
    }
    hiss(at, 8000, 'highpass', i % 2 ? 0.16 : 0.08, i % 2 ? 0.05 : 0.025);
    // Bass: eighths on the root, jumping the octave.
    if (!build || bar === 1) {
      const f = root * (i === 3 || i === 7 ? 2 : 1);
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 5;
      lp.frequency.setValueAtTime(900, at);
      lp.frequency.exponentialRampToValueAtTime(180, at + 0.16);
      const g = ac.createGain();
      env(g.gain, at, 0.28 * level, 0.004, 0.17);
      osc.connect(lp).connect(g);
      m(g);
      osc.start(at);
      osc.stop(at + 0.22);
    }
    // Strings: a quick ostinato on the chord, sixteenths, quiet.
    if (!build) {
      for (const half of [0, 1]) {
        const when = at + half * (EIGHTH / 2);
        const f = triad[(i * 2 + half) % 3] * 2;
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = ac.createGain();
        env(g.gain, when, 0.045 * level, 0.004, 0.09);
        osc.connect(g);
        m(g);
        osc.start(when);
        osc.stop(when + 0.12);
      }
    }
  }
  // Brass stab on the downbeat.
  if (!build || bar === 1) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2200, t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.9);
    const g = ac.createGain();
    env(g.gain, t, 0.13 * level, 0.02, 1.0);
    lp.connect(g);
    m(g);
    for (const f of [triad[0] / 2, triad[1] / 2, triad[2] / 2, root * 2]) {
      for (const det of [-7, 7]) {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = det;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + 1.1);
      }
    }
  }
  // Taiko fill to round off every fourth bar.
  if (bar % 4 === 3) {
    [110, 98, 82, 65].forEach((f, k) => hit(t + (4 + k) * EIGHTH, f, f * 0.6, 0.12, 0.75, 0.4));
  }
}

/** The end of the cue: one last hit and a cymbal that rings out. */
export function scoreEnd(bus: Bus, t: number): void {
  playSfx(bus, { kind: 'boom', gain: 0.6 }, t);
  const ac = bus.ac;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  const bq = ac.createBiquadFilter();
  bq.type = 'highpass';
  bq.frequency.value = 5000;
  const g = ac.createGain();
  env(g.gain, t, 0.2, 0.004, 2.2);
  src.connect(bq).connect(g).connect(bus.music);
  src.start(t);
  src.stop(t + 2.3);
}

// ---- Live, in the game ------------------------------------------------------------------------
export class Sound {
  private ac: AudioContext | null = null;
  private bus: Bus | null = null;
  enabled = true;
  private musicOn = false;
  private nextBar = 0;
  private bar = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Call from a user gesture; browsers refuse audio before one. */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.bus = makeBus(this.ac, this.ac.destination);
  }

  private ready(): boolean {
    return !!this.ac && !!this.bus && this.enabled && this.ac.state === 'running';
  }

  play(e: SfxEvent): void {
    if (!this.ready()) return;
    playSfx(this.bus!, e, this.ac!.currentTime + 0.005);
  }

  /** Fight music on or off. It keeps to the beat, a little ahead of time. */
  music(on: boolean): void {
    if (on === this.musicOn) return;
    this.musicOn = on;
    if (on) {
      if (!this.ready()) {
        this.musicOn = false;
        return;
      }
      this.bar = 0;
      this.nextBar = this.ac!.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 200);
      this.schedule();
    } else {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.ready()) scoreEnd(this.bus!, Math.max(this.nextBar, this.ac!.currentTime + 0.05));
    }
  }

  private schedule(): void {
    if (!this.ready() || !this.musicOn) return;
    while (this.nextBar < this.ac!.currentTime + 0.6) {
      scoreBar(this.bus!, this.nextBar, this.bar++);
      this.nextBar += BAR;
    }
  }
}

// ---- Offline, for video -----------------------------------------------------------------------
/**
 * Render a list of timed sounds (and the fight music between start and stop times) to
 * stereo samples, exactly as they would sound live. Used to put the game's sound into
 * a Reel frame-for-frame.
 */
export async function renderOffline(
  events: [number, SfxEvent][],
  music: [number, number][],
  seconds: number,
  rate = 48000,
): Promise<[Float32Array, Float32Array]> {
  const ac = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const bus = makeBus(ac, ac.destination);
  for (const [from, to] of music) {
    let bar = 0;
    let t = from;
    for (; t < to - 0.05; t += BAR) scoreBar(bus, t, bar++);
    scoreEnd(bus, t);
  }
  for (const [t, e] of events) playSfx(bus, e, Math.max(0, t));
  const buf = await ac.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
