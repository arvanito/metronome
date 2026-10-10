import { h, onKey } from '../ui/dom';
import type { Feature } from './feature';

/** Start/stop button and the Space shortcut. Keeps the screen awake while playing. */
export const transport: Feature = {
  id: 'transport',
  mount(root, { store }) {
    const toggle = () => store.set((s) => ({ playing: !s.playing }));
    const button = h('button', { class: 'play-btn', type: 'button', onclick: toggle });
    root.append(button);

    const render = () => {
      const { playing } = store.get();
      button.textContent = playing ? 'Stop' : 'Start';
      button.setAttribute('aria-pressed', String(playing));
    };
    render();
    store.subscribe((s, prev) => {
      if (s.playing === prev.playing) return;
      render();
      if (s.playing) wakeLock.acquire();
      else wakeLock.release();
    });

    onKey([' '], toggle);
    // The browser drops the wake lock when the page is hidden; take it back on return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && store.get().playing) wakeLock.acquire();
    });
  },
};

const wakeLock = {
  sentinel: null as WakeLockSentinel | null,
  async acquire() {
    try {
      this.sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not supported, not a secure context, or denied: playing still works.
    }
  },
  release() {
    void this.sentinel?.release();
    this.sentinel = null;
  },
};
