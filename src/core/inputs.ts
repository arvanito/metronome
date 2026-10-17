/** Short names for audio inputs, from the labels the operating system gives them. */

export interface InputName {
  /** e.g. "MOTU", "Scarlett 2i2" or "Mic (HD Pro Webcam C920)". */
  device: string;
  /** The physical inputs a stereo-pair device carries (left, right), when the label says so. */
  pair: [number, number] | null;
}

/** USB vendor ids of common audio interface makers. */
const VENDORS: Record<string, string> = {
  '07fd': 'MOTU',
  '1235': 'Focusrite',
  '0582': 'Roland',
  '0499': 'Yamaha',
  '1397': 'Behringer',
  '194f': 'PreSonus',
  '0763': 'M-Audio',
  '17cc': 'Native Instruments',
};

/**
 * Audio interfaces often appear as one device per input pair, labelled like
 * "Mic/Line/Inst In 1-2 (UltraLite-mk5) (07fd:000c)": the pair, the model, then a USB id
 * (vendor:product). That becomes "MOTU" with the pair 1, 2. Microphones become "Mic (…)".
 */
export function describeInput(label: string): InputName {
  const usb = /\s*\(([0-9a-f]{4}):[0-9a-f]{4}\)\s*$/i.exec(label);
  const clean = (usb ? label.slice(0, usb.index) : label).trim();
  const pair = /\bIn(?:puts?)?\s*(\d+)\s*[-–+&]\s*(\d+)\b/i.exec(clean);
  if (!pair) return { device: clean.replace(/^Microphone\b/i, 'Mic'), pair: null };
  const model = /\(([^()]+)\)\s*$/.exec(clean)?.[1].trim();
  return {
    device: VENDORS[usb?.[1].toLowerCase() ?? ''] ?? model ?? clean,
    pair: [Number(pair[1]), Number(pair[2])],
  };
}
