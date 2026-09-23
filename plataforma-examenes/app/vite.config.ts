import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Los paquetes cifrados y config.json viven fuera de la app (plataforma-examenes/).
// En desarrollo se sirven desde ahí; al compilar se copian a dist/.
const RAIZ = resolve(import.meta.dirname, '..');

function examenes(): Plugin {
  return {
    name: 'examenes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const ruta = url === '/config.json' ? resolve(RAIZ, 'config.json')
          : /^\/examenes\/[\w-]+\.json$/.test(url) ? resolve(RAIZ, url.slice(1)) : null;
        if (!ruta || !existsSync(ruta)) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(ruta));
      });
    },
    closeBundle() {
      const dist = resolve(import.meta.dirname, 'dist');
      cpSync(resolve(RAIZ, 'config.json'), resolve(dist, 'config.json'));
      if (existsSync(resolve(RAIZ, 'examenes'))) cpSync(resolve(RAIZ, 'examenes'), resolve(dist, 'examenes'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), examenes()],
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
});
