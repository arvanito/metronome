// Sound audition page: hear every sound pack on its own or in a short pattern,
// and mark favourites. A development aid for choosing which sounds to ship.
import type { Accent } from './core/types';
import { Scheduler } from './engine/scheduler';
import { SOUNDS, renderVoice, type SoundDef, type VoiceKind } from './engine/sounds';
import './styles.css';
import { field, h } from './ui/dom';

const PICKS_KEY = 'metronome.audition.picks';
const KINDS: [VoiceKind, string][] = [
  ['accent', 'Accent'],
  ['beat', 'Beat'],
  ['sub', 'Sub'],
];

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function audio(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  void ctx.resume();
  return ctx;
}

function buffer(sound: SoundDef, kind: VoiceKind): AudioBuffer {
  const key = `${sound.id}:${kind}`;
  let buf = buffers.get(key);
  if (!buf) {
    const ac = audio();
    const samples = renderVoice(sound, kind, ac.sampleRate);
    buf = ac.createBuffer(1, samples.length, ac.sampleRate);
    buf.getChannelData(0).set(samples);
    buffers.set(key, buf);
  }
  return buf;
}

function play(sound: SoundDef, kind: VoiceKind, when = 0): void {
  const ac = audio();
  const src = ac.createBufferSource();
  src.buffer = buffer(sound, kind);
  src.connect(ac.destination);
  src.start(when || ac.currentTime);
}

// --- Pattern playback (2 bars of 4/4) -------------------------------------
let stopPattern: (() => void) | null = null;

function playPattern(sound: SoundDef, bpm: number, subdivision: number, onDone: () => void): void {
  stopPattern?.();
  const ac = audio();
  const accents: Accent[] = ['strong', 'normal', 'normal', 'normal'];
  const scheduler = new Scheduler({
    getPattern: () => ({ bpm, beatsPerBar: 4, subdivision, accents }),
    onTick: (t) => {
      if (t.bar >= 2) return finish();
      if (t.kind !== 'silent') play(sound, t.kind, t.time);
    },
  });
  const timer = setInterval(() => scheduler.pump(ac.currentTime), 25);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    scheduler.stop();
    clearInterval(timer);
    stopPattern = null;
    // Let the last ticks ring before resetting the button.
    setTimeout(onDone, 400);
  };
  stopPattern = finish;
  scheduler.start(ac.currentTime);
}

// --- Picks ---------------------------------------------------------------
function loadPicks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

const picks = loadPicks();

function savePicks(): void {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify([...picks]));
  } catch {
    // Picks still work for this visit.
  }
}

// --- UI ------------------------------------------------------------------
const root = document.querySelector<HTMLElement>('#audition')!;

const bpm = h('input', { type: 'number', min: 40, max: 240, value: 100, inputMode: 'numeric' });
const sub = h(
  'select',
  {},
  h('option', { value: 1 }, 'Off'),
  h('option', { value: 2, selected: true }, '8ths'),
  h('option', { value: 3 }, 'Triplets'),
  h('option', { value: 4 }, '16ths'),
);
const summary = h('p', { class: 'audition__summary', 'aria-live': 'polite' });

const renderSummary = () => {
  const labels = SOUNDS.filter((s) => picks.has(s.id)).map((s) => s.label);
  summary.textContent = labels.length ? `Your picks: ${labels.join(', ')}` : 'Star the sounds you like.';
};

root.append(
  h('header', { class: 'feature' }, h('h1', {}, 'Sound audition'), h('p', { class: 'hint' }, 'Play a pattern or single hits, and star the sounds you like.')),
  h('section', { class: 'feature feature--meter' }, field('Tempo (BPM)', bpm), field('Subdivision', sub)),
  ...SOUNDS.map((sound) => {
    const star = h('button', {
      type: 'button',
      class: 'icon-btn star-btn',
      'aria-pressed': String(picks.has(sound.id)),
      'aria-label': `Star ${sound.label}`,
      onclick: () => {
        if (picks.has(sound.id)) picks.delete(sound.id);
        else picks.add(sound.id);
        star.setAttribute('aria-pressed', String(picks.has(sound.id)));
        savePicks();
        renderSummary();
      },
    }, '★');
    const patternBtn: HTMLButtonElement = h('button', {
      type: 'button',
      class: 'audition__play',
      onclick: () => {
        if (patternBtn.dataset.playing) return stopPattern?.();
        document.querySelectorAll<HTMLButtonElement>('.audition__play').forEach((b) => {
          delete b.dataset.playing;
          b.textContent = '▶ Pattern';
        });
        patternBtn.dataset.playing = '1';
        patternBtn.textContent = '■ Stop';
        playPattern(sound, Number(bpm.value) || 100, Number(sub.value), () => {
          delete patternBtn.dataset.playing;
          patternBtn.textContent = '▶ Pattern';
        });
      },
    }, '▶ Pattern');
    return h(
      'section',
      { class: 'feature panel audition__card' },
      h('div', { class: 'audition__head' }, h('div', {}, h('strong', {}, sound.label), h('p', { class: 'audition__desc' }, sound.description ?? '')), star),
      h(
        'div',
        { class: 'audition__buttons' },
        patternBtn,
        ...KINDS.map(([kind, label]) => h('button', { type: 'button', class: 'seg__btn', onclick: () => play(sound, kind) }, label)),
      ),
    );
  }),
  h('section', { class: 'feature' }, summary, h('p', { class: 'hint' }, h('a', { href: './' }, '← Back to the metronome'))),
);
renderSummary();
