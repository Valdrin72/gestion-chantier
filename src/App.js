import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard, HardHat, FileText, Calendar,
  ClipboardList, Settings, DollarSign, Clock, Bot,
  Users, UserCog, ChevronRight, Sparkles, Calculator, Bell,
} from 'lucide-react';
import { Sidebar, Topbar, MobileNav } from './components/Layout';
import { migrerDevisId, donneesInitiales, migrerJournal } from './donnees';
import { migrerJournalVersPointages } from './migration/migrerJournalVersPointages';
import { calculerMajorationDate } from './calculs/majorations';
import Finances from './pages/FinancesPage';
import Login from './Login';
import useAuth from './hooks/useAuth';
import useSupabaseData from './hooks/useSupabaseData';
import useAgents from './useAgents';
import Heures from './Heures';
import PointagesPage from './pages/PointagesPage';
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
import CalculsPage from './pages/CalculsPage';
import { AlertsPage } from './modules/alertes/AlertsPage.js';
import { useAlertBootstrap } from './modules/alertes/useAlertBootstrap.js';
import { useUrgentCount } from './modules/alertes/hooks/useAlertCount.js';
import { AppProvider } from './context/AppContext';
import { regenererJournalDepuisPointages } from './migration/regenererJournalDepuisPointages';
import InstallPWA from './components/InstallPWA';
import OfflineBanner from './components/OfflineBanner';
import ConfirmModal from './components/ui/ConfirmModal';
import ErrorBoundary from './components/ErrorBoundary';

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

  return <AppInner key={session.user.id} profil={profilAuth} deconnecter={deconnecter} userId={session.user.id} />;
}

