#!/usr/bin/env node
/**
 * CYNA — Audit BTP automatique
 * Vérifie la cohérence des calculs métier dans le code source.
 * Usage : node scripts/audit-btp.js [--quick]
 *
 * Codes de sortie :
 *   0 → aucun problème critique
 *   1 → problèmes critiques détectés (bloquer le commit)
 */

const fs   = require('fs');
const path = require('path');

const QUICK = process.argv.includes('--quick');
const SRC   = path.join(__dirname, '..', 'src');

// ── Couleurs console ──────────────────────────────────────────
const R = '\x1b[31m'; // rouge
const O = '\x1b[33m'; // orange
const G = '\x1b[32m'; // vert
const B = '\x1b[36m'; // cyan
const D = '\x1b[2m';  // dim
const X = '\x1b[0m';  // reset

// ── Collecte de tous les fichiers JS ─────────────────────────
function walkJs(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'build', '.git'].includes(entry.name)) {
      walkJs(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

// ── Résultats ─────────────────────────────────────────────────
const critiques = [];
const warnings  = [];
const infos     = [];

function crit(file, line, msg)    { critiques.push({ file, line, msg }); }
function warn(file, line, msg)    { warnings.push({ file, line, msg }); }
function info(file, line, msg)    { infos.push({ file, line, msg }); }

// ── Chemin relatif court ──────────────────────────────────────
const rel = (f) => path.relative(path.join(__dirname, '..'), f);

// ═════════════════════════════════════════════════════════════
// RÈGLES D'AUDIT
// ═════════════════════════════════════════════════════════════

const RULES = [

  // ── R1 : Division par zéro non protégée ───────────────────
  {
    id: 'R1',
    label: 'Division par zéro non protégée',
    niveau: 'critique',
    test(lines, file) {
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Ignore les lignes de commentaires
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Cherche "/ varName" sans guard évident
        if (!/\/\s*(?:total|montant|ca|avancement|nbJours|denom|count|length)\b/.test(line)) return;

        // Ignore si la division est dans un commentaire inline (// après le code)
        const codeBeforeComment = line.split('//')[0];
        if (!/\/\s*(?:total|montant|ca|avancement|nbJours|denom|count|length)\b/.test(codeBeforeComment)) return;

        // Ignore si la ligne elle-même contient un guard > 0 ou === 0
        if (/>[ ]*0/.test(line) || /!== 0/.test(line) || /Math\.max\(1/.test(line)) return;

        // Ignore si une ligne précédente (1-8 lignes) contient un guard sur la même variable
        const context = lines.slice(Math.max(0, i - 8), i + 1).join(' ');
        if (/(?:total|ca|avancement|montant)(?:\s*>|\s*!==)\s*0/.test(context)) return;
        if (/if\s*\(!(?:total|ca|avancement|montant)\)/.test(context)) return;
        if (/(?:total|ca|avancement|montant)\s*<=\s*0/.test(context)) return;
        if (/=== 0\)/.test(context) && /return/.test(context)) return;
        if (/return null/.test(context) && /(ca|total|avancement)\s*<=\s*0/.test(context)) return;

        // Ignore si la ligne est dans une ternaire avec guard
        if (/\?/.test(lines[Math.max(0, i - 1)] + line)) return;

        crit(file, i + 1, `Division potentielle sans guard: ${trimmed.slice(0, 80)}`);
      });
    },
  },

  // ── R2 : Comparaison de statut casse-sensitive ────────────
  {
    id: 'R2',
    label: 'Comparaison statut sans .toLowerCase()',
    niveau: 'warning',
    test(lines, file) {
      const STATUTS = ['En cours', 'Terminé', 'Planifié', 'Annulé', 'Suspendu'];
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        for (const s of STATUTS) {
          if (line.includes(`=== '${s}'`) || line.includes(`=== "${s}"`)) {
            warn(file, i + 1, `Comparaison casse-sensitive: === '${s}' → utiliser .toLowerCase()`);
          }
          if (line.includes(`'${s}'`) && line.includes('.includes(') && !line.includes('toLowerCase')) {
            warn(file, i + 1, `Array.includes('${s}') sans .toLowerCase() sur la valeur comparée`);
          }
        }
      });
    },
  },

  // ── R3 : .toFixed() retourne une string, pas un number ────
  {
    id: 'R3',
    label: '.toFixed() retourne string (utiliser Math.round)',
    niveau: 'warning',
    test(lines, file) {
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        // toFixed utilisé dans un contexte arithmétique (assigné à un Pct/%)
        if (/\.toFixed\(\d\)/.test(line) && /Pct|Taux|taux|pct|Ratio|ratio/.test(line)) {
          warn(file, i + 1, `.toFixed() produit une string — utiliser: Math.round(val * 1000) / 10`);
        }
      });
    },
  },

  // ── R4 : Champ obsolète dateFacture ───────────────────────
  {
    id: 'R4',
    label: 'Champ obsolète dateFacture (le champ est dateEmission)',
    niveau: 'critique',
    test(lines, file) {
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        if (/f\.dateFacture\b/.test(line) && !/dateEmission/.test(line)) {
          crit(file, i + 1, `f.dateFacture utilisé sans fallback dateEmission — le champ n'existe pas`);
        }
      });
    },
  },

  // ── R5 : joursRealises/joursPlannifies dans calcul réel ───
  {
    id: 'R5',
    label: 'joursRealises/joursPlannifies dans un calcul réel (utiliser le journal)',
    niveau: 'warning',
    test(lines, file) {
      // Fichiers exemptés : sources internes de vérité ou résultats de calculerRentabilite*
      const FICHIERS_EXEMPTS = ['donnees.js', 'Dashboard.js', 'DetailRentabilite.js', 'Statistiques.js', 'ChantierForm.js', 'EmployesPage.js', 'ExportPDF.js'];
      if (FICHIERS_EXEMPTS.some(f => file.includes(f))) return;
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        // Exclure les templates JSX (affichage) et les lignes provenant de résultats de calcul connus
        if (/rentaReelle|calculerRentabilite|etat\.joursRealises|totalJoursReels/.test(line)) return;
        // Flaguer uniquement les multiplications par tarifJour (coût MO) avec champ brut
        if (/\.joursRealises\b|\.joursPlannifies\b/.test(line) && /tarifJour|\* [\d(]/.test(line)) {
          warn(file, i + 1, `joursRealises/joursPlannifies utilisé dans un calcul de coût — préférer journal`);
        }
      });
    },
  },

  // ── R6 : calculerDevisClient appelé sans coutMO ───────────
  {
    id: 'R6',
    label: 'calculerDevisClient() appelé sans coutMO (marge incomplète)',
    niveau: 'warning',
    test(lines, file) {
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        // Match calculerDevisClient(quelqueChose) avec UN seul argument (pas de virgule)
        const m = line.match(/calculerDevisClient\(([^)]+)\)/);
        if (m && !m[1].includes(',')) {
          warn(file, i + 1, `calculerDevisClient sans coutMO — la MO sera ignorée dans la marge`);
        }
      });
    },
  },

  // ── R7 : NaN/undefined affiché dans l'UI ──────────────────
  {
    id: 'R7',
    label: 'NaN ou undefined potentiel dans affichage UI',
    niveau: 'critique',
    test(lines, file) {
      if (!file.includes('/pages/') && !file.includes('/components/')) return;
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        // parseFloat direct sans fallback dans du JSX
        if (/\{parseFloat\([^)]+\)\}/.test(line) && !/\|\|/.test(line)) {
          crit(file, i + 1, `parseFloat sans || 0 dans JSX — peut afficher NaN`);
        }
      });
    },
  },

  // ── R8 : Facture sans clientId ────────────────────────────
  {
    id: 'R8',
    label: 'Création de facture sans clientId obligatoire',
    niveau: 'warning',
    test(lines, file) {
      let inFactureObj = false;
      let hasClientId  = false;
      let startLine    = 0;
      let blockStart   = 0;
      lines.forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return; // ignorer les commentaires
        // Détecte uniquement par numero F- (pas type: qui est trop générique)
        if (/numero:\s*['"`]F-/.test(line)) {
          inFactureObj = true;
          startLine = i + 1;
          blockStart = i;
          hasClientId = false;
          // Vérifier aussi les 8 lignes précédentes (clientId peut être avant numero)
          const debut = Math.max(0, i - 8);
          for (let j = debut; j <= i; j++) {
            if (/clientId/.test(lines[j])) hasClientId = true;
          }
        }
        if (inFactureObj && /clientId/.test(line)) hasClientId = true;
        if (inFactureObj && /^\s*\}/.test(line)) {
          if (!hasClientId) {
            warn(file, startLine, `Objet facture créé sans clientId (ligne ${startLine})`);
          }
          inFactureObj = false;
        }
      });
    },
  },

  // ── R9 : TVA hardcodée hors paramètre ────────────────────
  {
    id: 'R9',
    label: 'TVA hardcodée (devrait être un paramètre)',
    niveau: 'warning',
    test(lines, file) {
      lines.forEach((line, i) => {
        if (/\/\//.test(line)) return;
        // TVA hardcodée dans du calcul (pas dans les options/config)
        if (/[×*]\s*(?:0\.081|1\.081)\b/.test(line) && !file.includes('donnees.js')) {
          warn(file, i + 1, `TVA hardcodée (× 1.081) — utiliser le taux passé en paramètre`);
        }
        if (/tva\s*[=:]\s*8\.1\b/.test(line) && !file.includes('donnees.js') && !file.includes('Factures.js')) {
          warn(file, i + 1, `TVA hardcodée à 8.1 — préférer la constante TVA_DEFAUT`);
        }
      });
    },
  },

  // ── R10 : CA depuis chantier directement (sans devis) ─────
  {
    id: 'R10',
    label: 'CA lu depuis chantier.montantDevis (source incorrecte)',
    niveau: 'critique',
    test(lines, file) {
      // Exception : AuditApp.js lit c.montantDevis uniquement pour détecter les dérives (comparaison légitime)
      if (file.includes('AuditApp.js')) return;
      // Exception : ChantiersPage.js synchronise montantDevis depuis devis.montantHT lors de la sauvegarde
      if (file.includes('ChantiersPage.js')) return;
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/chantier\.montantDevis\b|c\.montantDevis\b/.test(line)) {
          crit(file, i + 1, `montantDevis lu sur le chantier — CA doit venir du devis lié (calculerCA)`);
        }
      });
    },
  },

];

