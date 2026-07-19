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
const DEMO_VERSION   = 5;

const LEGACY_STATUTS = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };

// C2 — Le filtrage runtime de numéros de factures « de test » a été RETIRÉ : le format
// F-2026-NNN est aussi le format RÉEL de numérotation CYNA, donc ce filtre effaçait
// silencieusement de vraies factures (pièces comptables) à chaque chargement. Toute
// donnée de démo indésirable se corrige à la source (donnees-demo.js), jamais au runtime.

// Paramètres par défaut pour un nouveau compte réel : config BTP GE sans données démo.
// On conserve typesTravaux/localites/zones (config standard GE utile dès le 1er jour)
// mais employes = [] (l'utilisateur saisit ses propres employés).
const { chantiers: _dc, devis: _dd, clients: _dcl, factures: _df, employes: _de, ...PARAMETRES_DEFAUT_BASE } = donneesInitiales;
export const PARAMETRES_DEFAUT = { ...PARAMETRES_DEFAUT_BASE, employes: [], demoVersion: DEMO_VERSION };

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

/**
 * Résout les données à afficher depuis un blob Supabase.
 * Exportée pour les tests — fonction pure, aucun effet de bord.
 *
 * @param {object|null} rawBlob  — contenu du blob (d.data de Supabase), null si absent
 * @param {boolean}     isDemo   — true si session démo active
 */
export function resolveDataFromBlob(rawBlob, isDemo) {
  const d = rawBlob || {};
  const c = (d.chantiers || []).map(ch => ({ ...ch, journal: migrerJournal(ch.journal || []) }));
  const dv = (d.devis || []).map(x => ({ ...x, statut: LEGACY_STATUTS[x.statut] || x.statut }));
  const facturesBrutes = d.factures || [];
  const storedParams = d.parametres || {};
  const outdated = (storedParams.demoVersion || 0) < DEMO_VERSION;

  let chantiers, devis, factures, clients, parametres;

  if (isDemo) {
    // Mode démo : logique existante — recharger donneesInitiales si périmé ou vide
    chantiers = (!outdated && c.length > 0) ? c : donneesInitiales.chantiers.map(ch => ({ ...ch, journal: migrerJournal(ch.journal || []) }));
    devis     = (!outdated && dv.length > 0) ? dv : donneesInitiales.devis;
    clients   = (!outdated && (d.clients || []).length > 0) ? (d.clients || []) : donneesInitiales.clients;
    factures  = (!outdated && facturesBrutes.length > 0) ? facturesBrutes : (donneesInitiales.factures || []);
    parametres = outdated
      ? { ...donneesInitiales, demoVersion: DEMO_VERSION }
      : {
          ...donneesInitiales,
          ...storedParams,
          demoVersion:  DEMO_VERSION,
          employes:     storedParams.employes?.length     > 0 ? storedParams.employes     : donneesInitiales.employes,
          typesTravaux: storedParams.typesTravaux?.length  > 0 ? storedParams.typesTravaux : donneesInitiales.typesTravaux,
          localites:    storedParams.localites?.length    > 0 ? storedParams.localites    : donneesInitiales.localites,
          zones:        storedParams.zones?.length        > 0 ? storedParams.zones        : donneesInitiales.zones,
        };
  } else {
    // Vrai compte : JAMAIS de données démo, quelles que soient les conditions
    chantiers  = c;
    devis      = dv;
    factures   = facturesBrutes;
    clients    = d.clients || [];
    parametres = {
      ...PARAMETRES_DEFAUT,
      ...storedParams,
      demoVersion:  DEMO_VERSION,
      employes:     storedParams.employes?.length     > 0 ? storedParams.employes     : [],
      typesTravaux: storedParams.typesTravaux?.length  > 0 ? storedParams.typesTravaux : PARAMETRES_DEFAUT.typesTravaux,
      localites:    storedParams.localites?.length    > 0 ? storedParams.localites    : PARAMETRES_DEFAUT.localites,
      zones:        storedParams.zones?.length        > 0 ? storedParams.zones        : PARAMETRES_DEFAUT.zones,
    };
  }

  // needsSync uniquement pour la démo périmée/vide (plus aucun « nettoyage » runtime de factures)
  const needsSync = isDemo && (outdated || c.length === 0 || dv.length === 0 || !storedParams.employes?.length);

  return { chantiers, devis, factures, clients, parametres, pointages: d.pointages || [], needsSync };
}

// Données démo précalculées une seule fois (hors du composant — stable)
const _initChantiers = donneesInitiales.chantiers.map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
const _initDevis     = donneesInitiales.devis;
const _initFactures  = donneesInitiales.factures || [];
const _initClients   = donneesInitiales.clients;

