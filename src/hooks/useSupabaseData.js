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
// Incrémenter quand les données démo changent — force le rechargement depuis donneesInitiales
const DEMO_VERSION   = 2;

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

  // Numéros de factures de test créées par les agents — supprimées une fois lors du chargement
  const FACTURES_TEST = new Set([
    'F-202605-001','F-202605-002','F-202605-003','F-202605-004','F-202605-005',
    'F-2026-005','F-2026-006','F-2026-007','F-2026-008',
    'F-2026-009','F-2026-010','F-2026-011','F-2026-012',
    'F-2026-017','F-2026-018',
  ]);

  function appliquerData(d) {
    const c = (d.chantiers || []).map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
    const dv = (d.devis || []).map(x => ({ ...x, statut: LEGACY_STATUTS[x.statut] || x.statut }));
    const facturesPropres = (d.factures || []).filter(f => !FACTURES_TEST.has(f.numero));
    const nettoyage = facturesPropres.length < (d.factures || []).length;

    const storedParams = d.parametres || {};
    // Détecter si les données stockées sont obsolètes (version antérieure à DEMO_VERSION)
    const outdated = (storedParams.demoVersion || 0) < DEMO_VERSION;

    // Auto-population : données vides ou version périmée → injecter donneesInitiales
    const params = outdated ? { ...donneesInitiales, demoVersion: DEMO_VERSION } : {
      ...donneesInitiales,
      ...storedParams,
      demoVersion:  DEMO_VERSION,
      employes:     (storedParams.employes?.length     > 0) ? storedParams.employes     : donneesInitiales.employes,
      typesTravaux: (storedParams.typesTravaux?.length  > 0) ? storedParams.typesTravaux : donneesInitiales.typesTravaux,
      localites:    (storedParams.localites?.length    > 0) ? storedParams.localites    : donneesInitiales.localites,
      zones:        (storedParams.zones?.length        > 0) ? storedParams.zones        : donneesInitiales.zones,
    };
    const chantiersFinaux = (!outdated && c.length > 0) ? c
      : donneesInitiales.chantiers.map(ch => ({ ...ch, journal: migrerJournal(ch.journal || []) }));
    const devisFinaux   = (!outdated && dv.length > 0) ? dv : donneesInitiales.devis;
    const clientsFinaux = (!outdated && (d.clients || []).length > 0) ? (d.clients || []) : donneesInitiales.clients;
    const facturesFinales = (!outdated && facturesPropres.length > 0) ? facturesPropres : (donneesInitiales.factures || []);

    setChantiersState(chantiersFinaux);
    setDevisState(devisFinaux);
    setFacturesState(facturesFinales);
    setClientsState(clientsFinaux);
    setParametresState(params);
    dataRef.current = { chantiers: chantiersFinaux, devis: devisFinaux, factures: facturesFinales, clients: clientsFinaux, parametres: params };

    // Resync vers Supabase si données vides, obsolètes ou factures test nettoyées
    const needsSync = nettoyage || outdated || c.length === 0 || dv.length === 0 || !storedParams.employes?.length;
    if (needsSync) scheduleSync({ chantiers: chantiersFinaux, devis: devisFinaux, factures: facturesFinales, clients: clientsFinaux, parametres: params });
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
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync] Chargement Supabase échoué, fallback localStorage:', e.message);
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
      // Si des données locales sont en attente de sync, ne pas écraser
      if (pendingRef.current) return;
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
    let channel = null;
    try {
      channel = supabase
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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            supabase.removeChannel(channel);
            channel = null;
          }
        });
    } catch {}

    return () => {
      cancelled = true;
      clearTimeout(syncTimer.current);
      document.removeEventListener('visibilitychange', resyncSiVisible);
      if (channel) supabase.removeChannel(channel);
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
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync Supabase]', e.message);
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
