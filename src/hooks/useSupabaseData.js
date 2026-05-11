/**
 * CYNA — Sync données localStorage ↔ Supabase
 *
 * Utilise les 4 tables existantes : chantiers, devis, factures, clients
 * + clients stocke aussi les parametres dans un champ séparé
 *
 * Stratégie :
 * 1. Chargement : Supabase en priorité, localStorage en fallback (offline)
 * 2. Sauvegarde : Supabase + localStorage simultanément (debounce 800ms)
 * 3. Migration : si Supabase vide mais localStorage plein → migration auto
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { donneesInitiales, migrerJournal } from '../donnees';

const LEGACY_STATUTS = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };

function chargerLocal(cle, defaut) {
  try { const r = localStorage.getItem(cle); return r ? JSON.parse(r) : defaut; } catch { return defaut; }
}
function sauvegarderLocal(cle, data) {
  try { localStorage.setItem(cle, JSON.stringify(data)); } catch {}
}

// Charge ou crée UNE ligne par utilisateur dans une table
async function lireTable(table, userId) {
  const { data: rows } = await supabase
    .from(table)
    .select('id, data')
    .eq('user_id', userId)
    .limit(1);
  return rows?.[0] ?? null;
}

async function ecrireTable(table, userId, rowId, payload) {
  if (rowId) {
    await supabase.from(table).update({ data: payload }).eq('id', rowId);
    return rowId;
  } else {
    const { data } = await supabase
      .from(table)
      .insert({ user_id: userId, data: payload })
      .select('id')
      .single();
    return data?.id ?? null;
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

  // Supabase row IDs pour chaque table
  const rowIds = useRef({ chantiers: null, devis: null, factures: null, clients: null });

  // Debounce sync
  const syncTimer  = useRef(null);
  const pendingSync = useRef({});

  // ── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function charger() {
      setLoading(true);
      try {
        const [rowC, rowD, rowF, rowCl] = await Promise.all([
          lireTable('chantiers', userId),
          lireTable('devis',     userId),
          lireTable('factures',  userId),
          lireTable('clients',   userId),
        ]);

        if (cancelled) return;

        const supabaseVide = !rowC && !rowD && !rowF && !rowCl;

        if (!supabaseVide) {
          // Données cloud disponibles
          rowIds.current = {
            chantiers: rowC?.id ?? null,
            devis:     rowD?.id ?? null,
            factures:  rowF?.id ?? null,
            clients:   rowCl?.id ?? null,
          };
          setChantiersState((rowC?.data?.items || []).map(c => ({ ...c, journal: migrerJournal(c.journal || []) })));
          setDevisState((rowD?.data?.items || []).map(d => ({ ...d, statut: LEGACY_STATUTS[d.statut] || d.statut })));
          setFacturesState(rowF?.data?.items || []);
          setClientsState(rowCl?.data?.items || []);
          setParametresState(rowCl?.data?.parametres || donneesInitiales);
        } else {
          // Première connexion : migrer depuis localStorage
          const localC = (chargerLocal('cyna_chantiers', donneesInitiales.chantiers)).map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
          const localD = (chargerLocal('cyna_devis', donneesInitiales.devis)).map(d => ({ ...d, statut: LEGACY_STATUTS[d.statut] || d.statut }));
          const localF = chargerLocal('cyna_factures', []);
          const localCl = chargerLocal('cyna_clients', donneesInitiales.clients);
          const localP  = chargerLocal('cyna_parametres', donneesInitiales);

          if (!cancelled) {
            setChantiersState(localC);
            setDevisState(localD);
            setFacturesState(localF);
            setClientsState(localCl);
            setParametresState(localP);
          }

          // Uploader vers Supabase
          const [idC, idD, idF, idCl] = await Promise.all([
            ecrireTable('chantiers', userId, null, { items: localC }),
            ecrireTable('devis',     userId, null, { items: localD }),
            ecrireTable('factures',  userId, null, { items: localF }),
            ecrireTable('clients',   userId, null, { items: localCl, parametres: localP }),
          ]);
          rowIds.current = { chantiers: idC, devis: idD, factures: idF, clients: idCl };
        }
      } catch (e) {
        // Offline → localStorage uniquement
        if (!cancelled) {
          setChantiersState((chargerLocal('cyna_chantiers', donneesInitiales.chantiers)).map(c => ({ ...c, journal: migrerJournal(c.journal || []) })));
          setDevisState((chargerLocal('cyna_devis', donneesInitiales.devis)).map(d => ({ ...d, statut: LEGACY_STATUTS[d.statut] || d.statut })));
          setFacturesState(chargerLocal('cyna_factures', []));
          setClientsState(chargerLocal('cyna_clients', donneesInitiales.clients));
          setParametresState(chargerLocal('cyna_parametres', donneesInitiales));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    charger();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Sync Supabase avec debounce ──────────────────────────────────────────
  function scheduleSync(updates) {
    pendingSync.current = { ...pendingSync.current, ...updates };
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      const p = pendingSync.current;
      pendingSync.current = {};
      setSyncing(true);
      try {
        const saves = [];
        if (p.chantiers !== undefined) saves.push(
          ecrireTable('chantiers', userId, rowIds.current.chantiers, { items: p.chantiers })
            .then(id => { rowIds.current.chantiers = id; })
        );
        if (p.devis !== undefined) saves.push(
          ecrireTable('devis', userId, rowIds.current.devis, { items: p.devis })
            .then(id => { rowIds.current.devis = id; })
        );
        if (p.factures !== undefined) saves.push(
          ecrireTable('factures', userId, rowIds.current.factures, { items: p.factures })
            .then(id => { rowIds.current.factures = id; })
        );
        if (p.clients !== undefined || p.parametres !== undefined) {
          const clItems = p.clients ?? null;
          const params  = p.parametres ?? null;
          saves.push(
            lireTable('clients', userId).then(row => {
              const existing = row?.data || {};
              return ecrireTable('clients', userId, rowIds.current.clients, {
                items:      clItems  ?? existing.items      ?? [],
                parametres: params   ?? existing.parametres ?? donneesInitiales,
              }).then(id => { rowIds.current.clients = id; });
            })
          );
        }
        await Promise.all(saves);
      } catch (e) {
        console.warn('[Sync Supabase]', e.message);
      } finally {
        setSyncing(false);
      }
    }, 800);
  }

  // ── Setters ──────────────────────────────────────────────────────────────
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
