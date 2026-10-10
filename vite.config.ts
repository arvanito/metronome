import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any folder (GitHub Pages, Capacitor, Tauri…).
  base: './',
  // Expose the dev server on the local network so you can open it on your phone.
  server: { host: true },
  build: {
    rollupOptions: {
      // The sound audition page is shipped alongside the app.
      input: { main: 'index.html', audition: 'audition.html' },
    },
  },
});
