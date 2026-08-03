/**
 * CYNA — Les rendez-vous du directeur (Plan directeur, règle IA2).
 *
 * Le briefing du MATIN existe (simulerRapportLundi). Ici : ses deux frères —
 * le DÉBRIEF DU SOIR (« qu'est-ce qui s'est passé aujourd'hui ? ») et le
 * BILAN HEBDO (« comment s'est passée la semaine, que prépare la suivante ? »).
 *
 * Règle IA3 : le cerveau ne crée AUCUNE donnée. Fonctions PURES qui lisent les
 * sources définies — pointages[] (source de vérité heures), factures (source
 * unique des paiements, lot 4), états C8 des chantiers — et concluent.
 * Recalcul déterministe à l'affichage : le débrief du soir suit les pointages
 * qui s'accumulent dans la journée (un cache par date figerait l'état de 10h).
 */

import { isChantierActif, fmtN } from '../donnees';
import { CATEGORIES_AVEC_CHANTIER } from '../types/pointage';

const CATS_TRAVAIL = CATEGORIES_AVEC_CHANTIER; // ['production', 'atelier'] — même filtre que le journal

const jourISO = (d = new Date()) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const estFactureReelle = (f) => !['annulee', 'brouillon'].includes((f.statut || '').trim().toLowerCase());

/** Heures production/atelier d'une liste de répartitions. */
const heuresProductives = (repartitions = []) =>
  repartitions.filter(r => CATS_TRAVAIL.includes(r.categorie))
    .reduce((s, r) => s + (parseFloat(r.heures) || 0), 0);

// ════════════════════════════════════════════════════════════════════════════
// DÉBRIEF DU SOIR — la journée en 30 secondes
// ════════════════════════════════════════════════════════════════════════════
export function construireDebriefSoir({ chantiers = [], factures = [], pointages = [], parametres = {}, date } = {}) {
  const jour = date || jourISO();
  const nomChantier = (id) => {
    const c = chantiers.find(x => String(x.id) === String(id));
    return c ? (c.nom || c.numero || `Chantier ${id}`) : `Chantier ${id}`;
  };
  const nomEmploye = (id) => {
    const e = (parametres?.employes || []).find(x => String(x.id) === String(id));
    return e?.nom || `Employé ${id}`;
  };

  // ── 1. Heures pointées AUJOURD'HUI — total, par chantier, par qui ──────────
  const duJour = (pointages || []).filter(p => p.date === jour);
  const parChantierMap = {};
  let heuresTotal = 0;
  duJour.forEach(p => {
    (p.repartitions || []).forEach(r => {
      if (!CATS_TRAVAIL.includes(r.categorie)) return;
      const h = parseFloat(r.heures) || 0;
      if (h <= 0) return;
      heuresTotal += h;
      const cle = String(r.chantierId ?? 'atelier');
      if (!parChantierMap[cle]) parChantierMap[cle] = { chantierId: r.chantierId, nom: r.chantierId ? nomChantier(r.chantierId) : 'Atelier', heures: 0, parEmploye: {} };
      parChantierMap[cle].heures += h;
      const nomE = nomEmploye(p.employeId);
      parChantierMap[cle].parEmploye[nomE] = (parChantierMap[cle].parEmploye[nomE] || 0) + h;
    });
  });
  const parChantier = Object.values(parChantierMap)
    .map(c => ({ ...c, parEmploye: Object.entries(c.parEmploye).map(([nom, heures]) => ({ nom, heures })) }))
    .sort((a, b) => b.heures - a.heures);

  // ── 2. C4 — pointage manquant : chantier EN COURS sans aucune heure du jour ─
  // Jours ouvrables seulement (lun-ven ; samedi uniquement si le chantier l'inclut).
  const d = new Date(jour + 'T12:00:00');
  const jourSemaine = d.getDay(); // 0 = dimanche, 6 = samedi
  const jourOuvrablePour = (c) => (jourSemaine >= 1 && jourSemaine <= 5) || (jourSemaine === 6 && c.inclusSamedi === true);
  const idsPointesAujourdhui = new Set(
    duJour.flatMap(p => (p.repartitions || [])
      .filter(r => CATS_TRAVAIL.includes(r.categorie) && (parseFloat(r.heures) || 0) > 0 && r.chantierId != null)
      .map(r => String(r.chantierId)))
  );
  const pointagesManquants = (chantiers || [])
    .filter(c => isChantierActif(c) && jourOuvrablePour(c) && !idsPointesAujourdhui.has(String(c.id)))
    .map(c => ({ chantierId: c.id, nom: c.nom || c.numero }));

  // ── 3. L'argent du jour — paiements reçus + factures émises (source factures) ─
  const paiementsListe = (factures || [])
    .filter(estFactureReelle)
    .flatMap(f => (f.paiementsHistorique || [])
      .filter(p => p.date === jour)
      .map(p => ({ montant: parseFloat(p.montant) || 0, factureNumero: f.numero || '—', chantierNom: f.chantierId ? nomChantier(f.chantierId) : null })));
  const paiementsRecus = { total: paiementsListe.reduce((s, p) => s + p.montant, 0), liste: paiementsListe };

  const facturesEmises = (factures || [])
    .filter(f => estFactureReelle(f) && f.dateEmission === jour)
    .map(f => ({ numero: f.numero || '—', montantTTC: parseFloat(f.montantTTC) || 0, chantierNom: f.chantierId ? nomChantier(f.chantierId) : null }));

  // ── 4. Changements notables du jour (états C8) ─────────────────────────────
  const changements = [];
  (chantiers || []).forEach(c => {
    const st = (c.statut || '').trim().toLowerCase();
    if (c.dateFinTravaux === jour && st === 'attente paiement') {
      changements.push({ type: 'travaux_termines', texte: `« ${c.nom || c.numero} » — travaux terminés, en attente de paiement` });
    }
    if (c.dateFin === jour && st === 'terminé') {
      changements.push({ type: 'termine', texte: `« ${c.nom || c.numero} » — terminé, tout est encaissé ✓` });
    }
  });

  return { date: jour, heuresTotal, parChantier, pointagesManquants, paiementsRecus, facturesEmises, changements };
}

