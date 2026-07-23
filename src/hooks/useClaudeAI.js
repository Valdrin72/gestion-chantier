import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { construireCorrespondance, pseudonymiser, reidentifier } from '../lib/pseudonymisation';

// Plafond strict sur la mémoire envoyée à un service externe (défense en profondeur).
const CAP_CONTEXTE = 8000;

export function useClaudeAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { parametres, chantiers = [], clients = [] } = useApp();
  // Interrupteur maître : l'Assistant IA est ACTIVÉ par défaut (les données envoyées sont
  // anonymisées). L'utilisateur peut le couper complètement dans Paramètres → Confidentialité :
  // tant qu'il est explicitement à false, AUCUN appel réseau ne part — quelle que soit l'action.
  const iaActivee = parametres?.parametres?.iaActivee !== false;

  const appeler = useCallback(async (action, data) => {
    if (!iaActivee) {
      setError('Assistant IA désactivé (Paramètres → Confidentialité). Aucune donnée envoyée.');
      return null; // kill-switch : on ne touche jamais au réseau
    }
    setLoading(true);
    setError(null);
    try {
      // ── ANONYMISATION (avant tout envoi) ────────────────────────────────
      // Table de correspondance construite EN MÉMOIRE à chaque appel, jamais persistée.
      const corr = construireCorrespondance({ chantiers, clients, employes: parametres?.employes || [] });
      // Plafond dur sur le contexte mémoire, en plus du garde côté panneau.
      const cap = { ...data };
      if (typeof cap.contexte_cyna === 'string') cap.contexte_cyna = cap.contexte_cyna.slice(-CAP_CONTEXTE);
      if (typeof cap.memoire === 'string')       cap.memoire       = cap.memoire.slice(-CAP_CONTEXTE);
      // Pseudonymise TOUT le payload (données structurées ET textes libres : chat, PDF, mémoire).
      // Les montants/%/dates/heures/types de travaux (non nominatifs) ne matchent aucun nom → intacts.
      const payload = pseudonymiser(cap, corr);

      const { data: result, error: fnError } = await supabase.functions.invoke('claude-ia', {
        body: { action, data: payload },
      });
      if (fnError) throw new Error(fnError.message ?? 'Erreur Edge Function');
      if (result?.error) throw new Error(result.error);
      // Ré-identification : les pseudonymes de la réponse redeviennent les vrais noms pour l'affichage.
      return reidentifier(result?.texte ?? '', corr);
    } catch (err) {
      const msg = err.message ?? 'Erreur inconnue';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [iaActivee, chantiers, clients, parametres]);

  return { appeler, loading, error };
}
