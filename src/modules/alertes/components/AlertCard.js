import React, { useState } from 'react';
import { Bell, Clock, X, CheckCircle2 } from 'lucide-react';
import { DS } from '../../../ds.js';
import { V1, mono, carteV1 } from '../../../design/v1.js';
import { AlertSeverityBadge } from './AlertSeverityBadge.js';
import { useAlertActions } from '../hooks/useAlertActions.js';

// Bord gauche coloré par gravité (couleurs pleines v1, lisibles sur carte blanche).
const SEVERITY_BORDER = {
  INFO:     V1.texteMuted,
  LOW:      V1.bleuMoyen,
  MEDIUM:   V1.warn,
  HIGH:     '#C2410C',
  CRITICAL: V1.danger,
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  return `il y a ${Math.floor(seconds / 86400)}j`;
}

export function AlertCard({ alert, onNavigate }) {
  const actions = useAlertActions();
  const [hovered, setHovered] = useState(false);

  const borderColor = SEVERITY_BORDER[alert.severity] ?? '#e2e8f0';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...carteV1,
        borderLeft: `4px solid ${borderColor}`,
        marginBottom: 10,
        transition: 'box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 16px rgba(16,38,73,0.12)' : carteV1.boxShadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
          <Bell size={14} style={{ color: 'var(--text-secondary)', marginTop: 3, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AlertSeverityBadge severity={alert.severity} />
              <span style={{ ...mono(10, V1.texteMuted), textTransform: 'uppercase', letterSpacing: '0.04em' }}>{timeAgo(alert.createdAt)}</span>
              {alert.contextRef?.label && (
                <span style={{ ...mono(10, V1.texteMuted), fontStyle: 'italic' }}>
                  {alert.contextRef.label}
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 700, color: V1.texte }}>
              {alert.title}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          <button
            onClick={() => actions.snooze24h(alert.id)}
            title="Snooze 24h"
            style={{ ...DS.btnGhost, padding: '4px 6px', fontSize: 11 }}
          >
            <Clock size={13} />
          </button>
          <button
            onClick={() => actions.resolve(alert.id)}
            title="Résoudre"
            style={{ ...DS.btnGhost, padding: '4px 6px', fontSize: 11, color: '#059669' }}
          >
            <CheckCircle2 size={13} />
          </button>
          <button
            onClick={() => actions.acknowledge(alert.id)}
            title="Marquer vu"
            style={{ ...DS.btnGhost, padding: '4px 6px', fontSize: 11 }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <p style={{ margin: '6px 0 0 24px', fontSize: 12, color: V1.texteMuted, lineHeight: 1.5 }}>
        {alert.message}
      </p>

      {alert.actions && alert.actions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, marginLeft: 24, flexWrap: 'wrap' }}>
          {alert.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onNavigate?.(action.target)}
              style={{ background: V1.bleu, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
