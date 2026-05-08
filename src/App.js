import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  LayoutDashboard, HardHat, FileText, Calendar,
  ClipboardList, Settings, DollarSign, Clock, Bot,
} from 'lucide-react';
import { Sidebar, Topbar, MobileNav } from './components/Layout';
import { donneesInitiales, migrerJournal, migrerDevisId } from './donnees';
import Finances from './pages/FinancesPage';
import { PROFILS } from './Login';
import useAgents from './useAgents';
import Agents from './Agents';
import Heures from './Heures';
import ModalSaisieHeures from './components/ModalSaisieHeures';
import Dashboard from './pages/Dashboard';
import Chantiers from './pages/ChantiersPage';
import Devis from './pages/DevisPage';
import Clients from './pages/ClientsPage';
import Employes from './pages/EmployesPage';
import PlanningPage from './pages/PlanningPage';
import RapportsPage from './pages/RapportsPage';
import Parametres from './pages/ParametresPage';
import { AppProvider } from './context/AppContext';

// Fallback par page quand l'historique est vide
const NAV_FALLBACK = {
  chantiers:    'dashboard',
  devis:        'dashboard',
  finances:     'dashboard',
  clients:      'dashboard',
  employes:     'dashboard',
  planning:     'chantiers',
  statistiques: 'dashboard',
  rapport:      'dashboard',
  analyse:      'dashboard',
  parametres:   'dashboard',
};

