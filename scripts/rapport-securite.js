#!/usr/bin/env node
/**
 * CYNA — Rapport de sécurité complet
 * Consolide tous les audits et produit un score de sécurité sur 100.
 * Usage : node scripts/rapport-securite.js
 */

'use strict';

const fs            = require('fs');
const path          = require('path');
const { execFile,
        execFileSync } = require('child_process');

const ROOT     = path.join(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs');

// ── Couleurs console ──────────────────────────────────────────
const C = {
  rouge:  '\x1b[31m',
  jaune:  '\x1b[33m',
  vert:   '\x1b[32m',
  cyan:   '\x1b[36m',
  gris:   '\x1b[2m',
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
};
const fmt    = (c, s) => `${c}${s}${C.reset}`;
const strip  = (s)   => s.replace(/\x1b\[[0-9;]*m/g, '');

// ── Assurer que le dossier logs/ existe ───────────────────────
function assurerLogs() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// ── Exécuter un script et retourner { code, stdout, stderr } ──
function lancerScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    execFile(process.execPath, [scriptPath, ...args], { cwd: ROOT, timeout: 60_000 }, (err, stdout, stderr) => {
      resolve({
        code:   err ? (err.code ?? 1) : 0,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
}

// ── npm audit --json ──────────────────────────────────────────
function lancerNpmAudit() {
  return new Promise((resolve) => {
    execFile('npm', ['audit', '--json'], { cwd: ROOT, timeout: 120_000 }, (err, stdout, stderr) => {
      let resultat = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0, erreur: null };
      try {
        const json = JSON.parse(stdout || '{}');
        // npm v7+ : json.metadata.vulnerabilities
        const vuln = json?.metadata?.vulnerabilities || json?.vulnerabilities || {};
        resultat.critical = vuln.critical || 0;
        resultat.high     = vuln.high     || 0;
        resultat.moderate = vuln.moderate || 0;
        resultat.low      = vuln.low      || 0;
        resultat.info     = vuln.info     || 0;
        resultat.total    = (resultat.critical + resultat.high + resultat.moderate + resultat.low + resultat.info);
      } catch (e) {
        resultat.erreur = `Parse JSON npm audit échoué : ${e.message}`;
      }
      resolve(resultat);
    });
  });
}

// ── Vérifier .env.local ───────────────────────────────────────
function verifierEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    return { existe: false, serviceRoleKey: false, gitignore: false };
  }
  const contenu  = fs.readFileSync(envPath, 'utf8');
  const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
    ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';

  return {
    existe:         true,
    serviceRoleKey: /SERVICE_ROLE_KEY/.test(contenu),
    gitignore:      /\.env\.local/.test(gitignore),
  };
}

// ── Vérifier que le hook pre-commit est en place ──────────────
function verifierHooks() {
  const hookPath = path.join(ROOT, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(hookPath)) return { existe: false, executable: false, contenuOk: false };

  const stat     = fs.statSync(hookPath);
  const exec     = !!(stat.mode & 0o111);
  const contenu  = fs.readFileSync(hookPath, 'utf8');
  const contenuOk = /security-deep-scan/.test(contenu) && /audit-btp/.test(contenu);

  return { existe: true, executable: exec, contenuOk };
}

// ── Calculer le score sur 100 ─────────────────────────────────
function calculerScore(params) {
  const {
    secCritiques, secImportants,
    btpCritiques, btpWarnings,
    npm,
    envLocal,
    hook,
  } = params;

  let score = 100;

  // Sécurité code (max -40)
  score -= Math.min(40, secCritiques * 10 + secImportants * 3);

  // BTP (max -20)
  score -= Math.min(20, btpCritiques * 5 + btpWarnings * 1);

  // npm audit (max -25)
  score -= Math.min(25, (npm.critical * 10) + (npm.high * 5) + (npm.moderate * 2) + (npm.low * 0.5));

  // .env.local avec SERVICE_ROLE_KEY non protégée (-20)
  if (envLocal.serviceRoleKey && !envLocal.gitignore) score -= 20;

  // Hook pre-commit absent (-5)
  if (!hook.existe || !hook.contenuOk) score -= 5;

  return Math.max(0, Math.round(score));
}

// ── Formatter une ligne de rapport texte ─────────────────────
function section(titre) {
  return `\n${'═'.repeat(56)}\n  ${titre}\n${'═'.repeat(56)}\n`;
}

// ── Programme principal ───────────────────────────────────────
async function main() {
  assurerLogs();

  const dateStr = new Date().toISOString().slice(0, 10);
  const dateFmt = new Date().toLocaleString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  console.log('');
  console.log(fmt(C.cyan + C.bold, '╔══════════════════════════════════════════════════════╗'));
  console.log(fmt(C.cyan + C.bold, '║       CYNA SÀRL — Rapport de Sécurité Complet       ║'));
  console.log(fmt(C.cyan + C.bold, `║  ${dateFmt}                          ║`));
  console.log(fmt(C.cyan + C.bold, '╚══════════════════════════════════════════════════════╝'));
  console.log('');

  const lignesRapport = [];
  lignesRapport.push(`CYNA SÀRL — Rapport de Sécurité Complet`);
  lignesRapport.push(`Date : ${dateFmt}`);

  // ── 1. Security Deep Scan ────────────────────────────────────
  console.log(fmt(C.bold, '1/4 — Security Deep Scan...'));
  lignesRapport.push(section('1. Security Deep Scan'));

  let secJson = { critiques: 0, importants: 0, infos: 0, corrections: 0 };
  try {
    const sec = await lancerScript(path.join(__dirname, 'security-deep-scan.js'), ['--json']);
    try {
      secJson = JSON.parse(sec.stdout.trim().split('\n').pop() || '{}');
    } catch (_) { /* garder les zéros */ }

    const ok = sec.code === 0;
    console.log(ok
      ? fmt(C.vert,  `   ✅ Critiques: ${secJson.critiques} | Importants: ${secJson.importants} | Infos: ${secJson.infos}`)
      : fmt(C.rouge, `   ❌ Critiques: ${secJson.critiques} | Importants: ${secJson.importants} | Infos: ${secJson.infos}`));

    if (secJson.details) {
      for (const entry of (secJson.details?.critique || [])) {
        lignesRapport.push(`  [CRITIQUE] ${entry.fichier}:${entry.ligne} — ${entry.message}`);
      }
      for (const entry of (secJson.details?.important || [])) {
        lignesRapport.push(`  [IMPORTANT] ${entry.fichier}:${entry.ligne} — ${entry.message}`);
      }
    }
  } catch (e) {
    console.log(fmt(C.rouge, `   ❌ Erreur : ${e.message}`));
    lignesRapport.push(`  ERREUR : ${e.message}`);
  }
  lignesRapport.push(`  Critiques: ${secJson.critiques} | Importants: ${secJson.importants} | Infos: ${secJson.infos}`);

  // ── 2. Audit BTP ─────────────────────────────────────────────
  console.log(fmt(C.bold, '2/4 — Audit BTP...'));
  lignesRapport.push(section('2. Audit BTP'));

  let btpCritiques = 0;
  let btpWarnings  = 0;
  try {
    const btp = await lancerScript(path.join(__dirname, 'audit-btp.js'));
    const sortie = strip(btp.stdout);

    // Compter les occurrences dans la sortie texte
    const mCrit = sortie.match(/PROBLÈMES CRITIQUES \((\d+)\)/);
    const mWarn = sortie.match(/AVERTISSEMENTS \((\d+)\)/);
    btpCritiques = mCrit ? parseInt(mCrit[1], 10) : 0;
    btpWarnings  = mWarn ? parseInt(mWarn[1], 10) : 0;

    const ok = btp.code === 0;
    console.log(ok
      ? fmt(C.vert,  `   ✅ Critiques: ${btpCritiques} | Avertissements: ${btpWarnings}`)
      : fmt(C.rouge, `   ❌ Critiques: ${btpCritiques} | Avertissements: ${btpWarnings}`));

    // Extraire les lignes de problème
    const lignesProblemes = sortie.split('\n').filter(l => /✗|⚠/.test(l));
    for (const l of lignesProblemes.slice(0, 30)) {
      lignesRapport.push(`  ${l.trim()}`);
    }
  } catch (e) {
    console.log(fmt(C.rouge, `   ❌ Erreur : ${e.message}`));
    lignesRapport.push(`  ERREUR : ${e.message}`);
  }
  lignesRapport.push(`  Critiques: ${btpCritiques} | Avertissements: ${btpWarnings}`);

  // ── 3. npm audit ─────────────────────────────────────────────
  console.log(fmt(C.bold, '3/4 — npm audit...'));
  lignesRapport.push(section('3. npm audit'));

  const npm = await lancerNpmAudit();
  if (npm.erreur) {
    console.log(fmt(C.jaune, `   ⚠️  ${npm.erreur}`));
    lignesRapport.push(`  AVERTISSEMENT : ${npm.erreur}`);
  } else if (npm.total === 0) {
    console.log(fmt(C.vert, '   ✅ Aucune vulnérabilité npm'));
    lignesRapport.push('  Aucune vulnérabilité npm');
  } else {
    const crit = npm.critical > 0;
    const haut = npm.high     > 0;
    const icone = crit ? '❌' : haut ? '⚠️ ' : 'ℹ️ ';
    const couleur = crit ? C.rouge : haut ? C.jaune : C.gris;
    console.log(fmt(couleur, `   ${icone} Critical: ${npm.critical} | High: ${npm.high} | Moderate: ${npm.moderate} | Low: ${npm.low}`));
    lignesRapport.push(`  Critical: ${npm.critical} | High: ${npm.high} | Moderate: ${npm.moderate} | Low: ${npm.low} | Info: ${npm.info}`);
    if (crit || haut) lignesRapport.push('  ACTION : lancer npm audit fix pour corriger les vulnérabilités');
  }

  // ── 4. Vérifications complémentaires ─────────────────────────
  console.log(fmt(C.bold, '4/4 — Vérifications complémentaires...'));
  lignesRapport.push(section('4. Vérifications complémentaires'));

  const envLocal = verifierEnvLocal();
  const hook     = verifierHooks();

  // .env.local
  if (!envLocal.existe) {
    console.log(fmt(C.gris,  '   ℹ️  .env.local absent'));
    lignesRapport.push('  .env.local : absent');
  } else if (envLocal.serviceRoleKey && !envLocal.gitignore) {
    console.log(fmt(C.rouge, '   ❌ SERVICE_ROLE_KEY dans .env.local NON protégé par .gitignore'));
    lignesRapport.push('  [CRITIQUE] SERVICE_ROLE_KEY dans .env.local NON protégé par .gitignore');
  } else if (envLocal.serviceRoleKey && envLocal.gitignore) {
    console.log(fmt(C.jaune, '   ⚠️  SERVICE_ROLE_KEY dans .env.local (protégé par .gitignore — supprimer recommandé)'));
    lignesRapport.push('  [WARNING] SERVICE_ROLE_KEY dans .env.local (protégé par .gitignore)');
  } else {
    console.log(fmt(C.vert,  '   ✅ .env.local OK (pas de SERVICE_ROLE_KEY)'));
    lignesRapport.push('  .env.local OK');
  }

  // Hook pre-commit
  if (!hook.existe) {
    console.log(fmt(C.rouge, '   ❌ Hook pre-commit absent'));
    lignesRapport.push('  [IMPORTANT] Hook pre-commit absent');
  } else if (!hook.executable) {
    console.log(fmt(C.jaune, '   ⚠️  Hook pre-commit non exécutable (chmod +x .git/hooks/pre-commit)'));
    lignesRapport.push('  [WARNING] Hook pre-commit non exécutable');
  } else if (!hook.contenuOk) {
    console.log(fmt(C.jaune, '   ⚠️  Hook pre-commit incomplet (scans non référencés)'));
    lignesRapport.push('  [WARNING] Hook pre-commit incomplet');
  } else {
    console.log(fmt(C.vert,  '   ✅ Hook pre-commit en place et complet'));
    lignesRapport.push('  Hook pre-commit OK');
  }

  // ── Score global ─────────────────────────────────────────────
  const score = calculerScore({
    secCritiques: secJson.critiques,
    secImportants: secJson.importants,
    btpCritiques,
    btpWarnings,
    npm,
    envLocal,
    hook,
  });

  const couleurScore = score >= 80 ? C.vert : score >= 60 ? C.jaune : C.rouge;
  const labelScore   = score >= 80 ? 'BON' : score >= 60 ? 'MOYEN' : 'CRITIQUE';

  console.log('');
  console.log(fmt(C.cyan, '══════════════════════════════════════════════════════'));
  console.log(fmt(C.bold + couleurScore, `  Score de sécurité : ${score}/100 — ${labelScore}`));
  console.log('');

  // Barème détaillé
  const barre = Math.round(score / 5);
  const barre_str = '█'.repeat(barre) + '░'.repeat(20 - barre);
  console.log(fmt(couleurScore, `  [${barre_str}] ${score}%`));
  console.log('');

  if (score < 60) {
    console.log(fmt(C.rouge, '  ACTION REQUISE — corriger les problèmes critiques immédiatement'));
  } else if (score < 80) {
    console.log(fmt(C.jaune, '  Améliorations recommandées avant déploiement'));
  } else {
    console.log(fmt(C.vert,  '  Application en bonne posture de sécurité'));
  }
  console.log(fmt(C.cyan, '══════════════════════════════════════════════════════'));
  console.log('');

  // ── Sauvegarder le rapport ────────────────────────────────────
  lignesRapport.push(section('Score global'));
  lignesRapport.push(`  Score de sécurité : ${score}/100 — ${labelScore}`);
  lignesRapport.push(`  Security critiques: ${secJson.critiques} | importants: ${secJson.importants}`);
  lignesRapport.push(`  BTP critiques: ${btpCritiques} | avertissements: ${btpWarnings}`);
  lignesRapport.push(`  npm critiques: ${npm.critical} | hautes: ${npm.high} | modérées: ${npm.moderate}`);
  lignesRapport.push(`  .env.local SERVICE_ROLE_KEY: ${envLocal.serviceRoleKey ? 'OUI' : 'non'}`);
  lignesRapport.push(`  Hook pre-commit: ${hook.existe && hook.contenuOk ? 'OK' : 'PROBLEME'}`);
  lignesRapport.push('');

  const fichierRapport = path.join(LOGS_DIR, `rapport-securite-${dateStr}.txt`);
  try {
    fs.writeFileSync(fichierRapport, lignesRapport.join('\n'), 'utf8');
    console.log(fmt(C.gris, `  Rapport sauvegardé : ${fichierRapport}`));
    console.log('');
  } catch (e) {
    console.log(fmt(C.rouge, `  Impossible de sauvegarder le rapport : ${e.message}`));
  }

  // Code de sortie selon le score
  process.exit(score >= 60 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\x1b[31mErreur fatale : ${e.message}\x1b[0m`);
  process.exit(1);
});
