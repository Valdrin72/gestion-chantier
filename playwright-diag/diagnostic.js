// CYNA — Script de diagnostic Playwright complet v2
// Gère la modale d'onboarding, navigue via data-page, capture toutes les pages

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/user/gestion-chantier/playwright-diag/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const REPORT = [];

function log(msg) {
  console.log(msg);
  REPORT.push(msg);
}

function logSection(title) {
  const line = '─'.repeat(60);
  log(`\n${line}`);
  log(`  ${title}`);
  log(line);
}

async function screenshot(page, name, label) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`[SCREENSHOT] ${label} -> ${file}`);
}

async function dismissModal(page) {
  // Fermer modale onboarding ou overlay bloquant
  // Essayer plusieurs sélecteurs courants
  const selectors = [
    'button:has-text("Commencer")',
    'button:has-text("Fermer")',
    'button:has-text("Ignorer")',
    'button:has-text("Passer")',
    'button:has-text("Skip")',
    'button:has-text("Close")',
    '[data-dismiss]',
    '[aria-label="Close"]',
    '[aria-label="Fermer"]',
    '.modal-close',
    '.close-button',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.click();
      await page.waitForTimeout(800);
      log(`[INFO] Modale fermée via: ${sel}`);
      return true;
    }
  }

  // Essayer Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Cliquer en dehors de la modale (coin supérieur gauche)
  const hasOverlay = await page.locator('[class*="modal"], [class*="overlay"], [class*="backdrop"]').first().isVisible().catch(() => false);
  if (hasOverlay) {
    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);
    log('[INFO] Clic en dehors de la modale pour fermer');
    return true;
  }

  return false;
}

async function naviguerPage(page, pageName) {
  // Navigation via data-label ou data-page
  const selectors = [
    `[data-label="${pageName}"]`,
    `[data-page="${pageName}"]`,
    `button[data-label="${pageName}"]`,
    `a[data-page="${pageName}"]`,
  ];

  // Noms alternatifs
  const aliases = {
    'dashboard': ['Dashboard', 'Tableau de bord'],
    'devis': ['Devis'],
    'chantiers': ['Chantiers', 'Mes Chantiers'],
    'heures': ['Heures', 'Journal des heures', 'Journal'],
    'employes': ['Employés', 'Employes'],
    'finances': ['Finances', 'Facturation'],
    'planning': ['Planning'],
    'parametres': ['Paramètres', 'Parametres', 'Paramètres'],
  };

  // Tenter via data-label/data-page
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      await el.click({ force: true });
      await page.waitForTimeout(2000);
      log(`[NAV] Navigation vers "${pageName}" via: ${sel}`);
      return true;
    }
  }

  // Tenter via texte dans nav
  const textOptions = aliases[pageName.toLowerCase()] || [pageName];
  for (const txt of textOptions) {
    const navEl = page.locator(`nav button:has-text("${txt}"), nav a:has-text("${txt}"), aside button:has-text("${txt}"), aside a:has-text("${txt}")`).first();
    const visible = await navEl.isVisible().catch(() => false);
    if (visible) {
      await navEl.click({ force: true });
      await page.waitForTimeout(2000);
      log(`[NAV] Navigation vers "${pageName}" via texte: "${txt}"`);
      return true;
    }
  }

  // Tenter via button avec texte général
  const allBtns = await page.locator('button, a[role="button"]').all();
  for (const btn of allBtns) {
    const txt = (await btn.textContent().catch(() => '')).trim();
    if (textOptions.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
      await btn.click({ force: true });
      await page.waitForTimeout(2000);
      log(`[NAV] Navigation vers "${pageName}" via bouton texte: "${txt}"`);
      return true;
    }
  }

  log(`[WARN] Navigation vers "${pageName}" impossible`);
  return false;
}

async function checkForBadValues(page, context) {
  const text = await page.evaluate(() => document.body.innerText);
  const issues = [];
  if (/\bNaN\b/.test(text)) issues.push('NaN');
  if (/\bundefined\b/.test(text)) issues.push('undefined');
  if (/\bInfinity\b/.test(text)) issues.push('Infinity');
  if (issues.length > 0) {
    log(`[ALERTE] ${context} — Valeurs invalides visibles: ${issues.join(', ')}`);
    const lines = text.split('\n').filter(l => /\bNaN\b|\bundefined\b|\bInfinity\b/.test(l));
    lines.slice(0, 5).forEach(l => log(`  Ligne problematique: "${l.trim()}"`));
  } else {
    log(`[OK] ${context} — Aucun NaN/undefined/Infinity`);
  }
  return issues;
}

