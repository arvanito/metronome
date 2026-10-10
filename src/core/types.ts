/** How a beat is played: accented, normal, or silent. */
export type Accent = 'strong' | 'normal' | 'mute';

/** Number of clicks per beat (1 = beats only, 2 = eighths, 3 = triplets, 4 = sixteenths). */
export type Subdivision = 1 | 2 | 3 | 4;

/** Bottom number of the time signature. Display only: BPM always counts this note value. */
export type BeatUnit = 2 | 4 | 8 | 16;

/** What a single scheduled tick sounds like. */
export type TickKind = 'accent' | 'beat' | 'sub' | 'silent';

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  beatUnit: BeatUnit;
  /** One entry per beat in the bar. */
  accents: Accent[];
  subdivision: Subdivision;
  /** Id of a sound in engine/sounds.ts. */
  sound: string;
  /** 0..2: 1 is full clean level, above 1 is boost (see core/volume.ts). */
  volume: number;
}

export interface TrainerSettings {
  enabled: boolean;
  /** BPM added (or removed, if the target is lower) at each step. */
  stepBpm: number;
  /** Bars played between steps. */
  everyBars: number;
  /** Tempo at which the trainer stops changing the BPM. */
  targetBpm: number;
}
