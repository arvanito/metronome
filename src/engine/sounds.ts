import type { TickKind } from '../core/types';

export type VoiceKind = Exclude<TickKind, 'silent'>;

/**
 * A sound pack. `render` returns raw mono samples for one click; levels are
 * normalised afterwards by `renderVoice`. Add a pack by appending to SOUNDS.
 */
export interface SoundDef {
  id: string;
  label: string;
  render(kind: VoiceKind, sampleRate: number): Float32Array;
}

/** Peak level of each kind of tick relative to an accent. */
export const LEVELS: Record<VoiceKind, number> = { accent: 1, beat: 0.7, sub: 0.4 };

const TAU = 2 * Math.PI;

function synth(sampleRate: number, duration: number, fn: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.ceil(duration * sampleRate));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / sampleRate);
  return out;
}

/** Linear attack, exponential decay. */
function env(t: number, attack: number, decay: number): number {
  return t < attack ? t / attack : Math.exp(-(t - attack) / decay);
}

/** Deterministic white noise so every render is identical. */
function noise(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

/** Band-limited square wave (odd harmonics below 8 kHz), to avoid aliasing. */
function square(f: number, t: number): number {
  let v = 0;
  for (let k = 1; k * f < 8000; k += 2) v += Math.sin(TAU * k * f * t) / k;
  return v;
}

export const SOUNDS: SoundDef[] = [
  {
    id: 'click',
    label: 'Click',
    render(kind, sr) {
      const f = { accent: 2500, beat: 1800, sub: 1400 }[kind];
      const rnd = noise();
      return synth(sr, 0.03, (t) => env(t, 0.0005, 0.006) * (0.7 * Math.sin(TAU * f * t) + 0.3 * rnd()));
    },
  },
  {
    id: 'beep',
    label: 'Beep',
    render(kind, sr) {
      const f = { accent: 1760, beat: 880, sub: 660 }[kind];
      return synth(sr, 0.08, (t) => env(t, 0.002, 0.02) * Math.sin(TAU * f * t));
    },
  },
  {
    id: 'wood',
    label: 'Wood block',
    render(kind, sr) {
      const f = { accent: 1200, beat: 880, sub: 700 }[kind];
      return synth(
        sr,
        0.06,
        (t) => env(t, 0.0005, 0.012) * (Math.sin(TAU * f * t) + 0.5 * Math.exp(-t / 0.005) * Math.sin(TAU * 2.76 * f * t)),
      );
    },
  },
  {
    id: 'cowbell',
    label: 'Cowbell',
    render(kind, sr) {
      const [f1, f2] = { accent: [587, 870], beat: [540, 800], sub: [470, 700] }[kind];
      return synth(sr, 0.25, (t) => env(t, 0.001, 0.06) * (square(f1, t) + square(f2, t)));
    },
  },
];

export function getSound(id: string): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
}

/** Renders one click and scales it so its peak equals the kind's level. */
export function renderVoice(sound: SoundDef, kind: VoiceKind, sampleRate: number): Float32Array {
  const samples = sound.render(kind, sampleRate);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? LEVELS[kind] / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}
