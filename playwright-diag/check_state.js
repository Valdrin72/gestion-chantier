const { chromium } = require('playwright');
const fs = require('fs');

async function dismissModal(page) {
  const btn = page.locator('button:has-text("Commencer")').first();
  if (await btn.isVisible().catch(() => false)) { await btn.click({ force: true }); await page.waitForTimeout(500); }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await dismissModal(page);
  await page.waitForTimeout(500);

  // Naviguer vers chantiers
  await page.locator('[data-label="Chantiers"], button:has-text("Chantiers")').first().click({ force: true });
  await page.waitForTimeout(1500);

  // Cliquer sur CH-2026-001 (BPG)
  const rows = await page.locator('tbody tr').all();
  let bpgRow = null;
  for (const row of rows) {
    const txt = await row.textContent().catch(() => '');
    if (txt.includes('CH-2026-001') || txt.includes('BPG')) { bpgRow = row; break; }
  }
  if (bpgRow) {
    await bpgRow.click({ force: true });
    await page.waitForTimeout(2000);
  } else {
    await rows[0].click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Screenshot Vue principale
  await page.screenshot({ path: '/home/user/gestion-chantier/playwright-diag/screenshots/bpg-vue.png', fullPage: true });

  const vueText = await page.evaluate(() => document.body.innerText);
  console.log("=== ONGLET VUE ===");
  console.log(vueText.substring(0, 3000));

  // Aller sur onglet Analyse
  const analyseTab = page.locator('button:has-text("Analyse"), [role="tab"]:has-text("Analyse")').first();
  if (await analyseTab.isVisible().catch(() => false)) {
    await analyseTab.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/user/gestion-chantier/playwright-diag/screenshots/bpg-analyse.png', fullPage: true });
    const analyseText = await page.evaluate(() => document.body.innerText);
    console.log("\n=== ONGLET ANALYSE ===");
    console.log(analyseText.substring(0, 5000));
  }

  // Aller sur onglet Financier
  const financierTab = page.locator('button:has-text("Financier"), [role="tab"]:has-text("Financier")').first();
  if (await financierTab.isVisible().catch(() => false)) {
    await financierTab.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/user/gestion-chantier/playwright-diag/screenshots/bpg-financier.png', fullPage: true });
    const financierText = await page.evaluate(() => document.body.innerText);
    console.log("\n=== ONGLET FINANCIER ===");
    console.log(financierText.substring(0, 3000));
  }

  // Maintenant aller sur Heures et voir le journal pour le chantier BPG
  await page.locator('[data-label="Heures"]').first().click({ force: true });
  await page.waitForTimeout(1500);

  // Sélectionner le chantier BPG si possible
  const chantierSelect = page.locator('select, [class*="select"]').first();
  if (await chantierSelect.isVisible().catch(() => false)) {
    // Chercher option BPG
    await chantierSelect.selectOption({ label: /BPG|CH-2026-001/i }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: '/home/user/gestion-chantier/playwright-diag/screenshots/heures-bpg.png', fullPage: true });

  const heuresText = await page.evaluate(() => document.body.innerText);
  console.log("\n=== PAGE HEURES (pour BPG) ===");
  console.log(heuresText.substring(0, 3000));

  await browser.close();
}
main().catch(e => { console.error(e.stack); process.exit(1); });
