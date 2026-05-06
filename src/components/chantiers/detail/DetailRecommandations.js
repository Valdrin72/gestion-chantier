import React from 'react';
import { C } from '../../../donnees';

function DetailRecommandations({ etat, couts }) {
  const recommandations = [];
  if (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.85)
    recommandations.push({ icone: '↓', texte: 'Le chantier consomme plus vite qu\'il n\'avance' });
  if (etat.coutTotalReel > 0 && (etat.coutMOReel / etat.coutTotalReel) > 0.6)
    recommandations.push({ icone: 'mo', texte: 'Main d\'œuvre trop élevée — vérifier productivité ou dimensionnement équipe' });
  if (couts.coutMaterielPrevu > 0 && etat.coutMateriel > couts.coutMaterielPrevu * 1.15)
    recommandations.push({ icone: 'mat', texte: 'Dépassement matériel — contrôler commandes ou pertes chantier' });
  const affichees = recommandations.slice(0, 2);
  if (affichees.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
      {affichees.map(r => (
        <div key={r.texte} style={{ background: C.warning + '10', border: `1px solid ${C.warning}35`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{r.icone}</span>
          <span style={{ fontSize: 13, color: C.warning, fontWeight: 600 }}>{r.texte}</span>
        </div>
      ))}
    </div>
  );
}

export default DetailRecommandations;