export default function useSupabaseData(userId, isDemo = false) {
  // État initial : données démo en mode démo, vide pour un vrai compte.
  // AppInner est monté avec key={userId} → remonte si l'utilisateur change.
  const [chantiers,   setChantiersState]  = useState(() => isDemo ? _initChantiers : []);
  const [devis,       setDevisState]      = useState(() => isDemo ? _initDevis : []);
  const [factures,    setFacturesState]   = useState(() => isDemo ? _initFactures : []);
  const [clients,     setClientsState]    = useState(() => isDemo ? _initClients : []);
  const [parametres,  setParametresState] = useState(() => isDemo ? donneesInitiales : PARAMETRES_DEFAUT);
  const [pointages,   setPointagesState]  = useState([]);
  const [loading,     setLoading]         = useState(true);
  const [syncing,     setSyncing]         = useState(false);

  const rowIdRef    = useRef(null);
  const syncTimer   = useRef(null);
  const pendingRef  = useRef(null);
  const dataRef     = useRef({
    chantiers:  isDemo ? _initChantiers : [],
    devis:      isDemo ? _initDevis : [],
    factures:   isDemo ? _initFactures : [],
    clients:    isDemo ? _initClients : [],
    parametres: isDemo ? donneesInitiales : PARAMETRES_DEFAUT,
    pointages:  [],
  });
  const mountedRef  = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  function appliquerData(blobData) {
    const resolved = resolveDataFromBlob(blobData, isDemo);
    const { chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt, needsSync } = resolved;

    setChantiersState(ch);
    setDevisState(dv);
    setFacturesState(fa);
    setClientsState(cl);
    setParametresState(pa);
    setPointagesState(pt);
    dataRef.current = { chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt };

    if (needsSync) {
      sauvegarderLocal('cyna_chantiers',  ch);
      sauvegarderLocal('cyna_devis',      dv);
      sauvegarderLocal('cyna_factures',   fa);
      sauvegarderLocal('cyna_clients',    cl);
      sauvegarderLocal('cyna_parametres', pa);
      scheduleSync({ chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt });
    }
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
          // Blob absent : initialiser avec données correctes selon le mode
          const localData = isDemo
            ? {
                chantiers:  donneesInitiales.chantiers.map(c => ({ ...c, journal: migrerJournal(c.journal || []) })),
                devis:      donneesInitiales.devis,
                factures:   donneesInitiales.factures || [],
                clients:    donneesInitiales.clients,
                parametres: { ...donneesInitiales, demoVersion: DEMO_VERSION },
                pointages:  [],
              }
            : {
                chantiers: [], devis: [], factures: [], clients: [],
                parametres: PARAMETRES_DEFAUT,
                pointages:  [],
              };
          if (!cancelled) appliquerData(localData);
          const id = await ecrireRowUser(userId, row?.id ?? null, localData);
          if (!cancelled) rowIdRef.current = id;
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync] Chargement Supabase échoué, fallback:', e.message);
        // Fallback erreur : démo garde ses données, vrai compte reste vide
        if (!cancelled) appliquerData(isDemo
          ? {
              chantiers:  donneesInitiales.chantiers,
              devis:      donneesInitiales.devis,
              factures:   donneesInitiales.factures || [],
              clients:    donneesInitiales.clients,
              parametres: { ...donneesInitiales, demoVersion: DEMO_VERSION },
              pointages:  [],
            }
          : { chantiers: [], devis: [], factures: [], clients: [], parametres: PARAMETRES_DEFAUT, pointages: [] }
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    charger();

    // Re-sync quand l'app revient au premier plan (retour sur l'onglet / déverrouillage téléphone)
    async function resyncSiVisible() {
      if (document.visibilityState !== 'visible') return;
      if (cancelled) return;
      // Si des données locales sont en attente de sync, ne pas écraser
      if (pendingRef.current) return;
      try {
        const row = await lireRowUser(userId);
        if (cancelled) return;
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
      if (!mountedRef.current) return;
      const payload = pendingRef.current;
      pendingRef.current = null;
      setSyncing(true);
      try {
        const id = await ecrireRowUser(userId, rowIdRef.current, payload);
        if (mountedRef.current) rowIdRef.current = id;
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync Supabase]', e.message);
      } finally {
        if (mountedRef.current) setSyncing(false);
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

  const setPointages = useCallback((updater) => {
    setPointagesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      scheduleSync({ pointages: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    chantiers, setChantiers,
    devis, setDevis,
    factures, setFactures,
    clients, setClients,
    parametres, setParametres,
    pointages, setPointages,
    loading, syncing,
  };
}
