import { Metronome } from './engine/metronome';
import type { AppContext, Feature } from './features/feature';
import { createStore, type AppStore } from './state';
import { h } from './ui/dom';

/** Keeps the audio engine in sync with the store. */
function connectEngine(store: AppStore, metronome: Metronome): void {
  store.subscribe((s, prev) => {
    if (s.playing !== prev.playing) {
      if (s.playing) {
        metronome.start().catch((err) => {
          console.error('Could not start audio', err);
          store.set({ playing: false });
        });
      } else {
        metronome.stop();
      }
    }
    if (s.settings.volume !== prev.settings.volume) metronome.setVolume(s.settings.volume);
    if (s.settings.sound !== prev.settings.sound) metronome.setSound(s.settings.sound);
  });
}

export function createApp(root: HTMLElement, features: Feature[]): AppContext {
  const store = createStore();
  const metronome = new Metronome(() => store.get().settings);
  connectEngine(store, metronome);

  const ctx: AppContext = { store, metronome };
  for (const feature of features) {
    const section = h('section', { class: `feature feature--${feature.id}` });
    root.append(section);
    feature.mount(section, ctx);
  }
  return ctx;
}
