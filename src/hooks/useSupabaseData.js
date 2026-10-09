import { CLES_REPRISE, lireValeurLocale, planifierReprise, lireMarqueur, marquerReprise, copierReprise, canonique, empreinte } from '../utils/repriseLocale';
import { avecCompteurs } from '../utils/numerotation';
import { fusionnerIdsSupprimes, donneesImportees } from '../utils/corbeille';
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
import { suspendreRetention, enregistrerCopieRejetee, nouvelIdCopie, PREFIXE_ECHEC, lireCopieEchec, ecrireCopieEchec } from '../utils/copiesRejetees';
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
  try { localStorage.setItem(cle, JSON.stringify(data)); return true; } catch { return false; }
}

const MESSAGE_CONFLIT = "Quelqu'un a enregistré entre-temps. Vos dernières modifications n'ont pas été enregistrées ; les données à jour ont été rechargées.";
const MESSAGE_COPIE_OK = ' Une copie de vos modifications non enregistrées est conservée sur cet appareil.';
const MESSAGE_COPIE_KO = " La copie locale de vos modifications n'a pas pu être conservée (stockage de l'appareil plein).";

export class ConflitVersionError extends Error {}
async function lireRowUser(userId) {
  const { data, error } = await supabase.from(STORAGE_TABLE)
    .select('id, data, version').eq('user_id', userId)
    .eq('numero', STORAGE_MARKER).maybeSingle();
  if (error) throw error;
  return data ?? null;
}
async function ecrireRowUser(userId, rowId, payload, version) {
  if (rowId) {
    const { data, error } = await supabase.from(STORAGE_TABLE)
      .update({ data: payload, version: version + 1 })
      .eq('id', rowId).eq('version', version).select('id, version');
    if (error?.code === 'P0409') throw new ConflitVersionError();
    if (error) throw error;
    if (!data?.length) throw new ConflitVersionError();
    return data[0];
  }
  const { data, error } = await supabase.from(STORAGE_TABLE)
    .insert({ user_id: userId, numero: STORAGE_MARKER, data: payload })
    .select('id, version').single();
  if (error?.code === '23505') throw new ConflitVersionError();
  if (error) throw error;
  return data;
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

  return { chantiers, devis, factures, clients, parametres, pointages: d.pointages || [], objectifs: d.objectifs, evenementsCalendrier: d.evenementsCalendrier, memoireIA: d.memoireIA, needsSync };
}

// Données démo précalculées une seule fois (hors du composant — stable)
const _initChantiers = donneesInitiales.chantiers.map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
const _initDevis     = donneesInitiales.devis;
const _initFactures  = donneesInitiales.factures || [];
const _initClients   = donneesInitiales.clients;

// CORB-03 — clés mises en cache dans localStorage par les opérations composées (corbeille,
// import) : les mêmes que les setters individuels. Les pointages n'y sont JAMAIS recopiés
// (historique d'heures potentiellement volumineux, jamais relu) : la place reste disponible
// pour les copies de secours.
const CLES_CACHE_LOCAL = ['chantiers', 'devis', 'factures', 'clients', 'parametres'];