// ════════════════════════════════════════════════════════════════════════════
// BILAN HEBDO — la semaine écoulée + celle qui vient (calculé le lundi,
// consultable toute la semaine ; fenêtres 7 jours glissants, cohérent avec
// simulerRapportLundi)
// ════════════════════════════════════════════════════════════════════════════
export function construireBilanHebdo({ chantiers = [], factures = [], pointages = [], briefing = null, date } = {}) {
  const jour = date || jourISO();
  const finTs = new Date(jour + 'T23:59:59').getTime();
  const debutTs = finTs - 7 * 86400000;        // semaine écoulée
  const debutPrecTs = finTs - 14 * 86400000;   // semaine d'avant (comparaison)
  const dansFenetre = (dStr, a, b) => {
    if (!dStr) return false;
    const t = new Date(dStr + (dStr.length === 10 ? 'T12:00:00' : '')).getTime();
    return !isNaN(t) && t > a && t <= b;
  };

  // ── La semaine écoulée ─────────────────────────────────────────────────────
  const heuresFenetre = (a, b) => (pointages || [])
    .filter(p => dansFenetre(p.date, a, b))
    .reduce((s, p) => s + heuresProductives(p.repartitions), 0);
  const heuresSemaine = heuresFenetre(debutTs, finTs);
  const heuresSemainePrec = heuresFenetre(debutPrecTs, debutTs);

  const reelles = (factures || []).filter(estFactureReelle);
  const caEncaisseSemaine = reelles
    .flatMap(f => f.paiementsHistorique || [])
    .filter(p => dansFenetre(p.date, debutTs, finTs))
    .reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  const facturesEmisesSemaine = reelles.filter(f => dansFenetre(f.dateEmission, debutTs, finTs));
  const montantEmisSemaine = facturesEmisesSemaine.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);

  const chantiersFinis = (chantiers || []).filter(c => dansFenetre(c.dateFinTravaux, debutTs, finTs) || (dansFenetre(c.dateFin, debutTs, finTs) && (c.statut || '').trim().toLowerCase() === 'terminé'))
    .map(c => ({ nom: c.nom || c.numero, statut: c.statut }));

  // ── Les points durs ────────────────────────────────────────────────────────
  // Impayés ayant FRANCHI un seuil (30/45/75 j de retard) cette semaine.
  const SEUILS_RETARD = [75, 45, 30];
  const impayesVieillis = reelles
    .filter(f => ['envoyee', 'partielle', 'retard'].includes((f.statut || '').trim().toLowerCase()) && f.dateEcheance)
    .map(f => {
      const joursRetard = Math.floor((finTs - new Date(f.dateEcheance + 'T12:00:00').getTime()) / 86400000);
      const seuil = SEUILS_RETARD.find(s => joursRetard >= s && (joursRetard - 7) < s) || null;
      const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
      return { numero: f.numero || '—', joursRetard, seuil, restant };
    })
    .filter(x => x.seuil !== null && x.restant > 0)
    .sort((a, b) => b.restant - a.restant);

  // Chantiers en attente de paiement qui traînent (> 14 j depuis la fin des travaux).
  const attentesQuiTrainent = (chantiers || [])
    .filter(c => (c.statut || '').trim().toLowerCase() === 'attente paiement' && c.dateFinTravaux)
    .map(c => ({
      nom: c.nom || c.numero,
      jours: Math.floor((finTs - new Date(c.dateFinTravaux + 'T12:00:00').getTime()) / 86400000),
      resteDu: reelles.filter(f => String(f.chantierId) === String(c.id))
        .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0),
    }))
    .filter(x => x.jours > 14 && x.resteDu > 0.01)
    .sort((a, b) => b.resteDu - a.resteDu);

  // ── La semaine qui vient — réutilise les actions du matin (IA1, pas de doublon) ─
  const actionsSemaine = (briefing?.actionsAvantLundi || []).filter(a => a && (a.priorite === 'URGENT' || a.priorite === 'IMPORTANT')).slice(0, 5);

  return {
    date: jour,
    heuresSemaine: Math.round(heuresSemaine),
    heuresSemainePrec: Math.round(heuresSemainePrec),
    deltaHeuresPct: heuresSemainePrec > 0 ? Math.round(((heuresSemaine - heuresSemainePrec) / heuresSemainePrec) * 100) : null,
    caEncaisseSemaine: Math.round(caEncaisseSemaine),
    nbFacturesEmises: facturesEmisesSemaine.length,
    montantEmisSemaine: Math.round(montantEmisSemaine),
    chantiersFinis,
    impayesVieillis,
    attentesQuiTrainent,
    actionsSemaine,
  };
}

/** Rendez-vous à afficher par défaut : matin avant 14h, débrief ensuite. */
export const rendezVousParDefaut = (maintenant = new Date()) =>
  maintenant.getHours() < 14 ? 'matin' : 'soir';

export const _fmtN = fmtN; // ré-export pratique pour les composants du bloc
