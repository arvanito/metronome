/** Pitch detection and note naming for the tuner. Pure functions, no audio APIs. */

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

export const DEFAULT_A4 = 440;
export const MIN_A4 = 415;
export const MAX_A4 = 466;

export interface PitchOptions {
  /** Lowest frequency to look for, in Hz. Bounds the work per frame. */
  minHz?: number;
  maxHz?: number;
  /** YIN threshold: lower is stricter about what counts as a clear pitch. */
  threshold?: number;
  /** RMS below this is treated as silence. */
  minRms?: number;
}

export interface Pitch {
  hz: number;
  /** 0..1, how periodic the signal is (1 = a perfect tone). */
  clarity: number;
}

/**
 * Finds the fundamental frequency with the YIN algorithm (de Cheveigné & Kawahara, 2002).
 * Unlike picking the loudest FFT bin, it does not lock onto a harmonic, which matters
 * for low guitar strings whose second harmonic is often louder than the fundamental.
 * Returns null for silence or noise.
 */
export function detectPitch(samples: Float32Array, sampleRate: number, options: PitchOptions = {}): Pitch | null {
  const { minHz = 60, maxHz = 1500, threshold = 0.15, minRms = 0.01 } = options;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  if (Math.sqrt(sumSquares / samples.length) < minRms) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(Math.floor(samples.length / 2), Math.ceil(sampleRate / minHz));
  const window = samples.length - tauMax;
  if (tauMax <= tauMin) return null;

  // Cumulative mean normalised difference function.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let diff = 0;
    for (let j = 0; j < window; j++) {
      const delta = samples[j] - samples[j + tau];
      diff += delta * delta;
    }
    runningSum += diff;
    cmnd[tau] = runningSum > 0 ? (diff * tau) / runningSum : 1;
  }

  // The first dip under the threshold, followed down to its lowest point.
  let tau = tauMin;
  while (tau < tauMax && cmnd[tau] >= threshold) tau++;
  if (tau >= tauMax) return null;
  while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;

  return { hz: sampleRate / refineMinimum(cmnd, tau), clarity: Math.max(0, 1 - cmnd[tau]) };
}

/** Parabolic interpolation around a minimum, for sub-sample accuracy. */
function refineMinimum(values: Float32Array, i: number): number {
  if (i <= 0 || i >= values.length - 1) return i;
  const [a, b, c] = [values[i - 1], values[i], values[i + 1]];
  const denom = a - 2 * b + c;
  return denom === 0 ? i : i + (a - c) / (2 * denom);
}

export interface Note {
  /** MIDI note number of the nearest note (69 = A4). */
  midi: number;
  name: (typeof NOTE_NAMES)[number];
  octave: number;
  /** How far off the nearest note, -50..+50. Positive is sharp. */
  cents: number;
}

export function midiToHz(midi: number, a4 = DEFAULT_A4): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function noteFromHz(hz: number, a4 = DEFAULT_A4): Note {
  const exact = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(exact);
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: (exact - midi) * 100,
  };
}

/** Median of the values, used to reject one-frame octave jumps. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
