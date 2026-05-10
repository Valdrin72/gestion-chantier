import React, { useState } from 'react';
import Planning from '../Planning';
import Calendrier from '../Calendrier';

// ── Planning + Calendrier ─────────────────────────────────────────────────
function PlanningPage({ chantiers, setChantiers, clients, devis, factures, parametres, naviguer }) {
  const [onglet, setOnglet] = useState('planning');
  const tabs = [{ id: 'planning', label: 'Planning' }, { id: 'calendrier', label: 'Calendrier' }];
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
      {onglet === 'planning'   && <Planning chantiers={chantiers} setChantiers={setChantiers} clients={clients} parametres={parametres} naviguer={naviguer} />}
      {onglet === 'calendrier' && <Calendrier chantiers={chantiers} clients={clients} devis={devis} factures={factures} />}
    </div>
  );
}

export default PlanningPage;
