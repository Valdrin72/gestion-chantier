import React, { useState } from 'react';
import { Bot, Shield, Sparkles } from 'lucide-react';
import Agents from '../Agents';
import AuditApp from '../AuditApp';
import ClaudeIAPanel from '../components/ia/ClaudeIAPanel';
import { useApp } from '../context/AppContext';
import { DS } from '../ds';

function CentreIA() {
  const { chantiers, devis, factures, clients, parametres, agentState } = useApp();
  const [onglet, setOnglet] = useState('agents');
  const tabs = [
    { id: 'agents', label: 'Agents IA',  Icon: Bot },
    { id: 'claude', label: 'Claude AI',  Icon: Sparkles },
    { id: 'audit',  label: 'Audit',      Icon: Shield },
  ];
  const pillActive   = { background: DS.brand.soft, color: DS.brand.secondary, border: '1px solid transparent' };
  const pillInactive = { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ ...onglet === t.id ? pillActive : pillInactive, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {onglet === 'agents' && <Agents {...agentState} />}
      {onglet === 'claude' && <ClaudeIAPanel />}
      {onglet === 'audit'  && <AuditApp chantiers={chantiers} devis={devis} factures={factures} clients={clients} parametres={parametres} />}
    </div>
  );
}

export default CentreIA;
