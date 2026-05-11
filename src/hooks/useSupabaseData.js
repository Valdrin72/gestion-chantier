/**
 * CYNA — Sync données localStorage ↔ Supabase (cloud)
 *
 * Approche pragmatique : une seule ligne par utilisateur dans la table `devis`
 * (qui possède une colonne `data jsonb`), contenant TOUT :
 *   { chantiers, devis, factures, clients, parametres }
 *
 * On utilise `numero = '__cyna_storage__'` comme marqueur pour distinguer
 * cette ligne de stockage des vrais devis (au cas où on migre plus tard
 * vers un modèle relationnel).
 *
 * Stratégie :
 * 1. Chargement : Supabase → état React + localStorage (cache offline)
 * 2. Sauvegarde : Supabase + localStorage (debounce 800ms)
 * 3. Migration : 1ère connexion = données localStorage poussées vers Supabase
 * 4. Real-time : changements depuis d'autres appareils répliqués
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { donneesInitiales, migrerJournal } from '../donnees';

const STORAGE_MARKER = '__cyna_storage__';
const STORAGE_TABLE  = 'devis';

const LEGACY_STATUTS = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };

function chargerLocal(cle, defaut) {
  try { const r = localStorage.getItem(cle); return r ? JSON.parse(r) : defaut; } catch { return defaut; }
}
function sauvegarderLocal(cle, data) {
  try { localStorage.setItem(cle, JSON.stringify(data)); } catch {}
}

async function lireRowUser(userId) {
  const { data } = await supabase
    .from(STORAGE_TABLE)
    .select('id, data')
    .eq('user_id', userId)
    .eq('numero', STORAGE_MARKER)
    .maybeSingle();
  return data ?? null;
}

async function ecrireRowUser(userId, rowId, payload) {
  if (rowId) {
    const { error } = await supabase
      .from(STORAGE_TABLE)
      .update({ data: payload })
      .eq('id', rowId);
    if (error) throw error;
    return rowId;
  } else {
    const { data, error } = await supabase
      .from(STORAGE_TABLE)
      .insert({ user_id: userId, numero: STORAGE_MARKER, data: payload })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }
}

export default function useSupabaseData(userId) {
  const [chantiers,   setChantiersState]  = useState([]);
  const [devis,       setDevisState]      = useState([]);
  const [factures,    setFacturesState]   = useState([]);
  const [clients,     setClientsState]    = useState([]);
  const [parametres,  setParametresState] = useState(donneesInitiales);
  const [loading,     setLoading]         = useState(true);
  const [syncing,     setSyncing]         = useState(false);

  const rowIdRef    = useRef(null);
  const syncTimer   = useRef(null);
  const pendingRef  = useRef(null);
  const dataRef     = useRef({});

  function appliquerData(d) {
    const c = (d.chantiers || []).map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
    const dv = (d.devis || []).map(x => ({ ...x, statut: LEGACY_STATUTS[x.statut] || x.statut }));
    setChantiersState(c);
    setDevisState(dv);
    setFacturesState(d.factures || []);
    setClientsState(d.clients || []);
    setParametresState(d.parametres || donneesInitiales);
    dataRef.current = { chantiers: c, devis: dv, factures: d.factures || [], clients: d.clients || [], parametres: d.parametres || donneesInitiales };
  }

  // ── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function charger() {
      setLoading(true);
      try {
        const row = await lireRowUser(userId);
        if (cancelled) return;

        if (row && row.data && Object.keys(row.data).length > 0) {
          rowIdRef.current = row.id;
          appliquerData(row.data);
        } else {
          // Migration depuis localStorage
          const localData = {
            chantiers:  (chargerLocal('cyna_chantiers', donneesInitiales.chantiers)).map(c => ({ ...c, journal: migrerJournal(c.journal || []) })),
            devis:      (chargerLocal('cyna_devis', donneesInitiales.devis)).map(d => ({ ...d, statut: LEGACY_STATUTS[d.statut] || d.statut })),
            factures:   chargerLocal('cyna_factures', []),
            clients:    chargerLocal('cyna_clients', donneesInitiales.clients),
            parametres: chargerLocal('cyna_parametres', donneesInitiales),
          };
          if (!cancelled) appliquerData(localData);
          const id = await ecrireRowUser(userId, row?.id ?? null, localData);
          rowIdRef.current = id;
        }
      } catch (e) {
        console.warn('[Sync] Chargement Supabase échoué, fallback localStorage:', e.message);
        if (!cancelled) appliquerData({
          chantiers:  chargerLocal('cyna_chantiers', donneesInitiales.chantiers),
          devis:      chargerLocal('cyna_devis', donneesInitiales.devis),
          factures:   chargerLocal('cyna_factures', []),
          clients:    chargerLocal('cyna_clients', donneesInitiales.clients),
          parametres: chargerLocal('cyna_parametres', donneesInitiales),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    charger();

    // Re-sync quand l'app revient au premier plan (retour sur l'onglet / déverrouillage téléphone)
    async function resyncSiVisible() {
      if (document.visibilityState !== 'visible') return;
      try {
        const row = await lireRowUser(userId);
        if (row && row.data && Object.keys(row.data).length > 0) {
          rowIdRef.current = row.id;
          appliquerData(row.data);
        }
      } catch {}
    }
    document.addEventListener('visibilitychange', resyncSiVisible);

    // Real-time : écoute changements depuis d'autres appareils
    const channel = supabase
      .channel(`cyna_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: STORAGE_TABLE,
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new || payload.record;
        if (row?.numero === STORAGE_MARKER && row?.data) {
          appliquerData(row.data);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', resyncSiVisible);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Sauvegarde Supabase avec debounce 800ms ──────────────────────────────
  function scheduleSync(updates) {
    pendingRef.current = { ...(pendingRef.current || dataRef.current), ...updates };
    dataRef.current   = { ...dataRef.current, ...updates };
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      const payload = pendingRef.current;
      pendingRef.current = null;
      setSyncing(true);
      try {
        const id = await ecrireRowUser(userId, rowIdRef.current, payload);
        rowIdRef.current = id;
      } catch (e) {
        console.warn('[Sync Supabase]', e.message);
      } finally {
        setSyncing(false);
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
