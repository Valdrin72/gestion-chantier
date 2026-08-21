import React, { useState, useMemo } from 'react';
import { fmtN, calculerCoutsChantier, calculerCA, statutRentabilite, isChantierActif, heuresEmploye, getIntervallesPeriode, chantiersInPeriode, couleurMarge, SEUILS } from './donnees';
import { indicateursMargeChantier, caFactureHTDansPeriode } from './calculs/periode';
import { DS } from './ds';
import { joursReelsChantier } from './calculs/pointagesHelper';
import { useApp } from './context/AppContext';
import Statistiques from './Statistiques';
import Rapport from './Rapport';
import Marges from './Marges';
import { V1, mono, carteV1 } from './design/v1';

// ── REGROUPEMENT : 12 anciens sous-onglets → 4 VUES (aplatissement de navigation) ──
// Chaque ancien sous-onglet garde son CONTENU intact ; on ne change que le rangement.
// Config exportée → testable (garde-fou : aucun contenu orphelin).
export const VUES_ANALYSE = [
  { id: 'v_rentabilite', label: 'Rentabilité', sous: [
    { id: 'marges',      titre: 'Marges' },
    { id: 'rentabilite', titre: 'Rentabilité nette' },
    { id: 'chantiers',   titre: 'Prévu vs Réel' },
    { id: 'employes',    titre: 'Coût horaire' },
  ] },
  { id: 'v_type', label: 'Par type & surface', sous: [
    { id: 'corps',   titre: 'Corps de métier' },
    { id: 'metres2', titre: 'Analyse m²' },
  ] },
  { id: 'v_tendances', label: 'Tendances & objectifs', sous: [
    { id: 'projection',   titre: 'Projections' },
    { id: 'objectifs',    titre: 'Objectifs' },
    { id: 'statistiques', titre: 'Statistiques' },
    { id: 'rapport',      titre: 'Rapport hebdo' },
  ] },
  { id: 'v_clients', label: 'Clients', sous: [
    { id: 'clients', titre: 'Clients' },
    { id: 'derive',  titre: 'Dérive devis' },
  ] },
];

