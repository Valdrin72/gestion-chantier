import React from 'react';
import {
  HardHat, X, Pencil, Trash2, AlertTriangle, ChevronRight, DollarSign, Clock, Eye, TrendingUp,
} from 'lucide-react';
import {
  fmtN, calculerCoutsChantier, C, calculerEtatChantier,
  assertEtatCoherent, calculerCA, isChantierActif,
} from '../../donnees';
import { DS, couleurStatut as couleurStatutDS } from '../../ds';
import { useApp } from '../../context/AppContext';

const STATUTS = ['Tous', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'];

function ChantiersListe({
  chantiersFiltres,
  joursParChantier,
  filtre,
  setFiltre,
  onSelect,
  onModifier,
  onSupprimer,
  formSlot,
}) {
  const { chantiers, clients, devis = [], parametres, naviguer, contexte, agentState } = useApp();
  const deriveMap = React.useMemo(() => {
    const map = {};
    (agentState?.agentData?.DerivePredictor?.resultats || []).forEach(r => { map[r.chantierId] = r; });
    return map;
  }, [agentState]);
  const couleurStatut = couleurStatutDS;

  // KPIs
  const nbEnCours = chantiers.filter(c => (c.statut || '').toLowerCase() === 'en cours').length;
  const nbEnRetard = chantiersFiltres.filter(c => { const j = joursParChantier[c.id]; return j !== null && j < 0; }).length;
  const caTotal = chantiersFiltres.reduce((t, c) => t + (calculerCA(c, devis) || 0), 0);
  const joursPlanifies = chantiersFiltres.reduce((t, c) => t + (parseInt(c.nombreJours) || 0), 0);
  const chantiersAvecData = chantiersFiltres.filter(c => { const ca = calculerCA(c, devis); return ca !== null && ca > 0; });
  let margeMoyenne = null;
  if (chantiersAvecData.length > 0) {
    const sum = chantiersAvecData.reduce((s, c) => {
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      return s + (couts.totalCoutsReel > 0 && couts.margeReelPct !== null ? couts.margeReelPct : 0);
    }, 0);
    margeMoyenne = Math.round(sum / chantiersAvecData.length);
  }
  const nbAvecDevis = chantiersFiltres.filter(c => calculerCA(c, devis) !== null).length;
  const kpiItems = [
    { label: 'EN COURS',       val: nbEnCours,  Icon: HardHat,    ...DS.kpi.blue,   badge: nbEnRetard > 0 ? `${nbEnRetard} en retard` : null },
    { label: 'CA CHANTIERS',   val: `CHF ${fmtN(caTotal)}`, sous: `${nbAvecDevis} avec devis · tous statuts`, Icon: DollarSign, ...DS.kpi.green },
    { label: 'MARGE MOYENNE',  val: margeMoyenne !== null ? `${margeMoyenne}%` : '—', Icon: TrendingUp, ...DS.kpi.amber },
    { label: 'JOURS PLANIFIÉS',val: `${fmtN(joursPlanifies)}j`, Icon: Clock, ...DS.kpi.purple },
  ];

  // Décisions/scoring chantiers
  const getDecisionChantier = (etatC) => {
    if (etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
      return { icone: '', label: 'Incohérent', couleur: '#90a4ae', message: 'Activité sans suivi', sous: 'Des coûts sont saisis sans journées déclarées', niveau: 'warning', priorite: 4 };
    if (etatC.avancementPct >= 100) {
      const msgT = etatC.deriveJours > 0
        ? `Terminé avec +${etatC.deriveJours} j de retard`
        : etatC.deriveJours < 0
          ? `Terminé avec ${Math.abs(etatC.deriveJours)} j d'avance`
          : 'Chantier finalisé';
      const sousT = (etatC.projectionDisponible && etatC.margeEstimee !== null)
        ? etatC.margeEstimee >= 0 ? `+CHF ${fmtN(Math.round(etatC.margeEstimee))} de marge` : `Perte CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`
        : null;
      return { icone: '', label: 'Terminé', couleur: '#78909c', message: msgT, sous: sousT, niveau: 'ok', priorite: 5 };
    }
    if (etatC.deriveJours >= 5)
      return { niveau: 'critique', label: 'Retard critique', couleur: C.danger, message: `+${etatC.deriveJours} j de retard`, sous: (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0) ? `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}` : null, priorite: 1 };
    if (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0)
      return { niveau: 'critique', label: 'Perte estimée', couleur: C.danger, message: `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`, sous: 'Basé sur tendance actuelle', priorite: 2 };
    if (etatC.deriveJours >= 2)
      return { niveau: 'warning', label: 'À surveiller', couleur: C.warning, message: `Retard léger : +${etatC.deriveJours} j`, sous: null, priorite: 3 };
    return { niveau: 'ok', label: 'Dans les temps', couleur: C.secondaire, message: 'Cadence normale', sous: null, priorite: 6 };
  };

  const DECISION_INVALIDE = { icone: '', label: 'Données invalides', couleur: '#90a4ae', message: 'Impossible d\'analyser ce chantier', sous: 'Vérifier les données saisies', niveau: 'invalid', priorite: 0 };

  const scored = [...chantiersFiltres].map(c => {
    const etatC = calculerEtatChantier(c, parametres.employes, devis);
    const coherence = assertEtatCoherent(etatC);
    if (!coherence.ok)
      return { c, etatC, decision: DECISION_INVALIDE, indicateurs: [], actions: [] };
    const decision = getDecisionChantier(etatC);
    const estTermine = etatC.avancementPct >= 100;
    const perteDejaExprimee = decision.priorite === 2 || (decision.priorite === 1 && decision.sous !== null);
    const deriveDejaExprimee = decision.priorite === 1 || decision.priorite === 3;
    const dataDejaExprimee   = decision.priorite === 4;
    const margeAbs = (etatC.margeEstimee !== null && !isNaN(etatC.margeEstimee)) ? Math.round(Math.abs(etatC.margeEstimee)) : 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const hasHeuresAuj = (c.journal || []).some(e =>
      e.date === todayStr && (e.employes || []).some(emp => (parseFloat(emp.heuresTravaillees) || 0) > 0)
    );
    const ind = [];
    if (!estTermine && !perteDejaExprimee && etatC.projectionDisponible && margeAbs > 0 && etatC.margeEstimee < 0)
      ind.push({ type: 'perte',  label: `Perte CHF ${fmtN(margeAbs)}`,  couleur: C.danger,  tooltip: 'Le chantier est déficitaire selon la projection' });
    if (!estTermine && !dataDejaExprimee && etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
      ind.push({ type: 'data',   label: 'Données',                        couleur: '#90a4ae', tooltip: 'Des données sont incohérentes ou manquantes' });
    if (!estTermine && !deriveDejaExprimee && etatC.totalJoursReels > 0 && etatC.deriveJours >= 2 && !isNaN(etatC.deriveJours))
      ind.push({ type: 'derive', label: `+${etatC.deriveJours} j`,        couleur: C.warning, tooltip: 'Décalage entre prévu et réel' });
    if (!estTermine && isChantierActif(c) && etatC.totalJoursReels > 0 && !hasHeuresAuj)
      ind.push({ type: 'no_hours', label: 'Aucune saisie aujourd\'hui', couleur: C.warning, tooltip: 'Aucune heure déclarée pour ce chantier aujourd\'hui' });
    const PRIO_IND = { perte: 0, data: 1, derive: 2, no_hours: 3 };
    const indicateurs = ind.sort((a, b) => PRIO_IND[a.type] - PRIO_IND[b.type]).slice(0, 2);
    return { c, etatC, decision, indicateurs };
  }).sort((a, b) => a.decision.priorite - b.decision.priorite);

  const nbCritique = scored.filter(x => x.decision.niveau === 'critique').length;
  const nbWarning  = scored.filter(x => x.decision.niveau === 'warning').length;

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Chantiers</div>
          {(contexte?.clientActif || contexte?.employeActif) && (
            <div className="page-title-sub">{contexte?.clientActif ? 'Filtrés par client' : 'Filtrés par employé'}</div>
          )}
        </div>
        <div className="page-actions-group">
          {contexte?.clientActif && (
            <button onClick={() => naviguer('clients')} style={{ ...DS.btnGhost }}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Retour aux clients</button>
          )}
          {contexte?.employeActif && (
            <button onClick={() => naviguer('employes')} style={{ ...DS.btnGhost }}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Retour aux employés</button>
          )}
          {(contexte?.clientActif || contexte?.employeActif) && (
            <button onClick={() => naviguer('chantiers')} style={{ ...DS.btnGhost }}><X size={14} /> Supprimer filtre</button>
          )}
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 20 }}>
        {kpiItems.map(k => (
          <div key={k.label} className="kpi-card" style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
              <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
            <div className="kpi-val" style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
            {k.sous && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', marginTop: 5, position: 'relative' }}>{k.sous}</div>}
            {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(239,68,68,0.85)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUTS.map(s => (
          <button key={s} onClick={() => setFiltre(s)} style={{
            background: filtre === s ? '#EEF2FF' : 'transparent',
            color: filtre === s ? '#4F46E5' : 'var(--text-muted)',
            border: '1px solid transparent',
            padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
            fontWeight: filtre === s ? 600 : 400, fontFamily: 'inherit',
            transition: 'all 0.18s',
          }}>{s}</button>
        ))}
      </div>

      {formSlot}

      {nbCritique > 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 18px', borderRadius: 12, marginBottom: 16,
          background: C.danger + '0f', border: `1px solid ${C.danger}30`, borderLeft: `4px solid ${C.danger}`,
        }}>
          <AlertTriangle size={18} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.danger }}>
            {nbCritique} chantier{nbCritique > 1 ? 's' : ''} bloque{nbCritique > 1 ? 'nt' : ''} aujourd'hui
          </span>
        </div>
      ) : nbWarning > 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 18px', borderRadius: 12, marginBottom: 16,
          background: C.warning + '0f', border: `1px solid ${C.warning}30`, borderLeft: `4px solid ${C.warning}`,
        }}>
          <AlertTriangle size={18} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.warning }}>
            {nbWarning} chantier{nbWarning > 1 ? 's' : ''} à surveiller
          </span>
        </div>
      ) : null}
      <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
        {scored.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {contexte?.clientActif || contexte?.employeActif ? 'Aucun chantier ne correspond à ce filtre.' : 'Aucun chantier à afficher.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Référence', 'Chantier', 'Client', 'Avancement', 'Marge', 'Statut', 'Actions'].map(col => (
                    <th key={col} style={DS.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scored.map(({ c, etatC, decision }) => {
                  const client = clients.find(cl => cl.id === c.clientId);
                  const sc = couleurStatut(c.statut);
                  const derive = deriveMap[c.id];
                  const initiales = (c.nom || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
                  return (
                    <tr
                      key={c.id}
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                      onClick={() => onSelect(c)}
                    >
                      <td style={DS.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>{c.numero}</span>
                      </td>
                      <td style={{ ...DS.td, maxWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: decision.couleur + '22',
                            border: `1px solid ${decision.couleur}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, color: decision.couleur,
                          }}>{initiales}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{c.ville}</div>
                          </div>
                        </div>
                      </td>
                      <td style={DS.td}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{client?.entreprise || '—'}</span>
                      </td>
                      <td style={{ ...DS.td, minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 100, height: 5, borderRadius: 3, background: 'var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${avancePct}%`, background: decision.couleur, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 30 }}>{avancePct}%</span>
                        </div>
                      </td>
                      <td style={DS.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: decision.couleur,
                          background: decision.couleur + '18', border: `1px solid ${decision.couleur}40`,
                          borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                        }}>{decision.label}</span>
                        {derive && (
                          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: derive.statut === 'rouge' ? '#ef4444' : derive.statut === 'orange' ? '#f59e0b' : '#10b981', whiteSpace: 'nowrap' }}>
                            EAC {derive.margeEstimeePct > 0 ? '+' : ''}{derive.margeEstimeePct}% · {derive.confiance}
                          </div>
                        )}
                      </td>
                      <td style={DS.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg,
                          borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                        }}>{c.statut}</span>
                      </td>
                      <td style={{ ...DS.td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            onClick={() => onSelect(c)}
                            style={DS.iconBtn}
                            title="Voir le détail"
                          ><Eye size={14} /></button>
                          <button
                            onClick={() => onModifier(c)}
                            style={DS.iconBtn}
                            title="Modifier"
                          ><Pencil size={14} /></button>
                          {onSupprimer && (
                            <button
                              onClick={() => { if (window.confirm(`Supprimer "${c.nom || c.numero}" ?`)) onSupprimer(c.id); }}
                              style={{ ...DS.iconBtn, color: '#ef4444' }}
                              title="Supprimer"
                            ><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChantiersListe;
