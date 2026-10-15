import { DEFAULT_A4, MAX_A4, MIN_A4, noteFromHz } from '../core/pitch';
import { Tuner } from '../engine/tuner';
import { field, h } from '../ui/dom';
import type { Feature } from './feature';

const STORAGE_KEY = 'metronome.tuner.v1';
/** Within this many cents counts as in tune. */
const IN_TUNE_CENTS = 5;
/** Standard guitar tuning, low to high, as MIDI notes. */
const GUITAR_STRINGS: [string, number][] = [
  ['E', 40],
  ['A', 45],
  ['D', 50],
  ['G', 55],
  ['B', 59],
  ['E', 64],
];

function loadA4(): number {
  try {
    const a4 = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')?.a4;
    if (typeof a4 === 'number' && a4 >= MIN_A4 && a4 <= MAX_A4) return a4;
  } catch {
    // Storage blocked or corrupt: use the default.
  }
  return DEFAULT_A4;
}

function saveA4(a4: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ a4 }));
  } catch {
    // Not critical.
  }
}

/** Chromatic tuner using the microphone, with a guide to the six guitar strings. */
export const tuner: Feature = {
  id: 'tuner',
  mount(root) {
    const engine = new Tuner();
    let a4 = loadA4();

    const toggle = h('button', { type: 'button', class: 'tuner__toggle', 'aria-pressed': 'false' }, 'Start listening');
    const note = h('span', { class: 'tuner__note' }, '–');
    const octave = h('sub', { class: 'tuner__octave' });
    const needle = h('div', { class: 'tuner__needle' });
    const detail = h('p', { class: 'tuner__detail' }, 'Press Start and play a string.');
    const strings = GUITAR_STRINGS.map(([name, midi]) => h('span', { class: 'tuner__string', title: `${name}${Math.floor(midi / 12) - 1}` }, name));
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });
    const reference = h('input', {
      type: 'number',
      inputMode: 'numeric',
      min: MIN_A4,
      max: MAX_A4,
      value: a4,
      onchange: () => {
        const value = Number(reference.value);
        a4 = Number.isFinite(value) ? Math.min(MAX_A4, Math.max(MIN_A4, Math.round(value))) : DEFAULT_A4;
        reference.value = String(a4);
        saveA4(a4);
      },
    });
    const meter = h(
      'div',
      { class: 'tuner__meter', 'aria-hidden': 'true' },
      h('div', { class: 'tuner__scale' }, h('span', {}, '♭'), h('span', {}, '0'), h('span', {}, '♯')),
      h('div', { class: 'tuner__track' }, needle),
    );
    const panel = h(
      'details',
      { class: 'panel' },
      h('summary', {}, 'Tuner'),
      h(
        'div',
        { class: 'tuner', 'data-state': 'idle' },
        h('div', { class: 'tuner__readout' }, note, octave),
        meter,
        detail,
        h('div', { class: 'tuner__strings' }, ...strings),
      ),
      h('div', { class: 'tuner__controls' }, toggle, field('Reference A4 (Hz)', reference)),
      status,
    );
    root.append(panel);
    const display = panel.querySelector<HTMLElement>('.tuner')!;

    const show = (hz: number | null) => {
      if (hz === null) {
        display.dataset.state = engine.running ? 'listening' : 'idle';
        note.textContent = '–';
        octave.textContent = '';
        detail.textContent = engine.running ? 'Listening… play a string.' : 'Press Start and play a string.';
        strings.forEach((s) => s.classList.remove('is-target'));
        return;
      }
      const n = noteFromHz(hz, a4);
      const inTune = Math.abs(n.cents) <= IN_TUNE_CENTS;
      display.dataset.state = inTune ? 'in-tune' : n.cents < 0 ? 'flat' : 'sharp';
      display.style.setProperty('--cents', n.cents.toFixed(1));
      note.textContent = n.name;
      octave.textContent = String(n.octave);
      const cents = Math.round(n.cents);
      detail.textContent = `${hz.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents} cents${inTune ? ' · in tune' : ''}`;
      strings.forEach((s, i) => s.classList.toggle('is-target', GUITAR_STRINGS[i][1] === n.midi));
    };
    engine.on('pitch', show);

    const setRunning = (running: boolean) => {
      toggle.textContent = running ? 'Stop listening' : 'Start listening';
      toggle.setAttribute('aria-pressed', String(running));
      show(null);
    };
    const start = async () => {
      status.textContent = '';
      try {
        await engine.start();
        setRunning(true);
      } catch (err) {
        console.warn('Microphone unavailable', err);
        status.textContent =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in the browser’s site settings to use the tuner.'
            : 'No microphone available.';
        setRunning(false);
      }
    };
    const stop = () => {
      engine.stop();
      setRunning(false);
    };

    toggle.addEventListener('click', () => (engine.running ? stop() : void start()));
    // Never keep the microphone open when the tuner is out of sight.
    panel.addEventListener('toggle', () => !panel.open && engine.running && stop());
    document.addEventListener('visibilitychange', () => document.hidden && engine.running && stop());
  },
};
