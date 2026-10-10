import type { Accent, TickKind } from './types';

export const MAX_BEATS = 16;

/** Position of a tick: bar count since start, beat within the bar, subdivision within the beat. */
export interface Position {
  bar: number;
  beat: number;
  sub: number;
}

export function cycleAccent(accent: Accent): Accent {
  return accent === 'strong' ? 'normal' : accent === 'normal' ? 'mute' : 'strong';
}

/** Grows or shrinks the accent list to `beats`, keeping existing choices. */
export function resizeAccents(accents: readonly Accent[], beats: number): Accent[] {
  return Array.from({ length: beats }, (_, i) => accents[i] ?? (i === 0 ? 'strong' : 'normal'));
}

export function tickKind(accents: readonly Accent[], beat: number, sub: number): TickKind {
  if (sub > 0) return 'sub';
  switch (accents[beat] ?? 'normal') {
    case 'strong':
      return 'accent';
    case 'normal':
      return 'beat';
    case 'mute':
      return 'silent';
  }
}

export function secondsPerTick(bpm: number, subdivision: number): number {
  return 60 / bpm / subdivision;
}

/**
 * Moves to the next tick. Uses `>=` so that shrinking the bar or the subdivision
 * mid-bar wraps cleanly instead of running past the end.
 */
export function advance(pos: Position, beatsPerBar: number, subdivision: number): Position {
  let { bar, beat, sub } = pos;
  sub++;
  if (sub >= subdivision) {
    sub = 0;
    beat++;
    if (beat >= beatsPerBar) {
      beat = 0;
      bar++;
    }
  }
  return { bar, beat, sub };
}
