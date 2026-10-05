import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { JWT_SECRET: 'test-secret' },
    // supertest binds a random local port per request; on a busy dev machine another local process now and
    // then answers on it. A genuine failure still fails all three attempts.
    retry: 2,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Entry points and command-line tools: they only wire things together or talk to a real database
        'src/index.ts',
        'src/scripts/**',
        '**/*.d.ts',
      ],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
