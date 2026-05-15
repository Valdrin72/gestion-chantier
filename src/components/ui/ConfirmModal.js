import React, { useEffect } from 'react';

export default function ConfirmModal({ message, labelOui = 'Confirmer', labelNon = 'Annuler', danger = true, onOui, onNon }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onNon(); if (e.key === 'Enter') onOui(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOui, onNon]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onNon(); }}
    >
      <div style={{
        background: 'var(--bg-card, #fff)', borderRadius: 14,
        padding: '28px 28px 24px', maxWidth: 440, width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        border: '1px solid var(--border, #e5e7eb)',
      }}>
        <div style={{ marginBottom: 20, fontSize: 15, lineHeight: 1.6, color: 'var(--text-main, #111)', whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onNon}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--bg-secondary, #f3f4f6)', color: 'var(--text-main, #111)',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            {labelNon}
          </button>
          <button
            autoFocus
            onClick={onOui}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: danger ? '#ef4444' : 'var(--brand, #0d3d6e)',
              color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            {labelOui}
          </button>
        </div>
      </div>
    </div>
  );
}
