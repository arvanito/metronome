import { Emitter } from '../core/emitter';
import { detectPitch, median } from '../core/pitch';

const FRAME_SIZE = 2048;
/** Readings are the median of this many frames, which hides one-off octave errors. */
const HISTORY = 5;
/** After this many frames without a clear pitch, the reading is dropped. */
const SILENT_FRAMES = 20;

export type TunerEvents = {
  /** Smoothed frequency in Hz, or null when no clear note is playing. Fired every animation frame. */
  pitch: number | null;
};

/** Listens to the microphone and reports the pitch it hears. Independent of the metronome's audio. */
export class Tuner extends Emitter<TunerEvents> {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = new Float32Array(FRAME_SIZE);
  private history: number[] = [];
  private silent = 0;
  private raf = 0;

  get running(): boolean {
    return this.stream !== null;
  }

  /** Asks for microphone access, so call it from a user gesture. Rejects if access is denied. */
  async start(): Promise<void> {
    if (this.running) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      // Voice processing is made for speech and smears or gates a sustained note.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.stream = stream;
    this.ctx ??= new AudioContext();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.analyser = new AnalyserNode(this.ctx, { fftSize: FRAME_SIZE });
    this.ctx.createMediaStreamSource(stream).connect(this.analyser);
    this.raf = requestAnimationFrame(this.analyse);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.history = [];
    // Suspending releases the audio device; the context is reused on the next start.
    void this.ctx?.suspend();
    this.emit('pitch', null);
  }

  private analyse = (): void => {
    if (!this.analyser || !this.ctx) return;
    this.analyser.getFloatTimeDomainData(this.frame);
    const pitch = detectPitch(this.frame, this.ctx.sampleRate);
    if (pitch) {
      this.silent = 0;
      this.history.push(pitch.hz);
      if (this.history.length > HISTORY) this.history.shift();
    } else if (++this.silent > SILENT_FRAMES) {
      this.history = [];
    }
    this.emit('pitch', this.history.length > 0 ? median(this.history) : null);
    this.raf = requestAnimationFrame(this.analyse);
  };
}
