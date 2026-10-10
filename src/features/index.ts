import { beatDisplay } from './beatDisplay';
import type { Feature } from './feature';
import { meter } from './meter';
import { presets } from './presets';
import { sound } from './sound';
import { speedTrainer } from './speedTrainer';
import { tapTempo } from './tapTempo';
import { tempo } from './tempo';
import { transport } from './transport';

/** The app's features, in display order. Add, remove or reorder features here. */
export const FEATURES: Feature[] = [beatDisplay, tempo, transport, tapTempo, meter, sound, speedTrainer, presets];
