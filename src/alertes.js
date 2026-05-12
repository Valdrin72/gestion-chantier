// ============================================================
// CYNA — ALERTES INTELLIGENTES v2
// Retourne un tableau d'alertes structurées à partir des données
// Structure : { id, type, niveau, message, page, entityId, date }
// ============================================================

import { calculerDateFinOuvrables } from './donnees';
import { prochainRappel, niveauInfo } from './relances';

function calculerTotalFacture(f) {
  if (parseFloat(f.montantTTC) > 0) return parseFloat(f.montantTTC);
  if (Array.isArray(f.lignes) && f.lignes.length > 0) {
    return f.lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaire) || 0) * (1 + (parseFloat(l.tva) || 0) / 100), 0);
  }
  return parseFloat(f.montantHT) || 0;
}

/**
 * @param {object} data
 * @param {Array}  data.chantiers
 * @param {Array}  data.devis
 * @param {Array}  data.factures
 * @param {object} data.paiements  { [chantierId]: [{...}] }
 * @param {Array}  data.clients
 * @param {string} profilId - profil connecté (pour filtrer les alertes pertinentes)
 * @returns {Array<{ id, type, niveau, message, page, entityId, date }>}
 */
export function calculerAlertes({ chantiers = [], devis = [], factures = [], paiements = {}, clients = [], chantiersStats = [] }, profilId = 'direction') {
  const alertes = [];
  const now = new Date();

  let idSeq = 1;
  const push = (alerte) => alertes.push({ id: `alert_${idSeq++}`, date: now.toISOString(), ...alerte });

  // ── 1. Chantiers en retard ──────────────────────────────────
  if (['direction', 'conducteur', 'administratif'].includes(profilId)) {
    chantiers.forEach(c => {
      if (c.statut?.trim().toLowerCase() === 'en cours') {
        const dateFinStr = calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi);
        const dateFin = dateFinStr && dateFinStr !== '-' ? new Date(dateFinStr) : null;
        if (dateFin && !isNaN(dateFin.getTime()) && dateFin < now) {
          const joursRetard = Math.floor((now - dateFin) / 86400000);
          if (joursRetard > 0) {
            push({
              type: 'chantier_retard',
              niveau: joursRetard > 14 ? 'critique' : 'warning',
              message: `Chantier "${c.nom || c.numero}" est en retard de ${joursRetard} jour${joursRetard > 1 ? 's' : ''}`,
              page: 'chantiers',
              entityId: c.id,
            });
          }
        }
      }
    });
  }

  // ── 2. Devis sans réponse depuis >14 jours ──────────────────
  if (['direction', 'administratif'].includes(profilId)) {
    devis.forEach(d => {
      if (d.statut?.toLowerCase() === 'envoyé' && !d.chantierId) {
        const dateRef = new Date(d.dateEmission || d.date || now);
        if (isNaN(dateRef.getTime())) return;
        const joursAttente = Math.floor((now - dateRef) / 86400000);
        if (joursAttente > 14) {
          push({
            type: 'devis_attente',
            niveau: joursAttente > 30 ? 'critique' : 'warning',
            message: `Devis ${d.numero} sans réponse depuis ${joursAttente} jours`,
            page: 'devis',
            entityId: d.id,
          });
        }
      }
    });
  }

  // ── 3. Factures en retard de paiement + relances à envoyer ───
  if (['direction', 'administratif'].includes(profilId)) {
    factures.forEach(f => {
      if (f.statut !== 'envoyee' && f.statut !== 'partielle' && f.statut !== 'retard') return;
      const dateEch = f.dateEcheance || (f.dateEmission ? new Date(new Date(f.dateEmission).getTime() + 30 * 86400000).toISOString().slice(0, 10) : null);
      if (!dateEch) return;
      const echeance = new Date(dateEch);
      if (isNaN(echeance.getTime())) return;
      const joursRetard = Math.floor((now - echeance) / 86400000);
      if (joursRetard <= 0) return;

      const montantRestant = Math.max(0,
        calculerTotalFacture(f) -
        (f.paiementsHistorique || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0)
      );

      // Rappel à envoyer (priorité haute, actionable)
      const rappel = prochainRappel(f);
      if (rappel) {
        const info = niveauInfo(rappel.niveau);
        push({
          type: 'rappel_a_envoyer',
          niveau: rappel.niveau === 3 ? 'critique' : (rappel.niveau === 2 ? 'critique' : 'warning'),
          message: `${info.label} à envoyer pour facture ${f.numero} — ${joursRetard} j de retard · CHF ${montantRestant.toLocaleString('fr-CH')}`,
          page: 'finances',
          entityId: f.id,
          rappelNiveau: rappel.niveau,
        });
      } else {
        // Retard sans rappel à envoyer (déjà tous envoyés ou délai pas atteint)
        push({
          type: 'facture_retard',
          niveau: joursRetard > 30 ? 'critique' : 'warning',
          message: `Facture ${f.numero} en retard de ${joursRetard} j — CHF ${montantRestant.toLocaleString('fr-CH')} restants`,
          page: 'finances',
          entityId: f.id,
        });
      }
    });
  }

  // ── 4. Factures brouillon non émises ────────────────────────
  if (['direction', 'administratif'].includes(profilId)) {
    const brouillons = factures.filter(f => f.statut === 'brouillon');
    if (brouillons.length > 0) {
      push({
        type: 'factures_brouillon',
        niveau: 'info',
        message: `${brouillons.length} facture${brouillons.length > 1 ? 's' : ''} en brouillon non émise${brouillons.length > 1 ? 's' : ''}`,
        page: 'factures',
        entityId: null,
      });
    }
  }

  // ── 5. Chantiers sans devis associé ─────────────────────────
  if (['direction', 'administratif'].includes(profilId)) {
    const sansDev = chantiers.filter(c =>
      c.statut?.toLowerCase() !== 'terminé' && c.statut?.toLowerCase() !== 'annulé' && !c.devisId
    );
    if (sansDev.length > 0) {
      push({
        type: 'chantier_sans_devis',
        niveau: 'info',
        message: `${sansDev.length} chantier${sansDev.length > 1 ? 's' : ''} actif${sansDev.length > 1 ? 's' : ''} sans devis lié`,
        page: 'chantiers',
        entityId: null,
      });
    }
  }

  // ── 6. Chantiers terminés depuis >7 jours sans facture finale ──
  if (['direction', 'administratif'].includes(profilId)) {
    chantiers.forEach(c => {
      if (c.statut?.toLowerCase() === 'terminé') {
        if (!c.dateFin && !c.dateDebut) return;
        const dateTermine = new Date(c.dateFin || c.dateDebut);
        if (isNaN(dateTermine.getTime())) return;
        const joursDepuisTermine = Math.floor((now - dateTermine) / 86400000);
        if (joursDepuisTermine < 7) return; // grâce de 7 jours
        const hasFactureFinale = factures.some(f =>
          f.chantierId === c.id && (f.type === 'finale' || f.type === 'standard') && f.statut !== 'annulee'
        );
        if (!hasFactureFinale) {
          push({
            type: 'chantier_sans_facture',
            niveau: joursDepuisTermine > 30 ? 'critique' : 'warning',
            message: `Chantier "${c.nom || c.numero}" terminé il y a ${joursDepuisTermine} j sans facture finale`,
            page: 'chantiers',
            entityId: c.id,
          });
        }
      }
    });
  }

  // ── 7bis. Paiements en attente depuis >30 jours ─────────────
  if (['direction', 'administratif'].includes(profilId)) {
    Object.values(paiements).forEach(liste => {
      if (!Array.isArray(liste)) return;
      liste.forEach(p => {
        if (['En attente','en attente','envoyee','partielle','retard'].includes(p.statut)) {
          const dateSrc = p.dateEcheance || p.date;
          if (!dateSrc) return;
          const dateRef = new Date(dateSrc);
          if (isNaN(dateRef.getTime())) return;
          const joursAttente = Math.floor((now - dateRef) / 86400000);
          if (joursAttente > 30) {
            push({
              type: 'paiement_en_attente',
              niveau: joursAttente > 60 ? 'critique' : 'warning',
              message: `Paiement ${p.type || ''} de ${(p.montant || 0).toLocaleString('fr-CH')} CHF en attente depuis ${joursAttente} jours`,
              page: 'paiements',
              entityId: p.chantierId || null,
            });
          }
        }
      });
    });
  }

  // ── 7. Paiements sans facture associée ───────────────────────
  if (['direction', 'administratif'].includes(profilId)) {
    let countSansFacture = 0;
    Object.values(paiements).forEach(liste => {
      if (Array.isArray(liste)) {
        liste.forEach(p => { if (!p.factureId) countSansFacture++; });
      }
    });
    if (countSansFacture > 0) {
      push({
        type: 'paiements_sans_facture',
        niveau: 'info',
        message: `${countSansFacture} paiement${countSansFacture > 1 ? 's' : ''} non rattaché${countSansFacture > 1 ? 's' : ''} à une facture`,
        page: 'paiements',
        entityId: null,
      });
    }
  }

  // ── 8. Chantiers à perte ou dépassement budgétaire ──────────
  if (['direction', 'administratif'].includes(profilId) && chantiersStats.length > 0) {
    chantiersStats.forEach(stat => {
      if (!stat || !stat.id) return;
      if (typeof stat.margeNettePct === 'number' && stat.margeNettePct < 0) {
        push({
          type: 'chantier_a_perte',
          niveau: 'critique',
          message: `Chantier "${stat.nom || stat.id}" est à perte (marge ${Math.round(stat.margeNettePct * 10) / 10}%)`,
          page: 'chantiers',
          entityId: stat.id,
        });
      } else if (typeof stat.depassementBudget === 'number' && stat.depassementBudget > 20) {
        push({
          type: 'depassement_budget',
          niveau: 'critique',
          message: `Chantier "${stat.nom || stat.id}" dépasse le budget de ${Math.round(stat.depassementBudget)}%`,
          page: 'chantiers',
          entityId: stat.id,
        });
      } else if (typeof stat.margeNettePct === 'number' && stat.margeNettePct < 15) {
        push({
          type: 'marge_faible',
          niveau: 'warning',
          message: `Chantier "${stat.nom || stat.id}" : marge sous le seuil de rentabilité (${Math.round(stat.margeNettePct * 10) / 10}%)`,
          page: 'chantiers',
          entityId: stat.id,
        });
      }
    });
  }

  // ── Tri : critiques en premier, puis warnings, puis infos ───
  const ordre = { critique: 0, warning: 1, info: 2 };
  return alertes.sort((a, b) => (ordre[a.niveau] ?? 3) - (ordre[b.niveau] ?? 3));
}

// Labels lisibles pour les types d'alertes
export const ALERTE_LABELS = {
  chantier_retard:       'Retard chantier',
  devis_attente:         'Devis sans réponse',
  facture_retard:        'Facture en retard',
  rappel_a_envoyer:      'Rappel à envoyer',
  factures_brouillon:    'Brouillons non émis',
  chantier_sans_devis:   'Chantiers sans devis',
  chantier_sans_facture: 'Chantiers sans facture',
  paiement_en_attente:   'Paiement en attente',
  paiements_sans_facture:'Paiements non liés',
  chantier_a_perte:      'Chantier à perte',
  depassement_budget:    'Dépassement budgétaire',
  marge_faible:          'Marge insuffisante',
};

// Couleurs par niveau
export const ALERTE_COULEURS = {
  critique: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  warning:  { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  info:     { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
};
