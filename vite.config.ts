import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['yjs'] },
  worker: { format: 'es' },
  server: { proxy: { '/api': 'http://localhost:3101' } },
});
