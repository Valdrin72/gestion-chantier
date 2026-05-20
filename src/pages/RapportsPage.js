import React, { useState, useEffect } from 'react';
import Analyse from '../Analyse';
import SimulateurCroissance from '../SimulateurCroissance';
import BenchmarkMarche from '../BenchmarkMarche';
import { useApp } from '../context/AppContext';
import { DS } from '../ds';
import { Bot, TrendingUp, Award } from 'lucide-react';

function RapportIA({ agentData }) {
  const rapport = agentData?.RapportNaturel;
  if (!rapport?.paras?.length) {
    return (
      <div style={{ ...DS.card, textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
        Rapport IA non encore généré — les agents s'exécutent automatiquement et produiront ce résumé lors du prochain cycle.
      </div>
    );
  }
  const scoreColor = rapport.scoreEntreprise >= 70 ? '#10b981' : rapport.scoreEntreprise >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...DS.card, padding: '28px 32px', borderLeft: '4px solid #8b5cf6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Bot size={22} color="#8b5cf6" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Résumé exécutif — IA</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{rapport.date}</div>
          </div>
          {rapport.scoreEntreprise !== null && (
            <div style={{ textAlign: 'center', background: scoreColor + '14', border: `1px solid ${scoreColor}30`, borderRadius: 12, padding: '10px 18px' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{rapport.scoreEntreprise}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>SCORE /100</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rapport.paras.map((para, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#8b5cf614', border: '1px solid #8b5cf630', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8b5cf6', flexShrink: 0 }}>
                {i + 1}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{para}</p>
            </div>
          ))}
        </div>
        {rapport.actionPrincipale && (
          <div style={{ marginTop: 22, padding: '14px 18px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#082d52', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Action prioritaire recommandée</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0d3d6e' }}>{rapport.actionPrincipale.action}</div>
            <div style={{ fontSize: 12, color: '#0d3d6e', marginTop: 3 }}>{rapport.actionPrincipale.detail}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function RapportsPage({ chantiers, clients, devis, parametres, setParametres, paiementsData, periodeGlobale, naviguer, factures }) {
  const { agentState, contexte } = useApp();
  const [onglet, setOnglet] = useState(contexte?.onglet || 'rapport-ia');
  useEffect(() => { if (contexte?.onglet) setOnglet(contexte.onglet); }, [contexte?.onglet]);
  const tabs = [
    { id: 'rapport-ia',  label: 'Rapport IA',  Icon: Bot },
    { id: 'analyse',     label: 'Analyse',     Icon: null },
    { id: 'simulateur',  label: 'Simulateur',  Icon: TrendingUp },
    { id: 'benchmark',   label: 'Benchmark',   Icon: Award },
  ];
  const pillActive   = { background: DS.brand.soft, color: DS.brand.secondary, border: '1px solid transparent' };
  const pillInactive = { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ ...onglet === t.id ? pillActive : pillInactive, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
            {t.Icon && <t.Icon size={13} />}
            {t.label}
          </button>
        ))}
      </div>
      {onglet === 'rapport-ia'  && <RapportIA agentData={agentState?.agentData} />}
      {onglet === 'analyse'     && <Analyse chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} periodeGlobale={periodeGlobale} />}
      {onglet === 'simulateur'  && <SimulateurCroissance chantiers={chantiers} devis={devis} factures={factures || []} parametres={parametres} />}
      {onglet === 'benchmark'   && <BenchmarkMarche chantiers={chantiers} devis={devis} parametres={parametres} />}
    </div>
  );
}

export default RapportsPage;