function App() {
  const [page, setPage] = useState('dashboard');
  const [contexte, setContexte] = useState({});
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('cyna_theme') === 'dark'; } catch { return false; }
  });
  const [mobileMenuOuvert, setMobileMenuOuvert] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(false);

  // ── Historique de navigation ─────────────────────────────────
  // historyRef : source de vérité pour la logique (lecture synchrone, zéro timing bug)
  // canGoBack  : state booléen uniquement pour déclencher le re-render du bouton
  const historyRef  = React.useRef([]);
  const pageRef     = React.useRef('dashboard');
  const contexteRef = React.useRef({});
  const [canGoBack, setCanGoBack] = useState(false);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      try { localStorage.setItem('cyna_theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }, []);

  const naviguer = useCallback((nouvellePage, nouveauContexte = {}) => {
    // 1. Capturer l'état courant AVANT toute mutation (pas de race avec le batch React)
    const entree = { page: pageRef.current, contexte: contexteRef.current };
    // 2. Mettre à jour les refs (synchrone, immédiat)
    historyRef.current  = [...historyRef.current, entree];
    pageRef.current     = nouvellePage;
    contexteRef.current = nouveauContexte;
    // 3. Mettre à jour le state React (asynchrone/batché)
    setCanGoBack(true);
    setContexte(nouveauContexte);
    setPage(nouvellePage);
  }, []);

  const revenirArriere = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length === 0) {
      // Pas d'historique → fallback contextuel selon la page courante
      const cible = NAV_FALLBACK[pageRef.current] || 'dashboard';
      historyRef.current  = [];
      pageRef.current     = cible;
      contexteRef.current = {};
      setCanGoBack(false);
      setPage(cible);
      setContexte({});
      return;
    }
    const precedent = hist[hist.length - 1];
    historyRef.current  = hist.slice(0, -1);
    pageRef.current     = precedent.page;
    contexteRef.current = precedent.contexte;
    setCanGoBack(historyRef.current.length > 0);
    setPage(precedent.page);
    setContexte(precedent.contexte);
  }, []);

  const charger = (cle, defaut, validateur = null) => {
    try {
      const raw = localStorage.getItem(cle);
      if (!raw) return defaut;
      const parsed = JSON.parse(raw);
      if (validateur && !validateur(parsed)) {
        console.error(`[STORAGE] Données invalides pour ${cle} — reset au défaut`);
        return defaut;
      }
      return parsed;
    } catch {
      console.error(`[STORAGE] Données corrompues pour ${cle} — reset au défaut`);
      return defaut;
    }
  };

  const [periodeGlobale, setPeriodeGlobale] = useState('mois');

  const [parametres, setParametresState] = useState(() => {
    const loaded = charger('cyna_parametres', donneesInitiales, v => v && typeof v === 'object' && !Array.isArray(v));
    // P3 — Migration : si coefficientMainOeuvre absent (anciens users), appliquer 1.35 et persister
    if (loaded.parametres && loaded.parametres.coefficientMainOeuvre === undefined) {
      loaded.parametres = { ...loaded.parametres, coefficientMainOeuvre: 1.35 };
      try { localStorage.setItem('cyna_parametres', JSON.stringify(loaded)); } catch {}
    }
    return loaded;
  });
  const [chantiers, setChantiersState] = useState(() => {
    const raw = charger('cyna_chantiers', donneesInitiales.chantiers, v => Array.isArray(v) && v.every(c => c && c.id != null && c.nom != null));
    // Migration unique : convertit les entrées journal employesPresents → heuresTravaillees
    return raw.map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
  });
  const [clients, setClientsState] = useState(() => charger('cyna_clients', donneesInitiales.clients, Array.isArray));
  const [devis, setDevisState] = useState(() => {
    const LEGACY = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };
    return charger('cyna_devis', donneesInitiales.devis, Array.isArray).map(d => ({ ...d, statut: LEGACY[d.statut] || d.statut }));
  });
  const [factures, setFacturesState] = useState(() => charger('cyna_factures', [], Array.isArray));
  const [paiementsData, setPaiementsDataState] = useState(() => charger('cyna_paiements', {}));
  // photosData conservé en localStorage pour migration future, non exposé à l'UI
  const [actionsLog, setActionsLogState] = useState(() => charger('cyna_actions', []));
  const [profil, setProfil] = useState(() => PROFILS[0]);

  // ── Modal Saisie Heures — rendu au niveau App pour ne pas re-rendre Chantiers ──
  // On stocke l'id, pas le snapshot — le chantier est dérivé en live depuis chantiers[]
  const [saisieHeuresCtx, setSaisieHeuresCtx] = useState(null); // { chantierId, date } | null
  const ouvrirSaisieHeuresApp = useCallback((chantier, date) => {
    setSaisieHeuresCtx({ chantierId: chantier.id, date: date || new Date().toISOString().split('T')[0] });
  }, []);

  const sauvegarderLocal = (cle, data) => {
    try {
      localStorage.setItem(cle, JSON.stringify(data));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        alert('Espace de stockage plein. Supprimez des données pour libérer de l\'espace.');
      }
    }
  };

  // Setters directs (passage par valeur)
  const setParametres    = (data) => { setParametresState(data);    sauvegarderLocal('cyna_parametres', data); };
  const setFactures      = (data) => { setFacturesState(data);      sauvegarderLocal('cyna_factures',   data); };
  const setClients       = (data) => { setClientsState(data);       sauvegarderLocal('cyna_clients',    data); };
  const setDevis         = (data) => { setDevisState(data);         sauvegarderLocal('cyna_devis',      data); };
  const setPaiementsData = (data) => { setPaiementsDataState(data); sauvegarderLocal('cyna_paiements',  data); };

  // setChantiers accepte valeur directe ou updater fonctionnel (Planning, Heures utilisent prev =>)
  const setChantiers = useCallback((updater) => {
    setChantiersState(updater);
  }, []);

  // Sync chantiers → localStorage à chaque changement (couvre les updaters fonctionnels)
  useEffect(() => { sauvegarderLocal('cyna_chantiers', chantiers); }, [chantiers]);

  const logAction = useCallback(({ type, chantierId = null, label = '', factureIds = [] }) => {
    setActionsLogState(prev => {
      const entry = { id: `act_${Date.now()}`, date: Date.now(), type, chantierId, label };
      if (factureIds.length > 0) entry.factureIds = factureIds;
      const next = [entry, ...prev].slice(0, 100);
      try { localStorage.setItem('cyna_actions', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Migration : corrige les chantiers avec devisId = devis.numero au lieu de devis.id
  // Idempotente — peut tourner plusieurs fois sans dupliquer (migrerDevisId ne touche que les ids incohérents)
  const chantiersRef = useRef(chantiers);
  useEffect(() => { chantiersRef.current = chantiers; }, [chantiers]);
  useEffect(() => {
    const corriges = migrerDevisId(chantiersRef.current, devis);
    const changed = corriges.some((c, i) => c.devisId !== chantiersRef.current[i]?.devisId);
    if (changed) {
      console.log('[CYNA] Migration devisId appliquée — chantiers mis à jour');
      setChantiers(corriges);
    }
  }, [devis]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentState = useAgents({ chantiers, devis, factures, clients, parametres });

  const nbFacturesRetard = factures.filter(f =>
    f.statut === 'retard' ||
    (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
  ).length;

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',   Icon: LayoutDashboard, labelCourt: 'Accueil' },
    { id: 'chantiers',  label: 'Chantiers',   Icon: HardHat,         labelCourt: 'Chantiers' },
    { id: 'devis',      label: 'Devis',       Icon: FileText,        labelCourt: 'Devis' },
    { id: 'heures',     label: 'Heures',      Icon: Clock,           labelCourt: 'Heures' },
    { id: 'finances',   label: 'Finances',    Icon: DollarSign,      labelCourt: 'Finances', badge: nbFacturesRetard || null },
    { id: 'planning',   label: 'Planning',    Icon: Calendar,        labelCourt: 'Planning' },
    { id: 'rapport',    label: 'Rapports',    Icon: ClipboardList,   labelCourt: 'Rapports' },
    { id: 'agents',     label: 'Agents IA',   Icon: Bot,             labelCourt: 'Agents' },
    { id: 'parametres', label: 'Paramètres',  Icon: Settings,        labelCourt: 'Config' },
  ];

  const pagesAutorisees = profil.pages || [];
  const navAutorisees = navItems.filter(item => pagesAutorisees.includes(item.id));
  const navMobileItems = navAutorisees.slice(0, 4);

  const appValue = {
    chantiers, setChantiers, clients, setClients, devis, setDevis,
    factures, setFactures, parametres, setParametres,
    paiementsData, setPaiementsData, actionsLog, profil,
    logAction, naviguer, contexte, periodeGlobale, setPeriodeGlobale,
    agentState, ouvrirSaisieHeures: ouvrirSaisieHeuresApp,
  };

  return (
    <AppProvider value={appValue}>
    <div data-theme={darkMode ? 'dark' : 'light'} className="app-layout">
      <Sidebar
        sidebarOuvert={sidebarOuvert} setSidebarOuvert={setSidebarOuvert}
        navAutorisees={navAutorisees} page={page} naviguer={naviguer}
        darkMode={darkMode} toggleDarkMode={toggleDarkMode}
        profil={profil} setProfil={setProfil}
      />
      <div className="main-area">
        <Topbar
          setSidebarOuvert={setSidebarOuvert} canGoBack={canGoBack} page={page}
          revenirArriere={revenirArriere} navAutorisees={navAutorisees}
          darkMode={darkMode} toggleDarkMode={toggleDarkMode} profil={profil}
        />
        <main className="app-main">
          {page === 'dashboard'    && <Dashboard />}
          {page === 'chantiers'    && <Chantiers />}
          {page === 'devis'        && <Devis />}
          {page === 'finances'     && <Finances factures={factures} onSave={setFactures} clients={clients} chantiers={chantiers} devis={devis} paiementsData={paiementsData} setPaiementsData={setPaiementsData} naviguer={naviguer} contexte={contexte} profil={profil} periodeGlobale={periodeGlobale} />}
          {page === 'clients'      && <Clients clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />}
          {page === 'employes'     && <Employes parametres={parametres} setParametres={setParametres} chantiers={chantiers} naviguer={naviguer} />}
          {page === 'planning'     && <PlanningPage chantiers={chantiers} setChantiers={setChantiers} clients={clients} devis={devis} factures={factures} naviguer={naviguer} />}
          {page === 'rapport'      && <RapportsPage chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} periodeGlobale={periodeGlobale} naviguer={naviguer} />}
          {page === 'agents'       && <Agents {...agentState} />}
          {page === 'parametres'   && <Parametres parametres={parametres} setParametres={setParametres} clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />}
          {page === 'heures'       && <Heures chantiers={chantiers} parametres={parametres} setChantiers={setChantiers} />}
        </main>
        {saisieHeuresCtx && (() => {
          const chantierLive = chantiers.find(c => c.id === saisieHeuresCtx.chantierId) || null;
          if (!chantierLive) return null;
          return (
            <ModalSaisieHeures
              key={saisieHeuresCtx.chantierId}
              chantierSaisie={chantierLive}
              initialDate={saisieHeuresCtx.date}
              parametres={parametres}
              onFermer={() => setSaisieHeuresCtx(null)}
              onSave={updated => {
                setChantiers(prev => prev.map(ch => ch.id === updated.id ? updated : ch));
                setSaisieHeuresCtx(null);
                naviguer('heures');
              }}
            />
          );
        })()}
        <MobileNav
          navMobileItems={navMobileItems} page={page} naviguer={naviguer}
          mobileMenuOuvert={mobileMenuOuvert} setMobileMenuOuvert={setMobileMenuOuvert}
          navAutorisees={navAutorisees}
        />
      </div>
    </div>
    </AppProvider>
  );
}




export default App;