import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Bot, TrendingUp, Award, FileBarChart2, Menu } from 'lucide-react';
import Analyse from '../Analyse';
import SimulateurCroissance from '../SimulateurCroissance';
import BenchmarkMarche from '../BenchmarkMarche';
import { useApp } from '../context/AppContext';
import { V1, mono, carteV1, heroFond, heroMono } from '../design/v1';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };

// Ligne mono contextuelle par onglet (affichage seul).
const LIGNE_MONO = {
  'rapport-ia': 'RÉSUMÉ EXÉCUTIF IA · SYNTHÈSE AUTOMATIQUE',
  'analyse':    'ANALYSE FINANCIÈRE · RENTABILITÉ & TENDANCES',
  'simulateur': 'SIMULATION DE CROISSANCE · PROJECTIONS',
  'benchmark':  'BENCHMARK MARCHÉ · POSITIONNEMENT GENÈVE',
};

// ── Onglet Rapport IA — contenu habillé v1 (données inchangées : agentData.RapportNaturel) ──
function RapportIA({ agentData }) {
  const rapport = agentData?.RapportNaturel;
  if (!rapport?.paras?.length) {
    return (
      <div style={{ ...carteV1, textAlign: 'center', padding: '36px 20px', color: V1.texteMuted, fontSize: 13 }}>
        Rapport IA non encore généré — les agents s'exécutent automatiquement et produiront ce résumé lors du prochain cycle.
      </div>
    );
  }
  const scoreColor = rapport.scoreEntreprise >= 70 ? V1.ok : rapport.scoreEntreprise >= 40 ? V1.warn : V1.danger;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...carteV1, padding: '28px 32px', borderLeft: `4px solid ${V1.bleu}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Bot size={22} color={V1.bleu} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: V1.texte }}>Résumé exécutif — IA</div>
            <div style={{ ...mono(11, V1.texteMuted), marginTop: 2 }}>{typeof rapport.date === 'string' ? rapport.date : ''}</div>
          </div>
          {rapport.scoreEntreprise !== null && (
            <div style={{ textAlign: 'center', background: scoreColor + '14', border: `1px solid ${scoreColor}30`, borderRadius: 12, padding: '10px 18px' }}>
              <div style={{ ...mono(32, scoreColor, 600), lineHeight: 1 }}>{rapport.scoreEntreprise}</div>
              <div style={{ ...mono(10, V1.texteMuted, 700), marginTop: 2 }}>SCORE /100</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rapport.paras.map((para, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: V1.bleuFond, border: `1px solid ${V1.bleu}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono(11, V1.bleu, 700), flexShrink: 0 }}>
                {i + 1}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: V1.texteMuted, lineHeight: 1.75 }}>{typeof para === 'string' ? para : ''}</p>
            </div>
          ))}
        </div>
        {rapport.actionPrincipale && (
          <div style={{ marginTop: 22, padding: '14px 18px', background: V1.bleuFond, border: `1px solid ${V1.bleu}33`, borderRadius: 10 }}>
            <div style={{ ...mono(10, V1.bleu, 700), textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Action prioritaire recommandée</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: V1.texte }}>{typeof rapport.actionPrincipale.action === 'string' ? rapport.actionPrincipale.action : ''}</div>
            <div style={{ ...mono(12, V1.bleu), marginTop: 3 }}>{typeof rapport.actionPrincipale.detail === 'string' ? rapport.actionPrincipale.detail : ''}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function RapportsPage({ chantiers, clients, devis, parametres, setParametres, periodeGlobale, naviguer, factures }) {
  const { agentState, contexte, ouvrirMenu } = useApp();
  const [onglet, setOnglet] = useState(contexte?.onglet || 'rapport-ia');
  useEffect(() => { if (contexte?.onglet) setOnglet(contexte.onglet); }, [contexte?.onglet]);

  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);

  const tabs = [
    { id: 'rapport-ia',  label: 'Rapport IA',  Icon: Bot },
    { id: 'analyse',     label: 'Analyse',     Icon: null },
    { id: 'simulateur',  label: 'Simulateur',  Icon: TrendingUp },
    { id: 'benchmark',   label: 'Benchmark',   Icon: Award },
  ];

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) — partagé par les 4 onglets ══ */}
      <div className="page-hero-bleed" data-testid="hero-rapports" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
        {/* Ligne 1 — ☰ · CYNA · RAPPORTS / 12. Vue d'ensemble ANNUELLE : pas de sélecteur de période
            (le contenu est global et ne réagit pas à la période — un sélecteur serait trompeur). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· RAPPORTS / 12</span>
        </div>

        {/* Ligne 2 — index mono + titre + ligne mono contextuelle */}
        <div style={heroMono(11, 0.6)}>RAPPORTS / 12</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileBarChart2 size={30} strokeWidth={1.8} />
          Rapports
        </h1>
        <div style={heroMono(11, 0.7)}>{LIGNE_MONO[onglet]}</div>

        {/* Ligne 3 — onglets collés au bas du hero (défilables sur mobile) */}
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
                {t.Icon && <t.Icon size={14} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu ── */}
      {onglet === 'rapport-ia'  && <RapportIA agentData={agentState?.agentData} />}
      {onglet === 'analyse'     && <Analyse chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} factures={factures} periodeGlobale={periodeGlobale} />}
      {onglet === 'simulateur'  && <SimulateurCroissance chantiers={chantiers} devis={devis} factures={factures || []} parametres={parametres} />}
      {onglet === 'benchmark'   && <BenchmarkMarche chantiers={chantiers} devis={devis} parametres={parametres} />}
    </div>
  );
}

export default RapportsPage;
