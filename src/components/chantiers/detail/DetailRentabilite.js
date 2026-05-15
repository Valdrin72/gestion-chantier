import React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  statutRentabilite, C, calculerEcartChantier,
} from '../../../donnees';
import { DS } from '../../../ds';

function DetailRentabilite({ c, etat, couts, naviguer, fmtN, fmtK }) {
  const carteStyle = DS.card;
  const joursPrevu = etat.totalJoursPrevus;
  const joursRealises = etat.totalJoursReels;
  const rj = {
    joursPrevu,
    joursRealises,
    joursRestants: joursPrevu - joursRealises,
    enDepassement: joursRealises > joursPrevu,
    enAvance: false,
    aucuneSaisie: joursRealises === 0,
    coutMOPrevu: couts.coutEquipePrevu,
    coutMOReel:  couts.coutEquipeReel,
    autresCouts: (couts.coutMaterielReel || 0) + (couts.coutSousTraitanceReel || 0) + (couts.autresCoutsReel || 0),
    montantDevis: couts.montantTotal,
    totalCoutsReel: Math.round(couts.totalCoutsReel || 0),
    rentabilite: couts.margeReel !== null ? Math.round(couts.margeReel) : null,
    rentabilitePct: couts.margeReelPct,
    rentabiliteProjetee: etat.projectionDisponible && etat.margeEstimee !== null ? Math.round(etat.margeEstimee) : null,
    rentabiliteProjetee_Pct: etat.projectionDisponible ? etat.margeEstimeePct : null,
    coutJournalierEquipe: joursRealises > 0 ? Math.round((couts.coutEquipeReel || 0) / joursRealises) : 0,
  };

  const couleurStatutJours = rj.aucuneSaisie
    ? 'var(--text-muted)'
    : rj.enDepassement
      ? C.danger
      : C.primaire;

  const labelStatutJours = rj.aucuneSaisie
    ? 'Pas de données'
    : rj.enDepassement
      ? 'Dépassement'
      : 'En cours';

  const couleurRenta = statutRentabilite(rj.rentabilitePct).couleur;

  const ec = rj.aucuneSaisie ? null : calculerEcartChantier(c);
  const ecKpi = {
    label: 'Écart / devis',
    valeur: ec ? (ec.ecartJours === 0 ? '0j' : `${ec.ecartJours > 0 ? '+' : ''}${ec.ecartJours}j`) : '—',
    couleur: !ec ? '#78909c' : ec.ecartJours > 0 ? C.danger : ec.ecartJours < 0 ? C.secondaire : '#78909c',
  };

  const membres = etat.equipe || [];
  const nbTotal    = membres.length;
  const nbReel     = membres.filter(m => m.joursReels > 0).length;
  const couverture = nbTotal > 0 ? Math.round((nbReel / nbTotal) * 100) : 0;
  const etatEquipe = nbReel === 0 ? 'vide' : nbReel < nbTotal ? 'partiel' : 'complet';
  const couleurEtat = etatEquipe === 'complet' ? C.secondaire : etatEquipe === 'partiel' ? C.warning : 'var(--text-muted)';
  const titreEtat   = etatEquipe === 'complet' ? 'Coût équipe complet' : etatEquipe === 'partiel' ? 'Coût équipe réel (partiel)' : 'Coût équipe : non démarré';
  const alerteCouverture = etatEquipe === 'partiel'
    ? couverture < 50
      ? { texte: 'Données insuffisantes pour analyse fiable', couleur: C.danger }
      : { texte: 'Analyse partielle — compléter les données', couleur: C.warning }
    : null;

  const membresAffiches = nbTotal > 0 && etatEquipe !== 'vide'
    ? [...membres]
        .filter(m => etatEquipe === 'complet' || m.joursReels > 0)
        .sort((a, b) => b.cout - a.cout)
        .map(m => ({ ...m, partPct: etat.coutMOReel > 0 ? Math.round((m.cout / etat.coutMOReel) * 100) : 0 }))
    : [];
  const totalEquipe = membresAffiches.reduce((s, m) => s + m.cout, 0);

  return (
    <div style={{ ...carteStyle, borderLeft: `4px solid ${couleurStatutJours}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div className="ds-card-title" style={{ margin: 0 }}>Rentabilité par jours réalisés</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: couleurStatutJours, background: couleurStatutJours + '18', border: `1px solid ${couleurStatutJours}35`, borderRadius: 20, padding: '4px 14px' }}>
          {labelStatutJours}
        </span>
      </div>

      {!rj.aucuneSaisie && rj.joursPrevu > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>0 jour</span>
            <span>{rj.joursPrevu} jours prévus</span>
          </div>
          <div style={{ background: 'var(--bg-glass-2)', borderRadius: 8, height: 10, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', borderRadius: 8, transition: 'width 0.4s ease',
              background: rj.enDepassement
                ? `linear-gradient(90deg, ${C.warning}, ${C.danger})`
                : `linear-gradient(90deg, ${C.primaire}, ${C.secondaire})`,
              width: `${Math.min((rj.joursRealises / rj.joursPrevu) * 100, 100)}%`,
            }} />
            {rj.enDepassement && (
              <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${Math.min(((rj.joursRealises - rj.joursPrevu) / rj.joursPrevu) * 100, 30)}%`, background: C.danger + '60', borderRadius: '0 8px 8px 0' }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, textAlign: 'right' }}>
            {rj.joursRealises} jour{rj.joursRealises > 1 ? 's' : ''} réalisé{rj.joursRealises > 1 ? 's' : ''}
            {rj.enDepassement
              ? ` (+${-rj.joursRestants}j de dépassement)`
              : rj.enAvance
                ? ` — ${rj.joursRestants}j restant${rj.joursRestants > 1 ? 's' : ''}`
                : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: rj.aucuneSaisie ? 0 : 16 }}>
        {[
          { label: 'Jours prévus',    valeur: `${rj.joursPrevu}j`,                                              couleur: C.primaire },
          { label: 'Jours réalisés',  valeur: rj.aucuneSaisie ? '—' : `${rj.joursRealises}j`,                  couleur: rj.aucuneSaisie ? '#78909c' : couleurStatutJours },
          ecKpi,
          { label: 'Coût/j équipe',   valeur: rj.coutJournalierEquipe > 0 ? `CHF ${fmtN(rj.coutJournalierEquipe)}` : '—', couleur: C.violet },
        ].map(s => (
          <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
          </div>
        ))}
      </div>

      {!rj.aucuneSaisie && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>
            Rentabilité calculée sur les jours réalisés
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'Coût MO réel',     valeur: rj.coutMOReel > 0 ? `CHF ${fmtN(rj.coutMOReel)}` : '—', couleur: rj.coutMOReel > 0 ? C.warning : '#78909c' },
              { label: 'Autres coûts',      valeur: `CHF ${fmtN(rj.autresCouts)}`,    couleur: '#78909c' },
              { label: 'Total coûts réels', valeur: `CHF ${fmtN(rj.totalCoutsReel)}`, couleur: C.danger },
              { label: 'Rentabilité réelle',valeur: `CHF ${fmtN(rj.rentabilite)}`,    couleur: couleurRenta },
              { label: 'Marge réelle (%)',  valeur: rj.rentabilitePct !== null && rj.rentabilitePct !== undefined ? `${rj.rentabilitePct}%` : '—', couleur: couleurRenta },
              ...(rj.rentabiliteProjetee !== null ? [{ label: 'Projection fin chantier', valeur: `CHF ${fmtN(rj.rentabiliteProjetee)}`, couleur: rj.rentabiliteProjetee_Pct >= 15 ? C.secondaire : C.warning }] : []),
            ].map(s => (
              <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rj.aucuneSaisie && (
        <div style={{ textAlign: 'center', padding: '16px 0 4px', color: 'var(--text-muted)', fontSize: 13 }}>
          Saisissez les <strong>jours réalisés</strong> dans le formulaire de modification pour activer ce calcul.
        </div>
      )}

      {nbTotal > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: etatEquipe === 'partiel' ? 6 : 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: couleurEtat }}>{titreEtat}</div>
            {etatEquipe === 'complet' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: C.secondaire, background: C.secondaire + '14', border: `1px solid ${C.secondaire}28`, borderRadius: 20, padding: '2px 10px' }}>
                Données complètes — analyse fiable
              </span>
            )}
            {etatEquipe === 'partiel' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: C.warning, background: C.warning + '14', border: `1px solid ${C.warning}28`, borderRadius: 20, padding: '2px 10px' }}>
                Couverture : {nbReel} / {nbTotal} ({couverture}%)
              </span>
            )}
          </div>

          {alerteCouverture && (
            <div style={{ fontSize: 11, fontWeight: 600, color: alerteCouverture.couleur, background: alerteCouverture.couleur + '10', border: `1px solid ${alerteCouverture.couleur}25`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              {alerteCouverture.texte}
            </div>
          )}

          {etatEquipe === 'vide' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-muted)' }}>—</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ajoutez des journées pour activer le suivi réel</span>
            </div>
          )}

          {etatEquipe !== 'vide' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {membresAffiches.map(m => {
                  const barWidth = Math.max(m.partPct, 2);
                  const couleurCout = m.partPct >= 40 ? C.danger : m.partPct >= 25 ? C.warning : C.primaire;
                  return (
                    <div key={m.employeId}
                      onClick={() => naviguer('employes', { employeActif: m.employeId })}
                      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.18s ease, border-color 0.18s ease, transform 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.22)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{m.nom}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.poste}</span>
                          <ChevronRight size={11} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CHF {fmtN(m.tarifJour)}/j × {m.joursReels}j</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: couleurCout }}>CHF {fmtN(m.cout)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: couleurCout + '18', color: couleurCout, border: `1px solid ${couleurCout}30`, borderRadius: 20, padding: '2px 8px' }}>{m.partPct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: `linear-gradient(90deg, ${couleurCout}cc, ${couleurCout}66)`, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: etatEquipe === 'complet' ? 'var(--text-secondary)' : C.warning }}>
                    {etatEquipe === 'complet' ? 'Total équipe' : 'Total partiel'}
                  </span>
                  {etatEquipe === 'complet' && <span style={{ fontSize: 10, color: C.secondaire }}>Basé sur 100% des employés</span>}
                  {etatEquipe === 'partiel' && (
                    <span style={{ fontSize: 10, color: C.warning }}>Basé sur {nbReel} / {nbTotal} employés ({couverture}%)</span>
                  )}
                </div>
                <span
                  title={etatEquipe === 'complet' ? 'Données complètes — calcul fiable' : 'Données basées uniquement sur les employés renseignés'}
                  style={{ fontSize: 15, fontWeight: 900, color: etatEquipe === 'complet' ? C.violet : C.warning }}
                >
                  CHF {fmtN(totalEquipe)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DetailRentabilite;
