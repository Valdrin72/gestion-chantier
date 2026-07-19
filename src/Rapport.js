import React, { useState, useMemo } from 'react';
import { fmtN, calculerCoutsChantier, calculerCA, getAlerte, calculerDateFinOuvrables, isChantierActif } from './donnees';
import { DS } from './ds';
import { joursReelsChantier } from './calculs/pointagesHelper';
import { useApp } from './context/AppContext';
import useIsMobile from './hooks/useIsMobile';

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

export default function Rapport({ chantiers, clients, devis = [], parametres, paiementsData }) {
  const { pointages = [] } = useApp();
  const [semaine] = useState(getSemaine());
  const isMobile = useIsMobile();
  const semaineSuivante = getSemaineSuivante();

  // ===== CALCULS =====
  const chantiersEnCours = useMemo(() => chantiers.filter(isChantierActif), [chantiers]);
  const chantiersPlanifies = useMemo(() => chantiers.filter(c => c.statut?.trim().toLowerCase() === 'planifié'), [chantiers]);

  const alertes = useMemo(() => chantiers.filter(c => {
    const r = joursReelsChantier(pointages, c.id);
    const j = c.nombreJours > 0 ? c.nombreJours - r : null;
    return j !== null && j <= (parametres.parametres?.joursAlerte || 5) && c.statut?.trim().toLowerCase() !== 'terminé';
  }), [chantiers, parametres, pointages]);

  const caTotal = useMemo(() => {
    return chantiers.reduce((t, c) => {
      const ca = calculerCA(c, devis);
      return t + (ca !== null ? ca : 0);
    }, 0);
  }, [chantiers, devis]);

  const getPaiements = (chantierId) => paiementsData[chantierId] || [];
  const isPaye = (p) => ['payé', 'payee', 'payée'].includes(p.statut?.trim().toLowerCase());
  const isAttente = (p) => ['en attente', 'envoyee', 'envoyée', 'partielle', 'retard'].includes(p.statut?.trim().toLowerCase());
  const { totalPaiementsRecus, totalPaiementsAttente, totalPaiementsRetard } = useMemo(() => {
    const today = new Date();
    let recus = 0, attente = 0, retard = 0;
    chantiers.forEach(c => {
      getPaiements(c.id).forEach(p => {
        const m = parseFloat(p.montant) || 0;
        if (isPaye(p)) recus += m;
        else if (isAttente(p)) {
          attente += m;
          if (new Date(p.dateEcheance) < today) retard += m;
        }
      });
    });
    return { totalPaiementsRecus: recus, totalPaiementsAttente: attente, totalPaiementsRetard: retard };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiers, paiementsData]);


  const chantiersSemaineProchaine = chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const debut = new Date(c.dateDebut);
    const debutSP = new Date(semaineSuivante.debut);
    const finSP = new Date(semaineSuivante.fin);
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi));
    return debut <= finSP && fin >= debutSP;
  });

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
          <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '16px', marginBottom: '10px' }}>{alertes.length} alerte(s) urgente(s) cette semaine !</div>
          {alertes.map(c => {
            const r = joursReelsChantier(pointages, c.id);
            const j = c.nombreJours > 0 ? c.nombreJours - r : null;
            const al = getAlerte(j);
            return <div key={c.id} style={{ color: '#ef4444', marginBottom: '4px' }}>› <strong>{c.nom}</strong> — {al?.texte}</div>;
          })}
        </div>
      )}

      {/* KPIs — gradients saturés */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'EN COURS',      val: chantiersEnCours.length,      gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', glow: 'rgba(59,130,246,0.32)', badge: `${chantiersPlanifies.length} planifiés` },
          { label: 'CA TOUS CHANTIERS', val: `CHF ${fmtN(caTotal)}`,        gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: 'rgba(16,185,129,0.32)', badge: `CHF ${fmtN(totalPaiementsRecus)} reçus` },
          { label: 'EN ATTENTE',    val: `CHF ${fmtN(totalPaiementsAttente)}`, gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', glow: 'rgba(245,158,11,0.32)' },
          { label: 'EN RETARD',     val: `CHF ${fmtN(totalPaiementsRetard)}`,  gradient: totalPaiementsRetard > 0 ? 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)' : 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: totalPaiementsRetard > 0 ? 'rgba(239,68,68,0.32)' : 'rgba(16,185,129,0.32)' },
        ].map(k => (
          <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, position: 'relative' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
            {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
          </div>
        ))}
      </div>

      {/* CHANTIERS EN COURS */}
      <div style={carteStyle}>
        <div className="ds-card-title">Chantiers en cours</div>
        {chantiersEnCours.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Aucun chantier en cours</p> : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 480 : 'unset' }}>
            <thead><tr>
              {['Chantier', 'Client', 'Avancement', 'Jours restants', 'Marge'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {chantiersEnCours.map((c, i) => {
                const r = joursReelsChantier(pointages, c.id);
                const j = c.nombreJours > 0 ? c.nombreJours - r : null;
                const al = getAlerte(j);
                const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
                const client = clients.find(cl => String(cl.id) === String(c.clientId));
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                    <td style={{ padding: '12px 15px' }}><strong>{c.nom}</strong><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.numero}</div></td>
                    <td style={{ padding: '12px 15px' }}>{client?.entreprise || '-'}</td>
                    <td style={{ padding: '12px 15px' }}>
                      {(() => {
                        const _statutL = (c.statut || '').trim().toLowerCase();
                        const _clos = ['terminé', 'termine', 'clôturé', 'cloture', 'facturé', 'facture'].includes(_statutL);
                        const avancementJournal = c.nombreJours > 0 ? Math.min(100, Math.round((r / c.nombreJours) * 100)) : 0;
                        const progress = _clos ? 100 : Math.max(0, Math.min(100, avancementJournal || Number(c.avancement ?? 0)));
                        let color = '#ef4444';
                        if (progress > 30) color = '#f59e0b';
                        if (progress > 70) color = '#22c55e';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'var(--border)', borderRadius: '10px', height: '8px', width: '80px', overflow: 'hidden' }}>
                              <div style={{ background: `linear-gradient(90deg, ${color}, ${color}cc)`, width: `${progress}%`, height: '8px', borderRadius: '10px', transition: 'width 0.4s ease', boxShadow: `0 0 8px ${color}` }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>{progress}%</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ color: al ? al.couleur : '#10b981', fontWeight: 700 }}>
                        {j !== null ? `${j}j` : '-'}
                      </span>
                      {al && <div style={{ fontSize: '11px', color: al.couleur }}>{al.texte}</div>}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ background: (parseFloat(couts.margeActuellePct) >= 15 ? '#10b98118' : '#ef444418'), color: parseFloat(couts.margeActuellePct) >= 15 ? '#10b981' : '#ef4444', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {couts.margeActuellePct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* PAIEMENTS */}
      <div style={carteStyle}>
        <div className="ds-card-title">Paiements de la semaine</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--g3)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Reçus', val: `CHF ${fmtN(totalPaiementsRecus)}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
            { label: 'En attente', val: `CHF ${fmtN(totalPaiementsAttente)}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
            { label: 'En retard', val: `CHF ${fmtN(totalPaiementsRetard)}`, couleur: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '10px', padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.couleur, marginTop: '5px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* LISTE PAIEMENTS EN RETARD */}
        {totalPaiementsRetard > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Paiements en retard à relancer</div>
            {chantiers.map(c => {
              const today = new Date();
              const retards = getPaiements(c.id).filter(p => isAttente(p) && new Date(p.dateEcheance) < today);
              if (retards.length === 0) return null;
              const client = clients.find(cl => String(cl.id) === String(c.clientId));
              return (
                <div key={c.id} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#ef4444' }}>{c.nom} — {client?.entreprise}</div>
                  {retards.map(p => (
                    <div key={p.id} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {p.type} — <strong>CHF {fmtN(parseFloat(p.montant))}</strong> — Échéance : {p.dateEcheance}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PRÉVISIONS SEMAINE SUIVANTE */}
      <div style={carteStyle}>
        <div className="ds-card-title">Prévisions — Semaine du {semaineSuivante.label}</div>
        {chantiersSemaineProchaine.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Aucun chantier planifié pour la semaine prochaine</p>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 480 : 'unset' }}>
            <thead><tr>
              {['Chantier', 'Client', 'Début', 'Fin prévue', 'Budget', 'Statut'].map(h => (
                <th key={h} style={DS.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {chantiersSemaineProchaine.map((c, i) => {
                const client = clients.find(cl => String(cl.id) === String(c.clientId));
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--ds-td-border)' }}>
                    <td style={{ padding: '12px 15px' }}><strong>{c.nom}</strong></td>
                    <td style={{ padding: '12px 15px' }}>{client?.entreprise || '-'}</td>
                    <td style={{ padding: '12px 15px' }}>{c.dateDebut}</td>
                    <td style={{ padding: '12px 15px' }}>{calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi)}</td>
                    <td style={{ padding: '12px 15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {calculerCA(c, devis) !== null ? `CHF ${fmtN(calculerCA(c, devis))}` : '— Aucun devis lié'}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ background: (isChantierActif(c) ? '#f59e0b' : '#0d3d6e') + '18', color: isChantierActif(c) ? '#f59e0b' : '#0d3d6e', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>
                        {c.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
