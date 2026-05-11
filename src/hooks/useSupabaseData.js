/**
 * CYNA — Sync données localStorage ↔ Supabase
 *
 * Stratégie :
 * 1. Chargement : Supabase en priorité, localStorage en fallback (offline)
 * 2. Sauvegarde : Supabase + localStorage simultanément
 * 3. Migration : si Supabase vide mais localStorage plein → migration auto
 * 4. Real-time : souscription aux changements Supabase pour multi-appareils
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { donneesInitiales, migrerJournal, migrerDevisId } from '../donnees';

const LEGACY = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };

function chargerLocal(cle, defaut) {
  try {
    const raw = localStorage.getItem(cle);
    return raw ? JSON.parse(raw) : defaut;
  } catch { return defaut; }
}
function sauvegarderLocal(cle, data) {
  try { localStorage.setItem(cle, JSON.stringify(data)); } catch {}
}

export default function useSupabaseData(userId) {
  const [chantiers,   setChantiersState]   = useState([]);
  const [devis,       setDevisState]       = useState([]);
  const [factures,    setFacturesState]    = useState([]);
  const [clients,     setClientsState]     = useState([]);
  const [parametres,  setParametresState]  = useState(donneesInitiales);
  const [loading,     setLoading]          = useState(true);
  const [syncing,     setSyncing]          = useState(false);

  const syncTimerRef = useRef(null);
  const pendingRef   = useRef(null);

  // ── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function charger() {
      setLoading(true);
      try {
        const { data: row } = await supabase
          .from('user_data')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (cancelled) return;

        if (row) {
          // Données cloud disponibles
          appliquerDonnees(row);
        } else {
          // Première connexion : migrer depuis localStorage
          const localChantiers = chargerLocal('cyna_chantiers', donneesInitiales.chantiers);
          const localDevis     = chargerLocal('cyna_devis', donneesInitiales.devis);
          const localFactures  = chargerLocal('cyna_factures', []);
          const localClients   = chargerLocal('cyna_clients', donneesInitiales.clients);
          const localParams    = chargerLocal('cyna_parametres', donneesInitiales);

          const migrated = {
            chantiers:  localChantiers.map(c => ({ ...c, journal: migrerJournal(c.journal || []) })),
            devis:      localDevis.map(d => ({ ...d, statut: LEGACY[d.statut] || d.statut })),
            factures:   localFactures,
            clients:    localClients,
            parametres: localParams,
          };

          if (!cancelled) appliquerDonnees(migrated);

          // Uploader la migration vers Supabase
          await pousserVersSupabase(migrated);
        }
      } catch (e) {
        // Offline : utiliser localStorage
        if (!cancelled) appliquerDonnees({
          chantiers:  chargerLocal('cyna_chantiers', donneesInitiales.chantiers).map(c => ({ ...c, journal: migrerJournal(c.journal || []) })),
          devis:      chargerLocal('cyna_devis', donneesInitiales.devis).map(d => ({ ...d, statut: LEGACY[d.statut] || d.statut })),
          factures:   chargerLocal('cyna_factures', []),
          clients:    chargerLocal('cyna_clients', donneesInitiales.clients),
          parametres: chargerLocal('cyna_parametres', donneesInitiales),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    charger();

    // Real-time : écoute les changements depuis d'autres appareils
    const channel = supabase
      .channel(`user_data_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'user_data',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new) appliquerDonnees(payload.new);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function appliquerDonnees(row) {
    const c = (row.chantiers || []).map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
    const d = (row.devis || []).map(d => ({ ...d, statut: LEGACY[d.statut] || d.statut }));
    setChantiersState(c);
    setDevisState(d);
    setFacturesState(row.factures || []);
    setClientsState(row.clients || []);
    setParametresState(row.parametres || donneesInitiales);
  }

  // ── Sauvegarde Supabase (avec debounce 800ms) ────────────────────────────
  async function pousserVersSupabase(updates) {
    if (!userId) return;
    setSyncing(true);
    try {
      await supabase.from('user_data').upsert({
        user_id:    userId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('[Sync]', e.message);
    } finally {
      setSyncing(false);
    }
  }

  function scheduleSync(updates) {
    pendingRef.current = { ...(pendingRef.current || {}), ...updates };
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (pendingRef.current) {
        pousserVersSupabase(pendingRef.current);
        pendingRef.current = null;
      }
    }, 800);
  }

  // ── Setters (état + localStorage + Supabase) ─────────────────────────────
  const setChantiers = useCallback((updater) => {
    setChantiersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sauvegarderLocal('cyna_chantiers', next);
      scheduleSync({ chantiers: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setDevis = useCallback((data) => {
    setDevisState(data);
    sauvegarderLocal('cyna_devis', data);
    scheduleSync({ devis: data });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setFactures = useCallback((data) => {
    setFacturesState(data);
    sauvegarderLocal('cyna_factures', data);
    scheduleSync({ factures: data });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setClients = useCallback((data) => {
    setClientsState(data);
    sauvegarderLocal('cyna_clients', data);
    scheduleSync({ clients: data });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setParametres = useCallback((data) => {
    setParametresState(data);
    sauvegarderLocal('cyna_parametres', data);
    scheduleSync({ parametres: data });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    chantiers, setChantiers,
    devis, setDevis,
    factures, setFactures,
    clients, setClients,
    parametres, setParametres,
    loading, syncing,
  };
}
