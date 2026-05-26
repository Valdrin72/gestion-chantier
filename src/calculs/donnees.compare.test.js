/**
 * Test d'observation : comparaison des deux moteurs de calcul chantier.
 *
 * calculerCoutsChantier (L221) — ancien moteur, 12 importateurs
 * calculerEtatChantier  (L883) — nouveau moteur "source unique de vérité", 3 importateurs directs
 *
 * Ce fichier ne valide PAS des assertions strictes.
 * Il AFFICHE les écarts entre les deux moteurs pour chaque chantier de démo.
 *
 * Lancer : npm run test:unit -- donnees.compare.test.js
 */

import { describe, it } from 'vitest';
import {
  calculerCoutsChantier,
  calculerEtatChantier,
  donneesInitiales,
} from '../donnees.js';

// ── Helpers d'affichage ──────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' && isNaN(v)) return 'NaN ⚠️';
  if (typeof v === 'number') return v.toLocaleString('fr-CH', { maximumFractionDigits: 2 });
  return String(v);
}

function pctDelta(a, b) {
  if (a === null && b === null) return { delta: 0, pct: 0, equiv: true };
  if (a === null || b === null) return { delta: null, pct: null, equiv: false };
  if (typeof a !== 'number' || typeof b !== 'number') return { delta: null, pct: null, equiv: false };
  if (isNaN(a) || isNaN(b)) return { delta: null, pct: null, equiv: false };
  const delta = Math.abs(a - b);
  const ref = Math.abs(a) > 0 ? Math.abs(a) : (Math.abs(b) > 0 ? Math.abs(b) : 1);
  const pct = (delta / ref) * 100;
  return { delta, pct, equiv: pct < 0.5 };
}

function badge(equiv) {
  return equiv ? '✅' : '❌ DIVERGE';
}

// ── Mapping des champs comparables entre les deux moteurs ───────────────────
//
// Les champs ne sont pas nommés pareil. Ce tableau documente la correspondance.
//
// Note sur les différences structurelles connues avant de lancer :
//   1. coutDeplacement : calculerCoutsChantier l'inclut dans totalCoutsReel,
//      calculerEtatChantier ne le calcule pas (pas de paramètre localites).
//   2. Avancement : ancien = journal OU fallback chantier.avancement,
//      nouveau = journal uniquement (pas de fallback manuel).
//   3. EAC seuil : ancien = avancement > 0 && !donneesIncompletes,
//      nouveau = avancementPct >= 20.
//   4. margeReelPct (ancien) = marge actuelle ;
//      margeEstimeePct (nouveau) = marge projetée à terminaison.

const CHAMPS_COMPARABLES = [
  {
    label: 'CA (CHF)',
    ancienKey: r => r.ancien.montantTotal,
    nouveauKey: r => r.nouveau.devisTotal,
  },
  {
    label: 'Coût total réel (CHF)',
    ancienKey: r => r.ancien.totalCoutsReel,
    nouveauKey: r => r.nouveau.coutTotalReel,
    note: 'Ancien inclut coutDeplacementReel, nouveau non',
  },
  {
    label: 'Coût MO réel (CHF)',
    ancienKey: r => r.ancien.coutEquipeReel,
    nouveauKey: r => r.nouveau.coutMOReel,
  },
  {
    label: 'Coût matériel réel (CHF)',
    ancienKey: r => r.ancien.coutMaterielReel,
    nouveauKey: r => r.nouveau.coutMateriel,
  },
  {
    label: 'Coût sous-traitance réel (CHF)',
    ancienKey: r => r.ancien.coutSousTraitanceReel,
    nouveauKey: r => r.nouveau.coutSousTraitance,
  },
  {
    label: 'Coût imprévus (CHF)',
    ancienKey: r => r.ancien.coutImprevus,
    nouveauKey: r => r.nouveau.coutImprevus,
  },
  {
    label: 'Avancement (%)',
    ancienKey: r => r.ancienAvancement,
    nouveauKey: r => r.nouveau.avancementPct,
    note: 'Ancien: fallback sur chantier.avancement si journal vide; nouveau: pas de fallback',
  },
  {
    label: 'EAC / coutFinalEstime (CHF)',
    ancienKey: r => r.ancien.coutFinalEstime,
    nouveauKey: r => r.nouveau.coutFinalEstime,
    note: 'Seuil différent: ancien=avancement>0 && !donneesIncompletes, nouveau=avancement>=20',
  },
  {
    label: 'RAD (CHF)',
    ancienKey: r => r.ancien.rad,
    nouveauKey: r => r.nouveau.rad,
  },
  {
    label: 'Marge brute réelle %',
    ancienKey: r => r.ancien.margeReelPct,
    nouveauKey: r => r.nouveau.margeEstimeePct,
    note: 'Sémantique différente: ancien=marge actuelle, nouveau=marge projetée à terminaison',
  },
];

// ── Extraction de l'avancement interne de calculerCoutsChantier ─────────────
// calculerCoutsChantier ne retourne pas `avancement` dans son objet.
// On le recalcule ici en reproduisant sa logique (L329-336).
function extraireAvancementAncien(chantier) {
  const journal = chantier.journal || [];
  const nbJours = parseInt(chantier.nombreJours || 0);
  const joursReels = new Set(journal.map(e => e.date).filter(Boolean)).size;
  const avancementJournal = nbJours > 0 && joursReels > 0
    ? Math.min(100, Math.round((joursReels / nbJours) * 100))
    : 0;
  const statutLower = (chantier.statut || '').trim().toLowerCase();
  const clos = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(statutLower);
  return clos ? 100 : (avancementJournal || parseFloat(chantier.avancement) || 0);
}

// ── Test principal ───────────────────────────────────────────────────────────

