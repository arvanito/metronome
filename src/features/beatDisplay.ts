import { cycleAccent } from '../core/rhythm';
import type { Accent } from '../core/types';
import { patchSettings } from '../state';
import { h } from '../ui/dom';
import type { Feature } from './feature';

const ACCENT_LABEL: Record<Accent, string> = { strong: 'accented', normal: 'normal', mute: 'muted' };

/** Row of beat lights. Clicking a beat cycles accented → normal → muted. */
export const beatDisplay: Feature = {
  id: 'beats',
  mount(root, { store, metronome }) {
    const row = h('div', { class: 'beats', role: 'group', 'aria-label': 'Beats' });
    root.append(row, h('p', { class: 'hint' }, 'Tap a beat to cycle: accented · normal · muted'));

    let dots: HTMLButtonElement[] = [];

    const render = () => {
      const { accents } = store.get().settings;
      if (dots.length !== accents.length) {
        dots = accents.map((_, i) =>
          h('button', {
            class: 'beat',
            type: 'button',
            onclick: () => {
              const current = store.get().settings.accents;
              patchSettings(store, { accents: current.map((a, j) => (j === i ? cycleAccent(a) : a)) });
            },
          }),
        );
        row.replaceChildren(...dots);
      }
      dots.forEach((dot, i) => {
        dot.dataset.accent = accents[i];
        dot.setAttribute('aria-label', `Beat ${i + 1}: ${ACCENT_LABEL[accents[i]]}`);
      });
    };

    const clearActive = () => dots.forEach((d) => d.classList.remove('is-active', 'is-sub'));

    render();
    store.subscribe((s, prev) => {
      if (s.settings.accents !== prev.settings.accents) render();
      if (!s.playing) clearActive();
    });

    metronome.on('beat', ({ beat, sub }) => {
      const dot = dots[beat];
      if (!dot) return;
      if (sub === 0) clearActive();
      // Restart the CSS animation on every tick.
      dot.classList.remove('is-active', 'is-sub');
      void dot.offsetWidth;
      dot.classList.add(sub === 0 ? 'is-active' : 'is-sub');
    });
  },
};
