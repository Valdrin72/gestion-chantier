// E2E — historique des sauvegardes (mode 'user'), base STAGING uniquement.
// Prérequis : migration 20261006120000_historique_sauvegardes.sql appliquée sur staging.
// Mêmes garde-fous que anti-ecrasement.spec.mjs (origine staging exacte, réseau limité à
// localhost + staging, identifiants jamais affichés). Lancement :
//   npx playwright test e2e/historique.spec.mjs
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';

const CIBLE = chargerCibleStaging();
const RUN = `hist${Date.now().toString(36)}`;
const noms = [1, 2, 3].map(i => `H${i} ${RUN}`);
const etiquette = nom => `Test ${nom}`;
const resultat = msg => console.log(`RÉSULTAT ${msg}`);

async function jeton(page) {
  return page.evaluate(() => {
    const cle = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return cle ? JSON.parse(localStorage.getItem(cle)).access_token : null;
  });
}
function sujet(jwt) {
  return JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).sub;
}
async function rest(page, chemin) {
  const r = await fetch(`${CIBLE.url}/rest/v1/${chemin}`, { headers: { apikey: CIBLE.anon, Authorization: `Bearer ${await jeton(page)}` } });
  return { ok: r.ok, statut: r.status, corps: await r.json().catch(() => null) };
}
const historique = page => rest(page, 'devis_historique?select=id,user_id,version,data,sauve_le&order=id.asc');
// HIST-002 — lectures bornées par identifiant (jamais « tout l'historique » : la limite de
// lignes de l'API renverrait toujours les mêmes lignes anciennes).
async function dernierId(page) {
  const r = await rest(page, 'devis_historique?select=id&order=id.desc&limit=1');
  if (!r.ok) throw new Error(`lecture de l'historique en échec (HTTP ${r.statut})`);
  return r.corps[0]?.id ?? 0;
}
async function nouvellesDepuis(page, depuisId) {
  const lignes = [];
  for (let apres = depuisId; ;) {
    const r = await rest(page, `devis_historique?select=id,user_id,version,data,sauve_le&id=gt.${apres}&order=id.asc&limit=100`);
    if (!r.ok) throw new Error(`lecture de l'historique en échec (HTTP ${r.statut})`);
    lignes.push(...r.corps);
    if (r.corps.length < 100) return lignes;
    apres = r.corps.at(-1).id;
  }
}
async function blob(page) {
  const r = await rest(page, 'devis?select=version,data&numero=eq.__cyna_storage__');
  return r.corps?.[0];
}
async function attendre(page, predicat, delai = 20_000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const b = await blob(page);
    if (b && predicat(b)) return b;
    await page.waitForTimeout(400);
  }
  return null;
}
const aClient = (b, nom) => (b.data.clients || []).some(c => c.nom === nom);

