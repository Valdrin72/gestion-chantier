import React, { useState } from 'react';
import {
  Bot, AlertTriangle, FileText, TrendingUp, FileBarChart2,
  Brain, ToggleLeft, ToggleRight, Play, CheckCircle,
  Clock, RefreshCw, ChevronDown, ChevronRight,
  Activity, Zap,
} from 'lucide-react';
import { fmtN } from './donnees';
import { DS } from './ds';

const AGENTS_META = [
  {
    id: 'AlerteChantier',
    nom: 'Alerte Chantier',
    description: 'Surveille marge, retards et dépassements budget sur tous les chantiers actifs',
    Icon: AlertTriangle,
    couleur: '#ef4444',
    details: ['Marge < 15% → alerte DANGER', 'Retard > 3 jours → alerte CRITIQUE', 'Budget dépassé > 5% → alerte ATTENTION'],
    frequence: 'Toutes les heures',
  },
  {
    id: 'SuiviDevis',
    nom: 'Suivi Devis',
    description: "Détecte les devis acceptés sans facture liée après 3 jours",
    Icon: FileText,
    couleur: '#3b82f6',
    details: ['INFO si < 7 jours sans facture', 'ATTENTION si > 7 jours sans facture', 'Redirige vers le devis — aucune action auto'],
    frequence: 'Toutes les heures',
  },
  {
    id: 'TresoreriePredictor',
    nom: 'Trésorerie Predictor',
    description: "Prédit le solde de trésorerie à J+30 et J+60 selon les échéances",
    Icon: TrendingUp,
    couleur: '#10b981',
    details: ['Encaissements attendus par date échéance', 'Décaissements estimés (charges mensuelles)', 'Alerte si solde prédit < seuil configuré'],
    frequence: 'Toutes les heures',
  },
  {
    id: 'RapportAuto',
    nom: 'Rapport Auto',
    description: "Génère un résumé de la semaine chaque lundi matin au login",
    Icon: FileBarChart2,
    couleur: '#8b5cf6',
    details: ['Heures saisies sur la semaine', 'CA facturé sur la période', 'Chantiers avancés / en retard'],
    frequence: 'Chaque lundi à 08h00',
  },
  {
    id: 'MemoireChantier',
    nom: 'Mémoire Chantier',
    description: "Apprend des chantiers terminés pour améliorer les estimations futures",
    Icon: Brain,
    couleur: '#f59e0b',
    details: ['Calcule les écarts budget réel vs prévu par type', 'Mémorise les patterns historiques', "Affiche des suggestions sur nouveaux devis du même type"],
    frequence: 'Toutes les heures',
  },
];

