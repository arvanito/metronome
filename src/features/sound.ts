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
      max: 1,
      step: 0.01,
      oninput: () => patchSettings(store, { volume: Number(volume.value) }),
    });
    root.append(
      field('Sound', select),
      field('Volume', volume),
      h('p', { class: 'sound-link' }, h('a', { href: './audition.html' }, 'Compare all sounds →')),
    );

    const render = () => {
      const s = store.get().settings;
      // getSound falls back to the first pack if a saved id no longer exists.
      select.value = getSound(s.sound).id;
      volume.value = String(s.volume);
    };
    render();
    store.subscribe((s, prev) => s.settings !== prev.settings && render());
  },
};
