// Runs the scheduler's heartbeat off the main thread. Timers in workers keep firing
// when the UI is busy and are throttled less than main-thread timers in background tabs.
declare const self: {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<{ command: 'start'; intervalMs: number } | { command: 'stop' }>) => void) | null;
};

let timer: ReturnType<typeof setInterval> | undefined;

self.onmessage = ({ data }) => {
  clearInterval(timer);
  if (data.command === 'start') timer = setInterval(() => self.postMessage('tick'), data.intervalMs);
};

export {};
