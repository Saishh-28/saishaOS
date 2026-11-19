import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Runs worker.ts (the real production Worker) inside `vite dev`, so local
      // API calls go through the same code that's deployed. Worker secrets for
      // local dev come from .dev.vars (git-ignored). Skipped under Vitest.
      ...(mode === 'test' ? [] : [cloudflare()]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
