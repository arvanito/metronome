import { sanitizeSettings } from '../core/settings';
import type { MetronomeSettings } from '../core/types';
import { patchSettings } from '../state';
import { h } from '../ui/dom';
import type { Feature } from './feature';

interface Preset {
  name: string;
  /** Everything except volume, which stays a device preference. */
  settings: Omit<MetronomeSettings, 'volume'>;
}

const STORAGE_KEY = 'metronome.presets.v1';

function loadPresets(): Preset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p) => typeof p?.name === 'string') : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage unavailable: presets last for this visit only.
  }
}

/** Save the current setup under a name, and load or delete saved setups. */
export const presets: Feature = {
  id: 'presets',
  mount(root, { store }) {
    let list = loadPresets();

    const name = h('input', { type: 'text', placeholder: 'e.g. Song A – verse', maxLength: 40, 'aria-label': 'Preset name' });
    const items = h('ul', { class: 'preset-list' });

    const save = (e: Event) => {
      e.preventDefault();
      const label = name.value.trim();
      if (!label) return name.focus();
      const { volume: _volume, ...settings } = store.get().settings;
      list = [...list.filter((p) => p.name !== label), { name: label, settings }];
      savePresets(list);
      name.value = '';
      render();
    };

    const render = () => {
      items.replaceChildren(
        ...list.map((preset) => {
          const s = preset.settings;
          return h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'preset-list__load',
                onclick: () => patchSettings(store, sanitizeSettings({ ...s, volume: store.get().settings.volume })),
              },
              h('strong', {}, preset.name),
              h('span', {}, `${s.bpm} BPM · ${s.beatsPerBar}/${s.beatUnit}`),
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'icon-btn',
                'aria-label': `Delete ${preset.name}`,
                onclick: () => {
                  list = list.filter((p) => p !== preset);
                  savePresets(list);
                  render();
                },
              },
              '×',
            ),
          );
        }),
      );
      if (list.length === 0) items.append(h('li', { class: 'hint' }, 'No presets yet.'));
    };

    root.append(
      h(
        'details',
        { class: 'panel' },
        h('summary', {}, 'Presets'),
        h('form', { class: 'preset-form', onsubmit: save }, name, h('button', { type: 'submit' }, 'Save current')),
        items,
      ),
    );
    render();
  },
};
