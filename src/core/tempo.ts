export const MIN_BPM = 20;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

// Upper bound (exclusive) for each traditional Italian tempo marking.
const MARKINGS: [limit: number, name: string][] = [
  [24, 'Larghissimo'],
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [156, 'Allegro'],
  [176, 'Vivace'],
  [200, 'Presto'],
  [Infinity, 'Prestissimo'],
];

export function tempoMarking(bpm: number): string {
  return MARKINGS.find(([limit]) => bpm < limit)![1];
}