describe('Comparaison calculerCoutsChantier vs calculerEtatChantier', () => {
  it('affiche les écarts chantier par chantier', () => {
    const { chantiers, employes, devis, parametres } = donneesInitiales;

    const cfg = {
      coefficientMainOeuvre: parametres?.coefficientMainOeuvre ?? 1.35,
      tauxFraisGeneraux: parametres?.tauxFraisGeneraux ?? 12,
    };

    const resultats = [];

    console.log('\n');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  COMPARAISON MOTEURS — calculerCoutsChantier vs calculerEtatChantier');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`  Inputs communs : ${employes.length} employés, ${devis.length} devis`);
    console.log(`  cfg.coefficientMO=${cfg.coefficientMainOeuvre}  cfg.tauxFG=${cfg.tauxFraisGeneraux}%`);
    console.log('');

    for (const chantier of chantiers) {
      let ancien = null;
      let ancienErr = null;
      let nouveau = null;
      let nouveauErr = null;

      try {
        ancien = calculerCoutsChantier(chantier, employes, [], cfg, devis);
      } catch (e) {
        ancienErr = e.message;
      }

      try {
        nouveau = calculerEtatChantier(chantier, employes, devis, cfg);
      } catch (e) {
        nouveauErr = e.message;
      }

      const ancienAvancement = extraireAvancementAncien(chantier);

      console.log(`┌─ Chantier #${chantier.id} — "${chantier.nom}" (statut: ${chantier.statut})`);

      if (ancienErr) console.log(`│  ⚠️  calculerCoutsChantier ERREUR: ${ancienErr}`);
      if (nouveauErr) console.log(`│  ⚠️  calculerEtatChantier ERREUR: ${nouveauErr}`);

      if (!ancien || !nouveau) {
        console.log('│  Comparaison impossible — au moins un moteur en erreur');
        console.log('└');
        resultats.push({ id: chantier.id, nom: chantier.nom, erreur: true, divergences: [] });
        continue;
      }

      const r = { ancien, nouveau, ancienAvancement };
      const divergences = [];

      for (const champ of CHAMPS_COMPARABLES) {
        const va = champ.ancienKey(r);
        const vn = champ.nouveauKey(r);
        const { delta, pct, equiv } = pctDelta(va, vn);

        const line = `│  ${badge(equiv)}  ${champ.label.padEnd(32)} ancien=${fmt(va).padStart(14)}  nouveau=${fmt(vn).padStart(14)}` +
          (delta !== null ? `  Δ=${fmt(delta)} (${pct !== null ? pct.toFixed(2) : '?'}%)` : '  Δ=n/a') +
          (champ.note ? `  [${champ.note}]` : '');

        console.log(line);

        if (!equiv) {
          divergences.push({
            champ: champ.label,
            ancien: va,
            nouveau: vn,
            delta,
            pct,
            note: champ.note,
          });
        }
      }

      // Champ spécifique : coutDeplacementReel (n'existe que dans l'ancien)
      if (ancien.coutDeplacementReel > 0) {
        console.log(`│  ℹ️   coutDeplacementReel (ancien uniquement)   = ${fmt(ancien.coutDeplacementReel)} CHF (absent du nouveau moteur)`);
      }

      console.log(`│  ─── Résumé: ${divergences.length === 0 ? '✅ Équivalents' : `❌ ${divergences.length} divergence(s)`}`);
      console.log('└');

      resultats.push({
        id: chantier.id,
        nom: chantier.nom,
        erreur: false,
        divergences,
        coutDeplacement: ancien.coutDeplacementReel,
      });
    }

    // ── Résumé global ────────────────────────────────────────────────────────
    const compares = resultats.filter(r => !r.erreur);
    const equivalents = compares.filter(r => r.divergences.length === 0);
    const divergents = compares.filter(r => r.divergences.length > 0);

    console.log('');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  RÉSUMÉ GLOBAL');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`  Chantiers comparés     : ${compares.length} / ${chantiers.length}`);
    console.log(`  Moteurs équivalents    : ${equivalents.length} chantier(s) — tous les champs à <0.5% d'écart`);
    console.log(`  Moteurs divergents     : ${divergents.length} chantier(s) — au moins 1 champ à >0.5% d'écart`);

    if (divergents.length > 0) {
      console.log('');
      console.log('  Détail des divergences :');
      for (const r of divergents) {
        console.log(`\n  Chantier #${r.id} "${r.nom}" — ${r.divergences.length} divergence(s):`);
        for (const d of r.divergences) {
          console.log(`    • ${d.champ}`);
          console.log(`        ancien  = ${fmt(d.ancien)}`);
          console.log(`        nouveau = ${fmt(d.nouveau)}`);
          if (d.delta !== null) console.log(`        Δ       = ${fmt(d.delta)} (${d.pct?.toFixed(2)}%)`);
          if (d.note) console.log(`        note    = ${d.note}`);
        }
      }
    }

    if (equivalents.length > 0) {
      console.log('');
      console.log('  Chantiers équivalents :');
      for (const r of equivalents) {
        const dep = r.coutDeplacement > 0 ? ` (hors déplacement: ${fmt(r.coutDeplacement)} CHF)` : '';
        console.log(`    ✅ #${r.id} "${r.nom}"${dep}`);
      }
    }

    console.log('');
    console.log('  NOTE STRUCTURELLE :');
    console.log('  calculerCoutsChantier inclut coutDeplacementReel dans totalCoutsReel.');
    console.log('  calculerEtatChantier ignore les déplacements (pas de paramètre localites).');
    console.log('  Les écarts sur "Coût total réel" peuvent donc être 100% justifiés par ce seul écart.');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('');
  });
});
