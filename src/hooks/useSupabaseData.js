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
import { donneesInitiales, migrerJournal, migrerStatutsC8, normaliserTarifsEmployes } from '../donnees';

const STORAGE_MARKER = '__cyna_storage__';
const STORAGE_TABLE  = 'devis';
// Lot 4 — coffre partagé au niveau organisation (clé = org_id, une ligne par org).
const ORG_TABLE      = 'org_storage';
// Incrémenter quand les données démo changent — force le rechargement depuis donneesInitiales
const DEMO_VERSION   = 5;

const LEGACY_STATUTS = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };

// C2 — Le filtrage runtime de numéros de factures « de test » a été RETIRÉ : le format
// F-2026-NNN est aussi le format RÉEL de numérotation CYNA, donc ce filtre effaçait
// silencieusement de vraies factures (pièces comptables) à chaque chargement. Toute
// donnée de démo indésirable se corrige à la source (donnees-demo.js), jamais au runtime.

// Paramètres par défaut pour un nouveau compte réel : config BTP GE sans données démo.
// On conserve typesTravaux (config standard GE utile dès le 1er jour)
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

// ════════════════════════════════════════════════════════════════════════════
// LOT 4a — Bascule vers le coffre organisation (org_storage). LECTURE SEULE.
// Défaut 'user' → comportement historique STRICTEMENT inchangé. Aucune écriture
// n'est émise en mode 'org' à ce stade (l'écriture arrive au Lot 4b).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Mode de stockage effectif. Fonction PURE (exportée pour tests).
 *   - démo → toujours 'user' (pas d'org, pas de vrai JWT).
 *   - sinon : override localStorage['cyna_storage_mode'] prime sur l'env, défaut 'user'.
 * @returns {'user'|'org'}
 */
export function resolveMode(isDemo) {
  if (isDemo) return 'user';
  try {
    const override = localStorage.getItem('cyna_storage_mode');
    if (override === 'user' || override === 'org') return override;
  } catch { /* localStorage indisponible → on retombe sur l'env/défaut */ }
  return process.env.REACT_APP_STORAGE_MODE === 'org' ? 'org' : 'user';
}

/**
 * Décide quoi faire d'une ligne org_storage lue. Fonction PURE (exportée pour tests).
 * NE renvoie JAMAIS « creer » : la création du blob vient du seed (Lot 3), pas du client.
 *   - 'utiliser'           : la ligne existe et son data n'est pas vide → charger tel quel.
 *   - 'vide-sans-ecriture' : ligne absente ou data vide → état vide sûr, AUCUNE écriture.
 * @returns {'utiliser'|'vide-sans-ecriture'}
 */
export function deciderChargementOrg(rowOrg) {
  const d = rowOrg && rowOrg.data;
  if (d && typeof d === 'object' && Object.keys(d).length > 0) return 'utiliser';
  return 'vide-sans-ecriture';
}

/**
 * org_id du user courant (CYNA = 1 org → première ligne). Ne throw jamais : renvoie null
 * en cas d'erreur/absence (→ le boot appliquera un état vide sûr, sans écriture).
 */
async function getMonOrgId(userId) {
  try {
    const { data, error } = await supabase
      .from('membres')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0].org_id ?? null;
  } catch {
    return null;
  }
}

/** Lit la ligne de coffre d'une org (SELECT data FROM org_storage WHERE org_id). */
async function lireRowOrg(orgId) {
  const { data } = await supabase
    .from(ORG_TABLE)
    .select('data')
    .eq('org_id', orgId)
    .maybeSingle();
  return data ?? null;
}

/**
 * VERROU 2 (anti-effacement) — fonction PURE (exportée pour tests).
 * TRUE si le blob à écrire est « vide » : les 5 listes métier (chantiers, devis,
 * factures, pointages, clients) sont toutes absentes ou de longueur 0.
 * (parametres, objet toujours présent, n'entre pas dans le test.)
 */
export function estPayloadVide(payload) {
  if (!payload || typeof payload !== 'object') return true;
  return ['chantiers', 'devis', 'factures', 'pointages', 'clients']
    .every(k => !Array.isArray(payload[k]) || payload[k].length === 0);
}

/**
 * VERROU 3 — Écriture dans le coffre org : UPSERT par org_id (jamais un insert
 * aveugle qui doublerait). Met à jour data + updated_at + updated_by (le user courant).
 */
