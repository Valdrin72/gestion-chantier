import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { calculerCoutsChantier, calculerCA, C, fmtN, getIntervallesPeriode, getPeriodeLabel, chantiersInPeriode, calculerEcartChantier, calculerRentabiliteEquipe } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;
const COULEURS_GRAPHIQUE = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#06b6d4', '#f59e0b'];

// Palette sémantique : CA = bleu, Coûts = violet, Marge = vert
const COL_CA    = '#3b82f6';
const COL_COUT  = '#8b5cf6';
const COL_MARGE = '#10b981';

export default function Statistiques({ chantiers, clients, devis = [], parametres, periodeGlobale = 'annee' }) {
  const anneeActuelle = new Date().getFullYear();
  const [periode, setPeriode] = useState(String(anneeActuelle));

  // ===== CHANTIERS FILTRÉS PAR PÉRIODE GLOBALE =====
  const chantiersFiltres = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return chantiers.filter(c => chantiersInPeriode(c, debut, fin));
  }, [chantiers, periodeGlobale]);

  // ===== CALCULS GLOBAUX (sur chantiers filtrés, uniquement ceux avec devis) =====
  const filtresAvecDevis = chantiersFiltres.filter(c => calculerCA(c, devis) !== null);
  const nbSansDevis = chantiersFiltres.length - filtresAvecDevis.length;
  const caTotal = filtresAvecDevis.reduce((t, c) => t + calculerCA(c, devis), 0);
  const coutsTotaux = filtresAvecDevis.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
  const rentabilite = caTotal - coutsTotaux;
  const margeGlobale = caTotal > 0 ? ((rentabilite / caTotal) * 100).toFixed(1) : 0;
  const couleurMarge = (pct) => parseFloat(pct) >= 20 ? C.secondaire : parseFloat(pct) >= 15 ? C.warning : C.danger;

  // ===== DONNÉES MENSUELLES (sur chantiers filtrés avec devis) =====
  const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const donneesMensuelles = mois.map((m, i) => {
    const tousMois = chantiersFiltres.filter(c => {
      const d = new Date(c.dateDebut);
      return d.getMonth() === i && d.getFullYear() === parseInt(periode);
    });
    const avecDevisMois = tousMois.filter(c => calculerCA(c, devis) !== null);
    const ca = avecDevisMois.reduce((t, c) => t + calculerCA(c, devis), 0);
    const couts = avecDevisMois.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const marge = ca - couts;
    const margePct = ca > 0 ? ((marge / ca) * 100).toFixed(1) : 0;
    return { mois: m, CA: ca, Coûts: couts, Marge: marge, 'Marge %': parseFloat(margePct), chantiers: tousMois.length };
  });

  // ===== DONNÉES PAR TYPE DE TRAVAUX (uniquement chantiers avec devis) =====
  const donneesTravaux = parametres.typesTravaux.map(t => {
    const tous = chantiersFiltres.filter(c => (c.typesTravaux || []).includes(t.nom));
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const ca = avecDevis.reduce((s, c) => s + calculerCA(c, devis), 0);
    const couts = avecDevis.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    const m2 = avecDevis.reduce((s, c) => s + (parseFloat(c.surface) || 0), 0);
    return { nom: t.nom, CA: ca, Coûts: couts, Marge: ca - couts, m2, count: tous.length, nbAvecDevis: avecDevis.length, margePct: ca > 0 ? (((ca - couts) / ca) * 100).toFixed(1) : 0 };
  }).filter(t => t.count > 0);

  // ===== DONNÉES CLIENTS (uniquement chantiers avec devis pour le CA) =====
  const donneesClients = clients.map(cl => {
    const tous = chantiersFiltres.filter(c => c.clientId === cl.id);
    const avecDevis = tous.filter(c => calculerCA(c, devis) !== null);
    const ca = avecDevis.reduce((s, c) => s + calculerCA(c, devis), 0);
    const couts = avecDevis.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
    return { nom: cl.entreprise || `${cl.prenom} ${cl.nom}`, CA: ca, Marge: ca - couts, chantiers: tous.length };
  }).filter(c => c.CA > 0).sort((a, b) => b.CA - a.CA);

  // ===== DONNÉES EMPLOYÉS (top utilisés + coût moyen) =====
  const donneesEmployes = parametres.employes
    .filter(emp => emp.actif !== false)
    .map(emp => {
      const chantiersEmp = chantiersFiltres.filter(c =>
        (c.equipe || []).some(m => parseInt(m.employeId) === emp.id)
      );
      let joursTotaux = 0;
      let coutTotal = 0;
      chantiersEmp.forEach(c => {
        const eq = calculerRentabiliteEquipe(c, parametres);
        const membre = eq.membres.find(m => parseInt(m.employeId) === emp.id);
        if (membre) {
          joursTotaux += membre.joursRealises;
          coutTotal   += membre.coutTotal;
        }
      });
      return {
        nom: emp.nom,
        poste: emp.poste || '—',
        tarifJour: emp.tarifJour,
        nbChantiers: chantiersEmp.length,
        joursTotaux,
        coutTotal,
        coutMoyenParChantier: chantiersEmp.length > 0 ? Math.round(coutTotal / chantiersEmp.length) : 0,
      };
    })
    .filter(e => e.nbChantiers > 0)
    .sort((a, b) => b.coutTotal - a.coutTotal);

  // ===== PRÉVISIONS =====
  const moisActuel = new Date().getMonth();
  const caRealise = donneesMensuelles.slice(0, moisActuel + 1).reduce((t, m) => t + m.CA, 0);
  const moyenneMensuelle = moisActuel > 0 ? caRealise / (moisActuel + 1) : 0;
  const previsionAnnuelle = moyenneMensuelle * 12;
  const prevision3Mois = moyenneMensuelle * 3;

  // ── Écarts prévu vs réel (uniquement chantiers avec joursRealises > 0) ──
  const donneesEcarts = chantiersFiltres
    .filter(c => parseInt(c.joursRealises) > 0 && parseInt(c.nombreJours) > 0)
    .map(c => {
      const ec = calculerEcartChantier(c);
      return {
        nom: (c.nom || c.numero || '—').substring(0, 18),
        Prévus: ec.joursPrevu,
        Réalisés: ec.joursRealises,
        ecartJours: ec.ecartJours,
        ecartPct: ec.ecartPct,
        statut: ec.statut,
      };
    })
    .sort((a, b) => b.ecartJours - a.ecartJours); // dépassements en tête

  const moyenneEcart = donneesEcarts.length > 0
    ? parseFloat((donneesEcarts.reduce((s, d) => s + d.ecartJours, 0) / donneesEcarts.length).toFixed(1))
    : null;

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Statistiques & Pilotage</div>
          <div className="page-title-sub">Analyse de performance — {getPeriodeLabel(periodeGlobale)}</div>
        </div>
        <div className="page-actions-group">
          <select value={periode} onChange={e => setPeriode(e.target.value)} style={{ ...DS.input, width: 'auto' }}>
            {[anneeActuelle - 2, anneeActuelle - 1, anneeActuelle, anneeActuelle + 1].map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs GLOBAUX */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
        {[
          { titre: "CA Total", valeur: `CHF ${fmtN(caTotal)}`, couleur: COL_CA, icone: 'info' },
          { titre: "Total coûts", valeur: `CHF ${fmtN(coutsTotaux)}`, couleur: COL_COUT, icone: 'info' },
          { titre: "Rentabilité", valeur: `CHF ${fmtN(rentabilite)}`, couleur: rentabilite >= 0 ? '#10b981' : C.danger, icone: 'info' },
          { titre: "Marge globale", valeur: `${margeGlobale}%`, couleur: couleurMarge(margeGlobale), icone: '' },
          { titre: "Chantiers", valeur: `${filtresAvecDevis.length} / ${chantiersFiltres.length}`, sub: nbSansDevis > 0 ? `${nbSansDevis} sans devis` : null, couleur: C.info, icone: 'info' },
          { titre: "Prévision 3 mois", valeur: `CHF ${fmtN(Math.round(prevision3Mois))}`, couleur: C.violet, icone: 'info' },
        ].map(s => (
          <div key={s.titre} style={{
            background: `linear-gradient(145deg, ${s.couleur}0a 0%, rgba(255,255,255,0.028) 60%, rgba(255,255,255,0.02) 100%)`,
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            border: `1px solid ${s.couleur}28`,
            borderRadius: 16, padding: '22px', flex: 1, minWidth: 150,
            boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${s.couleur}28 0%, ${s.couleur}14 100%)`,
              border: `1px solid ${s.couleur}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, marginBottom: 14,
              boxShadow: `0 0 18px ${s.couleur}28`,
            }}>{s.icone}</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 8 }}>{s.titre}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>{s.valeur}</div>
            {s.sub && <div style={{ fontSize: 10, fontWeight: 600, color: C.warning, marginTop: 5 }}>{s.sub}</div>}
          </div>
        ))}
      </div>
      {nbSansDevis > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: C.warning, fontWeight: 600 }}>
          {nbSansDevis} chantier{nbSansDevis > 1 ? 's' : ''} exclu{nbSansDevis > 1 ? 's' : ''} des totaux financiers — aucun devis lié.
        </div>
      )}

      {/* GRAPHIQUE CA MENSUEL */}
      <div style={carteStyle}>
        <div className="ds-card-title">Chiffre d'affaires mensuel {periode}</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={donneesMensuelles} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="mois" tick={{ fill: '#8892a4' }} />
            <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: '#8892a4' }} />
            <Tooltip content={() => null} />
            <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
            <Bar dataKey="CA"     fill={COL_CA}    name="CA"     radius={[4, 4, 0, 0]} />
            <Bar dataKey="Coûts" fill={COL_COUT}  name="Coûts"  radius={[4, 4, 0, 0]} />
            <Bar dataKey="Marge" fill={COL_MARGE} name="Marge"  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* GRAPHIQUE ÉVOLUTION MARGE */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 16 }}>Évolution de la marge (%)</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={donneesMensuelles.filter(m => m.CA > 0)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="mois" tick={{ fill: '#8892a4' }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#8892a4' }} />
            <Tooltip content={() => null} />
            <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
            <Line type="monotone" dataKey="Marge %" stroke={COL_MARGE} strokeWidth={3} dot={{ fill: COL_MARGE, r: 6 }} name="Marge %" />
          </LineChart>
        </ResponsiveContainer>

        {/* SEUILS */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
          {[
            { label: 'Bon', seuil: '≥ 20%', couleur: C.secondaire },
            { label: 'À surveiller', seuil: '15-19%', couleur: C.warning },
            { label: 'Critique', seuil: '< 15%', couleur: C.danger },
          ].map(s => (
            <div key={s.label} style={{ background: s.couleur + '12', border: `1px solid ${s.couleur}30`, borderRadius: '12px', padding: '12px 20px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: s.couleur, fontSize: '13px' }}>{s.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: 3 }}>{s.seuil}</div>
            </div>
          ))}
        </div>
      </div>

      {/* GRAPHIQUES CÔTE À CÔTE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* CAMEMBERT PAR TYPE DE TRAVAUX */}
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: 16 }}>Répartition par travaux</div>
          {donneesTravaux.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée</p> : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={donneesTravaux} dataKey="CA" nameKey="nom" cx="50%" cy="50%" outerRadius={100} label={({ nom, percent }) => `${nom.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}>
                    {donneesTravaux.map((t, i) => <Cell key={t.nom} fill={COULEURS_GRAPHIQUE[i % COULEURS_GRAPHIQUE.length]} />)}
                  </Pie>
                  <Tooltip content={() => null} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {donneesTravaux.map((t, i) => (
                  <div key={t.nom} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COULEURS_GRAPHIQUE[i % COULEURS_GRAPHIQUE.length] }} />
                    <span>{t.nom}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CAMEMBERT CLIENTS */}
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: 16 }}>Répartition par client</div>
          {donneesClients.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée</p> : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={donneesClients} dataKey="CA" nameKey="nom" cx="50%" cy="50%" outerRadius={100} label={({ nom, percent }) => `${nom.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}>
                    {donneesClients.map((c, i) => <Cell key={c.nom} fill={COULEURS_GRAPHIQUE[i % COULEURS_GRAPHIQUE.length]} />)}
                  </Pie>
                  <Tooltip content={() => null} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {donneesClients.map((c, i) => (
                  <div key={c.nom} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COULEURS_GRAPHIQUE[i % COULEURS_GRAPHIQUE.length] }} />
                    <span>{c.nom}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* PRÉVISIONS */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 16 }}>Prévisions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          {[
            { label: 'CA réalisé',        valeur: `CHF ${fmtN(Math.round(caRealise))}`,      couleur: COL_CA },
            { label: 'Moyenne mensuelle', valeur: `CHF ${fmtN(Math.round(moyenneMensuelle))}`, couleur: COL_CA },
            { label: 'Prévision 3 mois',  valeur: `CHF ${fmtN(Math.round(prevision3Mois))}`,  couleur: COL_CA },
            { label: 'Prévision annuelle', valeur: `CHF ${fmtN(Math.round(previsionAnnuelle))}`, couleur: COL_CA },
          ].map(s => (
            <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}28`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{s.valeur}</div>
            </div>
          ))}
        </div>

        {/* GRAPHIQUE PRÉVISIONS */}
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={[
            ...donneesMensuelles.slice(0, moisActuel + 1).map(m => ({ ...m, type: 'Réalisé' })),
            ...donneesMensuelles.slice(moisActuel + 1).map(m => ({ ...m, CA: Math.round(moyenneMensuelle), type: 'Prévision' }))
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="mois" tick={{ fill: '#8892a4' }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: '#8892a4' }} />
            <Tooltip content={() => null} />
            <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
            <Bar dataKey="CA" name="CA Réalisé / Prévu" radius={[4, 4, 0, 0]} fill={COL_CA} label={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TABLEAU RENTABILITÉ PAR TRAVAUX */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 16 }}>Rentabilité par type de travaux</div>
        {donneesTravaux.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Type', 'Chantiers', 'm²', 'CA', 'Coûts', 'Marge %', 'Gain CHF', 'Statut'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {donneesTravaux.map((t) => (
                <tr key={t.nom} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 15px' }}><strong>{t.nom}</strong></td>
                  <td style={{ padding: '10px 15px' }}>{t.count}</td>
                  <td style={{ padding: '10px 15px' }}>{t.m2} m²</td>
                  <td style={{ padding: '10px 15px', color: COL_CA, fontWeight: 700 }}>CHF {fmtN(t.CA)}</td>
                  <td style={{ padding: '10px 15px', color: COL_COUT, fontWeight: 700 }}>CHF {fmtN(t.Coûts)}</td>
                  <td style={{ padding: '10px 15px' }}>
                    <span style={{ background: couleurMarge(t.margePct) + '18', color: couleurMarge(t.margePct), padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{t.margePct}%</span>
                  </td>
                  <td style={{ padding: '10px 15px', color: t.Marge >= 0 ? C.secondaire : C.danger, fontWeight: 'bold' }}>CHF {fmtN(t.Marge)}</td>
                  <td style={{ padding: '10px 15px' }}>
                    {parseFloat(t.margePct) >= 20 ? 'Bon' : parseFloat(t.margePct) >= 15 ? 'À surveiller' : 'Critique'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PRÉVU VS RÉEL — ÉCARTS JOURS */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 4 }}>Prévu vs Réel — Écart des jours</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Comparaison entre l'estimation du devis et les jours effectivement réalisés. Permet d'améliorer les futurs devis.
        </div>

        {donneesEcarts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucun chantier avec des jours réalisés saisis dans cette période.
          </p>
        ) : (
          <>
            {/* Résumé synthèse */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                {
                  label: 'Chantiers analysés',
                  val: donneesEcarts.length,
                  couleur: C.primaire,
                },
                {
                  label: 'En dépassement',
                  val: donneesEcarts.filter(d => d.statut === 'en_retard').length,
                  couleur: C.danger,
                },
                {
                  label: 'En avance',
                  val: donneesEcarts.filter(d => d.statut === 'en_avance').length,
                  couleur: C.secondaire,
                },
                {
                  label: 'Moy. écart / chantier',
                  val: moyenneEcart === null ? '—'
                    : moyenneEcart === 0 ? '0j'
                    : `${moyenneEcart > 0 ? '+' : ''}${moyenneEcart}j`,
                  couleur: moyenneEcart === null ? '#78909c'
                    : moyenneEcart > 0 ? C.danger
                    : moyenneEcart < 0 ? C.secondaire
                    : '#78909c',
                },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 140, background: s.couleur + '10', border: `1px solid ${s.couleur}28`, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.couleur, letterSpacing: '-0.5px', lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Graphique barres groupées : Prévus vs Réalisés */}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={donneesEcarts} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="nom" tick={{ fill: '#8892a4', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#8892a4' }} unit="j" />
                <Tooltip content={() => null} />
                <Legend wrapperStyle={{ color: 'var(--text-primary)', paddingTop: 8 }} />
                <Bar dataKey="Prévus"   fill="#3b82f6" name="Prévus (devis)"   radius={[4, 4, 0, 0]} />
                <Bar dataKey="Réalisés" name="Réalisés (réel)" radius={[4, 4, 0, 0]}>
                  {donneesEcarts.map((d, i) => (
                    <Cell key={`cell-${i}`} fill={d.statut === 'en_retard' ? '#ef4444' : d.statut === 'en_avance' ? '#10b981' : '#78909c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Tableau détail */}
            <div style={{ marginTop: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Chantier', 'Prévus', 'Réalisés', 'Écart', 'Écart %', 'Statut'].map(h => (
                    <th key={h} style={DS.th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {donneesEcarts.map((d) => {
                    const couleurEc = d.statut === 'en_retard' ? C.danger : d.statut === 'en_avance' ? C.secondaire : '#78909c';
                    const statutLabel = { en_retard: 'Dépassement', en_avance: 'En avance', ok: 'Conforme' }[d.statut] || d.statut;
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 15px', fontWeight: 600 }}>{d.nom}</td>
                        <td style={{ padding: '10px 15px', color: C.primaire, fontWeight: 700 }}>{d.Prévus}j</td>
                        <td style={{ padding: '10px 15px', color: couleurEc, fontWeight: 700 }}>{d.Réalisés}j</td>
                        <td style={{ padding: '10px 15px', fontWeight: 800, color: couleurEc }}>
                          {d.ecartJours > 0 ? `+${d.ecartJours}` : d.ecartJours}j
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          {d.ecartPct !== null && (
                            <span style={{ background: couleurEc + '18', color: couleurEc, padding: '2px 9px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                              {d.ecartPct > 0 ? '+' : ''}{d.ecartPct}%
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 15px', fontSize: 12 }}>{statutLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CLASSEMENT CLIENTS */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 16 }}>Classement clients</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Rang', 'Client', 'Chantiers', 'CA Total', 'Marge %', 'Gain CHF'].map(h => (
              <th key={h} style={DS.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {donneesClients.map((c, i) => (
              <tr key={c.nom} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                <td style={{ padding: '10px 15px' }}>{i === 0 ? '1er' : i === 1 ? '2e' : i === 2 ? '3e' : `${i + 1}`}</td>
                <td style={{ padding: '10px 15px' }}><strong>{c.nom}</strong></td>
                <td style={{ padding: '10px 15px' }}>{c.chantiers}</td>
                <td style={{ padding: '10px 15px', fontWeight: 700, color: COL_CA }}>CHF {fmtN(c.CA)}</td>
                <td style={{ padding: '10px 15px' }}>
                  <span style={{ background: couleurMarge(c.CA > 0 ? ((c.Marge / c.CA) * 100).toFixed(1) : 0) + '18', color: couleurMarge(c.CA > 0 ? ((c.Marge / c.CA) * 100).toFixed(1) : 0), padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {c.CA > 0 ? ((c.Marge / c.CA) * 100).toFixed(1) : 0}%
                  </span>
                </td>
                <td style={{ padding: '10px 15px', color: c.Marge >= 0 ? C.secondaire : C.danger, fontWeight: 'bold' }}>CHF {fmtN(c.Marge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* TOP EMPLOYÉS */}
      <div style={carteStyle}>
        <div className="ds-card-title" style={{ marginBottom: 4 }}>Analyse par employé</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Jours travaillés, coût total et coût moyen par chantier — sur la période sélectionnée.
        </div>

        {donneesEmployes.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Aucun employé mobilisé dans cette période.</p>
        ) : (
          <>
            {/* Graphique barres horizontales — coût total par employé */}
            <div style={{ marginBottom: 20 }}>
              {donneesEmployes.map((emp, i) => {
                const maxCout = donneesEmployes[0].coutTotal;
                const pct = maxCout > 0 ? (emp.coutTotal / maxCout) * 100 : 0;
                const couleur = i === 0 ? C.danger : i === 1 ? C.warning : C.primaire;
                return (
                  <div key={emp.nom} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{emp.nom}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{emp.poste}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.nbChantiers} chantier{emp.nbChantiers > 1 ? 's' : ''} · {emp.joursTotaux}j</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: couleur }}>CHF {fmtN(emp.coutTotal)}</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${couleur}cc, ${couleur}66)`, borderRadius: 6, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tableau détaillé */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Employé', 'Poste', 'Tarif/j', 'Chantiers', 'Jours totaux', 'Coût total', 'Moy./chantier'].map(h => (
                  <th key={h} style={DS.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {donneesEmployes.map((emp, i) => {
                  const couleur = i === 0 ? C.danger : i === 1 ? C.warning : 'var(--text-primary)';
                  return (
                    <tr key={emp.nom} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 15px', fontWeight: 700, color: couleur }}>{emp.nom}</td>
                      <td style={{ padding: '10px 15px', color: 'var(--text-muted)', fontSize: 12 }}>{emp.poste}</td>
                      <td style={{ padding: '10px 15px' }}>CHF {fmtN(emp.tarifJour)}</td>
                      <td style={{ padding: '10px 15px', textAlign: 'center' }}>{emp.nbChantiers}</td>
                      <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 600 }}>{emp.joursTotaux}j</td>
                      <td style={{ padding: '10px 15px', fontWeight: 800, color: couleur }}>CHF {fmtN(emp.coutTotal)}</td>
                      <td style={{ padding: '10px 15px' }}>
                        <span style={{ background: C.violet + '18', color: C.violet, padding: '2px 9px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                          CHF {fmtN(emp.coutMoyenParChantier)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
