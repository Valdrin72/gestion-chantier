// Écrit pour le coordinateur ; aucun lancement ni appel réseau par le constructeur.
import { test, expect } from '@playwright/test';
import { chargerCibleStaging } from './env-staging.mjs';
import { connecter, nouvelAppareil, verifierPasDArret } from './appareil.mjs';
const CIBLE = chargerCibleStaging();
const nom = `Corbeille ${Date.now().toString(36)}`;
async function blob(page) {
 const token = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  return key ? JSON.parse(localStorage.getItem(key)).access_token : null;
 });
 const response = await fetch(`${CIBLE.url}/rest/v1/devis?select=data&numero=eq.__cyna_storage__`, { headers: { apikey: CIBLE.anon, Authorization: `Bearer ${token}` } });
 expect(response.ok).toBe(true); const rows = await response.json(); expect(rows).toHaveLength(1); return rows[0].data;
}
async function clients(page) {
 const lien = page.getByRole('navigation').getByText('Clients', { exact: true });
 if (!await lien.count()) await page.getByRole('button', { name: 'Développer Finances', exact: true }).dispatchEvent('click');
 await lien.dispatchEvent('click');
 await expect(page.getByRole('button', { name: /Nouveau client/ }).first()).toBeVisible();
}
async function corbeille(page) {
 await page.getByRole('navigation').getByText('Paramètres', { exact: true }).dispatchEvent('click');
 await page.getByText('Corbeille', { exact: true }).click();
}
function ligne(page) {
 return page.locator('div').filter({ has: page.getByText(`Test ${nom}`, { exact: true }) }).filter({ has: page.getByTitle('Supprimer ce client', { exact: true }) }).last();
}
async function supprimer(page) {
 await ligne(page).getByTitle('Supprimer ce client').click();
 await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
 await expect(page.getByText(`Test ${nom}`, { exact: true })).toHaveCount(0);
}
test('client : corbeille, restauration, suppression définitive et ids', async ({ browser }) => {
 verifierPasDArret(); const app = await nouvelAppareil(browser); const page = app.page;
 try {
  await connecter(page); await clients(page);
  await page.getByRole('button', { name: /Nouveau client/ }).first().click();
  await page.getByPlaceholder('Marc').fill('Test'); await page.getByPlaceholder('Dupont', { exact: true }).fill(nom);
  await page.getByRole('button', { name: 'Créer le client' }).click();
  await expect.poll(async () => (await blob(page)).clients.find(c => c.nom === nom)?.id).toBeTruthy();
  await supprimer(page);
  await expect.poll(async () => (await blob(page)).clients.find(c => c.nom === nom)?.supprime_le).toBeTruthy();
  const id = (await blob(page)).clients.find(c => c.nom === nom).id;
  await corbeille(page);
  const row = page.getByRole('region', { name: 'Clients' }).locator('div').filter({ has: page.getByText(`Test ${nom}`, { exact: true }) }).last();
  await expect(row).toBeVisible(); await row.getByRole('button', { name: 'Restaurer', exact: true }).click();
  await expect.poll(async () => (await blob(page)).clients.find(c => c.nom === nom)?.supprime_le).toBeUndefined();
  await clients(page); await expect(page.getByText(`Test ${nom}`, { exact: true })).toBeVisible();
  await supprimer(page); await expect.poll(async () => (await blob(page)).clients.find(c => c.nom === nom)?.supprime_le).toBeTruthy();
  await corbeille(page); await row.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await expect.poll(async () => (await blob(page)).clients.some(c => c.id === id)).toBe(false);
  await expect.poll(async () => (await blob(page)).parametres.idsSupprimes.clients).toContain(id);
 } finally { await app.context.close(); }
});
