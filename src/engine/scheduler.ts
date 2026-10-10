import { advance, secondsPerTick, tickKind, type Position } from '../core/rhythm';
import type { Accent, TickKind } from '../core/types';

export interface Pattern {
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  accents: readonly Accent[];
}

export interface ScheduledTick extends Position {
  /** Audio-clock time (seconds) at which the tick sounds. */
  time: number;
  kind: TickKind;
}

export interface SchedulerOptions {
  /** Read before every tick, so tempo/meter changes apply immediately. */
  getPattern: () => Pattern;
  onTick: (tick: ScheduledTick) => void;
  /** Called before the first tick of every bar after the first. May change the pattern. */
  onBarStart?: (bar: number) => void;
  /** How far ahead of `now` ticks are scheduled, in seconds. */
  lookahead?: number;
  /** Delay before the first tick, so it is never scheduled in the past. */
  startDelay?: number;
}

/**
 * Lookahead scheduler ("A Tale of Two Clocks"): a coarse, jittery timer calls `pump`
 * often, and each call queues every tick that falls inside the lookahead window on the
 * sample-accurate audio clock. It knows nothing about Web Audio, so it is unit-testable.
 */
export class Scheduler {
  private pos: Position = { bar: 0, beat: 0, sub: 0 };
  private nextTime = 0;
  private running = false;
  private readonly lookahead: number;
  private readonly startDelay: number;

  constructor(private readonly opts: SchedulerOptions) {
    this.lookahead = opts.lookahead ?? 0.1;
    this.startDelay = opts.startDelay ?? 0.05;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(now: number): void {
    this.pos = { bar: 0, beat: 0, sub: 0 };
    this.nextTime = now + this.startDelay;
    this.running = true;
    this.pump(now);
  }

  stop(): void {
    this.running = false;
  }

  pump(now: number): void {
    if (!this.running) return;
    // After a long stall (e.g. the tab was suspended) skip ahead instead of firing a burst of late clicks.
    if (this.nextTime < now - this.lookahead) this.nextTime = now + this.startDelay;
    const horizon = now + this.lookahead;
    while (this.nextTime < horizon) {
      const { bar, beat, sub } = this.pos;
      if (bar > 0 && beat === 0 && sub === 0) this.opts.onBarStart?.(bar);
      const pattern = this.opts.getPattern();
      this.opts.onTick({ bar, beat, sub, time: this.nextTime, kind: tickKind(pattern.accents, beat, sub) });
      this.nextTime += secondsPerTick(pattern.bpm, pattern.subdivision);
      this.pos = advance(this.pos, pattern.beatsPerBar, pattern.subdivision);
    }
  }
}
