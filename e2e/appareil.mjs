// Navigateur « appareil » du test E2E et connexion au compte de test — STAGING uniquement.
// Partagé par la vérification préalable (globalSetup) et le test.
import { existsSync, writeFileSync } from 'node:fs';
import { chargerCibleStaging, destinationAutorisee, STAGING_HOST, STAGING_REF } from './env-staging.mjs';

const CIBLE = chargerCibleStaging();

/** Fichier marqueur posé dès qu'une connexion échoue : plus AUCUNE nouvelle tentative ensuite. */
export const fichierArret = () => process.env.E2E_FICHIER_ARRET || '';
export function verifierPasDArret() {
  const f = fichierArret();
  if (f && existsSync(f)) throw new Error('ARRÊT : une connexion a déjà échoué dans ce passage — aucune nouvelle tentative.');
}
function poserArret() { const f = fichierArret(); if (f) { try { writeFileSync(f, 'connexion échouée'); } catch {} } }

export async function nouvelAppareil(browser, { baseURL } = {}) {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  // Garde-fou n°2 : le navigateur ne peut joindre QUE l'app locale et la base staging,
  // en HTTP comme en WebSocket (temps réel). Toute autre base Supabase est notée et bloquée.
  const bloquees = [];
  const noter = adresse => { try { const h = new URL(adresse).hostname; if (h.endsWith('.supabase.co') && h !== STAGING_HOST) bloquees.push(h); } catch {} };
  await context.route('**/*', route => {
    const adresse = route.request().url();
    if (destinationAutorisee(adresse)) return route.continue();
    noter(adresse); return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(/.*/, ws => {
    if (destinationAutorisee(ws.url())) { ws.connectToServer(); return; }
    noter(ws.url()); ws.close();
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('cyna_onboarding_done', '1');
      localStorage.setItem('cyna_storage_mode', 'user');
    } catch {}
  });
  const page = await context.newPage();
  // Diagnostic temps réel : statut d'abonnement postgres_changes et nombre d'événements reçus.
  const realtime = { statuts: [], evenements: 0 };
  page.on('websocket', ws => {
    if (!/realtime/.test(ws.url())) return;
    ws.on('framereceived', f => {
      const t = typeof f.payload === 'string' ? f.payload : '';
      if (!t.includes('postgres_changes')) return;
      try {
        const m = JSON.parse(t);
        const [evenement, charge] = Array.isArray(m) ? [m[3], m[4]] : [m.event, m.payload];
        if (evenement === 'postgres_changes') realtime.evenements += 1;
        if (evenement === 'system') realtime.statuts.push(`${charge?.status} : ${String(charge?.message || '').slice(0, 70)}`);
      } catch {}
    });
  });
  return { context, page, realtime, bloquees };
}
export async function connecter(page) {
  verifierPasDArret();
  try {
    await connecterUneFois(page);
  } catch (e) {
    poserArret();
    throw e;
  }
}
async function connecterUneFois(page) {
  await page.goto('/');
  // R4 — toute erreur de saisie est remplacée par un message générique : le journal d'erreur
  // de Playwright pourrait sinon recopier la valeur saisie.
  try {
    await page.getByPlaceholder('votre@email.com').fill(CIBLE.email, { timeout: 20_000 });
    await page.getByPlaceholder('••••••••').fill(CIBLE.motDePasse, { timeout: 20_000 });
    await page.locator('button[type="submit"]').click({ timeout: 20_000 });
  } catch {
    throw new Error('ARRÊT : saisie des identifiants impossible (détails masqués).');
  }
  const ok = page.getByPlaceholder('votre@email.com').waitFor({ state: 'detached', timeout: 30_000 }).then(() => 'ok');
  const ko = page.getByText('⚠').first().waitFor({ timeout: 30_000 }).then(() => 'ko');
  if ((await Promise.race([ok, ko]).catch(() => 'ko')) !== 'ok') throw new Error('ARRÊT : la connexion du compte de test a échoué.');
  // La session ouverte par l'app doit être celle de staging (preuve que l'app parle à staging).
  const cleSession = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token')));
  if (cleSession !== `sb-${STAGING_REF}-auth-token`) throw new Error("ARRÊT : la session ouverte par l'app n'est pas celle de staging.");
}
