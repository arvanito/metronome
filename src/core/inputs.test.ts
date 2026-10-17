import { describe, expect, it } from 'vitest';
import { describeInput } from './inputs';

describe('describeInput', () => {
  it('names interface input pairs by maker', () => {
    expect(describeInput('Mic/Line/Inst In 1-2 (UltraLite-mk5) (07fd:000c)')).toEqual({ device: 'MOTU', pair: [1, 2] });
    expect(describeInput('Line In 3-4 (UltraLite-mk5) (07FD:000C)')).toEqual({ device: 'MOTU', pair: [3, 4] });
  });

  it('falls back to the model name for unknown makers', () => {
    expect(describeInput('Input 1+2 (Some Interface) (abcd:0001)')).toEqual({ device: 'Some Interface', pair: [1, 2] });
    expect(describeInput('Analogue In 1-2 (Scarlett 2i2)')).toEqual({ device: 'Scarlett 2i2', pair: [1, 2] });
  });

  it('shortens microphones and drops USB ids', () => {
    expect(describeInput('Microphone (HD Pro Webcam C920) (046d:082d)')).toEqual({ device: 'Mic (HD Pro Webcam C920)', pair: null });
    expect(describeInput('Headset Microphone')).toEqual({ device: 'Headset Microphone', pair: null });
  });
});
