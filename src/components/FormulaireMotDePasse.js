import React, { useState } from 'react';

export default function FormulaireMotDePasse({ onSucces, messageErreur = 'Impossible de modifier le mot de passe. Réessayez ou demandez un nouveau lien.' }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const enregistrer = async event => {
    event.preventDefault();
    if (enCours) return;
    if (password.length < 8) { setMessage('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirmation) { setMessage('Les mots de passe ne sont pas identiques.'); return; }
    setEnCours(true); setMessage('');
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirmation(''); setMessage('Mot de passe modifié');
      onSucces?.();
    } catch (error) {
      console.error('updateUser', error);
      setMessage(messageErreur);
    } finally { setEnCours(false); }
  };
  return <form onSubmit={enregistrer}>
    <label>Nouveau mot de passe<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <label>Confirmation<input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    {message && <p role="status">{message}</p>}
    <button type="submit" disabled={enCours}>Enregistrer</button>
  </form>;
}
