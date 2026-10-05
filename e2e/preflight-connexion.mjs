// Vérification préalable UNIQUE (globalSetup) : une seule tentative de connexion au compte de
// test sur staging, avant tout scénario. Si elle échoue, Playwright n'exécute AUCUN test.
// Aucune session n'est enregistrée sur le disque.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connecter, nouvelAppareil } from './appareil.mjs';

export default async function preflight(config) {
  const dossier = mkdtempSync(join(tmpdir(), 'cyna-e2e-'));
  // Hérité par les workers : un échec de connexion pendant un scénario bloque les suivants.
  process.env.E2E_FICHIER_ARRET = join(dossier, 'arret');
  const baseURL = config.projects[0].use.baseURL;
  const navigateur = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { context, page } = await nouvelAppareil(navigateur, { baseURL });
    await connecter(page);
    await context.close();
  } finally {
    await navigateur.close();
  }
  return () => { try { rmSync(dossier, { recursive: true, force: true }); } catch {} };
}
