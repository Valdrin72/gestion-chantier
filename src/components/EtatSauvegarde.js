import React from 'react';

export function EcranChargement() {
  return <main role="status" style={{ padding: 32 }}>Chargement de vos données…</main>;
}

const bouton = { minHeight: 44, padding: '8px 16px', cursor: 'pointer' };

export const LIBELLE_TELECHARGER_REFUS = 'Télécharger mes modifications refusées';

export function EcranErreurChargement({ message, onReessayer, onDeconnecter, onTelechargerRefus }) {
  return (
    <main role="alert" style={{ padding: 32, maxWidth: 640, margin: 'auto' }}>
      <h1>Vos données n'ont pas pu être chargées</h1>
      <p>{message}</p>
      {onTelechargerRefus && <><button style={bouton} onClick={onTelechargerRefus}>{LIBELLE_TELECHARGER_REFUS}</button>{' '}</>}
      <button style={bouton} onClick={onReessayer}>Réessayer</button>{' '}
      <button style={bouton} onClick={onDeconnecter}>Se déconnecter</button>
    </main>
  );
}

export const MESSAGE_REFUS_NON_SAUVE = "Des modifications refusées n'ont pas pu être copiées sur cet appareil. Téléchargez-les pour ne pas les perdre.";

// refusNonSauve : des modifications refusées sans copie locale n'ont pas encore été téléchargées.
// Le bandeau reste alors affiché (avec le téléchargement) jusqu'au téléchargement ou à un abandon confirmé.
export function BandeauSauvegarde({ statut, message, onReessayer, onFermer, onTelechargerRefus, refusNonSauve = false, onAbandonnerRefus }) {
  const actif = ['echec', 'conflit', 'information'].includes(statut);
  if (!actif && !refusNonSauve) return null;
  return (
    <div role="alert" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, background: '#fff3cd', color: '#513c06', padding: '12px 20px', boxShadow: '0 2px 8px #0003' }}>
      <span>{(actif && message) || (refusNonSauve ? MESSAGE_REFUS_NON_SAUVE : 'Non enregistré')}</span>{' '}
      {statut === 'echec' && <><button style={bouton} onClick={onReessayer}>Réessayer</button>{' '}</>}
      {(statut === 'conflit' || refusNonSauve) && onTelechargerRefus && <><button style={bouton} onClick={onTelechargerRefus}>{LIBELLE_TELECHARGER_REFUS}</button>{' '}</>}
      {refusNonSauve
        ? onAbandonnerRefus && <button style={bouton} onClick={onAbandonnerRefus}>Abandonner ces modifications</button>
        : actif && statut !== 'echec' && <button style={bouton} onClick={onFermer}>Compris</button>}
    </div>
  );
}
