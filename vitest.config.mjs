import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/calculs/**/*.test.js',
      'src/modules/alertes/**/*.test.js',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/calculs/**/*.js', 'src/modules/alertes/lib/**/*.js'],
      exclude: ['**/*.test.js', '**/__fixtures__/**', '**/__tests__/**'],
      thresholds: { lines: 90, functions: 95, branches: 85 },
    },
  },
});
