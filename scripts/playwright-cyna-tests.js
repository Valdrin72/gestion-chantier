/**
 * CYNA Playwright E2E Test Suite
 * Tests: initial load, dashboard KPIs, mobile/desktop responsive, console errors, dark mode
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = '/home/user/gestion-chantier/scripts/screenshots';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}-${timestamp()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  [SCREENSHOT] ${filepath}`);
  return filepath;
}

async function checkForBadValues(page, context) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const issues = [];

  // Check for NaN, undefined, Infinity in visible text
  if (/\bNaN\b/.test(bodyText)) {
    const matches = bodyText.match(/[^\n]*\bNaN\b[^\n]*/g) || [];
    issues.push({ type: 'NaN', occurrences: matches.slice(0, 5) });
  }
  if (/\bundefined\b/.test(bodyText)) {
    const matches = bodyText.match(/[^\n]*\bundefined\b[^\n]*/g) || [];
    issues.push({ type: 'undefined', occurrences: matches.slice(0, 5) });
  }
  if (/\bInfinity\b/.test(bodyText)) {
    const matches = bodyText.match(/[^\n]*\bInfinity\b[^\n]*/g) || [];
    issues.push({ type: 'Infinity', occurrences: matches.slice(0, 5) });
  }

  return issues;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('PLAYWRIGHT CYNA — Tests E2E');
  console.log(`URL : ${BASE_URL}`);
  console.log(`Date : ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    initialState: null,
    nanUndefinedIssues: [],
    consoleErrors: [],
    consoleWarnings: [],
    mobile: { status: null, issues: [] },
    desktop: { status: null, issues: [] },
    darkMode: { found: false, status: null },
    domStructure: null,
    formFields: [],
    kpisVisible: false,
    anomalies: []
  };

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Collect console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      results.consoleErrors.push(text);
    } else if (msg.type() === 'warning' || msg.type() === 'warn') {
      results.consoleWarnings.push(text);
    }
  });

  // Collect page errors
  page.on('pageerror', err => {
    results.consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });

  // ==========================
  // TEST 1 — Initial Load
  // ==========================
  console.log('\n--- TEST 1 : Chargement initial ---');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const url = page.url();
    console.log(`  Titre page: "${title}"`);
    console.log(`  URL actuelle: ${url}`);

    // Determine if login or dashboard
    const hasLoginForm = await page.$('input[type="email"], input[type="password"], input[name="email"], input[name="password"]');
    const hasDashboard = await page.$('[class*="dashboard"], [class*="Dashboard"], h1, h2');

    // Check page text for login indicators
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    const isLoginPage = /connexion|login|email|mot de passe|password/i.test(bodyText) || hasLoginForm;

    if (isLoginPage) {
      results.initialState = 'login';
      console.log('  => Etat: ECRAN DE LOGIN');
    } else {
      results.initialState = 'dashboard';
      console.log('  => Etat: DASHBOARD');
    }

    await takeScreenshot(page, '01-initial-load');

  } catch (err) {
    results.initialState = 'error';
    results.anomalies.push(`Chargement initial: ${err.message}`);
    console.error(`  ERREUR: ${err.message}`);
  }

  // ==========================
  // TEST 2 — DOM Snapshot + Bad Values check
  // ==========================
  console.log('\n--- TEST 2 : Analyse DOM et valeurs aberrantes ---');
  try {
    // Get key DOM elements
    const elements = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
        type: el.type,
        name: el.name,
        placeholder: el.placeholder,
        id: el.id
      }));

      const buttons = Array.from(document.querySelectorAll('button')).map(el => el.innerText.trim()).filter(t => t.length > 0);

      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(el => el.innerText.trim()).filter(t => t.length > 0);

      const labels = Array.from(document.querySelectorAll('label')).map(el => el.innerText.trim()).filter(t => t.length > 0);

      const errorMessages = Array.from(document.querySelectorAll('[class*="error"], [class*="Error"], [class*="alert"], [role="alert"]'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 0);

      return { inputs, buttons: buttons.slice(0, 20), headings, labels: labels.slice(0, 15), errorMessages };
    });

    console.log(`  Inputs trouvés: ${elements.inputs.length}`);
    elements.inputs.forEach(inp => console.log(`    - [${inp.type}] name="${inp.name}" placeholder="${inp.placeholder}"`));
    console.log(`  Boutons: ${elements.buttons.join(' | ')}`);
    console.log(`  Titres: ${elements.headings.join(' | ')}`);
    console.log(`  Labels: ${elements.labels.join(' | ')}`);
    if (elements.errorMessages.length > 0) {
      console.log(`  Messages d'erreur: ${elements.errorMessages.join(' | ')}`);
      results.anomalies.push(`Messages d'erreur UI: ${elements.errorMessages.join('; ')}`);
    }

    results.domStructure = elements;
    results.formFields = elements.inputs;

    // Check for NaN/undefined/Infinity
    const badValues = await checkForBadValues(page, 'desktop-initial');
    if (badValues.length > 0) {
      results.nanUndefinedIssues = badValues;
      badValues.forEach(bv => {
        console.log(`  ANOMALIE: ${bv.type} detecte!`);
        bv.occurrences.forEach(o => console.log(`    => "${o.trim()}"`));
      });
    } else {
      console.log('  OK: Aucun NaN / undefined / Infinity visible dans l\'UI');
    }

    // Check if KPIs visible (only for dashboard)
    if (results.initialState === 'dashboard') {
      const kpiElements = await page.$$('[class*="kpi"], [class*="stat"], [class*="metric"], [class*="card"]');
      results.kpisVisible = kpiElements.length > 0;
      console.log(`  KPIs/Cards visibles: ${kpiElements.length}`);
    }

  } catch (err) {
    results.anomalies.push(`Analyse DOM: ${err.message}`);
    console.error(`  ERREUR: ${err.message}`);
  }

  // ==========================
  // TEST 3 — Mobile 375px
  // ==========================
  console.log('\n--- TEST 3 : Responsive mobile (375x812) ---');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // Check if content is still visible and not broken
    const mobileCheck = await page.evaluate(() => {
      const body = document.body;
      const bodyWidth = body.scrollWidth;
      const viewportWidth = window.innerWidth;
      const hasHorizontalScroll = bodyWidth > viewportWidth;

      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');
      const visibleText = document.body.innerText.substring(0, 200);

      return {
        bodyWidth,
        viewportWidth,
        hasHorizontalScroll,
        inputCount: inputs.length,
        buttonCount: buttons.length,
        visibleText
      };
    });

    console.log(`  Viewport: ${mobileCheck.viewportWidth}px | Body scroll width: ${mobileCheck.bodyWidth}px`);
    console.log(`  Scroll horizontal: ${mobileCheck.hasHorizontalScroll ? 'OUI (probleme potentiel)' : 'NON (ok)'}`);
    console.log(`  Inputs: ${mobileCheck.inputCount} | Boutons: ${mobileCheck.buttonCount}`);

    if (mobileCheck.hasHorizontalScroll) {
      results.mobile.issues.push('Scroll horizontal détecté (overflow)');
      results.mobile.status = 'problèmes détectés';
    } else {
      results.mobile.status = 'OK';
    }

    // Check bad values on mobile too
    const mobileBadValues = await checkForBadValues(page, 'mobile');
    if (mobileBadValues.length > 0) {
      results.mobile.issues.push(...mobileBadValues.map(bv => `${bv.type} visible`));
    }

    await takeScreenshot(page, '03-mobile-375');

    console.log(`  => Mobile: ${results.mobile.status}`);

  } catch (err) {
    results.mobile.status = 'erreur';
    results.anomalies.push(`Test mobile: ${err.message}`);
    console.error(`  ERREUR: ${err.message}`);
  }

  // ==========================
  // TEST 4 — Desktop 1280px
  // ==========================
  console.log('\n--- TEST 4 : Desktop (1280x800) ---');
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    const desktopCheck = await page.evaluate(() => {
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
        elemCount: document.querySelectorAll('*').length
      };
    });

    console.log(`  Viewport: ${desktopCheck.viewportWidth}px | Body: ${desktopCheck.bodyWidth}px`);
    console.log(`  Elements DOM: ${desktopCheck.elemCount}`);
    console.log(`  Scroll horizontal: ${desktopCheck.hasHorizontalScroll ? 'OUI' : 'NON'}`);

    if (desktopCheck.hasHorizontalScroll) {
      results.desktop.issues.push('Scroll horizontal inattendu');
      results.desktop.status = 'problèmes détectés';
    } else {
      results.desktop.status = 'OK';
    }

    const desktopBadValues = await checkForBadValues(page, 'desktop');
    if (desktopBadValues.length > 0) {
      results.desktop.issues.push(...desktopBadValues.map(bv => `${bv.type} visible`));
      results.desktop.status = 'problèmes détectés';
    }

    await takeScreenshot(page, '04-desktop-1280');
    console.log(`  => Desktop: ${results.desktop.status}`);

  } catch (err) {
    results.desktop.status = 'erreur';
    results.anomalies.push(`Test desktop: ${err.message}`);
    console.error(`  ERREUR: ${err.message}`);
  }

  // ==========================
  // TEST 5 — Console messages (already collected)
  // ==========================
  console.log('\n--- TEST 5 : Messages console ---');
  console.log(`  Erreurs: ${results.consoleErrors.length}`);
  results.consoleErrors.slice(0, 10).forEach(e => console.log(`    [ERROR] ${e.substring(0, 200)}`));
  console.log(`  Warnings: ${results.consoleWarnings.length}`);
  results.consoleWarnings.slice(0, 5).forEach(w => console.log(`    [WARN] ${w.substring(0, 200)}`));

  // ==========================
  // TEST 6 — Dark mode
  // ==========================
  console.log('\n--- TEST 6 : Dark mode ---');
  try {
    // Look for dark mode toggle
    const darkModeSelectors = [
      'button[aria-label*="dark"]',
      'button[aria-label*="Dark"]',
      'button[aria-label*="mode"]',
      'button[title*="dark"]',
      '[class*="dark-toggle"]',
      '[class*="theme-toggle"]',
      '[class*="darkMode"]',
      'button svg[class*="moon"]',
      '[data-testid*="dark"]',
      '[data-testid*="theme"]'
    ];

    let darkToggle = null;
    for (const selector of darkModeSelectors) {
      darkToggle = await page.$(selector);
      if (darkToggle) {
        console.log(`  Toggle dark mode trouve: "${selector}"`);
        results.darkMode.found = true;
        break;
      }
    }

    // Also search by text content
    if (!darkToggle) {
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const text = await btn.innerText().catch(() => '');
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        if (/dark|nuit|moon|theme/i.test(text + ariaLabel)) {
          darkToggle = btn;
          results.darkMode.found = true;
          console.log(`  Toggle dark mode trouve par texte: "${text || ariaLabel}"`);
          break;
        }
      }
    }

    if (darkToggle) {
      await darkToggle.click();
      await page.waitForTimeout(600);

      // Check if dark mode is applied
      const isDark = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        return html.classList.contains('dark') ||
               body.classList.contains('dark') ||
               document.querySelector('[class*="dark"]') !== null;
      });

      await takeScreenshot(page, '06-dark-mode');
      results.darkMode.status = isDark ? 'OK — dark mode activé' : 'toggle cliqué mais dark mode non détecté via classe';
      console.log(`  => Dark mode: ${results.darkMode.status}`);

      // Toggle back
      await darkToggle.click();
      await page.waitForTimeout(300);
    } else {
      results.darkMode.status = 'toggle non trouvé';
      console.log('  Toggle dark mode: NON TROUVE dans la page actuelle');

      // Check if dark mode is implemented differently (via CSS media query or localStorage)
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
               document.body.classList.contains('dark');
      });
      console.log(`  Classe dark active: ${hasDarkClass}`);
    }

  } catch (err) {
    results.darkMode.status = 'erreur';
    results.anomalies.push(`Test dark mode: ${err.message}`);
    console.error(`  ERREUR: ${err.message}`);
  }

  // ==========================
  // EXTRA — If login page: verify form quality
  // ==========================
  if (results.initialState === 'login') {
    console.log('\n--- EXTRA : Qualite du formulaire login ---');
    try {
      const emailInput = await page.$('input[type="email"], input[name="email"]');
      const passwordInput = await page.$('input[type="password"], input[name="password"]');
      const submitBtn = await page.$('button[type="submit"], button');

      console.log(`  Champ email: ${emailInput ? 'PRESENT' : 'ABSENT'}`);
      console.log(`  Champ password: ${passwordInput ? 'PRESENT' : 'ABSENT'}`);
      console.log(`  Bouton submit: ${submitBtn ? 'PRESENT' : 'ABSENT'}`);

      if (!emailInput) results.anomalies.push('Champ email manquant dans le formulaire login');
      if (!passwordInput) results.anomalies.push('Champ password manquant dans le formulaire login');
      if (!submitBtn) results.anomalies.push('Bouton submit manquant dans le formulaire login');

      // Check for visible error on blank submit
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        const afterClickBadValues = await checkForBadValues(page, 'login-after-submit');
        if (afterClickBadValues.length > 0) {
          results.anomalies.push(`Valeurs aberrantes après submit vide: ${afterClickBadValues.map(v => v.type).join(', ')}`);
        }
        await takeScreenshot(page, '07-login-submit-empty');
      }

      // Try to type in fields to verify they're interactive
      if (emailInput) {
        await emailInput.fill('test@example.com');
        console.log('  Saisie email: OK (champ interactif)');
      }
      if (passwordInput) {
        await passwordInput.fill('testpassword');
        console.log('  Saisie password: OK (champ interactif)');
      }

    } catch (err) {
      results.anomalies.push(`Test formulaire login: ${err.message}`);
      console.error(`  ERREUR: ${err.message}`);
    }
  }

  await browser.close();

  // ==========================
  // RAPPORT FINAL
  // ==========================
  console.log('\n');
  console.log('='.repeat(60));
  console.log('RAPPORT PLAYWRIGHT CYNA — ' + new Date().toLocaleDateString('fr-CH'));
  console.log(`URL : ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');
  console.log(`ETAT INITIAL : ${results.initialState?.toUpperCase()}`);
  console.log('');

  const hasNanIssues = results.nanUndefinedIssues.length > 0;
  console.log(`NaN/undefined dans l'UI : ${hasNanIssues ? 'OUI' : 'NON'}`);
  if (hasNanIssues) {
    results.nanUndefinedIssues.forEach(issue => {
      console.log(`  => ${issue.type}: ${issue.occurrences.length} occurrence(s)`);
      issue.occurrences.forEach(o => console.log(`     "${o.trim()}"`));
    });
  }

  console.log('');
  const errCount = results.consoleErrors.length;
  console.log(`Erreurs console : ${errCount === 0 ? 'aucune' : errCount + ' erreur(s)'}`);
  results.consoleErrors.slice(0, 5).forEach(e => console.log(`  => ${e.substring(0, 150)}`));

  const warnCount = results.consoleWarnings.length;
  console.log(`Warnings console : ${warnCount === 0 ? 'aucun' : warnCount + ' warning(s)'}`);
  results.consoleWarnings.slice(0, 3).forEach(w => console.log(`  => ${w.substring(0, 150)}`));

  console.log('');
  console.log(`MOBILE 375px : ${results.mobile.status}`);
  results.mobile.issues.forEach(i => console.log(`  => ${i}`));

  console.log(`DESKTOP 1280px : ${results.desktop.status}`);
  results.desktop.issues.forEach(i => console.log(`  => ${i}`));

  console.log(`DARK MODE : ${results.darkMode.found ? 'toggle present — ' + results.darkMode.status : 'toggle non trouvé dans la page de login'}`);

  console.log('');
  console.log('ANOMALIES VISUELLES :');
  if (results.anomalies.length === 0) {
    console.log('  Aucune');
  } else {
    results.anomalies.forEach(a => console.log(`  - ${a}`));
  }

  console.log('');
  const hasProblems = hasNanIssues || errCount > 0 || results.anomalies.length > 0 ||
    results.mobile.status?.includes('problème') || results.desktop.status?.includes('problème');

  console.log(`RESUME : ${hasProblems ? 'REGRESSIONS DETECTEES' : 'app stable — aucune anomalie critique'}`);
  console.log('');
  console.log(`Screenshots sauvegardes dans : ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(60));

  return results;
}

runTests().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
