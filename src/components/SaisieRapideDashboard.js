import React, { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import SaisieHeuresRapide from './SaisieHeuresRapide';

/**
 * Widget repliable de l'Accueil — enveloppe autour du composant de saisie UNIFIÉ.
 * (La logique de saisie/écriture vit dans SaisieHeuresRapide, partagée avec la
 * fiche chantier et la grille Heures.)
 */
export default function SaisieRapideDashboard({ chantiersActifs, parametres }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div style={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 16, boxShadow: 'var(--ds-card-shadow)', overflow: 'hidden' }}>
      <button onClick={() => setOuvert(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={15} style={{ color: '#10b981' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Saisie rapide d'heures</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Enregistrer les heures du jour directement depuis le tableau de bord</div>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {ouvert && (
        <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--dash-border)' }}>
          <SaisieHeuresRapide chantiers={chantiersActifs} parametres={parametres} />
        </div>
      )}
    </div>
  );
}