function AppInner({ profil, deconnecter, userId }) {
  const {
    chantiers, setChantiers,
    devis, setDevis,
    factures, setFactures,
    clients, setClients,
    parametres, setParametres,
    pointages, setPointages,
    loading: dataLoading,
    syncing,
  } = useSupabaseData(userId);

  // Filet de sécurité : si après chargement tout est vide, injecter les données initiales
  const injectedRef = useRef(false);
  useEffect(() => {
    if (dataLoading || injectedRef.current) return;
    if (chantiers.length === 0 && devis.length === 0) {
      injectedRef.current = true;
      setChantiers(donneesInitiales.chantiers.map(ch => ({ ...ch, journal: migrerJournal(ch.journal || []) })));
      setDevis(donneesInitiales.devis);
      setFactures(donneesInitiales.factures || []);
      setClients(donneesInitiales.clients);
      setParametres({ ...donneesInitiales, demoVersion: 5 });
    }
  }, [dataLoading, chantiers.length, devis.length, setChantiers, setDevis, setFactures, setClients, setParametres]);

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

  const [periodeGlobale, setPeriodeGlobaleState] = useState(() => {
    try { return localStorage.getItem('cyna_periode') || 'annee'; } catch { return 'annee'; }
  });
  const setPeriodeGlobale = useCallback((v) => {
    try { localStorage.setItem('cyna_periode', v); } catch {}
    setPeriodeGlobaleState(v);
  }, []);
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

  // Migration Phase 3 — journal → pointages (idempotente via migrationJournalV2Done)
  useEffect(() => {
    if (dataLoading) return;
    if (parametres.migrationJournalV2Done) return;
    if (pointages.length > 0) return;
    const migres = migrerJournalVersPointages(chantiers, parametres.employes || []);
    if (migres.length > 0) {
      setPointages(migres);
      setParametres(prev => ({ ...prev, migrationJournalV2Done: true }));
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CYNA] Migration journal → pointages : ${migres.length} pointages créés`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, parametres.migrationJournalV2Done, pointages.length]);

  // Backfill Phase 4 — calcul des majorations date-based sur les pointages migrés
  useEffect(() => {
    if (dataLoading) return;
    if (parametres.backfillMajorationPhase4Done) return;
    if (pointages.length === 0) return;

    // Index canton par chantierId
    const cantonParChantier = {};
    for (const c of chantiers) cantonParChantier[String(c.id)] = c.canton ?? 'GE';

    let modified = false;
    const enrichis = pointages.map(p => {
      if (p.majoration !== null && p.majoration !== undefined) return p;
      // Canton du chantier de la 1ère repartition productive
      const repProd = p.repartitions.find(r => ['production', 'atelier'].includes(r.categorie));
      const canton = repProd ? (cantonParChantier[String(repProd.chantierId)] ?? 'GE') : 'GE';
      const maj = calculerMajorationDate(p.date, canton);
      if (!maj) return p;
      const heuresProd = p.repartitions
        .filter(r => ['production', 'atelier'].includes(r.categorie))
        .reduce((s, r) => s + r.heures, 0);
      if (heuresProd <= 0) return p;
      modified = true;
      return { ...p, majoration: [{ type: maj.type, facteur: maj.facteur, heures: heuresProd, cout_supplementaire: 0 }] };
    });

    if (modified) setPointages(enrichis);
    setParametres(prev => ({ ...prev, backfillMajorationPhase4Done: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, parametres.backfillMajorationPhase4Done, pointages.length]);

  // Backfill coef MO — passe coefficientMainOeuvre de 1.35 → 1.0 (tarifs déjà tout compris)
  useEffect(() => {
    if (dataLoading) return;
    if (parametres.backfillCoefMO10Done) return;
    if (parseFloat(parametres.coefficientMainOeuvre) !== 1.35) {
      // Valeur déjà différente de 1.35 → marquer done sans toucher
      setParametres(prev => ({ ...prev, backfillCoefMO10Done: true }));
      return;
    }
    setParametres(prev => ({ ...prev, coefficientMainOeuvre: 1.0, backfillCoefMO10Done: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, parametres.backfillCoefMO10Done]);

  // Phase 5a — Régénération du journal dérivé depuis pointages (strangler fig).
  // Dépendance sur pointages uniquement (pas chantiers) pour éviter la boucle infinie.
  // La garde JSON.stringify évite setChantiers si le journal n'a pas changé.
  useEffect(() => {
    if (dataLoading) return;
    if (pointages.length === 0) return;
    setChantiers(prev => {
      const regenes = regenererJournalDepuisPointages(pointages, prev);
      const changed = regenes.some((c, i) =>
        JSON.stringify(c.journal) !== JSON.stringify(prev[i]?.journal)
      );
      return changed ? regenes : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, pointages]);

  const agentState = useAgents({ chantiers, devis, factures, clients, parametres });

  // Moteur d'alertes — évaluation automatique toutes les 5 min
  useAlertBootstrap({ chantiers, devis, factures, clients, parametres, pointages });
  const urgentAlerteCount = useUrgentCount();

  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('cyna_onboarding_done'); } catch { return false; }
  });
  const fermerOnboarding = useCallback((destination = null) => {
    try { localStorage.setItem('cyna_onboarding_done', '1'); } catch {}
    setShowOnboarding(false);
    if (destination) naviguer(destination);
  }, [naviguer]);

  const nbFacturesRetard = factures.filter(f =>
    f.statut === 'retard' ||
    (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
  ).length;

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',   Icon: LayoutDashboard, labelCourt: 'Accueil' },
    { id: 'chantiers',  label: 'Chantiers',   Icon: HardHat,         labelCourt: 'Chantiers' },
    { id: 'devis',      label: 'Devis',       Icon: FileText,        labelCourt: 'Devis' },
    { id: 'finances',   label: 'Finances',    Icon: DollarSign,      labelCourt: 'Finances', badge: nbFacturesRetard || null },
    { id: 'clients',    label: 'Clients',     Icon: Users,           labelCourt: 'Clients' },
    { id: 'employes',   label: 'Employés',    Icon: UserCog,         labelCourt: 'Équipe' },
    { id: 'heures',     label: 'Heures',      Icon: Clock,           labelCourt: 'Heures' },
    { id: 'planning',   label: 'Planning',    Icon: Calendar,        labelCourt: 'Planning' },
    { id: 'rapport',    label: 'Rapports',    Icon: ClipboardList,   labelCourt: 'Rapports' },
    { id: 'agents',     label: 'Centre IA',   Icon: Bot,             labelCourt: 'Centre IA' },
    { id: 'calculs',    label: 'Calculs',     Icon: Calculator,      labelCourt: 'Calculs' },
    { id: 'alertes',    label: 'Alertes',     Icon: Bell,            labelCourt: 'Alertes', badge: urgentAlerteCount || null },
    { id: 'parametres', label: 'Paramètres',  Icon: Settings,        labelCourt: 'Config' },
  ];

  const pagesAutorisees = profil?.pages || ['dashboard'];
  const navAutorisees = navItems.filter(item => pagesAutorisees.includes(item.id));
  const navMobileItems = navAutorisees.slice(0, 4);

  const appValue = useMemo(() => ({
    chantiers, setChantiers, clients, setClients, devis, setDevis,
    factures, setFactures, parametres, setParametres,
    pointages, setPointages,
    paiementsData, setPaiementsData, actionsLog, profil,
    logAction, naviguer, contexte, periodeGlobale, setPeriodeGlobale,
    agentState, ouvrirSaisieHeures: ouvrirSaisieHeuresApp,
    deconnecter, afficherNotif, confirmer,
  }), [ // eslint-disable-line react-hooks/exhaustive-deps
    chantiers, clients, devis, factures, parametres, pointages,
    paiementsData, actionsLog, profil, contexte, periodeGlobale, agentState,
  ]);

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
          deconnecter={deconnecter} naviguer={naviguer}
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
          <ErrorBoundary key={page}>
          {page === 'dashboard'    && <Dashboard />}
          {page === 'chantiers'    && pagesAutorisees.includes('chantiers')  && <Chantiers />}
          {page === 'devis'        && pagesAutorisees.includes('devis')      && <Devis />}
          {page === 'finances'     && pagesAutorisees.includes('finances')   && <Finances factures={factures} onSave={setFactures} clients={clients} chantiers={chantiers} devis={devis} paiementsData={paiementsData} setPaiementsData={setPaiementsData} naviguer={naviguer} contexte={contexte} profil={profil} periodeGlobale={periodeGlobale} parametres={parametres} />}
          {page === 'clients'      && pagesAutorisees.includes('clients')    && <Clients clients={clients} setClients={setClients} chantiers={chantiers} setChantiers={setChantiers} devis={devis} setDevis={setDevis} factures={factures} setFactures={setFactures} naviguer={naviguer} />}
          {page === 'employes'     && pagesAutorisees.includes('employes')   && <Employes parametres={parametres} setParametres={setParametres} chantiers={chantiers} naviguer={naviguer} />}
          {page === 'planning'     && pagesAutorisees.includes('planning')   && <PlanningPage chantiers={chantiers} setChantiers={setChantiers} clients={clients} devis={devis} factures={factures} parametres={parametres} naviguer={naviguer} />}
          {page === 'rapport'      && pagesAutorisees.includes('rapport')    && <RapportsPage chantiers={chantiers} clients={clients} devis={devis} factures={factures} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} periodeGlobale={periodeGlobale} naviguer={naviguer} />}
          {page === 'agents'       && pagesAutorisees.includes('agents')     && <CentreIA />}
          {page === 'calculs'      && <CalculsPage />}
          {page === 'alertes'      && <AlertsPage naviguer={naviguer} />}
          {page === 'parametres'   && pagesAutorisees.includes('parametres') && <Parametres parametres={parametres} setParametres={setParametres} clients={clients} setClients={setClients} chantiers={chantiers} setChantiers={setChantiers} devis={devis} setDevis={setDevis} factures={factures} setFactures={setFactures} naviguer={naviguer} />}
          {page === 'heures'       && pagesAutorisees.includes('heures')     && <Heures chantiers={chantiers} parametres={parametres} setChantiers={setChantiers} />}
          {page === 'pointages'    && pagesAutorisees.includes('pointages')  && <PointagesPage />}
          {/* Fallback 404 */}
          {!['dashboard', 'chantiers', 'devis', 'finances', 'clients', 'employes', 'planning', 'rapport', 'agents', 'calculs', 'alertes', 'parametres', 'heures', 'pointages'].includes(page) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48 }}>404</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Page introuvable</div>
              <button onClick={() => naviguer('dashboard')} style={{ marginTop: 8, padding: '10px 24px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Retour au tableau de bord
              </button>
            </div>
          )}
          </ErrorBoundary>
        </main>
        {saisieHeuresCtx && (() => {
          const chantierLive = chantiers.find(c => String(c.id) === String(saisieHeuresCtx.chantierId)) || null;
          if (!chantierLive) return null;
          return (
            <ModalSaisieHeures
              key={saisieHeuresCtx.chantierId}
              chantierSaisie={chantierLive}
              initialDate={saisieHeuresCtx.date}
              parametres={parametres}
              onFermer={() => setSaisieHeuresCtx(null)}
              onSave={() => {
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
    <OfflineBanner />
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
    {showOnboarding && !dataLoading && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(10, 20, 40, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 20,
          padding: '40px 36px',
          maxWidth: 560,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}>
          {/* En-tête */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0d3d6e, #1e6bb8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Bienvenue dans CYNA
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Voici comment démarrer en 3 étapes
              </div>
            </div>
          </div>

          {/* Étapes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '28px 0' }}>
            {[
              { step: 1, icon: Users, label: 'Créer votre premier client', desc: 'Nom, contact, adresse — la base de chaque projet', dest: 'clients', color: '#0d3d6e' },
              { step: 2, icon: FileText, label: 'Établir un devis', desc: 'Postes de travaux, montant HT, TVA 8.1%', dest: 'devis', color: '#8b5cf6' },
              { step: 3, icon: HardHat, label: 'Ouvrir un chantier', desc: 'Liez le devis signé, suivez l\'avancement et les heures', dest: 'chantiers', color: '#10b981' },
            ].map(({ step, icon: Icon, label, desc, dest, color }) => (
              <button
                key={step}
                onClick={() => fermerOnboarding(dest)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                  background: color + '0d', border: `1px solid ${color}25`,
                  textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = color + '1a'; e.currentTarget.style.borderColor = color + '50'; }}
                onMouseLeave={e => { e.currentTarget.style.background = color + '0d'; e.currentTarget.style.borderColor = color + '25'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '20', borderRadius: 20, padding: '1px 8px' }}>Étape {step}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                </div>
                <ChevronRight size={16} color={color} style={{ flexShrink: 0, opacity: 0.6 }} />
              </button>
            ))}
          </div>

          {/* Pied */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => fermerOnboarding(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'inherit', padding: '6px 0' }}
            >
              Explorer d'abord
            </button>
            <button
              onClick={() => fermerOnboarding('clients')}
              style={{ background: 'linear-gradient(135deg, #0d3d6e, #1e6bb8)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              Commencer <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    )}
    </AppProvider>
  );
}




export default App;