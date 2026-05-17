import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useClaudeAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const appeler = useCallback(async (action, data) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('claude-ia', {
        body: { action, data },
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
  }, []);

  return { appeler, loading, error };
}
