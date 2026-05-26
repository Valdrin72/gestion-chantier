import React, { useState, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { DS } from '../../ds.js';
import { useAlertsStore } from './lib/store.js';
import { useAlerts } from './hooks/useAlerts.js';
import { AlertCard } from './components/AlertCard.js';
import { AlertSeverityBadge } from './components/AlertSeverityBadge.js';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const CATEGORIES = [
  { value: '',           label: 'Toutes' },
  { value: 'financier',  label: 'Financier' },
  { value: 'tresorerie', label: 'Trésorerie' },
  { value: 'planning',   label: 'Planning' },
  { value: 'rh',         label: 'RH' },
  { value: 'qualite',    label: 'Qualité' },
  { value: 'securite',   label: 'Sécurité' },
];

export function AlertsPage({ naviguer }) {
  const [minSeverity, setMinSeverity] = useState('LOW');
  const [category, setCategory] = useState('');

  const alerts = useAlerts({
    minSeverity,
    category: category || undefined,
  });

  // Sélectionner le tableau brut (référence stable) pour éviter boucle infinie
  const rawAlerts = useAlertsStore(s => s.alerts);
  const allActive = useMemo(() => {
    const now = Date.now();
    return rawAlerts.filter(a => {
      if (a.state === 'resolved') return false;
      if (a.state === 'snoozed' && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return false;
      return true;
    });
  }, [rawAlerts]);
  const countBySeverity = useMemo(() => {
    return SEVERITIES.reduce((acc, sev) => {
      acc[sev] = allActive.filter(a => a.severity === sev).length;
      return acc;
    }, {});
  }, [allActive]);

  const totalActif = allActive.length;
  const totalCritique = (countBySeverity.CRITICAL ?? 0) + (countBySeverity.HIGH ?? 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ background: totalCritique > 0 ? '#ef4444' : '#0d3d6e', borderRadius: 10, padding: 9, display: 'flex' }}>
          <Bell size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Alertes
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {totalActif} alerte(s) active(s)
            {totalCritique > 0 && ` — ${totalCritique} critique(s) / haute priorité`}
          </p>
        </div>
      </div>

      {/* KPIs par sévérité */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {SEVERITIES.map(sev => (
          <div
            key={sev}
            onClick={() => setMinSeverity(sev)}
            style={{
              ...DS.cardCompact,
              cursor: 'pointer',
              margin: 0,
              borderBottom: minSeverity === sev ? '3px solid #0d3d6e' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <AlertSeverityBadge severity={sev} />
            <p style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', tabularNums: true }}>
              {countBySeverity[sev] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={minSeverity}
          onChange={(e) => setMinSeverity(e.target.value)}
          style={{ ...DS.input, width: 'auto', padding: '7px 12px', fontSize: 13 }}
        >
          {SEVERITIES.map(s => (
            <option key={s} value={s}>Sévérité ≥ {s}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ ...DS.input, width: 'auto', padding: '7px 12px', fontSize: 13 }}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Liste d'alertes */}
      <div>
        {alerts.length === 0 ? (
          <div style={{
            ...DS.card,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 32px', textAlign: 'center',
          }}>
            <Bell size={40} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
            <p style={{ marginTop: 16, fontSize: 15, color: 'var(--text-secondary)' }}>
              Aucune alerte ne correspond aux filtres sélectionnés.
            </p>
          </div>
        ) : (
          alerts.map(a => <AlertCard key={a.id} alert={a} onNavigate={naviguer} />)
        )}
      </div>
    </div>
  );
}