async function allerClients(page) {
  const clients = page.getByRole('navigation').getByText('Clients', { exact: true });
  if (!(await clients.count())) await page.getByRole('button', { name: 'Développer Finances', exact: true }).dispatchEvent('click');
  await clients.dispatchEvent('click');
  await expect(page.getByRole('button', { name: /Nouveau client/ }).first()).toBeVisible({ timeout: 20_000 });
}
async function creerClient(page, nom) {
  await page.getByRole('button', { name: /Nouveau client/ }).first().click();
  await page.getByPlaceholder('Marc').fill('Test');
  await page.getByPlaceholder('Dupont', { exact: true }).fill(nom);
  await page.getByRole('button', { name: 'Créer le client' }).click();
  await expect(page.getByText(etiquette(nom), { exact: true })).toBeVisible();
}
async function supprimerClient(page, nom) {
  await page.locator('div')
    .filter({ has: page.getByText(etiquette(nom), { exact: true }) })
    .filter({ has: page.getByTitle('Supprimer ce client', { exact: true }) })
    .last().getByTitle('Supprimer ce client', { exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  expect(await attendre(page, b => (b.data.clients || []).find(c => c.nom === nom)?.supprime_le), 'client à la corbeille').toBeTruthy();
  await page.getByRole('navigation').getByText('Paramètres', { exact: true }).dispatchEvent('click');
  await page.getByText('Corbeille', { exact: true }).click();
  const ligne = page.getByRole('region', { name: 'Clients' }).locator('div').filter({ has: page.getByText(etiquette(nom), { exact: true }) }).last();
  await ligne.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await allerClients(page);
}

test.describe.serial('E2E historique — staging, mode user', () => {
  let A, idCompte1;

  test.beforeAll(async ({ browser }) => {
    verifierPasDArret();
    A = await nouvelAppareil(browser);
    await connecter(A.page);
    idCompte1 = sujet(await jeton(A.page));
    const essai = await rest(A.page, 'devis_historique?select=id&limit=1');
    // HIST-003 — ignorés UNIQUEMENT si la table n'existe pas encore (migration non appliquée :
    // PostgREST répond 404 / PGRST205, ou 42P01). Toute autre erreur (403 droits cassés, 500…)
    // fait ÉCHOUER la suite au lieu d'être masquée.
    const tableAbsente = !essai.ok && essai.statut === 404 && ['PGRST205', '42P01'].includes(essai.corps?.code);
    test.skip(tableAbsente, 'table devis_historique absente sur staging — migration non appliquée');
    if (!essai.ok) throw new Error(`ÉCHEC : lecture de devis_historique en erreur (HTTP ${essai.statut}, ${essai.corps?.code || 'sans code'})`);
  });
  test.afterAll(async () => { await A?.context.close(); });

  test('3 mises à la corbeille puis suppressions définitives → au moins 3 versions dans l’historique', async () => {
    await allerClients(A.page);
    for (const nom of noms) await creerClient(A.page, nom);
    expect(await attendre(A.page, b => noms.every(n => aClient(b, n))), 'clients de test enregistrés').toBeTruthy();
    const depuisId = await dernierId(A.page);
    for (const nom of noms) {
      const versionAvant = (await blob(A.page)).version;
      await supprimerClient(A.page, nom);
      expect(await attendre(A.page, b => !aClient(b, nom) && b.version > versionAvant), `suppression de ${nom} enregistrée`).toBeTruthy();
    }
    const nouvelles = await nouvellesDepuis(A.page, depuisId);
    // Règle de l'historique (migration 20261006120000) : une copie quand un identifiant DISPARAÎT
    // (ou si la dernière copie a plus de 5 min). Une mise à la corbeille garde l'élément dans le
    // blob (pas de copie, c'est voulu) ; chaque suppression définitive en crée une.
    expect(nouvelles.length, 'au moins 3 nouvelles versions (une par suppression définitive)').toBeGreaterThanOrEqual(3);
    expect(nouvelles.every(h => h.user_id === idCompte1)).toBe(true);
    const versions = nouvelles.map(h => Number(h.version));
    expect([...versions].sort((a, b) => a - b), 'versions croissantes').toEqual(versions);
    // Chaque client supprimé est retrouvable dans une version d'avant sa suppression.
    for (const nom of noms) expect(nouvelles.some(h => (h.data.clients || []).some(c => c.nom === nom)), `${nom} dans l'historique`).toBe(true);
    resultat(`3 suppressions → ${nouvelles.length} nouvelle(s) version(s) dans l'historique (versions ${versions.join(', ')}) ; les 3 clients supprimés y sont retrouvables`);
  });

  test('un 2e compte ne voit pas l’historique du 1er', async ({ browser }) => {
    test.skip(!CIBLE.email2 || !CIBLE.motDePasse2, 'E2E_EMAIL_2 / E2E_PASSWORD_2 absents de .env.test.local — isolation couverte par supabase/tests/historique_staging.sql (ii)');
    const B = await nouvelAppareil(browser);
    try {
      await connecter(B.page, { email: CIBLE.email2, motDePasse: CIBLE.motDePasse2 });
      const idCompte2 = sujet(await jeton(B.page));
      expect(idCompte2).not.toBe(idCompte1);
      const tout = await historique(B.page);
      expect(tout.ok).toBe(true);
      expect(tout.corps.some(h => h.user_id === idCompte1), 'aucune ligne du compte 1').toBe(false);
      const cible = await rest(B.page, `devis_historique?select=id&user_id=eq.${idCompte1}`);
      expect(cible.corps).toEqual([]);
      resultat(`le 2e compte voit ${tout.corps.length} ligne(s), toutes à lui ; 0 ligne du 1er compte`);
    } finally { await B.context.close(); }
  });

  test('aucune écriture possible dans l’historique depuis l’API', async () => {
    const t = await jeton(A.page);
    const tentative = (methode, chemin, corps) => fetch(`${CIBLE.url}/rest/v1/${chemin}`, {
      method: methode,
      headers: { apikey: CIBLE.anon, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const ins = await tentative('POST', 'devis_historique', { user_id: idCompte1, version: 0, data: {} });
    const maj = await tentative('PATCH', `devis_historique?user_id=eq.${idCompte1}`, { data: {} });
    const sup = await tentative('DELETE', `devis_historique?user_id=eq.${idCompte1}`);
    expect(ins.ok, 'insertion refusée').toBe(false);
    expect(maj.ok, 'modification refusée').toBe(false);
    expect(sup.ok, 'suppression refusée').toBe(false);
    resultat(`écritures refusées : insertion ${ins.status}, modification ${maj.status}, suppression ${sup.status}`);
  });
});
