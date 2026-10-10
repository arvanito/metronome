import { TapTempo } from '../core/tapTempo';
import { patchSettings } from '../state';
import { h, onKey } from '../ui/dom';
import type { Feature } from './feature';

/** Tap button (and the T key) that sets the tempo from the rhythm you tap. */
export const tapTempo: Feature = {
  id: 'tap',
  mount(root, { store }) {
    const tapper = new TapTempo();
    const tap = () => {
      const bpm = tapper.tap(performance.now());
      if (bpm !== null) patchSettings(store, { bpm });
      button.classList.remove('is-tapped');
      void button.offsetWidth;
      button.classList.add('is-tapped');
    };
    const button = h(
      'button',
      { class: 'tap-btn', type: 'button', title: 'Tap tempo (T)', onpointerdown: tap },
      'Tap',
    );
    // Keyboard activation of the button itself.
    button.addEventListener('click', (e) => e.detail === 0 && tap());
    root.append(button);
    onKey(['t', 'T'], tap);
  },
};