// En-tête de sous-section, affiché au-dessus de chaque ancien contenu dans une vue.
function SectionAnalyse({ titre }) {
  return (
    <div style={{ margin: '10px 0 14px', paddingBottom: 8, borderBottom: `2px solid ${V1.separation}` }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: V1.bleu, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{titre}</span>
    </div>
  );
}

export default function Analyse({ chantiers, clients, devis = [], parametres, setParametres, factures = [], periodeGlobale = 'annee' }) {
  const { pointages = [] } = useApp();
  const [vue, setVue] = useState('v_rentabilite');
  const sousVue = (VUES_ANALYSE.find(v => v.id === vue) || VUES_ANALYSE[0]).sous;
  const montre = (id) => sousVue.some(s => s.id === id);
  const [tauxChargesSociales, setTauxChargesSociales] = useState(parametres.parametres?.tauxChargesSociales || 25);
  const [tauxImpots, setTauxImpots] = useState(parametres.parametres?.tauxImpots || 15);
  const [tauxFraisGeneraux, setTauxFraisGeneraux] = useState(parametres.parametres?.tauxFraisGeneraux || 12);
  const [taxSaved, setTaxSaved] = useState(false);

  const couleurEcart = (pct) => {
    const v = parseFloat(pct);
    if (pct === null || pct === undefined || !Number.isFinite(v)) return '#10b981';
    return v <= 5 ? '#10b981' : v <= 15 ? '#f59e0b' : '#ef4444';
  };

  // ===== FILTRE PAR PÉRIODE GLOBALE (cohérent avec Dashboard et Statistiques) =====
  const chantiersPeriode = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return chantiers.filter(c => chantiersInPeriode(c, debut, fin));
  }, [chantiers, periodeGlobale]);

  // ===== CALCULS GLOBAUX — CA FACTURÉ HT + coûts prorata (cascade, seuil, % masse salariale) =====
  // Helper partagé unique (periode.js) → mêmes chiffres que Marges/Chantiers/Statistiques pour un même
  // chantier/période (démo année = 171'500). On NE touche PAS `chantiersPeriode` (conservé tel quel pour
  // les blocs restés sur le devisé et hors périmètre 4d : Prévu vs Réel, Dérive, Corps de métier,
  // Clients, Analyse m² — migration facturé prévue au lot 4e).
  const { caTotal, coutsTotal } = useMemo(() => {
    const cfg = parametres.parametres;
    const factures_ = chantiers
      .map(c => indicateursMargeChantier(c, parametres.employes, cfg, pointages, factures, periodeGlobale))
      .filter(ind => ind.caHT > 0);
    return {
      caTotal: factures_.reduce((t, ind) => t + ind.caHT, 0),
      coutsTotal: factures_.reduce((t, ind) => t + ind.couts, 0),
    };
  }, [chantiers, parametres.employes, parametres.parametres, pointages, factures, periodeGlobale]);
  const margeAvantCharges = caTotal - coutsTotal;
  // Coûts MO calculés avec coefficientMainOeuvre (1.0 si tarifs tout compris).
  // chargesSociales ici = estimation des charges non-MO (impôts, FG hors MO) — indicatif seulement.
  const chargesSocialesIndic = caTotal * (tauxChargesSociales / 100) * 0.3; // ~30% du CA en MO × taux → estimation
  const chargesSociales = chargesSocialesIndic; // affiché comme indicateur, non déduit doublement
  const fraisGeneraux = caTotal * (tauxFraisGeneraux / 100);
  const margeAvantImpots = margeAvantCharges - fraisGeneraux;
  const impots = margeAvantImpots > 0 ? margeAvantImpots * (tauxImpots / 100) : 0;
  const margeNette = margeAvantImpots - impots;
  const margeNettePct = caTotal > 0 ? Math.round((margeNette / caTotal) * 1000) / 10 : 0;

  // SEUIL DE RENTABILITÉ
  const chargesFixes = fraisGeneraux + (coutsTotal * 0.3);
  const tauxMargeContribution = caTotal > 0 ? ((caTotal - coutsTotal * 0.7) / caTotal) : 0;
  const seuilRentabilite = (caTotal > 0 && tauxMargeContribution > 0) ? chargesFixes / tauxMargeContribution : 0;

  // PROJECTION CA — ANNUELLE par nature (Option A) : CA FACTURÉ HT cumulé des mois écoulés de l'année
  // en cours. Ne suit PAS periodeGlobale (libellé « Année X » à l'écran).
  const { caRealise, moyenneMensuelle, projectionAnnuelle, moisRestants, caPrevisionnel, moisActuel } = useMemo(() => {
    const mois = new Date().getMonth();
    const annee = new Date().getFullYear();
    let ca = 0;
    for (let m = 0; m <= mois; m++) ca += caFactureHTDansPeriode(factures, 'mois', new Date(annee, m, 15));
    const moy = mois > 0 ? ca / (mois + 1) : ca;
    const restants = 11 - mois;
    return { caRealise: ca, moyenneMensuelle: moy, projectionAnnuelle: moy * 12, moisRestants: restants, caPrevisionnel: ca + moy * restants, moisActuel: mois };
  }, [factures]);

  // ===== DONNÉES PAR CHANTIER (filtrés par période) =====
  const donneesChantiers = useMemo(() => chantiersPeriode.map(c => {
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
    const montantTotal = calculerCA(c, devis); // null si aucun devis lié
    const caDisponible = montantTotal !== null;
    const heuresPrevu = (c.equipe || []).reduce((s, m) => s + (parseFloat(m.joursPlannifies) || 0) * 8, 0);
    const heuresRealise = (c.journal || []).flatMap(e => e.employes || []).reduce((s, e) => s + (parseFloat(e.heuresTravaillees) || 0), 0);
    const surface = parseFloat(c.surface) || 0;
    const joursPrevu = parseInt(c.nombreJours) || 0;
    const joursReelJournal = joursReelsChantier(pointages, c.id);
    const joursReel = joursReelJournal;

    const ecartBudget = couts.totalCoutsReel > 0 && couts.totalCoutsPrevu > 0
      ? Math.round(((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 1000) / 10
      : 0;

    const coutParHeure = heuresRealise > 0 ? Math.round(couts.totalCoutsReel / heuresRealise) : 0;
    const caParHeure = (caDisponible && heuresRealise > 0) ? Math.round(montantTotal / heuresRealise) : null;
    const coutParM2 = surface > 0 ? Math.round(couts.totalCoutsReel / surface) : 0;
    const caParM2 = (caDisponible && surface > 0) ? Math.round(montantTotal / surface) : null;
    const margeParM2 = (couts.margeReel !== null && surface > 0) ? Math.round(couts.margeReel / surface) : null;
    const ecartJours = joursPrevu > 0 ? Math.round(((joursReel - joursPrevu) / joursPrevu) * 1000) / 10 : 0;
    const tauxFacturation = heuresPrevu > 0 ? Math.round((heuresRealise / heuresPrevu) * 1000) / 10 : 0;

    const depassements = [];
    if (parseFloat(ecartBudget) > 10) depassements.push(`Budget dépassé de ${ecartBudget}%`);
    if (parseFloat(ecartJours) > 10) depassements.push(`Jours dépassés de ${ecartJours}%`);
    if (couts.margeActuellePct !== null && Number.isFinite(couts.margeActuellePct) && couts.margeActuellePct < SEUILS.margeLimite) depassements.push(`Marge critique ${couts.margeActuellePct}%`);

    return { ...c, couts, montantTotal, ecartBudget, coutParHeure, caParHeure, coutParM2, caParM2, margeParM2, ecartJours, tauxFacturation, heuresPrevu, heuresRealise, joursPrevu, joursReel, depassements };
  }), [chantiersPeriode, parametres.employes, parametres.localites, parametres.parametres, devis, pointages]);

  // ===== DONNÉES PAR EMPLOYÉ (filtrés par période) =====
  const donneesEmployes = useMemo(() => (parametres.employes || []).map(emp => {
    // Source unique : journal (cohérent avec calculerCoutsChantier)
    const joursTotal = chantiersPeriode.reduce((t, c) => {
      const heures = heuresEmploye(c.journal || [], emp.id);
      return t + heures / 8;
    }, 0);
    const heuresTotal = joursTotal * 8;
    const coeff = emp.tarifDejaCharge ? 1 : (parseFloat(parametres.parametres?.coefficientMainOeuvre) || 1.0);
    const coutTotal = joursTotal * (parseFloat(emp.tarifJour) || 0) * coeff;
    const caGenere = chantiersPeriode.reduce((t, c) => {
      const heures = heuresEmploye(c.journal || [], emp.id);
      if (heures === 0) return t;
      const pctJours = joursTotal > 0 ? (heures / 8) / joursTotal : 0;
      const ca = calculerCA(c, devis);
      return ca !== null ? t + (ca * pctJours) : t;
    }, 0);
    const coutHoraire = heuresTotal > 0 ? Math.round(coutTotal / heuresTotal) : 0;
    const productivite = coutTotal > 0 ? Math.round((caGenere / coutTotal) * 100) : 0;
    // chargesSoc = portion charges incluse dans le coefficient (pas ajoutée en plus — coeff déjà intègre les charges)
    const chargesSoc = emp.tarifDejaCharge ? 0 : joursTotal * (parseFloat(emp.tarifJour) || 0) * (coeff - 1);
    const coutReel = coutTotal; // coutTotal = brut × coeff inclut déjà les charges sociales

    return { ...emp, joursTotal, heuresTotal, coutTotal, caGenere, coutHoraire, productivite, chargesSoc, coutReel };
  }).filter(e => e.joursTotal > 0), [chantiersPeriode, parametres.employes, parametres.parametres, devis]);

  // ===== RENTABILITÉ PAR MÉTRÉ (uniquement chantiers avec devis, période filtrée) =====
  const donneesMetres = useMemo(() => parametres.typesTravaux.map(t => {
    const tous = chantiersPeriode.filter(c => (c.typesTravaux || []).includes(t.nom));
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const surface = avecDevis.reduce((s, c) => s + (parseFloat(c.surface) || 0), 0);
    const ca = avecDevis.reduce((s, c) => s + calculerCA(c, devis), 0);
    const couts = avecDevis.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages).totalCoutsReel, 0);
    const marge = ca - couts;
    const caParM2 = surface > 0 ? Math.round(ca / surface) : 0;
    const coutParM2 = surface > 0 ? Math.round(couts / surface) : 0;
    const margeParM2 = surface > 0 ? Math.round(marge / surface) : 0;
    const margePct = ca > 0 ? Math.round((marge / ca) * 1000) / 10 : 0;
    return { nom: t.nom, count: tous.length, nbAvecDevis: avecDevis.length, surface, ca, couts, marge, caParM2, coutParM2, margeParM2, margePct };
  }).filter(t => t.count > 0), [chantiersPeriode, parametres.typesTravaux, parametres.employes, parametres.localites, parametres.parametres, devis, pointages]);

  // ===== DONNÉES PAR CLIENT (uniquement chantiers avec devis pour CA/marge, période filtrée) =====
  const donneesClients = useMemo(() => clients.map(cl => {
    const tous = chantiersPeriode.filter(c => String(c.clientId) === String(cl.id));
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const cs = avecDevis; // alias pour clarté
    const ca = cs.reduce((t, c) => t + calculerCA(c, devis), 0);
    const couts = cs.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages).totalCoutsReel, 0);
    const marge = ca - couts;
    const margePct = ca > 0 ? Math.round((marge / ca) * 1000) / 10 : 0;
    const enCours = tous.filter(isChantierActif).length;
    const termines = tous.filter(c => c.statut?.trim().toLowerCase() === 'terminé').length;
    return { ...cl, nbChantiers: tous.length, nbAvecDevis: avecDevis.length, ca, couts, marge, margePct, enCours, termines };
  }).filter(cl => cl.nbChantiers > 0).sort((a, b) => b.ca - a.ca), [clients, chantiersPeriode, parametres, devis, pointages]);

  // ===== OBJECTIFS =====
  const chargerObjectifs = () => {
    try { const d = localStorage.getItem('cyna_objectifs'); return d ? JSON.parse(d) : null; } catch { return null; }
  };
  const [objectifs, setObjectifsState] = useState(() => chargerObjectifs() || {
    caAnnuel: Math.round(caTotal * 1.15) || 500000,
    margeCible: 20,
    nbChantiers: chantiers.length + 5 || 20,
  });
  const setObjectifs = (data) => {
    setObjectifsState(data);
    try { localStorage.setItem('cyna_objectifs', JSON.stringify(data)); } catch {}
  };

  // ===== DÉRIVE DEVIS → RÉALITÉ PAR TYPE DE TRAVAUX (période filtrée) =====
  const donneesDerive = useMemo(() => parametres.typesTravaux.map(t => {
    const chantiersDuType = chantiersPeriode.filter(c =>
      (c.typesTravaux || []).includes(t.nom) && calculerCA(c, devis) !== null
    );
    if (chantiersDuType.length === 0) return null;

    const lignes = chantiersDuType.map(c => {
      const joursPrevu  = parseInt(c.nombreJours) || 0;
      const joursReel   = joursReelsChantier(pointages, c.id);
      const couts       = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
      const ca          = calculerCA(c, devis);
      const coutsPrevu  = couts.totalCoutsPrevu;
      const coutsReel   = couts.totalCoutsReel;
      const margePrevuPct = ca > 0 && coutsPrevu > 0 ? ((ca - coutsPrevu) / ca) * 100 : null;
      const margeReelPct  = ca > 0 && coutsReel  > 0 ? ((ca - coutsReel)  / ca) * 100 : null;
      const ecartJours    = joursPrevu > 0 ? ((joursReel - joursPrevu) / joursPrevu) * 100 : null;
      const ecartCout     = coutsPrevu > 0 ? ((coutsReel - coutsPrevu) / coutsPrevu) * 100 : null;
      return { c, joursPrevu, joursReel, coutsPrevu, coutsReel, ca, margePrevuPct, margeReelPct, ecartJours, ecartCout };
    }).filter(l => l.joursPrevu > 0 || l.coutsPrevu > 0);

    if (lignes.length === 0) return null;

    const avg = (arr, key) => { const v = arr.filter(l => l[key] !== null); return v.length ? v.reduce((s,l) => s + l[key], 0) / v.length : null; };

    const ecartJoursMoyen  = avg(lignes, 'ecartJours');
    const ecartCoutMoyen   = avg(lignes, 'ecartCout');
    const margePrevuMoyenne = avg(lignes, 'margePrevuPct');
    const margeReelMoyenne  = avg(lignes, 'margeReelPct');
    const perteMarge        = margePrevuMoyenne !== null && margeReelMoyenne !== null ? margeReelMoyenne - margePrevuMoyenne : null;

    const signal = (() => {
      if (ecartJoursMoyen === null && ecartCoutMoyen === null) return 'inconnu';
      const ecartRef = ecartCoutMoyen ?? ecartJoursMoyen;
      if (ecartRef > 20)  return 'sousEstime';
      if (ecartRef > 5)   return 'attention';
      if (ecartRef < -10) return 'surEstime';
      return 'ok';
    })();

    return { nom: t.nom, count: lignes.length, lignes, ecartJoursMoyen, ecartCoutMoyen, margePrevuMoyenne, margeReelMoyenne, perteMarge, signal };
  }).filter(Boolean).sort((a, b) => (b.ecartCoutMoyen ?? 0) - (a.ecartCoutMoyen ?? 0)), [chantiersPeriode, devis, parametres, pointages]);

  return (
    <div>
      <div className="page-title-main" style={{ marginBottom: 24 }}>Analyse financière avancée</div>

      {/* VUES (4) — sous-onglets v1 (actif bleu CYNA plein), défilables sur mobile */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 25, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {VUES_ANALYSE.map(v => {
          const actif = vue === v.id;
          return (
            <button key={v.id} onClick={() => setVue(v.id)} style={{
              background: actif ? V1.bleu : 'transparent',
              color: actif ? '#fff' : V1.texteMuted,
              border: `1px solid ${actif ? V1.bleu : V1.separation}`,
              borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: actif ? 700 : 600, whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}>{v.label}</button>
          );
        })}
      </div>

      {/* ===== RENTABILITÉ NETTE ===== */}
      {montre('rentabilite') && <SectionAnalyse titre="Rentabilité nette" />}
      {montre('rentabilite') && (
        <div>
          {/* PARAMÈTRES */}
          <div style={carteV1}>
            <div className="ds-card-title">Paramètres fiscaux et sociaux</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              {[
                { label: 'Charges sociales (%)', val: tauxChargesSociales, set: setTauxChargesSociales },
                { label: 'Frais généraux (%)', val: tauxFraisGeneraux, set: setTauxFraisGeneraux },
                { label: 'Taux d\'imposition (%)', val: tauxImpots, set: setTauxImpots },
              ].map(s => (
                <div key={s.label}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>{s.label}</label>
                  <input type="number" value={s.val} onChange={e => { s.set(parseFloat(e.target.value) || 0); setTaxSaved(false); }}
                    style={{ padding: '10px', borderRadius: '8px', border: '2px solid #0d3d6e', fontSize: '16px', fontWeight: 'bold', width: '100%', color: '#0d3d6e', background: 'var(--bg-input)' }} />
                </div>
              ))}
            </div>
            {setParametres && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => {
                  setParametres({ ...parametres, parametres: { ...parametres.parametres, tauxChargesSociales, tauxFraisGeneraux, tauxImpots } });
                  setTaxSaved(true);
                }} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                  Enregistrer les paramètres
                </button>
                {taxSaved && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Sauvegardé</span>}
              </div>
            )}
          </div>

          {/* CASCADE DE RENTABILITÉ */}
          <div style={carteV1}>
            <div className="ds-card-title">Cascade de rentabilité</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Chiffre d\'affaires facturé', val: caTotal, pct: 100, couleur: V1.ok, bg: 'rgba(30,138,76,0.08)', bold: false, big: false },
                { label: 'Coûts directs chantiers', val: -coutsTotal, pct: caTotal > 0 ? -(Math.round((coutsTotal / caTotal) * 1000) / 10) : 0, couleur: V1.danger, bg: 'rgba(192,57,43,0.08)', bold: false, big: false },
                { label: '= Marge brute', val: margeAvantCharges, pct: caTotal > 0 ? Math.round((margeAvantCharges / caTotal) * 1000) / 10 : 0, couleur: margeAvantCharges >= 0 ? V1.ok : V1.danger, bg: 'var(--bg-hover)', bold: true, big: false },
                { label: 'Charges sociales', val: -chargesSociales, pct: caTotal > 0 ? -(Math.round((chargesSociales / caTotal) * 1000) / 10) : 0, couleur: V1.warn, bg: 'rgba(232,145,43,0.08)', bold: false, big: false },
                { label: 'Frais généraux', val: -fraisGeneraux, pct: caTotal > 0 ? -(Math.round((fraisGeneraux / caTotal) * 1000) / 10) : 0, couleur: V1.warn, bg: 'rgba(232,145,43,0.08)', bold: false, big: false },
                { label: '= Résultat avant impôts', val: margeAvantImpots, pct: caTotal > 0 ? Math.round((margeAvantImpots / caTotal) * 1000) / 10 : 0, couleur: margeAvantImpots >= 0 ? V1.ok : V1.danger, bg: 'var(--bg-hover)', bold: true, big: false },
                { label: 'Impôts estimés', val: -impots, pct: caTotal > 0 ? -(Math.round((impots / caTotal) * 1000) / 10) : 0, couleur: V1.danger, bg: 'rgba(192,57,43,0.08)', bold: false, big: false },
                { label: '= MARGE NETTE', val: margeNette, pct: margeNettePct, couleur: margeNette >= 0 ? V1.ok : V1.danger, bg: margeNette >= 0 ? 'rgba(30,138,76,0.12)' : 'rgba(192,57,43,0.10)', bold: true, big: true },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: s.big ? '18px 20px' : '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: s.bold ? `2px solid ${s.couleur}` : `1px solid ${V1.separation}` }}>
                  <div style={{ fontWeight: s.bold ? 'bold' : 'normal', fontSize: s.big ? '16px' : '14px', color: s.bold ? s.couleur : V1.texte }}>{s.label}</div>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ ...mono(s.big ? 22 : 16, s.couleur, 700) }}>
                      CHF {fmtN(Math.abs(s.val))}
                    </div>
                    <div style={{ ...mono(13, s.couleur, 600), background: s.couleur + '18', padding: '3px 12px', borderRadius: '12px', minWidth: '60px', textAlign: 'center' }}>
                      {s.pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEUIL DE RENTABILITÉ */}
          <div style={carteV1}>
            <div className="ds-card-title">Seuil de rentabilité</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Seuil de rentabilité', val: `CHF ${fmtN(Math.round(seuilRentabilite))}`, couleur: V1.warn, desc: 'CA facturé minimum à réaliser' },
                { label: 'CA facturé actuel', val: `CHF ${fmtN(Math.round(caTotal))}`, couleur: caTotal >= seuilRentabilite ? V1.ok : V1.danger, desc: caTotal >= seuilRentabilite ? 'Au-dessus du seuil' : 'En dessous du seuil' },
                { label: 'Écart au seuil', val: `CHF ${fmtN(Math.abs(Math.round(caTotal - seuilRentabilite)))}`, couleur: caTotal >= seuilRentabilite ? V1.ok : V1.danger, desc: caTotal >= seuilRentabilite ? 'Marge de sécurité' : 'Manque à combler' },
              ].map(s => (
                <div key={s.label} style={{ ...carteV1, borderTop: `3px solid ${s.couleur}`, padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: V1.texteMuted }}>{s.label}</div>
                  <div style={{ ...mono(22, s.couleur, 700), margin: '8px 0' }}>{s.val}</div>
                  <div style={{ fontSize: '12px', color: V1.texteMuted }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== DÉRIVE DEVIS → RÉALITÉ ===== */}
      {montre('derive') && <SectionAnalyse titre="Dérive du devisé" />}
      {montre('derive') && (
        <div>
          {/* Intro */}
          <div style={{ background: V1.bleuFond, border: `1px solid ${V1.bleu}33`, borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: 13, color: V1.texteMuted }}>
            <strong style={{ color: V1.texte }}>Sur quels types de travaux sous-estimes-tu systématiquement ?</strong>
            {' '}Cette analyse compare ce que tu as devisé avec ce qui s'est réellement passé sur chaque type de chantier.
          </div>

          {donneesDerive.length === 0 ? (
            <div style={{ ...carteV1, textAlign: 'center', color: V1.texteMuted, padding: 40 }}>
              Pas encore assez de données — commence par relier tes chantiers à des devis.
            </div>
          ) : (
            <>
              {/* Résumé global */}
              {(() => {
                const sousEstimes = donneesDerive.filter(d => d.signal === 'sousEstime');
                const pireType = donneesDerive[0];
                if (!pireType) return null;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {[
                      { label: 'Types analysés', val: donneesDerive.length, couleur: V1.bleu, sub: `${donneesDerive.reduce((s,d) => s + d.count, 0)} chantiers` },
                      { label: 'Sous-estimés', val: sousEstimes.length, couleur: V1.danger, sub: sousEstimes.length > 0 ? sousEstimes.map(d => d.nom).join(', ') : 'Aucun' },
                      { label: 'Plus grande dérive', val: pireType.nom, couleur: V1.warn, sub: Number.isFinite(pireType.ecartCoutMoyen) ? `+${Math.round(pireType.ecartCoutMoyen)}% coût réel` : '—' },
                      { label: 'Perte de marge moy.', val: Number.isFinite(pireType.perteMarge) ? `${Math.round(pireType.perteMarge * 10) / 10}%` : '—', couleur: Number.isFinite(pireType.perteMarge) && pireType.perteMarge < -3 ? V1.danger : V1.ok, sub: 'sur le type le + déviant' },
                    ].map(k => (
                      <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}`, padding: '16px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: V1.texteMuted, marginBottom: 8 }}>{k.label}</div>
                        <div style={{ ...mono(18, k.couleur, 700), lineHeight: 1.1, wordBreak: 'break-word' }}>{k.val}</div>
                        <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 4 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tableau par type */}
              {donneesDerive.map(d => {
                const signalCfg = {
                  sousEstime: { couleur: V1.danger, bg: V1.danger + '10', label: 'Sous-estimé',   conseil: 'Augmente tes prix ou réduis la durée estimée sur ce type.' },
                  attention:  { couleur: V1.warn, bg: V1.warn + '10', label: 'À surveiller',  conseil: 'Légère tendance à dépasser — surveille les prochains devis.' },
                  surEstime:  { couleur: V1.ok, bg: V1.ok + '10', label: 'Sur-estimé',    conseil: 'Tu es conservateur — tu peux affiner tes prix pour être plus compétitif.' },
                  ok:         { couleur: V1.ok, bg: V1.ok + '10', label: 'Bien estimé',    conseil: 'Bonne maîtrise de ce type de chantier.' },
                  inconnu:    { couleur: V1.texteMuted, bg: V1.texteMuted + '10', label: 'Données insuffisantes', conseil: 'Ajoute plus de chantiers liés à des devis.' },
                }[d.signal];
                const fmtPct  = (v, plus = true) => v === null ? '—' : `${plus && v > 0 ? '+' : ''}${Math.round(v * 10) / 10}%`;
                const fmtJours = (v) => v === null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)}%`;
                return (
                  <div key={d.nom} style={{ ...carteV1, marginBottom: 16, borderLeft: `4px solid ${signalCfg.couleur}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: V1.texte }}>{d.nom}</div>
                        <div style={{ fontSize: 12, color: V1.texteMuted, marginTop: 2 }}>{d.count} chantier{d.count > 1 ? 's' : ''} analysé{d.count > 1 ? 's' : ''}</div>
                      </div>
                      <span style={{ ...mono(12, signalCfg.couleur, 700), background: signalCfg.bg, border: `1px solid ${signalCfg.couleur}35`, borderRadius: 20, padding: '5px 14px' }}>
                        {signalCfg.label}
                      </span>
                    </div>

                    {/* 4 métriques */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                      {[
                        { label: 'Dérive durée',   val: fmtJours(d.ecartJoursMoyen),  couleur: d.ecartJoursMoyen !== null && d.ecartJoursMoyen > 15 ? V1.danger : d.ecartJoursMoyen !== null && d.ecartJoursMoyen > 5 ? V1.warn : V1.ok, sub: 'jours réels vs prévus' },
                        { label: 'Dérive coût',    val: fmtPct(d.ecartCoutMoyen),     couleur: d.ecartCoutMoyen !== null && d.ecartCoutMoyen > 15 ? V1.danger : d.ecartCoutMoyen !== null && d.ecartCoutMoyen > 5 ? V1.warn : V1.ok,    sub: 'coût réel vs prévu' },
                        { label: 'Marge devisée',  val: fmtPct(d.margePrevuMoyenne, false), couleur: V1.bleu, sub: 'marge prévue moyenne' },
                        { label: 'Marge réelle',   val: fmtPct(d.margeReelMoyenne, false),  couleur: d.margeReelMoyenne !== null && d.margeReelMoyenne < 10 ? V1.danger : d.margeReelMoyenne !== null && d.margeReelMoyenne < 20 ? V1.warn : V1.ok, sub: 'marge réelle moyenne' },
                      ].map(m => (
                        <div key={m.label} style={{ ...DS.cardInset, padding: '12px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: V1.texteMuted, marginBottom: 6 }}>{m.label}</div>
                          <div style={{ ...mono(18, m.couleur, 700) }}>{m.val}</div>
                          <div style={{ fontSize: 10, color: V1.texteMuted, marginTop: 3 }}>{m.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Conseil */}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--ds-card-inset-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--ds-card-inset-border)', borderLeft: `3px solid ${signalCfg.couleur}50` }}>
                      {signalCfg.conseil}
                    </div>

                    {/* Détail par chantier */}
                    {d.lignes.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Détail par chantier</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {d.lignes.map(l => (
                            <div key={l.c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--ds-card-inset-bg)', borderRadius: 8, border: '1px solid var(--ds-card-inset-border)', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: V1.texte, flex: 1, minWidth: 120 }}>{l.c.nom || l.c.numero}</span>
                              <span style={{ ...mono(11, V1.texteMuted), minWidth: 80 }}>{l.joursPrevu}j → {l.joursReel}j{l.ecartJours !== null ? <span style={{ color: l.ecartJours > 15 ? V1.danger : V1.texteMuted, fontWeight: 700 }}> ({l.ecartJours > 0 ? '+' : ''}{Math.round(l.ecartJours)}%)</span> : ''}</span>
                              {l.margeReelPct !== null && (
                                <span style={{ ...mono(11, l.margeReelPct < 10 ? V1.danger : l.margeReelPct < 20 ? V1.warn : V1.ok, 700) }}>
                                  Marge {Math.round(l.margeReelPct * 10) / 10}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ===== PRÉVU VS RÉEL ===== */}
      {montre('chantiers') && <SectionAnalyse titre="Prévu vs Réel" />}
      {montre('chantiers') && (
        <div>
          {/* ALERTES DÉPASSEMENTS */}
          {donneesChantiers.filter(c => c.depassements.length > 0).length > 0 && (
            <div className="alert-banner alert-banner-danger" style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>Dépassements détectés</div>
              {donneesChantiers.filter(c => c.depassements.length > 0).map(c => (
                <div key={c.id} style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
                  <strong>{c.nom}</strong> : {c.depassements.join(' · ')}
                </div>
              ))}
            </div>
          )}

          <div style={{ ...carteV1, overflowX: 'auto' }}>
            <div className="ds-card-title">Comparaison Devisé vs Réel par chantier</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              La colonne « Devisé » est le montant du devis (chiffrage initial), à ne pas confondre avec le CA facturé des autres blocs. Mesure la précision d'estimation.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Chantier', 'Devisé', 'Coût prévu', 'Coût réel', 'Écart budget', 'Marge réelle', 'Jours prévus', 'Jours réels', 'Écart jours'].map(h => (
                    <th key={h} style={DS.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donneesChantiers.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{c.nom}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.statut}</div>
                    </td>
                    <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{c.montantTotal !== null ? `CHF ${fmtN(c.montantTotal)}` : '—'}</td>
                    <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>CHF {fmtN(c.couts.totalCoutsPrevu)}</td>
                    <td style={{ padding: '10px 12px', ...mono(13, V1.texte, 700) }}>CHF {fmtN(c.couts.totalCoutsReel)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ ...mono(12, couleurEcart(c.ecartBudget), 600), background: couleurEcart(c.ecartBudget) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                        {parseFloat(c.ecartBudget) > 0 ? '+' : ''}{c.ecartBudget}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ ...mono(12, couleurMarge(c.couts.margeActuellePct), 600), background: couleurMarge(c.couts.margeActuellePct) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                        {c.couts.margeActuellePct !== null ? `${c.couts.margeActuellePct}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{c.joursPrevu}j</td>
                    <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{Math.round(c.joursReel * 10) / 10}j</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ ...mono(12, couleurEcart(Math.abs(c.ecartJours)), 600), background: couleurEcart(Math.abs(c.ecartJours)) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                        {parseFloat(c.ecartJours) > 0 ? '+' : ''}{c.ecartJours}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HEURES */}
          <div style={{ ...carteV1, overflowX: 'auto' }}>
            <div className="ds-card-title">Heures travaillées vs facturées</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Chantier', 'Heures prévues', 'Heures réalisées', 'Taux facturation', 'Coût/heure', 'CA/heure', 'Marge/heure'].map(h => (
                    <th key={h} style={DS.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donneesChantiers.filter(c => c.heuresPrevu > 0 || c.heuresRealise > 0).map((c, i) => {
                  const margeParHeure = c.heuresRealise > 0 && c.couts.margeReel != null ? Math.round(c.couts.margeReel / c.heuresRealise) : null;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                      <td style={{ padding: '10px 12px' }}><strong style={{ color: V1.texte }}>{c.nom}</strong></td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{c.heuresPrevu}h</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte, 700) }}>{c.heuresRealise}h</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ ...mono(12, parseFloat(c.tauxFacturation) >= 90 ? V1.ok : V1.warn, 600), background: (parseFloat(c.tauxFacturation) >= 90 ? V1.ok : V1.warn) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                          {c.tauxFacturation}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>CHF {c.coutParHeure}/h</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte, 700) }}>CHF {c.caParHeure}/h</td>
                      <td style={{ padding: '10px 12px', ...mono(13, margeParHeure === null ? V1.texteMuted : margeParHeure >= 0 ? V1.ok : V1.danger, 700) }}>{margeParHeure === null ? '—' : `CHF ${margeParHeure}/h`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== COÛT HORAIRE EMPLOYÉS ===== */}
      {montre('employes') && <SectionAnalyse titre="Coût horaire" />}
      {montre('employes') && (
        <div>
          <div style={{ ...carteV1, overflowX: 'auto' }}>
            <div className="ds-card-title">Coût réel par employé</div>
            {donneesEmployes.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Aucun employé affecté à des chantiers</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Employé', 'Poste', 'Jours', 'Heures', 'Coût brut', 'Charges sociales', 'Coût total réel', 'Coût/heure', 'Productivité'].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donneesEmployes.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 'bold', marginRight: '8px', fontSize: '14px' }}>
                          {e.nom.charAt(0)}
                        </div>
                        <strong style={{ color: 'var(--text-primary)' }}>{e.nom}</strong>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: V1.texte }}>{e.poste}</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{e.joursTotal}j</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>{e.heuresTotal}h</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.texte) }}>CHF {fmtN(e.coutTotal)}</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.warn) }}>CHF {fmtN(Math.round(e.chargesSoc))}</td>
                      <td style={{ padding: '10px 12px', ...mono(13, V1.danger, 700) }}>CHF {fmtN(Math.round(e.coutReel))}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ ...mono(12, V1.bleu, 600), background: V1.bleu + '18', padding: '3px 10px', borderRadius: '12px' }}>
                          CHF {e.coutHoraire}/h
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ ...mono(12, parseFloat(e.productivite) >= 150 ? V1.ok : parseFloat(e.productivite) >= 100 ? V1.warn : V1.danger, 600), background: (parseFloat(e.productivite) >= 150 ? V1.ok : parseFloat(e.productivite) >= 100 ? V1.warn : V1.danger) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                          {e.productivite}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* RÉSUMÉ MASSE SALARIALE */}
          <div style={carteV1}>
            <div className="ds-card-title">Masse salariale totale</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Salaires bruts', val: `CHF ${fmtN(donneesEmployes.reduce((t, e) => t + e.coutTotal, 0))}`, couleur: V1.ok },
                { label: 'Charges sociales', val: `CHF ${fmtN(Math.round(donneesEmployes.reduce((t, e) => t + e.chargesSoc, 0)))}`, couleur: V1.warn },
                { label: 'Coût total RH', val: `CHF ${fmtN(Math.round(donneesEmployes.reduce((t, e) => t + e.coutReel, 0)))}`, couleur: V1.danger },
                { label: '% du CA facturé', val: `${caTotal > 0 ? Math.round((donneesEmployes.reduce((t, e) => t + e.coutReel, 0) / caTotal) * 1000) / 10 : 0}%`, couleur: V1.bleu },
              ].map(s => (
                <div key={s.label} style={{ ...carteV1, borderTop: `3px solid ${s.couleur}`, padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: V1.texteMuted }}>{s.label}</div>
                  <div style={{ ...mono(20, s.couleur, 700), marginTop: '5px' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== PAR MÉTRÉ ===== */}
      {montre('corps') && <SectionAnalyse titre="Corps de métier" />}
      {montre('corps') && (
        <div style={{ ...carteV1, overflowX: 'auto' }}>
          <div className="ds-card-title">Rentabilité par type de travaux (CHF/m²)</div>
          {donneesMetres.length === 0 ? (
            <p style={{ color: V1.texteMuted }}>Aucune donnée disponible</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                <thead>
                  <tr>
                    {['Type travaux', 'Chantiers', 'Surface', 'CA signé/m²', 'Coût/m²', 'Marge/m²', 'Marge %', 'Statut'].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donneesMetres.sort((a, b) => parseFloat(b.margePct) - parseFloat(a.margePct)).map((t) => (
                    <tr key={t.nom} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                      <td style={{ padding: '12px 15px' }}><strong style={{ color: V1.texte }}>{t.nom}</strong></td>
                      <td style={{ padding: '12px 15px', ...mono(13, V1.texte) }}>{t.count}</td>
                      <td style={{ padding: '12px 15px', ...mono(13, V1.texte) }}>{t.surface} m²</td>
                      <td style={{ padding: '12px 15px', ...mono(13, V1.texte, 700) }}>CHF {t.caParM2}/m²</td>
                      <td style={{ padding: '12px 15px', ...mono(13, V1.texte) }}>CHF {t.coutParM2}/m²</td>
                      <td style={{ padding: '12px 15px', ...mono(13, parseFloat(t.margeParM2) >= 0 ? V1.ok : V1.danger, 700) }}>
                        CHF {t.margeParM2}/m²
                      </td>
                      <td style={{ padding: '12px 15px' }}>
                        <span style={{ ...mono(12, couleurMarge(t.margePct), 600), background: couleurMarge(t.margePct) + '18', padding: '3px 10px', borderRadius: '12px' }}>
                          {t.margePct}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 15px', color: V1.texte }}>
                        {parseFloat(t.margePct) >= 20 ? 'Excellent' : parseFloat(t.margePct) >= 15 ? 'Correct' : 'Critique'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOP 3 */}
              <div className="ds-section-label" style={{ marginTop: 20 }}>Classement rentabilité</div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                {donneesMetres.sort((a, b) => parseFloat(b.margePct) - parseFloat(a.margePct)).slice(0, 3).map((t, i) => {
                  const c = couleurMarge(t.margePct);
                  return (
                    <div key={t.nom} style={{ ...carteV1, borderTop: `3px solid ${c}`, padding: '20px', flex: 1, minWidth: 160, textAlign: 'center' }}>
                      <div style={{ ...mono(14, V1.texteMuted, 700), marginBottom: '8px' }}>{['1er', '2e', '3e'][i]}</div>
                      <div style={{ fontWeight: 700, color: V1.texte }}>{t.nom}</div>
                      <div style={{ ...mono(22, c, 700), marginTop: '4px' }}>{t.margePct}%</div>
                      <div style={{ ...mono(12, V1.texteMuted), marginTop: '3px' }}>CHF {t.margeParM2}/m²</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== PROJECTIONS ===== */}
      {montre('projection') && <SectionAnalyse titre="Projections" />}
      {montre('projection') && (
        <div>
          <div style={carteV1}>
            <div className="ds-card-title">Projections CA facturé — Année {new Date().getFullYear()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
              {[
                { label: 'CA facturé réalisé', val: `CHF ${fmtN(Math.round(caRealise))}`, couleur: V1.ok, desc: `${moisActuel + 1} mois` }, // eslint-disable-line no-undef
                { label: 'Moyenne/mois', val: `CHF ${fmtN(Math.round(moyenneMensuelle))}`, couleur: V1.ok, desc: 'Tendance actuelle' },
                { label: 'Projection annuelle', val: `CHF ${fmtN(Math.round(projectionAnnuelle))}`, couleur: V1.bleu, desc: 'Sur 12 mois' },
                { label: 'CA facturé prévisionnel', val: `CHF ${fmtN(Math.round(caPrevisionnel))}`, couleur: V1.warn, desc: `Réalisé + ${moisRestants} mois prévus` },
              ].map(s => (
                <div key={s.label} style={{ ...carteV1, borderTop: `3px solid ${s.couleur}`, padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: V1.texteMuted, marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ ...mono(18, s.couleur, 700), margin: '0 0 4px' }}>{s.val}</div>
                  <div style={{ fontSize: '11px', color: V1.texteMuted }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* PROJECTION MARGE NETTE */}
            <div className="ds-section-label" style={{ marginTop: 20 }}>Projection marge nette annuelle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              {[
                { scenario: 'Pessimiste (-20%)', ca: projectionAnnuelle * 0.8 },
                { scenario: 'Réaliste', ca: projectionAnnuelle },
                { scenario: 'Optimiste (+20%)', ca: projectionAnnuelle * 1.2 },
              ].map((s, i) => {
                const couts = s.ca * (caTotal > 0 ? coutsTotal / caTotal : 0.6);
                const chargesSoc = couts * (tauxChargesSociales / 100);
                const fraisGen = s.ca * (tauxFraisGeneraux / 100);
                const avantImpots = s.ca - couts - chargesSoc - fraisGen;
                const imp = avantImpots > 0 ? avantImpots * (tauxImpots / 100) : 0;
                const nette = avantImpots - imp;
                const pct = s.ca > 0 ? Math.round((nette / s.ca) * 1000) / 10 : 0;
                const couleurs = [V1.danger, V1.ok, V1.ok];
                return (
                  <div key={s.scenario} style={{ ...carteV1, borderTop: `3px solid ${couleurs[i]}`, padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: couleurs[i], marginBottom: '10px' }}>{s.scenario}</div>
                    <div style={{ fontSize: '13px', color: V1.texteMuted }}>CA facturé projeté</div>
                    <div style={{ ...mono(18, couleurs[i], 700) }}>CHF {fmtN(Math.round(s.ca))}</div>
                    <div style={{ margin: '10px 0', borderTop: `1px solid ${V1.separation}`, paddingTop: '10px' }}>
                      <div style={{ fontSize: '13px', color: V1.texteMuted }}>Marge nette</div>
                      <div style={{ ...mono(22, nette >= 0 ? V1.ok : V1.danger, 700) }}>CHF {fmtN(Math.round(nette))}</div>
                      <div style={{ ...mono(14, nette >= 0 ? V1.ok : V1.danger) }}>({pct}%)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== CLIENTS ===== */}
      {montre('clients') && <SectionAnalyse titre="Clients" />}
      {montre('clients') && (
        <div>
          {donneesClients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ fontSize: 32, color: "var(--text-muted)" }}>—</div>
              <div className="empty-state-title">Aucun client avec données</div>
              <div className="empty-state-sub">Associez des clients à vos chantiers pour voir leur rentabilité</div>
            </div>
          ) : (
            <>
              {/* KPIs clients */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Clients actifs', val: donneesClients.length, couleur: V1.bleu },
                  { label: 'Meilleur CA signé', val: `CHF ${fmtN(Math.round(donneesClients[0]?.ca || 0))}`, couleur: V1.ok },
                  { label: 'Marge moy.', val: `${Math.round((donneesClients.reduce((t,c)=>t+parseFloat(c.margePct||0),0)/donneesClients.length) * 10) / 10}%`, couleur: V1.bleuMoyen },
                  { label: 'Chantiers total', val: donneesClients.reduce((t,c)=>t+c.nbChantiers,0), couleur: V1.warn },
                ].map(s => (
                  <div key={s.label} style={{ ...carteV1, borderTop: `3px solid ${s.couleur}`, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: V1.texteMuted, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ ...mono(20, s.couleur, 700) }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Podium top 3 */}
              <div style={carteV1}>
                <div className="ds-card-title">Top clients par CA signé</div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                  {donneesClients.slice(0, 3).map((cl, i) => {
                    const rangCouleur = [V1.warn, V1.bleuMoyen, V1.bleuClair][i];
                    const medailles = ['1er', '2e', '3e'];
                    const r = statutRentabilite(cl.margePct);
                    return (
                      <div key={cl.id} style={{ flex: 1, minWidth: 180,
                        ...carteV1, borderTop: `3px solid ${rangCouleur}`, padding: '20px', textAlign: 'center' }}>
                        <div style={{ ...mono(20, rangCouleur, 700), marginBottom: 4 }}>{medailles[i]}</div>
                        <div style={{ fontWeight: 700, color: V1.texte, marginBottom: 2 }}>{cl.nom}</div>
                        <div style={{ ...mono(18, V1.texte, 700) }}>CHF {fmtN(Math.round(cl.ca))}</div>
                        <div style={{ fontSize: 11, color: V1.texteMuted, margin: '4px 0' }}>{cl.nbChantiers} chantier{cl.nbChantiers > 1 ? 's' : ''}</div>
                        <span style={{ ...mono(11, r.couleur, 700), background: r.couleur + '22', border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '2px 10px' }}>{r.label} {cl.margePct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Tableau tous clients */}
                <table className="table-cards" style={{ width: '100%' }}>
                  <thead><tr>
                    {['Rang', 'Client', 'Chantiers', 'CA signé total', 'Coûts', 'Marge %', 'Gain CHF', 'Statut'].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {donneesClients.map((cl, i) => {
                      const r = statutRentabilite(cl.margePct);
                      return (
                        <tr key={cl.id} className="ds-animate-in" style={{ animationDelay: `${i * 30}ms` }}>
                          <td style={DS.td}><span style={{ ...mono(13, V1.texteMuted, 700) }}>#{i+1}</span></td>
                          <td style={{ ...DS.td, fontWeight: 700, color: V1.texte }}>{cl.nom}</td>
                          <td style={{ ...DS.td, ...mono(13, V1.texte) }}>{cl.nbChantiers} ({cl.enCours} en cours)</td>
                          <td style={{ ...DS.td, ...mono(13, V1.texte, 700) }}>CHF {fmtN(Math.round(cl.ca))}</td>
                          <td style={{ ...DS.td, ...mono(13, V1.texteMuted) }}>CHF {fmtN(Math.round(cl.couts))}</td>
                          <td style={{ ...DS.td, ...mono(13, r.couleur, 700) }}>{cl.margePct}%</td>
                          <td style={{ ...DS.td, ...mono(13, cl.marge >= 0 ? V1.ok : V1.danger, 600) }}>CHF {fmtN(Math.round(cl.marge))}</td>
                          <td style={DS.td}>
                            <span style={{ ...mono(11, r.couleur, 700), background: r.couleur + '22', border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '3px 10px' }}>{r.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== OBJECTIFS ===== */}
      {montre('objectifs') && <SectionAnalyse titre="Objectifs" />}
      {montre('objectifs') && (
        <div>
          {/* Saisie objectifs */}
          <div style={carteV1}>
            <div className="ds-card-title">Définir les objectifs annuels</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 20 }}>
              {[
                { label: 'CA facturé annuel cible (CHF)', key: 'caAnnuel', type: 'number' },
                { label: 'Marge nette cible (%)', key: 'margeCible', type: 'number' },
                { label: 'Nb chantiers cible', key: 'nbChantiers', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={DS.label}>{f.label}</label>
                  <input type={f.type} style={DS.input} value={objectifs[f.key]}
                    onChange={e => setObjectifs({ ...objectifs, [f.key]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
          </div>

          {/* Progression vs objectifs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
            {(() => {
              const annee = new Date().getFullYear();
              // ANNUEL (Option A) : CA FACTURÉ HT de l'année en cours (== cascade en vue annuelle, == 171'500 démo).
              const caReel = caFactureHTDansPeriode(factures, 'annee', new Date(annee, 5, 15));
              const pctCA = objectifs.caAnnuel > 0 ? Math.min((caReel / objectifs.caAnnuel) * 100, 100) : 0;
              const margeReelle = parseFloat(margeNettePct) || 0;
              const pctMarge = objectifs.margeCible > 0 ? Math.min((margeReelle / objectifs.margeCible) * 100, 100) : 0;
              const nbChantiersReel = chantiers.filter(c => new Date(c.dateDebut).getFullYear() === annee).length;
              const pctNb = objectifs.nbChantiers > 0 ? Math.min((nbChantiersReel / objectifs.nbChantiers) * 100, 100) : 0;

              return [
                { label: 'CA facturé annuel', cible: `CHF ${fmtN(Math.round(objectifs.caAnnuel))}`, reel: `CHF ${fmtN(Math.round(caReel))}`, pct: pctCA, couleur: pctCA >= 80 ? V1.ok : pctCA >= 50 ? V1.warn : V1.danger },
                { label: 'Marge nette', cible: `${objectifs.margeCible}%`, reel: `${margeReelle}%`, pct: pctMarge, couleur: pctMarge >= 80 ? V1.ok : pctMarge >= 50 ? V1.warn : V1.danger },
                { label: 'Chantiers', cible: `${objectifs.nbChantiers}`, reel: `${nbChantiersReel}`, pct: pctNb, couleur: pctNb >= 80 ? V1.ok : pctNb >= 50 ? V1.warn : V1.danger },
              ].map(item => (
                <div key={item.label} style={{ ...carteV1, borderTop: `3px solid ${item.couleur}`, padding: '22px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: V1.texteMuted, marginBottom: 8 }}>{item.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ ...mono(22, V1.texte, 700) }}>{item.reel}</div>
                    <div style={{ ...mono(12, V1.texteMuted) }}>Cible: {item.cible}</div>
                  </div>
                  <div style={{ background: V1.separation, borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div style={{ background: item.couleur, width: `${item.pct}%`, height: '100%', borderRadius: 8, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ ...mono(12, item.couleur, 700), marginTop: 6 }}>{Math.round(item.pct)}% de l'objectif atteint</div>
                </div>
              ));
            })()}
          </div>

          {/* Chantiers classifiés par rentabilité */}
          <div style={carteV1}>
            <div className="ds-card-title">Rentabilité par chantier — Vue d'ensemble</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {['Rentable', 'Limite', 'Non rentable'].map(label => {
                const count = donneesChantiers.filter(c => statutRentabilite(c.couts.margeActuellePct).label === label).length;
                const couleurs = { Rentable: V1.ok, Limite: V1.warn, 'Non rentable': V1.danger };
                return (
                  <div key={label} style={{ ...carteV1, borderTop: `3px solid ${couleurs[label]}`, padding: '14px 20px', flex: 1, minWidth: 120, textAlign: 'center' }}>
                    <div style={{ ...mono(24, couleurs[label], 700) }}>{count}</div>
                    <div style={{ fontSize: 11, color: V1.texteMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                  </div>
                );
              })}
            </div>
            {donneesChantiers.filter(c => statutRentabilite(c.couts.margeActuellePct).label !== 'Rentable').length > 0 && (
              <>
                <div className="ds-section-label" style={{ marginBottom: 12 }}>Chantiers nécessitant attention</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donneesChantiers
                    .filter(c => statutRentabilite(c.couts.margeActuellePct).label !== 'Rentable')
                    .sort((a, b) => (a.couts.margeActuellePct ?? -999) - (b.couts.margeActuellePct ?? -999))
                    .map(c => {
                      const r = statutRentabilite(c.couts.margeActuellePct);
                      return (
                        <div key={c.id} style={{
                          ...carteV1, borderLeft: `4px solid ${r.couleur}`,
                          padding: '14px 18px',
                          display: 'flex', alignItems: 'center', gap: 16,
                        }}>
                          <span style={{ ...mono(11, r.couleur, 700), background: r.couleur + '22', border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>{r.label}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: V1.texte, fontSize: 14 }}>{c.nom}</div>
                            {c.depassements.length > 0 && <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 2 }}>{c.depassements.join(' · ')}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ ...mono(16, r.couleur, 700) }}>{c.couts.margeActuellePct !== null ? `${c.couts.margeActuellePct}%` : '—'}</div>
                            <div style={{ fontSize: 11, color: V1.texteMuted }}>marge réelle</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== ANALYSE M² ===== */}
      {montre('metres2') && <SectionAnalyse titre="Analyse m²" />}
      {montre('metres2') && (() => {
        // Chantiers avec surface > 0 ET CA disponible (devis lié)
        const chantiersM2 = chantiersPeriode.filter(c => {
          const surface = parseFloat(c.surface);
          return surface > 0 && calculerCA(c, devis) !== null;
        });

        if (chantiersM2.length === 0) {
          return (
            <div style={{ ...carteV1, textAlign: 'center', padding: 48, color: V1.texteMuted }}>
              <div style={{ ...mono(32, V1.bleuClair, 700), marginBottom: 12 }}>m²</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: V1.texte }}>Aucune donnée m² disponible</div>
              <div style={{ fontSize: 13 }}>Renseignez la surface dans vos devis ou chantiers pour activer l'analyse au m².</div>
            </div>
          );
        }

        // Calculs par chantier
        const lignesM2 = chantiersM2.map(c => {
          const surface = parseFloat(c.surface);
          const ca = calculerCA(c, devis);
          const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
          const cout = couts.totalCoutsReel || 0;
          const marge = couts.margeReel !== null ? couts.margeReel : (ca - cout);
          const caM2 = surface > 0 ? Math.round(ca / surface) : null;
          const coutM2 = surface > 0 ? Math.round(cout / surface) : null;
          const margeM2 = surface > 0 ? Math.round(marge / surface) : null;
          const margePct = ca > 0 ? Math.round((marge / ca) * 1000) / 10 : null;
          return { ...c, surface, ca, cout, marge, caM2, coutM2, margeM2, margePct };
        });

        // KPIs globaux
        const surfaceTotale = lignesM2.reduce((s, c) => s + c.surface, 0);
        const caTotalM2 = lignesM2.reduce((s, c) => s + c.ca, 0);
        const coutTotalM2 = lignesM2.reduce((s, c) => s + c.cout, 0);
        const margeTotaleM2 = lignesM2.reduce((s, c) => s + c.marge, 0);
        const caM2Moyen = surfaceTotale > 0 ? Math.round(caTotalM2 / surfaceTotale) : null;
        const coutM2Moyen = surfaceTotale > 0 ? Math.round(coutTotalM2 / surfaceTotale) : null;
        const margeM2Moyenne = surfaceTotale > 0 ? Math.round(margeTotaleM2 / surfaceTotale) : null;
        const margePctMoyenne = caTotalM2 > 0 ? Math.round((margeTotaleM2 / caTotalM2) * 1000) / 10 : null;

        const seuilM2Global = coutM2Moyen !== null ? Math.round(coutM2Moyen / (1 - SEUILS.margeLimite / 100)) : null;

        // Par type de travaux
        const typesAvecM2 = (parametres.typesTravaux || []).map(t => {
          const chantiersDuType = lignesM2.filter(c => (c.typesTravaux || []).includes(t.nom));
          if (chantiersDuType.length === 0) return null;
          const surf = chantiersDuType.reduce((s, c) => s + c.surface, 0);
          const caT = chantiersDuType.reduce((s, c) => s + c.ca, 0);
          const coutT = chantiersDuType.reduce((s, c) => s + c.cout, 0);
          const margeT = chantiersDuType.reduce((s, c) => s + c.marge, 0);
          const caM2T = surf > 0 ? Math.round(caT / surf) : null;
          const coutM2T = surf > 0 ? Math.round(coutT / surf) : null;
          const margeM2T = surf > 0 ? Math.round(margeT / surf) : null;
          const margePctT = caT > 0 ? Math.round((margeT / caT) * 1000) / 10 : null;
          const seuilM2T = coutM2T !== null ? Math.round(coutM2T / (1 - SEUILS.margeLimite / 100)) : null;
          const rentable = margePctT !== null && margePctT >= SEUILS.margeRentable;
          const limite = margePctT !== null && margePctT >= SEUILS.margeLimite && margePctT < SEUILS.margeRentable;
          return { nom: t.nom, count: chantiersDuType.length, surf, caM2: caM2T, coutM2: coutM2T, margeM2: margeM2T, margePct: margePctT, seuilM2: seuilM2T, rentable, limite };
        }).filter(Boolean);

        // Couleur statut marge (états métier → socle v1)
        const couleurStatut = (pct) => {
          if (pct === null || !Number.isFinite(pct)) return V1.texteMuted;
          if (pct >= SEUILS.margeRentable) return V1.ok;
          if (pct >= SEUILS.margeLimite)   return V1.warn;
          return V1.danger;
        };
        const labelStatut = (pct) => {
          if (pct === null || !Number.isFinite(pct)) return '—';
          if (pct >= SEUILS.margeRentable) return 'Rentable';
          if (pct >= SEUILS.margeLimite)   return 'Limite';
          if (pct >= 0)                    return 'Non rentable';
          return 'À perte';
        };

        return (
          <div>
            {/* KPIs globaux */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Surface analysée', val: `${fmtN(Math.round(surfaceTotale))} m²`, sub: `${lignesM2.length} chantier${lignesM2.length > 1 ? 's' : ''}`, couleur: V1.bleu },
                { label: 'CA signé moyen / m²', val: caM2Moyen !== null ? `CHF ${fmtN(caM2Moyen)}/m²` : '—', sub: `CA signé total CHF ${fmtN(Math.round(caTotalM2))}`, couleur: V1.ok },
                { label: 'Coût moyen / m²', val: coutM2Moyen !== null ? `CHF ${fmtN(coutM2Moyen)}/m²` : '—', sub: `Coût total CHF ${fmtN(Math.round(coutTotalM2))}`, couleur: V1.warn },
                { label: 'Marge moyenne / m²', val: margeM2Moyenne !== null ? `CHF ${fmtN(margeM2Moyenne)}/m²` : '—', sub: margePctMoyenne !== null ? `${margePctMoyenne}% de marge` : '—', couleur: margePctMoyenne !== null && margePctMoyenne >= 15 ? V1.ok : V1.danger },
              ].map(k => (
                <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}`, padding: '18px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: V1.texteMuted, marginBottom: 8 }}>{k.label}</div>
                  <div style={{ ...mono(20, k.couleur, 700), lineHeight: 1.1 }}>{k.val}</div>
                  <div style={{ fontSize: 11, color: V1.texteMuted, marginTop: 5 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Seuil de rentabilité global */}
            {seuilM2Global !== null && (
              <div style={{ background: 'rgba(232,145,43,0.08)', border: `1px solid ${V1.warn}4d`, borderLeft: `4px solid ${V1.warn}`, borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ ...mono(20, V1.warn, 700) }}>CHF {fmtN(seuilM2Global)}/m²</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: V1.texte }}>Seuil de rentabilité global (15% marge nette)</div>
                  <div style={{ fontSize: 12, color: V1.texteMuted }}>Pour être rentable à 15% de marge nette, facturer minimum <strong style={{ color: V1.warn }}>CHF {fmtN(seuilM2Global)}/m²</strong></div>
                </div>
                {caM2Moyen !== null && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: V1.texteMuted }}>CA signé moyen actuel</div>
                    <div style={{ ...mono(16, caM2Moyen >= seuilM2Global ? V1.ok : V1.danger, 700) }}>CHF {fmtN(caM2Moyen)}/m² {caM2Moyen >= seuilM2Global ? '✓' : '✗'}</div>
                  </div>
                )}
              </div>
            )}

            {/* Tableau par type de travaux */}
            {typesAvecM2.length > 0 && (
              <div style={{ ...carteV1, marginBottom: 24 }}>
                <div className="ds-card-title">Par type de travaux</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Type', 'Chantiers', 'Surface', 'Coût/m²', 'CA signé/m²', 'Marge/m²', 'Seuil rent. 15%', 'Statut'].map(h => (
                          <th key={h} style={DS.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {typesAvecM2.sort((a, b) => (b.margePct || 0) - (a.margePct || 0)).map(t => {
                        const c = couleurStatut(t.margePct);
                        return (
                          <tr key={t.nom} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                            <td style={{ ...DS.td, fontWeight: 700, color: V1.texte }}>{t.nom}</td>
                            <td style={{ ...DS.td, ...mono(13, V1.texte) }}>{t.count}</td>
                            <td style={{ ...DS.td, ...mono(13, V1.texte) }}>{fmtN(Math.round(t.surf))} m²</td>
                            <td style={{ ...DS.td, ...mono(13, V1.texte) }}>CHF {t.coutM2 !== null ? fmtN(t.coutM2) : '—'}/m²</td>
                            <td style={{ ...DS.td, ...mono(13, V1.texte, 700) }}>CHF {t.caM2 !== null ? fmtN(t.caM2) : '—'}/m²</td>
                            <td style={{ ...DS.td, ...mono(13, t.margeM2 !== null && t.margeM2 >= 0 ? V1.ok : V1.danger, 700) }}>
                              CHF {t.margeM2 !== null ? fmtN(t.margeM2) : '—'}/m²
                            </td>
                            <td style={{ ...DS.td, ...mono(13, V1.warn, 600) }}>
                              {t.seuilM2 !== null ? `CHF ${fmtN(t.seuilM2)}/m²` : '—'}
                            </td>
                            <td style={DS.td}>
                              <span style={{ ...mono(11, c, 700), background: c + '18', border: `1px solid ${c}35`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                                {labelStatut(t.margePct)}{t.margePct !== null ? ` (${t.margePct}%)` : ''}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tableau des chantiers individuels */}
            <div style={carteV1}>
              <div className="ds-card-title">Chantiers individuels avec surface renseignée</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Chantier', 'Surface', 'CA signé/m²', 'Coût/m²', 'Marge/m²', 'Marge %', 'vs Moyenne'].map(h => (
                        <th key={h} style={DS.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignesM2.sort((a, b) => (b.margePct || 0) - (a.margePct || 0)).map((c, i) => {
                      const col = couleurStatut(c.margePct);
                      const vsM2 = (caM2Moyen !== null && c.caM2 !== null) ? c.caM2 - caM2Moyen : null;
                      const vsPct = (caM2Moyen !== null && caM2Moyen > 0 && c.caM2 !== null) ? Math.round(((c.caM2 - caM2Moyen) / caM2Moyen) * 1000) / 10 : null;
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ ...DS.td, fontWeight: 700, color: V1.texte }}>
                            {c.nom || c.numero}
                            <div style={{ fontSize: 11, color: V1.texteMuted, fontWeight: 400, marginTop: 1 }}>{c.statut}</div>
                          </td>
                          <td style={{ ...DS.td, ...mono(13, V1.texte) }}>{fmtN(c.surface)} m²</td>
                          <td style={{ ...DS.td, ...mono(13, V1.ok, 700) }}>
                            CHF {c.caM2 !== null ? fmtN(c.caM2) : '—'}/m²
                          </td>
                          <td style={{ ...DS.td, ...mono(13, V1.texte) }}>CHF {c.coutM2 !== null ? fmtN(c.coutM2) : '—'}/m²</td>
                          <td style={{ ...DS.td, ...mono(13, c.margeM2 !== null && c.margeM2 >= 0 ? V1.ok : V1.danger, 700) }}>
                            CHF {c.margeM2 !== null ? fmtN(c.margeM2) : '—'}/m²
                          </td>
                          <td style={DS.td}>
                            <span style={{ ...mono(11, col, 700), background: col + '18', border: `1px solid ${col}35`, borderRadius: 20, padding: '3px 10px' }}>
                              {c.margePct !== null ? `${c.margePct}%` : '—'}
                            </span>
                          </td>
                          <td style={DS.td}>
                            {vsM2 !== null ? (
                              <span style={{
                                ...mono(11, vsM2 >= 0 ? V1.ok : V1.danger, 700),
                                background: vsM2 >= 0 ? 'rgba(30,138,76,0.12)' : 'rgba(192,57,43,0.12)',
                                border: `1px solid ${vsM2 >= 0 ? V1.ok : V1.danger}4d`,
                                borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
                              }}>
                                {vsM2 >= 0 ? '+' : ''}{fmtN(vsM2)} CHF/m²
                                {vsPct !== null ? ` (${vsPct >= 0 ? '+' : ''}${vsPct}%)` : ''}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {montre('marges') && <SectionAnalyse titre="Marges" />}
      {montre('marges') && (
        <Marges chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} periodeGlobale={periodeGlobale} />
      )}

      {montre('statistiques') && <SectionAnalyse titre="Statistiques" />}
      {montre('statistiques') && (
        <Statistiques chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} periodeGlobale={periodeGlobale} />
      )}

      {montre('rapport') && <SectionAnalyse titre="Rapport hebdo" />}
      {montre('rapport') && (
        <Rapport chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} factures={factures} />
      )}
    </div>
  );
}
