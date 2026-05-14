#!/usr/bin/env node
/**
 * CYNA Security Check — pré-commit et invocation manuelle
 * Vérifie XSS, secrets exposés, patterns dangereux
 * Usage : node scripts/security-check.js [--fix]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const FIX  = process.argv.includes('--fix');

const ROUGE  = '\x1b[31m';
const JAUNE  = '\x1b[33m';
const VERT   = '\x1b[32m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const GRIS   = '\x1b[2m';

let critiques = 0;
let avertissements = 0;
let corrections = 0;

const rapport = { critiques: [], avertissements: [], info: [] };

// ── Utilitaires ────────────────────────────────────────────────────────────

function lireJS(dir) {
  const fichiers = [];
  function parcourir(d) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory() && !['node_modules', '.git', 'build', 'coverage'].includes(entry.name)) {
        parcourir(path.join(d, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        fichiers.push(path.join(d, entry.name));
      }
    }
  }
  parcourir(dir);
  return fichiers;
}

function relatif(p) {
  return p.replace(ROOT + '/', '');
}

function signaler(niveau, fichier, ligne, message) {
  const rel = relatif(fichier);
  const loc = ligne ? `:${ligne}` : '';
  if (niveau === 'CRITIQUE') {
    critiques++;
    rapport.critiques.push({ fichier: rel, ligne, message });
    console.log(`  ${ROUGE}[CRITIQUE]${RESET} ${rel}${loc} — ${message}`);
  } else if (niveau === 'IMPORTANT') {
    avertissements++;
    rapport.avertissements.push({ fichier: rel, ligne, message });
    console.log(`  ${JAUNE}[IMPORTANT]${RESET} ${rel}${loc} — ${message}`);
  } else {
    rapport.info.push({ fichier: rel, ligne, message });
    console.log(`  ${GRIS}[INFO]${RESET} ${rel}${loc} — ${message}`);
  }
}

// ── Règles de sécurité ─────────────────────────────────────────────────────

const REGLES = [
  {
    id: 'S1',
    nom: 'XSS document.write non échappé',
    niveau: 'CRITIQUE',
    test: (lignes) => {
      const hits = [];
      lignes.forEach((l, i) => {
        if (/document\.write\(/.test(l) && !/escHtml\(/.test(l) && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `document.write() sans escHtml()` });
        }
      });
      return hits;
    },
  },
  {
    id: 'S2',
    nom: 'dangerouslySetInnerHTML',
    niveau: 'CRITIQUE',
    test: (lignes) => {
      const hits = [];
      lignes.forEach((l, i) => {
        if (/dangerouslySetInnerHTML/.test(l) && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `dangerouslySetInnerHTML détecté` });
        }
      });
      return hits;
    },
  },
  {
    id: 'S3',
    nom: 'Secrets hardcodés',
    niveau: 'CRITIQUE',
    test: (lignes, fichier) => {
      const hits = [];
      // Ne pas scanner les fichiers .env ou de config connus
      if (/\.(env|json)$/.test(fichier)) return hits;
      lignes.forEach((l, i) => {
        // Cherche des patterns de clés API hardcodées dans le code source
        if (/['"`](eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,})['"`]/.test(l)
          && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `Clé API potentiellement exposée dans le code` });
        }
      });
      return hits;
    },
  },
  {
    id: 'S4',
    nom: 'eval() usage',
    niveau: 'CRITIQUE',
    test: (lignes) => {
      const hits = [];
      lignes.forEach((l, i) => {
        if (/\beval\s*\(/.test(l) && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `eval() est interdit — risque d'injection` });
        }
      });
      return hits;
    },
  },
  {
    id: 'S5',
    nom: 'localStorage avec données sensibles',
    niveau: 'IMPORTANT',
    test: (lignes) => {
      const hits = [];
      lignes.forEach((l, i) => {
        // Cherche stockage de valeurs sensibles (pas de noms de clés contenant ces mots)
        if (/localStorage\.setItem\(['"`][^'"`]*['"`]\s*,\s*.*(?:password|motdepasse|\.token\b|secret\b)/i.test(l)
          && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `Données sensibles potentielles dans localStorage` });
        }
      });
      return hits;
    },
  },
  {
    id: 'S6',
    nom: 'console.log avec données potentiellement sensibles',
    niveau: 'INFO',
    test: (lignes) => {
      const hits = [];
      lignes.forEach((l, i) => {
        if (/console\.log.*(?:password|token|secret|motdepasse)/i.test(l)
          && !l.trim().startsWith('//')) {
          hits.push({ ligne: i + 1, message: `console.log potentiellement sensible` });
        }
      });
      return hits;
    },
  },
];

// ── Vérifications hors code source ────────────────────────────────────────

function verifierVercelJson() {
  const p = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(p)) {
    signaler('IMPORTANT', p, null, 'vercel.json absent — headers de sécurité non définis');
    return;
  }
  const config = JSON.parse(fs.readFileSync(p, 'utf8'));
  const headers = config.headers || [];
  const global = headers.find(h => h.source === '/(.*)')?.headers || [];
  const noms = global.map(h => h.key.toLowerCase());
  if (!noms.includes('content-security-policy')) {
    signaler('CRITIQUE', p, null, 'Content-Security-Policy manquant dans vercel.json');
  }
  if (!noms.includes('x-frame-options')) {
    signaler('IMPORTANT', p, null, 'X-Frame-Options manquant (protection clickjacking)');
  }
  if (!noms.includes('x-content-type-options')) {
    signaler('IMPORTANT', p, null, 'X-Content-Type-Options manquant');
  }
}

function verifierEnvLocal() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  const contenu = fs.readFileSync(p, 'utf8');
  // Vérifier que .env.local est bien dans .gitignore avant d'alerter
  const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
    ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
  const protege = /\.env\.local/.test(gitignore);
  if (/SERVICE_ROLE_KEY/.test(contenu)) {
    if (protege) {
      signaler('INFO', p, null, 'SERVICE_ROLE_KEY présent — protégé par .gitignore ✓ (supprimer recommandé)');
    } else {
      signaler('CRITIQUE', p, null, 'SUPABASE_SERVICE_ROLE_KEY présent ET .env.local non ignoré par git — fuite imminente');
    }
  }
}

function verifierGitignore() {
  const p = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(p)) return;
  const contenu = fs.readFileSync(p, 'utf8');
  if (!/\.env\.local/.test(contenu)) {
    signaler('CRITIQUE', p, null, '.env.local non ignoré par git — risque de fuite de secrets');
  }
}

// ── Exécution ──────────────────────────────────────────────────────────────

console.log(`\n${CYAN}══════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}  CYNA — Security Check${FIX ? ' (mode --fix)' : ''}${RESET}`);
console.log(`${CYAN}══════════════════════════════════════════════${RESET}\n`);

// 1. Vérifications globales
console.log(`${GRIS}Vérification configuration...${RESET}`);
verifierVercelJson();
verifierEnvLocal();
verifierGitignore();

// 2. Scan des fichiers JS
const fichiers = lireJS(SRC);
console.log(`${GRIS}Analyse de ${fichiers.length} fichiers JS...${RESET}`);

for (const fichier of fichiers) {
  const contenu = fs.readFileSync(fichier, 'utf8');
  const lignes = contenu.split('\n');
  for (const regle of REGLES) {
    const hits = regle.test(lignes, fichier);
    for (const hit of hits) {
      signaler(regle.niveau, fichier, hit.ligne, hit.message);
    }
  }
}

// 3. Rapport final
console.log('');
console.log(`${CYAN}══════════════════════════════════════════════${RESET}`);

if (critiques === 0 && avertissements === 0) {
  console.log(`${VERT}✅ Aucun problème de sécurité détecté${RESET}`);
} else {
  if (critiques > 0) console.log(`${ROUGE}🔴 ${critiques} critique(s)${RESET}`);
  if (avertissements > 0) console.log(`${JAUNE}⚠️  ${avertissements} important(s)${RESET}`);
  if (rapport.info.length > 0) console.log(`${GRIS}ℹ️  ${rapport.info.length} info(s)${RESET}`);
}

if (corrections > 0) console.log(`${VERT}🔧 ${corrections} correction(s) appliquée(s)${RESET}`);

console.log(`${CYAN}══════════════════════════════════════════════${RESET}\n`);

// Exit code non-zéro si critiques trouvés (bloque le commit)
if (critiques > 0) {
  process.exit(1);
}
process.exit(0);
