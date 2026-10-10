import type { TickKind } from '../core/types';

export type VoiceKind = Exclude<TickKind, 'silent'>;

/**
 * A sound pack. `render` returns raw mono samples for one click; levels and the
 * fade-out are applied afterwards by `renderVoice`. Add a pack by appending to SOUNDS.
 */
export interface SoundDef {
  id: string;
  label: string;
  description?: string;
  render(kind: VoiceKind, sampleRate: number): Float32Array;
}

/** Peak level of each kind of tick relative to an accent. */
export const LEVELS: Record<VoiceKind, number> = { accent: 1, beat: 0.7, sub: 0.4 };

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------
// Synthesis helpers. The sounds keep most of their energy below ~3 kHz and avoid
// instant attacks, which is what makes metronome clicks sound harsh.

function synth(sampleRate: number, duration: number, fn: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.ceil(duration * sampleRate));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / sampleRate);
  return out;
}

/** Exponentially decaying sine: one resonance of a struck object (modal synthesis). */
function mode(t: number, freq: number, decay: number, amp = 1): number {
  return amp * Math.exp(-t / decay) * Math.sin(TAU * freq * t);
}

/** Struck object made of several resonances: [frequency ratio, amplitude, decay]. */
function modes(t: number, freq: number, partials: [number, number, number][]): number {
  let v = 0;
  for (const [ratio, amp, decay] of partials) v += mode(t, freq * ratio, decay, amp);
  return v;
}

/** Smooth (raised-cosine) fade-in over `time` seconds, so onsets don't snap. */
function fadeIn(t: number, time: number): number {
  return t >= time ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / time);
}

/** Sine whose pitch glides exponentially from `from` to `to` Hz (drum heads do this). */
function glide(t: number, from: number, to: number, glideTime: number): number {
  const phase = to * t + (from - to) * glideTime * (1 - Math.exp(-t / glideTime));
  return Math.sin(TAU * phase);
}

/** Deterministic white noise so every render is identical. */
function noise(sampleRate: number, duration: number, seed = 1): Float32Array {
  let s = seed;
  return synth(sampleRate, duration, () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  });
}

/** Two-pole low-pass (two cascaded one-pole filters), in place. */
function lowpass(buf: Float32Array, sampleRate: number, cutoff: number): Float32Array {
  const a = Math.exp((-TAU * cutoff) / sampleRate);
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    y1 = (1 - a) * buf[i] + a * y1;
    y2 = (1 - a) * y1 + a * y2;
    buf[i] = y2;
  }
  return buf;
}

/** Biquad band-pass (RBJ cookbook, 0 dB peak), in place. */
function bandpass(buf: Float32Array, sampleRate: number, freq: number, q: number): Float32Array {
  const w0 = (TAU * freq) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    buf[i] = y0;
  }
  return buf;
}

/** Multiplies a buffer by a decay envelope with a soft onset, in place. */
function envelope(buf: Float32Array, sampleRate: number, attack: number, decay: number): Float32Array {
  for (let i = 0; i < buf.length; i++) {
    const t = i / sampleRate;
    buf[i] *= fadeIn(t, attack) * Math.exp(-t / decay);
  }
  return buf;
}

/** Filtered noise burst: the "tick" of a stick or a mechanism. */
function tick(sampleRate: number, duration: number, freq: number, q: number, decay: number): Float32Array {
  return envelope(bandpass(noise(sampleRate, duration), sampleRate, freq, q), sampleRate, 0.0005, decay);
}

function mix(...layers: [Float32Array, number][]): Float32Array {
  const out = new Float32Array(Math.max(...layers.map(([b]) => b.length)));
  for (const [buf, gain] of layers) for (let i = 0; i < buf.length; i++) out[i] += buf[i] * gain;
  return out;
}

// ---------------------------------------------------------------------------

