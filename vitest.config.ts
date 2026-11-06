import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, '.tools/**', '.pages-build/**', '.desktop-build/**', 'src-tauri/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@reader/runtime': path.resolve(__dirname, './lib/reader-runtime.ts'),
      '@reader/handler': path.resolve(__dirname, './lib/source-handler.ts'),
      'server-only': path.resolve(__dirname, 'node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },
});
