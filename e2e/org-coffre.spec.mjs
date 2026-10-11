// E2E lot E1 — coffre de l'entreprise (mode 'org'), DEUX associés (deux comptes), base STAGING.
// Prérequis staging (déjà en place) : migration 20261011120000_e1_org_storage_version.sql et une
// entreprise de test dont E2E_EMAIL et E2E_EMAIL_2 sont membres (et de cette seule entreprise), avec un
// coffre non vide (org « E2E E1 — entreprise de test (staging) »). Mêmes garde-fous que les autres
// tests : staging uniquement, aucune autre base joignable, identifiants jamais affichés.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';

const CIBLE = chargerCibleStaging();
const URL_SUPABASE = CIBLE.url;
const ANON = CIBLE.anon;
const RUN = `e1${Date.now().toString(36)}`;
const NOMS = { a: `A ${RUN}`, b: `B ${RUN}`, c: `C ${RUN}`, d: `D ${RUN}` };
const etiquette = cle => `Test ${NOMS[cle]}`;
const resultat = msg => console.log(`RÉSULTAT ${msg}`);

// ── Accès serveur (lecture seule, REST staging, jeton de l'associé) ─────────────
async function session(page) {
  return page.evaluate(() => {
    const cle = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const s = cle ? JSON.parse(localStorage.getItem(cle)) : null;
    return s ? { jeton: s.access_token, id: s.user?.id } : null;
  });
}
async function rest(page, chemin) {
  const { jeton } = await session(page);
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, { headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
  if (!r.ok) throw new Error(`Lecture REST staging en échec (HTTP ${r.status})`);
  return r.json();
}
async function lireCoffre(page) {
  const lignes = await rest(page, 'org_storage?select=org_id,version,data,updated_by');
  expect(lignes, 'exactement un coffre visible').toHaveLength(1);
  return lignes[0];
}
const clientServeur = (ligne, cle) => (ligne.data.clients || []).find(c => c.nom === NOMS[cle]);
async function attendreServeur(page, predicat, delai = 20_000) {
  const fin = Date.now() + delai;
  let ligne;
  while (Date.now() < fin) {
    ligne = await lireCoffre(page);
    if (predicat(ligne)) return ligne;
    await page.waitForTimeout(500);
  }
  return null;
}

// ── Interface (mêmes gestes que e2e/anti-ecrasement.spec.mjs) ───────────────────
async function allerClients(page) {
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

// ── Scénarios ─────────────────────────────────────────────────────────────────
test.describe('E2E E1 — coffre de l\'entreprise, deux associés, staging', () => {
  test.skip(!CIBLE.email2 || !CIBLE.motDePasse2, 'E2E_EMAIL_2 / E2E_PASSWORD_2 absents de .env.test.local');
  let A, B, idA, idB, versionInitiale;

  test.beforeAll(async ({ browser }) => {
    verifierPasDArret();
    A = await nouvelAppareil(browser, { mode: 'org' });
    B = await nouvelAppareil(browser, { mode: 'org' });
    await connecter(A.page);
    await connecter(B.page, { email: CIBLE.email2, motDePasse: CIBLE.motDePasse2 });
    idA = (await session(A.page)).id; idB = (await session(B.page)).id;
    const orgA = (await rest(A.page, 'membres?select=org_id')).map(m => m.org_id);
    const orgB = (await rest(B.page, 'membres?select=org_id')).map(m => m.org_id);
    expect(orgA, 'associé A : une seule entreprise').toHaveLength(1);
    expect(orgB, 'associé B : la même entreprise').toEqual(orgA);
    const coffre = await lireCoffre(A.page);
    versionInitiale = coffre.version;
    expect(Number.isInteger(versionInitiale), 'colonne version présente (migration E1 appliquée)').toBe(true);
    await allerClients(A.page);
    for (const cle of ['a', 'b', 'c', 'd']) await creerClient(A.page, cle);
    const cree = await attendreServeur(A.page, l => ['a', 'b', 'c', 'd'].every(k => clientServeur(l, k)));
    expect(cree, 'création des 4 clients de test dans le coffre').toBeTruthy();
    expect(cree.updated_by, 'auteur posé par le serveur = associé A').toBe(idA);
    await allerClients(B.page);
    const recuEnDirect = await B.page.getByText(etiquette('d'), { exact: true }).waitFor({ timeout: 20_000 }).then(() => true, () => false);
    if (!recuEnDirect) { await recharger(B); await expect(B.page.getByText(etiquette('d'), { exact: true })).toBeVisible({ timeout: 20_000 }); }
    resultat(`mise en place — 4 clients « ${RUN} » créés par A ; version ${versionInitiale} → ${cree.version} ; B les a reçus ${recuEnDirect ? 'EN DIRECT (temps réel)' : 'seulement après rechargement'} ; temps réel (B) : ${JSON.stringify(B.realtime)}`);
  });

  test.afterAll(async () => {
    const autres = [...(A?.bloquees || []), ...(B?.bloquees || [])];
    resultat(`garde-fou réseau — tentatives vers une autre base Supabase : ${autres.length ? [...new Set(autres)].join(', ') : 'aucune'}`);
    await A?.context.close(); await B?.context.close();
  });

  test('(a) A modifie un client, B un autre → les deux sont dans le coffre, auteur = B', async () => {
    const texteA = `notes A ${RUN}`, texteB = `notes B ${RUN}`;
    await modifierNotes(A.page, 'a', texteA);
    expect(await attendreServeur(A.page, l => clientServeur(l, 'a')?.notes === texteA), 'sauvegarde de A').toBeTruthy();
    await B.page.waitForTimeout(2_000);
    await modifierNotes(B.page, 'b', texteB);
    const ligne = await attendreServeur(A.page, l => clientServeur(l, 'b')?.notes === texteB, 12_000);
    expect(ligne, 'la modification de B est enregistrée').toBeTruthy();
    expect(clientServeur(ligne, 'a').notes, "la modification de A n'a pas été écrasée").toBe(texteA);
    expect(ligne.updated_by).toBe(idB);
    resultat(`(a) OK — les deux modifications sont dans le coffre (version ${ligne.version}, dernier auteur = B)`);
  });

  test('(b) A et B modifient le même client en même temps → aucune perte silencieuse', async () => {
    await recharger(A); await recharger(B);
    const textes = { A: `conflit A ${RUN}`, B: `conflit B ${RUN}` };
    await modifierNotes(A.page, 'c', textes.A, { enregistrer: false });
    await modifierNotes(B.page, 'c', textes.B, { enregistrer: false });
    const observer = p => Promise.any([
      p.getByText(/Quelqu'un a enregistré entre-temps/).first().waitFor({ timeout: 15_000 }).then(() => 'conflit'),
      p.getByText(/modifié sur un autre appareil/).first().waitFor({ timeout: 15_000 }).then(() => 'garde'),
    ]).catch(() => null);
    const historique = [];
    let suivre = true;
    const suivi = (async () => {
      while (suivre) {
        const n = clientServeur(await lireCoffre(A.page), 'c')?.notes;
        if (n !== historique[historique.length - 1]) historique.push(n);
        await A.page.waitForTimeout(200);
      }
    })();
    const vus = { A: observer(A.page), B: observer(B.page) };
    const bouton = p => p.getByRole('button', { name: 'Enregistrer les modifications' });
    await Promise.all([bouton(A.page).click(), bouton(B.page).click()]);
    const message = { A: await vus.A, B: await vus.B };
    let stable = Date.now();
    for (let n = historique.length; Date.now() - stable < 3_000;) {
      await A.page.waitForTimeout(250);
      if (historique.length !== n) { n = historique.length; stable = Date.now(); }
    }
    suivre = false; await suivi;
    const final = clientServeur(await lireCoffre(A.page), 'c').notes;
    const copie = { A: aCopie(await copiesRejetees(A.page), 'c', textes.A), B: aCopie(await copiesRejetees(B.page), 'c', textes.B) };
    for (const app of [A, B]) {
      await recharger(app);
      expect(await (await ouvrirEdition(app.page, 'c')).inputValue(), 'valeur affichée après rechargement').toBe(final);
      await recharger(app);
    }
    const erreurs = [];
    if (![textes.A, textes.B].includes(final)) erreurs.push('valeur finale inattendue');
    for (const cote of ['A', 'B']) {
      if (message[cote]) {
        if (!copie[cote]) erreurs.push(`${cote} refusé sans copie de secours`);
        if (final === textes[cote]) erreurs.push(`${cote} refusé mais sa valeur est la finale`);
      } else if (!historique.includes(textes[cote])) erreurs.push(`${cote} sans message ET jamais enregistré (perte silencieuse)`);
    }
    resultat(`(b) ${erreurs.length ? 'ÉCHEC — ' + erreurs.join(' ; ') : 'OK'} — messages A=${message.A || 'aucun'} B=${message.B || 'aucun'} ; valeur finale = celle de ${final === textes.A ? 'A' : 'B'}`);
    expect(erreurs).toEqual([]);
  });

  test('(c) réseau coupé chez B → « Non enregistré », puis Réessayer enregistre dans le coffre', async () => {
    await recharger(B);
    const texte = `hors ligne B ${RUN}`;
    await B.context.setOffline(true);
    await modifierNotes(B.page, 'd', texte);
    const bandeau = B.page.getByRole('alert').filter({ hasText: 'Non enregistré' });
    await expect(bandeau).toBeVisible({ timeout: 15_000 });
    await B.context.setOffline(false);
    await B.page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(bandeau).toHaveCount(0, { timeout: 15_000 });
    const ligne = await attendreServeur(A.page, l => clientServeur(l, 'd')?.notes === texte);
    expect(ligne, 'sauvegarde après Réessayer').toBeTruthy();
    resultat(`(c) OK — bandeau puis sauvegarde après Réessayer (version ${ligne.version})`);
  });

  test("(d) lecture du coffre qui échoue → écran d'erreur, aucune écriture", async ({ browser }) => {
    const avant = await lireCoffre(A.page);
    const C = await nouvelAppareil(browser, { mode: 'org' });
    const ecritures = [];
    C.page.on('request', r => {
      if (/\/rest\/v1\//.test(r.url()) && !['GET', 'HEAD'].includes(r.method())) ecritures.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    await C.context.route(/\/rest\/v1\/org_storage/, route => (route.request().method() === 'GET' ? route.abort('failed') : route.continue()));
    try {
      await connecter(C.page);
      await expect(C.page.getByRole('button', { name: 'Réessayer' })).toBeVisible({ timeout: 20_000 });
      await expect(C.page.getByRole('button', { name: /Nouveau client/ })).toHaveCount(0);
      await C.page.waitForTimeout(4_000);
    } finally { await C.context.close(); }
    const apres = await lireCoffre(A.page);
    resultat(`(d) ${ecritures.length === 0 && apres.version === avant.version ? 'OK' : 'ÉCHEC'} — écritures REST : ${ecritures.length} ; version ${avant.version} → ${apres.version}`);
    expect(ecritures).toEqual([]);
    expect(apres.version).toBe(avant.version);
  });

  test('état final — coffre jamais vidé, historique conservé', async () => {
    const coffre = await lireCoffre(A.page);
    expect(coffre.version).toBeGreaterThan(versionInitiale);
    for (const cle of ['a', 'b', 'c', 'd']) expect(clientServeur(coffre, cle), `client ${etiquette(cle)} présent`).toBeTruthy();
    const historique = await rest(A.page, `org_storage_historique?select=version&org_id=eq.${coffre.org_id}`);
    expect(historique.length, 'au moins une ancienne version conservée').toBeGreaterThan(0);
    resultat(`état final — version ${versionInitiale} → ${coffre.version} ; 4 clients de test présents ; ${historique.length} ancienne(s) version(s) dans l'historique`);
  });
});
