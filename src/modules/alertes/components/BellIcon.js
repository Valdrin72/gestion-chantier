import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useUrgentCount, useAlertCount } from '../hooks/useAlertCount.js';
import { NotificationCenter } from './NotificationCenter.js';

export function BellIcon({ role, onNavigate }) {
  const [open, setOpen] = useState(false);
  const urgentCount = useUrgentCount(role);
  const totalCount = useAlertCount({ role });
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const Icon = urgentCount > 0 ? BellRing : Bell;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`${totalCount} alertes`}
        style={{
          background: open ? 'rgba(13,61,110,0.10)' : 'var(--bg-glass-2, rgba(0,0,0,0.04))',
          border: open ? '1px solid rgba(13,61,110,0.25)' : '1px solid var(--border)',
          borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: urgentCount > 0 ? '#ef4444' : 'var(--text-secondary)',
          position: 'relative', transition: 'all 0.15s', flexShrink: 0,
          animation: urgentCount > 0 ? 'pulse 2s infinite' : 'none',
        }}
      >
        <Icon size={16} strokeWidth={2} />
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 20,
            background: urgentCount > 0 ? '#ef4444' : '#0d3d6e',
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid var(--bg-topbar, #fff)',
            lineHeight: 1, pointerEvents: 'none',
          }}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 42, zIndex: 1000,
        }}>
          <NotificationCenter
            role={role}
            onNavigate={(t) => { setOpen(false); onNavigate?.(t); }}
          />
        </div>
      )}
    </div>
  );
}
