import type { Emitter } from '../core/emitter';
import type { MetronomeSettings, TickKind, TrainerSettings } from '../core/types';

/** A tick as seen by the UI: where it is in the bar and how it sounds. */
export interface TickInfo {
  bar: number;
  beat: number;
  sub: number;
  kind: TickKind;
}

export type EngineEvents = {
  /** Fired when a tick is actually heard (aligned with audio output), for visuals. */
  beat: TickInfo;
  /** Fired when a new bar starts; the payload is the number of bars completed. */
  bar: number;
  /** The engine changed the tempo itself (speed trainer); the payload is the new BPM. */
  tempo: number;
};

/**
 * What the UI needs from an audio engine. Implemented by the Web Audio engine
 * (metronome.ts) and by the bridge to the native JUCE engine (nativeEngine.ts).
 */
export interface Engine extends Pick<Emitter<EngineEvents>, 'on'> {
  /** Must be called from a user gesture the first time (browser autoplay rules). */
  start(): Promise<void>;
  stop(): void;
  /** Called whenever settings change; changes apply from the next tick. */
  update(settings: MetronomeSettings, trainer: TrainerSettings): void;
  /** Present only where the platform has an audio device dialog (the native app). */
  openAudioSettings?: () => void;
}
