import type { Metronome } from '../engine/metronome';
import type { AppStore } from '../state';

/** Everything a feature may use. Features never talk to each other directly. */
export interface AppContext {
  store: AppStore;
  metronome: Metronome;
}

/**
 * A self-contained piece of the app. Each feature gets its own <section> to render
 * into and wires itself to the store and the metronome's events.
 */
export interface Feature {
  id: string;
  mount(root: HTMLElement, ctx: AppContext): void;
}
