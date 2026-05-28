import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Vite 8 uses OXC as its default JS transformer. OXC's .js parser mode does
 * not accept JSX syntax — it requires .jsx extension. Since our React source
 * files use .js extension with JSX (CRA convention), we pre-transform them
 * with Babel before OXC runs.
 */
function babelJsxInJs() {
  const babel = require('@babel/core');
  return {
    name: 'babel-jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.includes('/src/') || !id.endsWith('.js') || id.includes('node_modules')) {
        return null;
      }
      if (!code.includes('<')) return null;
      const result = await babel.transformAsync(code, {
        filename: id,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        sourceMaps: true,
        configFile: false,
        babelrc: false,
      });
      if (!result) return null;
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [babelJsxInJs(), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    include: [
      'src/calculs/**/*.test.js',
      'src/modules/alertes/**/*.test.js',
      'src/**/__tests__/**/*.test.js',
      'src/**/__tests__/**/*.test.jsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/calculs/**/*.js', 'src/modules/alertes/lib/**/*.js'],
      exclude: ['**/*.test.js', '**/__fixtures__/**', '**/__tests__/**'],
      thresholds: { lines: 90, functions: 95, branches: 85 },
    },
  },
});