const NIVEAU_CONFIG = {
  DANGER:    { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  CRITIQUE:  { bg: '#FEE2E2', color: '#7F1D1D', border: '#FCA5A5' },
  ATTENTION: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  INFO:      { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
};

export default function Agents({
  agentsActifs, agentsStatuts, agentsLogs, alertes, predictions,
  patterns, rapports, dernierRun, running, nbNonLues,
  toggleAgent, forcerExecution, marquerLu, marquerTousLus,
}) {
  const [onglet, setOnglet] = useState('agents');
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDiff = (ts) => {
    if (!ts) return 'Jamais';
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return 'À l\'instant';
    if (diff < 60) return `il y a ${diff} min`;
    if (diff < 1440) return `il y a ${Math.floor(diff / 60)}h`;
    return `il y a ${Math.floor(diff / 1440)}j`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={24} strokeWidth={1.8} style={{ color: '#3b82f6' }} />
            Agents IA
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            5 agents autonomes · analyse locale en temps réel · {dernierRun ? `Dernière exécution ${fmtDiff(dernierRun)}` : 'Jamais exécuté'}
          </p>
        </div>
        <button
          onClick={() => forcerExecution()}
          disabled={running}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.7 : 1 }}
        >
          <RefreshCw size={14} strokeWidth={2} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? 'Exécution...' : 'Forcer exécution'}
        </button>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const nbActifs = Object.values(agentsActifs).filter(Boolean).length;
        const nbAlertes = alertes.length;
        const nbNonLuesCount = nbNonLues || 0;
        const lastRun = dernierRun ? fmtDiff(dernierRun) : 'Jamais';
        const kpiItems = [
          { label: 'AGENTS ACTIFS',  val: `${nbActifs}/${AGENTS_META.length}`, gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', glow: 'rgba(59,130,246,0.32)' },
          { label: 'ALERTES TOTALES',val: nbAlertes,          gradient: nbAlertes > 0 ? 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)' : 'linear-gradient(135deg, #065F46 0%, #10B981 100%)', glow: nbAlertes > 0 ? 'rgba(239,68,68,0.32)' : 'rgba(16,185,129,0.32)', badge: nbNonLuesCount > 0 ? `${nbNonLuesCount} non lues` : null },
          { label: 'DERNIÈRE EXÉC.', val: lastRun,            gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)', glow: 'rgba(245,158,11,0.32)' },
          { label: 'AGENTS TOTAUX',  val: AGENTS_META.length, gradient: 'linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)', glow: 'rgba(139,92,246,0.32)' },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '20px', minHeight: 110, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 24, width: 'fit-content' }}>
        {[['agents', 'Agents'], ['alertes', `Alertes ${nbNonLues > 0 ? `(${nbNonLues})` : ''}`], ['predictions', 'Prédictions'], ['memoire', 'Mémoire'], ['rapports', 'Rapports']].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)}
            style={{ background: onglet === id ? '#2563eb' : 'transparent', border: 'none', color: onglet === id ? '#fff' : 'var(--text-muted)', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ONGLET AGENTS ── */}
      {onglet === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {AGENTS_META.map(agent => {
            const statut = agentsStatuts[agent.id] || {};
            const actif = agentsActifs[agent.id] !== false;
            const logs = agentsLogs[agent.id] || [];
            const isExpanded = expanded[agent.id];

            return (
              <div key={agent.id} style={{ ...DS.card, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Icône */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: agent.couleur + '18', border: `1px solid ${agent.couleur}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <agent.Icon size={20} strokeWidth={1.8} style={{ color: agent.couleur }} />
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{agent.nom}</span>
                      {statut.erreur && (
                        <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>ERREUR</span>
                      )}
                      {!actif && (
                        <span style={{ background: 'var(--bg-glass-2)', color: 'var(--text-muted)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>DÉSACTIVÉ</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>{agent.description}</p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {agent.frequence}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Activity size={11} /> Dernière exécution : {fmtDiff(statut.lastRun)}
                      </span>
                      {statut.dureeMs !== undefined && (
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={11} /> {statut.dureeMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button onClick={() => toggleAgent(agent.id)} title={actif ? 'Désactiver' : 'Activer'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: actif ? agent.couleur : 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
                      {actif
                        ? <ToggleRight size={32} strokeWidth={1.5} />
                        : <ToggleLeft size={32} strokeWidth={1.5} />
                      }
                    </button>
                    <button onClick={() => forcerExecution(agent.id)}
                      style={{ ...DS.btnGhost, padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Play size={11} /> Forcer
                    </button>
                    <button onClick={() => toggleExpand(agent.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* Détails expandés */}
                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Règles */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>Règles</div>
                        {agent.details.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: agent.couleur, marginTop: 6, flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d}</span>
                          </div>
                        ))}
                      </div>
                      {/* Log récent */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>10 dernières exécutions</div>
                        {logs.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Aucune exécution enregistrée</p>
                        ) : logs.map((log, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                            {log.erreur
                              ? <AlertTriangle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                              : <CheckCircle size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                            }
                            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{fmtDate(log.timestamp)}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{log.dureeMs}ms</span>
                            <span style={{ color: log.erreur ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                              {log.erreur ? 'ERR' : `${log.nbResultats} résultat${log.nbResultats !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ONGLET ALERTES ── */}
      {onglet === 'alertes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{alertes.length} alerte{alertes.length !== 1 ? 's' : ''} · {nbNonLues} non lue{nbNonLues !== 1 ? 's' : ''}</span>
            {nbNonLues > 0 && (
              <button onClick={marquerTousLus} style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}>Tout marquer comme lu</button>
            )}
          </div>
          {alertes.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle size={32} strokeWidth={1.5} style={{ color: '#10b981', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Aucune alerte active</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tous vos chantiers sont dans les normes</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertes.map(a => {
                const niv = NIVEAU_CONFIG[a.niveau] || NIVEAU_CONFIG.INFO;
                const agentMeta = AGENTS_META.find(m => m.id === a.agent);
                return (
                  <div key={a.id}
                    style={{ ...DS.card, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, opacity: a.lu ? 0.6 : 1, borderLeft: `4px solid ${niv.color}`, cursor: 'pointer' }}
                    onClick={() => marquerLu(a.id)}
                  >
                    {!a.lu && <div style={{ width: 7, height: 7, borderRadius: '50%', background: niv.color, flexShrink: 0, marginTop: 5 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ background: niv.bg, color: niv.color, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{a.niveau}</span>
                        {agentMeta && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agentMeta.nom}</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtDiff(a.timestamp)}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{a.message}</div>
                      {a.detail && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET PRÉDICTIONS ── */}
      {onglet === 'predictions' && (
        <div>
          {Object.keys(predictions).length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucune prédiction disponible — forcez une exécution pour générer les données.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { label: 'Encaissements prévus J+30', val: predictions.encaissement30, couleur: '#10b981', desc: 'Factures dont l\'échéance est dans 30 jours' },
                { label: 'Encaissements prévus J+60', val: (predictions.encaissement30 || 0) + (predictions.encaissement60 || 0), couleur: '#3b82f6', desc: 'Total cumulé à 60 jours' },
                { label: 'Charges estimées J+30', val: predictions.decaissement30, couleur: '#f59e0b', desc: 'Charges mensuelles configurées' },
                { label: 'Charges estimées J+60', val: predictions.decaissement60, couleur: '#ef4444', desc: 'Charges × 2 mois' },
                { label: 'Solde net J+30', val: predictions.solde30, couleur: predictions.solde30 >= 0 ? '#10b981' : '#ef4444', desc: 'Encaissements - Charges à 30 jours' },
                { label: 'Solde net J+60', val: predictions.solde60, couleur: predictions.solde60 >= 0 ? '#10b981' : '#ef4444', desc: 'Encaissements - Charges à 60 jours' },
              ].map(item => (
                <div key={item.label} style={{ ...DS.card, padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: item.couleur, letterSpacing: '-1px', marginBottom: 4 }}>
                    CHF {fmtN(item.val || 0)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET MÉMOIRE ── */}
      {onglet === 'memoire' && (
        <div>
          {Object.keys(patterns).length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun pattern disponible — des chantiers terminés sont nécessaires pour construire la mémoire.
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Ces patterns sont utilisés pour afficher des suggestions lors de la création de devis du même type de chantier.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.values(patterns).map(p => (
                  <div key={p.type} style={{ ...DS.card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Brain size={20} strokeWidth={1.8} style={{ color: '#f59e0b' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{p.type}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Basé sur {p.count} chantier{p.count > 1 ? 's' : ''} terminé{p.count > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: p.ecartMoyen > 0 ? '#ef4444' : '#10b981', letterSpacing: '-0.5px' }}>
                        {p.ecartMoyen > 0 ? '+' : ''}{p.ecartMoyen.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>écart budget moyen</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {p.ecartMedian > 0 ? '+' : ''}{p.ecartMedian.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>médiane</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET RAPPORTS ── */}
      {onglet === 'rapports' && (
        <div>
          {rapports.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun rapport généré — l'Agent RapportAuto génère automatiquement un résumé chaque lundi matin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rapports.map(r => (
                <div key={r.id} style={{ ...DS.card, padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <FileBarChart2 size={18} strokeWidth={1.8} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{r.semaine}</span>
                    {r.nouveau && <span style={{ background: '#8b5cf614', color: '#8b5cf6', border: '1px solid #8b5cf630', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Nouveau</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(r.timestamp)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Heures saisies', val: `${r.heuresSaisies}h`, couleur: '#3b82f6' },
                      { label: 'CA facturé', val: `CHF ${fmtN(r.caFacture)}`, couleur: '#10b981' },
                      { label: 'Chantiers actifs', val: r.nbActifs, couleur: '#f59e0b' },
                      { label: 'En retard', val: r.nbEnRetard, couleur: r.nbEnRetard > 0 ? '#ef4444' : '#10b981' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: m.couleur }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {r.chantierRetard?.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B' }}>
                      En retard : {r.chantierRetard.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
