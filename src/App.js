import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  LayoutDashboard, HardHat, FileText, Calendar,
  ClipboardList, Settings, DollarSign, Clock, Bot,
} from 'lucide-react';
import { Sidebar, Topbar, MobileNav } from './components/Layout';
import { migrerDevisId } from './donnees';
import Finances from './pages/FinancesPage';
import Login from './Login';
import useAuth from './hooks/useAuth';
import useSupabaseData from './hooks/useSupabaseData';
import useAgents from './useAgents';
import Heures from './Heures';
import ModalSaisieHeures from './components/ModalSaisieHeures';
import Dashboard from './pages/Dashboard';
import Chantiers from './pages/ChantiersPage';
import Devis from './pages/DevisPage';
import Clients from './pages/ClientsPage';
import Employes from './pages/EmployesPage';
import PlanningPage from './pages/PlanningPage';
import RapportsPage from './pages/RapportsPage';
import CentreIA from './pages/CentreIA';
import Parametres from './pages/ParametresPage';
import { AppProvider } from './context/AppContext';
import InstallPWA from './components/InstallPWA';
import ConfirmModal from './components/ui/ConfirmModal';

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
  const { session, profil: profilAuth, loading: authLoading, deconnecter } = useAuth();

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d3d6e' }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <AppInner profil={profilAuth} deconnecter={deconnecter} userId={session.user.id} />;
}

