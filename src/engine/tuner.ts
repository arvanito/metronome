import { Emitter } from '../core/emitter';
import { detectPitch, median } from '../core/pitch';

const FRAME_SIZE = 2048;
/** Readings are the median of this many frames, which hides one-off octave errors. */
const HISTORY = 5;
/** After this many frames without a clear pitch, the reading is dropped. */
const SILENT_FRAMES = 20;
/**
 * Quieter than this (RMS, about -46 dBFS) counts as silence. Low enough for a guitar
 * plugged straight into an interface at modest gain, above a quiet room through a mic.
 */
const MIN_RMS = 0.005;

/** Which channel of the input to listen to: both mixed, or one (0 = input 1). */
export type InputChannel = 'mix' | 0 | 1;

export interface TunerInput {
  /** A device from `listInputs()`; the system default when omitted. */
  deviceId?: string;
  channel: InputChannel;
}

export interface InputDevice {
  deviceId: string;
  label: string;
}

export type TunerEvents = {
  /** Smoothed frequency in Hz, or null when no clear note is playing. Fired every animation frame. */
  pitch: number | null;
};

/** The audio inputs, e.g. a microphone or an audio interface. Labels are empty until access is granted once. */
export async function listInputs(): Promise<InputDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Audio input ${i + 1}` }));
}

/** Listens to an audio input and reports the pitch it hears. Independent of the metronome's audio. */
export class Tuner extends Emitter<TunerEvents> {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodes: AudioNode[] = [];
  private analyser: AnalyserNode | null = null;
  private frame = new Float32Array(FRAME_SIZE);
  private history: number[] = [];
  private silent = 0;
  private raf = 0;
  /** How many channels the open input delivers (1 for most microphones). */
  channels = 0;

  get running(): boolean {
    return this.stream !== null;
  }

  /**
   * Asks for access to the input, so call it from a user gesture. Rejects if access is
   * denied or the device is gone (an OverconstrainedError for a missing deviceId).
   */
  async start(input: TunerInput): Promise<void> {
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: input.deviceId ? { exact: input.deviceId } : undefined,
        // Interfaces usually pair inputs 1 and 2; ask for both so either can be picked.
        channelCount: { ideal: 2 },
        // Voice processing is made for speech and smears or gates a sustained note.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.stream = stream;
    this.channels = stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
    this.ctx ??= new AudioContext();
    if (this.ctx.state !== 'running') await this.ctx.resume();

    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = new AnalyserNode(this.ctx, { fftSize: FRAME_SIZE });
    if (this.channels < 2) {
      source.connect(this.analyser);
      this.nodes = [source];
    } else if (input.channel === 'mix') {
      // The analyser averages the channels, which would halve a guitar on one input
      // with nothing on the other; doubling first makes it a sum.
      const sum = new GainNode(this.ctx, { gain: 2 });
      source.connect(sum).connect(this.analyser);
      this.nodes = [source, sum];
    } else {
      const splitter = this.ctx.createChannelSplitter(this.channels);
      source.connect(splitter).connect(this.analyser, input.channel);
      this.nodes = [source, splitter];
    }
    this.raf = requestAnimationFrame(this.analyse);
  }

  stop(): void {
    if (!this.running) return;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.nodes.forEach((n) => n.disconnect());
    this.nodes = [];
    this.analyser = null;
    this.history = [];
    // Suspending releases the audio device; the context is reused on the next start.
    void this.ctx?.suspend();
    this.emit('pitch', null);
  }

  private analyse = (): void => {
    if (!this.analyser || !this.ctx) return;
    this.analyser.getFloatTimeDomainData(this.frame);
    const pitch = detectPitch(this.frame, this.ctx.sampleRate, { minRms: MIN_RMS });
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
