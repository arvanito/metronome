/** Slider range: 0..1 is normal volume, 1..MAX_VOLUME is boost. */
export const MAX_VOLUME = 1.5;
/** Boost at the top of the slider, in dB. */
export const MAX_BOOST_DB = 5;

/**
 * Maps the volume slider (0..MAX_VOLUME) to a linear gain.
 * Below 100% the curve is squared, which feels even to the ear; above 100% each
 * step adds the same number of decibels, up to MAX_BOOST_DB.
 */
export function volumeToGain(volume: number): number {
  if (volume <= 1) return Math.max(0, volume) ** 2;
  const boost = Math.min(volume, MAX_VOLUME) - 1;
  return 10 ** ((boost / (MAX_VOLUME - 1)) * (MAX_BOOST_DB / 20));
}

/** Point where the limiter starts to act, and the ceiling it approaches. */
const KNEE = 0.8;

/**
 * Soft limiter: unchanged below the knee, then smoothly approaches ±1 so loud
 * (boosted) peaks are rounded off instead of clipping.
 */
export function softLimit(x: number): number {
  const a = Math.abs(x);
  if (a <= KNEE) return x;
  return Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
}
