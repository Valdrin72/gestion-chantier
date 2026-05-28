import React from 'react';
import { X } from 'lucide-react';
import { DS } from '../../ds';
import PointageFormulaire from './PointageFormulaire';

/**
 * Overlay modal qui enveloppe PointageFormulaire.
 * Se monte à l'ouverture et se démonte à la fermeture — reset garanti à chaque ouverture.
 * Props initial* transmises telles quelles à PointageFormulaire pour le pré-remplissage.
 */
export default function ModalPointageFormulaire({ initialDate, initialEmployeId, initialChantierId, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20,
        padding: '28px 32px', width: '100%', maxWidth: 600,
        border: '1px solid var(--border-hover)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Pointage
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ ...DS.btnDanger, padding: '8px 12px' }}
          >
            <X size={16} />
          </button>
        </div>
        <PointageFormulaire
          initialDate={initialDate}
          initialEmployeId={initialEmployeId}
          initialChantierId={initialChantierId}
          onSaved={onClose}
        />
      </div>
    </div>
  );
}
