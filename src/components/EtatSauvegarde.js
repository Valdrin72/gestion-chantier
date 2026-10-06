import React from 'react';

export function EcranChargement() {
  return <main role="status" style={{ padding: 32 }}>Chargement de vos données…</main>;
}

const bouton = { minHeight: 44, padding: '8px 16px', cursor: 'pointer' };

export function EcranErreurChargement({ message, onReessayer, onDeconnecter }) {
  return (
    <main role="alert" style={{ padding: 32, maxWidth: 640, margin: 'auto' }}>
      <h1>Vos données n'ont pas pu être chargées</h1>
      <p>{message}</p>
      <button style={bouton} onClick={onReessayer}>Réessayer</button>{' '}
      <button style={bouton} onClick={onDeconnecter}>Se déconnecter</button>
    </main>
  );
}

export function BandeauSauvegarde({ statut, message, onReessayer, onFermer }) {
  if (!['echec', 'conflit', 'information'].includes(statut)) return null;
  return (
    <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, background: '#fff3cd', color: '#513c06', padding: '12px 20px', boxShadow: '0 2px 8px #0003' }}>
      <span>{message || 'Non enregistré'}</span>{' '}
      {statut === 'echec'
        ? <button style={bouton} onClick={onReessayer}>Réessayer</button>
        : <button style={bouton} onClick={onFermer}>Compris</button>}
    </div>
  );
}
