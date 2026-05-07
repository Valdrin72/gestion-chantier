import React, { useState } from 'react';
import Statistiques from '../Statistiques';
import Rapport from '../Rapport';
import Analyse from '../Analyse';
import Marges from '../Marges';

// ── Rapport + Statistiques + Analyse ─────────────────────────────────────
function RapportsPage({ chantiers, clients, devis, parametres, setParametres, paiementsData, periodeGlobale, naviguer }) {
  const [onglet, setOnglet] = useState('marges');
  const tabs = [
    { id: 'marges',       label: 'Marges' },
    { id: 'rapport',      label: 'Rapport' },
    { id: 'statistiques', label: 'Statistiques' },
    { id: 'analyse',      label: 'Analyse' },
  ];
  const pillActive = { background: '#EEF2FF', color: '#4F46E5', border: '1px solid transparent' };
  const pillInactive = { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ ...onglet === t.id ? pillActive : pillInactive, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>
      {onglet === 'marges'       && <Marges chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} />}
      {onglet === 'rapport'      && <Rapport chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} paiementsData={paiementsData} naviguer={naviguer} />}
      {onglet === 'statistiques' && <Statistiques chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} periodeGlobale={periodeGlobale} />}
      {onglet === 'analyse'      && <Analyse chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} />}
    </div>
  );
}

export default RapportsPage;
