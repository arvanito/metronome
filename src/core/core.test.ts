import { describe, expect, it } from 'vitest';
import { advance, cycleAccent, resizeAccents, secondsPerTick, tickKind } from './rhythm';
import { DEFAULT_SETTINGS, sanitizeSettings, sanitizeTrainer } from './settings';
import { shouldStep, trainerStep } from './speedTrainer';
import { TapTempo } from './tapTempo';
import { clampBpm, tempoMarking } from './tempo';
import { softLimit, volumeToGain } from './volume';

describe('tempo', () => {
  it('clamps and rounds BPM', () => {
    expect(clampBpm(5)).toBe(20);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(120.6)).toBe(121);
  });

  it('names tempos', () => {
    expect(tempoMarking(50)).toBe('Largo');
    expect(tempoMarking(120)).toBe('Allegro');
    expect(tempoMarking(250)).toBe('Prestissimo');
  });
});

describe('rhythm', () => {
  it('cycles accents', () => {
    expect(cycleAccent('strong')).toBe('normal');
    expect(cycleAccent('normal')).toBe('mute');
    expect(cycleAccent('mute')).toBe('strong');
  });

  it('resizes accents keeping existing choices', () => {
    expect(resizeAccents(['mute', 'strong'], 3)).toEqual(['mute', 'strong', 'normal']);
    expect(resizeAccents([], 2)).toEqual(['strong', 'normal']);
    expect(resizeAccents(['strong', 'normal', 'mute'], 1)).toEqual(['strong']);
  });

  it('maps ticks to sounds', () => {
    const accents = ['strong', 'normal', 'mute'] as const;
    expect(tickKind(accents, 0, 0)).toBe('accent');
    expect(tickKind(accents, 1, 0)).toBe('beat');
    expect(tickKind(accents, 2, 0)).toBe('silent');
    expect(tickKind(accents, 2, 1)).toBe('sub');
  });

  it('computes tick length', () => {
    expect(secondsPerTick(120, 1)).toBe(0.5);
    expect(secondsPerTick(120, 4)).toBe(0.125);
  });

  it('advances through subdivisions, beats and bars', () => {
    expect(advance({ bar: 0, beat: 0, sub: 0 }, 4, 2)).toEqual({ bar: 0, beat: 0, sub: 1 });
    expect(advance({ bar: 0, beat: 0, sub: 1 }, 4, 2)).toEqual({ bar: 0, beat: 1, sub: 0 });
    expect(advance({ bar: 0, beat: 3, sub: 0 }, 4, 1)).toEqual({ bar: 1, beat: 0, sub: 0 });
  });

  it('wraps cleanly when the bar or subdivision shrinks mid-bar', () => {
    expect(advance({ bar: 0, beat: 0, sub: 3 }, 4, 2)).toEqual({ bar: 0, beat: 1, sub: 0 });
    expect(advance({ bar: 2, beat: 5, sub: 0 }, 3, 1)).toEqual({ bar: 3, beat: 0, sub: 0 });
  });
});

describe('tap tempo', () => {
  it('averages tap intervals', () => {
    const tap = new TapTempo();
    expect(tap.tap(0)).toBeNull();
    expect(tap.tap(500)).toBe(120);
    expect(tap.tap(1000)).toBe(120);
    expect(tap.tap(1600)).toBeCloseTo(60000 / 533.33, 1);
  });

  it('starts over after a pause', () => {
    const tap = new TapTempo(2000);
    tap.tap(0);
    tap.tap(1000);
    expect(tap.tap(5000)).toBeNull();
    expect(tap.tap(5250)).toBe(240);
  });
});

describe('speed trainer', () => {
  const trainer = { enabled: true, stepBpm: 5, everyBars: 4, targetBpm: 112 };

  it('steps every N bars', () => {
    expect(shouldStep(0, 4)).toBe(false);
    expect(shouldStep(3, 4)).toBe(false);
    expect(shouldStep(4, 4)).toBe(true);
    expect(shouldStep(8, 4)).toBe(true);
  });

  it('moves towards the target without overshooting', () => {
    expect(trainerStep(100, trainer)).toBe(105);
    expect(trainerStep(110, trainer)).toBe(112);
    expect(trainerStep(112, trainer)).toBe(112);
    expect(trainerStep(130, trainer)).toBe(125);
  });
});

describe('volume', () => {
  it('maps the slider to gain, continuously across 100%', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(0.5)).toBe(0.25);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(1.0001)).toBeCloseTo(1, 3);
    expect(20 * Math.log10(volumeToGain(1.5))).toBeCloseTo(5);
    expect(20 * Math.log10(volumeToGain(2))).toBeCloseTo(10);
    expect(volumeToGain(5)).toBe(volumeToGain(2));
  });

  it('limits softly without ever exceeding full scale', () => {
    expect(softLimit(0.5)).toBe(0.5);
    expect(softLimit(-0.8)).toBe(-0.8);
    for (const x of [0.9, 1, 2, 3.2, 100]) {
      expect(softLimit(x)).toBeLessThanOrEqual(1);
      expect(softLimit(-x)).toBe(-softLimit(x));
    }
    // Monotonic: louder in never means quieter out.
    expect(softLimit(1.5)).toBeGreaterThan(softLimit(1.2));
  });
});

describe('settings', () => {
  it('falls back to defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ bpm: 'fast', subdivision: 7, volume: 3 })).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 2,
    });
  });

  it('keeps accents in step with beats per bar', () => {
    const s = sanitizeSettings({ beatsPerBar: 6, accents: ['strong', 'bogus'] });
    expect(s.accents).toEqual(['strong', 'normal', 'normal', 'normal', 'normal', 'normal']);
  });

  it('sanitises trainer settings', () => {
    expect(sanitizeTrainer({ stepBpm: 0, everyBars: 2.4, targetBpm: 1000 })).toMatchObject({
      stepBpm: 1,
      everyBars: 2,
      targetBpm: 300,
    });
  });
});
