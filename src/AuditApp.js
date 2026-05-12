import React, { useMemo, useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Info, Lightbulb } from 'lucide-react';
import { DS } from './ds';
import { fmtN, calculerCA, calculerCoutsChantier, SEUILS } from './donnees';

// ── Niveaux ──────────────────────────────────────────────────
const NIV = { ok: 'ok', warn: 'warn', err: 'err', info: 'info' };
const NIV_POIDS = { err: -15, warn: -5, ok: 0, info: 0 };
const NIV_COULEUR = { ok: '#10b981', warn: '#f59e0b', err: '#ef4444', info: '#3b82f6' };
const NIV_BG = { ok: '#f0fdf4', warn: '#fffbeb', err: '#fef2f2', info: '#eff6ff' };
function NIV_ICON({ niv, size = 14 }) {
  if (niv === 'ok')   return <CheckCircle  size={size} color="#10b981" />;
  if (niv === 'warn') return <AlertTriangle size={size} color="#f59e0b" />;
  if (niv === 'err')  return <XCircle      size={size} color="#ef4444" />;
  return <Info size={size} color="#3b82f6" />;
}

function runCheck({ id, categorie, titre, description, fn, data }) {
  try {
    const result = fn(data);
    return { id, categorie, titre, description, ...result };
  } catch (e) {
    return { id, categorie, titre, description, niveau: NIV.err, detail: `Erreur d'audit : ${e.message}`, recommandation: 'Vérifiez la configuration des données' };
  }
}

function scoreLabel(score) {
  if (score >= 90) return { label: 'Excellent', couleur: '#10b981' };
  if (score >= 75) return { label: 'Bon', couleur: '#10b981' };
  if (score >= 55) return { label: 'À améliorer', couleur: '#f59e0b' };
  if (score >= 35) return { label: 'Problèmes détectés', couleur: '#ef4444' };
  return { label: 'Critique', couleur: '#dc2626' };
}

