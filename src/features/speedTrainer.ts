import { shouldStep, trainerStep } from '../core/speedTrainer';
import { MAX_BPM, MIN_BPM } from '../core/tempo';
import type { TrainerSettings } from '../core/types';
import { patchSettings, patchTrainer } from '../state';
import { field, h } from '../ui/dom';
import type { Feature } from './feature';

/** Gradually changes the tempo: ±N BPM every M bars until a target tempo. */
export const speedTrainer: Feature = {
  id: 'trainer',
  mount(root, { store, metronome }) {
    const numberInput = (key: 'stepBpm' | 'everyBars' | 'targetBpm', min: number, max: number) => {
      const input = h('input', {
        type: 'number',
        inputMode: 'numeric',
        min,
        max,
        onchange: () => patchTrainer(store, { [key]: Number(input.value) } as Partial<TrainerSettings>),
      });
      return input;
    };
    const enabled = h('input', {
      type: 'checkbox',
      onchange: () => patchTrainer(store, { enabled: enabled.checked }),
    });
    const step = numberInput('stepBpm', 1, 50);
    const every = numberInput('everyBars', 1, 64);
    const target = numberInput('targetBpm', MIN_BPM, MAX_BPM);
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });

    root.append(
      h(
        'details',
        { class: 'panel' },
        h('summary', {}, 'Speed trainer'),
        h('label', { class: 'check' }, enabled, 'Enabled'),
        h(
          'div',
          { class: 'grid3' },
          field('Change by (BPM)', step),
          field('Every (bars)', every),
          field('Up to (BPM)', target),
        ),
        status,
      ),
    );

    const render = () => {
      const t = store.get().trainer;
      enabled.checked = t.enabled;
      step.value = String(t.stepBpm);
      every.value = String(t.everyBars);
      target.value = String(t.targetBpm);
    };
    const setStatus = (barsCompleted: number) => {
      const { trainer, settings, playing } = store.get();
      if (!trainer.enabled) status.textContent = '';
      else if (settings.bpm === trainer.targetBpm) status.textContent = `At target tempo (${trainer.targetBpm} BPM).`;
      else if (!playing) status.textContent = 'Starts changing the tempo once you press Start.';
      else {
        const left = trainer.everyBars - (barsCompleted % trainer.everyBars);
        status.textContent = `Next change in ${left} bar${left === 1 ? '' : 's'}.`;
      }
    };

    render();
    setStatus(0);
    store.subscribe((s, prev) => {
      if (s.trainer !== prev.trainer) render();
      if (s.trainer !== prev.trainer || s.playing !== prev.playing) setStatus(0);
    });

    metronome.on('bar', (barsCompleted) => {
      const { trainer, settings } = store.get();
      if (trainer.enabled && shouldStep(barsCompleted, trainer.everyBars)) {
        patchSettings(store, { bpm: trainerStep(settings.bpm, trainer) });
      }
      setStatus(barsCompleted);
    });
  },
};
