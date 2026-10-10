import { describe, expect, it } from 'vitest';
import type { Accent } from '../core/types';
import { Scheduler, type Pattern, type ScheduledTick } from './scheduler';
import { LEVELS, SOUNDS, renderVoice } from './sounds';

function run(pattern: Pattern, until: number, onBarStart?: (bar: number) => void) {
  const ticks: ScheduledTick[] = [];
  const s = new Scheduler({
    getPattern: () => pattern,
    onTick: (t) => ticks.push(t),
    onBarStart,
    lookahead: 0.1,
    startDelay: 0,
  });
  s.start(0);
  // Simulate a jittery timer firing roughly every 25 ms.
  for (let now = 0; now <= until; now += 0.02 + Math.random() * 0.01) s.pump(now);
  return ticks;
}

const fourFour: Accent[] = ['strong', 'normal', 'normal', 'normal'];

describe('scheduler', () => {
  it('places ticks exactly on the beat regardless of timer jitter', () => {
    const ticks = run({ bpm: 120, beatsPerBar: 4, subdivision: 1, accents: fourFour }, 2.5);
    const times = ticks.map((t) => t.time);
    expect(times.slice(0, 6)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(ticks.slice(0, 5).map((t) => t.kind)).toEqual(['accent', 'beat', 'beat', 'beat', 'accent']);
    expect(ticks[4]).toMatchObject({ bar: 1, beat: 0, sub: 0 });
  });

  it('schedules subdivisions', () => {
    const ticks = run({ bpm: 60, beatsPerBar: 2, subdivision: 3, accents: ['strong', 'normal'] }, 1);
    expect(ticks.slice(0, 4).map((t) => [t.beat, t.sub, t.kind])).toEqual([
      [0, 0, 'accent'],
      [0, 1, 'sub'],
      [0, 2, 'sub'],
      [1, 0, 'beat'],
    ]);
    expect(ticks[1].time).toBeCloseTo(1 / 3);
  });

  it('lets onBarStart change the tempo for the next bar', () => {
    const pattern = { bpm: 60, beatsPerBar: 2, subdivision: 1, accents: ['strong', 'normal'] as Accent[] };
    const bars: number[] = [];
    const ticks = run(pattern, 3, (bar) => {
      bars.push(bar);
      pattern.bpm = 120;
    });
    expect(bars[0]).toBe(1);
    // Bar 0 at 60 BPM (1 s apart), then 120 BPM (0.5 s apart).
    expect(ticks.slice(0, 4).map((t) => t.time)).toEqual([0, 1, 2, 2.5]);
  });

  it('does not burst missed clicks after a stall', () => {
    const ticks: ScheduledTick[] = [];
    const s = new Scheduler({
      getPattern: () => ({ bpm: 120, beatsPerBar: 4, subdivision: 1, accents: fourFour }),
      onTick: (t) => ticks.push(t),
      lookahead: 0.1,
      startDelay: 0.05,
    });
    s.start(0);
    const before = ticks.length;
    s.pump(10); // ten seconds without a timer callback
    expect(ticks.length - before).toBeLessThanOrEqual(1);
    expect(ticks[ticks.length - 1].time).toBeGreaterThanOrEqual(10);
  });

  it('stops scheduling when stopped', () => {
    const ticks: ScheduledTick[] = [];
    const s = new Scheduler({
      getPattern: () => ({ bpm: 120, beatsPerBar: 4, subdivision: 1, accents: fourFour }),
      onTick: (t) => ticks.push(t),
    });
    s.start(0);
    s.stop();
    const count = ticks.length;
    s.pump(5);
    expect(ticks.length).toBe(count);
  });
});

describe('sounds', () => {
  it.each(SOUNDS.map((s) => [s.id, s] as const))('%s renders normalised voices', (_, sound) => {
    for (const kind of ['accent', 'beat', 'sub'] as const) {
      const samples = renderVoice(sound, kind, 48000);
      expect(samples.length).toBeGreaterThan(100);
      const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeCloseTo(LEVELS[kind], 5);
      // Clicks must die away so consecutive ticks don't smear together.
      expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.05);
    }
  });

  it.each(SOUNDS.map((s) => [s.id, s] as const))('%s is not shrill', (_, sound) => {
    // RMS of the first difference over RMS of the signal grows with frequency: for a
    // sine of frequency f it is 2·sin(πf/sr). 0.55 at 48 kHz ≈ energy centred below ~4 kHz.
    for (const kind of ['accent', 'beat', 'sub'] as const) {
      const x = renderVoice(sound, kind, 48000);
      let e = 0;
      let d = 0;
      for (let i = 1; i < x.length; i++) {
        e += x[i] ** 2;
        d += (x[i] - x[i - 1]) ** 2;
      }
      expect(Math.sqrt(d / e)).toBeLessThan(0.55);
    }
  });
});
