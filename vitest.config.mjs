import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/calculs/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/calculs/**/*.js'],
      exclude: ['**/*.test.js', '**/__fixtures__/**'],
      thresholds: { lines: 90, functions: 95, branches: 85 },
    },
  },
});
