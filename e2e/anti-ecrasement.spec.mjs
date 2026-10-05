// E2E anti-écrasement (mode 'user') — deux navigateurs indépendants, même compte, base STAGING.
// Sécurité : refuse de démarrer si .env.local ne pointe pas vers staging, et bloque toute
// requête vers la prod dans chaque navigateur. Les identifiants ne sont jamais affichés.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging, destinationAutorisee, STAGING_HOST, STAGING_REF } from './env-staging.mjs';

const MARQUEUR = '__cyna_storage__';
// Garde-fou n°1 : origine EXACTE de staging (sinon arrêt avant tout).
const CIBLE = chargerCibleStaging();
const URL_SUPABASE = CIBLE.url;
const ANON = CIBLE.anon;

// Identifiant de passage : rendu unique par worker (un worker est relancé après un échec).
const RUN = `e2e${Date.now().toString(36)}`;
const NOMS = { a: `A ${RUN}`, b: `B ${RUN}`, c: `C ${RUN}`, d: `D ${RUN}` };
const etiquette = cle => `Test ${NOMS[cle]}`;
const resultat = msg => console.log(`RÉSULTAT ${msg}`);

// ── Accès serveur (lecture seule, REST staging, jeton du compte de test) ────────
async function jeton(page) {
  return page.evaluate(() => {
    const cle = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return cle ? JSON.parse(localStorage.getItem(cle)).access_token : null;
  });
}
async function lireLignes(page) {
  const t = await jeton(page);
  const r = await fetch(`${URL_SUPABASE}/rest/v1/devis?select=id,numero,version,data&numero=eq.${MARQUEUR}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error(`Lecture REST staging en échec (HTTP ${r.status})`);
  return r.json();
}
async function lireBlob(page) {
  const lignes = await lireLignes(page);
  expect(lignes, 'exactement une ligne __cyna_storage__').toHaveLength(1);
  return lignes[0];
}
const clientServeur = (ligne, cle) => (ligne.data.clients || []).find(c => c.nom === NOMS[cle]);
async function attendreServeur(page, predicat, delai = 20_000) {
  const fin = Date.now() + delai;
  let ligne;
  while (Date.now() < fin) {
    ligne = await lireBlob(page);
    if (predicat(ligne)) return ligne;
    await page.waitForTimeout(500);
  }
  return null;
}

// ── Navigateur / interface ────────────────────────────────────────────────────
async function nouvelAppareil(browser) {
  const context = await browser.newContext();
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
async function connecter(page) {
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
async function allerClients(page) {
  // « Clients » est un sous-menu de la maison « Finances » (src/nav/maisons.js). Le menu latéral
  // peut être hors de la zone visible : clic déclenché directement sur l'élément.
  const clients = page.getByRole('navigation').getByText('Clients', { exact: true });
  if (!(await clients.count())) await page.getByRole('button', { name: 'Développer Finances', exact: true }).dispatchEvent('click');
  await clients.dispatchEvent('click');
  await expect(page.getByRole('button', { name: /Nouveau client/ }).first()).toBeVisible({ timeout: 20_000 });
}
async function recharger(app) { await app.page.reload(); await allerClients(app.page); }
async function creerClient(page, cle) {
  await page.getByRole('button', { name: /Nouveau client/ }).first().click();
  await page.getByPlaceholder('Marc').fill('Test');
  await page.getByPlaceholder('Dupont', { exact: true }).fill(NOMS[cle]);
  await page.getByRole('button', { name: 'Créer le client' }).click();
  await expect(page.getByText(etiquette(cle), { exact: true })).toBeVisible();
}
function ligneClient(page, cle) {
  return page.locator('div')
    .filter({ has: page.getByText(etiquette(cle), { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /Modifier/ }) })
    .last();
}
async function ouvrirEdition(page, cle) {
  await ligneClient(page, cle).getByRole('button', { name: /Modifier/ }).click();
  return page.getByPlaceholder('Informations complémentaires, préférences, historique...');
}
async function modifierNotes(page, cle, texte, { enregistrer = true } = {}) {
  const notes = await ouvrirEdition(page, cle);
  await notes.fill(texte);
  if (enregistrer) await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
}
const copiesRejetees = page => page.evaluate(() => Object.keys(localStorage)
  .filter(k => k.startsWith('cyna_sauvegarde_rejetee_'))
  .map(k => JSON.parse(localStorage.getItem(k))));
const aCopie = (copies, cle, texte) => copies.some(c => (c.clients || []).some(x => x.nom === NOMS[cle] && x.notes === texte));
const alertes = async page => (await page.getByRole('alert').allInnerTexts()).join(' | ');

// ── Scénarios ─────────────────────────────────────────────────────────────────
// Mode par défaut (pas « serial ») : un scénario en échec n'empêche pas les suivants de tourner.
test.describe('E2E anti-écrasement — staging, mode user', () => {
  let A, B, versionInitiale;

  test.beforeAll(async ({ browser }) => {
    A = await nouvelAppareil(browser);
    B = await nouvelAppareil(browser);
    await connecter(A.page);
    await connecter(B.page);
    versionInitiale = (await lireBlob(A.page)).version;
    expect(typeof versionInitiale, 'colonne version présente (migration appliquée)').toBe('number');
    await allerClients(A.page);
    for (const cle of ['a', 'b', 'c', 'd']) await creerClient(A.page, cle);
    const cree = await attendreServeur(A.page, l => ['a', 'b', 'c', 'd'].every(k => clientServeur(l, k)));
    expect(cree, 'création des 4 clients de test enregistrée').toBeTruthy();
    // Mise en place : B reçoit-il les nouveaux clients par le temps réel, sans recharger ?
    await allerClients(B.page);
    const recuEnDirect = await B.page.getByText(etiquette('d'), { exact: true }).waitFor({ timeout: 20_000 }).then(() => true, () => false);
    if (!recuEnDirect) { await recharger(B); await expect(B.page.getByText(etiquette('d'), { exact: true })).toBeVisible({ timeout: 20_000 }); }
    resultat(`mise en place — clients de test « ${RUN} » créés ; version de départ ${versionInitiale} ; B les a reçus ${recuEnDirect ? 'EN DIRECT (temps réel)' : 'seulement après rechargement'} ; temps réel (B) : ${JSON.stringify(B.realtime)}`);
  });

  test.afterAll(async () => {
    const autres = [...(A?.bloquees || []), ...(B?.bloquees || [])];
    resultat(`garde-fou réseau — tentatives vers une autre base Supabase : ${autres.length ? [...new Set(autres)].join(', ') : 'aucune'}`);
    await A?.context.close(); await B?.context.close();
  });

  test('(a) A modifie « Test A », B modifie « Test B » sans recharger → les deux existent', async () => {
    const texteA = `notes A ${RUN}`, texteB = `notes B ${RUN}`;
    await modifierNotes(A.page, 'a', texteA);
    expect(await attendreServeur(A.page, l => clientServeur(l, 'a')?.notes === texteA), 'sauvegarde de A').toBeTruthy();
    await B.page.waitForTimeout(2_000); // laisser au temps réel le temps de livrer la sauvegarde de A à B
    await modifierNotes(B.page, 'b', texteB);
    const ligne = await attendreServeur(A.page, l => clientServeur(l, 'b')?.notes === texteB, 12_000);
    if (!ligne) {
      const vu = await alertes(B.page);
      const copie = aCopie(await copiesRejetees(B.page), 'b', texteB);
      const serveur = await lireBlob(A.page);
      const sansPerteSilencieuse = /entre-temps/.test(vu) && copie;
      resultat(`(a) ÉCHEC — modification de B NON enregistrée (A enregistrée : ${clientServeur(serveur, 'a')?.notes === texteA ? 'oui' : 'NON'}). `
        + `B a vu : « ${vu || 'aucun message'} » ; copie de secours de B : ${copie ? 'présente' : 'ABSENTE'} ; `
        + `temps réel (B) : ${JSON.stringify(B.realtime)} → ${sansPerteSilencieuse ? 'pas de perte silencieuse, mais résultat attendu non atteint' : 'PERTE SILENCIEUSE'}`);
    }
    expect(ligne, 'la modification de B est enregistrée sans rechargement de B').toBeTruthy();
    expect(clientServeur(ligne, 'a').notes).toBe(texteA);
    // Après rechargement, les deux modifications sont visibles dans l'app, sur les deux appareils.
    for (const app of [A, B]) {
      await recharger(app);
      expect(await (await ouvrirEdition(app.page, 'a')).inputValue()).toBe(texteA);
      await recharger(app);
      expect(await (await ouvrirEdition(app.page, 'b')).inputValue()).toBe(texteB);
      await recharger(app);
    }
    resultat(`(a) OK — les deux modifications sont enregistrées et visibles après rechargement (version ${ligne.version})`);
  });

  test('(b) A et B modifient le même client presque en même temps → aucune perte silencieuse', async () => {
    await recharger(A); await recharger(B);
    const texteA = `conflit A ${RUN}`, texteB = `conflit B ${RUN}`;
    await modifierNotes(A.page, 'c', texteA, { enregistrer: false });
    await modifierNotes(B.page, 'c', texteB, { enregistrer: false });
    // R3 — observation lancée AVANT les clics (le message de la garde disparaît après 3 s).
    const observer = p => Promise.any([
      p.getByText(/Quelqu'un a enregistré entre-temps/).first().waitFor({ timeout: 15_000 }).then(() => 'conflit'),
      p.getByText(/modifié sur un autre appareil/).first().waitFor({ timeout: 15_000 }).then(() => 'garde'),
    ]).catch(() => 'aucun message');
    const vus = { A: observer(A.page), B: observer(B.page) };
    const bouton = p => p.getByRole('button', { name: 'Enregistrer les modifications' });
    await Promise.all([bouton(A.page).click(), bouton(B.page).click()]);
    // État du serveur attendu séparément de l'observation des messages.
    const ligne = await attendreServeur(A.page, l => [texteA, texteB].includes(clientServeur(l, 'c')?.notes));
    expect(ligne, 'le serveur contient la version de A ou de B').toBeTruthy();
    const final = clientServeur(ligne, 'c').notes;
    const [gagnant, perdant, nomPerdant, textePerdant] = final === texteA ? ['A', B, 'B', texteB] : ['B', A, 'A', texteA];
    const vuPerdant = await vus[nomPerdant];
    const vuGagnant = await vus[gagnant];
    // R2 — dans TOUS les cas de refus, la modification du perdant doit exister en copie de secours.
    const copie = aCopie(await copiesRejetees(perdant.page), 'c', textePerdant);
    const ok = vuPerdant !== 'aucun message' && copie;
    resultat(`(b) ${ok ? 'OK' : 'ÉCHEC'} — ${gagnant} gagne (version ${ligne.version}) ; le perdant (${nomPerdant}) voit : ${vuPerdant} ; copie de secours du perdant : ${copie ? 'présente' : 'ABSENTE'} ; le gagnant voit : ${vuGagnant}`);
    expect(vuPerdant, 'le perdant voit un message').not.toBe('aucun message');
    expect(copie, 'copie de secours du perdant présente').toBe(true);
  });

  test('(c) réseau coupé pendant une modification → « Non enregistré », puis Réessayer sauvegarde', async () => {
    await recharger(A);
    const texte = `hors ligne ${RUN}`;
    await A.context.setOffline(true);
    await modifierNotes(A.page, 'd', texte);
    const bandeau = A.page.getByRole('alert').filter({ hasText: 'Non enregistré' });
    await expect(bandeau).toBeVisible({ timeout: 15_000 });
    await A.context.setOffline(false);
    await A.page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(bandeau).toHaveCount(0, { timeout: 15_000 });
    const ligne = await attendreServeur(A.page, l => clientServeur(l, 'd')?.notes === texte);
    expect(ligne, 'sauvegarde après Réessayer').toBeTruthy();
    resultat(`(c) OK — bandeau « Non enregistré » affiché hors ligne, puis sauvegarde réussie après Réessayer (version ${ligne.version})`);
  });

  test("(d) lecture qui échoue au démarrage → écran d'erreur et aucune écriture", async ({ browser }) => {
    const avant = await lireBlob(A.page);
    const C = await nouvelAppareil(browser);
    const ecritures = [];
    C.page.on('request', r => {
      if (/\/rest\/v1\//.test(r.url()) && !['GET', 'HEAD'].includes(r.method())) ecritures.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    await C.context.route(/\/rest\/v1\/devis/, route => (route.request().method() === 'GET' ? route.abort('failed') : route.continue()));
    await connecter(C.page);
    await expect(C.page.getByText("Vos données n'ont pas pu être chargées")).toBeVisible({ timeout: 20_000 });
    await expect(C.page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await expect(C.page.getByRole('button', { name: /Nouveau client/ })).toHaveCount(0);
    await C.page.waitForTimeout(4_000);
    const apres = await lireBlob(A.page);
    await C.context.close();
    resultat(`(d) ${ecritures.length === 0 && apres.version === avant.version ? 'OK' : 'ÉCHEC'} — écran d'erreur affiché ; écritures REST : ${ecritures.length} ; version ${avant.version} → ${apres.version}`);
    expect(ecritures, 'aucune écriture REST').toEqual([]);
    expect(apres.version, 'version inchangée').toBe(avant.version);
  });

  test('état final — colonne version', async () => {
    const lignes = await lireLignes(A.page);
    expect(lignes).toHaveLength(1);
    const { version } = lignes[0];
    expect(Number.isInteger(version)).toBe(true);
    expect(version).toBeGreaterThan(versionInitiale);
    for (const cle of ['a', 'b', 'c', 'd']) expect(clientServeur(lignes[0], cle), `client ${etiquette(cle)} présent`).toBeTruthy();
    resultat(`état final — 1 seule ligne __cyna_storage__ ; version entière ${versionInitiale} → ${version} ; 4 clients de test présents (${RUN})`);
  });
});
