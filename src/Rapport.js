import React, { useState } from 'react';
import { C, fmtN, calculerCoutsChantier, calculerCA, joursOuvrableRestants, getAlerte, calculerDateFinOuvrables, isChantierActif } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;

const getSemaine = () => {
  const now = new Date();
  const lundi = new Date(now);
  lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const vendredi = new Date(lundi);
  vendredi.setDate(lundi.getDate() + 4);
  return {
    debut: lundi.toISOString().split('T')[0],
    fin: vendredi.toISOString().split('T')[0],
    label: `${lundi.toLocaleDateString('fr-CH')} — ${vendredi.toLocaleDateString('fr-CH')}`
  };
};

const getSemaineSuivante = () => {
  const now = new Date();
  const lundi = new Date(now);
  lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 7);
  const vendredi = new Date(lundi);
  vendredi.setDate(lundi.getDate() + 4);
  return {
    debut: lundi.toISOString().split('T')[0],
    fin: vendredi.toISOString().split('T')[0],
    label: `${lundi.toLocaleDateString('fr-CH')} — ${vendredi.toLocaleDateString('fr-CH')}`
  };
};

export default function Rapport({ chantiers, clients, devis = [], parametres, paiementsData, qualiteData }) {
  const [semaine] = useState(getSemaine());
  const semaineSuivante = getSemaineSuivante();

  // ===== CALCULS =====
  const chantiersEnCours = chantiers.filter(isChantierActif);
  const chantiersPlanifies = chantiers.filter(c => c.statut === 'Planifié');

  const alertes = chantiers.filter(c => {
    const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
    return j !== null && j <= (parametres.parametres?.joursAlerte || 5) && c.statut !== 'Terminé';
  });

  const caTotal = chantiers.filter(c => calculerCA(c, devis) !== null).reduce((t, c) => t + calculerCA(c, devis), 0);

  const getPaiements = (chantierId) => paiementsData[chantierId] || [];
  const totalPaiementsRecus = chantiers.reduce((t, c) => {
    return t + getPaiements(c.id).filter(p => p.statut === 'Payé').reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  }, 0);
  const totalPaiementsAttente = chantiers.reduce((t, c) => {
    return t + getPaiements(c.id).filter(p => p.statut === 'En attente').reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  }, 0);
  const totalPaiementsRetard = chantiers.reduce((t, c) => {
    const today = new Date();
    return t + getPaiements(c.id).filter(p => p.statut === 'En attente' && new Date(p.dateEcheance) < today).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  }, 0);

  const getScoreQualite = (chantierId) => {
    const totalItems = 40;
    const coches = Object.values(qualiteData).filter((v, i) => {
      const key = Object.keys(qualiteData)[i];
      return key.startsWith(`${chantierId}_`) && !key.endsWith('_notes') && v === true;
    }).length;
    return totalItems > 0 ? Math.round((coches / totalItems) * 100) : 0;
  };

  const chantiersSemaineProchaine = chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const debut = new Date(c.dateDebut);
    const debutSP = new Date(semaineSuivante.debut);
    const finSP = new Date(semaineSuivante.fin);
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi));
    return debut <= finSP && fin >= debutSP;
  });

  const couleurScore = (pct) => pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* EN-TÊTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <div className="page-title-main">Rapport Hebdomadaire</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '5px' }}>Semaine du {semaine.label}</div>
        </div>
      </div>

      {/* ALERTES */}
      {alertes.length > 0 && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '16px', marginBottom: '10px' }}>⚠️ {alertes.length} alerte(s) urgente(s) cette semaine !</div>
          {alertes.map(c => {
            const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
            const al = getAlerte(j);
            return <div key={c.id} style={{ color: '#ef4444', marginBottom: '4px' }}>▶ <strong>{c.nom}</strong> — {al?.texte}</div>;
          })}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
        {[
          { icone: '🏗️', label: 'Chantiers en cours', valeur: chantiersEnCours.length, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
          { icone: '📅', label: 'Chantiers planifiés', valeur: chantiersPlanifies.length, couleur: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
          { icone: '💰', label: 'CA Total', valeur: `CHF ${fmtN(caTotal)}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
          { icone: '✅', label: 'Paiements reçus', valeur: `CHF ${fmtN(totalPaiementsRecus)}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
          { icone: '⏳', label: 'En attente', valeur: `CHF ${fmtN(totalPaiementsAttente)}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
          { icone: '🔴', label: 'En retard', valeur: `CHF ${fmtN(totalPaiementsRetard)}`, couleur: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '32px' }}>{s.icone}</div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: s.couleur }}>{s.valeur}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CHANTIERS EN COURS */}
      <div style={carteStyle}>
        <div className="ds-card-title">Chantiers en cours</div>
        {chantiersEnCours.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Aucun chantier en cours</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Chantier', 'Client', 'Avancement', 'Jours restants', 'Marge', 'Qualité'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {chantiersEnCours.map((c, i) => {
                const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
                const al = getAlerte(j);
                const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
                const client = clients.find(cl => cl.id === c.clientId);
                const scoreQ = getScoreQualite(c.id);
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 15px' }}><strong>{c.nom}</strong><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.numero}</div></td>
                    <td style={{ padding: '12px 15px' }}>{client?.entreprise || '-'}</td>
                    <td style={{ padding: '12px 15px' }}>
                      {(() => {
                        const progress = Math.max(0, Math.min(100, Number(c.avancement ?? 0)));
                        let color = '#ef4444';
                        if (progress > 30) color = '#f59e0b';
                        if (progress > 70) color = '#22c55e';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', height: '8px', width: '80px', overflow: 'hidden' }}>
                              <div style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)`, width: `${progress}%`, height: '8px', borderRadius: '10px', transition: 'width 0.4s ease', boxShadow: `0 0 8px ${color}` }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{progress}%</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ color: al ? al.couleur : '#10b981', fontWeight: 'bold' }}>
                        {j !== null ? `${j}j` : '-'}
                      </span>
                      {al && <div style={{ fontSize: '11px', color: al.couleur }}>{al.texte}</div>}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ background: (parseFloat(couts.margeReelPct) >= 15 ? '#10b98118' : '#ef444418'), color: parseFloat(couts.margeReelPct) >= 15 ? '#10b981' : '#ef4444', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {couts.margeReelPct}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ background: couleurScore(scoreQ) + '18', color: couleurScore(scoreQ), fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {scoreQ}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PAIEMENTS */}
      <div style={carteStyle}>
        <div className="ds-card-title">Paiements de la semaine</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          {[
            { label: '✅ Reçus', val: `CHF ${fmtN(totalPaiementsRecus)}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
            { label: '⏳ En attente', val: `CHF ${fmtN(totalPaiementsAttente)}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
            { label: '🔴 En retard', val: `CHF ${fmtN(totalPaiementsRetard)}`, couleur: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: s.couleur, marginTop: '5px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* LISTE PAIEMENTS EN RETARD */}
        {totalPaiementsRetard > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Paiements en retard à relancer</div>
            {chantiers.map(c => {
              const today = new Date();
              const retards = getPaiements(c.id).filter(p => p.statut === 'En attente' && new Date(p.dateEcheance) < today);
              if (retards.length === 0) return null;
              const client = clients.find(cl => cl.id === c.clientId);
              return (
                <div key={c.id} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#ef4444' }}>{c.nom} — {client?.entreprise}</div>
                  {retards.map(p => (
                    <div key={p.id} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      📞 {p.type} — <strong>CHF {fmtN(parseFloat(p.montant))}</strong> — Échéance : {p.dateEcheance}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUALITÉ */}
      <div style={carteStyle}>
        <div className="ds-card-title">Contrôle qualité en cours</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Chantier', 'Score qualité', 'Statut'].map(h => (
              <th key={h} style={DS.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {chantiersEnCours.map((c, i) => {
              const score = getScoreQualite(c.id);
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 15px' }}><strong>{c.nom}</strong></td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', height: '8px', width: '100px' }}>
                        <div style={{ background: `linear-gradient(90deg, ${couleurScore(score)}, ${couleurScore(score)}cc)`, width: `${score}%`, height: '8px', borderRadius: '10px', boxShadow: `0 0 6px ${couleurScore(score)}55` }} />
                      </div>
                      <span style={{ fontWeight: 'bold', color: couleurScore(score) }}>{score}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{ background: couleurScore(score) + '18', color: couleurScore(score), fontWeight: 600, padding: '3px 12px', borderRadius: '12px', fontSize: '12px' }}>
                      {score >= 80 ? '✅ Bon' : score >= 50 ? '⚠️ À améliorer' : '🔴 Critique'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PRÉVISIONS SEMAINE SUIVANTE */}
      <div style={carteStyle}>
        <div className="ds-card-title">Prévisions — Semaine du {semaineSuivante.label}</div>
        {chantiersSemaineProchaine.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Aucun chantier planifié pour la semaine prochaine</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Chantier', 'Client', 'Début', 'Fin prévue', 'Budget', 'Statut'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {chantiersSemaineProchaine.map((c, i) => {
                const client = clients.find(cl => cl.id === c.clientId);
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 15px' }}><strong>{c.nom}</strong></td>
                    <td style={{ padding: '12px 15px' }}>{client?.entreprise || '-'}</td>
                    <td style={{ padding: '12px 15px' }}>{c.dateDebut}</td>
                    <td style={{ padding: '12px 15px' }}>{calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi)}</td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {calculerCA(c, devis) !== null ? `CHF ${fmtN(calculerCA(c, devis))}` : '— Aucun devis lié'}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ background: (isChantierActif(c) ? '#f59e0b' : '#3b82f6') + '18', color: isChantierActif(c) ? '#f59e0b' : '#3b82f6', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {c.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
