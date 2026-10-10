import type { TrainerSettings } from './types';

/** True when `barsCompleted` bars have been played and it is time for a tempo step. */
export function shouldStep(barsCompleted: number, everyBars: number): boolean {
  return barsCompleted > 0 && barsCompleted % everyBars === 0;
}

/** Moves `bpm` one step towards the target without overshooting it. */
export function trainerStep(bpm: number, trainer: TrainerSettings): number {
  const direction = Math.sign(trainer.targetBpm - bpm);
  if (direction === 0) return bpm;
  const next = bpm + direction * trainer.stepBpm;
  return direction > 0 ? Math.min(next, trainer.targetBpm) : Math.max(next, trainer.targetBpm);
}