// ── Composant carte check ─────────────────────────────────────
function CheckCard({ check, ouvert, onToggle }) {
  const c = NIV_COULEUR[check.niveau];
  const bg = NIV_BG[check.niveau];
  return (
    <div style={{ background: bg, border: `1px solid ${c}30`, borderRadius: 10, overflow: 'hidden', marginBottom: 6 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
        <NIV_ICON niv={check.niveau} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{check.titre}</span>
          {check.valeur !== undefined && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: c }}>{check.valeur}</span>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: c, background: `${c}18`, border: `1px solid ${c}30`, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>
          {check.niveau === 'ok' ? 'OK' : check.niveau === 'warn' ? 'Attention' : check.niveau === 'err' ? 'Erreur' : 'Info'}
        </span>
        {ouvert ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
      </div>
      {ouvert && (
        <div style={{ borderTop: `1px solid ${c}20`, padding: '10px 14px', paddingLeft: 38 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{check.description}</div>
          {check.detail && <div style={{ fontSize: 12, color: c, fontWeight: 600, marginBottom: 4 }}>{check.detail}</div>}
          {check.recommandation && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-muted)', marginTop: 6 }}>
              <Lightbulb size={11} style={{ flexShrink: 0, marginTop: 1 }} />
              {check.recommandation}
            </div>
          )}
          {check.items?.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: '0 0 0 14px', fontSize: 11, color: 'var(--text-secondary)' }}>
              {check.items.slice(0, 5).map((item, i) => <li key={i} style={{ marginBottom: 2 }}>{item}</li>)}
              {check.items.length > 5 && <li style={{ color: 'var(--text-muted)' }}>…et {check.items.length - 5} autre(s)</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toutes les vérifications ──────────────────────────────────
function buildChecks({ chantiers, devis, factures, clients, parametres }) {
  const employes = parametres.employes || [];
  const cfg = parametres.parametres || {};
  const devisMap = Object.fromEntries(devis.map(d => [String(d.id), d]));
  const chantiersMap = Object.fromEntries(chantiers.map(c => [String(c.id), c]));
  const clientsMap = Object.fromEntries(clients.map(c => [String(c.id), c]));
  const todayStr = new Date().toISOString().split('T')[0];

  const checks = [

    // ═══════════════════════════════════════════════════════
    // CAT 1 — INTÉGRITÉ DES LIENS
    // ═══════════════════════════════════════════════════════

    {
      id: 'factures_chantier_valide', categorie: 'Intégrité des liens',
      titre: 'Factures liées à un chantier valide',
      description: 'Chaque facture doit référencer un chantier existant',
      fn: () => {
        const orphelines = factures.filter(f => f.chantierId && !chantiersMap[String(f.chantierId)]);
        if (orphelines.length === 0) return { niveau: NIV.ok, detail: `${factures.length} facture(s) vérifiée(s)` };
        return {
          niveau: NIV.err,
          valeur: `${orphelines.length} orpheline(s)`,
          detail: `${orphelines.length} facture(s) pointent vers un chantier inexistant`,
          recommandation: 'Corrigez les liens dans les factures concernées',
          items: orphelines.map(f => `Facture ${f.numero || f.id} → chantier #${f.chantierId} introuvable`),
        };
      },
    },

    {
      id: 'factures_client_valide', categorie: 'Intégrité des liens',
      titre: 'Factures liées à un client valide',
      description: 'Chaque facture doit référencer un client existant',
      fn: () => {
        const pb = factures.filter(f => f.clientId && !clientsMap[String(f.clientId)]);
        if (pb.length === 0) return { niveau: NIV.ok, detail: `${factures.length} facture(s) vérifiée(s)` };
        return {
          niveau: NIV.err, valeur: `${pb.length} problème(s)`,
          detail: `${pb.length} facture(s) avec client introuvable`,
          recommandation: 'Vérifiez que le client existe encore dans la base',
          items: pb.map(f => `Facture ${f.numero || f.id} → client #${f.clientId} introuvable`),
        };
      },
    },

    {
      id: 'chantiers_devis_valide', categorie: 'Intégrité des liens',
      titre: 'Chantiers liés à un devis valide',
      description: 'Chaque chantier avec un devisId doit pointer vers un devis existant',
      fn: () => {
        const pb = chantiers.filter(c => c.devisId && !devisMap[String(c.devisId)]);
        if (pb.length === 0) return { niveau: NIV.ok, detail: `${chantiers.filter(c => c.devisId).length} lien(s) vérifié(s)` };
        return {
          niveau: NIV.err, valeur: `${pb.length} lien(s) brisé(s)`,
          detail: `${pb.length} chantier(s) avec devis introuvable`,
          recommandation: 'Reliez ces chantiers au bon devis ou créez le devis manquant',
          items: pb.map(c => `${c.nom || c.numero} → devis #${c.devisId} introuvable`),
        };
      },
    },

    {
      id: 'ca_source_unique', categorie: 'Intégrité des liens',
      titre: 'CA chantier = source unique (devis.montantHT)',
      description: 'Le CA ne doit pas être ressaisi manuellement sur le chantier — il vient du devis lié',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          // Source unique : CA vient de calculerCA (devis.montantHT), jamais de c.montantDevis
          const caCalcule = calculerCA(c, devis);
          const d = devisMap[String(c.devisId)];
          if (!d || !c.montantDevis) return;
          const montantDevis = caCalcule !== null ? caCalcule : (parseFloat(d.montantHT) || 0);
          const montantChantier = parseFloat(c.montantDevis) || 0;
          if (montantDevis > 0 && Math.abs(montantDevis - montantChantier) > 1) {
            pb.push(`${c.nom || c.numero} : chantier CHF ${fmtN(montantChantier)} ≠ CA calculé CHF ${fmtN(montantDevis)}`);
          }
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Source unique respectée sur tous les chantiers' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} écart(s)`,
          detail: `${pb.length} chantier(s) avec montant divergeant du devis`,
          recommandation: 'Le montant du chantier doit toujours être synchronisé depuis le devis',
          items: pb,
        };
      },
    },

    {
      id: 'devis_client_valide', categorie: 'Intégrité des liens',
      titre: 'Devis liés à un client valide',
      description: 'Chaque devis doit référencer un client existant',
      fn: () => {
        const pb = devis.filter(d => d.clientId && !clientsMap[String(d.clientId)]);
        if (pb.length === 0) return { niveau: NIV.ok, detail: `${devis.length} devis vérifié(s)` };
        return {
          niveau: NIV.warn, valeur: `${pb.length} devis orphelin(s)`,
          detail: `${pb.length} devis avec client introuvable`,
          recommandation: 'Vérifiez les clients supprimés',
          items: pb.map(d => `Devis ${d.numero || d.id} → client #${d.clientId}`),
        };
      },
    },

    // ═══════════════════════════════════════════════════════
    // CAT 2 — CALCULS FINANCIERS
    // ═══════════════════════════════════════════════════════

    {
      id: 'tva_correcte', categorie: 'Calculs financiers',
      titre: 'TVA des factures conforme (8.1% standard BTP CH)',
      description: 'La TVA sur les travaux BTP en Suisse est de 8.1% depuis 2024',
      fn: () => {
        const tvaInvalides = factures.filter(f => {
          const tva = parseFloat(f.tva);
          return !isNaN(tva) && tva !== 0 && tva !== 8.1 && tva !== 2.5 && tva !== 3.7;
        });
        if (tvaInvalides.length === 0) return { niveau: NIV.ok, detail: 'TVA conforme sur toutes les factures' };
        return {
          niveau: NIV.warn, valeur: `${tvaInvalides.length} taux non-standard`,
          detail: `${tvaInvalides.length} facture(s) avec un taux TVA inhabituel`,
          recommandation: 'Taux BTP Suisse 2024 : 8.1% (standard), 2.5% (réduit), 3.7% (hébergement)',
          items: tvaInvalides.map(f => `Facture ${f.numero || f.id} — TVA ${f.tva}%`),
        };
      },
    },

    {
      id: 'ttc_coherent', categorie: 'Calculs financiers',
      titre: 'Montants TTC = HT × (1 + TVA%)',
      description: 'montantTTC doit être strictement égal à montantHT × (1 + tva/100)',
      fn: () => {
        const pb = [];
        factures.forEach(f => {
          const ht = parseFloat(f.montantHT) || 0;
          const tva = parseFloat(f.tva) || 8.1;
          const ttcAttendu = Math.round(ht * (1 + tva / 100) * 100) / 100;
          const ttcReel = parseFloat(f.montantTTC) || 0;
          if (ht > 0 && ttcReel > 0 && Math.abs(ttcAttendu - ttcReel) > 1) {
            pb.push(`Facture ${f.numero || f.id} : TTC attendu CHF ${fmtN(ttcAttendu)} ≠ saisi CHF ${fmtN(ttcReel)}`);
          }
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Cohérence HT/TTC vérifiée' };
        return {
          niveau: NIV.err, valeur: `${pb.length} incohérence(s)`,
          detail: `${pb.length} facture(s) avec TTC mal calculé`,
          recommandation: 'Corrigez le montant TTC : HT × (1 + TVA/100)',
          items: pb,
        };
      },
    },

    {
      id: 'montants_valides', categorie: 'Calculs financiers',
      titre: 'Aucune valeur NaN ou négative dans les montants',
      description: 'Tous les montants HT doivent être des nombres positifs valides',
      fn: () => {
        const pb = [];
        devis.forEach(d => {
          const v = parseFloat(d.montantHT);
          if (d.montantHT && (isNaN(v) || v < 0)) pb.push(`Devis ${d.numero || d.id} — montantHT invalide : ${d.montantHT}`);
        });
        factures.forEach(f => {
          const v = parseFloat(f.montantHT);
          if (f.montantHT && (isNaN(v) || v < 0)) pb.push(`Facture ${f.numero || f.id} — montantHT invalide`);
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Tous les montants sont valides' };
        return {
          niveau: NIV.err, valeur: `${pb.length} valeur(s) invalide(s)`,
          detail: 'Des montants NaN ou négatifs ont été détectés',
          recommandation: 'Corrigez les montants en saisissant des valeurs numériques positives',
          items: pb,
        };
      },
    },

    {
      id: 'marges_coherentes', categorie: 'Calculs financiers',
      titre: 'Marges dans des intervalles cohérents',
      description: 'Une marge < -100% ou > 100% indique une anomalie de calcul',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          const couts = calculerCoutsChantier(c, employes, parametres.localites, cfg, devis);
          const m = couts.margeReelPct;
          if (m !== null && !isNaN(m) && (m < -100 || m > 200)) {
            pb.push(`${c.nom || c.numero} — marge aberrante : ${m.toFixed(1)}%`);
          }
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Marges dans les intervalles normaux' };
        return {
          niveau: NIV.err, valeur: `${pb.length} aberration(s)`,
          detail: `${pb.length} chantier(s) avec marge aberrante`,
          recommandation: 'Vérifiez les coûts et le CA de ces chantiers',
          items: pb,
        };
      },
    },

    {
      id: 'chantiers_a_perte', categorie: 'Calculs financiers',
      titre: 'Chantiers à perte (marge < 0%)',
      description: 'Les chantiers avec une marge réelle négative génèrent des pertes',
      fn: () => {
        const perdants = chantiers.filter(c => {
          const st = c.statut?.trim().toLowerCase();
          if (!['en cours', 'terminé', 'facturé', 'clôturé'].includes(st)) return false;
          const couts = calculerCoutsChantier(c, employes, parametres.localites, cfg, devis);
          return couts.margeReelPct !== null && couts.margeReelPct < 0;
        });
        if (perdants.length === 0) return { niveau: NIV.ok, detail: 'Aucun chantier à perte détecté' };
        return {
          niveau: NIV.err, valeur: `${perdants.length} chantier(s) à perte`,
          detail: `${perdants.length} chantier(s) avec marge négative`,
          recommandation: 'Analysez les coûts de ces chantiers et ajustez la facturation ou réduisez les charges',
          items: perdants.map(c => {
            const co = calculerCoutsChantier(c, employes, parametres.localites, cfg, devis);
            return `${c.nom || c.numero} — marge ${co.margeReelPct != null ? co.margeReelPct.toFixed(1) : '?'}%`;
          }),
        };
      },
    },

    {
      id: 'marges_faibles', categorie: 'Calculs financiers',
      titre: `Chantiers sous le seuil de rentabilité (< ${SEUILS.margeLimite}%)`,
      description: `La marge nette minimale cible pour le BTP genevois est de ${SEUILS.margeRentable}%`,
      fn: () => {
        const faibles = chantiers.filter(c => {
          const st = c.statut?.trim().toLowerCase();
          if (!['en cours', 'terminé', 'facturé', 'clôturé'].includes(st)) return false;
          const couts = calculerCoutsChantier(c, employes, parametres.localites, cfg, devis);
          return couts.margeReelPct !== null && couts.margeReelPct >= 0 && couts.margeReelPct < SEUILS.margeLimite;
        });
        if (faibles.length === 0) return { niveau: NIV.ok, detail: `Tous les chantiers sont au-dessus de ${SEUILS.margeLimite}%` };
        return {
          niveau: NIV.warn, valeur: `${faibles.length} chantier(s) limite`,
          detail: `${faibles.length} chantier(s) sous le seuil de rentabilité`,
          recommandation: `Visez ≥ ${SEUILS.margeRentable}% de marge nette (seuil cible BTP Genève)`,
          items: faibles.map(c => {
            const co = calculerCoutsChantier(c, employes, parametres.localites, cfg, devis);
            return `${c.nom || c.numero} — marge ${co.margeReelPct != null ? co.margeReelPct.toFixed(1) : '?'}%`;
          }),
        };
      },
    },

    // ═══════════════════════════════════════════════════════
    // CAT 3 — JOURNAL DES HEURES
    // ═══════════════════════════════════════════════════════

    {
      id: 'heures_valides', categorie: 'Journal des heures',
      titre: 'Heures journalières dans les limites légales (0.5h – 24h)',
      description: 'Une entrée de journal doit être entre 0.5h et 24h par employé par jour',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          (c.journal || []).forEach(e => {
            (e.employes || []).forEach(emp => {
              const h = parseFloat(emp.heuresTravaillees) || 0;
              if (h > 0 && (h < 0.5 || h > 24)) {
                pb.push(`${c.nom || c.numero} — ${e.date} : ${h}h (hors limites)`);
              }
            });
          });
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Toutes les heures sont dans les limites' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} entrée(s) anormale(s)`,
          detail: `${pb.length} entrée(s) de journal hors limites légales`,
          recommandation: 'Vérifiez les saisies : max 24h/jour, min 0.5h par entrée',
          items: pb,
        };
      },
    },

    {
      id: 'dates_futures_journal', categorie: 'Journal des heures',
      titre: 'Aucune date future dans le journal',
      description: 'Les heures ne peuvent pas être saisies pour des dates futures',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          (c.journal || []).forEach(e => {
            if (e.date && e.date > todayStr) pb.push(`${c.nom || c.numero} — ${e.date} (future)`);
          });
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Aucune date future détectée' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} date(s) future(s)`,
          detail: `${pb.length} entrée(s) avec date dans le futur`,
          recommandation: 'Supprimez ces entrées ou corrigez les dates',
          items: pb.slice(0, 5),
        };
      },
    },

    {
      id: 'heures_max_journee', categorie: 'Journal des heures',
      titre: 'Pas de journées > 12h par employé (CCT Romande)',
      description: 'La CCT Romande limite la durée maximale de travail journalier',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          (c.journal || []).forEach(e => {
            (e.employes || []).forEach(emp => {
              const h = parseFloat(emp.heuresTravaillees) || 0;
              if (h > 12) pb.push(`${c.nom || c.numero} — ${e.date} : ${h}h (>${12}h)`);
            });
          });
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Aucun dépassement CCT détecté' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} jour(s) excessif(s)`,
          detail: `${pb.length} journée(s) dépassant 12h selon la CCT Romande`,
          recommandation: 'Vérifiez ces saisies — des heures supplémentaires doivent être déclarées séparément',
          items: pb,
        };
      },
    },

    {
      id: 'jours_realises_coherent', categorie: 'Journal des heures',
      titre: 'joursRéalisés calculé depuis le journal (pas saisi manuellement)',
      description: 'Le nombre de jours réalisés doit provenir du journal, pas d\'un champ manuel',
      fn: () => {
        // Vérifie si des chantiers ont un champ joursRealises manuel qui diverge du journal
        const pb = [];
        chantiers.forEach(c => {
          const joursJournal = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
          // Ancien champ manuel (legacy)
          const joursManuel = parseInt(c.joursRealises) || null;
          if (joursManuel !== null && joursManuel !== joursJournal && joursJournal > 0) {
            pb.push(`${c.nom || c.numero} : journal=${joursJournal}j, manuel=${joursManuel}j`);
          }
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Source unique du journal respectée' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} divergence(s)`,
          detail: `${pb.length} chantier(s) avec joursRéalisés divergent du journal`,
          recommandation: 'Utilisez uniquement le journal comme source des jours réalisés',
          items: pb,
        };
      },
    },

    // ═══════════════════════════════════════════════════════
    // CAT 4 — RÈGLES MÉTIER BTP SUISSE
    // ═══════════════════════════════════════════════════════

    {
      id: 'factures_retard', categorie: 'Règles BTP Suisse',
      titre: 'Factures impayées > 30 jours (délai standard BTP CH)',
      description: 'Le standard BTP suisse est un délai de paiement de 30 jours net',
      fn: () => {
        const today = new Date(); today.setHours(0,0,0,0);
        const retard = factures.filter(f => {
          const st = f.statut?.trim().toLowerCase();
          if (['payé', 'payee', 'payée'].includes(st)) return false;
          const dateRef = new Date(f.dateEcheance || f.dateEmission || f.dateFacture || '');
          if (isNaN(dateRef)) return false;
          const joursDiff = Math.floor((today - dateRef) / 86400000);
          return joursDiff > 30;
        });
        if (retard.length === 0) return { niveau: NIV.ok, detail: 'Aucune facture en retard de paiement' };
        const montantTotal = retard.reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
        return {
          niveau: retard.length > 3 ? NIV.err : NIV.warn,
          valeur: `${retard.length} facture(s) — CHF ${fmtN(Math.round(montantTotal))}`,
          detail: `${retard.length} facture(s) impayée(s) depuis > 30 jours`,
          recommandation: 'Envoyez des relances — intérêts de retard applicables en droit suisse (5% p.a.)',
          items: retard.map(f => `${f.numero || f.id} — CHF ${fmtN(parseFloat(f.montantHT) || 0)}`),
        };
      },
    },

    {
      id: 'avancement_valide', categorie: 'Règles BTP Suisse',
      titre: 'Avancement entre 0% et 100%',
      description: 'L\'avancement d\'un chantier doit être compris entre 0 et 100%',
      fn: () => {
        const pb = chantiers.filter(c => {
          const v = parseFloat(c.avancement);
          return !isNaN(v) && (v < 0 || v > 100);
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Avancements dans les limites' };
        return {
          niveau: NIV.err, valeur: `${pb.length} aberration(s)`,
          detail: `${pb.length} chantier(s) avec avancement hors limites`,
          recommandation: 'Corrigez les avancements : 0% (non démarré) à 100% (terminé)',
          items: pb.map(c => `${c.nom || c.numero} — avancement ${c.avancement}%`),
        };
      },
    },

    {
      id: 'devis_acceptes_sans_chantier', categorie: 'Règles BTP Suisse',
      titre: 'Devis acceptés convertis en chantiers',
      description: 'Un devis accepté doit toujours avoir un chantier associé créé',
      fn: () => {
        const acceptes = devis.filter(d => d.statut?.trim().toLowerCase() === 'accepté');
        const sansChantier = acceptes.filter(d => !chantiers.some(c => String(c.devisId) === String(d.id)));
        if (sansChantier.length === 0) return {
          niveau: NIV.ok,
          detail: `${acceptes.length} devis accepté(s) — tous convertis en chantier`,
        };
        return {
          niveau: NIV.warn, valeur: `${sansChantier.length} non converti(s)`,
          detail: `${sansChantier.length} devis accepté(s) sans chantier créé`,
          recommandation: 'Créez le chantier depuis la page Devis via "Convertir en chantier"',
          items: sansChantier.map(d => `Devis ${d.numero || d.id} — CHF ${fmtN(parseFloat(d.montantHT) || 0)}`),
        };
      },
    },

    {
      id: 'dates_coherentes', categorie: 'Règles BTP Suisse',
      titre: 'Dates chantier cohérentes avec acceptation devis',
      description: 'Un chantier ne peut pas démarrer avant la signature du devis',
      fn: () => {
        const pb = [];
        chantiers.forEach(c => {
          const d = devisMap[String(c.devisId)];
          if (c.dateDebut && d?.dateAcceptation && c.dateDebut < d.dateAcceptation) {
            pb.push(`${c.nom || c.numero} : début ${c.dateDebut} < acceptation ${d.dateAcceptation}`);
          }
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Dates cohérentes sur tous les chantiers' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} incohérence(s)`,
          detail: `${pb.length} chantier(s) démarrés avant la signature du devis`,
          recommandation: 'Corrigez les dates ou mettez à jour la date d\'acceptation du devis',
          items: pb,
        };
      },
    },

    {
      id: 'chantiers_inactifs', categorie: 'Règles BTP Suisse',
      titre: 'Chantiers "En cours" sans activité récente (> 14 jours)',
      description: 'Un chantier actif sans aucune heure saisie depuis 2 semaines peut être un oubli',
      fn: () => {
        const limite = new Date(); limite.setDate(limite.getDate() - 14);
        const limiteStr = limite.toISOString().split('T')[0];
        const pb = chantiers.filter(c => {
          if (c.statut?.trim().toLowerCase() !== 'en cours') return false;
          const dates = (c.journal || []).map(e => e.date).filter(Boolean);
          if (dates.length === 0) return false; // Jamais démarré OK
          const derniere = dates.sort().reverse()[0];
          return derniere < limiteStr;
        });
        if (pb.length === 0) return { niveau: NIV.ok, detail: 'Tous les chantiers actifs ont une activité récente' };
        return {
          niveau: NIV.warn, valeur: `${pb.length} chantier(s) inactif(s)`,
          detail: `${pb.length} chantier(s) "En cours" sans heures depuis 14+ jours`,
          recommandation: 'Vérifiez si ces chantiers sont suspendus ou s\'il faut saisir les heures manquantes',
          items: pb.map(c => `${c.nom || c.numero}`),
        };
      },
    },

    // ═══════════════════════════════════════════════════════
    // CAT 5 — CONFIGURATION
    // ═══════════════════════════════════════════════════════

    {
      id: 'employes_configures', categorie: 'Configuration',
      titre: 'Au moins 1 employé actif configuré',
      description: 'Sans employé, la saisie d\'heures et le calcul des coûts MO sont impossibles',
      fn: () => {
        const actifs = employes.filter(e => e.actif !== false);
        if (actifs.length > 0) return { niveau: NIV.ok, detail: `${actifs.length} employé(s) actif(s)` };
        return {
          niveau: NIV.err,
          detail: 'Aucun employé actif configuré',
          recommandation: 'Ajoutez vos employés dans Paramètres → Employés',
        };
      },
    },

    {
      id: 'tarifs_configures', categorie: 'Configuration',
      titre: 'Tarifs jour valides pour tous les employés',
      description: 'Le tarif jour (coût chargé employeur) doit être > 0 pour chaque employé actif',
      fn: () => {
        const actifs = employes.filter(e => e.actif !== false);
        const sansTarif = actifs.filter(e => !parseFloat(e.tarifJour) || parseFloat(e.tarifJour) <= 0);
        if (sansTarif.length === 0) return { niveau: NIV.ok, detail: `Tarifs configurés pour ${actifs.length} employé(s)` };
        return {
          niveau: NIV.warn, valeur: `${sansTarif.length} tarif(s) manquant(s)`,
          detail: `${sansTarif.length} employé(s) sans tarif jour valide — calculs MO impossibles`,
          recommandation: 'Saisissez le coût chargé employeur (salaire brut + ~35% charges sociales)',
          items: sansTarif.map(e => `${e.nom} — tarif jour manquant ou nul`),
        };
      },
    },

    {
      id: 'coefficient_mo', categorie: 'Configuration',
      titre: 'Coefficient MO configuré (charges sociales)',
      description: 'Le coefficient de main d\'œuvre représente les charges sociales (défaut 1.35 = +35%)',
      fn: () => {
        const coeff = parseFloat(cfg.coefficientMainOeuvre);
        if (!isNaN(coeff) && coeff >= 1.0 && coeff <= 2.5) {
          return { niveau: NIV.ok, detail: `Coefficient MO : ${coeff} (+${Math.round((coeff - 1) * 100)}% de charges)` };
        }
        if (!isNaN(coeff) && (coeff < 1.0 || coeff > 2.5)) {
          return {
            niveau: NIV.warn, valeur: `${coeff} (hors plage)`,
            detail: `Coefficient MO hors plage normale (1.0 – 2.5)`,
            recommandation: 'En Suisse romande BTP : coefficient typique entre 1.30 et 1.45',
          };
        }
        return {
          niveau: NIV.warn,
          detail: 'Coefficient MO non configuré — défaut 1.35 appliqué',
          recommandation: 'Configurez le coefficient dans Paramètres → Calculs',
        };
      },
    },

    {
      id: 'types_travaux', categorie: 'Configuration',
      titre: 'Types de travaux configurés',
      description: 'Les types de travaux permettent le benchmark et les suggestions de l\'IA',
      fn: () => {
        const types = parametres.typesTravaux || [];
        if (types.length >= 3) return { niveau: NIV.ok, detail: `${types.length} type(s) de travaux configurés` };
        if (types.length > 0) return {
          niveau: NIV.info,
          detail: `Seulement ${types.length} type(s) configuré(s)`,
          recommandation: 'Ajoutez plus de types de travaux pour améliorer le benchmark et l\'assistant devis',
        };
        return {
          niveau: NIV.warn,
          detail: 'Aucun type de travaux configuré',
          recommandation: 'Configurez vos types de travaux dans Paramètres pour activer le benchmark et l\'assistant IA',
        };
      },
    },

    {
      id: 'taux_fg', categorie: 'Configuration',
      titre: 'Taux de frais généraux configuré',
      description: 'Les frais généraux (FG) sont nécessaires au calcul de la marge nette (défaut 12%)',
      fn: () => {
        const taux = parseFloat(cfg.tauxFG || cfg.fraisGeneraux);
        if (!isNaN(taux) && taux > 0 && taux < 50) return { niveau: NIV.ok, detail: `Frais généraux : ${taux}%` };
        return {
          niveau: NIV.info,
          detail: 'Taux FG non configuré — défaut 12% du CA appliqué',
          recommandation: 'Configurez votre taux réel de frais généraux dans Paramètres pour une marge nette précise',
        };
      },
    },

  ];

  return checks.map(check => runCheck({ ...check, data: { chantiers, devis, factures, clients, parametres } }));
}

// ── Composant principal ───────────────────────────────────────
export default function AuditApp({ chantiers = [], devis = [], factures = [], clients = [], parametres = {} }) {
  const [ouvert, setOuvert] = useState({});
  const [filtreCategorie, setFiltreCategorie] = useState('Tous');
  const [filtreNiveau, setFiltreNiveau] = useState('Tous');
  const [refresh, setRefresh] = useState(0);

  const results = useMemo(() => buildChecks({ chantiers, devis, factures, clients, parametres }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chantiers, devis, factures, clients, parametres, refresh]);

  const score = useMemo(() => {
    const base = 100;
    const penalite = results.reduce((s, r) => s + (NIV_POIDS[r.niveau] || 0), 0);
    return Math.max(0, Math.min(100, base + penalite));
  }, [results]);

  const categories = ['Tous', ...new Set(results.map(r => r.categorie))];
  const nbErreurs = results.filter(r => r.niveau === NIV.err).length;
  const nbWarnings = results.filter(r => r.niveau === NIV.warn).length;
  const nbOk = results.filter(r => r.niveau === NIV.ok).length;

  const resultsFiltres = results.filter(r => {
    const catOk = filtreCategorie === 'Tous' || r.categorie === filtreCategorie;
    const nivOk = filtreNiveau === 'Tous' || r.niveau === filtreNiveau;
    return catOk && nivOk;
  });

  const { label: scoreLabel_, couleur: scoreCouleur } = scoreLabel(score);
  const ScoreIcon = score >= 90 ? ShieldCheck : score >= 60 ? Shield : score >= 35 ? ShieldAlert : ShieldX;

  return (
    <div>
      {/* Header */}
      <div className="page-header-row" style={{ marginBottom: 24 }}>
        <div className="page-title-block">
          <div className="page-title-main">Audit IA</div>
          <div className="page-title-sub">Vérification complète de la cohérence code, données et règles BTP</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => setRefresh(r => r + 1)}
            style={{ ...DS.btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Relancer l'audit
          </button>
        </div>
      </div>

      {/* Score global */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: `linear-gradient(135deg, ${scoreCouleur}18, ${scoreCouleur}08)`, border: `2px solid ${scoreCouleur}40`, borderRadius: 18, padding: '28px 24px', textAlign: 'center' }}>
          <ScoreIcon size={40} color={scoreCouleur} strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 56, fontWeight: 900, color: scoreCouleur, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
          <div style={{ fontSize: 11, color: scoreCouleur, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>/ 100</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: scoreCouleur, marginTop: 10 }}>{scoreLabel_}</div>
          <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
            <div style={{ height: '100%', width: `${score}%`, background: scoreCouleur, borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>{results.length} vérifications effectuées</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Erreurs', nb: nbErreurs, couleur: '#ef4444', bg: '#fef2f2', filtre: 'err', impact: '-15 pts/erreur' },
            { label: 'Avertissements', nb: nbWarnings, couleur: '#f59e0b', bg: '#fffbeb', filtre: 'warn', impact: '-5 pts/avert.' },
            { label: 'OK', nb: nbOk, couleur: '#10b981', bg: '#f0fdf4', filtre: 'ok', impact: 'Aucun impact' },
          ].map(k => (
            <button key={k.label} onClick={() => setFiltreNiveau(prev => prev === k.filtre ? 'Tous' : k.filtre)}
              style={{ background: filtreNiveau === k.filtre ? k.bg : 'var(--bg-card)', border: `2px solid ${filtreNiveau === k.filtre ? k.couleur : 'var(--ds-card-border)'}`, borderRadius: 14, padding: '20px 16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ marginBottom: 8 }}><NIV_ICON niv={k.filtre} size={20} /></div>
              <div style={{ fontSize: 32, fontWeight: 900, color: k.couleur }}>{k.nb}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.impact}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filtres catégorie */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>Catégorie :</span>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFiltreCategorie(cat)}
            style={{ borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', transition: 'all 0.15s',
              background: filtreCategorie === cat ? '#4f46e5' : 'transparent',
              color: filtreCategorie === cat ? 'white' : 'var(--text-muted)',
              borderColor: filtreCategorie === cat ? '#4f46e5' : 'var(--border)' }}>
            {cat}
            {cat !== 'Tous' && (
              <span style={{ marginLeft: 6, fontSize: 10, background: filtreCategorie === cat ? 'rgba(255,255,255,0.25)' : 'var(--bg-glass)', borderRadius: 10, padding: '1px 5px' }}>
                {results.filter(r => r.categorie === cat).length}
              </span>
            )}
          </button>
        ))}
        {filtreNiveau !== 'Tous' && (
          <button onClick={() => setFiltreNiveau('Tous')}
            style={{ marginLeft: 8, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626' }}>
            ✕ Effacer filtre
          </button>
        )}
      </div>

      {/* Liste des checks groupés par catégorie */}
      {categories.filter(cat => cat !== 'Tous' && (filtreCategorie === 'Tous' || filtreCategorie === cat)).map(cat => {
        const checksCat = resultsFiltres.filter(r => r.categorie === cat);
        if (checksCat.length === 0) return null;
        const nbErrCat = checksCat.filter(r => r.niveau === NIV.err).length;
        const nbWarnCat = checksCat.filter(r => r.niveau === NIV.warn).length;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</div>
              {nbErrCat > 0 && <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{nbErrCat} erreur{nbErrCat > 1 ? 's' : ''}</span>}
              {nbWarnCat > 0 && <span style={{ background: '#fffbeb', color: '#f59e0b', border: '1px solid #fcd34d', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{nbWarnCat} avert.</span>}
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            {checksCat.map(check => (
              <CheckCard
                key={check.id}
                check={check}
                ouvert={!!ouvert[check.id]}
                onToggle={() => setOuvert(prev => ({ ...prev, [check.id]: !prev[check.id] }))}
              />
            ))}
          </div>
        );
      })}

      {resultsFiltres.length === 0 && (
        <div style={{ ...DS.card, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Aucune vérification correspondant aux filtres sélectionnés
        </div>
      )}
    </div>
  );
}
