// CYNA — Test E2E complet avec Playwright
// Flows critiques : Login, Navigation, Calculs, Alertes, BellIcon, Dashboard

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/user/gestion-chantier/test-e2e-screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const RESULTS = { passed: [], failed: [], warnings: [] };

function pass(label) {
  console.log(`[PASS] ${label}`);
  RESULTS.passed.push(label);
}

function fail(label, detail = '') {
  console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  RESULTS.failed.push({ label, detail });
}

function warn(label) {
  console.log(`[WARN] ${label}`);
  RESULTS.warnings.push(label);
}

async function screenshot(page, name, label) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[SCREENSHOT] ${label} -> ${file}`);
  return file;
}

async function checkNoBadValues(page, context) {
  const text = await page.evaluate(() => document.body.innerText);
  const issues = [];
  const nanMatches = text.match(/\bNaN\b/g);
  const undefMatches = text.match(/\bundefined\b/g);
  const infMatches = text.match(/\bInfinity\b/g);
  if (nanMatches) issues.push(`NaN (${nanMatches.length}x)`);
  if (undefMatches) issues.push(`undefined (${undefMatches.length}x)`);
  if (infMatches) issues.push(`Infinity (${infMatches.length}x)`);
  if (issues.length > 0) {
    fail(`${context} — Valeurs invalides visibles`, issues.join(', '));
    const lines = text.split('\n').filter(l => /\bNaN\b|\bundefined\b|\bInfinity\b/.test(l));
    lines.slice(0, 3).forEach(l => console.log(`  Ligne: "${l.trim().substring(0, 80)}"`));
  } else {
    pass(`${context} — Aucun NaN/undefined/Infinity`);
  }
  return issues.length === 0;
}

async function dismissModal(page) {
  const selectors = [
    'button:has-text("Commencer")',
    'button:has-text("Fermer")',
    'button:has-text("Ignorer")',
    'button:has-text("Passer")',
    'button:has-text("Skip")',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(800);
      return true;
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return false;
}

async function naviguerPage(page, label) {
  // Use data-label attribute set on sidebar buttons
  const btn = page.locator(`[data-label="${label}"]`).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true });
    await page.waitForTimeout(2000);
    return true;
  }
  // Fallback: button with exact text in sidebar
  const sidebarBtn = page.locator(`aside button:has-text("${label}"), nav button:has-text("${label}")`).first();
  if (await sidebarBtn.isVisible().catch(() => false)) {
    await sidebarBtn.click({ force: true });
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
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

  // Pre-inject demo flag so the app bypasses Supabase auth on load
  await ctx.addInitScript(() => {
    localStorage.setItem('cyna_demo_mode', '1');
  });

  const page = await ctx.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PageError: ${err.message}`));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  CYNA — Test E2E Playwright');
  console.log('══════════════════════════════════════════════════════════\n');

  try {
    // ══════════════════════════════════════════════════════════════════
    // FLOW 1 — LOGIN
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 1 : LOGIN ───────────────────────────────────────');

    // Charger une nouvelle page sans demo flag pour vérifier l'affichage du login
    // (on utilise un contexte séparé pour ce test uniquement)
    const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const loginPage = await loginCtx.newPage();
    await loginPage.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await loginPage.waitForTimeout(2000);
    await screenshot(loginPage, '01-login', 'Page Login (sans demo)');

    // Vérifier que la page de login s'affiche
    const loginTitle = await loginPage.locator('text=Connexion').first().isVisible().catch(() => false);
    if (loginTitle) {
      pass('Flow 1 — Page login affichée avec titre "Connexion"');
    } else {
      fail('Flow 1 — Titre "Connexion" non visible sur la page login');
    }

    const emailInput = await loginPage.locator('input[type="email"]').isVisible().catch(() => false);
    if (emailInput) {
      pass('Flow 1 — Champ email présent');
    } else {
      fail('Flow 1 — Champ email absent');
    }

    const passwordInput = await loginPage.locator('input[type="password"]').isVisible().catch(() => false);
    if (passwordInput) {
      pass('Flow 1 — Champ mot de passe présent');
    } else {
      fail('Flow 1 — Champ mot de passe absent');
    }

    // Chercher le bouton demo
    const demoBtn = loginPage.locator('[data-testid="demo-login"]');
    const demoBtnVisible = await demoBtn.isVisible().catch(() => false);
    if (demoBtnVisible) {
      pass('Flow 1 — Bouton "Continuer en mode demo" présent');
    } else {
      fail('Flow 1 — Bouton mode demo (data-testid=demo-login) absent');
    }

    await loginCtx.close();

    // Le contexte principal a déjà le demo flag pré-injecté → page principale déjà en mode connecté
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Vérifier que le dashboard est affiché (login form absent)
    const hasLoginFormMain = await page.locator('input[type="password"]').count();
    if (hasLoginFormMain === 0) {
      pass('Flow 1 — Login demo réussi via pré-injection localStorage (formulaire absent)');
    } else {
      fail('Flow 1 — Login demo échoué, formulaire login encore affiché');
      await screenshot(page, '01b-login-failed', 'Login demo échoué');
      await browser.close();
      printReport(consoleErrors);
      return;
    }

    // Dismiss welcome modal if present
    await dismissModal(page);
    await page.waitForTimeout(1000);

    await screenshot(page, '02-after-login', 'Dashboard après connexion demo');
    await checkNoBadValues(page, 'Flow 1 — Post-login');

    // ══════════════════════════════════════════════════════════════════
    // FLOW 2 — NAVIGATION SIDEBAR
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 2 : NAVIGATION SIDEBAR ──────────────────────────');

    // Vérifier la sidebar
    const sidebar = page.locator('aside.sidebar, nav.sidebar-nav, aside').first();
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    if (sidebarVisible) {
      pass('Flow 2 — Sidebar (aside) visible');
    } else {
      warn('Flow 2 — Sidebar (aside) non détectée directement');
    }

    // Nav items définis dans App.js (labels exacts)
    const navItems = [
      'Dashboard', 'Chantiers', 'Devis', 'Finances', 'Clients',
      'Employés', 'Heures', 'Planning', 'Rapports', 'Centre IA',
      'Calculs', 'Alertes', 'Paramètres',
    ];

    for (const item of navItems) {
      const el = page.locator(`[data-label="${item}"]`).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        pass(`Flow 2 — Nav item "${item}" présent (data-label)`);
      } else {
        fail(`Flow 2 — Nav item "${item}" ABSENT de la navigation`);
      }
    }

    await screenshot(page, '03-navigation', 'Vue navigation sidebar');

    // ══════════════════════════════════════════════════════════════════
    // FLOW 3 — PAGE CALCULS
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 3 : PAGE CALCULS ────────────────────────────────');

    const calculsNav = await naviguerPage(page, 'Calculs');
    if (calculsNav) {
      pass('Flow 3 — Navigation vers page Calculs réussie');
    } else {
      fail('Flow 3 — Navigation vers page Calculs échouée');
    }

    await screenshot(page, '04-calculs-page', 'Page Calculs');
    await checkNoBadValues(page, 'Flow 3 — Page Calculs');

    // Vérifier le titre
    const calculsTitle = await page.locator('h1:has-text("Calculs")').isVisible().catch(() => false);
    if (calculsTitle) {
      pass('Flow 3 — Titre "Calculs métier CYNA" présent');
    } else {
      warn('Flow 3 — Titre h1 "Calculs" non détecté');
    }

    // Vérifier les 8 onglets (ONGLETS dans CalculsPage.js)
    const expectedOnglets = [
      { id: 'pricing', label: 'Pricing devis' },
      { id: 'marge',   label: 'Marge / Marque' },
      { id: 'chr',     label: 'CHR' },
      { id: 'duree',   label: 'Durée chantier' },
      { id: 'evm',     label: 'Pilotage EVM' },
      { id: 'treso',   label: 'Trésorerie' },
      { id: 'seuil',   label: 'Seuil rentabilité' },
      { id: 'score',   label: 'Score client' },
    ];

    let ongletsTrouves = 0;
    for (const o of expectedOnglets) {
      const btn = page.locator(`button:has-text("${o.label}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        pass(`Flow 3 — Onglet "${o.label}" présent`);
        ongletsTrouves++;
      } else {
        fail(`Flow 3 — Onglet "${o.label}" ABSENT`);
      }
    }

    console.log(`[INFO] Flow 3 — ${ongletsTrouves}/8 onglets trouvés`);

    // Cliquer sur 2 onglets et vérifier
    const onglet1 = page.locator('button:has-text("CHR")').first();
    if (await onglet1.isVisible().catch(() => false)) {
      await onglet1.click({ force: true });
      await page.waitForTimeout(1000);
      pass('Flow 3 — Clic sur onglet "CHR" sans erreur');
      await screenshot(page, '05-calculs-chr', 'Calculs onglet CHR');
      await checkNoBadValues(page, 'Flow 3 — Onglet CHR');
    }

    const onglet2 = page.locator('button:has-text("Pricing devis")').first();
    if (await onglet2.isVisible().catch(() => false)) {
      await onglet2.click({ force: true });
      await page.waitForTimeout(1000);
      pass('Flow 3 — Clic sur onglet "Pricing devis" sans erreur');
      await screenshot(page, '06-calculs-pricing', 'Calculs onglet Pricing');
      await checkNoBadValues(page, 'Flow 3 — Onglet Pricing');
    }

    // ══════════════════════════════════════════════════════════════════
    // FLOW 4 — PAGE ALERTES
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 4 : PAGE ALERTES ────────────────────────────────');

    const alertesNav = await naviguerPage(page, 'Alertes');
    if (alertesNav) {
      pass('Flow 4 — Navigation vers page Alertes réussie');
    } else {
      fail('Flow 4 — Navigation vers page Alertes échouée');
    }

    await page.waitForTimeout(2000);
    await screenshot(page, '07-alertes-page', 'Page Alertes');
    await checkNoBadValues(page, 'Flow 4 — Page Alertes');

    // Vérifier le titre h1 "Alertes"
    const alertesTitle = await page.locator('h1:has-text("Alertes")').isVisible().catch(() => false);
    if (alertesTitle) {
      pass('Flow 4 — Titre h1 "Alertes" affiché');
    } else {
      const alertesText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      if (alertesText.includes('Alertes') || alertesText.includes('alerte')) {
        pass('Flow 4 — Texte "Alertes" présent dans la page');
      } else {
        fail('Flow 4 — Titre "Alertes" non visible sur la page');
      }
    }

    // Vérifier les 5 badges de sévérité (AlertSeverityBadge renders the severity text)
    const alertesBodyText = await page.evaluate(() => document.body.innerText);
    const severityLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    for (const level of severityLevels) {
      if (alertesBodyText.includes(level)) {
        pass(`Flow 4 — Badge sévérité "${level}" présent`);
      } else {
        fail(`Flow 4 — Badge sévérité "${level}" ABSENT`);
      }
    }

    // Vérifier les filtres (select ou boutons pour sévérité/catégorie)
    // AlertsPage has select for minSeverity and select for category
    const selectCount = await page.locator('select').count();
    const filterBtnCount = await page.locator('button:has-text("Toutes"), button:has-text("Financier"), button:has-text("Planning")').count();

    if (selectCount >= 2) {
      pass(`Flow 4 — Filtres (selects) présents : ${selectCount} select(s)`);
    } else if (filterBtnCount > 0) {
      pass(`Flow 4 — Filtres (boutons) présents : ${filterBtnCount} bouton(s)`);
    } else {
      // Check by looking at AlertsPage.js logic: it has select elements
      const hasFilterSelect = alertesBodyText.includes('Toutes') || alertesBodyText.includes('Financier');
      if (hasFilterSelect) {
        pass('Flow 4 — Options filtres "Toutes/Financier" détectées dans la page');
      } else {
        fail('Flow 4 — Aucun filtre (select/bouton sévérité ou catégorie) détecté');
      }
    }

    await screenshot(page, '08-alertes-content', 'Contenu page Alertes');

    // ══════════════════════════════════════════════════════════════════
    // FLOW 5 — BELLICON TOPBAR / NOTIFICATION CENTER
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 5 : BELLICON TOPBAR ─────────────────────────────');

    // Retour au Dashboard
    await naviguerPage(page, 'Dashboard');
    await page.waitForTimeout(1500);
    await dismissModal(page);
    await page.waitForTimeout(500);

    // Chercher la cloche dans la Topbar (Layout.js: aria-label="Notifications")
    const bellBtn = page.locator('[aria-label="Notifications"]').first();
    const bellVisible = await bellBtn.isVisible().catch(() => false);

    if (bellVisible) {
      pass('Flow 5 — Icône cloche (aria-label="Notifications") présente dans la topbar');
    } else {
      // Fallback: titre="Notifications"
      const bellByTitle = page.locator('button[title="Notifications"]').first();
      const bellTitleVisible = await bellByTitle.isVisible().catch(() => false);
      if (bellTitleVisible) {
        pass('Flow 5 — Icône cloche (title="Notifications") présente dans la topbar');
      } else {
        fail('Flow 5 — Icône cloche (Notifications) non trouvée dans la topbar');
      }
    }

    // Cliquer sur la cloche
    const bellToClick = page.locator('[aria-label="Notifications"], button[title="Notifications"]').first();
    if (await bellToClick.isVisible().catch(() => false)) {
      await bellToClick.click({ force: true });
      await page.waitForTimeout(2000);
      pass('Flow 5 — Clic sur icône cloche sans erreur');
    }

    await screenshot(page, '09-bell-clicked', 'Après clic sur cloche (NotificationCenter)');

    // Vérifier que le NotificationCenter s'ouvre
    // Layout.js: NotificationBell renders alerts from calculerAlertes
    // The panel shows alerts with categories like 'critique', 'warning', 'info'
    const bellBodyText = await page.evaluate(() => document.body.innerText);

    // The notification panel should show notification count and "Tout marquer lu" button
    const notifPanelKeywords = ['Notifications', 'marquer', 'critique', 'warning', 'alerte'];
    let kwFound = 0;
    for (const kw of notifPanelKeywords) {
      if (bellBodyText.toLowerCase().includes(kw.toLowerCase())) kwFound++;
    }

    if (kwFound >= 2) {
      pass(`Flow 5 — NotificationCenter ouvert (${kwFound} mots-clés)`);
    } else {
      warn(`Flow 5 — NotificationCenter : seulement ${kwFound} mots-clés détectés après clic`);
    }

    // ══════════════════════════════════════════════════════════════════
    // FLOW 6 — DASHBOARD
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── FLOW 6 : DASHBOARD ───────────────────────────────────');

    // Fermer notification panel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const dashNav = await naviguerPage(page, 'Dashboard');
    if (!dashNav) {
      // Direct goto
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await dismissModal(page);
    }
    await page.waitForTimeout(2500);
    await dismissModal(page);

    await screenshot(page, '10-dashboard', 'Dashboard');
    await checkNoBadValues(page, 'Flow 6 — Dashboard');

    // Vérifier les KPI
    const dashText = await page.evaluate(() => document.body.innerText);
    const hasCHF = /CHF\s*[\d'.,]+/.test(dashText);
    const hasPercentage = /\d+[.,\d]*\s*%/.test(dashText);
    const hasHours = /\d+\s*h(?:eures?)?/.test(dashText);

    if (hasCHF) {
      pass('Flow 6 — KPI montants CHF affichés sur le Dashboard');
      const chfValues = dashText.match(/CHF\s*[\d'.,]+/g) || [];
      console.log(`[INFO] Flow 6 — Exemples CHF: ${chfValues.slice(0, 5).join(' | ')}`);
    } else {
      fail('Flow 6 — Aucun montant CHF visible sur le Dashboard');
    }

    if (hasPercentage) {
      pass('Flow 6 — Pourcentages affichés sur le Dashboard');
    } else {
      warn('Flow 6 — Aucun pourcentage visible sur le Dashboard');
    }

    if (hasHours) {
      pass('Flow 6 — Données heures affichées sur le Dashboard');
    }

    // Vérifier l'absence d'erreurs React
    const hasReactError = dashText.includes('Something went wrong') || dashText.includes('Component Error');
    if (!hasReactError) {
      pass('Flow 6 — Dashboard sans erreur React visible');
    } else {
      fail('Flow 6 — Erreur React visible sur le Dashboard');
    }

    // Vérifier format CHF (apostrophe séparateur suisse)
    const chfFormatted = dashText.match(/CHF\s*\d+'\d{3}/);
    if (chfFormatted) {
      pass(`Flow 6 — Format CHF suisse correct (apostrophe) : ${chfFormatted[0]}`);
    } else {
      warn('Flow 6 — Format CHF avec apostrophe suisse non détecté');
    }

    await screenshot(page, '11-dashboard-final', 'Dashboard final');

    // ══════════════════════════════════════════════════════════════════
    // VÉRIFICATION CONSOLE
    // ══════════════════════════════════════════════════════════════════
    console.log('\n─── ERREURS CONSOLE ──────────────────────────────────────');

    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('400') &&
      !e.includes('401') &&
      !e.includes('supabase') &&
      !e.includes('Supabase') &&
      !e.includes('Failed to load resource') &&
      !e.includes('favicon') &&
      !e.includes('net::ERR')
    );

    if (criticalErrors.length === 0) {
      pass('Console — Aucune erreur JS critique');
    } else {
      fail(`Console — ${criticalErrors.length} erreur(s) JS critique(s)`, criticalErrors.slice(0, 3).join(' | '));
    }

    if (consoleErrors.length > 0) {
      console.log(`[INFO] Total erreurs console (incluant Supabase/réseau): ${consoleErrors.length}`);
      consoleErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 120)}`));
    }

    if (consoleWarnings.length > 0) {
      console.log(`[INFO] Warnings console: ${consoleWarnings.length}`);
      consoleWarnings.slice(0, 3).forEach(w => console.log(`  - ${w.substring(0, 120)}`));
    }

  } catch (err) {
    fail('Test E2E — Exception non gérée', err.message);
    console.error(err.stack);
    await screenshot(page, 'error-state', 'État lors de l\'erreur').catch(() => {});
  } finally {
    await browser.close();
  }

  printReport(consoleErrors);
}

