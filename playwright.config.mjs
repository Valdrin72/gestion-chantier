// Test de bout en bout (E2E) du correctif anti-écrasement — STAGING uniquement.
// - La cible Supabase est VALIDÉE (origine exacte = staging) avant de lancer quoi que ce soit,
//   puis transmise EXPLICITEMENT au serveur de dev : une variable héritée de la session ou un
//   autre fichier .env ne peut pas la remplacer (les variables du shell priment dans CRA).
// - Mode de stockage forcé à 'user' (celui de la production) ; .env.local n'est pas modifié.
// - Navigateur : le Chrome installé sur le poste (aucun navigateur Playwright téléchargé).
// - Aucune trace, capture d'écran ni vidéo (rien qui puisse contenir les identifiants).
import { defineConfig } from '@playwright/test';
import { chargerCibleStaging } from './e2e/env-staging.mjs';

const PORT = 3123;
const cible = chargerCibleStaging();

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.mjs/,
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1366, height: 900 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      BROWSER: 'none',
      REACT_APP_STORAGE_MODE: 'user',
      REACT_APP_SUPABASE_URL: cible.url,
      REACT_APP_SUPABASE_ANON_KEY: cible.anon,
    },
  },
});
