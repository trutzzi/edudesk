import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Node's own Web Storage shadows the jsdom localStorage
    execArgv: ['--no-experimental-webstorage'],
    coverage: {
      provider: 'v8',
      include: ['app/**', 'components/**', 'features/**', 'lib/**', 'i18n/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // Route files only render a feature; the features are tested directly
        'app/**',
        // Server-only Next wiring (cookies, request config) that needs a running Next to exercise
        'i18n/request.ts',
        'i18n/actions.ts',
      ],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
