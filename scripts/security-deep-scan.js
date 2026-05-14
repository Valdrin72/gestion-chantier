#!/usr/bin/env node
/**
 * CYNA Deep Security Scan — audit complet multi-couches
 * Couvre : XSS, injection, auth, données, performance, intégrité
 * Usage : node scripts/security-deep-scan.js [--fix] [--json]
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const SRC    = path.join(ROOT, 'src');
const FIX    = process.argv.includes('--fix');
const JSON_OUT = process.argv.includes('--json');

const C = {
  rouge: '\x1b[31m', jaune: '\x1b[33m', vert: '\x1b[32m',
  cyan: '\x1b[36m', gris: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m',
};
const fmt = (c, s) => JSON_OUT ? s : `${c}${s}${C.reset}`;

const problemes = { critique: [], important: [], info: [] };
let corrections = 0;

function signaler(niveau, fichier, ligne, message, fix = null) {
  const rel = fichier.replace(ROOT + '/', '');
  const entry = { fichier: rel, ligne, message };
  if (niveau === 'CRITIQUE')  { problemes.critique.push(entry);  !JSON_OUT && console.log(`  ${fmt(C.rouge,'[CRITIQUE]')} ${rel}${ligne ? ':'+ligne : ''} — ${message}`); }
  if (niveau === 'IMPORTANT') { problemes.important.push(entry); !JSON_OUT && console.log(`  ${fmt(C.jaune,'[IMPORTANT]')} ${rel}${ligne ? ':'+ligne : ''} — ${message}`); }
  if (niveau === 'INFO')      { problemes.info.push(entry);      !JSON_OUT && console.log(`  ${fmt(C.gris,'[INFO]')} ${rel}${ligne ? ':'+ligne : ''} — ${message}`); }

  if (FIX && fix && niveau !== 'INFO') {
    try {
      const contenu = fs.readFileSync(fichier, 'utf8');
      const nouveau = fix(contenu);
      if (nouveau !== contenu) {
        fs.writeFileSync(fichier, nouveau);
        corrections++;
        !JSON_OUT && console.log(`    ${fmt(C.vert, '→ corrigé automatiquement')}`);
      }
    } catch {}
  }
}

function lireJS(dir) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'build', 'coverage', '.claude']);
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && !skip.has(e.name)) walk(path.join(d, e.name));
      else if (e.isFile() && /\.js$/.test(e.name) && !e.name.endsWith('.test.js')) out.push(path.join(d, e.name));
    }
  }
  walk(dir);
  return out;
}

// ══════════════════════════════════════════════
// COUCHE 1 — SÉCURITÉ CODE (XSS, injection)
// ══════════════════════════════════════════════

function scannerXSS(fichiers) {
  for (const f of fichiers) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (l.trim().startsWith('//')) return;
      const n = i + 1;
      if (/document\.write\(/.test(l) && !/escHtml\(/.test(l))
        signaler('CRITIQUE', f, n, 'document.write() sans escHtml()');
      if (/innerHTML\s*=/.test(l) && !/escHtml\(/.test(l) && !/''|""/.test(l))
        signaler('CRITIQUE', f, n, 'innerHTML sans escHtml() — risque XSS');
      if (/dangerouslySetInnerHTML/.test(l))
        signaler('IMPORTANT', f, n, 'dangerouslySetInnerHTML — vérifier que le contenu est statique');
      if (/\beval\s*\(/.test(l))
        signaler('CRITIQUE', f, n, 'eval() interdit');
      if (/new Function\s*\(/.test(l))
        signaler('CRITIQUE', f, n, 'new Function() — équivalent eval()');
    });
  }
}

// ══════════════════════════════════════════════
// COUCHE 2 — SECRETS ET DONNÉES SENSIBLES
// ══════════════════════════════════════════════

function scannerSecrets(fichiers) {
  // Vérifier .env.local
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
      ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
    if (/SERVICE_ROLE_KEY/.test(env)) {
      if (/\.env\.local/.test(gitignore)) signaler('INFO', envPath, null, 'SERVICE_ROLE_KEY présent (protégé par .gitignore — supprimer recommandé)');
      else signaler('CRITIQUE', envPath, null, 'SERVICE_ROLE_KEY présent ET .env.local non ignoré → fuite imminente');
    }
  }

  for (const f of fichiers) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (l.trim().startsWith('//')) return;
      const n = i + 1;
      if (/['"`](eyJ[A-Za-z0-9_\-]{30,})['"`]/.test(l) && !/SUPABASE_URL|process\.env/.test(l))
        signaler('CRITIQUE', f, n, 'JWT/token potentiellement hardcodé dans le code');
      if (/SERVICE_ROLE_KEY/.test(l) && !/\.env/.test(f))
        signaler('CRITIQUE', f, n, 'Référence SERVICE_ROLE_KEY dans le code source');
      if (/localStorage\.setItem\(['"`][^'"]+['"`]\s*,.*(?:password|motdepasse)/i.test(l))
        signaler('IMPORTANT', f, n, 'Mot de passe potentiel dans localStorage');
    });
  }
}

// ══════════════════════════════════════════════
// COUCHE 3 — AUTHENTIFICATION ET RÔLES
// ══════════════════════════════════════════════

function scannerAuth(fichiers) {
  for (const f of fichiers) {
    const contenu = fs.readFileSync(f, 'utf8');
    const lignes = contenu.split('\n');
    // Comparaisons de rôle sans toLowerCase
    lignes.forEach((l, i) => {
      if (l.trim().startsWith('//')) return;
      if (/profil\.role\s*===\s*['"](?!direction|admin|chef|comptable|ouvrier)[^'"]{3,}/.test(l))
        return; // comparaison de rôle valide
      if (/profil\.role\s*===\s*['"]/.test(l) && !/\.toLowerCase\(\)/.test(l))
        signaler('IMPORTANT', f, i+1, 'Comparaison profil.role sans .toLowerCase() — risque de casse');
    });
  }

  // Vérifier vercel.json
  const vJson = path.join(ROOT, 'vercel.json');
  if (fs.existsSync(vJson)) {
    const cfg = JSON.parse(fs.readFileSync(vJson, 'utf8'));
    const hdrs = (cfg.headers || []).find(h => h.source === '/(.*)')?.headers || [];
    const noms = hdrs.map(h => h.key.toLowerCase());
    if (!noms.includes('content-security-policy'))
      signaler('CRITIQUE', vJson, null, 'Content-Security-Policy manquant');
    if (!noms.includes('x-frame-options'))
      signaler('IMPORTANT', vJson, null, 'X-Frame-Options manquant (clickjacking)');
    if (!noms.includes('strict-transport-security'))
      signaler('IMPORTANT', vJson, null, 'HSTS manquant (Strict-Transport-Security)');
    if (!noms.includes('x-content-type-options'))
      signaler('IMPORTANT', vJson, null, 'X-Content-Type-Options manquant');
    if (!noms.includes('referrer-policy'))
      signaler('INFO', vJson, null, 'Referrer-Policy absent (recommandé)');
  }
}

// ══════════════════════════════════════════════
// COUCHE 4 — INTÉGRITÉ DES DONNÉES BTP
// ══════════════════════════════════════════════

function scannerIntegriteDonnees(fichiers) {
  for (const f of fichiers) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (l.trim().startsWith('//')) return;
      const n = i + 1;
      // Division par zéro non protégée
      if (/\/\s*[a-zA-Z]\w*(?:\.\w+)*\s*[^=!<>]/.test(l) &&
          !/>\s*0|Math\.max|isFinite|isNaN|\|\|\s*[0-9]|&&\s*[a-zA-Z]/.test(l) &&
          /\/ \w/.test(l) && !/\/\/|\/\*|`.*\/.*`/.test(l))
        ; // Trop de faux positifs — laissé à audit-btp.js
      // .toFixed() sur variable de pourcentage
      if (/(?:pct|marge|taux|ratio|ecart)\w*\.toFixed\(/.test(l) && !l.trim().startsWith('//'))
        signaler('IMPORTANT', f, n, '.toFixed() sur variable de pourcentage — utiliser Math.round(v*10)/10');
      // champ obsolète dateFacture
      if (/\bdateFacture\b/.test(l) && !/\/\//.test(l))
        signaler('IMPORTANT', f, n, 'Champ obsolète dateFacture — utiliser dateEmission');
      // joursRealises des membres d'équipe dans calcul réel (pas dans les fichiers où c'est déjà journal-sourcé)
      const safeJoursRealises = ['donnees.js', 'ChantiersPage.js', 'ExportPDF.js'];
      if (/c\.equipe.*m\.joursRealises\b/.test(l) && !/\/\//.test(l) && !safeJoursRealises.some(s => f.includes(s)))
        signaler('IMPORTANT', f, n, 'joursRealises des membres interdit dans calcul réel — source : journal');
    });
  }
}

// ══════════════════════════════════════════════
// COUCHE 5 — PERFORMANCE ET ROBUSTESSE
// ══════════════════════════════════════════════

function scannerPerformance(fichiers) {
  for (const f of fichiers) {
    if (!f.includes('/pages/') && !f.includes('/components/')) continue;
    const contenu = fs.readFileSync(f, 'utf8');
    // calculerCoutsChantier hors useMemo
    if (/calculerCoutsChantier/.test(contenu)) {
      const lignes = contenu.split('\n');
      let dansMemo = false;
      lignes.forEach((l, i) => {
        if (/useMemo|useCallback/.test(l)) dansMemo = true;
        if (/\}\s*,\s*\[/.test(l)) dansMemo = false;
        if (/calculerCoutsChantier/.test(l) && !dansMemo && !l.trim().startsWith('//'))
          ; // Vérification trop complexe sans AST — laissé au code-reviewer
      });
    }
    // JSON.parse dans render
    const lignesRendu = contenu.split('\n');
    lignesRendu.forEach((l, i) => {
      if (/JSON\.parse\(/.test(l) && !/useEffect|useMemo|useCallback|useState/.test(l) && !l.trim().startsWith('//'))
        signaler('INFO', f, i+1, 'JSON.parse() potentiellement dans le render — déplacer dans useMemo');
    });
  }
}

// ══════════════════════════════════════════════
// EXÉCUTION
// ══════════════════════════════════════════════

if (!JSON_OUT) {
  console.log(`\n${fmt(C.cyan+C.bold, '══════════════════════════════════════════════')}`);
  console.log(`${fmt(C.cyan+C.bold, `  CYNA Deep Security Scan${FIX ? ' — mode --fix' : ''}`)}`);
  console.log(`${fmt(C.cyan+C.bold, '══════════════════════════════════════════════')}\n`);
}

const fichiers = lireJS(SRC);
!JSON_OUT && console.log(fmt(C.gris, `Analyse de ${fichiers.length} fichiers sur 5 couches...\n`));

!JSON_OUT && console.log(fmt(C.bold, 'Couche 1 — XSS & Injection'));
scannerXSS(fichiers);
!JSON_OUT && console.log(fmt(C.bold, '\nCouche 2 — Secrets & Données sensibles'));
scannerSecrets(fichiers);
!JSON_OUT && console.log(fmt(C.bold, '\nCouche 3 — Authentification & Rôles'));
scannerAuth(fichiers);
!JSON_OUT && console.log(fmt(C.bold, '\nCouche 4 — Intégrité données BTP'));
scannerIntegriteDonnees(fichiers);
!JSON_OUT && console.log(fmt(C.bold, '\nCouche 5 — Performance & Robustesse'));
scannerPerformance(fichiers);

const nbC = problemes.critique.length;
const nbI = problemes.important.length;
const nbN = problemes.info.length;

if (JSON_OUT) {
  console.log(JSON.stringify({ critiques: nbC, importants: nbI, infos: nbN, corrections, details: problemes }));
  process.exit(nbC > 0 ? 1 : 0);
}

console.log(`\n${fmt(C.cyan, '══════════════════════════════════════════════')}`);
if (nbC === 0 && nbI === 0) {
  console.log(fmt(C.vert, '✅ Aucun problème de sécurité détecté'));
} else {
  if (nbC > 0) console.log(fmt(C.rouge, `🔴 ${nbC} critique(s)`));
  if (nbI > 0) console.log(fmt(C.jaune, `⚠️  ${nbI} important(s)`));
  if (nbN > 0) console.log(fmt(C.gris,  `ℹ️  ${nbN} info(s)`));
}
if (corrections > 0) console.log(fmt(C.vert, `🔧 ${corrections} correction(s) appliquée(s)`));
console.log(`${fmt(C.cyan, '══════════════════════════════════════════════')}\n`);

process.exit(nbC > 0 ? 1 : 0);
