import { describeInput } from '../core/inputs';
import { DEFAULT_A4, MAX_A4, MIN_A4, noteFromHz } from '../core/pitch';
import { Tuner, listInputs, type InputChannel } from '../engine/tuner';
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
const CHANNELS: readonly InputChannel[] = ['mix', 0, 1];

interface TunerPrefs {
  a4: number;
  /** Empty for the system default input. */
  deviceId: string;
  channel: InputChannel;
  /** Name of the chosen input, shown before the browser reveals device names. */
  label: string;
}

/** One entry in the input list: a device, and which of its channels to listen to. */
interface InputChoice {
  deviceId: string;
  channel: InputChannel;
  label: string;
}

function loadPrefs(): TunerPrefs {
  const prefs: TunerPrefs = { a4: DEFAULT_A4, deviceId: '', channel: 'mix', label: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? {};
    if (typeof raw.a4 === 'number' && raw.a4 >= MIN_A4 && raw.a4 <= MAX_A4) prefs.a4 = raw.a4;
    if (typeof raw.deviceId === 'string') prefs.deviceId = raw.deviceId;
    if (CHANNELS.includes(raw.channel)) prefs.channel = raw.channel;
    if (typeof raw.label === 'string') prefs.label = raw.label;
  } catch {
    // Storage blocked or corrupt: use the defaults.
  }
  return prefs;
}

function savePrefs(prefs: TunerPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not critical.
  }
}

/** Chromatic tuner using a microphone or an audio interface input, with a guide to the six guitar strings. */
export const tuner: Feature = {
  id: 'tuner',
  mount(root) {
    const engine = new Tuner();
    const prefs = loadPrefs();

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
      value: prefs.a4,
      onchange: () => {
        const value = Number(reference.value);
        prefs.a4 = Number.isFinite(value) ? Math.min(MAX_A4, Math.max(MIN_A4, Math.round(value))) : DEFAULT_A4;
        reference.value = String(prefs.a4);
        savePrefs(prefs);
      },
    });
    let choices: InputChoice[] = [];
    const input = h('select', {
      onchange: () => {
        const choice = choices[input.selectedIndex];
        prefs.deviceId = choice.deviceId;
        prefs.channel = choice.channel;
        prefs.label = choice.label;
        savePrefs(prefs);
        if (engine.running) void start();
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
      h(
        'div',
        { class: 'tuner__controls' },
        h('div', { class: 'tuner__input' }, field('Input', input)),
        toggle,
        field('Reference A4 (Hz)', reference),
      ),
      status,
    );
    root.append(panel);
    const display = panel.querySelector<HTMLElement>('.tuner')!;

    /**
     * Fills the input list, one entry per input of an interface (e.g. "MOTU Input 1").
     * Device names only appear once access has been granted.
     */
    const refreshInputs = async () => {
      const devices = await listInputs().catch(() => []);
      choices = [{ deviceId: '', channel: 'mix', label: 'Default input' }];
      for (const { deviceId, label } of devices) {
        if (!label) continue; // Nameless until access is granted; see the note below.
        const { device, pair } = describeInput(label);
        if (!pair) {
          // A guitar on either channel is heard: 'mix' sums them.
          choices.push({ deviceId, channel: 'mix', label: device });
          continue;
        }
        const [left, right] = pair;
        choices.push(
          { deviceId, channel: 0, label: `${device} Input ${left}` },
          { deviceId, channel: 1, label: `${device} Input ${right}` },
          { deviceId, channel: 'mix', label: `${device} Inputs ${left} + ${right}` },
        );
      }
      const matches = (c: InputChoice) => c.deviceId === prefs.deviceId && c.channel === prefs.channel;
      if (!choices.some(matches)) {
        const sameDevice = choices.find((c) => c.deviceId === prefs.deviceId);
        if (sameDevice) ({ channel: prefs.channel, label: prefs.label } = sameDevice);
        // Saved but not listed (yet): keep it rather than silently switching.
        else choices.push({ deviceId: prefs.deviceId, channel: prefs.channel, label: prefs.label || 'Last used input' });
      }
      const options = choices.map((c) => h('option', {}, c.label));
      if (devices.some((d) => !d.label)) {
        options.push(h('option', { disabled: true }, 'Other inputs (e.g. an audio interface) appear after Start listening'));
      }
      input.replaceChildren(...options);
      input.selectedIndex = choices.findIndex(matches);
    };

    const show = (hz: number | null) => {
      if (hz === null) {
        display.dataset.state = engine.running ? 'listening' : 'idle';
        note.textContent = '–';
        octave.textContent = '';
        detail.textContent = engine.running ? 'Listening… play a string.' : 'Press Start and play a string.';
        strings.forEach((s) => s.classList.remove('is-target'));
        return;
      }
      const n = noteFromHz(hz, prefs.a4);
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
    const open = async () => {
      try {
        await engine.start({ deviceId: prefs.deviceId || undefined, channel: prefs.channel });
      } catch (err) {
        // The chosen input was unplugged: fall back to the default one.
        const missing = err instanceof DOMException && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError');
        if (!prefs.deviceId || !missing) throw err;
        prefs.deviceId = '';
        prefs.channel = 'mix';
        prefs.label = '';
        savePrefs(prefs);
        status.textContent = 'The chosen input is not connected, so the default input is used.';
        await engine.start({ channel: prefs.channel });
      }
    };
    const start = async () => {
      status.textContent = '';
      try {
        await open();
        setRunning(true);
      } catch (err) {
        console.warn('Audio input unavailable', err);
        status.textContent =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in the browser’s site settings to use the tuner.'
            : 'No audio input available.';
        setRunning(false);
      }
      await refreshInputs();
    };
    const stop = () => {
      engine.stop();
      setRunning(false);
    };

    void refreshInputs();
    navigator.mediaDevices?.addEventListener('devicechange', () => void refreshInputs());
    toggle.addEventListener('click', () => (engine.running ? stop() : void start()));
    // Never keep the input open when the tuner is out of sight.
    panel.addEventListener('toggle', () => !panel.open && engine.running && stop());
    document.addEventListener('visibilitychange', () => document.hidden && engine.running && stop());
  },
};
