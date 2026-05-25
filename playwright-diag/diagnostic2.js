// CYNA — Diagnostic ciblé v2 : focus sur les anomalies de calcul
// Teste spécifiquement les valeurs 0 reportées par l'utilisateur

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/user/gestion-chantier/playwright-diag/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const REPORT = [];
function log(msg) { console.log(msg); REPORT.push(msg); }
function logSection(title) {
  const line = '═'.repeat(60);
  log(`\n${line}`);
  log(`  ${title}`);
  log(line);
}

async function dismissModal(page) {
  const selectors = [
    'button:has-text("Commencer")', 'button:has-text("Fermer")',
    'button:has-text("Ignorer")', 'button:has-text("Passer")',
    'button:has-text("Skip")',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return false;
}

async function screenshot(page, name, label) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`[SCREENSHOT] ${label} → ${file}`);
  return file;
}

async function navTo(page, dataLabel) {
  const el = page.locator(`[data-label="${dataLabel}"]`).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click({ force: true });
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CH' });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PageError: ${err.message}`));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await dismissModal(page);
  await page.waitForTimeout(1000);

  // ══════════════════════════════════════════════════════════════════
  // TEST 1 — Devis : vérifier les montants HT affichés
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 1 — Devis : montants HT');
  await navTo(page, 'Devis');
  await page.waitForTimeout(1500);

  // Vérifier les KPI cards en haut
  const devisKPIs = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="kpi"], [class*="stat-card"], [class*="card"]');
    const result = [];
    cards.forEach(c => {
      const txt = c.innerText?.trim();
      if (txt && txt.length < 150) result.push(txt.replace(/\s+/g, ' '));
    });
    return result.slice(0, 10);
  });
  log('KPI cards Devis:');
  devisKPIs.forEach(k => log(`  "${k}"`));

  // Vérifier les montants dans le tableau
  const devisRows = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tbody tr').forEach(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.innerText?.trim().replace(/\s+/g, ' '));
      if (tds.length > 0) rows.push(tds);
    });
    return rows;
  });
  log(`Nombre de lignes devis: ${devisRows.length}`);
  devisRows.forEach((row, i) => {
    log(`  Devis ${i+1}: ${row.join(' | ')}`);
    // Vérifier si un montant est 0 ou manquant
    const montantCol = row.find(cell => cell.includes('CHF') || /^\d/.test(cell));
    if (montantCol && (montantCol.includes('0') || montantCol === '—')) {
      log(`  [ALERTE] Montant suspect: "${montantCol}"`);
    }
  });

  // Screenshot zoomé sur tableau devis
  await screenshot(page, 'devis-tableau', 'Tableau des devis');

  // ══════════════════════════════════════════════════════════════════
  // TEST 2 — Nouveau devis : vérifier TTC = HT × 1.081
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 2 — Nouveau devis (calcul TTC)');
  const newDevisBtn = page.locator('button:has-text("Nouveau devis"), a:has-text("Nouveau devis")').first();
  if (await newDevisBtn.isVisible().catch(() => false)) {
    await newDevisBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await screenshot(page, 'devis-new-form', 'Formulaire nouveau devis');

    // Saisir un montant HT pour vérifier le calcul TTC
    const montantHTInput = page.locator('input[name*="montant"], input[placeholder*="HT"], input[placeholder*="montant"]').first();
    const hasMontantHT = await montantHTInput.isVisible().catch(() => false);
    if (hasMontantHT) {
      await montantHTInput.fill('10000');
      await page.waitForTimeout(500);
      // Chercher le TTC affiché
      const ttcValue = await page.evaluate(() => {
        const allText = document.body.innerText;
        const match = allText.match(/TTC[^\d]*(\d[\d'.,]+)|(\d[\d'.,]+)[^\d]*TTC/i);
        return match ? match[0] : null;
      });
      log(`TTC affiché pour HT=10000: "${ttcValue || 'non trouvé'}"`);
      log(`TTC attendu: 10'810.00`);
    }
    // Retour
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await navTo(page, 'Devis');
    await page.waitForTimeout(1000);
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 3 — Chantiers : marge, CA, avancement
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 3 — Chantiers : CA, marge, avancement');
  await navTo(page, 'Dashboard'); // reset
  await page.waitForTimeout(500);
  const chantiersBtn = page.locator('button:has-text("Chantiers"), a:has-text("Chantiers")').first();
  if (await chantiersBtn.isVisible().catch(() => false)) {
    await chantiersBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // KPIs de la page chantiers
  const chantiersPageKPIs = await page.evaluate(() => {
    const allText = document.body.innerText;
    // Chercher les patterns spécifiques
    const caMatch = allText.match(/CA[^\n]*\n[^\n]*/i);
    const margeMatch = allText.match(/MARGE[^\n]*\n[^\n]*/i);
    return {
      fullText: allText.substring(0, 3000),
    };
  });

  // Screenshot page chantiers
  await screenshot(page, 'chantiers-full', 'Page Chantiers complète');

  // Lister les chantiers avec leurs données
  const chantiersList = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tbody tr').forEach(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.innerText?.trim().replace(/\s+/g, ' '));
      if (tds.length > 2) rows.push(tds.join(' | '));
    });
    return rows;
  });
  log(`Lignes chantiers dans tableau: ${chantiersList.length}`);
  chantiersList.forEach(r => log(`  ${r}`));

  // ══════════════════════════════════════════════════════════════════
  // TEST 4 — Détail d'un chantier (marge, coût MO, avancement)
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 4 — Détail chantier : CA = devis.montantHT');

  // Cliquer sur le premier chantier EN COURS
  const firstChantier = page.locator('tbody tr').first();
  if (await firstChantier.isVisible().catch(() => false)) {
    await firstChantier.click({ force: true });
    await page.waitForTimeout(2000);
  } else {
    // Chercher un bouton "Ouvrir" ou "Détail"
    const openBtn = page.locator('button:has-text("Ouvrir"), button:has-text("Détail"), button:has-text("Voir")').first();
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  await screenshot(page, 'chantier-detail-full', 'Détail chantier complet');

  // Extraire toutes les valeurs du détail
  const detailData = await page.evaluate(() => {
    const allText = document.body.innerText;
    return allText;
  });

  // Chercher les valeurs clés
  const caPattern = /CA[^\n]{0,30}(CHF[\s\d'.,]+|[\d'.,]+\s*CHF)/gi;
  const margePattern = /[Mm]arge[^\n]{0,30}(-?\d+[.,]\d+\s*%|-?\d+\s*%)/g;
  const coutMOPattern = /[Mm]ain.?d.{0,3}[Oo]euvre[^\n]{0,30}(CHF[\s\d'.,]+|[\d'.,]+\s*CHF)/gi;
  const avancementPattern = /[Aa]vancement[^\n]{0,30}(-?\d+[.,]\d+\s*%|-?\d+\s*%)/g;

  const caMatches = [...detailData.matchAll(caPattern)].map(m => m[0].replace(/\s+/g, ' '));
  const margeMatches = [...detailData.matchAll(margePattern)].map(m => m[0].replace(/\s+/g, ' '));
  const avMatches = [...detailData.matchAll(avancementPattern)].map(m => m[0].replace(/\s+/g, ' '));

  log(`CA dans détail chantier: ${caMatches.slice(0,3).join(' | ') || '(non trouvé)'}`);
  log(`Marge dans détail: ${margeMatches.slice(0,3).join(' | ') || '(non trouvé)'}`);
  log(`Avancement dans détail: ${avMatches.slice(0,3).join(' | ') || '(non trouvé)'}`);

  // Chercher les onglets du détail
  const tabs = await page.evaluate(() => {
    return [...document.querySelectorAll('[role="tab"], button[class*="tab"]')].map(t => t.innerText?.trim());
  });
  log(`Onglets détail chantier: ${tabs.join(', ')}`);

  // Cliquer sur onglet "Analyse" ou "Financier"
  const analyseTab = page.locator('button:has-text("Analyse"), button:has-text("Financier"), [role="tab"]:has-text("Analyse"), [role="tab"]:has-text("Financier")').first();
  if (await analyseTab.isVisible().catch(() => false)) {
    await analyseTab.click({ force: true });
    await page.waitForTimeout(1500);
    await screenshot(page, 'chantier-analyse', 'Onglet Analyse du chantier');

    const analyseData = await page.evaluate(() => document.body.innerText);
    const eacPattern = /EAC[^\n]{0,50}/gi;
    const radPattern = /RAD[^\n]{0,50}/gi;
    const eacMatches = [...analyseData.matchAll(eacPattern)].map(m => m[0].replace(/\s+/g, ' '));
    const radMatches = [...analyseData.matchAll(radPattern)].map(m => m[0].replace(/\s+/g, ' '));
    log(`EAC: ${eacMatches.slice(0,3).join(' | ') || '(non trouvé)'}`);
    log(`RAD: ${radMatches.slice(0,3).join(' | ') || '(non trouvé)'}`);

    // Vérifier NaN dans onglet analyse
    const hasNaN = /\bNaN\b/.test(analyseData);
    const hasUndef = /\bundefined\b/.test(analyseData);
    log(`NaN dans Analyse: ${hasNaN ? '[ALERTE] OUI' : '[OK] NON'}`);
    log(`undefined dans Analyse: ${hasUndef ? '[ALERTE] OUI' : '[OK] NON'}`);

    await screenshot(page, 'chantier-analyse-zoom', 'Analyse chantier (onglet Analyse)');
  }

  // ══════════════════════════════════════════════════════════════════
  // TEST 5 — Heures : vérifier coût MO et avancement
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 5 — Heures : coût MO = h/8 × tarifJour × coeff');
  await navTo(page, 'Heures');
  await page.waitForTimeout(1500);

  // Voir les données de la semaine courante
  await screenshot(page, 'heures-semaine', 'Heures cette semaine');

  // Cliquer sur Année pour voir tout
  const anneeBtn = page.locator('button:has-text("Année"), button:has-text("année")').first();
  if (await anneeBtn.isVisible().catch(() => false)) {
    await anneeBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await screenshot(page, 'heures-annee', 'Heures vue annuelle');
  }

  // Vérifier les totaux par employé
  const heuresEmployes = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tbody tr').forEach(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.innerText?.trim().replace(/\s+/g, ' '));
      if (tds.length > 0 && /\d/.test(tds.join(''))) rows.push(tds.join(' | '));
    });
    return rows.slice(0, 15);
  });
  log('Tableau heures par employé:');
  heuresEmployes.forEach(r => log(`  ${r}`));

  // ══════════════════════════════════════════════════════════════════
  // TEST 6 — Alertes
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 6 — Alertes actives');
  await navTo(page, 'Dashboard');
  await page.waitForTimeout(1500);
  await dismissModal(page);

  const alertesText = await page.evaluate(() => {
    const alertDiv = document.querySelector('[class*="alert"], [class*="alerte"], [id*="alert"]');
    return alertDiv ? alertDiv.innerText : document.body.innerText.match(/alerte|critique|attention|danger/gi) ? 'alertes trouvées dans le texte' : 'aucune';
  });
  log(`Alertes sur Dashboard: ${alertesText.substring(0, 200)}`);

  // Screenshot alertes
  await screenshot(page, 'dashboard-alertes', 'Dashboard avec alertes');

  // ══════════════════════════════════════════════════════════════════
  // TEST 7 — Vérifier l'affichage des données démo dans le dashboard
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 7 — KPIs Dashboard (CA, Marge, Heures)');

  const dashboardKPIs = await page.evaluate(() => {
    const text = document.body.innerText;
    // Chercher les 4 grandes cartes KPI
    const kpiCards = [];
    document.querySelectorAll('[class*="kpi"], [class*="stat"], [class*="card"]').forEach(card => {
      const txt = card.innerText?.trim().replace(/\s+/g, ' ');
      if (txt && txt.length < 200 && /\d/.test(txt)) kpiCards.push(txt);
    });
    return {
      cards: kpiCards.slice(0, 8),
      // Valeurs spécifiques attendues
      hasCHF: /CHF\s*[\d']+/.test(text),
      hasPercent: /\d+[.,]\d+\s*%/.test(text),
      hasHeures: /\d+[',]?\d*\s*h(?:eures?)?/i.test(text),
      hasNaN: /\bNaN\b/.test(text),
      hasUndefined: /\bundefined\b/.test(text),
    };
  });
  log(`Dashboard - CHF présent: ${dashboardKPIs.hasCHF}`);
  log(`Dashboard - Pourcentages présents: ${dashboardKPIs.hasPercent}`);
  log(`Dashboard - Heures présentes: ${dashboardKPIs.hasHeures}`);
  log(`Dashboard - NaN présent: ${dashboardKPIs.hasNaN ? '[ALERTE] OUI' : '[OK] NON'}`);
  log(`Dashboard - undefined présent: ${dashboardKPIs.hasUndefined ? '[ALERTE] OUI' : '[OK] NON'}`);
  log('KPI cards:');
  dashboardKPIs.cards.forEach(c => log(`  "${c}"`));

  // ══════════════════════════════════════════════════════════════════
  // TEST 8 — Page Heures : chantier sélectionné et ses heures
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 8 — Heures : vérifier chantier 1 (BPG)');
  await navTo(page, 'Heures');
  await page.waitForTimeout(1000);

  // Chercher filtre par chantier
  const chantierFilter = page.locator('select, [class*="select"]').first();
  const hasSelect = await chantierFilter.isVisible().catch(() => false);
  log(`Filtre chantier disponible: ${hasSelect}`);

  // Récupérer tous les totaux visibles
  const heuresVals = await page.evaluate(() => {
    const text = document.body.innerText;
    const matches = text.match(/\b\d+[',]?\d*\s*(?:heures?|h\b)/gi) || [];
    const totals = text.match(/TOTAL[^\n]*\n[^\n]*/gi) || [];
    const kpis = [];
    document.querySelectorAll('[class*="kpi"], [class*="total"], [class*="sum"]').forEach(el => {
      const t = el.innerText?.trim();
      if (t && /\d/.test(t)) kpis.push(t.substring(0, 80));
    });
    return { heures: [...new Set(matches)].slice(0, 10), totals: totals.slice(0, 5), kpis: kpis.slice(0, 8) };
  });
  log(`Valeurs heures: ${heuresVals.heures.join(' | ')}`);
  log(`Totaux: ${heuresVals.totals.join(' | ')}`);
  log('KPI heures:');
  heuresVals.kpis.forEach(k => log(`  "${k}"`));

  // ══════════════════════════════════════════════════════════════════
  // TEST 9 — Statistiques générales : vérifier 0 partout?
  // ══════════════════════════════════════════════════════════════════
  logSection('TEST 9 — Rapports / Statistiques');
  await navTo(page, 'Rapports');
  await page.waitForTimeout(1500);
  await screenshot(page, 'rapports', 'Page Rapports');

  const rapportsData = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasData: /CHF\s*[\d']+/.test(text),
      hasNaN: /\bNaN\b/.test(text),
      sampleText: text.substring(0, 500).replace(/\s+/g, ' '),
    };
  });
  log(`Rapports - données CHF présentes: ${rapportsData.hasData}`);
  log(`Rapports - NaN: ${rapportsData.hasNaN ? '[ALERTE]' : '[OK]'}`);

  // ══════════════════════════════════════════════════════════════════
  // RÉSUMÉ FINAL
  // ══════════════════════════════════════════════════════════════════
  logSection('RÉSUMÉ FINAL');
  if (consoleErrors.length > 0) {
    log(`Erreurs console (${consoleErrors.length}):`);
    consoleErrors.forEach(e => log(`  ${e}`));
  } else {
    log('[OK] Aucune erreur console JS');
  }

  const reportPath = '/home/user/gestion-chantier/playwright-diag/report2.txt';
  fs.writeFileSync(reportPath, REPORT.join('\n'));
  log(`\nRapport: ${reportPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('ERREUR:', err);
  process.exit(1);
});
