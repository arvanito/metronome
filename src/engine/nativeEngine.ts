import { Emitter } from '../core/emitter';
import type { Accent, MetronomeSettings, TickKind, TrainerSettings } from '../core/types';
import type { Engine, EngineEvents } from './engine';

/** The bridge JUCE's WebBrowserComponent injects into the page. */
interface JuceBackend {
  emitEvent(eventId: string, payload: unknown): void;
  addEventListener(eventId: string, fn: (payload: unknown) => void): unknown;
}

/** Messages from the native app (see MainComponent.cpp in metronome-juce). */
type NativeMessage =
  | { type: 'beat'; bar: number; beat: number; sub: number; kind: TickKind }
  | { type: 'bar'; bars: number }
  | { type: 'tempo'; bpm: number };

const EVENT_ID = 'metronome';
const ACCENT_CODES: Record<Accent, string> = { strong: 'S', normal: 'N', mute: 'M' };

/** Returns the JUCE bridge when running inside the native app, otherwise null. */
export function juceBackend(): JuceBackend | null {
  const juce = (window as unknown as { __JUCE__?: { backend?: JuceBackend } }).__JUCE__;
  return juce?.backend ?? null;
}

/**
 * Engine that forwards everything to the native (C++/JUCE) audio engine, which
 * schedules clicks sample-accurately inside its audio callback.
 */
export class NativeEngine extends Emitter<EngineEvents> implements Engine {
  constructor(private readonly backend: JuceBackend) {
    super();
    backend.addEventListener(EVENT_ID, (payload) => {
      const msg = payload as NativeMessage;
      if (msg.type === 'beat') this.emit('beat', { bar: msg.bar, beat: msg.beat, sub: msg.sub, kind: msg.kind });
      else if (msg.type === 'bar') this.emit('bar', msg.bars);
      else if (msg.type === 'tempo') this.emit('tempo', msg.bpm);
    });
  }

  async start(): Promise<void> {
    this.send({ type: 'start' });
  }

  stop(): void {
    this.send({ type: 'stop' });
  }

  update(settings: MetronomeSettings, trainer: TrainerSettings): void {
    // Accents travel as a compact string ("SNNM"), the format the native settings parser reads.
    const accents = settings.accents.map((a) => ACCENT_CODES[a]).join('');
    this.send({ type: 'update', settings: { ...settings, accents }, trainer });
  }

  openAudioSettings = (): void => this.send({ type: 'audioSettings' });

  private send(message: Record<string, unknown>): void {
    this.backend.emitEvent(EVENT_ID, message);
  }
}
