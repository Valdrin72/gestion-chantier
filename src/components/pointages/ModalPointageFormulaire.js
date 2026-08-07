import React from 'react';
import { X } from 'lucide-react';
import { heroFond, heroMono } from '../../design/v1';
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
        background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 600,
        border: '1px solid var(--border-hover)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* En-tête bleu nuit (grille technique) */}
        <div style={{ ...heroFond, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
              Pointage
            </h2>
            <div style={{ ...heroMono(10, 0.65), marginTop: 3 }}>SAISIE — RÉPARTITION CHANTIER · CCT</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '24px 32px 28px' }}>
        <PointageFormulaire
          initialDate={initialDate}
          initialEmployeId={initialEmployeId}
          initialChantierId={initialChantierId}
          onSaved={onClose}
        />
        </div>
      </div>
    </div>
  );
}
