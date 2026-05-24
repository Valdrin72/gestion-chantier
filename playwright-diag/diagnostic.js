// CYNA — Script de diagnostic Playwright complet
// Teste les 5 flows critiques et capture screenshots + valeurs

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
  log(`[SCREENSHOT] ${label} → ${file}`);
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));
  return errors;
}

async function checkForBadValues(page, context) {
  const text = await page.evaluate(() => document.body.innerText);
  const issues = [];
  if (/\bNaN\b/.test(text)) issues.push('NaN visible dans le texte');
  if (/\bundefined\b/.test(text)) issues.push('undefined visible dans le texte');
  if (/\bInfinity\b/.test(text)) issues.push('Infinity visible dans le texte');
  if (issues.length > 0) {
    log(`[ALERTE] ${context} — Valeurs suspectes: ${issues.join(', ')}`);
    // Extraire les lignes contenant NaN/undefined
    const lines = text.split('\n').filter(l => /\bNaN\b|\bundefined\b|\bInfinity\b/.test(l));
    lines.slice(0, 10).forEach(l => log(`  Ligne: "${l.trim()}"`));
  } else {
    log(`[OK] ${context} — Aucun NaN/undefined/Infinity visible`);
  }
  return issues;
}

async function extractKPIs(page) {
  // Cherche les valeurs numériques dans les KPI cards / indicateurs
  return await page.evaluate(() => {
    const results = [];
    // Cards KPI classiques
    const cards = document.querySelectorAll('[class*="kpi"], [class*="stat"], [class*="card"], [class*="metric"]');
    cards.forEach(card => {
      const text = card.innerText?.trim();
      if (text && text.length < 200) results.push(text);
    });
    // Valeurs numériques importantes (CHF, %, heures)
    const allText = document.body.innerText;
    const chfMatches = allText.match(/CHF\s*[\d'.,]+/g) || [];
    const pctMatches = allText.match(/\d+[\.,]\d+\s*%/g) || [];
    const heuresMatches = allText.match(/\d+\s*h(?:eures?)?/gi) || [];
    return {
      cards: results.slice(0, 20),
      chfValues: [...new Set(chfMatches)].slice(0, 15),
      percentages: [...new Set(pctMatches)].slice(0, 10),
      heures: [...new Set(heuresMatches)].slice(0, 10),
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-CH',
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[PageError] ${err.message}`));

  try {
    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 — Page de connexion
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 1 — Page de connexion');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-login', 'Page de connexion');

    const loginTitle = await page.evaluate(() => document.title);
    log(`Titre: ${loginTitle}`);

    const hasLoginForm = await page.locator('input[type="email"], input[type="text"]').count();
    log(`Formulaire de connexion: ${hasLoginForm > 0 ? 'OUI' : 'NON'}`);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 — Connexion
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 2 — Tentative de connexion');

    // Chercher le champ email
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    const emailVisible = await emailInput.isVisible().catch(() => false);
    const passVisible = await passwordInput.isVisible().catch(() => false);
    log(`Champ email visible: ${emailVisible}, Champ password visible: ${passVisible}`);

    if (emailVisible && passVisible) {
      // Utiliser l'email de l'utilisateur trouvé dans le projet
      await emailInput.fill('salihu.v72@gmail.com');
      await passwordInput.fill('Cyna2024!');
      await screenshot(page, '02-login-filled', 'Formulaire rempli');

      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      log('Bouton connexion cliqué');

      // Attendre redirection ou message d'erreur
      await page.waitForTimeout(4000);
      await screenshot(page, '03-after-login', 'Après connexion');

      const currentUrl = page.url();
      log(`URL après connexion: ${currentUrl}`);

      // Vérifier si on est sur le dashboard ou si erreur
      const errorMsg = await page.locator('[class*="error"], [class*="erreur"], [style*="red"]').first().textContent().catch(() => null);
      if (errorMsg) log(`Message d'erreur: "${errorMsg}"`);

    } else {
      log('[ATTENTION] Formulaire non trouvé — vérifier la page de login');
      // Peut-être déjà connecté ?
      await screenshot(page, '02-no-form', 'Pas de formulaire');
    }

    const afterLoginUrl = page.url();
    log(`URL actuelle: ${afterLoginUrl}`);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 — Dashboard
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 3 — Dashboard');

    // Naviguer vers dashboard si pas déjà là
    const onDashboard = afterLoginUrl.includes('dashboard') ||
      await page.locator('[data-page="dashboard"], [href*="dashboard"]').count() > 0;

    if (!onDashboard) {
      // Chercher lien dashboard dans la nav
      const dashLink = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard"), [data-page="dashboard"]').first();
      const dashExists = await dashLink.isVisible().catch(() => false);
      if (dashExists) {
        await dashLink.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForTimeout(2000);
    await screenshot(page, '03-dashboard', 'Dashboard complet');

    const dashIssues = await checkForBadValues(page, 'Dashboard');
    const dashKPIs = await extractKPIs(page);
    log(`Valeurs CHF trouvées: ${dashKPIs.chfValues.join(', ') || '(aucune)'}`);
    log(`Pourcentages trouvés: ${dashKPIs.percentages.join(', ') || '(aucune)'}`);
    log(`Heures trouvées: ${dashKPIs.heures.join(', ') || '(aucune)'}`);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 — Page Devis
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 4 — Page Devis');

    // Navigation vers Devis
    const devisNav = page.locator('a:has-text("Devis"), button:has-text("Devis"), [data-page="devis"]').first();
    const devisNavVisible = await devisNav.isVisible().catch(() => false);
    if (devisNavVisible) {
      await devisNav.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      // Tenter clic sur nav
      const allLinks = await page.locator('a, button').all();
      for (const link of allLinks) {
        const txt = await link.textContent().catch(() => '');
        if (txt.trim().toLowerCase() === 'devis') {
          await link.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    await screenshot(page, '04-devis', 'Page Devis');
    const devisIssues = await checkForBadValues(page, 'Devis');

    // Compter les devis et extraire montants
    const devisData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, [class*="row"], [class*="item"]');
      const data = [];
      rows.forEach(row => {
        const text = row.innerText?.trim();
        if (text && /CHF|montant|devis/i.test(text) && text.length < 300) {
          data.push(text.replace(/\s+/g, ' ').substring(0, 150));
        }
      });
      return data.slice(0, 10);
    });
    if (devisData.length > 0) {
      log('Lignes devis trouvées:');
      devisData.forEach(d => log(`  → ${d}`));
    } else {
      log('[ATTENTION] Aucune ligne devis trouvée');
    }

    // Chercher spécifiquement les montants HT
    const devisKPIs = await extractKPIs(page);
    log(`Montants CHF sur page Devis: ${devisKPIs.chfValues.join(', ') || '(aucun — possible bug montant=0)'}`);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 — Page Chantiers
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 5 — Page Chantiers');

    const chantiersNav = page.locator('a:has-text("Chantiers"), button:has-text("Chantiers"), [data-page="chantiers"]').first();
    const chantiersNavVisible = await chantiersNav.isVisible().catch(() => false);
    if (chantiersNavVisible) {
      await chantiersNav.click();
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '05-chantiers', 'Page Chantiers');
    const chantiersIssues = await checkForBadValues(page, 'Chantiers');
    const chantiersKPIs = await extractKPIs(page);
    log(`Montants CHF sur Chantiers: ${chantiersKPIs.chfValues.join(', ') || '(aucun)'}`);
    log(`Pourcentages sur Chantiers: ${chantiersKPIs.percentages.join(', ') || '(aucun)'}`);

    // Compter les cards/chantiers
    const nbChantiers = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="chantier"]');
      return cards.length;
    });
    log(`Nombre d'éléments card/chantier: ${nbChantiers}`);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 6 — Page Heures (Journal)
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 6 — Page Heures / Journal');

    const heuresNav = page.locator('a:has-text("Heures"), button:has-text("Heures"), [data-page="heures"]').first();
    const heuresNavVisible = await heuresNav.isVisible().catch(() => false);
    if (heuresNavVisible) {
      await heuresNav.click();
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '06-heures', 'Page Heures');
    const heuresIssues = await checkForBadValues(page, 'Heures');
    const heuresKPIs = await extractKPIs(page);
    log(`Heures trouvées: ${heuresKPIs.heures.join(', ') || '(aucune — possible bug heures=0)'}`);
    log(`Valeurs CHF sur Heures: ${heuresKPIs.chfValues.join(', ') || '(aucune)'}`);

    // Chercher tableau d'heures
    const heuresRows = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, [class*="entry"], [class*="ligne"]');
      const data = [];
      rows.forEach(row => {
        const text = row.innerText?.trim();
        if (text && /\d+/.test(text) && text.length < 400 && text.length > 5) {
          data.push(text.replace(/\s+/g, ' ').substring(0, 200));
        }
      });
      return data.slice(0, 10);
    });
    if (heuresRows.length > 0) {
      log('Lignes dans le journal:');
      heuresRows.forEach(r => log(`  → ${r}`));
    } else {
      log('[ATTENTION] Aucune ligne dans le journal des heures');
    }

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 7 — Page Employés
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 7 — Page Employés');

    const employesNav = page.locator('a:has-text("Employés"), button:has-text("Employés"), a:has-text("Employes"), [data-page="employes"]').first();
    const employesNavVisible = await employesNav.isVisible().catch(() => false);
    if (employesNavVisible) {
      await employesNav.click();
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '07-employes', 'Page Employés');
    const employesIssues = await checkForBadValues(page, 'Employés');

    // Chercher onglet Performance
    const perfTab = page.locator('button:has-text("Performance"), [role="tab"]:has-text("Performance")').first();
    const perfTabVisible = await perfTab.isVisible().catch(() => false);
    if (perfTabVisible) {
      await perfTab.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '07b-employes-performance', 'Employés — onglet Performance');
      const perfIssues = await checkForBadValues(page, 'Employés > Performance');
      const perfKPIs = await extractKPIs(page);
      log(`Heures sur Performance: ${perfKPIs.heures.join(', ') || '(aucune)'}`);
      log(`Coûts CHF sur Performance: ${perfKPIs.chfValues.join(', ') || '(aucun)'}`);
    } else {
      log('[INFO] Onglet Performance non trouvé');
    }

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 8 — Navigation complète pour trouver les liens
    // ══════════════════════════════════════════════════════════════════════
    logSection('ÉTAPE 8 — Inventaire de la navigation');

    const navItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('nav a, nav button, [class*="sidebar"] a, [class*="sidebar"] button, [class*="menu"] a').forEach(el => {
        const txt = el.innerText?.trim();
        const href = el.getAttribute('href') || '';
        const dataPg = el.getAttribute('data-page') || '';
        if (txt && txt.length < 50) items.push({ text: txt, href, dataPg });
      });
      return items;
    });
    log('Items de navigation trouvés:');
    navItems.forEach(n => log(`  [${n.href || n.dataPg}] "${n.text}"`));

  } catch (err) {
    log(`[ERREUR FATALE] ${err.message}`);
    await screenshot(page, 'error-state', 'État lors de l\'erreur').catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════
  // RAPPORT FINAL
  // ══════════════════════════════════════════════════════════════════════
  logSection('RAPPORT FINAL — Erreurs console');
  if (consoleErrors.length === 0) {
    log('[OK] Aucune erreur console détectée');
  } else {
    log(`[ALERTE] ${consoleErrors.length} erreur(s) console:`);
    consoleErrors.forEach(e => log(`  ${e}`));
  }

  logSection('RAPPORT FINAL — Résumé');
  log(`Screenshots sauvegardés dans: ${SCREENSHOTS_DIR}`);
  log(`Total erreurs console: ${consoleErrors.length}`);

  // Sauvegarder le rapport texte
  const reportPath = '/home/user/gestion-chantier/playwright-diag/report.txt';
  fs.writeFileSync(reportPath, REPORT.join('\n'));
  log(`\nRapport sauvegardé: ${reportPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('ERREUR SCRIPT:', err);
  process.exit(1);
});
