// Written for the host: staging only. Do not run against production.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging, destinationAutorisee } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';
const cible = chargerCibleStaging();
const run = `NUM-E2E-${Date.now().toString(36)}`;
async function rest(page, suffix, options = {}) {
 const url = `${cible.url}/rest/v1/devis?${suffix}`;
 if (!destinationAutorisee(url)) throw new Error('Destination REST hors staging');
 const token = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k=>k.startsWith('sb-') && k.endsWith('-auth-token'));
  return key ? JSON.parse(localStorage.getItem(key)).access_token : null;
 });
 const response = await fetch(url, {...options, headers:{apikey:cible.anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'}});
 if (!response.ok) throw new Error(`REST staging HTTP ${response.status}`);
 return response.json();
}
async function blob(page) {
 const rows = await rest(page,'select=id,version,data&numero=eq.__cyna_storage__');
 expect(rows).toHaveLength(1); expect(typeof rows[0].version).toBe('number'); return rows[0];
}
async function finances(page) {
 await page.getByRole('navigation').getByText('Finances',{exact:true}).dispatchEvent('click');
 await expect(page.getByRole('button',{name:/Nouvelle facture/}).first()).toBeVisible();
}
async function ouvrir(page, clientId, objet) {
 await finances(page);
 await page.getByRole('button',{name:/Nouvelle facture/}).first().click();
 await page.getByText('Client * (obligatoire)',{exact:true}).locator('..').locator('select').selectOption(String(clientId));
 await page.getByPlaceholder('Ex: Travaux de rénovation façade').fill(objet);
 return page.locator('input[readonly]').inputValue();
}
test('numéros distincts après arrivée distante pendant un formulaire ouvert', async ({browser})=>{
 verifierPasDArret(); const A=await nouvelAppareil(browser); const B=await nouvelAppareil(browser);
 let clientId;
 try {
  await connecter(A.page); await connecter(B.page); await blob(A.page);
  const nav=A.page.getByRole('navigation').getByText('Clients',{exact:true});
  if (!await nav.count()) await A.page.getByRole('button',{name:'Développer Finances',exact:true}).dispatchEvent('click');
  await A.page.getByRole('navigation').getByText('Clients',{exact:true}).dispatchEvent('click');
  await A.page.getByRole('button',{name:/Nouveau client/}).first().click();
  await A.page.getByPlaceholder('Marc').fill('Test');await A.page.getByPlaceholder('Dupont',{exact:true}).fill(run);
  await A.page.getByRole('button',{name:'Créer le client'}).click();
  await expect.poll(async()=>{clientId=(await blob(A.page)).data.clients.find(c=>c.nom===run)?.id;return !!clientId;},{timeout:20000}).toBe(true);
  // Reload before opening B's form; it must then receive A's invoice without reloading.
  await B.page.reload(); const provisoire=await ouvrir(B.page,clientId,`${run}-B`);
  expect(await ouvrir(A.page,clientId,`${run}-A`)).toBe(provisoire);
  const evenementsAvant=B.realtime.evenements;
  await A.page.getByRole('button',{name:/Enregistrer brouillon/}).click();
  await expect.poll(async()=>(await blob(A.page)).data.factures.some(f=>f.objet===`${run}-A`),{timeout:20000}).toBe(true);
  // B reçoit la sauvegarde de A par le temps réel (l'application ne la recopie pas dans localStorage).
  await expect.poll(()=>B.realtime.evenements,{timeout:20000}).toBeGreaterThan(evenementsAvant);
  await B.page.waitForTimeout(1000);
  expect(await B.page.locator('input[readonly]').inputValue()).toBe(provisoire);
  await B.page.getByRole('button',{name:/Enregistrer brouillon/}).click();
  await expect(B.page.getByText(/était déjà utilisé : la facture a reçu/)).toBeVisible();
  await expect.poll(async()=>(await blob(A.page)).data.factures.filter(f=>f.objet===`${run}-A`||f.objet===`${run}-B`).length,{timeout:20000}).toBe(2);
  const factures=(await blob(A.page)).data.factures.filter(f=>f.objet===`${run}-A`||f.objet===`${run}-B`);
  expect(new Set(factures.map(f=>f.numero)).size).toBe(2);
 } finally {
  // Conditional cleanup of only this run's records. Preserve counters and unrelated writes.
  try {
   if (!clientId && A.page.url() !== 'about:blank') {
    clientId = (await blob(A.page)).data.clients.find(c => c.nom === run)?.id;
   }
   if (clientId) {
   let cleaned=false;
   for(let attempt=0;attempt<5&&!cleaned;attempt++) {
    const row=await blob(A.page);
    const data={...row.data,factures:row.data.factures.filter(f=>f.objet!==`${run}-A`&&f.objet!==`${run}-B`),clients:row.data.clients.filter(c=>String(c.id)!==String(clientId))};
    const updated=await rest(A.page,`id=eq.${encodeURIComponent(row.id)}&version=eq.${row.version}`,{method:'PATCH',body:JSON.stringify({data,version:row.version+1})});
    cleaned=updated.length===1;
   }
   expect(cleaned,'nettoyage conditionnel staging réussi').toBe(true);
  }
  } finally {
   try {expect([...A.bloquees,...B.bloquees]).toEqual([]);} finally {await A.context.close();await B.context.close();}
  }
 }
});
