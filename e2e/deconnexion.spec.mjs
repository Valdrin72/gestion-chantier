// STAGING UNIQUEMENT. Écrit pour l'hôte ; ne pas exécuter pendant la construction.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';
const CIBLE = chargerCibleStaging();
const URL_SUPABASE = CIBLE.url, ANON = CIBLE.anon;
const MARQUEUR = '__cyna_storage__';
const RUN = `deconnexion${Date.now().toString(36)}`;
const NOMS = { a: `Immediat ${RUN}`, b: `Offline ${RUN}` };
const etiquette = cle => `Test ${NOMS[cle]}`;
const QUESTION = 'Des modifications ne sont pas enregistrées. Se déconnecter quand même ?';
async function jeton(page) {
  return page.evaluate(() => {
    const cle = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return cle ? JSON.parse(localStorage.getItem(cle)).access_token : null;
  });
}
async function lireLignes(page) {
  const t = await jeton(page);
  if (!t) throw new Error("Session staging absente pour la lecture REST");
  const r = await fetch(`${URL_SUPABASE}/rest/v1/devis?select=id,numero,version,data&numero=eq.${MARQUEUR}`, {
    redirect: 'error',
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

// Deux clics dans la même tâche JS : délai mesuré, strictement inférieur à 800 ms.
async function enregistrerEtQuitter(page, label) {
  const delai = await page.evaluate(label => {
    const bouton = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
    const sortie = document.querySelector('button[title="Se déconnecter"]');
    if (!bouton || !sortie) throw new Error('Boutons de sauvegarde/déconnexion absents');
    const debut = performance.now(); bouton.click(); sortie.click(); return performance.now() - debut;
  }, label);
  expect(delai, 'déconnexion déclenchée avant debounce de 800 ms').toBeLessThan(800);
}
async function nettoyer(page) {
  await page.reload(); await allerClients(page);
  for (const cle of ['a','b']) {
    const texte = page.getByText(etiquette(cle), { exact:true });
    if (!(await texte.count())) continue;
    await ligneClient(page, cle).getByTitle('Supprimer ce client', {exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click();
    expect(await attendreServeur(page, l => !!clientServeur(l,cle)?.supprime_le), 'nettoyage : client de test à la corbeille').toBeTruthy();
  }
}
test.describe('déconnexion sûre — staging uniquement', () => {
  let A, B;
  test.beforeEach(async ({ browser }) => {
    verifierPasDArret();
    A = await nouvelAppareil(browser); B = await nouvelAppareil(browser);
    await connecter(A.page); await connecter(B.page); await allerClients(A.page);
  });
  test.afterEach(async () => {
    await A?.context.setOffline(false);
    try { if (B) await nettoyer(B.page); }
    finally {
      const bloquees = [...(A?.bloquees || []),...(B?.bloquees || [])];
      await A?.context.close(); await B?.context.close();
      A = null; B = null;
      expect(bloquees, 'aucune requête vers une autre base Supabase').toEqual([]);
    }
  });
  test('création puis déconnexion avant 800 ms : serveur à jour et caches effacés', async () => {
    await A.page.getByRole('button',{name:/Nouveau client/}).first().click();
    await A.page.getByPlaceholder('Marc').fill('Test'); await A.page.getByPlaceholder('Dupont',{exact:true}).fill(NOMS.a);
    // Données qui n'existent QUE dans le navigateur : elles doivent survivre à la déconnexion.
    const LOCALES = { cyna_ia_memoire: `memoire ${RUN}`, cyna_chat_history: `chat ${RUN}`, cyna_objectifs: `{"caAnnuel":1}`, cyna_cal_events: `[]`, cyna_actions: `[]` };
    await A.page.evaluate(l => Object.entries(l).forEach(([k, v]) => localStorage.setItem(k, v)), LOCALES);
    await enregistrerEtQuitter(A.page, 'Créer le client');
    await expect(A.page.getByPlaceholder('votre@email.com')).toBeVisible();
    expect(await attendreServeur(B.page, l => clientServeur(l,'a')), 'dernier client sauvegardé avant signOut').toBeTruthy();
    const caches = await A.page.evaluate(() => ['cyna_chantiers','cyna_devis','cyna_factures','cyna_clients','cyna_parametres','cyna_pointages'].filter(k => localStorage.getItem(k) !== null));
    expect(caches, 'copies locales des données serveur effacées').toEqual([]);
    const survivantes = await A.page.evaluate(l => Object.fromEntries(Object.keys(l).map(k => [k, localStorage.getItem(k)])), LOCALES);
    expect(survivantes, 'données propres au navigateur conservées').toEqual(LOCALES);
    // Nettoyage des seules valeurs de test, pour ne rien laisser dans le profil de test.
    await A.page.evaluate(l => Object.keys(l).forEach(k => localStorage.removeItem(k)), LOCALES);
  });
  test('hors ligne : annuler conserve la session ; reprise sauvegarde la modification', async () => {
    await creerClient(A.page,'b');
    expect(await attendreServeur(B.page,l => clientServeur(l,'b'))).toBeTruthy();
    await A.context.setOffline(true); const notes = `hors ligne ${RUN}`;
    await modifierNotes(A.page,'b',notes,{enregistrer:false});
    await enregistrerEtQuitter(A.page,'Enregistrer les modifications');
    await expect(A.page.getByRole('dialog').getByText(QUESTION,{exact:true})).toBeVisible();
    await A.page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();
    await expect(A.page.getByPlaceholder('votre@email.com')).toHaveCount(0);
    await expect(A.page.getByTestId('application')).not.toHaveAttribute('inert');
    await A.context.setOffline(false);
    // Bouton de la barre latérale hors de la zone visible : clic déclenché directement (même procédé que les autres E2E).
    await A.page.getByTitle('Se déconnecter',{exact:true}).dispatchEvent('click');
    await expect(A.page.getByPlaceholder('votre@email.com')).toBeVisible();
    expect(await attendreServeur(B.page,l => clientServeur(l,'b')?.notes === notes), 'modification conservée après annulation').toBeTruthy();
  });
});
