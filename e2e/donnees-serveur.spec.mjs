// Written for the host. STAGING ONLY; never run during implementation.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging, destinationAutorisee } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';
const cible = chargerCibleStaging();
const run = `donnees${Date.now().toString(36)}`;
const titre = `Calendrier ${run}`;
const caTest = 700000 + (Date.now() % 100000);
async function rest(page, query, options = {}) {
  const token = await page.evaluate(() => {
    const cle = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return cle ? JSON.parse(localStorage.getItem(cle)).access_token : null;
  });
  if (!token) throw new Error('Session staging absente');
  const url = `${cible.url}/rest/v1/devis?${query}`;
  if (!destinationAutorisee(url)) throw new Error('Destination REST interdite');
  const response = await fetch(url, { ...options, redirect:'error', headers:{
    apikey:cible.anon, Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Prefer:'return=representation',
  } });
  if (!response.ok) throw new Error(`REST staging HTTP ${response.status}`);
  return response.json();
}
async function blob(page) {
  const rows = await rest(page, 'select=id,version,data&numero=eq.__cyna_storage__');
  expect(rows).toHaveLength(1); expect(typeof rows[0].version).toBe('number'); return rows[0];
}
const octets = row => Buffer.byteLength(JSON.stringify(row.data), 'utf8');
async function analyse(page) {
  await page.getByRole('navigation').getByText('Analyse & IA', {exact:true}).dispatchEvent('click');
  await page.getByRole('button', {name:'Analyse',exact:true}).click();
  await page.getByRole('button', {name:'Tendances & objectifs',exact:true}).click();
  return page.locator('label').filter({hasText:'CA facturé annuel cible (CHF)'}).locator('..').locator('input');
}
async function calendrier(page) {
  const planning = page.getByRole('navigation').getByText('Planning', {exact:true});
  if (!(await planning.count())) await page.getByRole('button', {name:'Développer Chantiers',exact:true}).dispatchEvent('click');
  await page.getByRole('navigation').getByText('Planning', {exact:true}).dispatchEvent('click');
  // Le bouton « Nouvel événement » et la liste des événements ne sont affichés que dans l'onglet « Événements ».
  await page.getByRole('button', {name:'Événements', exact:true}).first().click();
  await expect(page.getByRole('button', {name:/Nouvel événement/}).first()).toBeVisible();
}
test('objectif et calendrier entre deux appareils neufs', async ({browser}) => {
  verifierPasDArret();
  let A, B, avant, fin, objectifEcrit, reussi = false, nettoyage = false, finalVerifie = false;
  try {
    A = await nouvelAppareil(browser); await connecter(A.page); avant = await blob(A.page);
    console.log(`BLOB DÉBUT : ${octets(avant)} octets`);
    const input = await analyse(A.page); await input.fill(String(caTest));
    await expect.poll(async () => {
      const row = await blob(A.page);
      if (row.data.objectifs?.caAnnuel !== caTest) return false;
      objectifEcrit = row.data.objectifs; return true;
    }, {timeout:20000}).toBe(true);
    await calendrier(A.page);
    await A.page.getByRole('button', {name:/Nouvel événement/}).click();
    await A.page.getByPlaceholder('Ex : Réunion de chantier...').fill(titre);
    await A.page.locator('input[type=date]').fill(new Date().toISOString().slice(0,10));
    await A.page.getByRole('button', {name:'Ajouter',exact:true}).click();
    await expect.poll(async () => {
      const row = await blob(A.page);
      return row.data.objectifs?.caAnnuel === caTest && row.data.evenementsCalendrier?.some(e => e.label === titre);
    }, {timeout:20000}).toBe(true);
    // Separate, newly created browser context: no objectives/calendar/memory cache.
    B = await nouvelAppareil(browser);
    await B.page.goto('/');
    expect(await B.page.evaluate(() => ['cyna_objectifs','cyna_cal_events','cyna_ia_memoire'].map(k => localStorage.getItem(k)))).toEqual([null,null,null]);
    await connecter(B.page);
    await expect(await analyse(B.page)).toHaveValue(String(caTest));
    await calendrier(B.page); await expect(B.page.getByText(titre, {exact:true}).first()).toBeVisible();
    reussi = true;
    // Reprise on a server lacking a calendar key is proved by unit/hook tests,
    // since the shared staging account now already has that key.
  } finally {
    try {
      if (avant && A) {
        for (let essai = 0; essai < 5 && !nettoyage; essai++) {
          const row = await blob(A.page), data = {...row.data};
          // Preserve concurrent writes. Restore objectives only if they still carry our marker.
          if (data.objectifs?.caAnnuel === caTest) {
            // A later edit to another objective field must not be silently discarded.
            if (JSON.stringify(data.objectifs) !== JSON.stringify(objectifEcrit)) throw new Error('Objectifs modifiés concurremment : nettoyage automatique refusé');
            if (Object.prototype.hasOwnProperty.call(avant.data,'objectifs')) data.objectifs = avant.data.objectifs;
            else delete data.objectifs;
          }
          if (Array.isArray(data.evenementsCalendrier)) {
            data.evenementsCalendrier = data.evenementsCalendrier.filter(e => e.label !== titre);
            if (!data.evenementsCalendrier.length && !Object.prototype.hasOwnProperty.call(avant.data,'evenementsCalendrier')) delete data.evenementsCalendrier;
          }
          const rows = await rest(A.page, `id=eq.${encodeURIComponent(row.id)}&version=eq.${row.version}`, {
            method:'PATCH', body:JSON.stringify({data,version:row.version+1}),
          });
          nettoyage = rows.length === 1;
        }
        expect(nettoyage, 'nettoyage conditionnel staging').toBe(true);
        fin = await blob(A.page);
        expect(fin.data.evenementsCalendrier?.some(e=>e.label===titre) || false).toBe(false);
        expect(fin.data.objectifs?.caAnnuel).not.toBe(caTest);
      }
      expect([...(A?.bloquees || []),...(B?.bloquees || [])], 'aucune requête hors staging').toEqual([]);
      finalVerifie = true;
    } finally {
      console.log(`BLOB FIN : ${fin ? octets(fin) + ' octets' : 'indisponible'}`);
      console.log(`RÉSULTAT : ${reussi && nettoyage && finalVerifie ? 'OK' : 'ÉCHEC'} ; début=${avant ? octets(avant) : 'indisponible'} octets ; fin=${fin ? octets(fin) : 'indisponible'} octets`);
      await A?.context.close(); await B?.context.close();
    }
  }
});
