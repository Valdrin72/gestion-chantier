// STAGING UNIQUEMENT. Fichier écrit pour l’hôte ; ne pas exécuter pendant la construction.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';
const CIBLE = chargerCibleStaging();
const RUN = `import${Date.now().toString(36)}`;
const CLIENT = { id: `e2e-${RUN}`, nom: RUN, prenom: 'Test' };
async function lireBlob(page) {
  const token = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return k ? JSON.parse(localStorage.getItem(k)).access_token : null;
  });
  if (!token) throw new Error('Session staging absente');
  const r = await fetch(`${CIBLE.url}/rest/v1/devis?select=id,version,data&numero=eq.__cyna_storage__`, {
    redirect:'error', headers:{apikey:CIBLE.anon,Authorization:`Bearer ${token}`},
  });
  if (!r.ok) throw new Error(`Lecture REST staging en échec (HTTP ${r.status})`);
  const rows = await r.json(); expect(rows).toHaveLength(1); return rows[0];
}
async function parametres(page) {
  await page.getByRole('navigation').getByText('Paramètres', {exact:true}).dispatchEvent('click');
  await expect(page.getByRole('button',{name:'Restaurer backup',exact:true})).toBeVisible();
}
async function fichier(page,data) {
  await page.locator('input[type="file"]').setInputFiles({name:`${RUN}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
}
async function attendreServeur(page,predicat) {
  await expect.poll(async()=>predicat(await lireBlob(page)),{timeout:20000}).toBe(true);
}
async function clients(page) {
  const lien=page.getByRole('navigation').getByText('Clients',{exact:true});
  if (!(await lien.count())) await page.getByRole('button',{name:'Développer Finances',exact:true}).dispatchEvent('click');
  await lien.dispatchEvent('click');
}
test('import contrôlé, refus et copies — staging uniquement',async({browser})=>{
  verifierPasDArret(); const app=await nouvelAppareil(browser); const page=app.page;
  let clesAvant=[], cleSource;
  try {
    await connecter(page); await parametres(page);
    // Attendre que les effets automatiques existants aient terminé avant le remplacement.
    await page.waitForTimeout(1200);
    const avant=await lireBlob(page);
    clesAvant=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('cyna_sauvegarde_')));
    const sauvegarde={...avant.data,meta:{date:new Date().toISOString(),version:1,app:'CYNA'},clients:[...avant.data.clients,CLIENT]};
    await fichier(page,sauvegarde);
    const dialog=page.getByRole('dialog',{name:'Résumé de l’import'});await expect(dialog).toBeVisible();
    const ligne=dialog.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Clients',exact:true})});
    await expect(ligne.getByRole('cell').nth(0)).toHaveText(String(avant.data.clients.length));
    await expect(ligne.getByRole('cell').nth(1)).toHaveText(String(sauvegarde.clients.length));
    const mot=dialog.getByLabel('Tapez REMPLACER');if(await mot.count())await mot.fill('REMPLACER');
    const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Importer',exact:true}).click();
    expect((await download).suggestedFilename()).toMatch(/^avant-import-.*\.json$/);
    await expect(page.getByTestId('message-import')).toContainText('restaurée et enregistrée');
    expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('cyna_sauvegarde_avant_import_')))).toBe(true);
    await attendreServeur(page,l=>l.version>avant.version&&l.data.clients.some(c=>c.id===CLIENT.id));
    const apres=await lireBlob(page);
    await fichier(page,{...sauvegarde,clients:[...sauvegarde.clients,CLIENT]});
    await expect(page.getByTestId('message-import')).toContainText('id en double');await expect(dialog).toHaveCount(0);
    expect(await lireBlob(page)).toEqual(apres);
    cleSource=`cyna_sauvegarde_rejetee_${RUN}`;
    await page.evaluate(({cleSource,data})=>localStorage.setItem(cleSource,JSON.stringify(data)),{cleSource,data:sauvegarde});
    await page.getByText('Copies de secours',{exact:true}).click();
    const article=page.locator('article').filter({has:page.getByText(cleSource,{exact:true})});
    const copieDownload=page.waitForEvent('download');await article.getByRole('button',{name:'Télécharger',exact:true}).click();
    expect((await copieDownload).suggestedFilename()).toContain(cleSource);
    await article.getByRole('button',{name:'Restaurer',exact:true}).click();await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Annuler',exact:true}).click();expect(await lireBlob(page)).toEqual(apres);
    expect(await page.evaluate(k=>localStorage.getItem(k)!==null,cleSource)).toBe(true);
  } finally {
    try {
      // Nettoyage conditionnel du seul client de test, par la corbeille de l’interface.
      await page.reload();await clients(page);
      const texte=page.getByText(`Test ${RUN}`,{exact:true});
      if(await texte.count()) {
        const ligne=page.locator('div').filter({has:texte}).filter({has:page.getByRole('button',{name:/Modifier/})}).last();
        await ligne.getByTitle('Supprimer ce client',{exact:true}).click();
        await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click();
        await attendreServeur(page,l=>!!l.data.clients.find(c=>c.id===CLIENT.id)?.supprime_le);
      }
      // Profil isolé créé par ce test : uniquement les clés créées pendant ce passage.
      await page.evaluate(avant=>Object.keys(localStorage).filter(k=>k.startsWith('cyna_sauvegarde_')&&!avant.includes(k)).forEach(k=>localStorage.removeItem(k)),clesAvant);
    } finally { await app.context.close();expect(app.bloquees,'aucune autre base Supabase').toEqual([]); }
  }
});
