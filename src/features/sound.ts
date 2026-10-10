import { MAX_VOLUME } from '../core/volume';
import { SOUNDS, getSound } from '../engine/sounds';
import { patchSettings } from '../state';
import { field, h } from '../ui/dom';
import type { Feature } from './feature';

/** Sound pack picker and volume. */
export const sound: Feature = {
  id: 'sound',
  mount(root, { store }) {
    const select = h(
      'select',
      { onchange: () => patchSettings(store, { sound: select.value }) },
      ...SOUNDS.map((s) => h('option', { value: s.id }, s.label)),
    );
    const volume = h('input', {
      type: 'range',
      min: 0,
      max: MAX_VOLUME,
      step: 0.01,
      list: 'volume-marks',
      'aria-label': 'Volume',
      oninput: () => patchSettings(store, { volume: Number(volume.value) }),
    });
    // Tick mark at 100%, where the boost range starts.
    const marks = h('datalist', { id: 'volume-marks' }, h('option', { value: 1 }));
    const volumeLabel = h('span', { class: 'field__label' });
    root.append(
      field('Sound', select),
      h('label', { class: 'field' }, volumeLabel, volume, marks),
      h('p', { class: 'sound-link' }, h('a', { href: './audition.html' }, 'Compare all sounds →')),
    );

    const render = () => {
      const s = store.get().settings;
      // getSound falls back to the first pack if a saved id no longer exists.
      select.value = getSound(s.sound).id;
      volume.value = String(s.volume);
      const percent = Math.round(s.volume * 100);
      volumeLabel.textContent = percent > 100 ? `Volume ${percent}% · boost` : `Volume ${percent}%`;
      volume.classList.toggle('is-boost', percent > 100);
    };
    render();
    store.subscribe((s, prev) => s.settings !== prev.settings && render());
  },
};
