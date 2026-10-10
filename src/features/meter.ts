import { MAX_BEATS } from '../core/rhythm';
import type { BeatUnit, Subdivision } from '../core/types';
import { patchSettings } from '../state';
import { field, h } from '../ui/dom';
import type { Feature } from './feature';

const BEAT_UNITS: BeatUnit[] = [2, 4, 8, 16];
const SUBDIVISIONS: [Subdivision, string][] = [
  [1, 'Off'],
  [2, '8ths'],
  [3, 'Triplets'],
  [4, '16ths'],
];

/** Time signature and subdivision controls. */
export const meter: Feature = {
  id: 'meter',
  mount(root, { store }) {
    const options = (values: number[]) => values.map((v) => h('option', { value: v }, String(v)));
    const beats = h(
      'select',
      {
        'aria-label': 'Beats per bar',
        onchange: () => patchSettings(store, { beatsPerBar: Number(beats.value) }),
      },
      ...options(Array.from({ length: MAX_BEATS }, (_, i) => i + 1)),
    );
    const unit = h(
      'select',
      {
        'aria-label': 'Beat unit',
        onchange: () => patchSettings(store, { beatUnit: Number(unit.value) as BeatUnit }),
      },
      ...options(BEAT_UNITS),
    );

    const subButtons = SUBDIVISIONS.map(([value, label]) =>
      h(
        'button',
        { type: 'button', class: 'seg__btn', onclick: () => patchSettings(store, { subdivision: value }) },
        label,
      ),
    );

    root.append(
      field('Time signature', h('div', { class: 'timesig' }, beats, h('span', {}, '/'), unit)),
      field('Subdivision', h('div', { class: 'seg', role: 'group' }, ...subButtons)),
    );

    const render = () => {
      const { beatsPerBar, beatUnit, subdivision } = store.get().settings;
      beats.value = String(beatsPerBar);
      unit.value = String(beatUnit);
      subButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(SUBDIVISIONS[i][0] === subdivision)));
    };
    render();
    store.subscribe((s, prev) => s.settings !== prev.settings && render());
  },
};
