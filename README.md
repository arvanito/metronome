# Metronome

A precise, modular metronome web app. It runs in any modern browser and can be installed
as an app on Android and Windows. It has no runtime dependencies; the dev tools are Vite,
TypeScript and Vitest.

## Features

- 20–300 BPM: editable number, −/+ buttons (hold to repeat), slider, arrow keys (Shift = ±5)
- Italian tempo names (Largo, Andante, Allegro…)
- Tap tempo (button or `T`)
- Time signatures 1–16 beats per bar, with note value 2/4/8/16
- Accent, normal or mute for each beat (tap a beat light)
- Subdivisions: 8ths, triplets, 16ths
- Four synthesised sounds (click, beep, wood block, cowbell) and volume
- Speed trainer: change the tempo by N BPM every M bars, up to a target
- Tuner: chromatic, via the microphone, with a guitar string guide and adjustable A4 (415–466 Hz)
- Presets saved on the device
- Remembers your settings, keeps the screen awake while playing, works offline once installed
- `Space` starts and stops

## Commands

```bash
npm install       # once
npm run dev       # dev server at http://localhost:5173 (also reachable on your local network)
npm test          # unit tests
npm run build     # production build in dist/
npm run preview   # serve the production build locally
npm run icons     # regenerate the PNG app icons
```

## How the timing works

Timers in JavaScript (`setInterval`) jitter by several milliseconds. They are never used to
make sound directly. Instead, a worker-thread heartbeat runs every 25 ms. On each heartbeat,
[`Scheduler`](src/engine/scheduler.ts) queues every click due in the next 100 ms on the Web Audio
clock, which is sample-accurate. Beat lights are fired when each click actually reaches the
speakers, adjusted for output latency.

## Project structure

```
src/
  core/       Pure logic, no DOM or audio: rhythm, tempo, tap tempo, speed trainer, pitch detection, settings, store
  engine/     Audio: lookahead scheduler, synthesised sounds, Web Audio glue, timer worker, tuner input
  features/   One file per feature; the list in features/index.ts decides what appears
  ui/         Small DOM helpers
  state.ts    App state + saving to localStorage
  app.ts      Wires the store, the engine and the features together
public/       Web app manifest, service worker, icons
```

### Adding a feature

1. Create `src/features/myFeature.ts` exporting a `Feature`:

   ```ts
   export const myFeature: Feature = {
     id: 'my-feature',
     mount(root, { store, metronome }) {
       // Render into `root`, subscribe to `store`, listen to metronome.on('beat' | 'bar', …)
     },
   };
   ```

2. Add it to the list in [`src/features/index.ts`](src/features/index.ts).

Features only talk to the shared store and the metronome's events, never to each other, so any
feature can be removed by deleting its line. A new sound is one more entry in `SOUNDS` in
[`src/engine/sounds.ts`](src/engine/sounds.ts).

## Running on Android and Windows

- **On your phone while developing:** run `npm run dev` and open the "Network" URL it prints
  (same Wi-Fi). Note that installing the app and keeping the screen awake only work over HTTPS or on localhost.
- **Install as an app:** deploy `dist/` to any HTTPS static host (GitHub Pages, Netlify,
  Cloudflare Pages). Then use "Install app" in Chrome or Edge on Windows, or "Add to Home screen"
  in Chrome on Android.
- **Store builds later:** wrap the same `dist/` with Capacitor (Android) or Tauri (Windows).
  The build uses relative paths, so it works in both.

Known limitation: Android may pause web audio when the screen is off. The app keeps the screen awake while
playing; a Capacitor wrapper with a foreground service would remove this limitation.
