import React, { useState, useLayoutEffect, useCallback } from 'react';
import { Bot, Shield, Sparkles, Menu, RefreshCw } from 'lucide-react';
import Agents, { NB_AGENTS } from '../Agents';
import AuditApp from '../AuditApp';
import ClaudeIAPanel from '../components/ia/ClaudeIAPanel';
import { useApp } from '../context/AppContext';
import { heroFond, heroMono, mono } from '../design/v1';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };

// Métadonnées d'onglet (icône, titre, ligne mono contextuelle) — affichage seul.
const ONGLET_META = {
  agents: { Icon: Bot,      titre: 'Agents IA', contexte: 'AGENTS IA', ligne: 'SYSTÈME MULTI-AGENTS · 3 TIERS · APPRENTISSAGE CONTINU' },
  claude: { Icon: Sparkles, titre: 'Claude AI', contexte: 'CLAUDE AI', ligne: 'ANALYSE CONVERSATIONNELLE · SYNTHÈSE MÉTIER' },
  audit:  { Icon: Shield,   titre: 'Audit',     contexte: 'AUDIT',     ligne: 'CONTRÔLE DE COHÉRENCE DES DONNÉES' },
};

function CentreIA() {
  const { chantiers, devis, factures, clients, parametres, agentState, ouvrirMenu } = useApp();
  const [onglet, setOnglet] = useState('agents');

  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);

  const tabs = [
    { id: 'agents', label: 'Agents IA', Icon: Bot },
    { id: 'claude', label: 'Claude AI', Icon: Sparkles },
    { id: 'audit',  label: 'Audit',     Icon: Shield },
  ];

  // ── Onglet AUDIT : le hero porte le score, les compteurs et « Relancer l'audit ».
  //    Le moteur d'audit reste dans AuditApp ; il remonte son résumé via onSummary
  //    et reçoit le signal « Relancer » — aucun calcul n'est dupliqué ni modifié.
  const [auditSummary, setAuditSummary] = useState(null);
  const [auditRelanceSignal, setAuditRelanceSignal] = useState(0);
  const [auditFiltreNiveau, setAuditFiltreNiveau] = useState('Tous');
  const handleAuditSummary = useCallback((s) => setAuditSummary(s), []);
  const toggleAuditNiveau = (niv) => setAuditFiltreNiveau(prev => (prev === niv ? 'Tous' : niv));

  const meta = ONGLET_META[onglet];
  const HeroIcon = meta.Icon;

  // ── Chiffres du hero — Agents IA ──
  const scoreGlobal = agentState?.scoreGlobal ?? null;
  const alertesNonLues = (agentState?.alertes || []).filter(a => !a.lu);
  const memoire = agentState?.memoire || {};
  const running = !!agentState?.running;
  const forcerExecution = agentState?.forcerExecution;

  const scoreCouleur = scoreGlobal === null ? '#8FBCE6' : scoreGlobal >= 75 ? '#4ADE80' : scoreGlobal >= 50 ? '#F5B14A' : '#FF7A6B';
  const auditScore = auditSummary?.score ?? null;
  const auditScoreCouleur = auditScore === null ? '#8FBCE6' : auditScore >= 75 ? '#4ADE80' : auditScore >= 55 ? '#F5B14A' : '#FF7A6B';

  let heroChiffres = [];
  if (onglet === 'agents') {
    heroChiffres = [
      { label: 'SCORE ENTREPRISE', val: scoreGlobal !== null ? `${scoreGlobal}/100` : '—', couleur: scoreCouleur },
      { label: 'AGENTS ACTIFS',    val: `${NB_AGENTS}/${NB_AGENTS}`,                        couleur: '#8FBCE6' },
      { label: 'ALERTES ACTIVES',  val: alertesNonLues.length,                             couleur: alertesNonLues.length > 0 ? '#FF7A6B' : '#4ADE80' },
      { label: 'MÉMOIRE ACCUMULÉE', val: `${Object.keys(memoire).length} agents`,          couleur: '#8FBCE6' },
    ];
  } else if (onglet === 'audit') {
    heroChiffres = [
      { label: 'SCORE COHÉRENCE', val: auditScore !== null ? `${auditScore}/100` : '—', couleur: auditScoreCouleur },
      { label: 'ERREURS',         val: auditSummary?.nbErreurs ?? '—',  couleur: '#FF7A6B', onClick: () => toggleAuditNiveau('err'),  actif: auditFiltreNiveau === 'err' },
      { label: 'AVERTISSEMENTS',  val: auditSummary?.nbWarnings ?? '—', couleur: '#F5B14A', onClick: () => toggleAuditNiveau('warn'), actif: auditFiltreNiveau === 'warn' },
      { label: 'OK',              val: auditSummary?.nbOk ?? '—',       couleur: '#4ADE80', onClick: () => toggleAuditNiveau('ok'),   actif: auditFiltreNiveau === 'ok' },
    ];
  }

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) — partagé par les 3 onglets ══ */}
      <div className="page-hero-bleed" data-testid="hero-ia" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
        {/* Ligne 1 — ☰ · CYNA · IA / {contexte} + bouton contextuel translucide à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· IA / {meta.contexte}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {onglet === 'agents' && forcerExecution && (
              <button onClick={() => forcerExecution()} disabled={running}
                style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, opacity: running ? 0.7 : 1 }}>
                <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
                {running ? 'Exécution...' : 'Forcer exécution'}
              </button>
            )}
            {onglet === 'audit' && (
              <button onClick={() => setAuditRelanceSignal(n => n + 1)}
                style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                <RefreshCw size={14} /> Relancer l'audit
              </button>
            )}
          </div>
        </div>

        {/* Ligne 2 — index mono + titre de l'onglet (icône + titre) + ligne mono contextuelle */}
        <div style={heroMono(11, 0.6)}>IA / 12</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <HeroIcon size={30} strokeWidth={1.8} />
          {meta.titre}
        </h1>
        <div style={heroMono(11, 0.7)}>{meta.ligne}</div>

        {/* Ligne 3 — les chiffres clés (adaptés à l'onglet ; compteurs Audit filtrables) */}
        {heroChiffres.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }} data-testid="hero-chiffres">
            {heroChiffres.map(t => {
              const commun = {
                'data-testid': `hero-kpi-${t.label.toLowerCase().replace(/\s+/g, '-')}`,
                style: {
                  background: t.actif ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${t.actif ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, padding: '12px 14px', textAlign: 'left',
                },
              };
              const contenu = (<>
                <div style={heroMono(9, 0.6)}>{t.label}</div>
                <div style={{ ...mono(22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.val}</div>
              </>);
              return t.onClick ? (
                <button key={t.label} onClick={t.onClick} {...commun}
                  style={{ ...commun.style, cursor: 'pointer', fontFamily: 'inherit' }}>{contenu}</button>
              ) : (
                <div key={t.label} {...commun}>{contenu}</div>
              );
            })}
          </div>
        )}

        {/* Ligne 4 — onglets collés au bas du hero (scrollables sur mobile) */}
        <div style={{ display: 'flex', gap: 2, marginTop: 22, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const actif = onglet === t.id;
            return (
              <button key={t.id} onClick={() => setOnglet(t.id)} style={{
                background: 'transparent', border: 'none',
                borderBottom: actif ? '2px solid #fff' : '2px solid transparent',
                color: actif ? '#fff' : 'rgba(255,255,255,0.6)',
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: actif ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <t.Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu ── */}
      {onglet === 'agents' && <Agents {...agentState} hideHeader />}
      {onglet === 'claude' && <ClaudeIAPanel />}
      {onglet === 'audit'  && (
        <AuditApp chantiers={chantiers} devis={devis} factures={factures} clients={clients} parametres={parametres}
          hideHeader onSummary={handleAuditSummary} relanceSignal={auditRelanceSignal}
          filtreNiveau={auditFiltreNiveau} setFiltreNiveau={setAuditFiltreNiveau} />
      )}
    </div>
  );
}

export default CentreIA;
