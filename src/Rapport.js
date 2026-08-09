import React, { useState, useMemo } from 'react';
import { fmtN, calculerCoutsChantier, calculerCA, getAlerte, calculerDateFinOuvrables, isChantierActif, calculerStatutFacture, resumePaiementsFactures } from './donnees';
import { DS } from './ds';
import { joursReelsChantier } from './calculs/pointagesHelper';
import { useApp } from './context/AppContext';
import useIsMobile from './hooks/useIsMobile';
import { V1, mono, carteV1 } from './design/v1';

const carteStyle = carteV1;

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

export default function Rapport({ chantiers, clients, devis = [], parametres, factures = [] }) {
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

  // Encaissements lus depuis les FACTURES (source unique) — mêmes règles que les
  // KPIs de Finances, donc un seul et même nombre partout.
  const { totalPaiementsRecus, totalPaiementsAttente, totalPaiementsRetard } = useMemo(() => {
    const { recus, attente, retard } = resumePaiementsFactures(factures);
    return { totalPaiementsRecus: recus, totalPaiementsAttente: attente, totalPaiementsRetard: retard };
  }, [factures]);


  const chantiersSemaineProchaine = chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const debut = new Date(c.dateDebut);
    const debutSP = new Date(semaineSuivante.debut);
    const finSP = new Date(semaineSuivante.fin);
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi, c.canton ?? 'GE'));
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
          <div style={{ fontWeight: 700, color: V1.danger, fontSize: '16px', marginBottom: '10px' }}>{alertes.length} alerte(s) urgente(s) cette semaine !</div>
          {alertes.map(c => {
            const r = joursReelsChantier(pointages, c.id);
            const j = c.nombreJours > 0 ? c.nombreJours - r : null;
            const al = getAlerte(j);
            return <div key={c.id} style={{ color: V1.danger, marginBottom: '4px' }}>› <strong>{c.nom}</strong> — {al?.texte}</div>;
          })}
        </div>
      )}

      {/* KPIs — cartes v1 sobres (liseré coloré par état) */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'EN COURS',      val: chantiersEnCours.length,      couleur: V1.bleu, badge: `${chantiersPlanifies.length} planifiés` },
          { label: 'CA SIGNÉ TOUS CHANTIERS', val: `CHF ${fmtN(caTotal)}`,        couleur: V1.ok, badge: `CHF ${fmtN(totalPaiementsRecus)} reçus` },
          { label: 'EN ATTENTE',    val: `CHF ${fmtN(totalPaiementsAttente)}`, couleur: V1.warn },
          { label: 'EN RETARD',     val: `CHF ${fmtN(totalPaiementsRetard)}`,  couleur: totalPaiementsRetard > 0 ? V1.danger : V1.ok },
        ].map(k => (
          <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}`, padding: '20px', minHeight: 110 }}>
            <div style={{ fontSize: 9, color: V1.texteMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ ...mono(24, k.couleur, 700), lineHeight: 1 }}>{k.val}</div>
            {k.badge && <span style={{ ...mono(10, k.couleur, 700), display: 'inline-block', marginTop: 8, background: k.couleur + '18', borderRadius: 20, padding: '2px 9px' }}>{k.badge}</span>}
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
                        let color = V1.danger;
                        if (progress > 30) color = V1.warn;
                        if (progress > 70) color = V1.ok;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: V1.separation, borderRadius: '10px', height: '8px', width: '80px', overflow: 'hidden' }}>
                              <div style={{ background: color, width: `${progress}%`, height: '8px', borderRadius: '10px', transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ ...mono(13, V1.texte, 700) }}>{progress}%</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ ...mono(13, al ? al.couleur : V1.ok, 700) }}>
                        {j !== null ? `${j}j` : '-'}
                      </span>
                      {al && <div style={{ fontSize: '11px', color: al.couleur }}>{al.texte}</div>}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ ...mono(12, parseFloat(couts.margeActuellePct) >= 15 ? V1.ok : V1.danger, 600), background: (parseFloat(couts.margeActuellePct) >= 15 ? V1.ok : V1.danger) + '18', padding: '3px 10px', borderRadius: '12px' }}>
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
            { label: 'Reçus', val: `CHF ${fmtN(totalPaiementsRecus)}`, couleur: V1.ok },
            { label: 'En attente', val: `CHF ${fmtN(totalPaiementsAttente)}`, couleur: V1.warn },
            { label: 'En retard', val: `CHF ${fmtN(totalPaiementsRetard)}`, couleur: V1.danger },
          ].map(s => (
            <div key={s.label} style={{ ...carteV1, borderTop: `3px solid ${s.couleur}`, padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: V1.texteMuted }}>{s.label}</div>
              <div style={{ ...mono(22, s.couleur, 700), marginTop: '5px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* LISTE FACTURES EN RETARD (source unique : factures) */}
        {totalPaiementsRetard > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: V1.danger, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Paiements en retard à relancer</div>
            {chantiers.map(c => {
              const today = new Date().toISOString().slice(0, 10);
              const retards = factures
                .filter(f => String(f.chantierId) === String(c.id))
                .map(f => ({ ...f, statutCalc: calculerStatutFacture(f) }))
                .filter(f => f.statutCalc !== 'annulee' && f.statutCalc !== 'brouillon' && f.statutCalc !== 'payee' && f.dateEcheance && f.dateEcheance < today);
              if (retards.length === 0) return null;
              const client = clients.find(cl => String(cl.id) === String(c.clientId));
              return (
                <div key={c.id} style={{ background: 'rgba(192,57,43,0.08)', border: `1px solid ${V1.danger}`, borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, color: V1.danger }}>{c.nom} — {client?.entreprise}</div>
                  {retards.map(f => {
                    const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
                    return (
                      <div key={f.id} style={{ fontSize: '13px', color: V1.texteMuted, marginTop: '4px' }}>
                        Facture {f.numero} — <strong style={{ ...mono(13, V1.texte, 700) }}>CHF {fmtN(restant)}</strong> — Échéance : {f.dateEcheance}
                      </div>
                    );
                  })}
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
                    <td style={{ padding: '12px 15px' }}>{calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi, c.canton ?? 'GE')}</td>
                    <td style={{ padding: '12px 15px', ...mono(13, V1.texte, 700) }}>
                      {calculerCA(c, devis) !== null ? `CHF ${fmtN(calculerCA(c, devis))}` : '— Aucun devis lié'}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ ...mono(12, isChantierActif(c) ? V1.warn : V1.bleu, 600), background: (isChantierActif(c) ? V1.warn : V1.bleu) + '18', padding: '3px 10px', borderRadius: '12px' }}>
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