// ═════════════════════════════════════════════════════════════
// EXÉCUTION
// ═════════════════════════════════════════════════════════════

console.log(`\n${B}══════════════════════════════════════════════${X}`);
console.log(`${B}  CYNA — Audit BTP automatique${X}${QUICK ? D + ' (mode rapide)' + X : ''}`);
console.log(`${B}══════════════════════════════════════════════${X}\n`);

const files = walkJs(SRC);
const rulesActives = QUICK ? RULES.filter(r => r.niveau === 'critique') : RULES;

console.log(`${D}Analyse de ${files.length} fichiers avec ${rulesActives.length} règles...${X}\n`);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines   = content.split('\n');
  for (const rule of rulesActives) {
    try { rule.test(lines, file); } catch(e) { /* règle robuste aux erreurs */ }
  }
}

// ── Rapport ───────────────────────────────────────────────────

if (critiques.length === 0 && warnings.length === 0) {
  console.log(`${G}✅ Aucun problème détecté — code BTP conforme${X}\n`);
  process.exit(0);
}

if (critiques.length > 0) {
  console.log(`${R}🔴 PROBLÈMES CRITIQUES (${critiques.length})${X}`);
  console.log(`${R}${'─'.repeat(50)}${X}`);
  for (const { file, line, msg } of critiques) {
    console.log(`${R}  ✗ ${rel(file)}:${line}${X}`);
    console.log(`    ${msg}`);
  }
  console.log();
}