async function ecrireRowOrg(orgId, payload, userId) {
  const { error } = await supabase
    .from(ORG_TABLE)
    .upsert(
      { org_id: orgId, data: payload, updated_at: new Date().toISOString(), updated_by: userId ?? null },
      { onConflict: 'org_id' }
    );
  if (error) throw error;
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
    };
  }

  // Migration C8 : un chantier marqué clos avec des factures pas toutes payées
  // est requalifié « Attente paiement » (fini = encaissé). Idempotente.
  chantiers = migrerStatutsC8(chantiers, factures);

  // Migration douce E3 : tarif employé horaire (tarifHeure) dérivé du journalier
  // legacy si absent — idempotent, tarifJour existant conservé → zéro coût modifié.
  parametres = { ...parametres, employes: normaliserTarifsEmployes(parametres.employes) };

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
  // Lot 4a — mode figé au montage (AppInner remonte via key={userId} si le user change).
  const modeRef     = useRef(resolveMode(isDemo));
  const orgIdRef    = useRef(null);   // org_id du user courant en mode 'org' (sinon null)
  const orgChargeeRef = useRef(false); // true seulement si une ligne org non vide a été chargée
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
        // ── Lot 4a — MODE ORG : lecture seule du coffre org_storage, AUCUNE écriture ──
        if (modeRef.current === 'org') {
          const orgId = await getMonOrgId(userId);
          if (cancelled) return;
          orgIdRef.current = orgId;
          if (!orgId) {
            // D2 : user sans org → état vide sûr, lecture seule, aucune création.
            appliquerData({});
            orgChargeeRef.current = false;
            if (process.env.NODE_ENV !== 'production') console.warn('[Sync org] Aucune org pour ce user — état vide, aucune écriture.');
            return;
          }
          const rowOrg = await lireRowOrg(orgId);
          if (cancelled) return;
          const decision = deciderChargementOrg(rowOrg);
          if (decision === 'utiliser') {
            appliquerData(rowOrg.data);
            orgChargeeRef.current = true;
          } else {
            // 'vide-sans-ecriture' : le blob doit venir du seed (Lot 3). On n'écrit RIEN.
            appliquerData({});
            orgChargeeRef.current = false;
            if (process.env.NODE_ENV !== 'production') console.warn('[Sync org] org_storage vide — état vide, aucune écriture (seed attendu au Lot 3).');
          }
          // ── Lot 4c — TEMPS RÉEL ORG : les membres voient les changements des autres ──
          // Abonné une fois l'orgId connu (même si le coffre est encore vide : on recevra le seed).
          // L'event applique la data à l'état (LECTURE-ONLY) → jamais de ré-écriture, aucune boucle.
          if (!cancelled) {
            try {
              channel = supabase
                .channel(`cyna_org_${orgId}`)
                .on('postgres_changes', {
                  event: '*', schema: 'public', table: ORG_TABLE,
                  filter: `org_id=eq.${orgId}`,
                }, (payload) => {
                  const rowRT = payload.new || payload.record;
                  if (!rowRT || !rowRT.data) return;
                  // ANTI-ECHO : ignorer ma propre écriture (updated_by = moi) et ne pas écraser
                  // une édition locale en attente de sync.
                  if (rowRT.updated_by === userId) return;
                  if (pendingRef.current) return;
                  appliquerData(rowRT.data);
                  orgChargeeRef.current = true; // une ligne org non vide distante est arrivée
                })
                .subscribe((status) => {
                  if (status === 'CHANNEL_ERROR' && channel) {
                    supabase.removeChannel(channel);
                    channel = null;
                  }
                });
            } catch { /* temps réel indisponible → l'app reste fonctionnelle (resync à la visibilité) */ }
          }
          return;
        }

        // ── MODE USER (défaut) — comportement historique strictement inchangé ──
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

    // Canal temps réel (mode user OU org selon la branche empruntée par charger()).
    let channel = null;
    charger();

    // Re-sync quand l'app revient au premier plan (retour sur l'onglet / déverrouillage téléphone)
    async function resyncSiVisible() {
      if (document.visibilityState !== 'visible') return;
      if (cancelled) return;
      // Si des données locales sont en attente de sync, ne pas écraser
      if (pendingRef.current) return;
      // ── Lot 4c — MODE ORG : relire la ligne org (lecture-only), aucune écriture ──
      if (modeRef.current === 'org') {
        const orgId = orgIdRef.current;
        if (!orgId) return;
        try {
          const rowOrg = await lireRowOrg(orgId);
          if (cancelled) return;
          if (deciderChargementOrg(rowOrg) === 'utiliser') {
            appliquerData(rowOrg.data);
            orgChargeeRef.current = true;
          }
        } catch {}
        return;
      }
      // ── MODE USER (défaut) — inchangé ──
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

    // Real-time MODE USER : écoute changements depuis d'autres appareils (le canal ORG,
    // filtre org_id, est monté dans charger() une fois l'orgId connu — Lot 4c).
    try {
      if (modeRef.current === 'user') channel = supabase
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
    // ── Lot 4b — MODE ORG : écriture SÛRE dans org_storage, protégée par 3 verrous ──
    if (modeRef.current === 'org') {
      // VERROU 1 — jamais d'écriture tant qu'on n'a pas chargé une ligne org NON vide
      // (orgChargee=false = pas d'org, ou coffre vide au boot → on n'amorce/n'écrase JAMAIS côté client).
      if (!orgIdRef.current || !orgChargeeRef.current) {
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync org] écriture ignorée — coffre org non chargé (verrou 1).');
        return;
      }
      const payloadOrg = { ...(pendingRef.current || dataRef.current), ...updates };
      // VERROU 2 — jamais un blob « vide » sur un coffre qui contenait des données (anti-effacement).
      if (estPayloadVide(payloadOrg)) {
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync org] écriture ignorée — payload vide sur coffre non vide (verrou 2, anti-effacement).');
        return;
      }
      pendingRef.current = payloadOrg;
      dataRef.current    = payloadOrg;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        const p = pendingRef.current;
        pendingRef.current = null;
        setSyncing(true);
        try {
          // VERROU 3 — UPSERT by org_id (jamais un insert aveugle).
          await ecrireRowOrg(orgIdRef.current, p, userId);
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('[Sync org]', e.message);
        } finally {
          if (mountedRef.current) setSyncing(false);
        }
      }, 800);
      return;
    }

    // ── MODE USER (défaut) — comportement historique strictement inchangé ──
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