export const SOUNDS: SoundDef[] = [
  {
    id: 'woodblock',
    label: 'Wood block',
    description: 'Warm, hollow knock. Clear without being sharp.',
    render(kind, sr) {
      const f = { accent: 880, beat: 700, sub: 620 }[kind];
      const body = synth(sr, 0.12, (t) =>
        fadeIn(t, 0.001) * modes(t, f, [[1, 1, 0.03], [2.32, 0.3, 0.015], [3.9, 0.08, 0.008]]),
      );
      return lowpass(body, sr, 4000);
    },
  },
  {
    id: 'mechanical',
    label: 'Mechanical',
    description: 'Classic wind-up metronome: soft "tock" with a bell on the downbeat.',
    render(kind, sr) {
      const tock = mix(
        [tick(sr, 0.08, kind === 'sub' ? 1400 : 1700, 3, 0.004), 0.6],
        [synth(sr, 0.08, (t) => fadeIn(t, 0.0008) * (mode(t, 1250, 0.01) + mode(t, 380, 0.018, 0.6))), 1],
      );
      if (kind !== 'accent') return lowpass(tock, sr, 5000);
      const bell = synth(sr, 0.9, (t) =>
        fadeIn(t, 0.002) * modes(t, 988, [[1, 1, 0.25], [2, 0.4, 0.15], [3.01, 0.2, 0.08], [4.2, 0.08, 0.05]]),
      );
      return lowpass(mix([tock, 0.7], [bell, 0.8]), sr, 5000);
    },
  },
  {
    id: 'marimba',
    label: 'Marimba',
    description: 'Mellow pitched tone (A–E–A), pleasant for long sessions.',
    render(kind, sr) {
      const f = { accent: 880, beat: 659.25, sub: 440 }[kind];
      return synth(sr, 0.45, (t) => fadeIn(t, 0.002) * modes(t, f, [[1, 1, 0.12], [3.99, 0.18, 0.025], [10, 0.03, 0.006]]));
    },
  },
  {
    id: 'softbeep',
    label: 'Soft beep',
    description: 'Round electronic tone with a gentle onset.',
    render(kind, sr) {
      const f = { accent: 880, beat: 660, sub: 523.25 }[kind];
      return synth(sr, 0.18, (t) => fadeIn(t, 0.004) * (mode(t, f, 0.035) + mode(t, 2 * f, 0.02, 0.12)));
    },
  },
  {
    id: 'sidestick',
    label: 'Side stick',
    description: 'Drummer\'s rim click, muted and woody.',
    render(kind, sr) {
      const f = { accent: 1900, beat: 1600, sub: 1300 }[kind];
      return lowpass(
        mix(
          [tick(sr, 0.1, f, 1.5, 0.008), 0.8],
          [synth(sr, 0.1, (t) => fadeIn(t, 0.0008) * (mode(t, 480, 0.02) + mode(t, 1100, 0.012, 0.5))), 1],
        ),
        sr,
        5000,
      );
    },
  },
  {
    id: 'drums',
    label: 'Drums',
    description: 'Kick on the downbeat, low tom on beats, soft shaker on subdivisions.',
    render(kind, sr) {
      if (kind === 'sub') return lowpass(tick(sr, 0.08, 3500, 0.7, 0.018), sr, 7000);
      const [from, to, decay] = kind === 'accent' ? [140, 50, 0.2] : [210, 120, 0.12];
      const head = synth(sr, decay * 4, (t) => fadeIn(t, 0.001) * Math.exp(-t / decay) * glide(t, from, to, 0.03));
      return lowpass(mix([head, 1], [tick(sr, 0.02, 2000, 1, 0.002), 0.15]), sr, 4000);
    },
  },
  {
    id: 'softclick',
    label: 'Soft click',
    description: 'A classic click with the sharp edge taken off.',
    render(kind, sr) {
      const f = { accent: 1800, beat: 1500, sub: 1200 }[kind];
      return lowpass(
        mix([tick(sr, 0.05, f, 2, 0.003), 0.7], [synth(sr, 0.05, (t) => fadeIn(t, 0.0006) * mode(t, f, 0.006)), 0.6]),
        sr,
        4000,
      );
    },
  },
  {
    id: 'cowbell',
    label: 'Cowbell',
    description: 'Short, muted cowbell. Cuts through a band without the clang.',
    render(kind, sr) {
      const [f1, f2] = { accent: [560, 845], beat: [500, 755], sub: [440, 665] }[kind];
      return lowpass(
        synth(sr, 0.25, (t) => fadeIn(t, 0.001) * (mode(t, f1, 0.05) + mode(t, f2, 0.045) + mode(t, 2 * f2, 0.02, 0.2))),
        sr,
        3000,
      );
    },
  },
];

export function getSound(id: string): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
}

const FADE_OUT = 0.01;

/** Renders one click, scales its peak to the kind's level and fades out the tail. */
export function renderVoice(sound: SoundDef, kind: VoiceKind, sampleRate: number): Float32Array {
  const samples = sound.render(kind, sampleRate);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? LEVELS[kind] / peak : 0;
  const fadeStart = samples.length - Math.round(FADE_OUT * sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const fade = i < fadeStart ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeStart)) / (samples.length - fadeStart));
    samples[i] *= gain * fade;
  }
  return samples;
}
