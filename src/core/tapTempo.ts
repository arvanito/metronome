/** Averages the intervals between recent taps. Time is passed in, so it is easy to test. */
export class TapTempo {
  private taps: number[] = [];

  constructor(
    private readonly resetAfterMs = 2000,
    private readonly maxTaps = 8,
  ) {}

  /** Registers a tap and returns the measured BPM, or null until there are two taps. */
  tap(nowMs: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && nowMs - last > this.resetAfterMs) this.taps = [];
    this.taps.push(nowMs);
    if (this.taps.length > this.maxTaps) this.taps.shift();
    if (this.taps.length < 2) return null;
    const avgMs = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1);
    return 60000 / avgMs;
  }

  reset(): void {
    this.taps = [];
  }
}