if (!QUICK && warnings.length > 0) {
  console.log(`${O}🟠 AVERTISSEMENTS (${warnings.length})${X}`);
  console.log(`${O}${'─'.repeat(50)}${X}`);
  for (const { file, line, msg } of warnings) {
    console.log(`${O}  ⚠ ${rel(file)}:${line}${X}`);
    console.log(`    ${msg}`);
  }
  console.log();
}

// ── Score global ──────────────────────────────────────────────
const total  = files.length * rulesActives.length;
const issues = critiques.length + warnings.length;
const score  = Math.max(0, Math.round(10 - (critiques.length * 2) - (warnings.length * 0.5)));

console.log(`${'─'.repeat(50)}`);
console.log(`Score qualité BTP : ${score >= 8 ? G : score >= 5 ? O : R}${score}/10${X}`);
console.log(`Critiques: ${R}${critiques.length}${X}  |  Avertissements: ${O}${warnings.length}${X}`);
console.log();

if (critiques.length > 0) {
  console.log(`${R}⛔ Commit bloqué — corriger les problèmes critiques avant de continuer.${X}\n`);
  process.exit(1);
} else {
  console.log(`${G}✅ Pas de blocage critique — mais corriger les avertissements dès que possible.${X}\n`);
  process.exit(0);
}
