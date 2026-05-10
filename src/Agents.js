import React, { useState } from 'react';
import {
  Bot, AlertTriangle, FileText, TrendingUp, FileBarChart2, Brain,
  ToggleLeft, ToggleRight, Play, CheckCircle, Clock, RefreshCw,
  ChevronDown, ChevronRight, Activity, Zap, Users, Shield,
  BarChart2, Target, Layers, AlertCircle, Star, Eye, Trash2,
} from 'lucide-react';
import { fmtN } from './donnees';
import { DS } from './ds';

// ── Métadonnées des 20 agents (3 tiers) ──────────────────────
const AGENTS_META = [
  // ── TIER 1 — ANALYSE PURE ──────────────────────────────────
  {
    id: 'AlerteChantier', tier: 1, nom: 'Alerte Chantier', Icon: AlertTriangle, couleur: '#ef4444',
    description: 'Surveille marge, retards et dépassements sur tous les chantiers actifs',
    details: ['Marge < 15% → DANGER', 'Retard > 3j → CRITIQUE', 'Budget +5% → ATTENTION'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'SuiviDevis', tier: 1, nom: 'Suivi Devis', Icon: FileText, couleur: '#3b82f6',
    description: 'Détecte les devis acceptés sans facture liée après 3 jours',
    details: ['INFO < 7j sans facture', 'ATTENTION > 7j sans facture', 'Calcule le CA potentiel en attente'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'TresoreriePredictor', tier: 1, nom: 'Trésorerie Predictor', Icon: TrendingUp, couleur: '#10b981',
    description: 'Prédit le solde de trésorerie à J+30, J+60 et J+90',
    details: ['Encaissements selon échéances factures', 'Décaissements charges mensuelles', 'Alerte si solde < seuil configuré'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'RapportAuto', tier: 1, nom: 'Rapport Auto', Icon: FileBarChart2, couleur: '#8b5cf6',
    description: 'Génère un résumé hebdomadaire chaque lundi matin au login',
    details: ['Heures saisies semaine écoulée', 'CA facturé sur la période', 'Chantiers avancés / en retard'],
    frequence: 'Chaque lundi', apprentissage: false,
  },
  {
    id: 'MemoireChantier', tier: 1, nom: 'Mémoire Chantier', Icon: Brain, couleur: '#f59e0b',
    description: 'Apprend des chantiers terminés — écarts budget, marges, ratios durée par type',
    details: ['Écart moyen/médian coût par type', 'Marge historique moyenne par type', 'Ratio durée réelle / prévue'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'ProductiviteEquipe', tier: 1, nom: 'Productivité Équipe', Icon: Users, couleur: '#06b6d4',
    description: 'Analyse les heures réelles du journal pour chaque employé',
    details: ['Heures/jour moyen par employé', 'Alerte surcharge > 45h/semaine', 'Coût MO réel par employé'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'RelancePaiements', tier: 1, nom: 'Relance Paiements', Icon: AlertCircle, couleur: '#f97316',
    description: 'Classe les factures impayées par urgence (30/60/90 jours)',
    details: ['1re relance à 30j', '2e relance à 60j', 'Urgence absolue à 90j'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'AnomaliesDonnees', tier: 1, nom: 'Anomalies Données', Icon: Shield, couleur: '#6366f1',
    description: 'Vérifie l\'intégrité des données : liens orphelins, tarifs manquants',
    details: ['Chantiers sans devis', 'Factures sans clientId', 'Employés sans tarifJour'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'OptimisationFacturation', tier: 1, nom: 'Optimisation Facturation', Icon: Target, couleur: '#84cc16',
    description: 'Détecte les chantiers prêts à facturer selon leur avancement',
    details: ['Calcul facturable = CA × avancement% − déjà facturé', 'Alerte si > CHF 5\'000 facturable', 'Priorité aux montants > CHF 20\'000'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  // ── TIER 2 — INTELLIGENCE CROISÉE ──────────────────────────
  {
    id: 'ConflitsPlanning', tier: 2, nom: 'Conflits Planning', Icon: Layers, couleur: '#ec4899',
    description: 'Détecte les conflits de ressources humaines sur les chantiers actifs',
    details: ['Chantiers actifs sans équipe', 'Employé sur > 3 chantiers simultanés', 'Lit les données ProductivitéÉquipe'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'ApprentissageMarge', tier: 2, nom: 'Apprentissage Marge', Icon: Brain, couleur: '#a855f7',
    description: 'Prédit la marge finale en se basant sur les écarts historiques de MémoireChantier',
    details: ['Lit les patterns de MémoireChantier', 'Prédit marge finale par type de travaux', 'Confiance augmente avec le nombre de chantiers'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'SanteClient', tier: 2, nom: 'Santé Client', Icon: Star, couleur: '#0ea5e9',
    description: 'Évalue chaque client : DSO, marge générée, comportement paiement',
    details: ['DSO par client (vs standard 30j BTP)', 'Marge par client', 'Lit RelancePaiements pour le comportement'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'ProjectionAnnuelle', tier: 2, nom: 'Projection Annuelle', Icon: TrendingUp, couleur: '#14b8a6',
    description: 'Projette le CA et la marge de fin d\'année, compare aux objectifs',
    details: ['Trend mensuel extrapolé sur 12 mois', 'Comparaison objectif (localStorage)', 'Pipeline commercial inclus'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'BenchmarkTypeTravaux', tier: 2, nom: 'Benchmark Types', Icon: BarChart2, couleur: '#f59e0b',
    description: 'Compare les marges actuelles par type de travaux aux marges historiques',
    details: ['Marge réelle vs cible 20%', 'Comparaison historique MémoireChantier', 'Alerte types sous-performants'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'ConformiteBTP', tier: 2, nom: 'Conformité BTP', Icon: Shield, couleur: '#ef4444',
    description: 'Vérifie la conformité CCT Romande : heures, coefficients, charges sociales',
    details: ['Dépassement > 10h/jour alerté', 'Coefficient MO < 1.30 signalé', 'CCT Romande Genève 2024'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  // ── TIER 3 — SYNTHÈSE ──────────────────────────────────────
  {
    id: 'RadarPrecoce', tier: 3, nom: 'Radar Précoce', Icon: Eye, couleur: '#dc2626',
    description: 'Calcule un score de risque 0–100 en croisant toutes les alertes Tier 1+2',
    details: ['Score = marge + retard + budget + prédiction', 'DANGER ≥ 40 · CRITIQUE ≥ 60', 'Classe les chantiers par risque décroissant'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'DSOAnalyse', tier: 3, nom: 'DSO Analyse', Icon: Activity, couleur: '#7c3aed',
    description: 'Suit l\'évolution du délai moyen de recouvrement dans le temps',
    details: ['DSO moyen entreprise vs standard 30j', 'Tendance sur 3 runs (amélioration/dégradation)', 'Historique persisté dans la mémoire'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'Saisonnierte', tier: 3, nom: 'Saisonnalité', Icon: BarChart2, couleur: '#0891b2',
    description: 'Analyse les patterns saisonniers pour anticiper les périodes creuses',
    details: ['Répartition historique démarrages par mois', 'Prévision 3 prochains mois', 'Alerte période creuse imminente'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
  {
    id: 'CoutMOAnalyse', tier: 3, nom: 'Analyse MO', Icon: Users, couleur: '#d97706',
    description: 'Analyse l\'efficience de la main-d\'œuvre en % du CA et des coûts totaux',
    details: ['MO % coûts totaux par chantier', 'Alerte si MO > 70% des coûts', 'Classe les chantiers par intensité MO'],
    frequence: 'Toutes les heures', apprentissage: false,
  },
  {
    id: 'CoachDirecteur', tier: 3, nom: 'Coach Directeur', Icon: Star, couleur: '#059669',
    description: 'Synthèse intelligente — génère les 5 priorités d\'action du dirigeant',
    details: ['Lit tous les agents Tier 1+2+3', 'Score entreprise 0–100', 'Top 5 actions par impact'],
    frequence: 'Toutes les heures', apprentissage: true,
  },
];

const TIER_META = {
  1: { label: 'Tier 1 — Analyse pure', couleur: '#3b82f6', bg: '#eff6ff' },
  2: { label: 'Tier 2 — Intelligence croisée', couleur: '#8b5cf6', bg: '#f5f3ff' },
  3: { label: 'Tier 3 — Synthèse & Anticipation', couleur: '#10b981', bg: '#f0fdf4' },
};

const NIVEAU_CONFIG = {
  DANGER:    { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  CRITIQUE:  { bg: '#FEE2E2', color: '#7F1D1D', border: '#FCA5A5' },
  ATTENTION: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  INFO:      { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
};

export default function Agents({
  agentsActifs, agentsStatuts, agentsLogs, alertes, predictions,
  patterns, rapports, dernierRun, running, nbNonLues, agentData = {},
  scoreGlobal, priorites = [], memoire = {},
  toggleAgent, forcerExecution, marquerLu, marquerTousLus, effacerMemoire,
}) {
  const [onglet, setOnglet] = useState('coach');
  const [expanded, setExpanded] = useState({});
  const [tierVisible, setTierVisible] = useState({ 1: true, 2: true, 3: true });

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

  const nbActifs = Object.values(agentsActifs || {}).filter(Boolean).length;
  const alertesNonLues = alertes.filter(a => !a.lu);
  const agentsMeta20 = AGENTS_META; // 20 agents

  return (
    <div>
      {/* ── EN-TÊTE ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={24} strokeWidth={1.8} style={{ color: '#3b82f6' }} />
            Agents IA — Système Multi-Agents
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {nbActifs}/{agentsMeta20.length} agents actifs · 3 tiers · apprentissage continu · {dernierRun ? `Dernière exécution ${fmtDiff(dernierRun)}` : 'Jamais exécuté'}
          </p>
        </div>
        <button onClick={() => forcerExecution()} disabled={running}
          style={{ ...DS.btnPrimary, display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.7 : 1 }}>
          <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? 'Exécution...' : 'Forcer exécution'}
        </button>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'SCORE ENTREPRISE', val: scoreGlobal !== null ? `${scoreGlobal}/100` : '—', gradient: scoreGlobal >= 80 ? 'linear-gradient(135deg,#065F46,#10B981)' : scoreGlobal >= 60 ? 'linear-gradient(135deg,#92400E,#F59E0B)' : 'linear-gradient(135deg,#991B1B,#EF4444)', glow: 'rgba(16,185,129,0.32)', badge: scoreGlobal >= 80 ? 'Bonne santé' : scoreGlobal >= 60 ? 'À surveiller' : 'Attention requise' },
          { label: 'AGENTS ACTIFS', val: `${nbActifs}/20`, gradient: 'linear-gradient(135deg,#1E40AF,#3B82F6)', glow: 'rgba(59,130,246,0.32)' },
          { label: 'ALERTES ACTIVES', val: alertesNonLues.length, gradient: alertesNonLues.length > 0 ? 'linear-gradient(135deg,#991B1B,#EF4444)' : 'linear-gradient(135deg,#065F46,#10B981)', glow: 'rgba(239,68,68,0.32)', badge: alertesNonLues.length > 0 ? `${alertesNonLues.length} non lues` : 'Tout lu' },
          { label: 'MÉMOIRE ACCUMULÉE', val: `${Object.keys(memoire).length} agents`, gradient: 'linear-gradient(135deg,#4C1D95,#8B5CF6)', glow: 'rgba(139,92,246,0.32)', badge: 'Données persistées' },
        ].map(k => (
          <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '20px', minHeight: 110, boxShadow: `0 4px 20px ${k.glow}`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, position: 'relative' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
            {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
          </div>
        ))}
      </div>

      {/* ── ONGLETS ── */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 24, width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          ['coach', `Coach Directeur${priorites.length > 0 ? ` (${priorites.length})` : ''}`],
          ['alertes', `Alertes ${alertesNonLues.length > 0 ? `(${alertesNonLues.length})` : ''}`],
          ['agents', 'Agents (20)'],
          ['predictions', 'Prédictions'],
          ['memoire', 'Mémoire'],
          ['rapports', 'Rapports'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)}
            style={{ background: onglet === id ? '#2563eb' : 'transparent', border: 'none', color: onglet === id ? '#fff' : 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          ONGLET COACH DIRECTEUR
      ══════════════════════════════════════════════════════ */}
      {onglet === 'coach' && (
        <div>
          {priorites.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Bot size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucune priorité générée</div>
              <div>Forcez une exécution pour que le Coach Directeur analyse votre activité</div>
            </div>
          ) : (
            <>
              {/* Score entreprise */}
              {scoreGlobal !== null && (
                <div style={{ ...DS.card, marginBottom: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 48, fontWeight: 900, color: scoreGlobal >= 80 ? '#10b981' : scoreGlobal >= 60 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>{scoreGlobal}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>Score /100</div>
                  </div>
                  <div style={{ width: 1, height: 60, background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {scoreGlobal >= 80 ? '✅ Bonne santé d\'entreprise' : scoreGlobal >= 60 ? '⚠️ Situation à surveiller' : '🔴 Intervention requise'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Basé sur l'analyse de 20 agents · {alertes.filter(a => !a.lu).length} alertes non traitées · Synthèse en temps réel
                    </div>
                  </div>
                </div>
              )}

              {/* Top priorités */}
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Vos {priorites.length} priorités d'action</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {priorites.map((p, i) => (
                  <div key={i} style={{ ...DS.card, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', borderLeft: `4px solid ${i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6'}` }}>
                    <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{p.icone}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ background: i === 0 ? '#fee2e2' : i === 1 ? '#fef3c7' : '#eff6ff', color: i === 0 ? '#991b1b' : i === 1 ? '#92400e' : '#1e40af', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>{p.categorie}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Impact : {p.impact}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{p.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.detail}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-muted)', flexShrink: 0 }}>#{i + 1}</div>
                  </div>
                ))}
              </div>

              {/* Stats des autres agents */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
                {[
                  { label: 'Trésorerie J+30', val: agentData?.TresoreriePredictor?.solde30 !== undefined ? `CHF ${fmtN(agentData.TresoreriePredictor.solde30)}` : '—', couleur: (agentData?.TresoreriePredictor?.solde30 || 0) >= 0 ? '#10b981' : '#ef4444', sub: 'Solde net prévu' },
                  { label: 'CA Projeté Année', val: agentData?.ProjectionAnnuelle?.caProjecte ? `CHF ${fmtN(agentData.ProjectionAnnuelle.caProjecte)}` : '—', couleur: '#3b82f6', sub: `${agentData?.ProjectionAnnuelle?.txAtteinte || '—'}% de l'objectif` },
                  { label: 'À Facturer Maintenant', val: agentData?.OptimisationFacturation?.totalFacturable ? `CHF ${fmtN(agentData.OptimisationFacturation.totalFacturable)}` : '—', couleur: '#10b981', sub: `${agentData?.OptimisationFacturation?.opportunites?.length || 0} chantier(s)` },
                  { label: 'DSO Moyen', val: agentData?.DSOAnalyse?.dsoMoyen !== undefined ? `${agentData.DSOAnalyse.dsoMoyen} jours` : '—', couleur: (agentData?.DSOAnalyse?.dsoMoyen || 0) <= 30 ? '#10b981' : '#ef4444', sub: 'Standard BTP : 30j' },
                  { label: 'Qualité Données', val: agentData?.AnomaliesDonnees?.score !== undefined ? `${agentData.AnomaliesDonnees.score}/100` : '—', couleur: (agentData?.AnomaliesDonnees?.score || 0) >= 80 ? '#10b981' : '#f59e0b', sub: `${agentData?.AnomaliesDonnees?.nbAnomalies || 0} anomalie(s)` },
                  { label: 'Risque Max', val: agentData?.RadarPrecoce?.risques?.[0] ? `${agentData.RadarPrecoce.risques[0].score}/100` : '0/100', couleur: (agentData?.RadarPrecoce?.risques?.[0]?.score || 0) >= 60 ? '#ef4444' : '#10b981', sub: agentData?.RadarPrecoce?.risques?.[0]?.nom || 'Aucun chantier à risque' },
                ].map(item => (
                  <div key={item.label} style={{ ...DS.card, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: item.couleur, letterSpacing: '-0.5px', marginBottom: 2 }}>{item.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ONGLET ALERTES
      ══════════════════════════════════════════════════════ */}
      {onglet === 'alertes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{alertes.length} alerte{alertes.length !== 1 ? 's' : ''} · {alertesNonLues.length} non lue{alertesNonLues.length !== 1 ? 's' : ''}</span>
            {alertesNonLues.length > 0 && (
              <button onClick={marquerTousLus} style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}>Tout marquer comme lu</button>
            )}
          </div>
          {alertes.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle size={32} strokeWidth={1.5} style={{ color: '#10b981', display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune alerte active</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tous vos chantiers sont dans les normes</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertes.map(a => {
                const niv = NIVEAU_CONFIG[a.niveau] || NIVEAU_CONFIG.INFO;
                const agentMeta = AGENTS_META.find(m => m.id === a.agent);
                return (
                  <div key={a.id} onClick={() => marquerLu(a.id)}
                    style={{ ...DS.card, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, opacity: a.lu ? 0.6 : 1, borderLeft: `4px solid ${niv.color}`, cursor: 'pointer' }}>
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

      {/* ══════════════════════════════════════════════════════
          ONGLET AGENTS (20 agents organisés par tiers)
      ══════════════════════════════════════════════════════ */}
      {onglet === 'agents' && (
        <div>
          {[1, 2, 3].map(tier => {
            const agentsDuTier = AGENTS_META.filter(a => a.tier === tier);
            const meta = TIER_META[tier];
            return (
              <div key={tier} style={{ marginBottom: 28 }}>
                {/* Header tier */}
                <div onClick={() => setTierVisible(prev => ({ ...prev, [tier]: !prev[tier] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12, padding: '8px 0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.couleur }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: meta.couleur }}>{meta.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>({agentsDuTier.length} agents)</span>
                  {tierVisible[tier] ? <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
                </div>

                {tierVisible[tier] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {agentsDuTier.map(agent => {
                      const statut = agentsStatuts[agent.id] || {};
                      const actif = (agentsActifs || {})[agent.id] !== false;
                      const logs = agentsLogs[agent.id] || [];
                      const isExpanded = expanded[agent.id];
                      const nbRes = (alertes || []).filter(a => a.agent === agent.id).length;

                      return (
                        <div key={agent.id} style={{ ...DS.card, padding: '16px 20px', borderLeft: `3px solid ${agent.couleur}30` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: agent.couleur + '18', border: `1px solid ${agent.couleur}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <agent.Icon size={18} strokeWidth={1.8} style={{ color: agent.couleur }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{agent.nom}</span>
                                {agent.apprentissage && <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>APPREND</span>}
                                {!actif && <span style={{ background: 'var(--bg-glass-2)', color: 'var(--text-muted)', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>DÉSACTIVÉ</span>}
                                {statut.erreur && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>ERREUR</span>}
                                {nbRes > 0 && <span style={{ background: agent.couleur + '18', color: agent.couleur, borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{nbRes} alerte{nbRes > 1 ? 's' : ''}</span>}
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>{agent.description}</p>
                              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11 }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {agent.frequence}</span>
                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={10} /> {fmtDiff(statut.lastRun)}</span>
                                {statut.dureeMs !== undefined && <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={10} /> {statut.dureeMs}ms</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <button onClick={() => toggleAgent(agent.id)} title={actif ? 'Désactiver' : 'Activer'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: actif ? agent.couleur : 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
                                {actif ? <ToggleRight size={28} strokeWidth={1.5} /> : <ToggleLeft size={28} strokeWidth={1.5} />}
                              </button>
                              <button onClick={() => toggleExpand(agent.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>Règles</div>
                                  {agent.details.map((d, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: agent.couleur, marginTop: 6, flexShrink: 0, display: 'inline-block' }} />
                                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d}</span>
                                    </div>
                                  ))}
                                  {agent.apprentissage && memoire[agent.id] && (
                                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <Brain size={12} style={{ color: '#15803d' }} />
                                      <span style={{ fontSize: 11, color: '#15803d' }}>Mémoire accumulée disponible</span>
                                      <button onClick={() => effacerMemoire && effacerMemoire(agent.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Trash2 size={10} /> Effacer
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>10 dernières exécutions</div>
                                  {logs.length === 0 ? (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Aucune exécution</p>
                                  ) : logs.map((log, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                                      {log.erreur ? <AlertTriangle size={10} style={{ color: '#ef4444' }} /> : <CheckCircle size={10} style={{ color: '#10b981' }} />}
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
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ONGLET PRÉDICTIONS
      ══════════════════════════════════════════════════════ */}
      {onglet === 'predictions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Trésorerie */}
          {Object.keys(predictions).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Trésorerie Predictor</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Solde J+30', val: predictions.solde30, sub: `Enc. ${fmtN(predictions.encaissement30 || 0)} − Charges ${fmtN(predictions.decaissement30 || 0)}` },
                  { label: 'Solde J+60', val: predictions.solde60, sub: `Enc. cumulé ${fmtN((predictions.encaissement30 || 0) + (predictions.encaissement60 || 0))}` },
                  { label: 'Solde J+90', val: predictions.solde90, sub: `Enc. cumulé ${fmtN((predictions.encaissement30 || 0) + (predictions.encaissement60 || 0) + (predictions.encaissement90 || 0))}` },
                ].map(item => {
                  const v = item.val || 0;
                  return (
                    <div key={item.label} style={{ ...DS.card, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: v >= 0 ? '#10b981' : '#ef4444', letterSpacing: '-1px', marginBottom: 4 }}>CHF {fmtN(v)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projection annuelle */}
          {agentData?.ProjectionAnnuelle && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Projection Annuelle</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'CA Réalisé YTD', val: `CHF ${fmtN(agentData.ProjectionAnnuelle.caRealise || 0)}`, couleur: '#3b82f6', sub: `Marge : ${agentData.ProjectionAnnuelle.margeYTD?.toFixed(1) || '—'}%` },
                  { label: 'CA Projeté Fin Année', val: `CHF ${fmtN(agentData.ProjectionAnnuelle.caProjecte || 0)}`, couleur: '#10b981', sub: `Moyenne mensuelle CHF ${fmtN(agentData.ProjectionAnnuelle.moyenneMensuelle || 0)}` },
                  { label: 'Atteinte Objectif', val: agentData.ProjectionAnnuelle.txAtteinte !== null ? `${agentData.ProjectionAnnuelle.txAtteinte}%` : 'N/A', couleur: (agentData.ProjectionAnnuelle.txAtteinte || 0) >= 100 ? '#10b981' : '#f59e0b', sub: agentData.ProjectionAnnuelle.objectifCA ? `Objectif CHF ${fmtN(agentData.ProjectionAnnuelle.objectifCA)}` : 'Définir dans Analyse' },
                ].map(item => (
                  <div key={item.label} style={{ ...DS.card, padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: item.couleur, letterSpacing: '-1px', marginBottom: 4 }}>{item.val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saisonnalité */}
          {agentData?.Saisonnierte?.prochainsMois && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Saisonnalité — 3 prochains mois</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {agentData.Saisonnierte.prochainsMois.map((m, i) => (
                  <div key={i} style={{ ...DS.card, padding: '16px 18px', borderTop: `3px solid ${m.intensite === 'fort' ? '#10b981' : m.intensite === 'moyen' ? '#f59e0b' : '#ef4444'}` }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{m.mois}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{m.count} chantier(s) historiquement</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: m.intensite === 'fort' ? '#10b981' : m.intensite === 'moyen' ? '#f59e0b' : '#6b7280', textTransform: 'uppercase' }}>
                      {m.intensite === 'fort' ? '📈 Période forte' : m.intensite === 'creux' ? '📉 Période creuse' : '📊 Période normale'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ONGLET MÉMOIRE
      ══════════════════════════════════════════════════════ */}
      {onglet === 'memoire' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Les agents marqués <strong>APPREND</strong> accumulent de la connaissance entre les runs. Plus ils tournent, plus ils sont précis.
            </p>
            {effacerMemoire && (
              <button onClick={() => effacerMemoire(null)}
                style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', borderColor: '#fecaca' }}>
                <Trash2 size={12} /> Effacer toute la mémoire
              </button>
            )}
          </div>

          {/* MémoireChantier patterns */}
          {Object.keys(patterns).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>MémoireChantier — Patterns par type (chantiers terminés)</div>
              <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-glass)', borderBottom: '1px solid var(--border)' }}>
                      {['Type', 'Nb chantiers', 'Écart coûts moyen', 'Marge réelle moy.', 'Ratio temps'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Type' ? 'left' : 'right', fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(patterns).map(p => (
                      <tr key={p.type} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Brain size={14} style={{ color: '#f59e0b' }} />
                            <span style={{ fontWeight: 600 }}>{p.type}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{p.count}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: p.ecartMoyen > 0 ? '#ef4444' : '#10b981' }}>
                          {p.ecartMoyen !== null ? `${p.ecartMoyen > 0 ? '+' : ''}${p.ecartMoyen.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: (p.margeMoyenne || 0) >= 20 ? '#10b981' : (p.margeMoyenne || 0) >= 15 ? '#f59e0b' : '#ef4444' }}>
                          {p.margeMoyenne !== null ? `${p.margeMoyenne.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {p.ratioTempsMoyen !== null ? `×${p.ratioTempsMoyen.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Agents avec mémoire */}
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Mémoire long-terme par agent</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {AGENTS_META.filter(a => a.apprentissage).map(agent => {
              const agentMemoire = memoire[agent.id];
              const hasData = agentMemoire && Object.keys(agentMemoire).length > 0;
              const histLen = agentMemoire?.historique?.length || agentMemoire?.dsoHistorique?.length || agentMemoire?.projHistorique?.length || agentMemoire?.predictionsHistorique?.length || agentMemoire?.saisonHistorique?.length || agentMemoire?.coachHistorique?.length || 0;
              return (
                <div key={agent.id} style={{ ...DS.card, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: agent.couleur + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <agent.Icon size={16} style={{ color: agent.couleur }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{agent.nom}</div>
                    {hasData ? (
                      <>
                        <div style={{ fontSize: 12, color: '#15803d', marginBottom: 3 }}>
                          <Brain size={11} style={{ marginRight: 4 }} />
                          {histLen} entrée{histLen > 1 ? 's' : ''} accumulée{histLen > 1 ? 's' : ''}
                        </div>
                        <button onClick={() => effacerMemoire && effacerMemoire(agent.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Trash2 size={10} /> Réinitialiser
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pas encore de données accumulées</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ONGLET RAPPORTS
      ══════════════════════════════════════════════════════ */}
      {onglet === 'rapports' && (
        <div>
          {rapports.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun rapport généré — RapportAuto crée un résumé chaque lundi matin
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rapports.map(r => (
                <div key={r.id} style={{ ...DS.card, padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <FileBarChart2 size={18} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.semaine}</span>
                    {r.nouveau && <span style={{ background: '#8b5cf614', color: '#8b5cf6', border: '1px solid #8b5cf630', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>Nouveau</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(r.timestamp)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Heures saisies', val: `${r.heuresSaisies}h`, couleur: '#3b82f6' },
                      { label: 'CA facturé', val: `CHF ${fmtN(r.caFacture)}`, couleur: '#10b981' },
                      { label: 'Chantiers actifs', val: r.nbActifs, couleur: '#f59e0b' },
                      { label: 'En retard', val: r.nbEnRetard, couleur: r.nbEnRetard > 0 ? '#ef4444' : '#10b981' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.couleur }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {r.chantierRetard?.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B' }}>
                      En retard : {r.chantierRetard.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
