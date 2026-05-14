#!/usr/bin/env node
/**
 * CYNA — Surveillance temps réel
 * Surveille src/ et relance les scans automatiquement à chaque modification.
 * Usage : node scripts/monitor-continu.js
 */

'use strict';

const fs            = require('fs');
const path          = require('path');
const { execFile }  = require('child_process');

const ROOT     = path.join(__dirname, '..');
const SRC      = path.join(ROOT, 'src');
const LOGS_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'security-monitor.log');

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
const fmt = (c, s) => `${c}${s}${C.reset}`;

// ── Assurer que le dossier logs/ existe ───────────────────────
function assurerLogs() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (e) {
    console.error(fmt(C.rouge, `Impossible de créer logs/ : ${e.message}`));
  }
}

// ── Logger dans le fichier de log ─────────────────────────────
function logger(message) {
  try {
    const horodatage = new Date().toISOString();
    const ligne      = `[${horodatage}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, ligne, 'utf8');
  } catch (_) { /* non bloquant */ }
}

// ── Timestamp lisible pour la console ─────────────────────────
function maintenant() {
  return new Date().toLocaleTimeString('fr-CH', { hour12: false });
}

// ── Header CYNA ──────────────────────────────────────────────
function afficherHeader() {
  const date = new Date().toLocaleString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  console.log('');
  console.log(fmt(C.cyan + C.bold, '╔══════════════════════════════════════════════╗'));
  console.log(fmt(C.cyan + C.bold, '║      CYNA SÀRL — Surveillance Sécurité      ║'));
  console.log(fmt(C.cyan + C.bold, `║  Démarré le ${date}  ║`));
  console.log(fmt(C.cyan + C.bold, '╚══════════════════════════════════════════════╝'));
  console.log('');
  console.log(fmt(C.vert, '  Surveillance active — modifie un fichier src/ pour déclencher un scan'));
  console.log(fmt(C.gris, `  Logs : ${LOG_FILE}`));
  console.log('');
}

// ── Exécuter un script Node et retourner { code, stdout, stderr } ──
function lancerScript(scriptPath) {
  return new Promise((resolve) => {
    execFile(process.execPath, [scriptPath], { cwd: ROOT }, (err, stdout, stderr) => {
      resolve({
        code:   err ? (err.code || 1) : 0,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
}

// ── Lancer le scan complet ────────────────────────────────────
let scanEnCours = false;

async function lancerScan(fichierModifie) {
  if (scanEnCours) return;
  scanEnCours = true;

  const ts = maintenant();
  console.log('');
  console.log(fmt(C.bold, `[${ts}] Fichier modifié : ${path.relative(ROOT, fichierModifie)}`));
  console.log(fmt(C.cyan,  '──────────────────────────────────────────────'));

  let secOk  = false;
  let btpOk  = false;
  let resumeSec = '';
  let resumeBtp = '';

  // ── Scan sécurité ───────────────────────────────────
  try {
    process.stdout.write(fmt(C.gris, '  Security Deep Scan...'));
    const sec = await lancerScript(path.join(__dirname, 'security-deep-scan.js'));
    secOk = (sec.code === 0);

    // Extraire le résumé (dernières lignes significatives)
    const lignes = sec.stdout.split('\n').filter(l => l.trim());
    const resume = lignes.slice(-5).join(' ').replace(/\x1b\[[0-9;]*m/g, '').trim();
    resumeSec = resume.slice(0, 120);

    process.stdout.write(secOk
      ? fmt(C.vert,  ' ✅\n')
      : fmt(C.rouge, ' ❌\n'));
  } catch (e) {
    process.stdout.write(fmt(C.rouge, ` ❌ erreur : ${e.message}\n`));
    resumeSec = `ERREUR : ${e.message}`;
  }

  // ── Audit BTP ───────────────────────────────────────
  try {
    process.stdout.write(fmt(C.gris, '  Audit BTP...        '));
    const btp = await lancerScript(path.join(__dirname, 'audit-btp.js'));
    btpOk = (btp.code === 0);

    const lignes = btp.stdout.split('\n').filter(l => l.trim());
    const resume = lignes.slice(-5).join(' ').replace(/\x1b\[[0-9;]*m/g, '').trim();
    resumeBtp = resume.slice(0, 120);

    process.stdout.write(btpOk
      ? fmt(C.vert,  ' ✅\n')
      : fmt(C.rouge, ' ❌\n'));
  } catch (e) {
    process.stdout.write(fmt(C.rouge, ` ❌ erreur : ${e.message}\n`));
    resumeBtp = `ERREUR : ${e.message}`;
  }

  // ── Résultat global ─────────────────────────────────
  const ok = secOk && btpOk;
  if (ok) {
    console.log(fmt(C.vert, '  ✅ Tous les scans sont au vert'));
  } else {
    if (!secOk) console.log(fmt(C.rouge, '  ❌ Problèmes de sécurité détectés — lance : npm run scan'));
    if (!btpOk) console.log(fmt(C.jaune, '  ⚠️  Problèmes BTP détectés — lance : node scripts/audit-btp.js'));
  }
  console.log(fmt(C.cyan, '──────────────────────────────────────────────'));
  console.log(fmt(C.vert, '  Surveillance active — en attente de modifications...'));

  // ── Log fichier ─────────────────────────────────────
  const statut = ok ? 'OK' : 'PROBLEMES';
  logger(`SCAN ${statut} | fichier=${path.relative(ROOT, fichierModifie)} | sec=${secOk ? 'ok' : 'ko'} | btp=${btpOk ? 'ok' : 'ko'} | resumeSec="${resumeSec}" | resumeBtp="${resumeBtp}"`);

  scanEnCours = false;
}

// ── Debouncer ─────────────────────────────────────────────────
let debounceTimer  = null;
let dernierFichier = '';

function debounceScan(fichier) {
  dernierFichier = fichier;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    lancerScan(dernierFichier).catch((e) => {
      console.error(fmt(C.rouge, `Erreur scan : ${e.message}`));
      logger(`ERREUR SCAN : ${e.message}`);
    });
  }, 1500);
}

// ── Surveiller src/ récursivement ─────────────────────────────
const watchers = [];

function surveillerDossier(dir) {
  try {
    const watcher = fs.watch(dir, { recursive: false }, (evenement, nomFichier) => {
      if (!nomFichier) return;
      if (!nomFichier.endsWith('.js')) return;

      const chemin = path.join(dir, nomFichier);
      debounceScan(chemin);
    });
    watchers.push(watcher);

    // Surveiller aussi les sous-dossiers (fs.watch non récursif sur Linux)
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !['node_modules', '.git', 'build', 'coverage'].includes(entry.name)) {
          surveillerDossier(path.join(dir, entry.name));
        }
      }
    } catch (_) { /* dossier non lisible */ }
  } catch (e) {
    console.error(fmt(C.rouge, `Impossible de surveiller ${dir} : ${e.message}`));
  }
}

// ── Arrêt propre ─────────────────────────────────────────────
function arreter(signal) {
  console.log('');
  console.log(fmt(C.jaune, `\n  Arrêt de la surveillance (${signal})`));
  logger(`ARRET surveillance (${signal})`);
  for (const w of watchers) {
    try { w.close(); } catch (_) {}
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  process.exit(0);
}

process.on('SIGINT',  () => arreter('SIGINT'));
process.on('SIGTERM', () => arreter('SIGTERM'));

// ── Démarrage ─────────────────────────────────────────────────
assurerLogs();
afficherHeader();
logger(`DEMARRAGE surveillance src/ — PID ${process.pid}`);
surveillerDossier(SRC);

// Maintenir le processus en vie
setInterval(() => { /* heartbeat toutes les 60s */ }, 60_000);
