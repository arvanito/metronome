import { describe, expect, it } from 'vitest';
import { detectPitch, median, midiToHz, noteFromHz } from './pitch';

const SAMPLE_RATE = 48000;
const FRAME = 2048;

/** A plucked-string-like tone: fundamental plus louder 2nd and some 3rd harmonic. */
function tone(hz: number, harmonics = [1, 1.5, 0.6], amplitude = 0.3): Float32Array {
  const out = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    let v = 0;
    harmonics.forEach((a, k) => (v += a * Math.sin((2 * Math.PI * hz * (k + 1) * i) / SAMPLE_RATE)));
    out[i] = (v * amplitude) / harmonics.length;
  }
  return out;
}

/** Deterministic white noise. */
function noise(): Float32Array {
  let seed = 1;
  return Float32Array.from({ length: FRAME }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.5;
  });
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe('detectPitch', () => {
  it.each([82.41, 110, 146.83, 196, 246.94, 329.63, 440, 880])('finds %f Hz within 1 cent', (hz) => {
    const pitch = detectPitch(tone(hz), SAMPLE_RATE);
    expect(pitch).not.toBeNull();
    expect(Math.abs(cents(pitch!.hz, hz))).toBeLessThan(1);
    expect(pitch!.clarity).toBeGreaterThan(0.85);
  });

  it('does not lock onto a dominant 2nd harmonic', () => {
    const pitch = detectPitch(tone(82.41, [0.3, 1, 0.5]), SAMPLE_RATE);
    expect(Math.abs(cents(pitch!.hz, 82.41))).toBeLessThan(1);
  });

  it('works at 44.1 kHz too', () => {
    const out = Float32Array.from({ length: FRAME }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 110 * i) / 44100));
    expect(Math.abs(cents(detectPitch(out, 44100)!.hz, 110))).toBeLessThan(1);
  });

  it('ignores silence and noise', () => {
    expect(detectPitch(new Float32Array(FRAME), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(tone(440, [1], 0.001), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(noise(), SAMPLE_RATE)).toBeNull();
  });
});

describe('notes', () => {
  it('names notes and measures cents', () => {
    expect(noteFromHz(440)).toEqual({ midi: 69, name: 'A', octave: 4, cents: 0 });
    expect(noteFromHz(82.41)).toMatchObject({ name: 'E', octave: 2 });
    expect(noteFromHz(261.63)).toMatchObject({ name: 'C', octave: 4 });
    expect(noteFromHz(277.18)).toMatchObject({ name: 'C♯', octave: 4 });
    expect(noteFromHz(445).cents).toBeCloseTo(19.56, 1);
    expect(noteFromHz(435).cents).toBeCloseTo(-19.79, 1);
  });

  it('follows the reference pitch', () => {
    expect(noteFromHz(432, 432)).toMatchObject({ name: 'A', cents: 0 });
    expect(noteFromHz(440, 432).cents).toBeCloseTo(31.77, 1);
    expect(midiToHz(40)).toBeCloseTo(82.41, 2);
  });

  it('takes the median', () => {
    expect(median([110, 220, 110.5, 109.8, 110.2])).toBe(110.2);
    expect(median([1, 3])).toBe(2);
  });
});
