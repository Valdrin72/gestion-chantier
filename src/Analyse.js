import React, { useState, useMemo } from 'react';
import { C, fmtN, calculerCoutsChantier, calculerCA, statutRentabilite, isChantierActif, heuresEmploye } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;

export default function Analyse({ chantiers, clients, devis = [], parametres, setParametres }) {
  const [onglet, setOnglet] = useState('rentabilite');
  const [tauxChargesSociales, setTauxChargesSociales] = useState(parametres.parametres?.tauxChargesSociales || 25);
  const [tauxImpots, setTauxImpots] = useState(parametres.parametres?.tauxImpots || 15);
  const [tauxFraisGeneraux, setTauxFraisGeneraux] = useState(parametres.parametres?.tauxFraisGeneraux || 12);
  const [taxSaved, setTaxSaved] = useState(false);

  const couleurMarge = (pct) => parseFloat(pct) >= 20 ? '#10b981' : parseFloat(pct) >= 15 ? '#f59e0b' : '#ef4444';
  const couleurEcart = (pct) => parseFloat(pct) <= 5 ? '#10b981' : parseFloat(pct) <= 15 ? '#f59e0b' : '#ef4444';

  // ===== CALCULS GLOBAUX (uniquement chantiers avec devis pour CA et marges) =====
  const chantiersAvecDevis = chantiers.filter(c => calculerCA(c, devis) !== null);
  const nbSansDevis = chantiers.length - chantiersAvecDevis.length;
  const caTotal = chantiersAvecDevis.reduce((t, c) => t + calculerCA(c, devis), 0);
  const coutsTotal = chantiersAvecDevis.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
  const margeAvantCharges = caTotal - coutsTotal;
  const chargesSociales = coutsTotal * (tauxChargesSociales / 100);
  const fraisGeneraux = caTotal * (tauxFraisGeneraux / 100);
  const margeAvantImpots = margeAvantCharges - chargesSociales - fraisGeneraux;
  const impots = margeAvantImpots > 0 ? margeAvantImpots * (tauxImpots / 100) : 0;
  const margeNette = margeAvantImpots - impots;
  const margeNettePct = caTotal > 0 ? ((margeNette / caTotal) * 100).toFixed(1) : 0;

  // SEUIL DE RENTABILITÉ
  const chargesFixes = fraisGeneraux + (coutsTotal * 0.3);
  const tauxMargeContribution = caTotal > 0 ? ((caTotal - coutsTotal * 0.7) / caTotal) : 0;
  const seuilRentabilite = tauxMargeContribution > 0 ? chargesFixes / tauxMargeContribution : 0;

  // PROJECTION CA
  const moisActuel = new Date().getMonth();
  const caRealise = chantiers.filter(c => {
    const d = new Date(c.dateDebut);
    return d.getFullYear() === new Date().getFullYear() && d.getMonth() <= moisActuel && calculerCA(c, devis) !== null;
  }).reduce((t, c) => t + calculerCA(c, devis), 0);
  const moyenneMensuelle = moisActuel > 0 ? caRealise / (moisActuel + 1) : caRealise;
  const projectionAnnuelle = moyenneMensuelle * 12;
  const moisRestants = 11 - moisActuel;
  const caPrevisionnel = caRealise + (moyenneMensuelle * moisRestants);

  // ===== DONNÉES PAR CHANTIER =====
  const donneesChantiers = chantiers.map(c => {
    const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
    const montantTotal = calculerCA(c, devis); // null si aucun devis lié
    const caDisponible = montantTotal !== null;
    const heuresPrevu = parseFloat(c.heuresPrevu) || 0;
    const heuresRealise = parseFloat(c.heuresRealise) || 0;
    const surface = parseFloat(c.surface) || 0;
    const joursPrevu = parseInt(c.nombreJours) || 0;
    const joursReelJournal = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    const joursReel = joursReelJournal > 0
      ? joursReelJournal
      : (c.equipe?.length ? Math.max(...c.equipe.map(m => parseFloat(m.joursRealises) || 0), 0) : 0);

    const ecartBudget = couts.totalCoutsReel > 0 && couts.totalCoutsPrevu > 0
      ? (((couts.totalCoutsReel - couts.totalCoutsPrevu) / couts.totalCoutsPrevu) * 100).toFixed(1)
      : 0;

    const coutParHeure = heuresRealise > 0 ? (couts.totalCoutsReel / heuresRealise).toFixed(0) : 0;
    const caParHeure = (caDisponible && heuresRealise > 0) ? (montantTotal / heuresRealise).toFixed(0) : null;
    const coutParM2 = surface > 0 ? (couts.totalCoutsReel / surface).toFixed(0) : 0;
    const caParM2 = (caDisponible && surface > 0) ? (montantTotal / surface).toFixed(0) : null;
    const margeParM2 = (couts.margeReel !== null && surface > 0) ? (couts.margeReel / surface).toFixed(0) : null;
    const ecartJours = joursPrevu > 0 ? (((joursReel - joursPrevu) / joursPrevu) * 100).toFixed(1) : 0;
    const tauxFacturation = heuresPrevu > 0 ? ((heuresRealise / heuresPrevu) * 100).toFixed(1) : 0;

    const depassements = [];
    if (parseFloat(ecartBudget) > 10) depassements.push(`Budget dépassé de ${ecartBudget}%`);
    if (parseFloat(ecartJours) > 10) depassements.push(`Jours dépassés de ${ecartJours}%`);
    if (parseFloat(couts.margeReelPct) < 15) depassements.push(`Marge critique ${couts.margeReelPct}%`);

    return { ...c, couts, montantTotal, ecartBudget, coutParHeure, caParHeure, coutParM2, caParM2, margeParM2, ecartJours, tauxFacturation, heuresPrevu, heuresRealise, joursPrevu, joursReel, depassements };
  });

  // ===== DONNÉES PAR EMPLOYÉ =====
  const donneesEmployes = parametres.employes.map(emp => {
    // Source unique : journal (cohérent avec calculerCoutsChantier)
    const joursTotal = chantiers.reduce((t, c) => {
      const heures = heuresEmploye(c.journal || [], emp.id);
      return t + heures / 8;
    }, 0);
    const heuresTotal = joursTotal * 8;
    const coutTotal = joursTotal * emp.tarifJour;
    const caGenere = chantiers.reduce((t, c) => {
      const heures = heuresEmploye(c.journal || [], emp.id);
      if (heures === 0) return t;
      const pctJours = joursTotal > 0 ? (heures / 8) / joursTotal : 0;
      const ca = calculerCA(c, devis);
      return ca !== null ? t + (ca * pctJours) : t;
    }, 0);
    const coutHoraire = heuresTotal > 0 ? (coutTotal / heuresTotal).toFixed(0) : 0;
    const productivite = coutTotal > 0 ? ((caGenere / coutTotal) * 100).toFixed(0) : 0;
    const chargesSoc = coutTotal * (tauxChargesSociales / 100);
    const coutReel = coutTotal + chargesSoc;

    return { ...emp, joursTotal, heuresTotal, coutTotal, caGenere, coutHoraire, productivite, chargesSoc, coutReel };
  }).filter(e => e.joursTotal > 0);

  // ===== RENTABILITÉ PAR MÉTRÉ (uniquement chantiers avec devis) =====
  const donneesMetres = parametres.typesTravaux.map(t => {
    const tous = chantiers.filter(c => (c.typesTravaux || []).includes(t.nom));
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const surface = avecDevis.reduce((s, c) => s + (parseFloat(c.surface) || 0), 0);
    const ca = avecDevis.reduce((s, c) => s + calculerCA(c, devis), 0);
    const couts = avecDevis.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const marge = ca - couts;
    const caParM2 = surface > 0 ? (ca / surface).toFixed(0) : 0;
    const coutParM2 = surface > 0 ? (couts / surface).toFixed(0) : 0;
    const margeParM2 = surface > 0 ? (marge / surface).toFixed(0) : 0;
    const margePct = ca > 0 ? ((marge / ca) * 100).toFixed(1) : 0;
    return { nom: t.nom, count: tous.length, nbAvecDevis: avecDevis.length, surface, ca, couts, marge, caParM2, coutParM2, margeParM2, margePct };
  }).filter(t => t.count > 0);

  // ===== DONNÉES PAR CLIENT (uniquement chantiers avec devis pour CA/marge) =====
  const donneesClients = useMemo(() => clients.map(cl => {
    const tous = chantiers.filter(c => c.clientId === cl.id);
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const cs = avecDevis; // alias pour clarté
    const ca = cs.reduce((t, c) => t + calculerCA(c, devis), 0);
    const couts = cs.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const marge = ca - couts;
    const margePct = ca > 0 ? ((marge / ca) * 100).toFixed(1) : 0;
    const enCours = tous.filter(isChantierActif).length;
    const termines = tous.filter(c => c.statut === 'Terminé').length;
    return { ...cl, nbChantiers: tous.length, nbAvecDevis: avecDevis.length, ca, couts, marge, margePct, enCours, termines };
  }).filter(cl => cl.nbChantiers > 0).sort((a, b) => b.ca - a.ca), [clients, chantiers, parametres, devis]);

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

  // ===== DÉRIVE DEVIS → RÉALITÉ PAR TYPE DE TRAVAUX =====
  const donneesDerive = useMemo(() => parametres.typesTravaux.map(t => {
    const chantiersDuType = chantiers.filter(c =>
      (c.typesTravaux || []).includes(t.nom) && calculerCA(c, devis) !== null
    );
    if (chantiersDuType.length === 0) return null;

    const lignes = chantiersDuType.map(c => {
      const joursPrevu  = parseInt(c.nombreJours) || 0;
      const joursReel   = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
      const couts       = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
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
  }).filter(Boolean).sort((a, b) => (b.ecartCoutMoyen ?? 0) - (a.ecartCoutMoyen ?? 0)), [chantiers, devis, parametres]);

  const onglets = [
    { id: 'rentabilite', label: '💰 Rentabilité nette' },
    { id: 'derive',      label: '🎯 Dérive devis' },
    { id: 'chantiers',   label: '🏗️ Prévu vs Réel' },
    { id: 'clients',     label: '👥 Clients' },
    { id: 'employes',    label: '👷 Coût horaire' },
    { id: 'corps',       label: '🔧 Corps de métier' },
    { id: 'projection',  label: '🔮 Projections' },
    { id: 'objectifs',   label: '🎯 Objectifs' },
  ];

  return (
    <div>
      <div className="page-title-main" style={{ marginBottom: 24 }}>Analyse financière avancée</div>

      {/* ONGLETS */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '25px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {onglets.map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            background: 'transparent',
            color: onglet === o.id ? '#3b82f6' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: onglet === o.id ? '2px solid rgba(59,130,246,0.8)' : '2px solid transparent',
            padding: '10px 18px',
            marginBottom: '-1px',
            borderRadius: '0', cursor: 'pointer', fontSize: '14px', fontWeight: onglet === o.id ? '600' : 'normal'
          }}>{o.label}</button>
        ))}
      </div>

      {/* ===== RENTABILITÉ NETTE ===== */}
      {onglet === 'rentabilite' && (
        <div>
          {/* PARAMÈTRES */}
          <div style={carteStyle}>
            <div className="ds-card-title">Paramètres fiscaux et sociaux</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              {[
                { label: '👥 Charges sociales (%)', val: tauxChargesSociales, set: setTauxChargesSociales },
                { label: '🏢 Frais généraux (%)', val: tauxFraisGeneraux, set: setTauxFraisGeneraux },
                { label: '💸 Taux d\'imposition (%)', val: tauxImpots, set: setTauxImpots },
              ].map(s => (
                <div key={s.label}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>{s.label}</label>
                  <input type="number" value={s.val} onChange={e => { s.set(parseFloat(e.target.value) || 0); setTaxSaved(false); }}
                    style={{ padding: '10px', borderRadius: '8px', border: '2px solid #3b82f6', fontSize: '16px', fontWeight: 'bold', width: '100%', color: '#3b82f6', background: 'var(--bg-input)' }} />
                </div>
              ))}
            </div>
            {setParametres && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => {
                  setParametres({ ...parametres, parametres: { ...parametres.parametres, tauxChargesSociales, tauxFraisGeneraux, tauxImpots } });
                  setTaxSaved(true);
                }} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                  ✅ Enregistrer les paramètres
                </button>
                {taxSaved && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Sauvegardé</span>}
              </div>
            )}
          </div>

          {/* CASCADE DE RENTABILITÉ */}
          <div style={carteStyle}>
            <div className="ds-card-title">Cascade de rentabilité</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: '💰 Chiffre d\'affaires total', val: caTotal, pct: 100, couleur: '#10b981', bg: 'rgba(16,185,129,0.08)', bold: false, big: false },
                { label: '➖ Coûts directs chantiers', val: -coutsTotal, pct: -(coutsTotal / caTotal * 100).toFixed(1), couleur: '#ef4444', bg: 'rgba(239,68,68,0.08)', bold: false, big: false },
                { label: '= Marge brute', val: margeAvantCharges, pct: (margeAvantCharges / caTotal * 100).toFixed(1), couleur: margeAvantCharges >= 0 ? '#10b981' : '#ef4444', bg: 'var(--bg-hover)', bold: true, big: false },
                { label: '➖ Charges sociales', val: -chargesSociales, pct: -(chargesSociales / caTotal * 100).toFixed(1), couleur: '#f59e0b', bg: 'rgba(245,158,11,0.08)', bold: false, big: false },
                { label: '➖ Frais généraux', val: -fraisGeneraux, pct: -(fraisGeneraux / caTotal * 100).toFixed(1), couleur: '#f59e0b', bg: 'rgba(245,158,11,0.08)', bold: false, big: false },
                { label: '= Résultat avant impôts', val: margeAvantImpots, pct: (margeAvantImpots / caTotal * 100).toFixed(1), couleur: margeAvantImpots >= 0 ? '#10b981' : '#ef4444', bg: 'var(--bg-hover)', bold: true, big: false },
                { label: '➖ Impôts estimés', val: -impots, pct: -(impots / caTotal * 100).toFixed(1), couleur: '#ef4444', bg: 'rgba(239,68,68,0.08)', bold: false, big: false },
                { label: '= MARGE NETTE', val: margeNette, pct: margeNettePct, couleur: margeNette >= 0 ? '#10b981' : '#ef4444', bg: margeNette >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)', bold: true, big: true },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: s.big ? '18px 20px' : '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: s.bold ? `2px solid ${s.couleur}` : 'none' }}>
                  <div style={{ fontWeight: s.bold ? 'bold' : 'normal', fontSize: s.big ? '16px' : '14px', color: s.bold ? s.couleur : 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ fontSize: s.big ? '22px' : '16px', fontWeight: 'bold', color: s.couleur }}>
                      CHF {fmtN(Math.abs(s.val))}
                    </div>
                    <div style={{ background: s.couleur + '18', color: s.couleur, padding: '3px 12px', borderRadius: '12px', fontSize: '13px', minWidth: '60px', textAlign: 'center', fontWeight: 600 }}>
                      {s.pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEUIL DE RENTABILITÉ */}
          <div style={carteStyle}>
            <div className="ds-card-title">Seuil de rentabilité</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              {[
                { label: '🎯 Seuil de rentabilité', val: `CHF ${fmtN(Math.round(seuilRentabilite))}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)', desc: 'CA minimum à réaliser' },
                { label: 'CA actuel', val: `CHF ${fmtN(Math.round(caTotal))}`, couleur: caTotal >= seuilRentabilite ? '#10b981' : '#ef4444', bg: caTotal >= seuilRentabilite ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.09)', desc: caTotal >= seuilRentabilite ? 'Au-dessus du seuil' : 'En dessous du seuil' },
                { label: '📊 Écart au seuil', val: `CHF ${fmtN(Math.abs(Math.round(caTotal - seuilRentabilite)))}`, couleur: caTotal >= seuilRentabilite ? '#10b981' : '#ef4444', bg: 'var(--bg-hover)', desc: caTotal >= seuilRentabilite ? '✅ Marge de sécurité' : '⚠️ Manque à combler' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: s.couleur, margin: '8px 0' }}>{s.val}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== DÉRIVE DEVIS → RÉALITÉ ===== */}
      {onglet === 'derive' && (
        <div>
          {/* Intro */}
          <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Sur quels types de travaux sous-estimes-tu systématiquement ?</strong>
            {' '}Cette analyse compare ce que tu as devisé avec ce qui s'est réellement passé sur chaque type de chantier.
          </div>

          {donneesDerive.length === 0 ? (
            <div style={{ ...carteStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
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
                      { label: 'Types analysés', val: donneesDerive.length, couleur: '#3b82f6', sub: `${donneesDerive.reduce((s,d) => s + d.count, 0)} chantiers` },
                      { label: 'Sous-estimés', val: sousEstimes.length, couleur: '#ef4444', sub: sousEstimes.length > 0 ? sousEstimes.map(d => d.nom).join(', ') : 'Aucun' },
                      { label: 'Plus grande dérive', val: pireType.nom, couleur: '#f59e0b', sub: pireType.ecartCoutMoyen !== null ? `+${pireType.ecartCoutMoyen.toFixed(0)}% coût réel` : '—' },
                      { label: 'Perte de marge moy.', val: pireType.perteMarge !== null ? `${pireType.perteMarge.toFixed(1)}%` : '—', couleur: pireType.perteMarge !== null && pireType.perteMarge < -3 ? '#ef4444' : '#10b981', sub: 'sur le type le + déviant' },
                    ].map(k => (
                      <div key={k.label} style={{ background: `${k.couleur}10`, border: `1px solid ${k.couleur}25`, borderRadius: 12, padding: '16px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 8 }}>{k.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: k.couleur, lineHeight: 1.1, wordBreak: 'break-word' }}>{k.val}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tableau par type */}
              {donneesDerive.map(d => {
                const signalCfg = {
                  sousEstime: { couleur: '#ef4444', bg: '#ef444410', label: '🔴 Sous-estimé',   conseil: 'Augmente tes prix ou réduis la durée estimée sur ce type.' },
                  attention:  { couleur: '#f59e0b', bg: '#f59e0b10', label: '🟡 À surveiller',  conseil: 'Légère tendance à dépasser — surveille les prochains devis.' },
                  surEstime:  { couleur: '#10b981', bg: '#10b98110', label: '🟢 Sur-estimé',    conseil: 'Tu es conservateur — tu peux affiner tes prix pour être plus compétitif.' },
                  ok:         { couleur: '#10b981', bg: '#10b98110', label: '✓ Bien estimé',    conseil: 'Bonne maîtrise de ce type de chantier.' },
                  inconnu:    { couleur: '#6b7280', bg: '#6b728010', label: '⚪ Données insuffisantes', conseil: 'Ajoute plus de chantiers liés à des devis.' },
                }[d.signal];
                const fmtPct  = (v, plus = true) => v === null ? '—' : `${plus && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
                const fmtJours = (v) => v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;
                return (
                  <div key={d.nom} style={{ ...carteStyle, marginBottom: 16, borderLeft: `4px solid ${signalCfg.couleur}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{d.nom}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.count} chantier{d.count > 1 ? 's' : ''} analysé{d.count > 1 ? 's' : ''}</div>
                      </div>
                      <span style={{ background: signalCfg.bg, color: signalCfg.couleur, border: `1px solid ${signalCfg.couleur}35`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700 }}>
                        {signalCfg.label}
                      </span>
                    </div>

                    {/* 4 métriques */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                      {[
                        { label: 'Dérive durée',   val: fmtJours(d.ecartJoursMoyen),  couleur: d.ecartJoursMoyen !== null && d.ecartJoursMoyen > 15 ? '#ef4444' : d.ecartJoursMoyen !== null && d.ecartJoursMoyen > 5 ? '#f59e0b' : '#10b981', sub: 'jours réels vs prévus' },
                        { label: 'Dérive coût',    val: fmtPct(d.ecartCoutMoyen),     couleur: d.ecartCoutMoyen !== null && d.ecartCoutMoyen > 15 ? '#ef4444' : d.ecartCoutMoyen !== null && d.ecartCoutMoyen > 5 ? '#f59e0b' : '#10b981',    sub: 'coût réel vs prévu' },
                        { label: 'Marge devisée',  val: fmtPct(d.margePrevuMoyenne, false), couleur: '#3b82f6', sub: 'marge prévue moyenne' },
                        { label: 'Marge réelle',   val: fmtPct(d.margeReelMoyenne, false),  couleur: d.margeReelMoyenne !== null && d.margeReelMoyenne < 10 ? '#ef4444' : d.margeReelMoyenne !== null && d.margeReelMoyenne < 20 ? '#f59e0b' : '#10b981', sub: 'marge réelle moyenne' },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>{m.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: m.couleur }}>{m.val}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{m.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Conseil */}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${signalCfg.couleur}50` }}>
                      💡 {signalCfg.conseil}
                    </div>

                    {/* Détail par chantier */}
                    {d.lignes.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Détail par chantier</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {d.lignes.map(l => (
                            <div key={l.c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 120 }}>{l.c.nom || l.c.numero}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80 }}>{l.joursPrevu}j → {l.joursReel}j{l.ecartJours !== null ? <span style={{ color: l.ecartJours > 15 ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}> ({l.ecartJours > 0 ? '+' : ''}{l.ecartJours?.toFixed(0)}%)</span> : ''}</span>
                              {l.margeReelPct !== null && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: l.margeReelPct < 10 ? '#ef4444' : l.margeReelPct < 20 ? '#f59e0b' : '#10b981' }}>
                                  Marge {l.margeReelPct.toFixed(1)}%
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
      {onglet === 'chantiers' && (
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

          <div style={carteStyle}>
            <div className="ds-card-title">Comparaison Prévu vs Réel par chantier</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Chantier', 'Devis', 'Coût prévu', 'Coût réel', 'Écart budget', 'Marge réelle', 'Jours prévus', 'Jours réels', 'Écart jours'].map(h => (
                    <th key={h} style={DS.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donneesChantiers.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{c.nom}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.statut}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>CHF {fmtN(c.montantTotal)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>CHF {fmtN(c.couts.totalCoutsPrevu)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>CHF {fmtN(c.couts.totalCoutsReel)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: couleurEcart(c.ecartBudget) + '18', color: couleurEcart(c.ecartBudget), fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {parseFloat(c.ecartBudget) > 0 ? '+' : ''}{c.ecartBudget}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: couleurMarge(c.couts.margeReelPct) + '18', color: couleurMarge(c.couts.margeReelPct), fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {c.couts.margeReelPct}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{c.joursPrevu}j</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{c.joursReel.toFixed(1)}j</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: couleurEcart(Math.abs(c.ecartJours)) + '18', color: couleurEcart(Math.abs(c.ecartJours)), fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {parseFloat(c.ecartJours) > 0 ? '+' : ''}{c.ecartJours}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HEURES */}
          <div style={carteStyle}>
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
                  const margeParHeure = c.heuresRealise > 0 ? (c.couts.margeReel / c.heuresRealise).toFixed(0) : 0;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px' }}><strong style={{ color: 'var(--text-primary)' }}>{c.nom}</strong></td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{c.heuresPrevu}h</td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.heuresRealise}h</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: (parseFloat(c.tauxFacturation) >= 90 ? '#10b981' : '#f59e0b') + '18', color: parseFloat(c.tauxFacturation) >= 90 ? '#10b981' : '#f59e0b', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                          {c.tauxFacturation}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>CHF {c.coutParHeure}/h</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>CHF {c.caParHeure}/h</td>
                      <td style={{ padding: '10px 12px', color: parseFloat(margeParHeure) >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>CHF {margeParHeure}/h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== COÛT HORAIRE EMPLOYÉS ===== */}
      {onglet === 'employes' && (
        <div>
          <div style={carteStyle}>
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
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 'bold', marginRight: '8px', fontSize: '14px' }}>
                          {e.nom.charAt(0)}
                        </div>
                        <strong style={{ color: 'var(--text-primary)' }}>{e.nom}</strong>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{e.poste}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{e.joursTotal}j</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{e.heuresTotal}h</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>CHF {fmtN(e.coutTotal)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#f59e0b' }}>CHF {fmtN(Math.round(e.chargesSoc))}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ef4444' }}>CHF {fmtN(Math.round(e.coutReel))}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: '#3b82f618', color: '#3b82f6', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                          CHF {e.coutHoraire}/h
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: (parseFloat(e.productivite) >= 150 ? '#10b981' : parseFloat(e.productivite) >= 100 ? '#f59e0b' : '#ef4444') + '18', color: parseFloat(e.productivite) >= 150 ? '#10b981' : parseFloat(e.productivite) >= 100 ? '#f59e0b' : '#ef4444', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
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
          <div style={carteStyle}>
            <div className="ds-card-title">Masse salariale totale</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Salaires bruts', val: `CHF ${fmtN(donneesEmployes.reduce((t, e) => t + e.coutTotal, 0))}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                { label: 'Charges sociales', val: `CHF ${fmtN(Math.round(donneesEmployes.reduce((t, e) => t + e.chargesSoc, 0)))}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                { label: 'Coût total RH', val: `CHF ${fmtN(Math.round(donneesEmployes.reduce((t, e) => t + e.coutReel, 0)))}`, couleur: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                { label: '% du CA', val: `${caTotal > 0 ? ((donneesEmployes.reduce((t, e) => t + e.coutReel, 0) / caTotal) * 100).toFixed(1) : 0}%`, couleur: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: s.couleur, marginTop: '5px' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== PAR MÉTRÉ ===== */}
      {onglet === 'corps' && (
        <div style={carteStyle}>
          <div className="ds-card-title">Rentabilité par type de travaux (CHF/m²)</div>
          {donneesMetres.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée disponible</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                <thead>
                  <tr>
                    {['Type travaux', 'Chantiers', 'Surface', 'CA/m²', 'Coût/m²', 'Marge/m²', 'Marge %', 'Statut'].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donneesMetres.sort((a, b) => parseFloat(b.margePct) - parseFloat(a.margePct)).map((t) => (
                    <tr key={t.nom} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 15px' }}><strong style={{ color: 'var(--text-primary)' }}>{t.nom}</strong></td>
                      <td style={{ padding: '12px 15px', color: 'var(--text-primary)' }}>{t.count}</td>
                      <td style={{ padding: '12px 15px', color: 'var(--text-primary)' }}>{t.surface} m²</td>
                      <td style={{ padding: '12px 15px', color: 'var(--text-primary)', fontWeight: 'bold' }}>CHF {t.caParM2}/m²</td>
                      <td style={{ padding: '12px 15px', color: 'var(--text-primary)' }}>CHF {t.coutParM2}/m²</td>
                      <td style={{ padding: '12px 15px', color: parseFloat(t.margeParM2) >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        CHF {t.margeParM2}/m²
                      </td>
                      <td style={{ padding: '12px 15px' }}>
                        <span style={{ background: couleurMarge(t.margePct) + '18', color: couleurMarge(t.margePct), fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                          {t.margePct}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 15px', color: 'var(--text-primary)' }}>
                        {parseFloat(t.margePct) >= 20 ? '🟢 Excellent' : parseFloat(t.margePct) >= 15 ? '🟡 Correct' : '🔴 Critique'}
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
                    <div key={t.nom} style={{ background: c + '10', border: `1px solid ${c}28`, borderRadius: '14px', padding: '20px', flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{['🥇', '🥈', '🥉'][i]}</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.nom}</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: c, letterSpacing: '-0.3px', marginTop: '4px' }}>{t.margePct}%</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>CHF {t.margeParM2}/m²</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== PROJECTIONS ===== */}
      {onglet === 'projection' && (
        <div>
          <div style={carteStyle}>
            <div className="ds-card-title">Projections CA annuel {new Date().getFullYear()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
              {[
                { label: 'CA réalisé', val: `CHF ${fmtN(Math.round(caRealise))}`, couleur: '#10b981', desc: `${moisActuel + 1} mois` },
                { label: 'Moyenne/mois', val: `CHF ${fmtN(Math.round(moyenneMensuelle))}`, couleur: '#10b981', desc: 'Tendance actuelle' },
                { label: 'Projection annuelle', val: `CHF ${fmtN(Math.round(projectionAnnuelle))}`, couleur: '#8b5cf6', desc: 'Sur 12 mois' },
                { label: 'CA prévisionnel', val: `CHF ${fmtN(Math.round(caPrevisionnel))}`, couleur: '#f59e0b', desc: `Réalisé + ${moisRestants} mois prévus` },
              ].map(s => (
                <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}28`, borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: s.couleur, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{s.val}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* PROJECTION MARGE NETTE */}
            <div className="ds-section-label" style={{ marginTop: 20 }}>Projection marge nette annuelle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              {[
                { scenario: '📉 Pessimiste (-20%)', ca: projectionAnnuelle * 0.8 },
                { scenario: '📊 Réaliste', ca: projectionAnnuelle },
                { scenario: '📈 Optimiste (+20%)', ca: projectionAnnuelle * 1.2 },
              ].map((s, i) => {
                const couts = s.ca * (coutsTotal / caTotal || 0.6);
                const chargesSoc = couts * (tauxChargesSociales / 100);
                const fraisGen = s.ca * (tauxFraisGeneraux / 100);
                const avantImpots = s.ca - couts - chargesSoc - fraisGen;
                const imp = avantImpots > 0 ? avantImpots * (tauxImpots / 100) : 0;
                const nette = avantImpots - imp;
                const pct = s.ca > 0 ? ((nette / s.ca) * 100).toFixed(1) : 0;
                const couleurs = ['#ef4444', '#10b981', '#10b981'];
                const bgs = ['rgba(239,68,68,0.09)', 'rgba(16,185,129,0.10)', 'rgba(16,185,129,0.10)'];
                return (
                  <div key={s.scenario} style={{ background: bgs[i], border: `2px solid ${couleurs[i]}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: couleurs[i], marginBottom: '10px' }}>{s.scenario}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>CA projeté</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: couleurs[i] }}>CHF {fmtN(Math.round(s.ca))}</div>
                    <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Marge nette</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: nette >= 0 ? '#10b981' : '#ef4444' }}>CHF {fmtN(Math.round(nette))}</div>
                      <div style={{ fontSize: '14px', color: nette >= 0 ? '#10b981' : '#ef4444' }}>({pct}%)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== CLIENTS ===== */}
      {onglet === 'clients' && (
        <div>
          {donneesClients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">Aucun client avec données</div>
              <div className="empty-state-sub">Associez des clients à vos chantiers pour voir leur rentabilité</div>
            </div>
          ) : (
            <>
              {/* KPIs clients */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Clients actifs', val: donneesClients.length, couleur: '#3b82f6' },
                  { label: 'Meilleur CA', val: `CHF ${fmtN(Math.round(donneesClients[0]?.ca || 0))}`, couleur: '#10b981' },
                  { label: 'Marge moy.', val: `${(donneesClients.reduce((t,c)=>t+parseFloat(c.margePct||0),0)/donneesClients.length).toFixed(1)}%`, couleur: '#8b5cf6' },
                  { label: 'Chantiers total', val: donneesClients.reduce((t,c)=>t+c.nbChantiers,0), couleur: '#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}28`, borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Podium top 3 */}
              <div style={carteStyle}>
                <div className="ds-card-title">🏆 Top clients par CA</div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                  {donneesClients.slice(0, 3).map((cl, i) => {
                    const couleurs = ['#f59e0b', '#94a3b8', '#cd7c2f'];
                    const medailles = ['🥇', '🥈', '🥉'];
                    const r = statutRentabilite(cl.margePct);
                    return (
                      <div key={cl.id} className="premium-card" style={{ flex: 1, minWidth: 180,
                        background: `linear-gradient(145deg, ${couleurs[i]}12 0%, rgba(255,255,255,0.025) 100%)`,
                        border: `1px solid ${couleurs[i]}30`, borderRadius: 14, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>{medailles[i]}</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{cl.nom}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: couleurs[i], letterSpacing: '-0.3px' }}>CHF {fmtN(Math.round(cl.ca))}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0' }}>{cl.nbChantiers} chantier{cl.nbChantiers > 1 ? 's' : ''}</div>
                        <span style={{ background: r.couleur + '22', color: r.couleur, border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{r.label} {cl.margePct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Tableau tous clients */}
                <table className="table-cards" style={{ width: '100%' }}>
                  <thead><tr>
                    {['Rang', 'Client', 'Chantiers', 'CA Total', 'Coûts', 'Marge %', 'Gain CHF', 'Statut'].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {donneesClients.map((cl, i) => {
                      const r = statutRentabilite(cl.margePct);
                      return (
                        <tr key={cl.id} className="ds-animate-in" style={{ animationDelay: `${i * 30}ms` }}>
                          <td style={DS.td}><span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{i+1}</span></td>
                          <td style={{ ...DS.td, fontWeight: 700 }}>{cl.nom}</td>
                          <td style={DS.td}>{cl.nbChantiers} ({cl.enCours} en cours)</td>
                          <td style={{ ...DS.td, fontWeight: 700 }}>CHF {fmtN(Math.round(cl.ca))}</td>
                          <td style={{ ...DS.td, color: 'var(--text-secondary)' }}>CHF {fmtN(Math.round(cl.couts))}</td>
                          <td style={{ ...DS.td, color: r.couleur, fontWeight: 700 }}>{cl.margePct}%</td>
                          <td style={{ ...DS.td, fontWeight: 600, color: cl.marge >= 0 ? '#10b981' : '#ef4444' }}>CHF {fmtN(Math.round(cl.marge))}</td>
                          <td style={DS.td}>
                            <span style={{ background: r.couleur + '22', color: r.couleur, border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{r.label}</span>
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
      {onglet === 'objectifs' && (
        <div>
          {/* Saisie objectifs */}
          <div style={carteStyle}>
            <div className="ds-card-title">🎯 Définir les objectifs annuels</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 20 }}>
              {[
                { label: '💰 CA annuel cible (CHF)', key: 'caAnnuel', type: 'number' },
                { label: '📈 Marge nette cible (%)', key: 'margeCible', type: 'number' },
                { label: '🏗️ Nb chantiers cible', key: 'nbChantiers', type: 'number' },
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
              const caReel = chantiers
                .filter(c => new Date(c.dateDebut).getFullYear() === annee && calculerCA(c, devis) !== null)
                .reduce((t, c) => t + calculerCA(c, devis), 0);
              const pctCA = objectifs.caAnnuel > 0 ? Math.min((caReel / objectifs.caAnnuel) * 100, 100) : 0;
              const margeReelle = parseFloat(margeNettePct) || 0;
              const pctMarge = objectifs.margeCible > 0 ? Math.min((margeReelle / objectifs.margeCible) * 100, 100) : 0;
              const nbChantiersReel = chantiers.filter(c => new Date(c.dateDebut).getFullYear() === annee).length;
              const pctNb = objectifs.nbChantiers > 0 ? Math.min((nbChantiersReel / objectifs.nbChantiers) * 100, 100) : 0;

              return [
                { label: 'CA annuel', cible: `CHF ${fmtN(Math.round(objectifs.caAnnuel))}`, reel: `CHF ${fmtN(Math.round(caReel))}`, pct: pctCA, couleur: pctCA >= 80 ? '#10b981' : pctCA >= 50 ? '#f59e0b' : '#ef4444' },
                { label: 'Marge nette', cible: `${objectifs.margeCible}%`, reel: `${margeReelle}%`, pct: pctMarge, couleur: pctMarge >= 80 ? '#10b981' : pctMarge >= 50 ? '#f59e0b' : '#ef4444' },
                { label: 'Chantiers', cible: `${objectifs.nbChantiers}`, reel: `${nbChantiersReel}`, pct: pctNb, couleur: pctNb >= 80 ? '#10b981' : pctNb >= 50 ? '#f59e0b' : '#ef4444' },
              ].map(item => (
                <div key={item.label} className="premium-card" style={{
                  background: `linear-gradient(145deg, ${item.couleur}12 0%, rgba(255,255,255,0.025) 100%)`,
                  border: `1px solid ${item.couleur}28`, borderRadius: 14, padding: '22px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${item.couleur}45 50%, transparent)` }} />
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>{item.reel}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cible: {item.cible}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(90deg, ${item.couleur}, ${item.couleur}cc)`, width: `${item.pct}%`, height: '100%', borderRadius: 8, boxShadow: `0 0 8px ${item.couleur}55`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, color: item.couleur, fontWeight: 700, marginTop: 6 }}>{item.pct.toFixed(0)}% de l'objectif atteint</div>
                </div>
              ));
            })()}
          </div>

          {/* Chantiers classifiés par rentabilité */}
          <div style={carteStyle}>
            <div className="ds-card-title">📊 Rentabilité par chantier — Vue d'ensemble</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {['Rentable', 'Limite', 'Non rentable'].map(label => {
                const count = donneesChantiers.filter(c => statutRentabilite(c.couts.margeReelPct).label === label).length;
                const couleurs = { Rentable: '#10b981', Limite: '#f59e0b', 'Non rentable': '#ef4444' };
                return (
                  <div key={label} style={{ background: couleurs[label] + '12', border: `1px solid ${couleurs[label]}30`, borderRadius: 12, padding: '14px 20px', flex: 1, minWidth: 120, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: couleurs[label] }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                  </div>
                );
              })}
            </div>
            {donneesChantiers.filter(c => statutRentabilite(c.couts.margeReelPct).label !== 'Rentable').length > 0 && (
              <>
                <div className="ds-section-label" style={{ marginBottom: 12 }}>⚠️ Chantiers nécessitant attention</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {donneesChantiers
                    .filter(c => statutRentabilite(c.couts.margeReelPct).label !== 'Rentable')
                    .sort((a, b) => parseFloat(a.couts.margeReelPct) - parseFloat(b.couts.margeReelPct))
                    .map(c => {
                      const r = statutRentabilite(c.couts.margeReelPct);
                      return (
                        <div key={c.id} className="premium-card" style={{
                          background: `linear-gradient(135deg, ${r.couleur}0a 0%, rgba(255,255,255,0.025) 100%)`,
                          border: `1px solid ${r.couleur}28`, borderLeft: `3px solid ${r.couleur}`,
                          borderRadius: 10, padding: '14px 18px',
                          display: 'flex', alignItems: 'center', gap: 16,
                        }}>
                          <span style={{ background: r.couleur + '22', color: r.couleur, border: `1px solid ${r.couleur}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{r.label}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{c.nom}</div>
                            {c.depassements.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.depassements.join(' · ')}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: r.couleur }}>{c.couts.margeReelPct}%</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>marge réelle</div>
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
    </div>
  );
}
