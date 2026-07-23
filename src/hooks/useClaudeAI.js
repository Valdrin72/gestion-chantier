import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

// Plafond strict sur la mémoire envoyée à un service externe (défense en profondeur).
const CAP_CONTEXTE = 8000;

export function useClaudeAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { parametres } = useApp();
  // Interrupteur maître : l'Assistant IA est DÉSACTIVÉ par défaut. Tant qu'il n'est pas
  // explicitement activé dans Paramètres, AUCUN appel réseau ne part — quelle que soit l'action.
  const iaActivee = parametres?.parametres?.iaActivee === true;

  const appeler = useCallback(async (action, data) => {
    if (!iaActivee) {
      setError('Assistant IA désactivé (Paramètres → Confidentialité). Aucune donnée envoyée.');
      return null; // kill-switch : on ne touche jamais au réseau
    }
    setLoading(true);
    setError(null);
    try {
      // Plafond dur sur le contexte mémoire, en plus du garde côté panneau.
      const payload = { ...data };
      if (typeof payload.contexte_cyna === 'string') payload.contexte_cyna = payload.contexte_cyna.slice(-CAP_CONTEXTE);
      if (typeof payload.memoire === 'string')       payload.memoire       = payload.memoire.slice(-CAP_CONTEXTE);
      const { data: result, error: fnError } = await supabase.functions.invoke('claude-ia', {
        body: { action, data: payload },
      });
      if (fnError) throw new Error(fnError.message ?? 'Erreur Edge Function');
      if (result?.error) throw new Error(result.error);
      return result?.texte ?? '';
    } catch (err) {
      const msg = err.message ?? 'Erreur inconnue';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [iaActivee]);

  return { appeler, loading, error };
}