function AppInner({ profil, deconnecter, userId }) {
  const {
    chantiers, setChantiers,
    devis, setDevis,
    factures, setFactures,
    clients, setClients,
    parametres, setParametres,
    loading: dataLoading,
    syncing,
  } = useSupabaseData(userId);

  const [page, setPage] = useState('dashboard');
  const [contexte, setContexte] = useState({});
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('cyna_theme') === 'dark'; } catch { return false; }
  });
  const [mobileMenuOuvert, setMobileMenuOuvert] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(false);

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
    const entree = { page: pageRef.current, contexte: contexteRef.current };
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

  const [periodeGlobale, setPeriodeGlobale] = useState('mois');
  const [paiementsData, setPaiementsDataState] = useState(() => {
    try { const r = localStorage.getItem('cyna_paiements'); return r ? JSON.parse(r) : {}; } catch { return {}; }
  });
  const [actionsLog, setActionsLogState] = useState(() => {
    try { const r = localStorage.getItem('cyna_actions'); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  const setPaiementsData = (data) => {
    setPaiementsDataState(data);
    try { localStorage.setItem('cyna_paiements', JSON.stringify(data)); } catch {}
  };

  const [notif, setNotif] = useState(null);
  const afficherNotif = useCallback((message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3000);
  }, []);

  const [confirmState, setConfirmState] = useState(null);
  const confirmer = useCallback((message, options = {}) => new Promise(resolve => {
    setConfirmState({
      message,
      labelOui: options.labelOui,
      labelNon: options.labelNon,
      danger: options.danger !== false,
      onOui: () => { setConfirmState(null); resolve(true); },
      onNon: () => { setConfirmState(null); resolve(false); },
    });
  }), []);

  const [saisieHeuresCtx, setSaisieHeuresCtx] = useState(null);
  const ouvrirSaisieHeuresApp = useCallback((chantier, date) => {
    setSaisieHeuresCtx({ chantierId: chantier.id, date: date || new Date().toISOString().split('T')[0] });
  }, []);

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
      if (process.env.NODE_ENV !== 'production') console.log('[CYNA] Migration devisId appliquée — chantiers mis à jour');
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
    { id: 'agents',     label: 'Centre IA',   Icon: Bot,             labelCourt: 'Centre IA' },
    { id: 'parametres', label: 'Paramètres',  Icon: Settings,        labelCourt: 'Config' },
  ];

  const pagesAutorisees = profil?.pages || ['dashboard'];
  const navAutorisees = navItems.filter(item => pagesAutorisees.includes(item.id));
  const navMobileItems = navAutorisees.slice(0, 4);

  const appValue = {
    chantiers, setChantiers, clients, setClients, devis, setDevis,
    factures, setFactures, parametres, setParametres,
    paiementsData, setPaiementsData, actionsLog, profil,
    logAction, naviguer, contexte, periodeGlobale, setPeriodeGlobale,
    agentState, ouvrirSaisieHeures: ouvrirSaisieHeuresApp,
    deconnecter, afficherNotif, confirmer,
  };

  return (
    <AppProvider value={appValue}>
    <div data-theme={darkMode ? 'dark' : 'light'} className="app-layout">
      <Sidebar
        sidebarOuvert={sidebarOuvert} setSidebarOuvert={setSidebarOuvert}
        navAutorisees={navAutorisees} page={page} naviguer={naviguer}
        darkMode={darkMode} toggleDarkMode={toggleDarkMode}
        profil={profil} deconnecter={deconnecter}
      />
      <div className="main-area">
        <Topbar
          setSidebarOuvert={setSidebarOuvert} canGoBack={canGoBack} page={page}
          revenirArriere={revenirArriere} navAutorisees={navAutorisees}
          darkMode={darkMode} toggleDarkMode={toggleDarkMode} profil={profil}
          deconnecter={deconnecter}
        />
        {(dataLoading || syncing) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            height: 3, background: 'rgba(0,0,0,0.08)',
          }}>
            <div style={{
              height: '100%',
              background: 'var(--brand, #0d3d6e)',
              animation: 'cyna-loading-bar 1.2s ease-in-out infinite',
              width: '60%',
            }} />
            <style>{`
              @keyframes cyna-loading-bar {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(260%); }
              }
            `}</style>
          </div>
        )}
        <main className="app-main">
          {page === 'dashboard'    && <Dashboard />}
          {page === 'chantiers'    && pagesAutorisees.includes('chantiers')  && <Chantiers />}
          {page === 'devis'        && pagesAutorisees.includes('devis')      && <Devis />}
          {page === 'finances'     && pagesAutorisees.includes('finances')   && <Finances factures={factures} onSave={setFactures} clients={clients} chantiers={chantiers} devis={devis} paiementsData={paiementsData} setPaiementsData={setPaiementsData} naviguer={naviguer} contexte={contexte} profil={profil} periodeGlobale={periodeGlobale} parametres={parametres} />}
          {page === 'clients'      && pagesAutorisees.includes('clients')    && <Clients clients={clients} setClients={setClients} chantiers={chantiers} setChantiers={setChantiers} devis={devis} setDevis={setDevis} factures={factures} setFactures={setFactures} naviguer={naviguer} />}
          {page === 'employes'     && pagesAutorisees.includes('employes')   && <Employes parametres={parametres} setParametres={setParametres} chantiers={chantiers} naviguer={naviguer} />}
          {page === 'planning'     && pagesAutorisees.includes('planning')   && <PlanningPage chantiers={chantiers} setChantiers={setChantiers} clients={clients} devis={devis} factures={factures} parametres={parametres} naviguer={naviguer} />}
          {page === 'rapport'      && pagesAutorisees.includes('rapport')    && <RapportsPage chantiers={chantiers} clients={clients} devis={devis} factures={factures} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} periodeGlobale={periodeGlobale} naviguer={naviguer} />}
          {page === 'agents'       && pagesAutorisees.includes('agents')     && <CentreIA />}
          {page === 'parametres'   && pagesAutorisees.includes('parametres') && <Parametres parametres={parametres} setParametres={setParametres} clients={clients} setClients={setClients} chantiers={chantiers} setChantiers={setChantiers} devis={devis} setDevis={setDevis} factures={factures} setFactures={setFactures} naviguer={naviguer} />}
          {page === 'heures'       && pagesAutorisees.includes('heures')     && <Heures chantiers={chantiers} parametres={parametres} setChantiers={setChantiers} />}
          {/* Fallback 404 */}
          {!['dashboard', 'chantiers', 'devis', 'finances', 'clients', 'employes', 'planning', 'rapport', 'agents', 'parametres', 'heures'].includes(page) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48 }}>404</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Page introuvable</div>
              <button onClick={() => naviguer('dashboard')} style={{ marginTop: 8, padding: '10px 24px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Retour au tableau de bord
              </button>
            </div>
          )}
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
    <InstallPWA />
    {notif && (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        background: notif.type === 'success' ? '#10b981' : '#ef4444',
        color: '#fff', padding: '12px 20px', borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 14, fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {notif.type === 'success' ? '✓' : '✕'} {notif.message}
      </div>
    )}
    {confirmState && (
      <ConfirmModal
        message={confirmState.message}
        labelOui={confirmState.labelOui}
        labelNon={confirmState.labelNon}
        danger={confirmState.danger}
        onOui={confirmState.onOui}
        onNon={confirmState.onNon}
      />
    )}
    </AppProvider>
  );
}




export default App;