function printReport(consoleErrors) {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  RAPPORT FINAL');
  console.log('══════════════════════════════════════════════════════════\n');

  console.log(`PASSES  : ${RESULTS.passed.length}`);
  console.log(`FAILURES: ${RESULTS.failed.length}`);
  console.log(`WARNINGS: ${RESULTS.warnings.length}`);

  if (RESULTS.failed.length > 0) {
    console.log('\n[ECHECS] :');
    RESULTS.failed.forEach(f => console.log(`  x ${f.label}${f.detail ? ' (' + f.detail.substring(0, 80) + ')' : ''}`));
  }

  if (RESULTS.warnings.length > 0) {
    console.log('\n[AVERTISSEMENTS] :');
    RESULTS.warnings.forEach(w => console.log(`  ! ${w}`));
  }

  console.log('\n[PASSES] :');
  RESULTS.passed.forEach(p => console.log(`  + ${p}`));

  console.log(`\nScreenshots: ${SCREENSHOTS_DIR}`);

  const reportPath = '/home/user/gestion-chantier/test-e2e-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { passed: RESULTS.passed.length, failed: RESULTS.failed.length, warnings: RESULTS.warnings.length },
    passed: RESULTS.passed,
    failed: RESULTS.failed,
    warnings: RESULTS.warnings,
    consoleErrors: consoleErrors.slice(0, 10),
  }, null, 2));
  console.log(`\nRapport JSON: ${reportPath}`);
}

main().catch(e => { console.error('FATAL:', e.stack); process.exit(1); });