async function extractValues(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const chfMatches = text.match(/CHF\s*[\d'.,]+/g) || [];
    const pctMatches = text.match(/\d+[.,]\d+\s*%|\d+\s*%/g) || [];
    const heuresMatches = text.match(/\d+['.]?\d*\s*h(?:eures?)?(?:\s+\d+\s*min)?/gi) || [];
    const numericMatches = text.match(/\b\d{1,3}(?:'\d{3})+(?:\.\d+)?\b/g) || []; // Nombres suisses avec apostrophes
    return {
      chf: [...new Set(chfMatches)].slice(0, 20),
      pct: [...new Set(pctMatches)].slice(0, 15),
      heures: [...new Set(heuresMatches)].slice(0, 15),
      swiss_numbers: [...new Set(numericMatches)].slice(0, 10),
    };
  });
}

async function extractPageText(page) {
  return await page.evaluate(() => {
    // Extraire les valeurs numériques/indicateurs clés visibles
    const result = [];
    const elements = document.querySelectorAll('h1, h2, h3, p, span, td, th, label, div[class*="value"], div[class*="amount"], div[class*="total"], div[class*="kpi"]');
    elements.forEach(el => {
      const txt = el.innerText?.trim();
      if (txt && txt.length > 0 && txt.length < 100 && /\d/.test(txt)) {
        result.push(txt.replace(/\s+/g, ' '));
      }
    });
    return [...new Set(result)].slice(0, 30);
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-CH',
  });

  const page = await ctx.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PageError: ${err.message}`));

  try {
    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 1 — Charger l'app et fermer l'onboarding
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 1 — Chargement de l\'app (mode DIAG)');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot(page, '01-app-loaded', 'App chargée (avant fermeture modale)');

    const loginForm = await page.locator('input[type="password"]').count();
    if (loginForm > 0) {
      log('[ERREUR] Mode DIAG non actif — formulaire login toujours visible');
      await browser.close();
      return;
    }
    log('[OK] Mode DIAG actif — dashboard visible');

    // Fermer modale d'onboarding
    await dismissModal(page);
    await page.waitForTimeout(1000);

    // Vérifier si modale encore présente
    const modalStillPresent = await page.locator('[class*="modal"]:visible, [class*="overlay"]:visible').count();
    if (modalStillPresent > 0) {
      log('[INFO] Tentative supplémentaire de fermeture modale');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    await screenshot(page, '01b-app-no-modal', 'App sans modale');

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 2 — Inventaire de la navigation
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 2 — Inventaire de la navigation');
    const navItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('[data-label], [data-page], nav button, nav a, aside button, aside a').forEach(el => {
        const txt = el.innerText?.trim();
        const dl = el.getAttribute('data-label') || '';
        const dp = el.getAttribute('data-page') || '';
        if (txt && txt.length < 50) items.push({ text: txt, dataLabel: dl, dataPage: dp });
      });
      return [...new Map(items.map(i => [i.text, i])).values()];
    });
    log('Items de navigation:');
    navItems.forEach(n => log(`  [data-label="${n.dataLabel}" / data-page="${n.dataPage}"] "${n.text}"`));

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 3 — Dashboard
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 3 — Dashboard');
    await naviguerPage(page, 'Dashboard');
    await page.waitForTimeout(2000);
    await dismissModal(page);
    await screenshot(page, '03-dashboard', 'Dashboard');

    await checkForBadValues(page, 'Dashboard');
    const dashVals = await extractValues(page);
    log(`CHF sur Dashboard: ${dashVals.chf.join(' | ') || '(aucun)'}`);
    log(`Pourcentages: ${dashVals.pct.join(' | ') || '(aucun)'}`);
    log(`Heures: ${dashVals.heures.join(' | ') || '(aucune)'}`);
    log(`Nombres suisses: ${dashVals.swiss_numbers.join(' | ') || '(aucun)'}`);

    const dashText = await extractPageText(page);
    log('Indicateurs numériques visibles sur Dashboard:');
    dashText.forEach(t => log(`  "${t}"`));

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 4 — Page Devis
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 4 — Page Devis');
    await naviguerPage(page, 'devis');
    await page.waitForTimeout(2000);
    await screenshot(page, '04-devis', 'Page Devis');

    await checkForBadValues(page, 'Devis');
    const devisVals = await extractValues(page);
    log(`CHF sur Devis: ${devisVals.chf.join(' | ') || '(aucun — bug possible si montants = 0)'}`);
    log(`Nombres suisses (devis): ${devisVals.swiss_numbers.join(' | ') || '(aucun)'}`);

    // Compter les lignes de devis
    const devisCount = await page.evaluate(() => {
      const tbody = document.querySelectorAll('tbody tr');
      const cards = document.querySelectorAll('[class*="devis-item"], [class*="devis-card"]');
      return { rows: tbody.length, cards: cards.length };
    });
    log(`Lignes dans tableau devis: ${devisCount.rows}, Cards: ${devisCount.cards}`);

    // Extraire le contenu du tableau
    const devisTableContent = await page.evaluate(() => {
      const rows = [];
      document.querySelectorAll('tbody tr').forEach(tr => {
        const cells = [];
        tr.querySelectorAll('td').forEach(td => cells.push(td.innerText?.trim()));
        if (cells.length > 0) rows.push(cells.join(' | '));
      });
      return rows.slice(0, 10);
    });
    if (devisTableContent.length > 0) {
      log('Contenu du tableau devis:');
      devisTableContent.forEach(r => log(`  ${r}`));
    } else {
      // Chercher autrement
      const devisPageText = await extractPageText(page);
      log('Valeurs numériques sur page Devis:');
      devisPageText.forEach(t => log(`  "${t}"`));
    }

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 5 — Page Chantiers
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 5 — Page Chantiers');
    await naviguerPage(page, 'chantiers');
    await page.waitForTimeout(2000);
    await screenshot(page, '05-chantiers', 'Page Chantiers');

    await checkForBadValues(page, 'Chantiers');
    const chantiersVals = await extractValues(page);
    log(`CHF sur Chantiers: ${chantiersVals.chf.join(' | ') || '(aucun)'}`);
    log(`Pourcentages Chantiers: ${chantiersVals.pct.join(' | ') || '(aucun)'}`);

    const chantiersContent = await extractPageText(page);
    log('Valeurs numériques sur Chantiers:');
    chantiersContent.slice(0, 15).forEach(t => log(`  "${t}"`));

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 6 — Page Heures / Journal
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 6 — Page Heures');
    await naviguerPage(page, 'heures');
    await page.waitForTimeout(2000);
    await screenshot(page, '06-heures', 'Page Heures');

    await checkForBadValues(page, 'Heures');
    const heuresVals = await extractValues(page);
    log(`Heures sur page Heures: ${heuresVals.heures.join(' | ') || '(aucune — bug possible si heures = 0)'}`);
    log(`CHF sur Heures: ${heuresVals.chf.join(' | ') || '(aucun)'}`);

    const heuresTableContent = await page.evaluate(() => {
      const rows = [];
      document.querySelectorAll('tbody tr').forEach(tr => {
        const cells = [];
        tr.querySelectorAll('td').forEach(td => cells.push(td.innerText?.trim()));
        if (cells.length > 0) rows.push(cells.join(' | '));
      });
      return rows.slice(0, 10);
    });
    if (heuresTableContent.length > 0) {
      log('Contenu journal des heures:');
      heuresTableContent.forEach(r => log(`  ${r}`));
    } else {
      const heuresPageText = await extractPageText(page);
      log('Valeurs numériques sur Heures:');
      heuresPageText.forEach(t => log(`  "${t}"`));
    }

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 7 — Page Employés
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 7 — Page Employés');
    await naviguerPage(page, 'employes');
    await page.waitForTimeout(2000);
    await screenshot(page, '07-employes', 'Page Employés');

    await checkForBadValues(page, 'Employés');
    const employesVals = await extractValues(page);
    log(`CHF Employés: ${employesVals.chf.join(' | ') || '(aucun)'}`);
    log(`Heures Employés: ${employesVals.heures.join(' | ') || '(aucune)'}`);

    // Chercher onglet Performance
    const perfTab = page.locator('button:has-text("Performance"), [role="tab"]:has-text("Performance"), button:has-text("Stats"), button:has-text("Statistiques")').first();
    const perfVisible = await perfTab.isVisible().catch(() => false);
    if (perfVisible) {
      await perfTab.click({ force: true });
      await page.waitForTimeout(1500);
      await screenshot(page, '07b-employes-perf', 'Employés — Performance');
      await checkForBadValues(page, 'Employés > Performance');
      const perfVals = await extractValues(page);
      log(`Heures Performance: ${perfVals.heures.join(' | ') || '(aucune)'}`);
      log(`CHF Performance: ${perfVals.chf.join(' | ') || '(aucun)'}`);
    }

    // Chercher les onglets disponibles
    const tabs = await page.evaluate(() => {
      const tabs = [];
      document.querySelectorAll('[role="tab"], button[class*="tab"]').forEach(t => {
        tabs.push(t.innerText?.trim());
      });
      return tabs;
    });
    if (tabs.length > 0) log(`Onglets sur Employés: ${tabs.join(', ')}`);

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 8 — Finances / Facturation
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 8 — Page Finances');
    await naviguerPage(page, 'finances');
    await page.waitForTimeout(2000);
    await screenshot(page, '08-finances', 'Page Finances');
    await checkForBadValues(page, 'Finances');
    const finVals = await extractValues(page);
    log(`CHF Finances: ${finVals.chf.join(' | ') || '(aucun)'}`);
    log(`Pourcentages Finances: ${finVals.pct.join(' | ') || '(aucun)'}`);

    // ══════════════════════════════════════════════════════════════════
    // ÉTAPE 9 — Détail d'un chantier (vérifier valeurs internes)
    // ══════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 9 — Détail chantier (clic sur premier chantier)');
    await naviguerPage(page, 'chantiers');
    await page.waitForTimeout(1500);

    // Cliquer sur le premier chantier
    const chantierLinks = page.locator('[class*="chantier"] button, [class*="card"] button, tbody tr td button, a[href*="chantier"]');
    const count = await chantierLinks.count();
    log(`Liens/boutons chantier trouvés: ${count}`);

    if (count > 0) {
      await chantierLinks.first().click({ force: true });
      await page.waitForTimeout(2000);
      await screenshot(page, '09-chantier-detail', 'Détail Chantier');
      await checkForBadValues(page, 'Détail Chantier');
      const detailVals = await extractValues(page);
      log(`CHF Détail: ${detailVals.chf.join(' | ') || '(aucun)'}`);
      log(`Pourcentages Détail: ${detailVals.pct.join(' | ') || '(aucun)'}`);

      const detailText = await extractPageText(page);
      log('Indicateurs détail chantier:');
      detailText.slice(0, 20).forEach(t => log(`  "${t}"`));
    } else {
      log('[INFO] Aucun lien vers détail chantier trouvé');
    }

  } catch (err) {
    log(`[ERREUR FATALE] ${err.message}`);
    await screenshot(page, 'fatal-error', 'Erreur fatale').catch(() => {});
    log(err.stack);
  }

  // ══════════════════════════════════════════════════════════════════
  // RAPPORT FINAL
  // ══════════════════════════════════════════════════════════════════
  logSection('RAPPORT FINAL — Erreurs console');
  if (consoleErrors.length === 0) {
    log('[OK] Aucune erreur console JS');
  } else {
    log(`[ALERTE] ${consoleErrors.length} erreur(s) console:`);
    consoleErrors.forEach(e => log(`  ${e}`));
  }

  if (consoleWarnings.length > 0) {
    log(`[INFO] ${consoleWarnings.length} warning(s) console (premiers 5):`);
    consoleWarnings.slice(0, 5).forEach(w => log(`  ${w}`));
  }

  logSection('RÉSUMÉ DIAGNOSTIC');
  log(`Screenshots: ${SCREENSHOTS_DIR}`);
  log(`Erreurs console: ${consoleErrors.length}`);
  log(`Warnings console: ${consoleWarnings.length}`);

  const reportPath = '/home/user/gestion-chantier/playwright-diag/report.txt';
  fs.writeFileSync(reportPath, REPORT.join('\n'));
  log(`Rapport: ${reportPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('ERREUR SCRIPT:', err);
  process.exit(1);
});
