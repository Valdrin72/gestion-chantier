import React from 'react';
import { X } from 'lucide-react';
import { DS } from '../ds';
import SaisieHeuresRapide from './SaisieHeuresRapide';

/**
 * Modale « Saisir heures » de la fiche chantier — enveloppe autour du composant
 * de saisie UNIFIÉ (chantier fixé au contexte). Même logique que l'Accueil et la
 * grille Heures ; écriture via upsertPointage (fusion C1, majorations centralisées).
 */
function ModalSaisieHeures({ chantierSaisie, initialDate, onFermer, onSave, parametres }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 600, border: '1px solid var(--border-hover)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>Saisie des heures</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{chantierSaisie.nom}</div>
          </div>
          <button onClick={onFermer} style={{ ...DS.btnDanger, padding: '8px 12px' }}><X size={16} /></button>
        </div>

        <SaisieHeuresRapide
          chantierFixe={chantierSaisie}
          initialDate={initialDate}
          parametres={parametres}
          onSaved={onSave}
        />
      </div>
    </div>
  );
}

export default ModalSaisieHeures;
