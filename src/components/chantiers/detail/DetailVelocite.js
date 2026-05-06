import React from 'react';
import { calculerVitesseChantier, C } from '../../../donnees';

function DetailVelocite({ c, etat }) {
  const v = calculerVitesseChantier(c, etat);
  if (!v) return null;
  const gravite = v.retardEstime >= 5 ? 'critique' : v.retardEstime >= 2 ? 'attention' : 'ok';
  const graviteConfig = {
    critique:  { niveau: 'danger', couleur: C.danger,     titre: `+${v.retardEstime} jours de retard — action nécessaire` },
    attention: { niveau: 'warning', couleur: C.warning,    titre: `+${v.retardEstime} jour${v.retardEstime > 1 ? 's' : ''} de retard — action recommandée` },
    ok:        { niveau: 'ok', couleur: C.secondaire, titre: 'Dans les temps' },
  }[gravite];
  let reco = null;
  let impact = null;
  if (gravite === 'critique' || gravite === 'attention') {
    if (v.gainJours > 0) {
      reco = `→ Ajouter 1 ouvrier pendant quelques jours`;
      impact = v.nouveauRetard <= 1 ? 'Permet de revenir dans les délais' : `Permet de réduire le retard à ~${v.nouveauRetard} j`;
    } else {
      reco = `→ Revoir le planning ou étendre la durée`;
      impact = 'Rattrapage nécessaire sans renfort disponible';
    }
  } else {
    reco = '→ Surveiller — rattrapage possible sans action';
  }
  return (
    <div style={{ padding: '16px 20px', borderRadius: 14, marginBottom: 16,
      background: graviteConfig.couleur === C.secondaire
        ? `radial-gradient(ellipse at 6% 50%, ${C.secondaire}0d 0%, transparent 80%)`
        : `radial-gradient(ellipse at 6% 50%, ${graviteConfig.couleur}0f 0%, transparent 80%)`,
      border: `1px solid ${graviteConfig.couleur}30`, borderLeft: `4px solid ${graviteConfig.couleur}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: reco ? 12 : 0 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{graviteConfig.icone}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: graviteConfig.couleur, letterSpacing: '-0.2px' }}>{graviteConfig.titre}</span>
      </div>
      {reco && (
        <div style={{ paddingLeft: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: impact ? 4 : 0 }}>{reco}</div>
          {impact && <div style={{ fontSize: 12, color: graviteConfig.couleur, fontWeight: 600 }}>{impact}</div>}
        </div>
      )}
    </div>
  );
}

export default DetailVelocite;
