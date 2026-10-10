import { MAX_BEATS, resizeAccents } from './rhythm';
import { MAX_BPM, MIN_BPM } from './tempo';
import type { Accent, BeatUnit, MetronomeSettings, Subdivision, TrainerSettings } from './types';
import { MAX_VOLUME } from './volume';

export const DEFAULT_SETTINGS: MetronomeSettings = {
  bpm: 100,
  beatsPerBar: 4,
  beatUnit: 4,
  accents: ['strong', 'normal', 'normal', 'normal'],
  subdivision: 1,
  sound: 'woodblock',
  volume: 1,
};

export const DEFAULT_TRAINER: TrainerSettings = {
  enabled: false,
  stepBpm: 5,
  everyBars: 4,
  targetBpm: 140,
};

const ACCENTS: readonly Accent[] = ['strong', 'normal', 'mute'];
const BEAT_UNITS: readonly BeatUnit[] = [2, 4, 8, 16];
const SUBDIVISIONS: readonly Subdivision[] = [1, 2, 3, 4];

function num(value: unknown, min: number, max: number, fallback: number, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return integer ? Math.round(clamped) : clamped;
}

function oneOf<T>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function record(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

/** Turns anything (saved JSON, a preset, a partial update) into valid settings. */
export function sanitizeSettings(input: unknown): MetronomeSettings {
  const raw = record(input);
  const d = DEFAULT_SETTINGS;
  const beatsPerBar = num(raw.beatsPerBar, 1, MAX_BEATS, d.beatsPerBar);
  const accents = Array.isArray(raw.accents)
    ? raw.accents.map((a) => oneOf(a, ACCENTS, 'normal'))
    : d.accents;
  return {
    bpm: num(raw.bpm, MIN_BPM, MAX_BPM, d.bpm),
    beatsPerBar,
    beatUnit: oneOf(raw.beatUnit, BEAT_UNITS, d.beatUnit),
    accents: resizeAccents(accents, beatsPerBar),
    subdivision: oneOf(raw.subdivision, SUBDIVISIONS, d.subdivision),
    sound: typeof raw.sound === 'string' ? raw.sound : d.sound,
    volume: num(raw.volume, 0, MAX_VOLUME, d.volume, false),
  };
}

export function sanitizeTrainer(input: unknown): TrainerSettings {
  const raw = record(input);
  const d = DEFAULT_TRAINER;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    stepBpm: num(raw.stepBpm, 1, 50, d.stepBpm),
    everyBars: num(raw.everyBars, 1, 64, d.everyBars),
    targetBpm: num(raw.targetBpm, MIN_BPM, MAX_BPM, d.targetBpm),
  };
}
