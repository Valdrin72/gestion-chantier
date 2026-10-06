// E2E anti-écrasement (mode 'user') — deux navigateurs indépendants, même compte, base STAGING.
// Sécurité : refuse de démarrer si .env.local ne pointe pas vers staging, et bloque toute
// requête vers la prod dans chaque navigateur. Les identifiants ne sont jamais affichés.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';

const MARQUEUR = '__cyna_storage__';
// Garde-fou n°1 : origine EXACTE de staging (sinon arrêt avant tout).
const CIBLE = chargerCibleStaging();
const URL_SUPABASE = CIBLE.url;
const ANON = CIBLE.anon;

// Identifiant de passage : rendu unique par worker (un worker est relancé après un échec).
const RUN = `e2e${Date.now().toString(36)}`;
const NOMS = { a: `A ${RUN}`, b: `B ${RUN}`, c: `C ${RUN}`, d: `D ${RUN}`, f: `F ${RUN}`, x: `X ${RUN}`, y: `Y ${RUN}`, x2: `X2 ${RUN}` };
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
// nouvelAppareil / connecter : voir e2e/appareil.mjs (partagés avec la vérification préalable).
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
    verifierPasDArret();
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
    const textes = { A: `conflit A ${RUN}`, B: `conflit B ${RUN}` };
    await modifierNotes(A.page, 'c', textes.A, { enregistrer: false });
    await modifierNotes(B.page, 'c', textes.B, { enregistrer: false });
    // Observation des messages lancée AVANT les clics (le message de la garde disparaît après 3 s).
    const observer = p => Promise.any([
      p.getByText(/Quelqu'un a enregistré entre-temps/).first().waitFor({ timeout: 15_000 }).then(() => 'conflit'),
      p.getByText(/modifié sur un autre appareil/).first().waitFor({ timeout: 15_000 }).then(() => 'garde'),
    ]).catch(() => null);
    // Historique côté serveur : toutes les valeurs successives des notes du client C.
    const historique = [];
    let suivre = true;
    const suivi = (async () => {
      while (suivre) {
        const n = clientServeur(await lireBlob(A.page), 'c')?.notes;
        if (n !== historique[historique.length - 1]) historique.push(n);
        await A.page.waitForTimeout(200);
      }
    })();
    const vus = { A: observer(A.page), B: observer(B.page) };
    const bouton = p => p.getByRole('button', { name: 'Enregistrer les modifications' });
    await Promise.all([bouton(A.page).click(), bouton(B.page).click()]);
    // Issue TERMINALE des deux sauvegardes : messages observés (ou délai écoulé), puis le serveur
    // doit rester stable 3 s après la dernière modification constatée.
    const message = { A: await vus.A, B: await vus.B };
    let stable = Date.now();
    for (let n = historique.length; Date.now() - stable < 3_000;) {
      await A.page.waitForTimeout(250);
      if (historique.length !== n) { n = historique.length; stable = Date.now(); }
    }
    suivre = false; await suivi;
    const ligne = await lireBlob(A.page);
    const final = clientServeur(ligne, 'c').notes;
    const enregistre = cote => historique.includes(textes[cote]);
    const copie = { A: aCopie(await copiesRejetees(A.page), 'c', textes.A), B: aCopie(await copiesRejetees(B.page), 'c', textes.B) };
    // Après rechargement, les deux appareils affichent la valeur finale du serveur.
    for (const app of [A, B]) {
      await recharger(app);
      expect(await (await ouvrirEdition(app.page, 'c')).inputValue(), 'valeur affichée après rechargement').toBe(final);
      await recharger(app);
    }
    // Règle : un côté qui a vu un message est REFUSÉ → copie exacte de son brouillon, et sa valeur
    // n'est pas la valeur finale ; un côté sans message doit avoir été réellement enregistré.
    const erreurs = [];
    if (![textes.A, textes.B].includes(final)) erreurs.push('valeur finale inattendue');
    for (const cote of ['A', 'B']) {
      if (message[cote]) {
        if (!copie[cote]) erreurs.push(`${cote} refusé sans copie de secours`);
        if (final === textes[cote]) erreurs.push(`${cote} refusé mais sa valeur est la finale`);
      } else if (!enregistre(cote)) erreurs.push(`${cote} sans message ET jamais enregistré (perte silencieuse)`);
    }
    const issue = message.A || message.B
      ? `${message.A ? 'A' : 'B'} refusé (${message.A || message.B}) avec copie de secours, ${message.A ? 'B' : 'A'} enregistré`
      : "les deux sauvegardes sont passées, l'une après l'autre";
    resultat(`(b) ${erreurs.length ? 'ÉCHEC — ' + erreurs.join(' ; ') : 'OK'} — issue : ${issue} ; valeur finale = celle de ${final === textes.A ? 'A' : 'B'} ; historique serveur : ${historique.length} valeur(s) ; version ${ligne.version}`);
    expect(erreurs).toEqual([]);
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

  test('(e) lecture retardée : écran bloquant puis application utilisable', async ({ browser }) => {
    const C = await nouvelAppareil(browser);
    let liberer;
    const attente = new Promise(resolve => { liberer = resolve; });
    await C.context.route(/\/rest\/v1\/devis/, async route => {
      if (route.request().method() === 'GET') await attente;
      await route.fallback();
    });
    try {
      await connecter(C.page);
      await expect(C.page.getByRole('status')).toHaveText('Chargement de vos données…');
      await expect(C.page.getByRole('button', { name: /Nouveau client/ })).toHaveCount(0);
      await expect(C.page.getByRole('navigation')).toHaveCount(0);
      liberer();
      await allerClients(C.page);
    } finally { liberer(); await C.context.close(); }
  });

  test('(f) hors ligne puis rechargement sans Réessayer : copie durable', async ({ browser }) => {
    const C = await nouvelAppareil(browser);
    try {
      await connecter(C.page); await allerClients(C.page);
      await creerClient(C.page, 'f');
      expect(await attendreServeur(C.page, l => clientServeur(l, 'f'))).toBeTruthy();
      await C.context.setOffline(true);
      const texte = `Non enregistré ${RUN}`;
      await modifierNotes(C.page, 'f', texte);
      await expect(C.page.getByRole('alert').filter({ hasText: 'Ne fermez pas' })).toBeVisible({ timeout: 20_000 });
      const lireCopies = () => C.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('cyna_sauvegarde_en_echec_')).map(k => JSON.parse(localStorage.getItem(k))));
      expect(aCopie(await lireCopies(), 'f', texte)).toBe(true);
      await C.context.setOffline(false);
      let fermeture = false;
      C.page.once('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); fermeture = true; await dialog.accept(); });
      await C.page.reload(); await allerClients(C.page);
      expect(fermeture).toBe(true);
      expect(aCopie(await lireCopies(), 'f', texte)).toBe(true);
      await expect(C.page.getByRole('alert').filter({ hasText: 'session précédente' })).toBeVisible();
    } finally { await C.context.setOffline(false); await C.context.close(); }
  });

  test('(g) suppression confirmée : autre client conservé, cible modifiée protégée', async () => {
    await recharger(A); await recharger(B);
    for (const cle of ['x', 'y', 'x2']) await creerClient(A.page, cle);
    expect(await attendreServeur(A.page, l => ['x', 'y', 'x2'].every(k => clientServeur(l, k)))).toBeTruthy();
    await recharger(B);
    await ligneClient(A.page, 'x').getByTitle('Supprimer ce client', { exact: true }).click();
    const texteY = `Y distant ${RUN}`;
    await modifierNotes(B.page, 'y', texteY);
    expect(await attendreServeur(B.page, l => clientServeur(l, 'y')?.notes === texteY)).toBeTruthy();
    await expect(A.page.getByText(texteY, { exact: true })).toBeVisible({ timeout: 20_000 });
    await A.page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    expect(await attendreServeur(A.page, l => !clientServeur(l, 'x') && clientServeur(l, 'y')?.notes === texteY)).toBeTruthy();
    await expect(B.page.getByText(etiquette('x'), { exact: true })).toHaveCount(0, { timeout: 20_000 });
    await ligneClient(A.page, 'x2').getByTitle('Supprimer ce client', { exact: true }).click();
    const texteX = `X distant ${RUN}`;
    await modifierNotes(B.page, 'x2', texteX);
    expect(await attendreServeur(B.page, l => clientServeur(l, 'x2')?.notes === texteX)).toBeTruthy();
    await expect(A.page.getByText(texteX, { exact: true })).toBeVisible({ timeout: 20_000 });
    await A.page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(A.page.getByText(/modifié ou supprimé pendant la confirmation/)).toBeVisible();
    expect(clientServeur(await lireBlob(A.page), 'x2')?.notes).toBe(texteX);
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
