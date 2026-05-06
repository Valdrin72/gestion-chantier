import React from 'react';
import { C } from '../../../donnees';

function DetailEcarts({ couts, fmtN }) {
  const lignes = [
    { label: 'Main d\'œuvre', prevu: couts.coutEquipePrevu, reel: couts.coutEquipeReel, ecart: couts.ecartEquipe, ecartPct: couts.ecartEquipePct },
    { label: 'Matériel', prevu: couts.coutMaterielPrevu, reel: couts.coutMaterielReel, ecart: couts.ecartMateriel, ecartPct: couts.ecartMaterielPct },
    { label: 'Sous-traitance', prevu: couts.coutSousTraitancePrevu, reel: couts.coutSousTraitanceReel, ecart: couts.ecartSousTraitance, ecartPct: couts.ecartSousTraitancePct },
    { label: 'Autres', prevu: couts.autresCoutsPrevu, reel: couts.autresCoutsReel, ecart: couts.ecartAutres, ecartPct: couts.ecartAutresPct },
  ].filter(l => l.prevu > 0 || l.reel > 0);
  const totalEcart = couts.totalCoutsReel - couts.totalCoutsPrevu;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 8 }}>Écart prévu / réel par poste</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-glass-2)' }}>
              {['Poste', 'Prévu', 'Réel', 'Écart', '%'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Poste' ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => {
              const couleurEcart = l.ecart > 0 ? C.danger : l.ecart < 0 ? C.secondaire : 'var(--text-muted)';
              return (
                <tr key={l.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{l.label}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>CHF {fmtN(l.prevu)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>CHF {fmtN(l.reel)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: couleurEcart }}>{l.ecart > 0 ? '+' : ''}{l.ecart !== 0 ? `CHF ${fmtN(Math.abs(l.ecart))}` : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: couleurEcart }}>{l.ecart > 0 ? '+' : l.ecart < 0 ? '-' : ''}{l.ecart !== 0 && l.ecartPct !== null ? `${Math.abs(l.ecartPct)}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-glass-2)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>CHF {fmtN(couts.totalCoutsPrevu)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>CHF {fmtN(couts.totalCoutsReel)}</td>
              <td colSpan={2} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: totalEcart > 0 ? C.danger : totalEcart < 0 ? C.secondaire : 'var(--text-muted)' }}>{totalEcart > 0 ? '+' : ''}{totalEcart !== 0 ? `CHF ${fmtN(Math.abs(totalEcart))}` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default DetailEcarts;
