import { DEFAULT_SETTINGS, DEFAULT_TRAINER, sanitizeSettings, sanitizeTrainer } from './core/settings';
import { Store } from './core/store';
import type { MetronomeSettings, TrainerSettings } from './core/types';

export interface AppState {
  settings: MetronomeSettings;
  trainer: TrainerSettings;
  playing: boolean;
}

export type AppStore = Store<AppState>;

const STORAGE_KEY = 'metronome.state.v1';

function load(): Pick<AppState, 'settings' | 'trainer'> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved) return { settings: sanitizeSettings(saved.settings), trainer: sanitizeTrainer(saved.trainer) };
  } catch {
    // Storage blocked or corrupt: fall back to defaults.
  }
  return { settings: DEFAULT_SETTINGS, trainer: DEFAULT_TRAINER };
}

/** Creates the app store and remembers settings between visits. */
export function createStore(): AppStore {
  const store = new Store<AppState>({ ...load(), playing: false });
  let pending: ReturnType<typeof setTimeout> | undefined;
  store.subscribe(({ settings, trainer }, prev) => {
    if (settings === prev.settings && trainer === prev.trainer) return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, trainer }));
      } catch {
        // Not critical.
      }
    }, 300);
  });
  return store;
}

export function patchSettings(store: AppStore, patch: Partial<MetronomeSettings>): void {
  store.set((s) => ({ settings: sanitizeSettings({ ...s.settings, ...patch }) }));
}

export function patchTrainer(store: AppStore, patch: Partial<TrainerSettings>): void {
  store.set((s) => ({ trainer: sanitizeTrainer({ ...s.trainer, ...patch }) }));
}
