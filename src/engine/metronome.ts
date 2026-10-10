import { Emitter } from '../core/emitter';
import type { MetronomeSettings } from '../core/types';
import { softLimit, volumeToGain } from '../core/volume';
import { Scheduler, type ScheduledTick } from './scheduler';
import { getSound, renderVoice, type VoiceKind } from './sounds';
import TimerWorker from './timer.worker?worker';

const PUMP_INTERVAL_MS = 25;
const VOICES: VoiceKind[] = ['accent', 'beat', 'sub'];

/**
 * A WaveShaper only shapes inputs in -1..1, so boosted signals are scaled down by
 * this factor before it and the curve scales them back up. Must exceed the maximum gain.
 */
const LIMITER_HEADROOM = 4;

/** Soft limiter stage: rounds off boosted peaks instead of letting them clip. */
function createLimiter(ctx: AudioContext): WaveShaperNode {
  const points = 8192;
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const u = (i / (points - 1)) * 2 - 1;
    curve[i] = softLimit(u * LIMITER_HEADROOM);
  }
  // Oversampling keeps the limiting from adding harsh aliasing.
  return new WaveShaperNode(ctx, { curve, oversample: '4x' });
}

type MetronomeEvents = {
  /** Fired when a tick is actually heard (aligned with audio output), for visuals. */
  beat: ScheduledTick;
  /** Fired when a new bar is scheduled; the payload is the number of bars completed. */
  bar: number;
};

/** Glues the scheduler to Web Audio. Reads settings live through `getSettings`. */
export class Metronome extends Emitter<MetronomeEvents> {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<VoiceKind, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private visualQueue: ScheduledTick[] = [];
  private raf = 0;
  private worker: Worker | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | undefined;
  private readonly scheduler: Scheduler;

  constructor(private readonly getSettings: () => MetronomeSettings) {
    super();
    this.scheduler = new Scheduler({
      getPattern: this.getSettings,
      onTick: (tick) => this.schedule(tick),
      onBarStart: (bar) => this.emit('bar', bar),
    });
  }

  get playing(): boolean {
    return this.scheduler.isRunning;
  }

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  async start(): Promise<void> {
    if (this.playing) return;
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') await ctx.resume();
    const { sound, volume } = this.getSettings();
    if (this.buffers.size === 0) this.setSound(sound);
    this.setVolume(volume);
    this.scheduler.start(ctx.currentTime);
    this.startTimer();
    this.raf = requestAnimationFrame(this.drawLoop);
  }

  stop(): void {
    this.scheduler.stop();
    this.stopTimer();
    cancelAnimationFrame(this.raf);
    this.visualQueue = [];
    this.sources.forEach((s) => s.stop());
    this.sources.clear();
  }

  setVolume(volume: number): void {
    if (!this.ctx || !this.master) return;
    // The limiter's input is scaled down by LIMITER_HEADROOM (see ensureContext).
    this.master.gain.setTargetAtTime(volumeToGain(volume) / LIMITER_HEADROOM, this.ctx.currentTime, 0.01);
  }

  setSound(id: string): void {
    const ctx = this.ctx;
    if (!ctx) return; // Rendered on start, once an AudioContext exists.
    const sound = getSound(id);
    for (const kind of VOICES) {
      const samples = renderVoice(sound, kind, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(kind, buffer);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(createLimiter(this.ctx)).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private schedule(tick: ScheduledTick): void {
    this.visualQueue.push(tick);
    if (tick.kind === 'silent' || !this.ctx || !this.master) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers.get(tick.kind)!;
    source.connect(this.master);
    source.onended = () => this.sources.delete(source);
    this.sources.add(source);
    source.start(tick.time);
  }

  private pump = (): void => {
    if (!this.ctx) return;
    this.scheduler.pump(this.ctx.currentTime);
    // Also flush visuals here, so beat lights keep up even when animation frames are throttled.
    this.flushVisuals();
  };

  private startTimer(): void {
    try {
      this.worker ??= new TimerWorker();
      this.worker.onmessage = this.pump;
      this.worker.postMessage({ command: 'start', intervalMs: PUMP_INTERVAL_MS });
    } catch {
      this.fallbackTimer = setInterval(this.pump, PUMP_INTERVAL_MS);
    }
  }

  private stopTimer(): void {
    this.worker?.postMessage({ command: 'stop' });
    clearInterval(this.fallbackTimer);
  }

  /** Emits `beat` events when each tick reaches the speakers, not when it is scheduled. */
  private drawLoop = (): void => {
    this.flushVisuals();
    this.raf = requestAnimationFrame(this.drawLoop);
  };

  private flushVisuals(): void {
    const ctx = this.ctx!;
    // outputLatency is the full estimate where supported; baseLatency is a lower bound elsewhere.
    const heardAt = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    while (this.visualQueue.length > 0 && this.visualQueue[0].time <= heardAt) {
      this.emit('beat', this.visualQueue.shift()!);
    }
  }
}
