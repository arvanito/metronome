import { MAX_BPM, MIN_BPM, tempoMarking } from '../core/tempo';
import { patchSettings } from '../state';
import { h, onKey } from '../ui/dom';
import type { Feature } from './feature';

/** BPM readout (editable), −/+ buttons with press-and-hold, slider and arrow keys. */
export const tempo: Feature = {
  id: 'tempo',
  mount(root, { store }) {
    const setBpm = (bpm: number) => patchSettings(store, { bpm });
    const nudge = (delta: number) => setBpm(store.get().settings.bpm + delta);

    const input = h('input', {
      class: 'bpm__value',
      type: 'number',
      inputMode: 'numeric',
      min: MIN_BPM,
      max: MAX_BPM,
      'aria-label': 'Tempo in beats per minute',
      onchange: () => setBpm(Number(input.value)),
      onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && input.blur(),
    });
    const marking = h('span', { class: 'bpm__marking' });
    const slider = h('input', {
      class: 'bpm__slider',
      type: 'range',
      min: MIN_BPM,
      max: MAX_BPM,
      'aria-label': 'Tempo',
      oninput: () => setBpm(Number(slider.value)),
    });

    root.append(
      h(
        'div',
        { class: 'bpm' },
        holdButton('−', 'Slower', () => nudge(-1)),
        h('div', { class: 'bpm__readout' }, input, h('span', { class: 'bpm__unit' }, 'BPM'), marking),
        holdButton('+', 'Faster', () => nudge(1)),
      ),
      slider,
    );

    const render = () => {
      const { bpm } = store.get().settings;
      if (document.activeElement !== input) input.value = String(bpm);
      slider.value = String(bpm);
      marking.textContent = tempoMarking(bpm);
    };
    render();
    store.subscribe((s, prev) => s.settings.bpm !== prev.settings.bpm && render());

    onKey(['ArrowUp', 'ArrowRight'], (e) => nudge(e.shiftKey ? 5 : 1));
    onKey(['ArrowDown', 'ArrowLeft'], (e) => nudge(e.shiftKey ? -5 : -1));
  },
};

/** Button that repeats its action while held down, speeding up after a short delay. */
function holdButton(text: string, label: string, action: () => void): HTMLButtonElement {
  let delay: ReturnType<typeof setTimeout> | undefined;
  let repeat: ReturnType<typeof setInterval> | undefined;
  const release = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  return h(
    'button',
    {
      class: 'round-btn',
      type: 'button',
      'aria-label': label,
      onpointerdown: (e: PointerEvent) => {
        e.preventDefault();
        action();
        delay = setTimeout(() => (repeat = setInterval(action, 60)), 400);
      },
      onpointerup: release,
      onpointerleave: release,
      onpointercancel: release,
      // Keyboard activation (pointer clicks are handled by pointerdown).
      onclick: (e: MouseEvent) => e.detail === 0 && action(),
    },
    text,
  );
}
