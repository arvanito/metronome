import { createApp } from './app';
import { juceBackend } from './engine/nativeEngine';
import { FEATURES } from './features';
import './styles.css';

const app = createApp(document.querySelector<HTMLElement>('#app')!, FEATURES);

// Handy for poking at the app from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { app });

// Offline support and "install app" on Android/Windows. Only in production builds (so
// the dev server never serves stale cached files), and not inside the native app,
// which serves the files itself.
if (import.meta.env.PROD && !juceBackend() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed', err));
  });
}