// CORB-02 — LIMITE CONNUE DU MODE ORG (le mode 'user', utilisé en production, n'est pas concerné) :
// en mode org, l'écriture est un upsert « dernier qui écrit gagne », sans contrôle de version, et
// le chargement distant n'applique pas idsSupprimes. Un appareil qui n'a pas encore reçu une mise
// à la corbeille ou une suppression définitive peut donc renvoyer l'élément et le faire
// réapparaître. La garantie « aucune réapparition » de la corbeille ne vaut qu'en mode user.
// À traiter avant toute activation du mode org en production.
export default function useSupabaseData(userId, isDemo = false) {
  // État initial : données démo en mode démo, vide pour un vrai compte.
  // AppInner est monté avec key={userId} → remonte si l'utilisateur change.
  const [donnees, setDonneesState] = useState(() => ({
    chantiers: isDemo ? _initChantiers : [], devis: isDemo ? _initDevis : [],
    factures: isDemo ? _initFactures : [], clients: isDemo ? _initClients : [],
    parametres: isDemo ? donneesInitiales : PARAMETRES_DEFAUT, pointages: [], objectifs: undefined, evenementsCalendrier: undefined, memoireIA: undefined,
  }));
  const { chantiers, devis, factures, clients, parametres, pointages, objectifs, evenementsCalendrier, memoireIA } = donnees;
  const setterEtat = cle => updater => setDonneesState(prev => {
    const next = typeof updater === 'function' ? updater(prev[cle], prev.parametres) : updater;
    if (Object.is(next, prev[cle])) return prev;
    const suivant = avecCompteurs(prev, { ...prev, [cle]: next });
    if (suivant.parametres !== (cle === 'parametres' ? next : prev.parametres)) {
      sauvegarderLocal('cyna_parametres', suivant.parametres);
      scheduleSync({ parametres: suivant.parametres });
    }
    return suivant;
  });
  const setChantiersState = setterEtat('chantiers');
  const setDevisState = setterEtat('devis');
  const setFacturesState = setterEtat('factures');
  const setClientsState = setterEtat('clients');
  const setParametresState = setterEtat('parametres');
  const setPointagesState = setterEtat('pointages');
  const setObjectifsState = setterEtat('objectifs');
  const setEvenementsCalendrierState = setterEtat('evenementsCalendrier');
  const setMemoireIAState = setterEtat('memoireIA');
  const [repriseLocale, setRepriseLocale] = useState(null);
  const reprisePrepareeRef = useRef(false);
  const decisionRepriseRef = useRef(false);
  const [loading,     setLoading]         = useState(true);
  const [syncing,     setSyncing]         = useState(false);

  const [etatSync, setEtatSync] = useState({ erreurChargement: null, statut: 'ok', message: null });
  const erreurChargementRef = useRef(etatSync.erreurChargement);
  erreurChargementRef.current = etatSync.erreurChargement;
  const ecrituresBloqueesRef = useRef(false);
  const ecrituresRefuseesRef = useRef(0);
  const conflitsRef = useRef(0);
  const importEnCoursRef = useRef(false);
  const importEcritureRef = useRef(null);
  const confirmationEcritureRef = useRef(null);
  const ecrituresOrgEnVolRef = useRef(0);
  // Le plan impose une identite de callback liee au compte (AppInner remonte par userId).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bloquerEcritures = useCallback(() => { ecrituresBloqueesRef.current = true; }, [userId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debloquerEcritures = useCallback(() => { ecrituresBloqueesRef.current = false; ecrituresRefuseesRef.current = 0; }, [userId]);
  function ecritureRefusee() {
    if (!mountedRef.current) return true;
    if (ecrituresBloqueesRef.current) { ecrituresRefuseesRef.current += 1; return true; }
    return false;
  }
  const episodeRef = useRef(null);
  const copiesEpisodeRef = useRef(new Set());
  const copieEpisodeOkRef = useRef(true);
  const rangementOkRef = useRef(true);
  const versionRef = useRef(0);
  const chargementOkRef = useRef(false);
  const enVolRef = useRef(null);
  const generationRef = useRef(0);
  const recuperationRef = useRef(false);
  const recuperationGenRef = useRef(0);
  const rejetRef = useRef(null);
  const rejetIdRef = useRef(null);
  const copieRejetOkRef = useRef(true);
  // F1 — modifications locales demandées mais dont l'updater React n'a pas encore tourné
  // (React peut différer un updater jusqu'au rendu suivant). Marquées SYNCHRONEMENT dans
  // chaque setter : tant que l'ensemble n'est pas vide, aucune donnée distante n'est appliquée.
  const attentesLocalesRef = useRef(new Set());
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
    pointages:  [], objectifs: undefined, evenementsCalendrier: undefined, memoireIA: undefined,
  });
  const mountedRef  = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; if (importEnCoursRef.current) { importEnCoursRef.current = false; importEcritureRef.current = null; suspendreRetention(false); } }; }, []);

  function messageEchec() {
    return "Non enregistré. Ne fermez pas l'application tant que ce n'est pas enregistré. "
      + (copieEpisodeOkRef.current ? 'Une copie de secours est conservée sur cet appareil.' : "Une copie de secours n'a pas pu être conservée sur cet appareil (stockage plein).")
      + (rangementOkRef.current ? '' : " La copie n'a pas pu être mise à jour ; la copie précédente est conservée.");
  }
  function conserverEpisode() {
    if (!episodeRef.current) {
      // REV-01 — chaque épisode a SA clé unique et ne touche QU'À ses propres clés
      // (copiesEpisodeRef). Les copies d'un autre onglet ou d'une session précédente ne sont
      // jamais rangées, réécrites ni supprimées automatiquement : elles sont seulement signalées.
      episodeRef.current = PREFIXE_ECHEC + userId + '_' + nouvelIdCopie();
      copiesEpisodeRef.current = new Set([episodeRef.current]);
      rangementOkRef.current = true; // F2 — drapeau propre à CET épisode
    }
    const contenu = { ...dataRef.current, ...(pendingRef.current || {}), source: 'echec-sauvegarde', date: new Date().toISOString() };
    copieEpisodeOkRef.current = ecrireCopieEchec(episodeRef.current, contenu);
    if (!copieEpisodeOkRef.current && lireCopieEchec(episodeRef.current)) {
      rangementOkRef.current = false;
      const cle = PREFIXE_ECHEC + userId + '_' + nouvelIdCopie();
      copieEpisodeOkRef.current = ecrireCopieEchec(cle, contenu);
      if (copieEpisodeOkRef.current) { episodeRef.current = cle; copiesEpisodeRef.current.add(cle); }
    }
    setEtatSync(prev => ({ ...prev, statut: 'echec', message: messageEchec() }));
  }
  // Installer pendant une écriture à résoudre et retirer après le succès complet.
  useEffect(() => {
    if (modeRef.current !== 'user') return;
    if (!pendingRef.current && !enVolRef.current && !episodeRef.current && !attentesLocalesRef.current.size) return;
    const fermer = event => {
      if (!pendingRef.current && !enVolRef.current && !episodeRef.current && !attentesLocalesRef.current.size) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', fermer);
    return () => window.removeEventListener('beforeunload', fermer);
  });

  function appliquerData(blobData) {
    const resolved = resolveDataFromBlob(blobData, isDemo);
    const { chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt, objectifs: ob, evenementsCalendrier: ec, memoireIA: mi, needsSync } = resolved;

    setDonneesState({ chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt, objectifs: ob, evenementsCalendrier: ec, memoireIA: mi });
    dataRef.current = { chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt, objectifs: ob, evenementsCalendrier: ec, memoireIA: mi };

    if (needsSync && !ecrituresBloqueesRef.current) {
      sauvegarderLocal('cyna_chantiers',  ch);
      sauvegarderLocal('cyna_devis',      dv);
      sauvegarderLocal('cyna_factures',   fa);
      sauvegarderLocal('cyna_clients',    cl);
      sauvegarderLocal('cyna_parametres', pa);
      scheduleSync({ chantiers: ch, devis: dv, factures: fa, clients: cl, parametres: pa, pointages: pt, objectifs: ob, evenementsCalendrier: ec, memoireIA: mi });
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

        await chargerUser(() => cancelled);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[Sync] Chargement Supabase échoué, fallback:', e.message);
        if (modeRef.current === 'org' && !cancelled) appliquerData({});
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
      if (!chargementOkRef.current || !aucuneModificationLocale()) return;
      const generation = generationRef.current;
      try {
        const row = await lireRowUser(userId);
        if (cancelled || !aucuneModificationLocale() || generation !== generationRef.current) return;
        appliquerOpportuniste(row);
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
          if (row?.numero === STORAGE_MARKER && chargementOkRef.current && aucuneModificationLocale()) appliquerOpportuniste(row);
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
    updates = Object.fromEntries(Object.entries(updates).filter(([cle, valeur]) => {
      if (typeof valeur !== 'function') return true;
      if (process.env.NODE_ENV !== 'production') console.warn('[Sync] updater non résolu ignoré:', cle);
      return false;
    }));
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
        syncTimer.current = null;
        const p = pendingRef.current;
        pendingRef.current = null;
        setSyncing(true);
        ecrituresOrgEnVolRef.current += 1;
        try {
          // VERROU 3 — UPSERT by org_id (jamais un insert aveugle).
          await ecrireRowOrg(orgIdRef.current, p, userId);
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('[Sync org]', e.message);
        } finally {
          ecrituresOrgEnVolRef.current -= 1;
          if (mountedRef.current) setSyncing(false);
        }
      }, 800);
      return;
    }

    generationRef.current += 1;
    if (recuperationRef.current) { conserverRejet(updates); return; }
    if (!chargementOkRef.current) return;
    pendingRef.current = { ...(pendingRef.current || dataRef.current), ...updates };
    dataRef.current = { ...dataRef.current, ...updates };
    if (episodeRef.current) conserverEpisode();
    clearTimeout(syncTimer.current);
    const generation = recuperationGenRef.current;
    syncTimer.current = setTimeout(() => flush(generation), 800);
  }

  function aucuneModificationLocale() {
    return !pendingRef.current && !enVolRef.current && !recuperationRef.current
      && attentesLocalesRef.current.size === 0;
  }
  function marquerModificationLocale() {
    const jeton = {};
    attentesLocalesRef.current.add(jeton);
    generationRef.current += 1;
    return jeton;
  }
  function messageConflit() {
    return MESSAGE_CONFLIT + (copieRejetOkRef.current ? MESSAGE_COPIE_OK : MESSAGE_COPIE_KO) + (rangementOkRef.current ? "" : " La copie n'a pas pu être mise à jour ; la copie précédente est conservée.");
  }
  // F3 / REV-02 / REV-03 — copie de secours locale du conflit en cours (src/utils/copiesRejetees.js).
  // « Copie conservée » n'est annoncé que si la copie de CE conflit a réellement été écrite.
  function conserverRejet(updates) {
    rejetRef.current = { ...(rejetRef.current || {}), ...updates };
    copieRejetOkRef.current = enregistrerCopieRejetee(rejetIdRef.current, rejetRef.current, { sansRetention: importEnCoursRef.current });
  }
  function appliquerOpportuniste(row) {
    if (!row?.data || !(Number(row.version) > versionRef.current)) return;
    rowIdRef.current = row.id;
    versionRef.current = Number(row.version) || 0;
    appliquerData(row.data);
  }
  async function chargerUser(estAnnule = () => !mountedRef.current, verifierGeneration = false) {
    const generation = generationRef.current;
    const finDeRecuperation = recuperationRef.current;
    try {
      const row = await lireRowUser(userId);
      if (estAnnule() || (verifierGeneration && generation !== generationRef.current)) return;
      rowIdRef.current = row?.id ?? null;
      versionRef.current = Number(row?.version) || 0;
      chargementOkRef.current = true;
      if (row?.data && Object.keys(row.data).length) appliquerData(row.data);
      else {
        appliquerData({});
        pendingRef.current = dataRef.current;
        clearTimeout(syncTimer.current);
        recuperationRef.current = false;
        flush(recuperationGenRef.current);
      }
      recuperationRef.current = false;
      preparerRepriseLocale();
      // F2 — un « Réessayer » qui termine une récupération de conflit annonce le conflit.
      if (finDeRecuperation) { importEnCoursRef.current = false; suspendreRetention(false); importEcritureRef.current = null; }
      if (finDeRecuperation) setEtatSync({ erreurChargement: null, statut: 'conflit', message: messageConflit() });
      else setEtatSync(prev => {
        const ancienne = Object.keys(localStorage).some(cle => cle.startsWith(PREFIXE_ECHEC + userId) && !copiesEpisodeRef.current.has(cle) && lireCopieEchec(cle));
        const messageAncienne = "Des modifications non enregistrées d'une session précédente ou d'un autre onglet sont conservées sur cet appareil";
        // INS2-03 — un avis déjà affiché (ex. copie de reprise impossible, stockage plein) n'est pas écrasé : les deux sont gardés.
        const avisPrecedent = prev.statut === 'information' && prev.message && prev.message !== messageAncienne ? prev.message + ' ' : '';
        return ancienne && !episodeRef.current
          ? { erreurChargement: null, statut: 'information', message: avisPrecedent + messageAncienne }
          : { ...prev, erreurChargement: null };
      });
    } catch {
      if (estAnnule()) return;
      chargementOkRef.current = false;
      setEtatSync(prev => ({ ...prev, erreurChargement: 'Impossible de charger vos données. Réessayez ou déconnectez-vous.' }));
    }
  }
  async function flush(generation = recuperationGenRef.current) {
    // Plusieurs timers peuvent attendre la même écriture : revérifier à chaque réveil.
    while (enVolRef.current) await enVolRef.current;
    if (!mountedRef.current || !chargementOkRef.current || recuperationRef.current || generation !== recuperationGenRef.current || !pendingRef.current) return;
    const payload = pendingRef.current;
    const generationEcriture = generationRef.current;
    let reussie = false;
    pendingRef.current = null;
    setSyncing(true);
    const travail = Promise.resolve().then(async () => {
      try {
        const row = await ecrireRowUser(userId, rowIdRef.current, payload, versionRef.current);
        if (!mountedRef.current) return;
        rowIdRef.current = row.id;
        versionRef.current = Number(row.version) || 0;
        reussie = true;
        if (confirmationEcritureRef.current && generationEcriture >= confirmationEcritureRef.current.generation) {
          confirmationEcritureRef.current.ok = true;
        }
        if (importEcritureRef.current && generationEcriture >= importEcritureRef.current.generation) {
          importEcritureRef.current.ok = true;
          importEnCoursRef.current = false; suspendreRetention(false);
        }
        if (!episodeRef.current) setEtatSync(prev => (prev.statut === 'information' ? prev : { erreurChargement: null, statut: 'ok', message: null }));
      } catch (e) {
        if (!mountedRef.current) return;
        if (e instanceof ConflitVersionError) {
          conflitsRef.current += 1;
          recuperationRef.current = true;
          recuperationGenRef.current += 1;
          clearTimeout(syncTimer.current);
          rejetRef.current = null;
          rejetIdRef.current = nouvelIdCopie();
          rangementOkRef.current = true; // F2 — drapeau propre à CE conflit
          conserverRejet({ ...payload, ...(pendingRef.current || {}) });
          if (episodeRef.current) {
            if (copieRejetOkRef.current) {
              try { copiesEpisodeRef.current.forEach(cle => localStorage.removeItem(cle)); } catch { rangementOkRef.current = false; }
            } else rangementOkRef.current = false;
            // F1 — l'épisode est TOUJOURS détaché après un conflit : la donnée locale va être
            // remplacée par celle du serveur, donc la copie d'épisode ne doit plus jamais être
            // réécrite ni supprimée par cet épisode. Si le transfert a échoué, elle reste en place
            // (sa clé est conservée) et sera signalée au prochain démarrage (REV-01).
            copiesEpisodeRef.current.clear(); episodeRef.current = null;
          }
          pendingRef.current = null;
          setEtatSync({ erreurChargement: null, statut: 'conflit', message: 'Rechargement des données à jour…' });
          try {
            const row = await lireRowUser(userId);
            if (!mountedRef.current) return;
            if (!row?.data) throw new Error('Ligne de stockage absente');
            rowIdRef.current = row.id;
            versionRef.current = Number(row.version) || 0;
            appliquerData(row.data);
            recuperationRef.current = false;
            importEnCoursRef.current = false; suspendreRetention(false);
            importEcritureRef.current = null;
            setEtatSync({ erreurChargement: null, statut: 'conflit', message: messageConflit() });
          } catch {
            chargementOkRef.current = false;
            setEtatSync(prev => ({ ...prev, erreurChargement: "Impossible de recharger les données à jour. Vos dernières modifications n'ont pas été enregistrées" + (copieRejetOkRef.current ? ' (une copie est conservée sur cet appareil)' : '') + '. Réessayez.' }));
          }
        } else {
          pendingRef.current = { ...payload, ...(pendingRef.current || {}) };
          clearTimeout(syncTimer.current);
          conserverEpisode();
        }
      }
    });
    enVolRef.current = travail;
    await travail;
    if (enVolRef.current === travail) enVolRef.current = null;
    if (reussie && episodeRef.current && !recuperationRef.current && chargementOkRef.current) {
      if (!pendingRef.current && !enVolRef.current && attentesLocalesRef.current.size === 0) {
        try { copiesEpisodeRef.current.forEach(cle => localStorage.removeItem(cle)); } catch {}
        copiesEpisodeRef.current.clear(); episodeRef.current = null;
        rangementOkRef.current = true; // F2
        setEtatSync({ erreurChargement: null, statut: 'ok', message: null });
      } else conserverEpisode();
    }
    if (mountedRef.current) setSyncing(false);
  }

  // ── Setters (état + localStorage + Supabase) ─────────────────────────────
  const terminerSauvegardes = useCallback(async () => {
    bloquerEcritures();
    const conflitsAvant = conflitsRef.current;
    if (modeRef.current === 'org') {
      return !pendingRef.current && !syncTimer.current && !ecrituresOrgEnVolRef.current && !ecrituresRefuseesRef.current;
    }
    clearTimeout(syncTimer.current);
    syncTimer.current = null;
    await flush();
    const vide = !pendingRef.current && !enVolRef.current && !episodeRef.current
      && !attentesLocalesRef.current.size && !recuperationRef.current;
    return vide && (chargementOkRef.current || !!erreurChargementRef.current)
      && conflitsRef.current === conflitsAvant && ecrituresRefuseesRef.current === 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setChantiers = useCallback((updater) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setChantiersState((prev, parametresActuels) => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof updater === 'function' ? updater(prev, parametresActuels) : updater;
      // REV-01 — rien n'a changé (ex. régénération du journal identique) : aucune sauvegarde,
      // sinon deux appareils ouverts se renverraient indéfiniment des sauvegardes inutiles.
      if (Object.is(next, prev)) return prev;
      sauvegarderLocal('cyna_chantiers', next);
      scheduleSync({ chantiers: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setDevis = useCallback((data) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setDevisState((prev, parametresActuels) => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof data === 'function' ? data(prev, parametresActuels) : data;
      if (Object.is(next, prev)) return prev;
      sauvegarderLocal('cyna_devis', next);
      scheduleSync({ devis: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setFactures = useCallback((data) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setFacturesState((prev, parametresActuels) => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof data === 'function' ? data(prev, parametresActuels) : data;
      if (Object.is(next, prev)) return prev;
      sauvegarderLocal('cyna_factures', next);
      scheduleSync({ factures: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setClients = useCallback((data) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setClientsState((prev, parametresActuels) => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof data === 'function' ? data(prev, parametresActuels) : data;
      if (Object.is(next, prev)) return prev;
      sauvegarderLocal('cyna_clients', next);
      scheduleSync({ clients: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setParametres = useCallback((data) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setParametresState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const propose = typeof data === 'function' ? data(prev) : data;
      const next = propose === prev ? prev : { ...propose, idsSupprimes: fusionnerIdsSupprimes(prev.idsSupprimes, propose.idsSupprimes) };
      if (Object.is(next, prev)) return prev;
      sauvegarderLocal('cyna_parametres', next);
      scheduleSync({ parametres: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setPointages = useCallback((updater) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setPointagesState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Object.is(next, prev)) return prev;
      scheduleSync({ pointages: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setObjectifs = useCallback((updater) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setObjectifsState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Object.is(next, prev)) return prev;
      scheduleSync({ objectifs: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setEvenementsCalendrier = useCallback((updater) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setEvenementsCalendrierState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Object.is(next, prev)) return prev;
      scheduleSync({ evenementsCalendrier: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setMemoireIA = useCallback((updater) => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    const jeton = marquerModificationLocale();
    setMemoireIAState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Object.is(next, prev)) return prev;
      scheduleSync({ memoireIA: next });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setDonneesListes = useCallback(updater => {
    if (ecritureRefusee()) return false;
    if (modeRef.current === 'user' && !chargementOkRef.current) return false;
    if (modeRef.current === 'org' && !orgChargeeRef.current) return false;
    const jeton = marquerModificationLocale();
    setDonneesState(prev => {
      attentesLocalesRef.current.delete(jeton);
      if (ecritureRefusee()) return prev;
      const propose = typeof updater === 'function' ? updater(prev) : updater;
      if (propose === prev) return prev;
      const next = avecCompteurs(prev, { ...propose, parametres: { ...propose.parametres,
        idsSupprimes: fusionnerIdsSupprimes(prev.parametres.idsSupprimes, propose.parametres.idsSupprimes) } });
      if (modeRef.current === 'org' && estPayloadVide(next)) return prev;
      for (const cle of CLES_CACHE_LOCAL) sauvegarderLocal('cyna_' + cle, next[cle]);
      scheduleSync(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const etatEnregistrement = useCallback(() => ({
    propre: !pendingRef.current && !enVolRef.current && !episodeRef.current && !recuperationRef.current
      && !attentesLocalesRef.current.size && !ecrituresOrgEnVolRef.current
      && (modeRef.current === 'org' ? orgChargeeRef.current : chargementOkRef.current),
  }), []);
  const envoyerMaintenant = useCallback(async () => {
    const conflitsAvant = conflitsRef.current;
    const confirmationEcriture = confirmationEcritureRef.current;
    // INS2-01 — une confirmation d'import n'est prise en compte que si un import est réellement en cours :
    // une référence restée « ok » après un import hors ligne terminé ne peut plus fausser un envoi ultérieur.
    const importEcriture = importEnCoursRef.current ? importEcritureRef.current : null;
    try {
      if (modeRef.current === 'org') return { ok: etatEnregistrement().propre && ecrituresRefuseesRef.current === 0 };
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
      await flush();
      return { ok: (confirmationEcriture ? confirmationEcriture.ok : importEcriture ? importEcriture.ok : etatEnregistrement().propre) && conflitsRef.current === conflitsAvant && ecrituresRefuseesRef.current === 0,
        conflit: conflitsRef.current !== conflitsAvant,
        refusee: ecrituresRefuseesRef.current !== 0,
        rechargementOk: chargementOkRef.current && !recuperationRef.current };
    } finally {
      if (confirmationEcritureRef.current === confirmationEcriture) confirmationEcritureRef.current = null;
      if (!importEnCoursRef.current) importEcritureRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, etatEnregistrement]);
  const importerTout = useCallback(data => {
    if (!etatEnregistrement().propre) return Promise.resolve(false);
    if (ecritureRefusee()) return Promise.resolve(false);
    if (modeRef.current === 'user' && !chargementOkRef.current) return Promise.resolve(false);
    if (modeRef.current === 'org' && !orgChargeeRef.current) return Promise.resolve(false);
    const jeton = marquerModificationLocale();
    return new Promise(resolve => {
      setDonneesState(prev => {
        attentesLocalesRef.current.delete(jeton);
        if (ecritureRefusee()) { resolve(false); return prev; }
        if (!etatEnregistrement().propre) { resolve(false); return prev; }
        let next;
        try { next = avecCompteurs(prev, donneesImportees(prev, data)); }
        catch (erreur) { console.error(erreur); resolve(false); return prev; }
        if (modeRef.current !== 'org') {
          importEnCoursRef.current = true;
          suspendreRetention(true);
        }
        for (const cle of CLES_CACHE_LOCAL) sauvegarderLocal('cyna_' + cle, next[cle]);
        scheduleSync(next);
        if (modeRef.current !== 'org') importEcritureRef.current = { generation: generationRef.current, ok: false };
        resolve(true);
        return next;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, etatEnregistrement]);


  function preparerRepriseLocale() {
    if (isDemo || modeRef.current !== 'user' || reprisePrepareeRef.current || ecritureRefusee()) return;
    reprisePrepareeRef.current = true;
    const marqueur = lireMarqueur(userId);
    const local = {};
    try { for (const [cle, nom] of Object.entries(CLES_REPRISE)) local[cle] = lireValeurLocale(cle, localStorage.getItem(nom)); }
    catch { return; } // A failed read is never treated as absence.
    const plan = planifierReprise(dataRef.current, local);
    const propositions = {};
    let copieImpossible = false;
    for (const [cle, capture] of Object.entries(plan)) {
      if (marqueur[cle] === capture.empreinte) continue;
      if (capture.action === 'proposer') propositions[cle] = capture;
      else if (capture.action === 'rien' || copierReprise(userId, cle, capture)) marquerReprise(userId, cle, capture);
      else copieImpossible = true;
    }
    if (Object.keys(propositions).length) setRepriseLocale({ propositions, erreur: copieImpossible ? 'Une copie locale est impossible. La donnée originale est conservée.' : null });
    else if (copieImpossible) setEtatSync({ erreurChargement: null, statut: 'information',
      message: "Des données de ce navigateur n'ont pas pu être mises en copie de secours (stockage plein) ; elles restent sur cet appareil." });
  }
  // The promise resolves inside the React updater, after scheduling and recording its generation.
  // options.copierAvant (lot 2b, restauration) : la valeur ACTUELLE de chaque clé est copiée DANS l'updater,
  // à partir de prev (et non d'une valeur lue avant la confirmation) ; si la copie échoue, rien n'est écrit.
  const ecrireOperation = useCallback((valeurs, captures, options = {}) => {
    if (!etatEnregistrement().propre || ecritureRefusee() || isDemo || modeRef.current !== 'user') return Promise.resolve(false);
    const jeton = marquerModificationLocale();
    // INS2-04 — un rejeu de l'updater (StrictMode) ne doit pas créer de copie en double.
    const dejaCopiees = new Set();
    return new Promise(resolve => {
      setDonneesState(prev => {
        attentesLocalesRef.current.delete(jeton);
        if (ecritureRefusee() || !etatEnregistrement().propre) { resolve(false); return prev; }
        const updates = {}, envoyees = [];
        for (const [cle, valeur] of Object.entries(valeurs)) {
          if (!Object.prototype.hasOwnProperty.call(CLES_REPRISE, cle)) { resolve(false); return prev; }
          if (captures && prev[cle] !== undefined) {
            const capture = captures[cle];
            if (canonique(prev[cle]) !== canonique(capture.valeur) && !dejaCopiees.has(cle)) {
              if (!copierReprise(userId, cle, capture)) { resolve(false); return prev; }
              dejaCopiees.add(cle);
            }
            marquerReprise(userId, cle, capture);
          } else {
            if (options.copierAvant && prev[cle] !== undefined && canonique(prev[cle]) !== canonique(valeur) && !dejaCopiees.has(cle)) {
              const texteBrut = cle === 'memoireIA' ? String(prev[cle]) : JSON.stringify(prev[cle]);
              if (!copierReprise(userId, cle, { texteBrut, empreinte: empreinte(texteBrut), valeur: prev[cle] })) { resolve(false); return prev; }
              dejaCopiees.add(cle);
            }
            updates[cle] = valeur; envoyees.push(cle);
          }
        }
        if (envoyees.length) {
          scheduleSync(updates);
          confirmationEcritureRef.current = { generation: generationRef.current, ok: false };
        }
        resolve(captures ? { envoyees } : true);
        return envoyees.length ? { ...prev, ...updates } : prev;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isDemo, etatEnregistrement]);
  const ecrireEtConfirmer = useCallback((cle, valeur, options) => ecrireOperation({ [cle]: valeur }, undefined, options), [ecrireOperation]);
  const reprendreDonneesLocales = useCallback((valeurs, captures) => ecrireOperation(valeurs, captures ||
    Object.fromEntries(Object.entries(valeurs).map(([cle, valeur]) => [cle, { ...lireValeurLocale(cle, cle === 'memoireIA' ? valeur : JSON.stringify(valeur)), valeur }]))), [ecrireOperation]);
  const deciderRepriseLocale = async ajouter => {
    if (!repriseLocale || decisionRepriseRef.current || ecritureRefusee()) return false;
    decisionRepriseRef.current = true;
    const captures = repriseLocale.propositions;
    try {
      if (!ajouter) {
        const marqueur = lireMarqueur(userId);
        for (const [cle, capture] of Object.entries(captures)) {
          // INS2-04 — après un échec partiel, une clé déjà copiée et marquée n'est pas recopiée.
          if (marqueur[cle] === capture.empreinte) continue;
          if (!copierReprise(userId, cle, capture) || !marquerReprise(userId, cle, capture)) {
            setRepriseLocale(prev => ({ ...prev, erreur: 'Copie impossible : données locales conservées. Réessayez.' })); return false;
          }
        }
      } else {
        const operation = await reprendreDonneesLocales(Object.fromEntries(Object.entries(captures).map(([cle, capture]) => [cle, capture.valeur])), captures);
        if (!operation) { setRepriseLocale(prev => ({ ...prev, erreur: "Reprise impossible pour l'instant. Attendez l'enregistrement et réessayez." })); return false; }
        const resultat = operation.envoyees.length ? await envoyerMaintenant() : { ok: true };
        if (!resultat.ok) {
          setRepriseLocale(prev => ({ ...prev, erreur: resultat.conflit
            ? 'Données non enregistrées : le compte a été modifié ailleurs. Les données locales restent sur cet appareil et seront réévaluées au prochain chargement.'
            : resultat.refusee
              ? 'Données non enregistrées : envoi refusé (déconnexion en cours). Les données locales restent sur cet appareil et seront réévaluées au prochain chargement.'
              : "Envoi en attente : la connexion est indisponible. Vos données sont gardées sur cet appareil ; quand le réseau revient, utilisez « Réessayer » dans le bandeau (ou faites une autre modification). Si l'app est fermée avant, la question sera reposée au prochain chargement." }));
          return false;
        }
        for (const cle of operation.envoyees) marquerReprise(userId, cle, captures[cle]);
      }
      setRepriseLocale(null); return true;
    } finally { decisionRepriseRef.current = false; }
  };
  return {
    chantiers, setChantiers,
    devis, setDevis,
    factures, setFactures,
    clients, setClients,
    parametres, setParametres,
    pointages, setPointages,
    objectifs, setObjectifs, evenementsCalendrier, setEvenementsCalendrier, memoireIA, setMemoireIA,
    repriseLocale, deciderRepriseLocale, fermerRepriseLocale: () => setRepriseLocale(null),
    ecrireEtConfirmer, reprendreDonneesLocales,
    terminerSauvegardes, bloquerEcritures, debloquerEcritures,
    setDonneesListes, importerTout, etatEnregistrement, envoyerMaintenant, modeStockage: modeRef.current,
    loading, syncing, etatSync,
    reessayerChargement: async () => {
      if (modeRef.current !== 'user') return;
      setLoading(true);
      await chargerUser(() => !mountedRef.current, true);
      if (mountedRef.current) setLoading(false);
    },
    reessayerSauvegarde: () => flush(),
    fermerMessageSync: () => setEtatSync(prev => ({ ...prev, statut: 'ok', message: null })),
  };
}
