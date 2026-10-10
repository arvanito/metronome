import type { Engine } from './engine/engine';
import { Metronome } from './engine/metronome';
import { NativeEngine, juceBackend } from './engine/nativeEngine';
import type { AppContext, Feature } from './features/feature';
import { createStore, patchSettings, type AppStore } from './state';
import { h } from './ui/dom';

/** The native (JUCE) engine when running inside the desktop/Android app, Web Audio otherwise. */
function createEngine(): Engine {
  const backend = juceBackend();
  return backend ? new NativeEngine(backend) : new Metronome();
}

/** Keeps the audio engine in sync with the store, and the store with tempo changes from the engine. */
function connectEngine(store: AppStore, engine: Engine): void {
  engine.update(store.get().settings, store.get().trainer);
  store.subscribe((s, prev) => {
    if (s.settings !== prev.settings || s.trainer !== prev.trainer) engine.update(s.settings, s.trainer);
    if (s.playing !== prev.playing) {
      if (s.playing) {
        engine.start().catch((err) => {
          console.error('Could not start audio', err);
          store.set({ playing: false });
        });
      } else {
        engine.stop();
      }
    }
  });
  // The speed trainer runs inside the engine, so tempo steps land exactly on the bar line.
  engine.on('tempo', (bpm) => patchSettings(store, { bpm }));
}

export function createApp(root: HTMLElement, features: Feature[]): AppContext {
  const store = createStore();
  const metronome = createEngine();
  connectEngine(store, metronome);

  const ctx: AppContext = { store, metronome };
  for (const feature of features) {
    const section = h('section', { class: `feature feature--${feature.id}` });
    root.append(section);
    feature.mount(section, ctx);
  }
  return ctx;
}
