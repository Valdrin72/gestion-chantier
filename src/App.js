import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LayoutDashboard, HardHat, FileText, Users, UserCheck, Calendar,
  BarChart2, CheckSquare, ClipboardList, TrendingUp,
  Settings, Moon, Sun, LogOut,
  Menu, X, Plus, Pencil, Trash2, AlertTriangle,
  ChevronRight, CheckCircle, DollarSign, Bell, Clock, CreditCard, Bot, Eye,
  FolderOpen,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { donneesInitiales, fmtN, calculerDateFinOuvrables, joursOuvrableRestants, getAlerte, getAlerteChantier, estRetardJustifie, getChantierStatus, calculerCoutsChantier, statutRentabilite, C, getIntervallesPeriode, getPeriodeLabel, chantiersInPeriode, facturesInPeriode, calculerJoursRestants, calculerRentabiliteReelle, calculerEcartChantier, calculerEtatChantier, assertEtatValide, assertEtatCoherent, calculerVitesseChantier, migrerJournal, migrerDevisId, heuresEmploye, heuresJour, sommeAvenants, calculerCA, isChantierActif } from './donnees';
import Finances from './Finances';
import Statistiques from './Statistiques';
import Planning from './Planning';
import Qualite from './Qualite';
import Rapport from './Rapport';
import Analyse from './Analyse';
import Login, { PROFILS } from './Login';
import { DS, couleurStatut as couleurStatutDS, badgeStatut } from './ds';
import useAgents from './useAgents';
import Agents from './Agents';
import Calendrier from './Calendrier';
import Documents from './Documents';
import Heures from './Heures';
import Marges from './Marges';

// Supprime les balises HTML des champs texte avant sauvegarde (protection XSS dans PDF)
const sanitiser = (obj) => {
  const nettoyer = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').substring(0, 2000) : v;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nettoyer(v)]));
};

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const thStyle = DS.th;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Badge({ texte, couleur }) {
  return (
    <span style={{
      background: couleur + '15',
      color: couleur,
      border: `1px solid ${couleur}30`,
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }}>
      {texte}
    </span>
  );
}

function CoutBadge({ label, valeur, couleur }) {
  return (
    <div style={{
      background: couleur + '10',
      border: `1px solid ${couleur}25`,
      borderRadius: '12px',
      padding: '12px 16px',
      minWidth: '130px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '16px', color: couleur }}>CHF {fmtN(valeur)}</div>
    </div>
  );
}

function BarreAvancement({ valeur, couleur }) {
  const progress = Math.max(0, Math.min(100, Number(valeur ?? 0)));
  let auto = '#ef4444';
  if (progress > 30) auto = '#f59e0b';
  if (progress > 70) auto = '#22c55e';
  const c = couleur || auto;
  return (
    <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', height: '6px', width: '100%', overflow: 'hidden' }}>
      <div style={{ background: c, width: `${progress}%`, height: '6px', borderRadius: '10px', transition: 'width 0.4s ease' }} />
    </div>
  );
}

// Badge rentabilité — lecture seule, aucun calcul existant modifié
// ca = etat.devisTotal, couts = etat.coutTotalReel
function BadgeRentabilite({ ca, couts }) {
  if (ca === null || ca === undefined || ca <= 0) return null;
  const marge = ca - couts;
  const taux = marge / ca;
  const cfg = taux >= 0.2
    ? { label: 'Rentable',   couleur: '#22c55e' }
    : taux >= 0.1
      ? { label: 'Attention', couleur: '#f59e0b' }
      : { label: 'Danger',    couleur: '#ef4444' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.couleur + '18',
      color: cfg.couleur,
      border: `1px solid ${cfg.couleur}40`,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// Fallback par page quand l'historique est vide
const NAV_FALLBACK = {
  chantiers:    'dashboard',
  devis:        'dashboard',
  finances:     'dashboard',
  clients:      'dashboard',
  employes:     'dashboard',
  planning:     'chantiers',
  statistiques: 'dashboard',
  qualite:      'chantiers',
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

  const charger = (cle, defaut) => {
    try {
      const data = localStorage.getItem(cle);
      return data ? JSON.parse(data) : defaut;
    } catch { return defaut; }
  };

  const [periodeGlobale, setPeriodeGlobale] = useState('mois');

  const [parametres, setParametresState] = useState(() => {
    const loaded = charger('cyna_parametres', donneesInitiales);
    // P3 — Migration : si coefficientMainOeuvre absent (anciens users), appliquer 1.35 et persister
    if (loaded.parametres && loaded.parametres.coefficientMainOeuvre === undefined) {
      loaded.parametres = { ...loaded.parametres, coefficientMainOeuvre: 1.35 };
      try { localStorage.setItem('cyna_parametres', JSON.stringify(loaded)); } catch {}
    }
    return loaded;
  });
  const [chantiers, setChantiersState] = useState(() => {
    const raw = charger('cyna_chantiers', donneesInitiales.chantiers);
    // Migration unique : convertit les entrées journal employesPresents → heuresTravaillees
    return raw.map(c => ({ ...c, journal: migrerJournal(c.journal || []) }));
  });
  const [clients, setClientsState] = useState(() => charger('cyna_clients', donneesInitiales.clients));
  const [devis, setDevisState] = useState(() => {
    const LEGACY = { 'Validé': 'accepté', 'Signé': 'accepté', 'Envoyé': 'envoyé', 'Refusé': 'refusé', 'Brouillon': 'brouillon', 'Annulé': 'refusé' };
    return charger('cyna_devis', donneesInitiales.devis).map(d => ({ ...d, statut: LEGACY[d.statut] || d.statut }));
  });
  const [qualiteData, setQualiteDataState] = useState(() => charger('cyna_qualite', {}));
  const [factures, setFacturesState] = useState(() => charger('cyna_factures', []));
  const [paiementsData, setPaiementsDataState] = useState(() => charger('cyna_paiements', {}));
  // photosData conservé en localStorage pour migration future, non exposé à l'UI
  const [actionsLog, setActionsLogState] = useState(() => charger('cyna_actions', []));
  const [profil, setProfil] = useState(() => {
    const stored = charger('cyna_profil', null);
    if (!stored || !stored.id) return null;
    // Revalider contre les profils connus — empêche la manipulation du localStorage
    return PROFILS.find(p => p.id === stored.id) || null;
  });

  // ── Modal Saisie Heures — rendu au niveau App pour ne pas re-rendre Chantiers ──
  const [saisieHeuresCtx, setSaisieHeuresCtx] = useState(null); // { chantier, date } | null
  const ouvrirSaisieHeuresApp = useCallback((chantier, date) => {
    setSaisieHeuresCtx({ chantier, date: date || new Date().toISOString().split('T')[0] });
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
  const setQualiteData   = (data) => { setQualiteDataState(data);   sauvegarderLocal('cyna_qualite',    data); };
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

  // Migration unique au démarrage : corrige les chantiers avec devisId = devis.numero au lieu de devis.id
  useEffect(() => {
    const corriges = migrerDevisId(chantiers, devis);
    const changed = corriges.some((c, i) => c.devisId !== chantiers[i].devisId);
    if (changed) {
      console.log('[CYNA] Migration devisId appliquée — chantiers mis à jour');
      setChantiers(corriges);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const agentState = useAgents({ chantiers, devis, factures, clients, parametres });

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',   Icon: LayoutDashboard, labelCourt: 'Accueil' },
    { id: 'chantiers',  label: 'Chantiers',   Icon: HardHat,         labelCourt: 'Chantiers' },
    { id: 'devis',      label: 'Devis',       Icon: FileText,        labelCourt: 'Devis' },
    { id: 'heures',     label: 'Heures',      Icon: Clock,           labelCourt: 'Heures' },
    { id: 'finances',   label: 'Finances',    Icon: DollarSign,      labelCourt: 'Finances' },
    { id: 'planning',   label: 'Planning',    Icon: Calendar,        labelCourt: 'Planning' },
    { id: 'rapport',    label: 'Rapports',    Icon: ClipboardList,   labelCourt: 'Rapports' },
    { id: 'agents',     label: 'Agents IA',   Icon: Bot,             labelCourt: 'Agents' },
    { id: 'parametres', label: 'Paramètres',  Icon: Settings,        labelCourt: 'Config' },
  ];

  if (!profil) {
    return <Login onLogin={(p) => { setProfil(p); localStorage.setItem('cyna_profil', JSON.stringify(p)); }} />;
  }

  const pagesAutorisees = profil.pages || [];
  const navAutorisees = navItems.filter(item => pagesAutorisees.includes(item.id));
  const navMobileItems = navAutorisees.slice(0, 4);

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className="app-layout">

      {/* ===== OVERLAY SIDEBAR MOBILE ===== */}
      {sidebarOuvert && <div className="sidebar-overlay" onClick={() => setSidebarOuvert(false)} />}

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar${sidebarOuvert ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><BarChart2 size={17} strokeWidth={1.8} style={{ color: '#fff' }} /></div>
          <div className="sidebar-logo-name">CYNA</div>
        </div>
        <button className="sidebar-cta" onClick={() => { naviguer('chantiers'); setSidebarOuvert(false); }}>
          <Plus size={16} strokeWidth={2.6} /> Nouveau chantier
        </button>
        <nav className="sidebar-nav">
          {navAutorisees.map(item => (
            <button
              key={item.id}
              className={`sidebar-item${page === item.id ? ' active' : ''}`}
              data-label={item.label}
              onClick={() => { naviguer(item.id); setSidebarOuvert(false); }}
            >
              <item.Icon size={17} strokeWidth={page === item.id ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
          <div className={`sidebar-toggle-track${darkMode ? ' on' : ''}`}>
            <div className="sidebar-toggle-thumb" />
          </div>
          {darkMode ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
          <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{profil.nom.substring(0, 2).toUpperCase()}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{profil.nom}</div>
            <div className="sidebar-profile-role">{profil.id}</div>
          </div>
          <button className="sidebar-logout" onClick={() => { setProfil(null); localStorage.removeItem('cyna_profil'); }} title="Changer de profil">
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* ===== ZONE PRINCIPALE ===== */}
      <div className="main-area">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="burger-btn" onClick={() => setSidebarOuvert(v => !v)}>
              <Menu size={20} strokeWidth={1.8} />
            </button>
            {canGoBack && page !== 'dashboard' && (
              <button
                onClick={revenirArriere}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--bg-glass-2)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: 8, padding: '5px 12px',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass-2)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              >
                <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                Retour
              </button>
            )}
            <span className="topbar-title">{navAutorisees.find(n => n.id === page)?.label || 'Dashboard'}</span>
          </div>
          <div className="topbar-right">
            <button className="topbar-icon-btn" onClick={toggleDarkMode} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
              {darkMode ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
            </button>
            <div className="topbar-avatar">{profil.nom.substring(0, 2).toUpperCase()}</div>
          </div>
        </header>

        {/* ===== CONTENU PRINCIPAL ===== */}
        <main className="app-main">
          {page === 'dashboard'    && <Dashboard chantiers={chantiers} clients={clients} factures={factures} devis={devis} parametres={parametres} naviguer={naviguer} actionsLog={actionsLog} logAction={logAction} periodeGlobale={periodeGlobale} setPeriodeGlobale={setPeriodeGlobale} profil={profil} agentAlertes={agentState.alertes} nbAgentAlertes={agentState.nbNonLues} agentPredictions={agentState.predictions} marquerLu={agentState.marquerLu} naviguerAgents={() => naviguer('agents')} />}
          {page === 'chantiers'    && <Chantiers chantiers={chantiers} setChantiers={setChantiers} factures={factures} clients={clients} devis={devis} parametres={parametres} naviguer={naviguer} contexte={contexte} ouvrirSaisieHeures={ouvrirSaisieHeuresApp} />}
          {page === 'devis'        && <Devis devis={devis} setDevis={setDevis} clients={clients} parametres={parametres} setParametres={setParametres} naviguer={naviguer} setChantiers={setChantiers} chantiers={chantiers} contexte={contexte} />}
          {page === 'finances'     && <Finances factures={factures} onSave={setFactures} clients={clients} chantiers={chantiers} devis={devis} paiementsData={paiementsData} setPaiementsData={setPaiementsData} naviguer={naviguer} contexte={contexte} profil={profil} periodeGlobale={periodeGlobale} />}
          {page === 'clients'      && <Clients clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />}
          {page === 'employes'     && <Employes parametres={parametres} setParametres={setParametres} chantiers={chantiers} naviguer={naviguer} />}
          {page === 'planning'    && <PlanningPage chantiers={chantiers} setChantiers={setChantiers} clients={clients} devis={devis} factures={factures} naviguer={naviguer} />}
          {page === 'rapport'     && <RapportsPage chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} qualiteData={qualiteData} periodeGlobale={periodeGlobale} naviguer={naviguer} />}
          {page === 'agents'      && <Agents {...agentState} />}
          {page === 'parametres'  && <Parametres parametres={parametres} setParametres={setParametres} clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />}
                    {page === 'heures'      && <Heures chantiers={chantiers} parametres={parametres} setChantiers={setChantiers} />}
        </main>

        {/* ── MODAL SAISIE HEURES — niveau App (ne re-rend pas Chantiers) ── */}
        {saisieHeuresCtx && (
          <ModalSaisieHeures
            key={saisieHeuresCtx.chantier.id}
            chantierSaisie={saisieHeuresCtx.chantier}
            initialDate={saisieHeuresCtx.date}
            parametres={parametres}
            onFermer={() => setSaisieHeuresCtx(null)}
            onSave={updated => {
              setChantiers(prev => prev.map(ch => ch.id === updated.id ? updated : ch));
              setSaisieHeuresCtx(null);
              naviguer('heures');
            }}
          />
        )}

        {/* ===== NAVIGATION MOBILE BAS ===== */}
        <nav className="bottom-nav">
          {navMobileItems.map(item => (
            <button key={item.id} className={`bottom-nav-item${page === item.id ? ' active' : ''}`} onClick={() => naviguer(item.id)}>
              <span className="bottom-nav-icon"><item.Icon size={22} strokeWidth={1.8} /></span>
              <span className="bottom-nav-label">{item.labelCourt}</span>
            </button>
          ))}
          <button className={`bottom-nav-item${mobileMenuOuvert ? ' active' : ''}`} onClick={() => setMobileMenuOuvert(v => !v)}>
            <span className="bottom-nav-icon">
              {mobileMenuOuvert ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={1.8} />}
            </span>
            <span className="bottom-nav-label">Plus</span>
          </button>
        </nav>

        {/* ===== DRAWER MOBILE ===== */}
        {mobileMenuOuvert && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOuvert(false)}>
            <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-handle" />
              <div className="drawer-header">
                <span>Navigation</span>
                <button onClick={() => setMobileMenuOuvert(false)}><X size={16} /></button>
              </div>
              <div className="drawer-items">
                {navAutorisees.map(item => (
                  <button key={item.id} className={`drawer-item${page === item.id ? ' active' : ''}`}
                    onClick={() => { naviguer(item.id); setMobileMenuOuvert(false); }}>
                    <span className="drawer-item-icon"><item.Icon size={26} strokeWidth={1.7} /></span>
                    <span className="drawer-item-label">{item.labelCourt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Dashboard({ chantiers, clients, factures, devis = [], parametres, naviguer, actionsLog = [], logAction = () => {}, periodeGlobale = 'mois', setPeriodeGlobale = () => {}, profil = null, agentAlertes = [], nbAgentAlertes = 0, agentPredictions = {}, marquerLu = () => {}, naviguerAgents = () => {} }) {
  const facturesSafe = factures || [];
  const [insightsFerme, setInsightsFerme] = useState(false);

  // ── Actifs = tous les chantiers "En cours", sans filtre de période ─
  const actifs = useMemo(() => chantiers.filter(isChantierActif), [chantiers]);

  // ── Factures filtrées par période ────────────────────────────
  const facturesPeriode = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return (factures || []).filter(f => facturesInPeriode(f, debut, fin));
  }, [factures, periodeGlobale]);

  const joursParChantier = useMemo(() => {
    const map = {};
    chantiers.forEach(c => { map[c.id] = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi); });
    return map;
  }, [chantiers]);

  // ── KPI dashboard ────────────────────────────────────────────
  const kpi = useMemo(() => {
    // 1. CA EN COURS — source unique : devis signé lié — chantiers sans devis exclus
    const actifsAvecDevis = actifs.filter(c => calculerCA(c, devis) !== null);
    const caEnCours = actifsAvecDevis.reduce((t, c) => t + calculerCA(c, devis), 0);
    const nbChantiersActifs = actifs.length;
    const nbActifsSansDevis = actifs.length - actifsAvecDevis.length;

    // 2. CASH EN ATTENTE — factures non encaissées
    const cashEnAttente = facturesPeriode
      .filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut))
      .reduce((t, f) => t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);

    // 3. RENTABILITÉ MOYENNE — même moteur que la fiche chantier (coefficient + FG inclus)
    // Exclus : chantiers sans CA, sans coûts réels saisis, ou données incomplètes
    const chantiersRenta = chantiers
      .map(c => calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis))
      .filter(r => r.montantTotal > 0 && r.totalCoutsReel > 0 && !r.donneesIncompletes);
    const rentaMoyenne = chantiersRenta.length > 0
      ? chantiersRenta.reduce((sum, r) => sum + parseFloat(r.margeReelPct), 0) / chantiersRenta.length
      : null;
    const nbChantiersRenta = chantiersRenta.length;

    // 4. HEURES ENGAGÉES — depuis journal (format groupé)
    const heuresEngagees = actifs.reduce((t, c) =>
      t + (c.journal || []).reduce((s, entry) =>
        s + (entry.employes || []).reduce((es, e) => es + (parseFloat(e.heuresTravaillees) || 0), 0)
      , 0)
    , 0);

    const nbFacturesEnAttente = facturesPeriode.filter(f => ['envoyee', 'partielle', 'retard'].includes(f.statut)).length;
    const nbFacturesRetard    = facturesPeriode.filter(f =>
      f.statut === 'retard' || (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    ).length;
    const nbEmployes = actifs.reduce((set, c) => {
      (c.equipe || []).forEach(m => { if (m.employeId) set.add(String(m.employeId)); });
      return set;
    }, new Set()).size;

    return { caEnCours, cashEnAttente, rentaMoyenne, nbChantiersRenta, heuresEngagees, nbFacturesEnAttente, nbFacturesRetard, nbEmployes, nbChantiersActifs, nbActifsSansDevis };
  }, [actifs, facturesPeriode, devis, chantiers, parametres.employes, parametres.localites]);

  // ── Prévision trésorerie 30 jours ───────────────────────────
  const previsionTreso30j = useMemo(() => {
    const chantiersActifsAvecFactures = actifs.map(c => {
      const devisTotal = calculerCA(c, devis);
      if (devisTotal === null) return { id: c.id, nom: c.nom || c.numero, encaissementPrevu: 0 };
      const avancement = Math.max(0, Math.min(100, Math.round(parseFloat(c.avancement) || 0)));
      const montantFacture = (factures || [])
        .filter(f => parseInt(f.chantierId) === c.id)
        .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
      const facturationPotentielle = (avancement / 100) * devisTotal;
      const resteAFacturer = Math.max(0, facturationPotentielle - montantFacture);
      const encaissementPrevu = Math.round(resteAFacturer * 0.5);
      return { id: c.id, nom: c.nom || c.numero, encaissementPrevu };
    }).filter(x => x.encaissementPrevu > 0);
    const total = chantiersActifsAvecFactures.reduce((s, x) => s + x.encaissementPrevu, 0);
    const top3 = [...chantiersActifsAvecFactures].sort((a, b) => b.encaissementPrevu - a.encaissementPrevu).slice(0, 3);
    const seuil = parseFloat(parametres.parametres?.seuilTresorerie) || 20000;
    const charges = parseFloat(parametres.parametres?.chargesMensuelles) || 0;
    const couverture = charges > 0 ? total / charges : null;
    const interpretation = couverture === null ? null
      : couverture < 0.7
        ? { label: 'Trésorerie insuffisante — risque court terme', couleur: C.danger, action: 'Accélérer la facturation ou réduire les dépenses' }
        : couverture < 1
          ? { label: 'Trésorerie juste — vigilance', couleur: C.warning, action: null }
          : { label: 'Trésorerie sécurisée', couleur: C.secondaire, action: null };
    const dateLimite = couverture !== null ? (() => {
      const d = new Date();
      d.setDate(d.getDate() + Math.round(couverture * 30));
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    })() : null;
    return { total, top3, alerteFaible: total < seuil && actifs.length > 0, couverture, interpretation, dateLimite };
  }, [actifs, factures, parametres.parametres, devis]);

  // ── Rentabilité par chantier (calcul complet via calculerCoutsChantier) ─
  const rentaParChantier = useMemo(() => {
    const map = {};
    actifs.forEach(c => {
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      map[c.id] = couts.montantTotal > 0 && couts.totalCoutsReel > 0
        ? Math.round(parseFloat(couts.margeReelPct))
        : null;
    });
    return map;
  }, [actifs, parametres.employes, parametres.localites]);

  // ── Rentabilité réelle par chantier (basé sur jours réalisés) ─
  const rentaReelleParChantier = useMemo(() => {
    const map = {};
    actifs.forEach(c => { map[c.id] = calculerRentabiliteReelle(c, parametres, devis); });
    return map;
  }, [actifs, parametres, devis]);

  // ── KPI rentabilité réelle + écarts prévu/réel ───────────────
  const kpiReel = useMemo(() => {
    const vals = Object.values(rentaReelleParChantier);
    const actives = vals.filter(r => !r.aucuneSaisie);
    // Pour marges : uniquement les chantiers avec devis (montantDevis non null)
    const activesAvecDevis = actives.filter(r => r.montantDevis !== null);
    const nbEnRetard  = actives.filter(r => r.enDepassement).length;
    const ecarts      = actives.map(r => r.joursRealises - r.joursPrevu);
    const moyenneEcartJours = actives.length > 0
      ? parseFloat((ecarts.reduce((s, e) => s + e, 0) / actives.length).toFixed(1))
      : null;
    const margeReelleTotale = activesAvecDevis.reduce((s, r) => s + r.rentabilite, 0);
    const caActifTotal = activesAvecDevis.reduce((s, r) => s + r.montantDevis, 0);
    const margeReellePct = caActifTotal > 0 ? Math.round((margeReelleTotale / caActifTotal) * 100) : null;
    return {
      nbRentables:       actives.filter(r => r.rentabilitePct !== null && r.rentabilitePct >= 15).length,
      nbDepassement:     nbEnRetard,
      nbSansSaisie:      vals.filter(r => r.aucuneSaisie).length,
      margeReelleTotale,
      margeReellePct,
      nbActives:         actives.length,
      moyenneEcartJours,
    };
  }, [rentaReelleParChantier]);

  // ── KPI équipe (Dashboard) — moteur ─────────────────────────
  const kpiEquipe = useMemo(() => {
    const resultsAvecEquipe = actifs
      .map(c => {
        const etatC = calculerEtatChantier(c, parametres.employes, devis);
        const reel = rentaReelleParChantier[c.id];
        return { c, coutMOReel: etatC.coutMOReel, reel };
      })
      .filter(r => r.coutMOReel > 0);

    if (resultsAvecEquipe.length === 0) return null;

    const coutMoyenEquipe = Math.round(
      resultsAvecEquipe.reduce((s, r) => s + r.coutMOReel, 0) / resultsAvecEquipe.length
    );
    const plusCher = resultsAvecEquipe.reduce(
      (max, r) => r.coutMOReel > (max?.coutMOReel || 0) ? r : max, null
    );
    const plusRentable = resultsAvecEquipe
      .filter(r => r.reel && !r.reel.aucuneSaisie && r.reel.montantDevis !== null && r.reel.montantDevis > 0)
      .reduce((max, r) => !max || (r.reel.rentabilitePct ?? -Infinity) > (max.reel.rentabilitePct ?? -Infinity) ? r : max, null);

    return { coutMoyenEquipe, plusCher, plusRentable };
  }, [actifs, parametres, rentaReelleParChantier]);

  // ── Analyse chantiers — "À traiter en priorité" ─────────────
  const analyseChantiers = useMemo(() => {
    const ORDRE = { perte: 0, depassement: 1, faible: 2, non_saisi: 3 };
    return actifs.map(c => {
      const reel = rentaReelleParChantier[c.id];
      const client = clients.find(cl => String(cl.id) === String(c.clientId));
      let statut, probleme, marge, couleur;

      if (!reel || reel.aucuneSaisie) {
        statut = 'non_saisi';
        probleme = 'Aucun jour réalisé saisi';
        marge = null;
        couleur = '#78909c';
      } else if (reel.montantDevis === null) {
        statut = 'non_saisi';
        probleme = 'Aucun devis lié — CA indisponible';
        marge = null;
        couleur = '#78909c';
      } else if (reel.rentabilite !== null && reel.rentabilite < 0) {
        statut = 'perte';
        probleme = `Déficit CHF ${fmtN(Math.abs(Math.round(reel.rentabilite)))}`;
        marge = reel.rentabilitePct;
        couleur = C.danger;
      } else if (reel.enDepassement) {
        statut = 'depassement';
        const surplus = reel.joursRealises - reel.joursPrevu;
        probleme = `Dépassement ${surplus}j réalisé${surplus > 1 ? 's' : ''} (prévu : ${reel.joursPrevu}j)`;
        marge = reel.rentabilitePct;
        couleur = C.warning;
      } else if (reel.rentabilitePct !== null && reel.rentabilitePct < 10) {
        statut = 'faible';
        probleme = `Marge ${reel.rentabilitePct.toFixed(1)}% — sous le seuil cible de 10%`;
        marge = reel.rentabilitePct;
        couleur = C.warning;
      } else {
        return null; // chantier sain → hors liste
      }

      return { c, client, statut, probleme, marge, couleur, reel, ordre: ORDRE[statut] };
    })
    .filter(Boolean)
    .sort((a, b) => a.ordre - b.ordre);
  }, [actifs, rentaReelleParChantier, clients]);

  // ── Alertes ──────────────────────────────────────────────────
  const alertes = useMemo(() => {
    const list = [];

    // Retards chantier
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      if (j !== null && j < 0) {
        {
          const absEffectif = Math.abs(j);
          const dateFin = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi);
          const dateFinStr = dateFin ? new Date(dateFin).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) : null;
          list.push({
            id: `retard-${c.id}`,
            message: `${c.nom || c.numero} — retard de ${absEffectif} jour${absEffectif > 1 ? 's' : ''}${dateFinStr ? ` · fin prévue dépassée (${dateFinStr})` : ''}`,
            page: 'chantiers', ctx: { chantierActif: c.id },
            critique: absEffectif > 7,
          });
        }
      }
    });

    // Chantiers non rentables (calcul complet)
    actifs.forEach(c => {
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      const { montantTotal, totalCoutsReel, margeReel, margeReelPct } = couts;
      if (montantTotal > 0 && totalCoutsReel > 0) {
        const pct = parseFloat(margeReelPct);
        if (pct < 15) {
          const s = statutRentabilite(pct);
          const detail = margeReel < 0
            ? `déficit CHF ${fmtN(Math.abs(Math.round(margeReel)))}`
            : `marge ${pct.toFixed(1)}%`;
          list.push({
            id: `nonrentable-${c.id}`,
            message: `${c.nom || c.numero} — ${s.label} · ${detail}`,
            page: 'chantiers', ctx: { chantierActif: c.id },
            critique: margeReel < 0,
          });
        }
      }
    });

    // Factures en retard
    const fRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    if (fRetard.length > 0) {
      const montant = fRetard.reduce((t, f) =>
        t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
      list.push({
        id: 'factures-retard',
        message: `${fRetard.length} facture${fRetard.length > 1 ? 's' : ''} en retard · CHF ${fmtN(montant)} à encaisser`,
        page: 'finances', ctx: {},
        critique: false,
      });
    }

    // Dépassement de jours réalisés vs prévus
    actifs.forEach(c => {
      const r = rentaReelleParChantier[c.id];
      if (!r || r.aucuneSaisie || !r.enDepassement) return;
      const surplus = r.joursRealises - r.joursPrevu;
      // Ne pas dupliquer si déjà une alerte retard-date pour ce chantier
      if (list.some(a => a.id === `retard-${c.id}`)) return;
      list.push({
        id: `depassement-jours-${c.id}`,
        message: `${c.nom || c.numero} — ${surplus}j de plus que prévu (${r.joursRealises}j réalisés / ${r.joursPrevu}j prévus)`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: r.joursPrevu > 0 && surplus > Math.max(1, Math.round(r.joursPrevu * 0.2)),
      });
    });

    // Chantier sans saisie de jours réalisés, démarré depuis > 3 jours
    actifs.forEach(c => {
      const r = rentaReelleParChantier[c.id];
      if (!r || !r.aucuneSaisie || !c.dateDebut) return;
      const joursDemarre = Math.floor((Date.now() - new Date(c.dateDebut)) / 86400000);
      if (joursDemarre < 3) return;
      list.push({
        id: `sans-saisie-${c.id}`,
        message: `${c.nom || c.numero} — aucun jour réalisé saisi (démarré il y a ${joursDemarre}j)`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: false,
      });
    });

    // Chantiers avec devis mais statut ≠ En cours (CA non comptabilisé)
    const STATUTS_CLOS = ['Terminé', 'Facturé', 'Clôturé'];
    chantiers.filter(c => c.devisId && !isChantierActif(c) && !STATUTS_CLOS.includes(c.statut)).forEach(c => {
      list.push({
        id: `devis-inactif-${c.id}`,
        message: `${c.nom || c.numero} — devis lié mais statut "${c.statut}" · CA non comptabilisé`,
        page: 'chantiers', ctx: { chantierActif: c.id },
        critique: false,
      });
    });

    return list.sort((a, b) => (b.critique ? 1 : 0) - (a.critique ? 1 : 0));
  }, [actifs, joursParChantier, facturesSafe, parametres, rentaReelleParChantier, devis, chantiers]);

  // ── Couleur état chantier ────────────────────────────────────
  const couleurEtat = (c) => {
    const j = joursParChantier[c.id];
    const r = rentaParChantier[c.id];
    const retardInterne = j !== null && j < 0 && !estRetardJustifie(c);
    if (retardInterne || (r !== null && r < 0)) return C.danger;
    if ((j !== null && j < 3) || (r !== null && r < 10)) return C.warning;
    return C.secondaire;
  };

  // ── Priorité chantier ────────────────────────────────────────
  // Retourne { niveau: 'critique'|'attention'|'ok', score: 0|1|2 }
  const calculerPriorite = (c) => {
    const j = joursParChantier[c.id];
    const r = rentaParChantier[c.id];
    const reel = rentaReelleParChantier[c.id];
    const retardJ = j !== null && j < 0 && !estRetardJustifie(c) ? Math.abs(j) : 0;
    const avancement = parseFloat(c.avancement) || 0;
    const aCommence = !!c.dateDebut && new Date(c.dateDebut) <= new Date();

    // Critique : retard interne > 5j OU rentabilité négative OU dépassement > 20% des jours OU marge réelle négative
    const depassementCritique = reel && reel.enDepassement && reel.joursPrevu > 0 &&
      (reel.joursRealises - reel.joursPrevu) > Math.max(1, Math.round(reel.joursPrevu * 0.2));
    if (retardJ > 5 || (r !== null && r < 0) || depassementCritique ||
        (reel && !reel.aucuneSaisie && reel.rentabilite < 0))
      return { niveau: 'critique', score: 2 };

    // Attention : retard interne 1-5j OU renta < 10% OU avancement faible OU dépassement jours OU faible marge réelle
    if (retardJ >= 1 || (r !== null && r < 10) || (aCommence && avancement < 20) ||
        (reel && reel.enDepassement) || (reel && !reel.aucuneSaisie && reel.rentabilitePct < 15))
      return { niveau: 'attention', score: 1 };

    return { niveau: 'ok', score: 0 };
  };

  const PRIORITE_BADGE = {
    critique: { label: 'Critique',    bg: 'rgba(239,68,68,0.12)',  color: C.danger,     border: 'rgba(239,68,68,0.28)' },
    attention: { label: 'À surveiller', bg: 'rgba(245,158,11,0.12)', color: C.warning,    border: 'rgba(245,158,11,0.28)' },
    ok:        { label: 'OK',           bg: 'rgba(16,185,129,0.12)', color: C.secondaire, border: 'rgba(16,185,129,0.28)' },
  };

  // Calculé une seule fois, partagé par les deux sections pour garantir l'exclusivité
  const top3 = [...actifs]
    .sort((a, b) => calculerPriorite(b).score - calculerPriorite(a).score)
    .filter(c => calculerPriorite(c).niveau !== 'ok')
    .slice(0, 3);
  const top3Ids = new Set(top3.map(c => c.id));

  // ── Actions recommandées ─────────────────────────────────────
  const actionsRecommandees = (() => {
    const list = [];

    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;

      if (r !== null && r < 0) {
        list.push({ id: `urgence-${c.id}`, nom: c.nom || c.numero, action: 'Chantier à perte — analyser les coûts', btnLabel: 'Urgence', btnCouleur: C.danger, Icon: AlertTriangle, page: 'chantiers', ctx: { chantierActif: c.id }, score: 4, type: 'urgence' });
      } else if (retardJ > 3) {
        list.push({ id: `ressource-${c.id}`, nom: c.nom || c.numero, action: 'Retard important — ajouter des ressources', btnLabel: 'Voir chantier', btnCouleur: C.warning, Icon: Plus, page: 'chantiers', ctx: { chantierActif: c.id }, score: 3, type: 'ressource' });
      } else if (r !== null && r >= 0 && r < 10) {
        list.push({ id: `marge-${c.id}`, nom: c.nom || c.numero, action: 'Marge faible — vérifier les coûts', btnLabel: 'Analyser', btnCouleur: C.primaire, Icon: TrendingUp, page: 'chantiers', ctx: { chantierActif: c.id }, score: 2, type: 'analyse' });
      }
    });

    // Factures en retard → relancer client (une action groupée)
    const fRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    if (fRetard.length > 0) {
      list.push({ id: 'relance-factures', nom: `${fRetard.length} facture${fRetard.length > 1 ? 's' : ''} en retard`, action: 'Relancer le client', btnLabel: 'Relancer', btnCouleur: C.violet, Icon: CreditCard, page: 'finances', ctx: {}, score: 3, type: 'relance', factureIds: fRetard.map(f => f.id) });
    }

    return list.sort((a, b) => b.score - a.score).slice(0, 5);
  })();

  // ── À ne pas oublier ─────────────────────────────────────────
  const aNesPasOublier = (() => {
    const list = [];
    const now = Date.now();

    // 1. Factures en retard sans relance depuis > 7 jours
    const facturesEnRetard = facturesSafe.filter(f =>
      f.statut === 'retard' ||
      (f.statut === 'envoyee' && f.dateEcheance && new Date(f.dateEcheance) < new Date())
    );
    const facsSansRelance = facturesEnRetard.filter(f => {
      const derniere = actionsLog
        .filter(a => a.type === 'relance' && (a.factureIds || []).includes(f.id))
        .sort((a, b) => b.date - a.date)[0];
      return !derniere || Math.floor((now - derniere.date) / 86400000) > 7;
    });
    if (facsSansRelance.length > 0) {
      const montant = facsSansRelance.reduce((t, f) =>
        t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
      list.push({
        id: 'factures-sans-relance',
        nom: `${facsSansRelance.length} facture${facsSansRelance.length > 1 ? 's' : ''} en retard`,
        probleme: `Aucune relance depuis > 7 jours · CHF ${fmtN(montant)}`,
        btnLabel: 'Relancer', btnCouleur: C.violet, page: 'finances', ctx: {}, score: 4,
      });
    }

    // 2. Chantier actif sans aucune action depuis > 14 jours
    actifs.forEach(c => {
      if (!c.dateDebut) return;
      const joursDemarre = Math.floor((now - new Date(c.dateDebut)) / 86400000);
      if (joursDemarre < 7) return;
      const derniere = actionsLog.filter(a => a.chantierId === c.id).sort((a, b) => b.date - a.date)[0];
      const joursInactivite = derniere ? Math.floor((now - derniere.date) / 86400000) : joursDemarre;
      if (joursInactivite > 14) {
        list.push({
          id: `inactivite-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `Aucune action depuis ${joursInactivite} jour${joursInactivite > 1 ? 's' : ''}`,
          btnLabel: 'Voir', btnCouleur: C.primaire, page: 'chantiers', ctx: { chantierActif: c.id }, score: 1,
        });
      }
    });

    // 3. Action récente (≤ 5 jours) mais problème toujours présent
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
      const actionRecente = actionsLog
        .filter(a => a.chantierId === c.id && Math.floor((now - a.date) / 86400000) <= 5)
        .sort((a, b) => b.date - a.date)[0];
      if (!actionRecente) return;
      const problemePersiste =
        (retardJ > 3 && actionRecente.type === 'ressource') ||
        (r !== null && r < 0 && actionRecente.type === 'urgence');
      if (problemePersiste) {
        list.push({
          id: `persistant-${c.id}`,
          nom: c.nom || c.numero,
          probleme: 'Action effectuée mais problème toujours présent',
          btnLabel: 'Analyser', btnCouleur: C.warning, page: 'chantiers', ctx: { chantierActif: c.id }, score: 3,
        });
      }
    });

    // 4. Devis envoyé sans réponse > 14 jours
    devis.filter(d => d.statut === 'Envoyé' && !d.chantierId).forEach(d => {
      const joursAttente = Math.floor((now - new Date(d.dateEmission || d.date || 0)) / 86400000);
      if (joursAttente > 14) {
        list.push({
          id: `devis-attente-${d.id}`,
          nom: d.numero || 'Devis',
          probleme: `Sans réponse depuis ${joursAttente} jour${joursAttente > 1 ? 's' : ''}`,
          btnLabel: 'Relancer', btnCouleur: C.primaire, page: 'devis', ctx: {}, score: 2,
        });
      }
    });

    return list.sort((a, b) => b.score - a.score).slice(0, 5);
  })();

  // ── À anticiper ──────────────────────────────────────────────
  const aAnticiper = (() => {
    const list = [];
    const now = new Date();

    // 1. Chantier proche du retard : ≤ 3 jours restants et avancement < 80%
    actifs.forEach(c => {
      const j = joursParChantier[c.id];
      const avancement = parseFloat(c.avancement) || 0;
      if (j !== null && j >= 0 && j <= 3 && avancement < 80) {
        list.push({
          id: `proche-retard-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `${j === 0 ? 'Dernier jour' : `${j}j restant${j > 1 ? 's' : ''}`} · avancement ${avancement}%`,
          btnLabel: 'Voir', btnCouleur: C.warning,
          page: 'chantiers', ctx: { chantierActif: c.id }, score: 3 - j,
        });
      }
    });

    // 2. Rentabilité en danger : coûts > 80% du devis, chantier non terminé
    actifs.forEach(c => {
      const ca = calculerCA(c, devis);
      const cout = (parseFloat(c.materielReel) || parseFloat(c.coutMaterielReel) || 0)
        + (parseFloat(c.sousTraitanceReelle) || parseFloat(c.coutSousTraitanceReel) || 0)
        + (parseFloat(c.autresCoutsReels) || parseFloat(c.autresCoutsReel) || 0);
      if (ca > 0 && cout > ca * 0.8 && cout <= ca) {
        const margePct = Math.round((ca - cout) / ca * 100);
        list.push({
          id: `renta-danger-${c.id}`,
          nom: c.nom || c.numero,
          probleme: `Coûts à ${Math.round(cout / ca * 100)}% du devis · marge restante ${margePct}%`,
          btnLabel: 'Analyser', btnCouleur: C.warning,
          page: 'chantiers', ctx: { chantierActif: c.id }, score: 2,
        });
      }
    });

    // 3. Facture dont l'échéance arrive dans ≤ 3 jours
    facturesSafe
      .filter(f => ['envoyee', 'partielle'].includes(f.statut) && f.dateEcheance)
      .forEach(f => {
        const joursAvantEcheance = Math.floor((new Date(f.dateEcheance) - now) / 86400000);
        if (joursAvantEcheance >= 0 && joursAvantEcheance <= 3) {
          const restant = Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0));
          list.push({
            id: `echeance-${f.id}`,
            nom: f.numero || 'Facture',
            probleme: `Échéance ${joursAvantEcheance === 0 ? "aujourd'hui" : `dans ${joursAvantEcheance}j`} · CHF ${fmtN(restant)}`,
            btnLabel: 'Suivre', btnCouleur: C.primaire,
            page: 'finances', ctx: {}, score: 3 - joursAvantEcheance,
          });
        }
      });

    return list.sort((a, b) => b.score - a.score).slice(0, 3);
  })();

  // ── Risque futur (pré-calculé pour réutilisation dans JSX) ───
  const risqueFuturData = (() => {
    const evaluerRisque = (c) => {
      if (top3Ids.has(c.id)) return null;
      const j = joursParChantier[c.id];
      const r = rentaParChantier[c.id];
      const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
      const joursRestants = j !== null && j >= 0 ? j : null;
      const avancement = parseFloat(c.avancement) || 0;
      const aCommence = !!c.dateDebut && new Date(c.dateDebut) <= new Date();
      const raisons = [];
      let score = 0;
      if (retardJ >= 1 && retardJ <= 3) { raisons.push('léger retard'); score += 3; }
      else if (joursRestants !== null && joursRestants <= 3) { raisons.push('fin imminente'); score += 2; }
      if (r !== null && r >= 0 && r < 10) { raisons.push('marge faible'); score += 2; }
      if (aCommence && avancement < 30) { raisons.push('avancement lent'); score += 1; }
      return raisons.length > 0 ? { score, raisons } : null;
    };
    return actifs.map(c => ({ c, risque: evaluerRisque(c) })).filter(({ risque }) => risque !== null).sort((a, b) => b.risque.score - a.risque.score).slice(0, 3);
  })();

  // ── Chart data : aperçu financier (4 dernières semaines) ──
  const donneesMensuelles = useMemo(() => {
    const now = new Date();
    const totalCoutsActifs = actifs.reduce((sum, c) => {
      const r = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      return sum + (r.totalCoutsReel || 0);
    }, 0);
    const coutsParSemaine = Math.round(totalCoutsActifs / 4);
    return Array.from({ length: 4 }, (_, i) => {
      const w = 4 - i;
      const deb = new Date(now); deb.setDate(now.getDate() - w * 7);
      const fin = new Date(now); fin.setDate(now.getDate() - (w - 1) * 7);
      const ca = (factures || []).filter(f => { const d = f.dateEmission ? new Date(f.dateEmission) : null; return d && d >= deb && d < fin; })
        .reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
      return { semaine: deb.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }), CA: Math.round(ca), Couts: coutsParSemaine };
    });
  }, [factures, actifs, parametres, devis]);

  // ── Répartition des coûts (donut) ──────────────────────────
  const repartitionCouts = useMemo(() => {
    let mo = 0, mat = 0, st = 0, dep = 0, autres = 0;
    actifs.forEach(c => {
      const r = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
      mo += r.coutEquipeReel || 0;
      mat += r.coutMaterielReel || 0;
      st += r.coutSousTraitanceReel || 0;
      dep += r.coutDeplacement || 0;
      autres += r.autresCoutsReel || 0;
    });
    const total = mo + mat + st + dep + autres;
    if (total === 0) return { total: 0, segments: [] };
    return { total, segments: [
      { name: "Main d'œuvre", value: (mo / total) * 100, couleur: '#3b82f6' },
      { name: 'Matériaux',    value: (mat / total) * 100, couleur: '#8b5cf6' },
      { name: 'Sous-traitance', value: (st / total) * 100, couleur: '#10b981' },
      { name: 'Déplacement',  value: (dep / total) * 100, couleur: '#f59e0b' },
      { name: 'Autres',       value: (autres / total) * 100, couleur: '#94a3b8' },
    ].filter(s => s.value > 0.5) };
  }, [actifs, parametres, devis]);

  // ── Avancement moyen global ─────────────────────────────────
  const avancementMoyen = useMemo(() =>
    actifs.length === 0 ? 0 : actifs.reduce((s, c) => s + (parseFloat(c.avancement) || 0), 0) / actifs.length
  , [actifs]);

  const BADGE_STATUT_DASH = {
    ok:       { label: 'Rentable',  bg: '#D1FAE5', color: '#065F46' },
    attention:{ label: 'Attention', bg: '#FEF3C7', color: '#92400E' },
    critique: { label: 'Danger',    bg: '#FEE2E2', color: '#991B1B' },
  };

  // ── Helpers JSX (conservés pour compatibilité) ──────────────
  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 3, height: 12, borderRadius: 2, background: '#2563eb', flexShrink: 0, display: 'inline-block' }} />
      {children}
    </div>
  );

  const ActionRow = ({ nom, texte, btnLabel, btnCouleur, onAction, Icon: RowIcon }) => (
    <div
      onClick={onAction}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, marginBottom: 6, background: 'var(--bg-glass)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {RowIcon && <RowIcon size={14} strokeWidth={1.8} style={{ color: btnCouleur, flexShrink: 0 }} />}
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flexShrink: 0 }}>{nom}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texte}</span>
      <button
        onClick={e => { e.stopPropagation(); onAction(); }}
        style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.2s ease', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.32) 0%, rgba(99,102,241,0.24) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.3), 0 0 0 1px rgba(59,130,246,0.5)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(99,102,241,0.14) 100%)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'; }}
      >{btnLabel}</button>
    </div>
  );

  const CARD = { background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--ds-card-shadow)' };

  return (
    <div>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Bonjour{profil ? ` ${profil.nom.split(' ')[0]}` : ''}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} · {actifs.length} chantier{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '3px' }}>
            {[{ id: 'semaine', label: 'Semaine' }, { id: 'mois', label: 'Mois' }, { id: 'annee', label: 'Année' }].map(p => (
              <button key={p.id} onClick={() => setPeriodeGlobale(p.id)}
                style={{ background: periodeGlobale === p.id ? '#2563eb' : 'transparent', border: 'none', color: periodeGlobale === p.id ? '#fff' : 'var(--text-muted)', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit' }}
              >{p.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={naviguerAgents} title="Alertes Agents IA" style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: nbAgentAlertes > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
              <Bell size={16} strokeWidth={2} />
            </button>
            {nbAgentAlertes > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{nbAgentAlertes}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "CA en cours", Icon: DollarSign, page: 'devis',
            valeur: `CHF ${fmtN(kpi.caEnCours)}`,
            sous: kpi.nbChantiersActifs > 0 ? `${kpi.nbChantiersActifs} chantier${kpi.nbChantiersActifs !== 1 ? 's' : ''} en cours · devis signés` : 'Aucun chantier en cours',
            ...DS.kpi.blue },
          { label: 'Marge moyenne', Icon: TrendingUp, page: 'analyse',
            valeur: kpi.rentaMoyenne !== null ? `${Math.round(kpi.rentaMoyenne)}%` : '—',
            sous: kpi.nbChantiersRenta > 0 ? `${kpi.nbChantiersRenta} chantier${kpi.nbChantiersRenta > 1 ? 's' : ''} analysé${kpi.nbChantiersRenta > 1 ? 's' : ''}` : 'Aucun coût saisi',
            ...(kpi.rentaMoyenne === null || kpi.rentaMoyenne >= 15 ? DS.kpi.green : kpi.rentaMoyenne >= 0 ? DS.kpi.amber : DS.kpi.red) },
          { label: 'Chantiers actifs', Icon: HardHat, page: 'chantiers',
            valeur: `${kpi.nbChantiersActifs}`,
            sous: kpiReel.nbDepassement > 0 ? `${kpiReel.nbDepassement} en retard` : 'Tous dans les temps',
            ...DS.kpi.amber,
            badge: kpiReel.nbDepassement > 0 ? `${kpiReel.nbDepassement} en retard` : null },
          { label: 'Heures ce mois', Icon: Clock, page: 'heures',
            valeur: kpi.heuresEngagees > 0 ? `${fmtN(kpi.heuresEngagees)}h` : '—',
            sous: kpi.nbEmployes > 0 ? `${kpi.nbEmployes} employé${kpi.nbEmployes > 1 ? 's' : ''} mobilisé${kpi.nbEmployes > 1 ? 's' : ''}` : 'Équipes non renseignées',
            ...DS.kpi.purple },
        ].map(({ label, Icon, page: dest, valeur, sous, gradient, glow, badge }) => (
          <div key={label} onClick={() => naviguer(dest)}
            style={{ background: gradient, borderRadius: 16, padding: '22px 20px', minHeight: 130, cursor: 'pointer', boxShadow: `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', transition: 'transform 0.18s, box-shadow 0.18s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 30px ${glow}, 0 2px 8px rgba(0,0,0,0.18)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`; }}
          >
            <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
              <Icon size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>{valeur}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 500 }}>{sous}</span>
              {badge && <span style={{ background: 'rgba(239,68,68,0.85)', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── LIGNE 2 : CHANTIERS · FINANCIER · ALERTES ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 0.75fr', gap: 16, marginBottom: 20 }}>

        {/* ── COLONNE GAUCHE : Mes chantiers ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Mes chantiers</div>
            <button onClick={() => naviguer('chantiers')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>Voir tous →</button>
          </div>
          {actifs.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', padding: '24px 0' }}>Aucun chantier actif</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...actifs].sort((a, b) => calculerPriorite(b).score - calculerPriorite(a).score).slice(0, 3).map(c => {
                  const priorite = calculerPriorite(c);
                  const statBadge = BADGE_STATUT_DASH[priorite.niveau];
                  const montantCA = calculerCA(c, devis);
                  const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
                  const progress = Math.max(0, Math.min(100, Number(c.avancement ?? 0)));
                  const j = joursParChantier[c.id];
                  const retardJ = j !== null && j < 0 ? Math.abs(j) : 0;
                  const barCol = retardJ > 0 ? '#ef4444' : priorite.niveau === 'ok' ? '#10b981' : '#f59e0b';
                  const mPct = couts.montantTotal > 0 && couts.totalCoutsReel > 0 ? Math.round(parseFloat(couts.margeReelPct)) : null;
                  return (
                    <div key={c.id} onClick={() => naviguer('chantiers', { chantierActif: c.id })}
                      style={{ padding: '14px', borderRadius: 12, border: '1px solid var(--dash-border)', cursor: 'pointer', background: 'var(--bg-glass)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dash-border)'; e.currentTarget.style.background = 'var(--bg-glass)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom || c.numero}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[c.ville, c.canton].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span style={{ background: statBadge.bg, color: statBadge.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{statBadge.label}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'CA', val: montantCA ? `CHF ${fmtN(montantCA)}` : '—' },
                          { label: 'Coût', val: couts.totalCoutsReel > 0 ? `CHF ${fmtN(Math.round(couts.totalCoutsReel))}` : '—' },
                          { label: 'Marge', val: mPct !== null ? `${mPct}%` : '—', couleur: mPct !== null ? (mPct >= 15 ? '#10b981' : mPct >= 0 ? '#f59e0b' : '#ef4444') : undefined },
                        ].map(m => (
                          <div key={m.label} style={{ background: 'var(--bg-glass-2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: m.couleur || 'var(--text-primary)' }}>{m.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: 'var(--bg-hover)', borderRadius: 6, height: 5, overflow: 'hidden', marginBottom: 7 }}>
                        <div style={{ background: barCol, width: `${progress}%`, height: '100%', borderRadius: 6, transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.nombreJours ? `${progress}% · ${c.nombreJours}j prévus` : `${progress}% d'avancement`}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: retardJ > 0 ? '#ef4444' : j === 0 ? '#f59e0b' : '#10b981' }}>
                          {retardJ > 0 ? `En retard ${retardJ}j` : j === 0 ? "Fin aujourd'hui" : j !== null ? `${j}j restants` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* ── COLONNE CENTRE : Aperçu financier ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Aperçu financier</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px' }}>4 dernières semaines</span>
          </div>
          {donneesMensuelles.some(d => d.CA > 0 || d.Couts > 0) ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={donneesMensuelles} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semaine" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} formatter={(val, name) => [`CHF ${fmtN(val)}`, name]} />
                <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} name="Chiffre d'affaires" />
                <Line type="monotone" dataKey="Couts" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8' }} strokeDasharray="5 3" name="Coûts estimés" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée disponible</div>
          )}
          <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
            {[['#3b82f6', "Chiffre d'affaires"], ['#94a3b8', 'Coûts estimés']].map(([col, lbl]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 20, height: 2.5, background: col, borderRadius: 2, display: 'inline-block' }} />{lbl}
              </div>
            ))}
          </div>
        </div>

        {/* ── COLONNE DROITE : Alertes agents IA ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Bot size={15} strokeWidth={2} style={{ color: '#8b5cf6' }} />
              Alertes intelligentes
            </div>
            <button onClick={naviguerAgents} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>Tout voir →</button>
          </div>
          {agentAlertes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <CheckCircle size={28} strokeWidth={1.5} style={{ color: '#10b981', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              Aucune alerte active
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 340, overflowY: 'auto' }}>
              {agentAlertes.slice(0, 7).map((a) => {
                const DOTS = { DANGER: '#EF4444', CRITIQUE: '#ef4444', ATTENTION: '#F59E0B', INFO: '#3B82F6' };
                const dot = DOTS[a.niveau] || '#3B82F6';
                const handleClick = () => { marquerLu(a.id); if (a.action?.page) naviguer(a.action.page, a.action.ctx); else naviguerAgents(); };
                return (
                  <div key={a.id} onClick={handleClick}
                    style={{ padding: '9px 11px', borderRadius: 10, border: `1px solid ${a.lu ? 'var(--dash-border)' : dot + '40'}`, cursor: 'pointer', background: a.lu ? 'var(--bg-glass)' : dot + '08', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 9 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = dot; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = a.lu ? 'var(--dash-border)' : dot + '40'; e.currentTarget.style.background = a.lu ? 'var(--bg-glass)' : dot + '08'; }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: a.lu ? 500 : 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                      {a.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</div>}
                    </div>
                    <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── LIGNE 3 : RÉPARTITION COÛTS · AVANCEMENT · ACTIVITÉ ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* Répartition des coûts (donut) */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Répartition des coûts</div>
          {repartitionCouts.total > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={156} height={156}>
                  <Pie data={repartitionCouts.segments} cx={78} cy={78} innerRadius={48} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {repartitionCouts.segments.map((entry, i) => <Cell key={i} fill={entry.couleur} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 8, fontSize: 11 }} formatter={v => [`${v.toFixed(0)}%`, '']} />
                </PieChart>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                {repartitionCouts.segments.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.couleur, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucun coût saisi</div>
          )}
        </div>

        {/* Avancement global (circle progress) */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20, width: '100%' }}>Avancement global</div>
          {actifs.length > 0 ? (
            <>
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 20 }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="58" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="70" cy="70" r="58" fill="none" stroke="#3b82f6" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 58}`}
                    strokeDashoffset={`${2 * Math.PI * 58 * (1 - avancementMoyen / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{Math.round(avancementMoyen)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase' }}>moy.</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {[
                  { label: 'En avance', count: kpiReel.nbRentables, dot: '#10b981' },
                  { label: 'Dans les temps', count: Math.max(0, actifs.length - kpiReel.nbDepassement - kpiReel.nbSansSaisie), dot: '#3b82f6' },
                  { label: 'En retard', count: kpiReel.nbDepassement, dot: '#ef4444' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{l.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Aucun chantier actif</div>
          )}
        </div>

        {/* Activité récente */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Activité récente</div>
          {actionsLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>Aucune action enregistrée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actionsLog.slice(0, 5).map((a) => {
                const typeConf = { urgence: { I: AlertTriangle, c: '#ef4444' }, ressource: { I: Users, c: '#f59e0b' }, relance: { I: Bell, c: '#8b5cf6' }, analyse: { I: TrendingUp, c: '#3b82f6' } };
                const tc = typeConf[a.type] || { I: CheckCircle, c: '#10b981' };
                const AIcon = tc.I;
                const joursDiff = Math.floor((Date.now() - a.date) / 86400000);
                const timeLabel = joursDiff === 0 ? "Aujourd'hui" : joursDiff === 1 ? 'Hier' : `il y a ${joursDiff}j`;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: tc.c + '18', border: `1px solid ${tc.c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AIcon size={14} strokeWidth={2} style={{ color: tc.c }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label || a.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{timeLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── IA INSIGHTS BAR ──────────────────────────────────────── */}
      {!insightsFerme && previsionTreso30j.interpretation && (
        <div style={{ background: previsionTreso30j.interpretation.couleur + '10', border: `1px solid ${previsionTreso30j.interpretation.couleur}22`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: previsionTreso30j.interpretation.couleur + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={16} strokeWidth={2} style={{ color: previsionTreso30j.interpretation.couleur }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>IA Insights</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {previsionTreso30j.interpretation.label}{previsionTreso30j.dateLimite && ` · Couverture jusqu'au ${previsionTreso30j.dateLimite}`}
            </div>
          </div>
          <button onClick={() => naviguer('finances')}
            style={{ background: previsionTreso30j.interpretation.couleur, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Voir les détails
          </button>
          <button onClick={() => setInsightsFerme(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>
            ×
          </button>
        </div>
      )}

    </div>
  );
}


// ── Helpers de rendu pour la vue détail chantier ───────────────────────────
// Fonctions nommées (pas d'IIFEs) — retournent du JSX, n'utilisent pas de hooks
function renderTerrainVelocity(c, etat) {
  const v = calculerVitesseChantier(c, etat);
  if (!v) return null;
  const gravite = v.retardEstime >= 5 ? 'critique' : v.retardEstime >= 2 ? 'attention' : 'ok';
  const graviteConfig = {
    critique:  { niveau: 'danger', couleur: C.danger,     titre: `+${v.retardEstime} jours de retard — action nécessaire` },
    attention: { niveau: 'warning', couleur: C.warning,    titre: `+${v.retardEstime} jour${v.retardEstime > 1 ? 's' : ''} de retard — action recommandée` },
    ok:        { niveau: 'ok', couleur: C.secondaire, titre: 'Dans les temps' },
  }[gravite];
  let reco = null;
  let impact = null;
  if (gravite === 'critique' || gravite === 'attention') {
    if (v.gainJours > 0) {
      reco = `→ Ajouter 1 ouvrier pendant quelques jours`;
      impact = v.nouveauRetard <= 1 ? 'Permet de revenir dans les délais' : `Permet de réduire le retard à ~${v.nouveauRetard} j`;
    } else {
      reco = `→ Revoir le planning ou étendre la durée`;
      impact = 'Rattrapage nécessaire sans renfort disponible';
    }
  } else {
    reco = '→ Surveiller — rattrapage possible sans action';
  }
  return (
    <div style={{ padding: '16px 20px', borderRadius: 14, marginBottom: 16,
      background: graviteConfig.couleur === C.secondaire
        ? `radial-gradient(ellipse at 6% 50%, ${C.secondaire}0d 0%, transparent 80%)`
        : `radial-gradient(ellipse at 6% 50%, ${graviteConfig.couleur}0f 0%, transparent 80%)`,
      border: `1px solid ${graviteConfig.couleur}30`, borderLeft: `4px solid ${graviteConfig.couleur}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: reco ? 12 : 0 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{graviteConfig.icone}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: graviteConfig.couleur, letterSpacing: '-0.2px' }}>{graviteConfig.titre}</span>
      </div>
      {reco && (
        <div style={{ paddingLeft: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: impact ? 4 : 0 }}>{reco}</div>
          {impact && <div style={{ fontSize: 12, color: graviteConfig.couleur, fontWeight: 600 }}>{impact}</div>}
        </div>
      )}
    </div>
  );
}

function renderProjectionCard(etat, fmtK) {
  const urgence = etat.margeEstimeePct === null ? 'ok'
    : etat.margeEstimeePct < 0 ? 'critique'
    : etat.margeEstimeePct <= 10 ? 'surveillance'
    : 'ok';
  const urgenceConfig = {
    critique:     { couleur: C.danger,     decision: 'Perte estimée — action immédiate' },
    surveillance: { couleur: C.warning,    decision: 'Surveiller de près' },
    ok:           { couleur: C.secondaire, decision: 'Chantier maîtrisé' },
  }[urgence];
  const fiab = etat.avancementPct < 40
    ? { label: 'Projection à confirmer', couleur: C.warning }
    : { label: 'Projection fiable', couleur: C.secondaire };
  const margeVal = etat.margeEstimee ?? 0;
  const margePct = etat.margeEstimeePct ?? 0;
  return (
    <div style={{ ...carteStyle, borderLeft: `4px solid ${urgenceConfig.couleur}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Projection à terminaison</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', borderRadius: 20, padding: '3px 10px' }}>{etat.avancementPct}% réalisé</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: fiab.couleur, background: fiab.couleur + '18', border: `1px solid ${fiab.couleur}40`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{fiab.label}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: urgenceConfig.couleur, letterSpacing: '-0.3px', marginBottom: 16 }}>{urgenceConfig.decision}</div>
        <div style={{ fontSize: 46, fontWeight: 900, color: urgenceConfig.couleur, letterSpacing: '-2px', lineHeight: 1 }}>{margeVal >= 0 ? '+' : '−'}CHF {fmtK(Math.abs(margeVal))}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{margeVal >= 0 ? 'marge estimée' : 'perte estimée'}</div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Coût final estimé&nbsp;<span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14 }}>CHF {fmtK(etat.coutFinalEstime)}</span></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.8 }}>Marge estimée&nbsp;<span style={{ color: margePct >= 15 ? C.secondaire : margePct >= 5 ? C.warning : C.danger, fontWeight: 600 }}>{margePct}%</span></div>
      </div>
    </div>
  );
}

function renderRecommandations(etat, couts) {
  const recommandations = [];
  if (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.85)
    recommandations.push({ icone: '↓', texte: 'Le chantier consomme plus vite qu\'il n\'avance' });
  if (etat.coutTotalReel > 0 && (etat.coutMOReel / etat.coutTotalReel) > 0.6)
    recommandations.push({ icone: 'mo', texte: 'Main d\'œuvre trop élevée — vérifier productivité ou dimensionnement équipe' });
  if (couts.coutMaterielPrevu > 0 && etat.coutMateriel > couts.coutMaterielPrevu * 1.15)
    recommandations.push({ icone: 'mat', texte: 'Dépassement matériel — contrôler commandes ou pertes chantier' });
  const affichees = recommandations.slice(0, 2);
  if (affichees.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
      {affichees.map(r => (
        <div key={r.texte} style={{ background: C.warning + '10', border: `1px solid ${C.warning}35`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{r.icone}</span>
          <span style={{ fontSize: 13, color: C.warning, fontWeight: 600 }}>{r.texte}</span>
        </div>
      ))}
    </div>
  );
}

function renderEcartTable(couts, fmtN) {
  const lignes = [
    { label: 'Main d\'œuvre', prevu: couts.coutEquipePrevu, reel: couts.coutEquipeReel, ecart: couts.ecartEquipe, ecartPct: couts.ecartEquipePct },
    { label: 'Matériel', prevu: couts.coutMaterielPrevu, reel: couts.coutMaterielReel, ecart: couts.ecartMateriel, ecartPct: couts.ecartMaterielPct },
    { label: 'Sous-traitance', prevu: couts.coutSousTraitancePrevu, reel: couts.coutSousTraitanceReel, ecart: couts.ecartSousTraitance, ecartPct: couts.ecartSousTraitancePct },
    { label: 'Autres', prevu: couts.autresCoutsPrevu, reel: couts.autresCoutsReel, ecart: couts.ecartAutres, ecartPct: couts.ecartAutresPct },
  ].filter(l => l.prevu > 0 || l.reel > 0);
  const totalEcart = couts.totalCoutsReel - couts.totalCoutsPrevu;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 8 }}>Écart prévu / réel par poste</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-glass-2)' }}>
              {['Poste', 'Prévu', 'Réel', 'Écart', '%'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Poste' ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => {
              const couleurEcart = l.ecart > 0 ? C.danger : l.ecart < 0 ? C.secondaire : 'var(--text-muted)';
              return (
                <tr key={l.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{l.label}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>CHF {fmtN(l.prevu)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>CHF {fmtN(l.reel)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: couleurEcart }}>{l.ecart > 0 ? '+' : ''}{l.ecart !== 0 ? `CHF ${fmtN(Math.abs(l.ecart))}` : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: couleurEcart }}>{l.ecart > 0 ? '+' : l.ecart < 0 ? '-' : ''}{l.ecart !== 0 ? `${Math.abs(parseFloat(l.ecartPct))}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-glass-2)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>CHF {fmtN(couts.totalCoutsPrevu)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>CHF {fmtN(couts.totalCoutsReel)}</td>
              <td colSpan={2} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: totalEcart > 0 ? C.danger : totalEcart < 0 ? C.secondaire : 'var(--text-muted)' }}>{totalEcart > 0 ? '+' : ''}{totalEcart !== 0 ? `CHF ${fmtN(Math.abs(totalEcart))}` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Rentabilité par jours réalisés ──────────────────────────────────────────
function renderRentabiliteJours(c, etat, couts, naviguer, fmtN, fmtK) {
  const joursPrevu = etat.totalJoursPrevus;
  const joursRealises = etat.totalJoursReels;
  const joursCalRestants = joursOuvrableRestants(c.dateDebut, joursPrevu, c.inclusSamedi);
  const rj = {
    joursPrevu,
    joursRealises,
    joursRestants: joursPrevu - joursRealises,
    enDepassement: joursCalRestants !== null && joursCalRestants < 0,
    enAvance: false,
    aucuneSaisie: joursRealises === 0,
    coutMOPrevu: couts.coutEquipePrevu,
    coutMOReel:  couts.coutEquipeReel,
    autresCouts: (couts.coutMaterielReel || 0) + (couts.coutSousTraitanceReel || 0) + (couts.autresCoutsReel || 0),
    montantDevis: couts.montantTotal,
    totalCoutsReel: Math.round(couts.totalCoutsReel || 0),
    rentabilite: couts.margeReel !== null ? Math.round(couts.margeReel) : null,
    rentabilitePct: couts.margeReelPct !== null ? parseFloat(parseFloat(couts.margeReelPct).toFixed(1)) : null,
    rentabiliteProjetee: etat.projectionDisponible && etat.margeEstimee !== null ? Math.round(etat.margeEstimee) : null,
    rentabiliteProjetee_Pct: etat.projectionDisponible ? etat.margeEstimeePct : null,
  };

  const couleurStatutJours = rj.aucuneSaisie
    ? 'var(--text-muted)'
    : rj.enDepassement
      ? C.danger
      : rj.enAvance
        ? C.secondaire
        : C.warning;

  const labelStatutJours = rj.aucuneSaisie
    ? 'Pas de données'
    : rj.enDepassement
      ? 'Dépassement'
      : 'En cours';

  const couleurRenta = statutRentabilite(rj.rentabilitePct).couleur;

  // Écart KPI — calculé ici pour éviter IIFE dans le .map()
  const ec = rj.aucuneSaisie ? null : calculerEcartChantier(c);
  const ecKpi = {
    label: 'Écart / devis',
    valeur: ec ? (ec.ecartJours === 0 ? '0j' : `${ec.ecartJours > 0 ? '+' : ''}${ec.ecartJours}j`) : '—',
    couleur: !ec ? '#78909c' : ec.ecartJours > 0 ? C.danger : ec.ecartJours < 0 ? C.secondaire : '#78909c',
  };

  // Équipe analysis — calculs extraits en amont
  const membres = etat.equipe || [];
  const nbTotal    = membres.length;
  const nbReel     = membres.filter(m => m.joursReels > 0).length;
  const couverture = nbTotal > 0 ? Math.round((nbReel / nbTotal) * 100) : 0;
  const etatEquipe = nbReel === 0 ? 'vide' : nbReel < nbTotal ? 'partiel' : 'complet';
  const couleurEtat = etatEquipe === 'complet' ? C.secondaire : etatEquipe === 'partiel' ? C.warning : 'var(--text-muted)';
  const titreEtat   = etatEquipe === 'complet' ? 'Coût équipe complet' : etatEquipe === 'partiel' ? 'Coût équipe réel (partiel)' : 'Coût équipe : non démarré';
  const alerteCouverture = etatEquipe === 'partiel'
    ? couverture < 50
      ? { texte: 'Données insuffisantes pour analyse fiable', couleur: C.danger }
      : { texte: 'Analyse partielle — compléter les données', couleur: C.warning }
    : null;

  const membresAffiches = nbTotal > 0 && etatEquipe !== 'vide'
    ? [...membres]
        .filter(m => etatEquipe === 'complet' || m.joursReels > 0)
        .sort((a, b) => b.cout - a.cout)
        .map(m => ({ ...m, partPct: etat.coutMOReel > 0 ? Math.round((m.cout / etat.coutMOReel) * 100) : 0 }))
    : [];
  const totalEquipe = membresAffiches.reduce((s, m) => s + m.cout, 0);

  return (
    <div style={{ ...carteStyle, borderLeft: `4px solid ${couleurStatutJours}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div className="ds-card-title" style={{ margin: 0 }}>Rentabilité par jours réalisés</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: couleurStatutJours, background: couleurStatutJours + '18', border: `1px solid ${couleurStatutJours}35`, borderRadius: 20, padding: '4px 14px' }}>
          {labelStatutJours}
        </span>
      </div>

      {/* Barre de progression jours */}
      {!rj.aucuneSaisie && rj.joursPrevu > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>0 jour</span>
            <span>{rj.joursPrevu} jours prévus</span>
          </div>
          <div style={{ background: 'var(--bg-glass-2)', borderRadius: 8, height: 10, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', borderRadius: 8, transition: 'width 0.4s ease',
              background: rj.enDepassement
                ? `linear-gradient(90deg, ${C.warning}, ${C.danger})`
                : `linear-gradient(90deg, ${C.primaire}, ${C.secondaire})`,
              width: `${Math.min((rj.joursRealises / rj.joursPrevu) * 100, 100)}%`,
            }} />
            {rj.enDepassement && (
              <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${Math.min(((rj.joursRealises - rj.joursPrevu) / rj.joursPrevu) * 100, 30)}%`, background: C.danger + '60', borderRadius: '0 8px 8px 0' }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, textAlign: 'right' }}>
            {rj.joursRealises} jour{rj.joursRealises > 1 ? 's' : ''} réalisé{rj.joursRealises > 1 ? 's' : ''}
            {rj.enDepassement
              ? ` (+${-rj.joursRestants}j de dépassement)`
              : rj.enAvance
                ? ` — ${rj.joursRestants}j restant${rj.joursRestants > 1 ? 's' : ''}`
                : ''}
          </div>
        </div>
      )}

      {/* KPIs jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: rj.aucuneSaisie ? 0 : 16 }}>
        {[
          { label: 'Jours prévus',    valeur: `${rj.joursPrevu}j`,                                              couleur: C.primaire },
          { label: 'Jours réalisés',  valeur: rj.aucuneSaisie ? '—' : `${rj.joursRealises}j`,                  couleur: rj.aucuneSaisie ? '#78909c' : couleurStatutJours },
          ecKpi,
          { label: 'Coût/j équipe',   valeur: rj.coutJournalierEquipe > 0 ? `CHF ${fmtN(rj.coutJournalierEquipe)}` : '—', couleur: C.violet },
        ].map(s => (
          <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
          </div>
        ))}
      </div>

      {/* Rentabilité basée sur les jours */}
      {!rj.aucuneSaisie && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>
            Rentabilité calculée sur les jours réalisés
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'Coût MO réel',     valeur: `CHF ${fmtN(rj.coutMOReel)}`,     couleur: C.warning },
              { label: 'Autres coûts',      valeur: `CHF ${fmtN(rj.autresCouts)}`,    couleur: '#78909c' },
              { label: 'Total coûts réels', valeur: `CHF ${fmtN(rj.totalCoutsReel)}`, couleur: C.danger },
              { label: 'Rentabilité réelle',valeur: `CHF ${fmtN(rj.rentabilite)}`,    couleur: couleurRenta },
              { label: 'Marge réelle (%)',  valeur: `${rj.rentabilitePct}%`,           couleur: couleurRenta },
              ...(rj.rentabiliteProjetee !== null ? [{ label: 'Projection fin chantier', valeur: `CHF ${fmtN(rj.rentabiliteProjetee)}`, couleur: rj.rentabiliteProjetee_Pct >= 15 ? C.secondaire : C.warning }] : []),
            ].map(s => (
              <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rj.aucuneSaisie && (
        <div style={{ textAlign: 'center', padding: '16px 0 4px', color: 'var(--text-muted)', fontSize: 13 }}>
          Saisissez les <strong>jours réalisés</strong> dans le formulaire de modification pour activer ce calcul.
        </div>
      )}

      {/* Analyse équipe */}
      {nbTotal > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: etatEquipe === 'partiel' ? 6 : 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: couleurEtat }}>{titreEtat}</div>
            {etatEquipe === 'complet' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: C.secondaire, background: C.secondaire + '14', border: `1px solid ${C.secondaire}28`, borderRadius: 20, padding: '2px 10px' }}>
                Données complètes — analyse fiable
              </span>
            )}
            {etatEquipe === 'partiel' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: C.warning, background: C.warning + '14', border: `1px solid ${C.warning}28`, borderRadius: 20, padding: '2px 10px' }}>
                Couverture : {nbReel} / {nbTotal} ({couverture}%)
              </span>
            )}
          </div>

          {alerteCouverture && (
            <div style={{ fontSize: 11, fontWeight: 600, color: alerteCouverture.couleur, background: alerteCouverture.couleur + '10', border: `1px solid ${alerteCouverture.couleur}25`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              {alerteCouverture.texte}
            </div>
          )}

          {etatEquipe === 'vide' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-muted)' }}>—</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ajoutez des journées pour activer le suivi réel</span>
            </div>
          )}

          {etatEquipe !== 'vide' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {membresAffiches.map(m => {
                  const barWidth = Math.max(m.partPct, 2);
                  const couleurCout = m.partPct >= 40 ? C.danger : m.partPct >= 25 ? C.warning : C.primaire;
                  return (
                    <div key={m.employeId}
                      onClick={() => naviguer('employes', { employeActif: m.employeId })}
                      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.18s ease, border-color 0.18s ease, transform 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.22)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{m.nom}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.poste}</span>
                          <ChevronRight size={11} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CHF {fmtN(m.tarifJour)}/j × {m.joursReels}j</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: couleurCout }}>CHF {fmtN(m.cout)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: couleurCout + '18', color: couleurCout, border: `1px solid ${couleurCout}30`, borderRadius: 20, padding: '2px 8px' }}>{m.partPct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: `linear-gradient(90deg, ${couleurCout}cc, ${couleurCout}66)`, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: etatEquipe === 'complet' ? 'var(--text-secondary)' : C.warning }}>
                    {etatEquipe === 'complet' ? 'Total équipe' : 'Total partiel'}
                  </span>
                  {etatEquipe === 'complet' && <span style={{ fontSize: 10, color: C.secondaire }}>Basé sur 100% des employés</span>}
                  {etatEquipe === 'partiel' && (
                    <span style={{ fontSize: 10, color: C.warning }}>Basé sur {nbReel} / {nbTotal} employés ({couverture}%)</span>
                  )}
                </div>
                <span
                  title={etatEquipe === 'complet' ? 'Données complètes — calcul fiable' : 'Données basées uniquement sur les employés renseignés'}
                  style={{ fontSize: 15, fontWeight: 900, color: etatEquipe === 'complet' ? C.violet : C.warning }}
                >
                  CHF {fmtN(totalEquipe)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal Saisie des heures ─────────────────────────────────────────────────
// Composant nommé (pas d'IIFE) : identité stable pour React 19 concurrent mode
// État interne : dateSaisie et heuresSaisie vivent DANS le modal
// → chaque interaction ne re-render QUE ce composant, jamais le parent Chantiers
function ModalSaisieHeures({ chantierSaisie, initialDate, onFermer, onSave, parametres }) {
  const [date, setDate] = useState(initialDate);
  const [heures, setHeures] = useState(() => heuresJour(chantierSaisie.journal || [], initialDate));

  // Source : TOUS les employés actifs — pas seulement ceux en équipe du chantier
  const equipeIds = useMemo(() => new Set((chantierSaisie.equipe || []).map(m => parseInt(m.employeId))), [chantierSaisie.equipe]);
  const empsList = useMemo(() => {
    const tous = (parametres.employes || []).map(e => ({
      id: e.id,
      nom: `${e.prenom || ''} ${e.nom || ''}`.trim() || `Employé #${e.id}`,
      poste: e.poste || '',
      dansEquipe: equipeIds.has(e.id),
    }));
    // Equipe du chantier en premier, puis les autres
    return [...tous.filter(e => e.dansEquipe), ...tous.filter(e => !e.dansEquipe)];
  }, [parametres.employes, equipeIds]);

  const hierDate = useMemo(() => {
    const d = new Date(date); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [date]);
  const hierHeures = useMemo(() => heuresJour(chantierSaisie.journal || [], hierDate), [chantierSaisie.journal, hierDate]);

  const totalH = Object.values(heures).reduce((s, h) => s + (parseFloat(h) || 0), 0);
  const nbSaisis = Object.values(heures).filter(h => (parseFloat(h) || 0) > 0).length;

  // Validation date : bloquer si avant le début du chantier
  const dateDebut = chantierSaisie.dateDebut || null;
  const avantDebut = dateDebut && date < dateDebut;

  const valider = useCallback(() => {
    if (avantDebut) return;
    if (nbSaisis === 0) { alert('Aucune heure saisie.'); return; }
    const overLimit = Object.entries(heures).some(([, h]) => (parseFloat(h) || 0) > 10);
    if (overLimit && !window.confirm('Certains employés dépassent 10h. Confirmer ?')) return;
    const employes = Object.entries(heures)
      .filter(([, h]) => (parseFloat(h) || 0) > 0)
      .map(([empId, h]) => ({ employeId: parseInt(empId), heuresTravaillees: parseFloat(h) || 0 }));
    const journalFiltre = (chantierSaisie.journal || []).filter(e => e.date !== date);
    const newJournal = [...journalFiltre, { date, employes }];
    onSave({ ...chantierSaisie, journal: newJournal });
  }, [avantDebut, nbSaisis, heures, chantierSaisie, date, onSave]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20, padding: '28px 32px',
        width: '100%', maxWidth: 600,
        border: '1px solid var(--border-hover)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>Saisie des heures</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{chantierSaisie.nom}</div>
          </div>
          <button onClick={onFermer} style={{ ...btnDanger, padding: '8px 12px' }}><X size={16} /></button>
        </div>

        {/* Info équipe */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '8px 14px', background: 'var(--bg-glass-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {equipeIds.size > 0
              ? `${equipeIds.size} dans l'équipe · ${empsList.length - equipeIds.size} autres disponibles`
              : `${empsList.length} employés disponibles`}
          </span>
        </div>

        {/* Date picker */}
        <div style={{ marginBottom: avantDebut ? 12 : 20 }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={date}
            min={dateDebut || undefined}
            onChange={e => {
              const d = e.target.value;
              setDate(d);
              setHeures(heuresJour(chantierSaisie.journal || [], d));
            }}
            style={{ ...inputStyle, maxWidth: 200, borderColor: avantDebut ? '#ef4444' : undefined }}
          />
        </div>

        {/* Blocage : date avant le début du chantier */}
        {avantDebut && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🚫</span>
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Chantier pas encore démarré</div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 3 }}>
                Ce chantier débute le <strong>{new Date(dateDebut + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                Vous ne pouvez pas saisir des heures avant cette date.
              </div>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (Object.keys(hierHeures).length === 0) { alert('Aucune saisie trouvée pour la veille.'); return; }
              setHeures({ ...hierHeures });
            }}
            style={{ fontSize: 12, fontWeight: 700, color: C.info, background: C.info + '15', border: `1px solid ${C.info}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >Remplir comme hier</button>
          <button
            onClick={() => {
              const h = {};
              // Si équipe définie → 8h pour l'équipe seulement, sinon tous
              const cibles = equipeIds.size > 0 ? empsList.filter(e => e.dansEquipe) : empsList;
              cibles.forEach(e => { h[e.id] = 8; });
              setHeures(h);
            }}
            style={{ fontSize: 12, fontWeight: 700, color: C.primaire, background: C.primaire + '15', border: `1px solid ${C.primaire}35`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >{equipeIds.size > 0 ? `Équipe à 8h (${equipeIds.size})` : 'Tout à 8h'}</button>
          <button
            onClick={() => setHeures({})}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >Effacer</button>
        </div>

        {/* Employee list — clés stables, pas de nœud conditionnel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {empsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun employé configuré. Ajoutez vos employés dans Paramètres.
            </div>
          )}
          {empsList.map((emp, idx) => {
            const h = parseFloat(heures[emp.id]) || 0;
            const isActive = h > 0;
            const isOver = h > 10;
            const showSep = idx > 0 && !emp.dansEquipe && empsList[idx - 1].dansEquipe && equipeIds.size > 0;
            return (
              <React.Fragment key={emp.id}>
                {showSep && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Autres employés</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: isOver ? C.danger + '12' : isActive ? C.secondaire + '10' : 'var(--bg-glass)',
                border: `1px solid ${isOver ? C.danger + '40' : isActive ? C.secondaire + '30' : 'var(--border)'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>
                </div>
                {/* Quick fill buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 4, 8, 8.5].map(v => (
                    <button key={v}
                      onClick={() => setHeures(prev => ({ ...prev, [emp.id]: v }))}
                      style={{
                        fontSize: 11, fontWeight: 700,
                        color: h === v ? '#ffffff' : 'var(--text-muted)',
                        background: h === v ? C.primaire : 'var(--bg-hover)',
                        border: `1px solid ${h === v ? C.primaire : 'var(--border-glass-strong)'}`,
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{v}h</button>
                  ))}
                </div>
                {/* Number input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    value={h}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setHeures(prev => ({ ...prev, [emp.id]: val }));
                    }}
                    style={{
                      width: 62, background: 'var(--bg-glass-2)',
                      border: `1px solid ${isOver ? C.danger + '60' : 'var(--border-hover)'}`,
                      borderRadius: 8, color: isOver ? C.danger : 'var(--text-primary)',
                      fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                      textAlign: 'center', padding: '6px 8px',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>h</span>
                </div>
                {/* Span toujours présent — visibility au lieu de montage/démontage conditionnel */}
                <span style={{ fontSize: 10, color: C.danger, fontWeight: 700, whiteSpace: 'nowrap', visibility: isOver ? 'visible' : 'hidden' }}>&gt;10h</span>
              </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <button
          onClick={valider}
          disabled={avantDebut || nbSaisis === 0}
          style={{ ...btnSucces, width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, fontWeight: 800, opacity: (avantDebut || nbSaisis === 0) ? 0.4 : 1 }}
        >
          {avantDebut ? `Chantier démarre le ${new Date(dateDebut + 'T00:00:00').toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}` : `Valider — ${nbSaisis} employé${nbSaisis !== 1 ? 's' : ''} · ${totalH}h`}
        </button>
      </div>
    </div>
  );
}

function Chantiers({ chantiers, setChantiers, factures = [], clients, devis = [], parametres, naviguer, contexte, ouvrirSaisieHeures }) {
  const [vue, setVue] = useState('liste');
  const [selected, setSelected] = useState(null);
  const [detailOnglet, setDetailOnglet] = useState('vue');
  const [ajout, setAjout] = useState(false);
  const [filtre, setFiltre] = useState(contexte?.filtreStatut || 'Tous');
  const [membreEquipe, setMembreEquipe] = useState({ employeId: '', joursPlannifies: '', joursRealises: '', role: 'Ouvrier' });
  const [imprévu, setImprévu] = useState({ description: '', montant: '' });
  const [simulations, setSimulations] = useState({});
  const [justSimulatedId, setJustSimulatedId] = useState(null);

  const [modeCompleter, setModeCompleter] = useState(false);

  React.useEffect(() => {
    if (contexte?.chantierActif) {
      const c = chantiers.find(ch => ch.id === contexte.chantierActif);
      if (c) { setSelected(c); setVue('detail'); setDetailOnglet('vue'); }
    }
    if (contexte?.modeCompleter) setModeCompleter(true);
    if (contexte?.filtreStatut) setFiltre(contexte.filtreStatut);
    if (contexte?.clientActif) setFiltre('Tous');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vide = {
    numero: `CH-${new Date().getFullYear()}-${String(Math.max(0, ...chantiers.map(c => parseInt((c.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`, nom: '', clientId: '', conducteur: '', directeurTravauxId: '', adresse: '', ville: '', canton: '',
    dateDebut: '', nombreJours: '', nombrePersonnes: '', joursRealises: '', inclusSamedi: false,
    statut: 'En cours', priorite: 'Normale', avancement: 0, typesTravaux: [], surface: '',
    montantDevis: '', avenants: [], montantFacture: 0, equipe: [], employes: [],
    coutMaterielPrevu: '', materielReel: '', coutSousTraitancePrevu: '', sousTraitanceReelle: '',
    autresCoutsPrevu: '', autresCoutsReels: '', imprevus: [], heuresPrevu: '', heuresRealise: '', notes: '',
    journal: [], // préparation journal de chantier (futur)
  };
  const [form, setForm] = useState(vide);
  const [erreurs, setErreurs] = useState({});

  const statuts = ['Tous', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'];
  const couleurStatut = couleurStatutDS;

  const chantiersFiltres = useMemo(() => {
    let liste = filtre === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filtre);
    if (contexte?.clientActif) liste = liste.filter(c => c.clientId === contexte.clientActif);
    if (contexte?.employeActif) liste = liste.filter(c => c.equipe?.some(m => parseInt(m.employeId) === contexte.employeActif));
    return liste;
  }, [chantiers, filtre, contexte]);

  // Calculs lourds du chantier sélectionné — mis en cache pour éviter les recalculs sur chaque re-render
  const etatSelected = useMemo(() => {
    if (!selected) return null;
    return calculerEtatChantier(selected, parametres.employes, devis);
  }, [selected, parametres.employes, devis]);

  const coutsSelected = useMemo(() => {
    if (!selected) return null;
    return calculerCoutsChantier(selected, parametres.employes, parametres.localites, parametres.parametres, devis);
  }, [selected, parametres.employes, parametres.localites, parametres.parametres, devis]);


  // Cache des jours restants pour tous les chantiers filtrés — évite les recalculs dans le render
  const joursParChantier = useMemo(() => {
    const map = {};
    chantiersFiltres.forEach(c => { map[c.id] = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi); });
    return map;
  }, [chantiersFiltres]);

  const sauvegarder = () => {
    if (!form.nom) return;
    if (!form.devisId) {
      setErreurs(prev => ({ ...prev, devisId: 'Un devis signé est obligatoire pour créer un chantier' }));
      return;
    }
    if (!form.id && (!form.dateDebut || !form.nombreJours)) return;
    const nb = parseInt(form.nombreJours);
    if (form.nombreJours && (isNaN(nb) || nb <= 0)) { alert('Le nombre de jours doit être un entier positif.'); return; }
    const formSain = sanitiser(form);
    // Sync montantDevis depuis le devis lié (cache pour ExportPDF legacy)
    const devisLie = devis.find(d => String(d.id) === String(formSain.devisId));
    if (devisLie) {
      formSain.montantDevis = String(parseFloat(devisLie.montantHT) || 0);
    }
    const empsList = parametres.employes || donneesInitiales.employes || [];
    // Dériver joursRealises depuis le journal (heuresTravaillees — format unique)
    const equipeAvecJours = form.equipe.map(m => {
      const empId = parseInt(m.employeId);
      const jours = heuresEmploye(form.journal || [], empId) / 8;
      return { ...m, joursRealises: String(jours) };
    });
    const employes = equipeAvecJours.map(m => {
      const emp = empsList.find(e => e.id === parseInt(m.employeId));
      const jours = parseFloat(m.joursRealises) || 0;
      return { ...m, cout: emp ? (parseFloat(emp.tarifJour) || 0) * jours : 0 };
    });
    // Avancement auto-calculé — dates uniques du journal / nombreJours chantier
    const joursReelsChantier = new Set((form.journal || []).map(e => e.date).filter(Boolean)).size;
    const joursPrevusChantier = parseInt(form.nombreJours) || 0;
    const avancementAuto = joursPrevusChantier > 0
      ? Math.min(100, Math.round((joursReelsChantier / joursPrevusChantier) * 100))
      : (form.id ? (parseFloat(form.avancement) || 0) : 0);
    const chantiersData = { ...formSain, employes, avancement: avancementAuto };
    let tableauFinal;
    if (form.id) {
      tableauFinal = chantiers.map(c => c.id === form.id ? chantiersData : c);
    } else {
      tableauFinal = [...chantiers, { ...chantiersData, id: Date.now() }];
    }
    setChantiers(tableauFinal);
    // Si on venait de "Compléter", revenir au détail du chantier après sauvegarde
    if (modeCompleter && form.id) {
      const saved = tableauFinal.find(c => c.id === form.id);
      if (saved) { setSelected(saved); setVue('detail'); }
      setModeCompleter(false);
    }
    setAjout(false); setForm(vide); setErreurs({});
  };

  const supprimer = (id) => {
    const c = chantiers.find(ch => ch.id === id);
    if (!window.confirm(`Supprimer le chantier "${c?.nom}" ? Cette action est irréversible.`)) return;
    setChantiers(chantiers.filter(ch => ch.id !== id));
    setSelected(null);
    setVue('liste');
  };
  const toggleTravaux = (t) => { const list = form.typesTravaux || []; setForm({ ...form, typesTravaux: list.includes(t) ? list.filter(x => x !== t) : [...list, t] }); };
  const ajouterMembre = () => {
    if (membreEquipe.employeId && membreEquipe.joursPlannifies) {
      setForm({ ...form, equipe: [...form.equipe, { ...membreEquipe, _uid: `${membreEquipe.employeId}_${Date.now()}` }] });
      setMembreEquipe({ employeId: '', joursPlannifies: '', joursRealises: '', role: 'Ouvrier' });
    }
  };
  const ajouterImprévu = () => {
    if (imprévu.description && imprévu.montant) {
      setForm({ ...form, imprevus: [...form.imprevus, { ...imprévu }] });
      setImprévu({ description: '', montant: '' });
    }
  };
  // Fusion avec vide pour garantir la présence de tous les champs (chantiers créés sans le formulaire)
  const ouvrirModification = (c) => {
    setSelected(null); setVue('liste'); setForm({ ...vide, ...c }); setAjout(true);
  };

  if (vue === 'detail' && selected) {
    const c = selected;
    // ══ MOTEUR UNIQUE — source de vérité (memoïsé en amont) ═════════════
    const etat = etatSelected;
    assertEtatValide(etat);
    const coherenceDetail = assertEtatCoherent(etat);
    const couts = coutsSelected;
    const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);

    const modeChantier = etat.avancementPct === 0 ? 'INIT'
      : etat.avancementPct >= 95 ? 'FINAL'
      : 'PROJECTION';

    // ── Performance temporelle (depuis moteur) ──────────────────────────
    const perfRatio = etat.totalJoursPrevus > 0 && etat.totalJoursReels > 0
      ? etat.totalJoursReels / etat.totalJoursPrevus
      : null;
    const perfConfig = perfRatio === null ? null
      : perfRatio <= 0.9
        ? { label: 'Dans les temps', couleur: C.secondaire,  }
        : perfRatio <= 1.1
          ? { label: 'À surveiller', couleur: C.warning,  }
          : { label: 'En retard', couleur: C.danger,  };
    const perfReco = etat.deriveJours <= 0 ? null
      : etat.deriveJours <= 2 ? 'surveiller'
      : etat.deriveJours <= 5 ? 'ajouter'
      : 'renforcer';
    const perfRecoLabel = perfReco === 'surveiller'
      ? 'Surveiller — possible rattrapage sans action'
      : perfReco === 'ajouter'
        ? 'Ajouter 1 ouvrier pendant quelques jours'
        : perfReco === 'renforcer'
          ? 'Renforcer l\'équipe ou revoir le planning'
          : null;
    const perfNombreEmployes = (c.equipe || []).length;
    const perfResteJours = etat.totalJoursPrevus - etat.totalJoursReels;
    const perfImpact = (() => {
      if (!perfReco || perfReco === 'surveiller') return null;
      if (perfNombreEmployes === 0 || perfResteJours <= 0) return null;
      const nbAjout = perfReco === 'ajouter' ? 1 : 2;
      const gainVitesse = nbAjout / perfNombreEmployes;
      const nouvelleDuree = Math.round(perfResteJours / (1 + gainVitesse));
      const gainJours = Math.round(perfResteJours - nouvelleDuree);
      if (gainJours <= 0) return null;
      const retardResiduel = etat.deriveJours - gainJours;
      const texte = retardResiduel <= 1
        ? `Gain estimé : -${gainJours} jour${gainJours > 1 ? 's' : ''} sur la fin de chantier`
        : `Permettrait de réduire le retard à ~${retardResiduel} jour${retardResiduel > 1 ? 's' : ''}`;
      const conclusion = retardResiduel <= 0
        ? { icone: '', texte: 'Permet de revenir dans les délais', couleur: C.secondaire }
        : retardResiduel <= 2
          ? { icone: 'warning', texte: 'Réduit le retard mais reste sous contrôle', couleur: C.warning }
          : { icone: 'danger', texte: 'Insuffisant — revoir le planning ou ajouter plus de ressources', couleur: C.danger };
      return { texte, conclusion };
    })();
    const perfMessageCourt = (() => {
      if (j === null || !c.dateDebut) return '';
      if (j < 0) {
        const r = Math.abs(j);
        return perfRatio !== null && perfRatio > 1.1
          ? `+${r}j de retard — action nécessaire`
          : `+${r}j de retard — surveiller`;
      }
      if (j === 0) return 'Dernier jour prévu';
      return `${j}j restants`;
    })();
    const perfDetail = `${etat.totalJoursReels} j réalisés sur ${etat.totalJoursPrevus} j prévus`;

    // ── Score de criticité (depuis moteur) ───────────────────────────────
    const scoreCriticite = (etat.deriveJours * 2)
      + (etat.projectionDisponible && etat.margeEstimeePct !== null && etat.margeEstimeePct < 0 ? 10 : 0)
      + (couts.ratioEfficacite !== null && couts.ratioEfficacite < 0.8 ? 5 : 0);
    const criticiteConfig = scoreCriticite >= 15
      ? { icone: 'danger', label: 'Chantier critique — action immédiate', couleur: C.danger, fond: 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.13) 0%, rgba(239,68,68,0.04) 100%)' }
      : scoreCriticite >= 8
        ? { icone: 'warning', label: 'Chantier à risque — à traiter aujourd\'hui', couleur: C.warning, fond: 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.13) 0%, rgba(245,158,11,0.04) 100%)' }
        : null;

    const al = getAlerteChantier(c);
    const client = clients.find(cl => cl.id === c.clientId);
    const directeurTravaux = c.directeurTravauxId ? parametres.employes.find(e => e.id === parseInt(c.directeurTravauxId)) : null;
    const fmtK = (n) => fmtN(n);
    const facturesLiees = factures.filter(f => parseInt(f.chantierId) === c.id);
    const montantFactureLie = facturesLiees.reduce((s, f) => s + (parseFloat(f.montantTTC) || 0), 0);
    const montantPayeLie    = facturesLiees.reduce((s, f) => s + (parseFloat(f.montantPaye) || 0), 0);
    const devisTotal = calculerCA(c, devis);
    const pctFacture = devisTotal > 0 ? Math.min(Math.round((montantFactureLie / devisTotal) * 100), 100) : 0;
    // ── Alerte trésorerie (depuis moteur) ────────────────────────────────
    const tresorerieEcart = devisTotal > 0 ? etat.avancementPct - pctFacture : 0;
    const tresorerieConfig = tresorerieEcart > 30
      ? { icone: 'warning', label: 'Travail non facturé — risque de trésorerie', couleur: C.danger }
      : tresorerieEcart > 15
        ? { icone: 'warning', label: 'Facturation en retard', couleur: C.warning }
        : null;
    const pctEncaisse = devisTotal > 0 ? Math.min(Math.round((montantPayeLie / devisTotal) * 100), 100) : 0;

    // ── Alertes intelligentes (depuis moteur uniquement) ─────────────────
    const alertesChantier = (() => {
      const list = [];

      // Dépassement de délai (date-based)
      if (j !== null && j < 0) {
        const abs = Math.abs(j);
        list.push({ id: 'delai', texte: `Dépassement de délai — ${abs} jour${abs > 1 ? 's' : ''} de retard sur la planification`, gravite: 'critique', icone: 'danger' });
      } else if (j !== null && j <= 3 && j >= 0) {
        list.push({ id: 'fin_proche', texte: `Fin imminente — ${j === 0 ? "dernier jour aujourd'hui" : `${j} jour${j > 1 ? 's' : ''} restant${j > 1 ? 's' : ''}`}`, gravite: 'warning', icone: 'warning' });
      }

      // Rentabilité — projection moteur uniquement (bloquée si < 20%)
      if (etat.projectionDisponible && etat.margeEstimeePct !== null) {
        if (etat.margeEstimee < 0) {
          list.push({ id: 'perte', texte: `Chantier en perte — déficit estimé CHF ${fmtN(Math.abs(etat.margeEstimee))} (${etat.margeEstimeePct.toFixed(1)}%)`, gravite: 'critique', icone: 'danger' });
        } else if (etat.margeEstimeePct < 15) {
          list.push({ id: 'marge_faible', texte: `Rentabilité faible — marge estimée ${etat.margeEstimeePct.toFixed(1)}% · seuil cible 15%`, gravite: 'warning', icone: 'warning' });
        }
      }

      // Main d'œuvre élevée — depuis moteur
      if (etat.coutMOReel > 0 && etat.coutTotalReel > 0) {
        const pctMO = (etat.coutMOReel / etat.coutTotalReel) * 100;
        if (pctMO > 60) {
          list.push({ id: 'mo_elevee', texte: `Main d'œuvre élevée — ${Math.round(pctMO)}% du coût total (seuil 60%)`, gravite: 'warning', icone: 'warning' });
        }
      }

      return list.sort((a, b) => (b.gravite === 'critique' ? 1 : 0) - (a.gravite === 'critique' ? 1 : 0));
    })();

    // ── Vars extraites des IIFEs du rendu détail ──────────────────────────────
    const chantierStatusBadge = ['En cours', 'Suspendu'].includes(c.statut) ? getChantierStatus(c) : null;
    const devisSource = devis.find(d => String(d.id) === String(c.devisId));

    const estNouveauPlanifie = modeCompleter && c.statut === 'Planifié';

    return (<React.Fragment key="detail">
      <div>
        {/* ── Banner "Compléter" affiché après création depuis devis ── */}
        {estNouveauPlanifie && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#065f46', fontSize: 14 }}>Chantier créé avec succès</div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Complétez les informations (adresse, équipe, dates), puis passez en cours et saisissez les heures.</div>
            </div>
            <button
              onClick={() => ouvrirModification(c)}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            ><Pencil size={14} /> Compléter le chantier</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => { setVue('liste'); setSelected(null); setModeCompleter(false); }} style={btnPrimaire}><ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} /> Retour</button>
          {!estNouveauPlanifie && (
            <button onClick={() => ouvrirModification(c)} style={btnSucces}><Pencil size={15} /> Modifier</button>
          )}
          {c.devisId && !isChantierActif(c) && !['Terminé', 'Facturé', 'Clôturé'].includes(c.statut) && (
            <button
              onClick={() => {
                const updated = { ...c, statut: 'En cours' };
                setChantiers(chantiers.map(ch => ch.id === c.id ? updated : ch));
                setSelected(updated);
                setModeCompleter(false);
              }}
              style={{ ...btnSucces, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}
            >▶ Passer en cours</button>
          )}
          {isChantierActif(c) && (
            <button
              onClick={() => ouvrirSaisieHeures(c)}
              style={{ ...btnPrimaire, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: '1px solid #7c3aed55' }}
            ><Clock size={15} /> Saisir heures</button>
          )}
          <button onClick={() => naviguer('qualite', { chantierActif: c.id })} style={{ ...DS.btnGhost }}><CheckSquare size={15} /> Qualité</button>
          <button onClick={() => naviguer('finances', { chantierActif: c.id })} style={{ ...DS.btnGhost }}><DollarSign size={15} /> Finances</button>
          <button onClick={() => supprimer(c.id)} style={btnDanger}><Trash2 size={14} /> Supprimer</button>
        </div>

        {/* ── Onglets détail ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {[
            { id: 'vue',       label: 'Vue' },
            { id: 'analyse',   label: 'Analyse' },
            { id: 'financier', label: 'Financier' },
          ].map(o => (
            <button key={o.id} onClick={() => setDetailOnglet(o.id)} style={{
              background: 'transparent', border: 'none',
              borderBottom: detailOnglet === o.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: detailOnglet === o.id ? '#3b82f6' : 'var(--text-secondary)',
              padding: '10px 18px', marginBottom: '-1px',
              cursor: 'pointer', fontSize: 14, fontWeight: detailOnglet === o.id ? 700 : 400,
            }}>{o.label}</button>
          ))}
        </div>

        {/* ── Fallback données invalides (erreur critique moteur) ── */}
        {!coherenceDetail.ok && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12, marginBottom: 16,
            background: 'rgba(144,164,174,0.08)', border: '1px solid rgba(144,164,174,0.3)',
            borderLeft: '4px solid #90a4ae',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1, color: "var(--text-muted)" }}>○</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#90a4ae' }}>Données invalides — analyse impossible</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Vérifier les données saisies pour ce chantier</div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            COCKPIT — 4 indicateurs clés, lisibles en 5 secondes
            Données sources : etat (moteur unique), couts, perf
            ═══════════════════════════════════════════════════════ */}
        {(() => {
          // ── Tuile 1 : Rentabilité ───────────────────────────
          const margeTile = (() => {
            if (etat.projectionDisponible && etat.margeEstimeePct !== null) {
              const v = etat.margeEstimeePct;
              return { val: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, label: 'Marge estimée finale', couleur: v >= 15 ? C.secondaire : v >= 5 ? C.warning : C.danger };
            }
            if (couts.margeReelPct !== null && etat.coutTotalReel > 0) {
              const v = parseFloat(couts.margeReelPct);
              return { val: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, label: 'Marge actuelle', couleur: v >= 15 ? C.secondaire : v >= 5 ? C.warning : C.danger };
            }
            return devisTotal !== null
              ? { val: '—', label: 'Saisir des heures', couleur: '#78909c' }
              : { val: 'N/A', label: 'Aucun devis lié', couleur: '#78909c' };
          })();

          // ── Tuile 2 : Avancement ────────────────────────────
          const avTile = {
            val: `${etat.avancementPct}%`,
            label: etat.totalJoursPrevus > 0
              ? `${etat.totalJoursReels}j réalisés / ${etat.totalJoursPrevus}j prévus`
              : 'Jours prévus non définis',
            couleur: etat.avancementPct === 0 ? '#78909c' : perfConfig ? perfConfig.couleur : C.secondaire,
          };

          // ── Tuile 3 : Planning (calendaire uniquement) ──────────
          const joursCalendaire = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
          const planTile = (() => {
            if (!c.dateDebut || !c.nombreJours)
              return { val: '—', label: 'Pas de dates définies', couleur: '#78909c' };
            if (joursCalendaire === null)
              return { val: '—', label: 'Calcul impossible', couleur: '#78909c' };
            if (etat.totalJoursReels === 0)
              return { val: `${c.nombreJours}j`, label: 'Durée prévue — non démarré', couleur: '#78909c' };
            if (joursCalendaire > 0)
              return { val: `${joursCalendaire}j restants`, label: `${etat.avancementPct}% réalisé`, couleur: C.secondaire };
            if (joursCalendaire === 0)
              return { val: 'Dernier jour', label: `${etat.avancementPct}% réalisé`, couleur: C.warning };
            const retard = Math.abs(joursCalendaire);
            return { val: `+${retard}j de retard`, label: `${etat.avancementPct}% réalisé`, couleur: retard > 5 ? C.danger : C.warning };
          })();

          // ── Tuile 4 : Action recommandée ────────────────────
          const critAlert = alertesChantier.find(a => a.gravite === 'critique');
          const actionTile = (() => {
            if (modeChantier === 'FINAL') return { icone: 'info', val: 'Facturer', label: 'Chantier quasi terminé', couleur: C.secondaire };
            if (critAlert)                return { icone: 'danger', val: 'Action urgente', label: critAlert.texte.length > 50 ? critAlert.texte.slice(0, 48) + '…' : critAlert.texte, couleur: C.danger };
            if (perfReco === 'renforcer') return { niveau: 'danger', val: 'Renforcer l\'équipe', label: 'Retard important — revoir planning', couleur: C.danger };
            if (perfReco === 'ajouter')  return { niveau: 'warning', val: '+1 ouvrier', label: 'Réduire le retard en cours', couleur: C.warning };
            if (perfReco === 'surveiller') return { icone: '◎', val: 'Surveiller', label: 'Possible rattrapage sans action', couleur: C.warning };
            if (modeChantier === 'INIT') return { icone: '▶', val: 'Saisir les heures', label: 'Aucune donnée terrain', couleur: '#78909c' };
            return { icone: '', val: 'RAS', label: 'Aucune action requise', couleur: C.secondaire };
          })();

          const tiles = [
            { id: 'renta', icone: 'renta', titre: 'RENTABILITÉ', ...margeTile },
            { id: 'av',    icone: 'av', titre: 'AVANCEMENT',  ...avTile },
            { id: 'plan',  icone: 'plan', titre: 'PLANNING',    ...planTile },
            { id: 'act',   icone: actionTile.icone, titre: 'ACTION', val: actionTile.val, label: actionTile.label, couleur: actionTile.couleur },
          ];

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {tiles.map(t => (
                <div key={t.id} style={{
                  background: `linear-gradient(145deg, ${t.couleur}12 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid ${t.couleur}30`,
                  borderTop: `3px solid ${t.couleur}`,
                  borderRadius: 12, padding: '16px 18px',
                  boxShadow: `0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 var(--border-glass)`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {t.icone} {t.titre}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.couleur, letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 6 }}>
                    {t.val}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {detailOnglet === 'vue' && <>
        {/* ── Criticité globale ── */}
        {criticiteConfig && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 22px', borderRadius: 14, marginBottom: 16,
            background: criticiteConfig.fond,
            border: `1px solid ${criticiteConfig.couleur}35`,
            borderLeft: `5px solid ${criticiteConfig.couleur}`,
            boxShadow: `0 2px 16px ${criticiteConfig.couleur}18`,
          }}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{criticiteConfig.icone}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: criticiteConfig.couleur, letterSpacing: '-0.2px' }}>{criticiteConfig.label}</span>
          </div>
        )}

        {/* ── Alerte trésorerie ── */}
        {tresorerieConfig && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 20px', borderRadius: 12, marginBottom: 16,
            background: tresorerieConfig.couleur === C.danger
              ? 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)'
              : 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.03) 100%)',
            border: `1px solid ${tresorerieConfig.couleur}30`,
            borderLeft: `4px solid ${tresorerieConfig.couleur}`,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{tresorerieConfig.icone}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: tresorerieConfig.couleur }}>{tresorerieConfig.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {etat.avancementPct}% réalisé · {pctFacture}% facturé
              </div>
            </div>
          </div>
        )}

        {/* ── Alertes intelligentes ── */}
        {alertesChantier.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {alertesChantier.map(a => {
              const isCritique = a.gravite === 'critique';
              const col = isCritique ? C.danger : C.warning;
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 18px', borderRadius: 12,
                  background: isCritique
                    ? 'radial-gradient(ellipse at 6% 50%, rgba(239,68,68,0.13) 0%, rgba(239,68,68,0.04) 100%)'
                    : 'radial-gradient(ellipse at 6% 50%, rgba(245,158,11,0.13) 0%, rgba(245,158,11,0.04) 100%)',
                  border: `1px solid ${col}30`,
                  borderLeft: `4px solid ${col}`,
                  boxShadow: `0 2px 12px ${col}14`,
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icone}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: col, flex: 1, lineHeight: 1.4 }}>{a.texte}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                    background: col + '16', color: col, border: `1px solid ${col}30`,
                    borderRadius: 20, padding: '3px 11px', flexShrink: 0,
                  }}>{isCritique ? 'Critique' : 'Attention'}</span>
                </div>
              );
            })}
          </div>
        )}
        </>}

        {detailOnglet === 'analyse' && <>
        {/* ── Intelligence terrain ── */}
        {etat.projectionDisponible && isChantierActif(c) && renderTerrainVelocity(c, etat)}

        {/* ── Performance temporelle ── */}
        {etat.totalJoursReels > 0 && perfConfig && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderRadius: 12, marginBottom: 16,
            background: perfConfig.couleur + '0d',
            border: `1px solid ${perfConfig.couleur}30`,
            borderLeft: `4px solid ${perfConfig.couleur}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{perfConfig.dot}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: perfConfig.couleur }}>{perfMessageCourt}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, opacity: 0.8 }}>{perfDetail}</div>
                {perfRecoLabel && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>·</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Recommandation : {perfRecoLabel.toLowerCase()}
                      </span>
                    </div>
                    {perfImpact && (
                      <div style={{ marginTop: 4, marginLeft: 20 }}>
                        <div style={{ fontSize: 11, color: C.secondaire, fontWeight: 600 }}>
                          → {perfImpact.texte}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: perfImpact.conclusion.couleur }}>
                          {perfImpact.conclusion.icone} {perfImpact.conclusion.texte}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ ...carteStyle, borderLeft: `4px solid ${couleurStatut(c.statut)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>{c.numero}</div>
              <h1 style={{ color: 'var(--text-primary)', margin: '4px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>{c.nom}</h1>
              {client && (
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => naviguer('clients', { clientActif: c.clientId })}>
                  {client.prenom} {client.nom} — {client.entreprise} · {client.telephone}
                  <span style={{ color: C.primaire, textDecoration: 'none', fontSize: '12px', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 6 }}>Voir →</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Badge texte={c.priorite} couleur={c.priorite === 'Haute' ? C.danger : C.info} />
              <Badge texte={c.statut} couleur={couleurStatut(c.statut)} />
              {chantierStatusBadge && <Badge texte={chantierStatusBadge.label} couleur={chantierStatusBadge.couleur} glow />}
              {c.devisId && !isChantierActif(c) && !['Terminé', 'Facturé', 'Clôturé'].includes(c.statut) && (
                <Badge texte="CA non comptabilisé" couleur={C.warning} />
              )}
              <BadgeRentabilite ca={etat.devisTotal} couts={etat.coutTotalReel} />
            </div>
          </div>
          <div style={{ margin: '20px 0' }}>
            <BarreAvancement valeur={etat.avancementPct} />
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                {etat.totalJoursPrevus > 0
                  ? <><strong style={{ color: 'var(--text-primary)' }}>{etat.totalJoursReels} j réalisés</strong> sur {etat.totalJoursPrevus} j prévus</>
                  : etat.totalJoursReels > 0
                    ? <strong style={{ color: 'var(--text-primary)' }}>{etat.totalJoursReels} j réalisés</strong>
                    : <span style={{ color: 'var(--text-muted)' }}>Chantier non démarré</span>
                }
              </span>
              {etat.totalJoursPrevus > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-glass-2)', borderRadius: 20, padding: '2px 10px' }}>
                  {etat.avancementPct}%
                </span>
              )}
            </div>
          </div>
          <div className="info-grid">
            {[
              ['Adresse', `${c.adresse || ''}${c.ville ? ', ' + c.ville : ''}${c.canton ? ' (' + c.canton + ')' : ''}`],
              ['Dir. travaux', directeurTravaux ? `${directeurTravaux.nom} — ${directeurTravaux.poste || ''}` : (c.conducteur || '—')],
              ['Début', c.dateDebut],
              ['Fin prévue', c.dateDebut && c.nombreJours ? calculerDateFinOuvrables(c.dateDebut, c.nombreJours, c.inclusSamedi) : '—'],
              ['Jours prévus', c.nombreJours ? `${c.nombreJours} jours` : '—'],
              ['Surface', c.surface ? `${c.surface} m²` : '—'],
              ['Travaux', c.typesTravaux?.join(', ') || '—'],
            ].map(([label, val]) => (
              <div key={label} className="info-item">
                <span className="info-label">{label}</span>
                <span className="info-value">{val || '—'}</span>
              </div>
            ))}
          </div>
          {c.notes && <div style={{ marginTop: '15px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px 16px', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: 13 }}>{c.notes}</div>}
        </div>


        {/* ── MODE INIT — chantier non démarré ── */}
        {etat.totalJoursReels === 0 && etat.coutTotalReel === 0 && (
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-hover)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <HardHat size={28} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>Chantier non démarré</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Déclarez la première journée pour activer le suivi et la projection.</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Projection indisponible — chantier trop tôt ── */}
        {etat.totalJoursReels > 0 && !etat.projectionDisponible && (
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Projection indisponible — chantier trop tôt</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {etat.totalJoursReels} j réalisés · projection disponible à partir de 20%
                {etat.totalJoursPrevus > 0 && ` (encore ~${Math.max(0, Math.ceil(etat.totalJoursPrevus * 0.2) - etat.totalJoursReels)} j)`}
              </div>
            </div>
          </div>
        )}

        {/* ── Projection à terminaison (moteur uniquement) ── */}
        {etat.projectionDisponible && renderProjectionCard(etat, fmtK)}


        {/* ── Recommandations automatiques ── */}
        {etat.projectionDisponible && renderRecommandations(etat, couts)}

        {/* ── Rentabilité par jours (logique métier BTP) ── */}
        {renderRentabiliteJours(c, etat, couts, naviguer, fmtN, fmtK)}
        </>}

        {detailOnglet === 'financier' && <>
        <div style={carteStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="ds-card-title" style={{ margin: 0 }}>Financier</div>
            {devisSource ? (
              <span
                onClick={() => naviguer('devis')}
                style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '4px 12px', borderRadius: 20, cursor: 'pointer' }}
                title={`CA issu du devis ${devisSource.numero}`}
              >
                {devisSource.numero} · CHF {fmtN(parseFloat(devisSource.montantHT) || 0)}
              </span>
            ) : (
              <span
                onClick={() => naviguer('devis')}
                style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '4px 12px', borderRadius: 20, cursor: 'pointer' }}
              >
                Aucun devis lié — Lier un devis →
              </span>
            )}
          </div>

          {/* ── Aucun devis lié ── */}
          {devisTotal === null && (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 4 }}>Aucun devis lié</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Le chiffre d'affaires est indisponible. Liez un devis accepté pour activer le suivi financier.</div>
              <button onClick={() => ouvrirModification(c)} style={{ marginTop: 10, ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}>Modifier le chantier</button>
            </div>
          )}

          {/* ── Ligne CA / facturé / encaissé ── */}
          {devisTotal !== null && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'CA signé', val: `CHF ${fmtK(devisTotal)}`, sub: (() => { const av = sommeAvenants(c); const rg = Array.isArray(devisSource?.heuresRegie) ? devisSource.heuresRegie.reduce((s,r) => s+(parseFloat(r.heures)||0)*(parseFloat(r.tarifHeure)||0),0) : 0; if (av > 0 && rg > 0) return `avenants ${fmtK(av)} + régie ${fmtK(rg)}`; if (av > 0) return `dont avenants CHF ${fmtK(av)}`; if (rg > 0) return `dont régie CHF ${fmtK(rg)}`; return null; })(), couleur: C.primaire },
                  { label: 'Facturé', val: `CHF ${fmtK(montantFactureLie)}`, sub: `${pctFacture}% du devis`, couleur: pctFacture >= 100 ? C.secondaire : pctFacture > 0 ? C.info : '#78909c' },
                  { label: 'Encaissé', val: `CHF ${fmtK(montantPayeLie)}`, sub: `${pctEncaisse}% du devis`, couleur: pctEncaisse >= 100 ? C.secondaire : pctEncaisse > 0 ? C.warning : '#78909c' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.couleur + '12', border: `1px solid ${s.couleur}28`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.val}</div>
                    {s.sub && <div style={{ fontSize: 11, color: s.couleur, opacity: 0.75, marginTop: 3, fontWeight: 600 }}>{s.sub}</div>}
                  </div>
                ))}
              </div>
              {/* Barre de progression facturation */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Progression facturation</span>
                  <span>{pctFacture}% facturé · {pctEncaisse}% encaissé</span>
                </div>
                <div style={{ background: 'var(--bg-glass-2)', borderRadius: 6, height: 8, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctFacture}%`, background: `linear-gradient(90deg, ${C.info}, ${C.primaire})`, borderRadius: 6, transition: 'width 0.4s ease' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctEncaisse}%`, background: C.secondaire + 'aa', borderRadius: 6 }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Imprévus ── */}
          {c.imprevus?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: C.danger, marginBottom: 8 }}>Coûts imprévus</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {c.imprevus.map((imp) => (
                  <div key={`${imp.description}-${imp.montant}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.danger + '0a', border: `1px solid ${C.danger}22`, borderRadius: 8, padding: '8px 14px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{imp.description}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>CHF {fmtN(imp.montant)}</span>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.danger, marginTop: 2 }}>
                  Total imprévus : CHF {fmtN(etat.coutImprevus)}
                </div>
              </div>
            </div>
          )}

          {/* ── Alerte dépassement budget ── */}
          {couts.depassementBudget && (
            <div style={{ background: C.danger + '15', border: `1px solid ${C.danger}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, color: C.danger, fontSize: 13 }}>Dépassement budget</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  Coûts réels (CHF {fmtN(etat.coutTotalReel)}) &gt; Budget prévu (CHF {fmtN(couts.totalCoutsPrevu)})
                </span>
              </div>
            </div>
          )}
          {couts.alerteOrange && (
            <div style={{ background: C.warning + '15', border: `1px solid ${C.warning}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, color: C.warning, fontSize: 13 }}>Attention budget</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  80% du budget consommé alors que l'avancement est à {etat.avancementPct}%
                </span>
              </div>
            </div>
          )}

          {/* Correction #4 — Alertes rythme / vélocité */}
          {couts.alerteRythmeRouge && (
            <div style={{ background: C.danger + '15', border: `1px solid ${C.danger}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, color: C.danger, fontSize: 13 }}>Rythme de dépense critique</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  Vous dépensez trop vite par rapport à l'avancement — ratio efficacité {couts.ratioEfficacite !== null ? Math.round(couts.ratioEfficacite * 100) : '—'}% (seuil : 70%)
                </span>
              </div>
            </div>
          )}
          {!couts.alerteRythmeRouge && couts.alerteRythmeOrange && (
            <div style={{ background: C.warning + '15', border: `1px solid ${C.warning}50`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, color: C.warning, fontSize: 13 }}>Rythme de dépense élevé</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  Les coûts progressent plus vite que l'avancement — ratio efficacité {couts.ratioEfficacite !== null ? Math.round(couts.ratioEfficacite * 100) : '—'}% (seuil : 85%)
                </span>
              </div>
            </div>
          )}

          {/* ── Coûts réels ── */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <CoutBadge label="Équipe réel" valeur={etat.coutMOReel} couleur={C.secondaire} />
            <CoutBadge label="Matériel réel" valeur={etat.coutMateriel} couleur={C.violet} />
            <CoutBadge label="Imprévus" valeur={etat.coutImprevus} couleur={C.danger} />
            <CoutBadge label="Total coûts" valeur={etat.coutTotalReel} couleur="#455a64" />
          </div>

          {/* ── P8 Badge données incomplètes ── */}
          {couts.donneesIncompletes && (
            <div style={{ background: C.warning + '12', border: `1px solid ${C.warning}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AlertTriangle size={15} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.warning, fontWeight: 700 }}>Données incomplètes</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coûts réels manquants : {couts.champsManquants.join(', ')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>— La marge calculée est indicative.</span>
            </div>
          )}

          {/* ── KPIs marge — FINAL uniquement (indicateurs réels non pertinents en cours de chantier) ── */}
          {modeChantier === 'FINAL' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: 16 }}>
            {[
              { label: 'Marge directe (%)', valeur: `${couts.margeReelPct}%`, couleur: parseFloat(couts.margeReelPct) >= 15 ? C.secondaire : C.danger },
              { label: 'Marge nette', valeur: `${couts.margeNettePct}%`, couleur: parseFloat(couts.margeNettePct) >= 10 ? C.secondaire : parseFloat(couts.margeNettePct) >= 0 ? C.warning : C.danger, sub: `FG: CHF ${fmtK(couts.fraisGeneraux)}` },
              { label: 'Coût/m² réel', valeur: couts.coutParM2Reel !== null ? `CHF ${couts.coutParM2Reel}` : '—', couleur: couts.coutParM2Reel !== null ? C.violet : 'var(--text-muted)' },
              { label: 'Prix/m² devis', valeur: couts.prixParM2Devis !== null ? `CHF ${couts.prixParM2Devis}` : '—', couleur: couts.prixParM2Devis !== null ? C.info : 'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} style={{ background: (typeof s.couleur === 'string' && s.couleur.startsWith('#')) ? s.couleur + '12' : 'var(--bg-glass-2)', border: `1px solid ${(typeof s.couleur === 'string' && s.couleur.startsWith('#')) ? s.couleur + '30' : 'var(--border-glass)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: s.couleur, letterSpacing: '-0.3px' }}>{s.valeur}</div>
                {s.sub && <div style={{ fontSize: 10, color: s.couleur, opacity: 0.7, marginTop: 3 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
          )}

          {/* ── Tableau écart prévu / réel — MODE FINAL uniquement ── */}
          {modeChantier === 'FINAL' && (couts.totalCoutsPrevu > 0 || couts.totalCoutsReel > 0) && renderEcartTable(couts, fmtN)}

          {/* ── Budget restant + RAD réel métier — MODE FINAL uniquement ── */}
          {modeChantier === 'FINAL' && couts.totalCoutsPrevu > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Budget restant = enveloppe disponible */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: (couts.budgetRestant >= 0 ? C.secondaire : C.danger) + '10', border: `1px solid ${(couts.budgetRestant >= 0 ? C.secondaire : C.danger)}30`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>Budget restant</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Enveloppe − coûts engagés</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: couts.budgetRestant >= 0 ? C.secondaire : C.danger }}>
                  {couts.budgetRestant >= 0 ? '' : '−'}CHF {fmtK(Math.abs(couts.budgetRestant))}
                </div>
              </div>
              {/* RAD = coût estimé pour finir à ce rythme */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-glass-2)', border: '1px solid var(--border-hover)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>RAD — Coût pour finir</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>À ce rythme, reste à dépenser</div>
                </div>
                {couts.rad !== null ? (
                  <div style={{ fontSize: 18, fontWeight: 800, color: couts.rad > couts.budgetRestant ? C.danger : C.secondaire }}>
                    CHF {fmtK(couts.rad)}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>—</div>
                )}
              </div>
            </div>
          )}
        </div>

        </>}

      </div>
    </React.Fragment>);
  }

  return (<React.Fragment key="list-form">
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Chantiers</div>
          {(contexte?.clientActif || contexte?.employeActif) && (
            <div className="page-title-sub">{contexte?.clientActif ? 'Filtrés par client' : 'Filtrés par employé'}</div>
          )}
        </div>
        <div className="page-actions-group">
          {contexte?.clientActif && (
            <button onClick={() => naviguer('clients')} style={{ ...DS.btnGhost }}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Retour aux clients</button>
          )}
          {contexte?.employeActif && (
            <button onClick={() => naviguer('employes')} style={{ ...DS.btnGhost }}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Retour aux employés</button>
          )}
          {(contexte?.clientActif || contexte?.employeActif) && (
            <button onClick={() => naviguer('chantiers')} style={{ ...DS.btnGhost }}><X size={14} /> Supprimer filtre</button>
          )}
          <button onClick={() => { setForm(vide); setAjout(!ajout); }} style={btnPrimaire}><Plus size={16} /> Nouveau chantier</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const nbEnCours = chantiers.filter(c => c.statut === 'En cours').length;
        const nbEnRetard = chantiersFiltres.filter(c => { const j = joursParChantier[c.id]; return j !== null && j < 0; }).length;
        const caTotal = chantiersFiltres.reduce((t, c) => t + (calculerCA(c, devis) || 0), 0);
        const joursPlanifies = chantiersFiltres.reduce((t, c) => t + (parseInt(c.nombreJours) || 0), 0);
        const chantiersAvecData = chantiersFiltres.filter(c => { const ca = calculerCA(c, devis); return ca !== null && ca > 0; });
        let margeMoyenne = null;
        if (chantiersAvecData.length > 0) {
          const sum = chantiersAvecData.reduce((s, c) => {
            const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
            return s + (couts.totalCoutsReel > 0 ? parseFloat(couts.margeReelPct) : 0);
          }, 0);
          margeMoyenne = Math.round(sum / chantiersAvecData.length);
        }
        const nbAvecDevis = chantiersFiltres.filter(c => calculerCA(c, devis) !== null).length;
        const kpiItems = [
          { label: 'EN COURS',       val: nbEnCours,  Icon: HardHat,    ...DS.kpi.blue,   badge: nbEnRetard > 0 ? `${nbEnRetard} en retard` : null },
          { label: 'CA CHANTIERS',   val: `CHF ${fmtN(caTotal)}`, sous: `${nbAvecDevis} avec devis · tous statuts`, Icon: DollarSign, ...DS.kpi.green },
          { label: 'MARGE MOYENNE',  val: margeMoyenne !== null ? `${margeMoyenne}%` : '—', Icon: TrendingUp, ...DS.kpi.amber },
          { label: 'JOURS PLANIFIÉS',val: `${fmtN(joursPlanifies)}j`, Icon: Clock, ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.sous && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', marginTop: 5, position: 'relative' }}>{k.sous}</div>}
                {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(239,68,68,0.85)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {statuts.map(s => (
          <button key={s} onClick={() => setFiltre(s)} style={{
            background: filtre === s ? '#EEF2FF' : 'transparent',
            color: filtre === s ? '#4F46E5' : 'var(--text-muted)',
            border: '1px solid transparent',
            padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
            fontWeight: filtre === s ? 600 : 400, fontFamily: 'inherit',
            transition: 'all 0.18s',
          }}>{s}</button>
        ))}
      </div>

      {ajout && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardHat size={18} /> {form.id ? (modeCompleter ? 'Compléter le chantier' : 'Modifier le chantier') : 'Nouveau chantier'}
          </div>

          {/* ══ PRÉVISION ══════════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: C.primaire, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 3, height: 14, background: C.primaire, borderRadius: 2 }} />
              {form.id ? 'Prévision initiale' : 'Prévision'}
            </div>
            {form.id && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Données de référence — modifiable si nécessaire
              </span>
            )}
          </div>

          {/* Champs principaux */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            {[['Numéro', 'numero', 'text', 'CH-2026-001'], ['Nom du chantier *', 'nom', 'text', 'Ex: Bureaux Dupont'], ['Conducteur', 'conducteur', 'text', 'Jean Martin'], ['Adresse', 'adresse', 'text', 'Rue...'], ['Canton', 'canton', 'text', 'GE'], ['Date de début *', 'dateDebut', 'date', ''], ['Jours ouvrables prévus *', 'nombreJours', 'number', '15'], ['Surface (m²)', 'surface', 'number', '250']].map(([label, key, type, placeholder]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type={type} placeholder={placeholder} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={labelStyle}>Client</label>
              <select value={form.clientId || ''} onChange={e => setForm({ ...form, clientId: parseInt(e.target.value) })} style={inputStyle}>
                <option value="">Sélectionner...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.entreprise}</option>)}
              </select></div>
            <div><label style={labelStyle}>Directeur de travaux</label>
              <select value={form.directeurTravauxId || ''} onChange={e => setForm({ ...form, directeurTravauxId: e.target.value })} style={inputStyle}>
                <option value="">— Sélectionner —</option>
                {parametres.employes.filter(e => e.actif !== false).map(e => <option key={e.id} value={e.id}>{e.nom} — {e.poste || 'Employé'}</option>)}
              </select></div>
            <div>
              <label style={labelStyle}>Localité <span style={{ color: C.danger }}>*</span></label>
              <select value={form.ville || ''} onChange={e => { setForm({ ...form, ville: e.target.value }); if (erreurs.ville) setErreurs(prev => ({ ...prev, ville: null })); }}
                style={{ ...inputStyle, ...(erreurs.ville ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef444440' } : {}) }}>
                <option value="">Sélectionner...</option>
                {parametres.localites.map(l => <option key={l.id} value={l.nom}>{l.nom} (CHF {l.tarifJour}.-/j)</option>)}
              </select>
              {erreurs.ville && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>La localité est obligatoire</div>}
            </div>
            <div><label style={labelStyle}>Statut</label>
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}>
                {['À chiffrer', 'Devis envoyé', 'Validé', 'En préparation', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'].map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div><label style={labelStyle}>Priorité</label>
              <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })} style={inputStyle}>
                {['Basse', 'Normale', 'Haute', 'Urgente'].map(s => <option key={s}>{s}</option>)}
              </select></div>
          </div>

          {/* Calendrier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div><label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={form.inclusSamedi || false} onChange={e => setForm({ ...form, inclusSamedi: e.target.checked })} />
              Inclure le samedi</label></div>
            <div>
              <label style={labelStyle}>Personnes prévues</label>
              <input type="number" min="1" placeholder="Ex: 3"
                value={form.nombrePersonnes || ''}
                onChange={e => setForm({ ...form, nombrePersonnes: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
          {form.dateDebut && form.nombreJours && (
            <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', padding: '14px 18px', borderRadius: '12px', marginBottom: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: parseInt(form.nombrePersonnes) > 0 ? '1fr 1fr' : '1fr', gap: '15px' }}>
                <div><div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '4px' }}>Date de fin prévue</div>
                  <div style={{ fontWeight: 700, color: C.primaire, fontSize: '15px' }}>{calculerDateFinOuvrables(form.dateDebut, form.nombreJours, form.inclusSamedi)}</div></div>
                {parseInt(form.nombrePersonnes) > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '4px' }}>Charge estimée</div>
                    <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '15px' }}>
                      {parseInt(form.nombreJours) * parseInt(form.nombrePersonnes)} jours-homme
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {form.nombreJours}j × {form.nombrePersonnes} pers.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Types de travaux */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Types de travaux</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {parametres.typesTravaux.map(t => (
                <button key={t.id} onClick={() => toggleTravaux(t.nom)} style={{
                  background: (form.typesTravaux || []).includes(t.nom) ? 'rgba(59,130,246,0.18)' : 'var(--bg-glass-2)',
                  color: (form.typesTravaux || []).includes(t.nom) ? C.primaire : 'var(--text-secondary)',
                  border: (form.typesTravaux || []).includes(t.nom) ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
                  padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
                  fontWeight: (form.typesTravaux || []).includes(t.nom) ? 700 : 500,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{t.nom}</button>
              ))}
            </div>
          </div>

          {/* Budget prévisionnel */}
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Budget prévisionnel</div>

          {/* Sélecteur de devis accepté — OBLIGATOIRE */}
          {(() => {
            const devisAcceptes = devis.filter(d => d.statut === 'accepté');
            const devisLie = devis.find(d => d.id === form.devisId);
            const caBase = parseFloat(devisLie?.montantHT) || 0;
            const caRegie = Array.isArray(devisLie?.heuresRegie)
              ? devisLie.heuresRegie.reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0)
              : 0;
            const caTotal = caBase + caRegie;
            const hasError = erreurs.devisId || !form.devisId;
            return (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Devis lié <span style={{ color: C.danger }}>*</span></label>
                  <select
                    value={form.devisId || ''}
                    onChange={e => {
                      const d = devis.find(x => String(x.id) === String(e.target.value));
                      setForm({ ...form, devisId: d ? d.id : null });
                      setErreurs(prev => ({ ...prev, devisId: null }));
                    }}
                    style={{ ...inputStyle, borderColor: hasError ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.4)', boxShadow: hasError ? '0 0 0 1px rgba(239,68,68,0.2)' : form.devisId ? '0 0 0 1px rgba(16,185,129,0.15)' : undefined }}
                  >
                    <option value="">— Sélectionner un devis accepté —</option>
                    {devisAcceptes.map(d => {
                      const cli = clients.find(c => c.id === d.clientId);
                      return <option key={d.id} value={d.id}>{d.numero} · {cli?.nom || 'Client inconnu'} · CHF {fmtN(parseFloat(d.montantHT) || 0)}</option>;
                    })}
                  </select>
                  {erreurs.devisId
                    ? <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{erreurs.devisId}</div>
                    : !form.devisId && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4, fontWeight: 600 }}>Un devis signé est obligatoire pour créer un chantier</div>
                  }
                  {devisAcceptes.length === 0 && (
                    <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: C.warning, fontWeight: 600 }}>
                      Aucun devis accepté disponible — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => naviguer('devis')}>Créer un devis →</span>
                    </div>
                  )}
                </div>

                {/* CA — read-only depuis devis signé */}
                {devisLie ? (
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'grid', gridTemplateColumns: caRegie > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>CA devis</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(caBase)}</div>
                    </div>
                    {caRegie > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>Régie</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>+CHF {fmtN(Math.round(caRegie))}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>CA total</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(caTotal)}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Aucun devis lié</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Le CA sera indisponible tant qu'aucun devis accepté n'est sélectionné.</div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            {[['Matériel prévu (CHF)', 'coutMaterielPrevu'], ['Sous-traitance prévue (CHF)', 'coutSousTraitancePrevu'], ['Autres coûts prévus (CHF)', 'autresCoutsPrevu']].map(([label, key]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type="text" inputMode="numeric" placeholder="0"
                  value={form[key] ? fmtN(form[key]) : ''}
                  onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, [key]: raw }); }}
                  style={inputStyle} /></div>
            ))}
          </div>
          {/* ══ SUIVI TERRAIN — édition uniquement ══════════════════════ */}
          {form.id && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 20px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: C.warning, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 3, height: 14, background: C.warning, borderRadius: 2 }} />
                Suivi terrain
              </div>

              {/* Avancement calculé automatiquement + ratioTemps */}
              {(() => {
                const joursR = (form.equipe || []).reduce((s, m) =>
                  s + heuresEmploye(form.journal || [], parseInt(m.employeId)) / 8
                , 0);
                const joursP = (form.equipe || []).reduce((s, m) => s + (parseFloat(m.joursPlannifies) || 0), 0);
                const av = joursP > 0 ? Math.min(100, Math.round((joursR / joursP) * 100)) : 0;
                const ratioTemps = joursP > 0 ? joursR / joursP : 0;
                const alerteTemps = ratioTemps > 1.4 ? 'rouge' : ratioTemps > 1.2 ? 'orange' : null;
                const couleurAv = alerteTemps === 'rouge' ? C.danger : alerteTemps === 'orange' ? C.warning : C.secondaire;
                return (
                  <div style={{ background: couleurAv + '10', border: `1px solid ${couleurAv}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          Avancement&nbsp;
                          <strong style={{ color: couleurAv, fontSize: 16 }}>{av}%</strong>
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          — {Math.round(joursR * 10) / 10}j réalisés / {joursP}j prévus
                        </span>
                      </span>
                      {alerteTemps && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: couleurAv, background: couleurAv + '18', border: `1px solid ${couleurAv}40`, padding: '3px 10px', borderRadius: 20 }}>
                          {alerteTemps === 'rouge' ? 'Dépassement temps critique' : 'Dépassement temps élevé'}
                          &nbsp;({Math.round(ratioTemps * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Déclarer la journée du jour ── */}
              {form.id && (() => {
                const today = new Date().toISOString().split('T')[0];
                const heuresAujParEmp = heuresJour(form.journal || [], today);
                const nbAuj = Object.values(heuresAujParEmp).filter(h => h > 0).length;
                const totalHeuresAuj = Object.values(heuresAujParEmp).reduce((s, h) => s + h, 0);
                const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                const disabled = false;
                const chantierEnForm = chantiers.find(ch => ch.id === form.id);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {nbAuj > 0 && (
                      <div style={{ background: C.secondaire + '10', border: `1px solid ${C.secondaire}30`, borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: C.secondaire, fontWeight: 600 }}>
                          Journée déclarée — {nbAuj} employé{nbAuj > 1 ? 's' : ''} · {totalHeuresAuj}h
                        </span>
                        <button
                          onClick={() => chantierEnForm && ouvrirSaisieHeures(chantierEnForm)}
                          style={{ fontSize: 11, fontWeight: 700, color: C.secondaire, background: 'transparent', border: `1px solid ${C.secondaire}50`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >Modifier</button>
                      </div>
                    )}
                    <button
                      onClick={() => chantierEnForm && !disabled && ouvrirSaisieHeures(chantierEnForm)}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                        background: disabled ? 'var(--bg-glass-2)' : `linear-gradient(135deg, ${C.secondaire}22, ${C.secondaire}10)`,
                        border: `1px solid ${disabled ? 'var(--border-glass-strong)' : C.secondaire + '40'}`,
                        color: disabled ? 'var(--text-muted)' : C.secondaire,
                        fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      
                      {nbAuj > 0 ? 'Modifier la journée' : 'Déclarer la journée du jour'}
                      {!disabled && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{dateLabel}</span>}
                    </button>
                  </div>
                );
              })()}

              {/* Coûts réels */}
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Coûts réels</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                {[['Matériel réel (CHF)', 'materielReel'], ['Sous-traitance réelle (CHF)', 'sousTraitanceReelle'], ['Autres coûts réels (CHF)', 'autresCoutsReels']].map(([label, key]) => (
                  <div key={key}><label style={labelStyle}>{label}</label>
                    <input type="text" inputMode="numeric" placeholder="0"
                      value={form[key] ? fmtN(form[key]) : ''}
                      onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, [key]: raw }); }}
                      style={inputStyle} /></div>
                ))}
              </div>

              {/* Imprévus */}
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.danger, marginBottom: '12px' }}>Coûts imprévus</div>
              {form.imprevus.length > 0 && (
                <table className="table-cards" style={{ width: '100%', marginBottom: '10px' }}>
                  <thead><tr>{['Description', 'Montant (CHF)', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {form.imprevus.map((imp, i) => (
                      <tr key={`imp-${imp.description}-${imp.montant}-${i}`}>
                        <td style={tdStyle}>{imp.description}</td>
                        <td style={tdStyle}>CHF {fmtN(imp.montant)}</td>
                        <td style={tdStyle}><button onClick={() => setForm({ ...form, imprevus: form.imprevus.filter((_, idx) => idx !== i) })} style={btnDanger}><Trash2 size={13} /> Supprimer</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '20px' }}>
                <div><label style={labelStyle}>Description</label>
                  <input placeholder="Ex: Vitrage supplémentaire" value={imprévu.description} onChange={e => setImprévu({ ...imprévu, description: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Montant (CHF)</label>
                  <input type="text" inputMode="numeric" placeholder="1'500" value={imprévu.montant ? fmtN(imprévu.montant) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setImprévu({ ...imprévu, montant: raw }); }} style={inputStyle} /></div>
                <button onClick={ajouterImprévu} style={{ ...btnDanger, padding: '10px 15px' }}>+ Ajouter</button>
              </div>

              {/* Journal de chantier */}
              {(form.journal || []).length > 0 && (() => {
                // Grouper par date (format groupé : { date, employes: [{ employeId, heuresTravaillees }] })
                const parDate = {};
                for (const entry of form.journal || []) {
                  if (!parDate[entry.date]) parDate[entry.date] = { heuresParEmp: {}, totalH: 0 };
                  for (const e of (entry.employes || [])) {
                    const eid = parseInt(e.employeId); const h = parseFloat(e.heuresTravaillees) || 0;
                    parDate[entry.date].heuresParEmp[eid] = (parDate[entry.date].heuresParEmp[eid] || 0) + h;
                    parDate[entry.date].totalH += h;
                  }
                }
                const jours = Object.entries(parDate)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 10);
                const empsList = parametres.employes || [];
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>Journal</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {jours.map(([date, info]) => {
                        const d = new Date(date);
                        const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                        const noms = Object.entries(info.heuresParEmp)
                          .filter(([, h]) => h > 0)
                          .map(([eid, h]) => {
                            const emp = empsList.find(e => e.id === parseInt(eid));
                            return `${emp?.nom || '?'} (${h}h)`;
                          }).join(', ');
                        const nbPresents = Object.values(info.heuresParEmp).filter(h => h > 0).length;
                        return (
                          <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'var(--bg-glass)', borderRadius: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{label}</span>
                            <span style={{ color: C.secondaire, fontWeight: 600 }}>{nbPresents} empl. · {info.totalH}h</span>
                            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noms}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Notes terrain */}
              <div style={{ marginBottom: '15px' }}>
                <label style={labelStyle}>Notes terrain</label>
                <textarea placeholder="Observations, problèmes rencontrés..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '70px', resize: 'vertical' }} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>{form.id ? <><Pencil size={15}/> Enregistrer le suivi</> : <><Plus size={15}/> Créer le chantier</>}</button>
            <button onClick={() => { setAjout(false); setForm(vide); setErreurs({}); }} style={btnDanger}><X size={14}/> Annuler</button>
          </div>
        </div>
      )}

      {(() => {
        const getDecisionChantier = (etatC) => {
          // Incohérent — coûts saisis sans journées
          if (etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
            return { icone: '', label: 'Incohérent', couleur: '#90a4ae', message: 'Activité sans suivi', sous: 'Des coûts sont saisis sans journées déclarées', niveau: 'warning', priorite: 4 };
          // Terminé — avec variantes retard/avance/finalisé + marge
          if (etatC.avancementPct >= 100) {
            const msgT = etatC.deriveJours > 0
              ? `Terminé avec +${etatC.deriveJours} j de retard`
              : etatC.deriveJours < 0
                ? `Terminé avec ${Math.abs(etatC.deriveJours)} j d'avance`
                : 'Chantier finalisé';
            const sousT = (etatC.projectionDisponible && etatC.margeEstimee !== null)
              ? etatC.margeEstimee >= 0 ? `+CHF ${fmtN(Math.round(etatC.margeEstimee))} de marge` : `Perte CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`
              : null;
            return { icone: '', label: 'Terminé', couleur: '#78909c', message: msgT, sous: sousT, niveau: 'ok', priorite: 5 };
          }
          // Retard critique — sous-texte perte si les deux sont vrais
          if (etatC.deriveJours >= 5)
            return { niveau: 'danger', label: 'Retard critique', couleur: C.danger, message: `+${etatC.deriveJours} j de retard`, sous: (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0) ? `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}` : null, niveau: 'critique', priorite: 1 };
          // Perte estimée seule (sans retard critique)
          if (etatC.projectionDisponible && etatC.margeEstimee !== null && etatC.margeEstimee < 0)
            return { niveau: 'danger', label: 'Perte estimée', couleur: C.danger, message: `Perte estimée CHF ${fmtN(Math.abs(Math.round(etatC.margeEstimee)))}`, sous: 'Basé sur tendance actuelle', niveau: 'critique', priorite: 2 };
          // Retard léger
          if (etatC.deriveJours >= 2)
            return { niveau: 'warning', label: 'À surveiller', couleur: C.warning, message: `Retard léger : +${etatC.deriveJours} j`, sous: null, niveau: 'warning', priorite: 3 };
          // Tout va bien
          return { niveau: 'ok', label: 'Dans les temps', couleur: C.secondaire, message: 'Cadence normale', sous: null, niveau: 'ok', priorite: 6 };
        };
        const getActionsChantier = (etat, chantier) => {
          if (!etat || etat.avancementPct == null) return [];
          const nb = (etat.equipe || []).length || 1;
          if (etat.deriveJours >= 5)
            return [{ type: 'ajout_ouvrier',    label: 'Ajouter 1 ouvrier',        impact: `Gain estimé : -${Math.round(etat.deriveJours / nb)} j`,              couleur: C.danger }];
          if (etat.margeEstimee < 0 && etat.projectionDisponible)
            return [{ type: 'optimisation',     label: 'Réduire les coûts',         impact: `Gain estimé : +CHF ${fmtN(Math.abs(Math.round(etat.margeEstimee)))}`, couleur: C.danger }];
          if (etat.totalJoursReels === 0 && etat.coutTotalReel > 0)
            return [{ type: 'data',             label: 'Compléter les journées',    impact: 'Compléter les données',                                               couleur: C.warning }];
          if (etat.avancementPct >= 100)
            return [{ type: 'facturation',      label: 'Facturer le chantier',      impact: 'Facturation possible',                                                couleur: C.secondaire }];
          if (etat.deriveJours >= 2)
            return [{ type: 'surveillance',     label: 'Surveiller',                impact: 'Pas d\'action requise',                                               couleur: C.warning }];
          return   [{ type: 'continuer',        label: 'Continuer',                 impact: 'Pas d\'action requise',                                               couleur: C.secondaire }];
        };
        const simulerAction = (action, etat, chantier) => {
          if (!action) return null;
          if (action.type === 'ajout_ouvrier') {
            const equipeSize = (etat.equipe || []).length || 1;
            // Tarif journalier moyen de l'équipe actuelle
            const tarifsEquipe = (etat.equipe || []).map(m => {
              const emp = parametres.employes.find(e => e.id === (m.employeId || m.id));
              return emp ? (parseFloat(emp.tarifJour) || 0) : 350;
            });
            const tarifMoyen = tarifsEquipe.length > 0
              ? Math.round(tarifsEquipe.reduce((s, t) => s + t, 0) / tarifsEquipe.length)
              : 350;
            const joursRestants = Math.max(1, (parseInt(chantier.nombreJours) || 0) - etat.totalJoursReels);
            const scenarios = [1, 2, 3].map(nb => {
              const gain = Math.round(etat.deriveJours * (nb / equipeSize));
              const apres = Math.max(0, etat.deriveJours - gain);
              const coutAjout = tarifMoyen * nb * Math.max(1, gain);
              const ratio = gain > 0 ? gain / (coutAjout / 1000) : 0;
              return { nb, avant: etat.deriveJours, apres, gain, coutAjout, ratio };
            });
            // Recommandation : priorité aux délais tenus, sinon meilleur ratio
            const dansLesTemps = scenarios.filter(s => s.apres <= 0);
            const recommande = dansLesTemps.length > 0
              ? dansLesTemps.reduce((best, s) => s.coutAjout < best.coutAjout ? s : best, dansLesTemps[0]) // moins cher parmi ceux qui tiennent les délais
              : scenarios.reduce((best, s) => s.ratio > best.ratio ? s : best, scenarios[0]);
            // Seuil coût élevé : > 1 journée de chantier complet de l'équipe
            const seuilCoutEleve = tarifMoyen * equipeSize;
            const coutEleve = recommande.coutAjout > seuilCoutEleve;
            let recoRaison;
            if (recommande.apres <= 0)           recoRaison = 'Permet de finir dans les délais';
            else if (recommande.gain >= 3)       recoRaison = 'Réduit fortement le retard';
            else if (recommande.gain >= 1)       recoRaison = 'Amélioration modérée';
            else                                 recoRaison = 'Impact limité';
            if (coutEleve && recommande.apres > 0) recoRaison += ' mais avec un coût élevé';
            const recoDetail = `Gain : -${recommande.gain} jour${recommande.gain > 1 ? 's' : ''} pour CHF ${fmtN(recommande.coutAjout)}`;
            const nbLabel = `${recommande.nb} ouvrier${recommande.nb > 1 ? 's' : ''}`;
            let finalMessage, finalColor;
            if (recommande.apres <= 0)      { finalMessage = 'OK — chantier maîtrisé';                                                              finalColor = '#4ade80'; }
            else if (recommande.apres <= 2) { finalMessage = `Optimisation possible — ajouter ${nbLabel}`;                                          finalColor = C.warning; }
            else                            { finalMessage = `Action requise — ajouter ${nbLabel} (${recommande.apres} j de retard)`;               finalColor = C.danger; }
            return { type: 'gain_temps_multi', scenarios, recommande, recoRaison, recoDetail, finalMessage, finalColor };
          }
          if (action.type === 'optimisation') {
            const avant = Math.abs(Math.round(etat.margeEstimee));
            return { type: 'gain_marge', avant, apres: 0, gainLabel: `Gain : +CHF ${fmtN(avant)} de marge` };
          }
          return null;
        };
        const DECISION_INVALIDE = { icone: '', label: 'Données invalides', couleur: '#90a4ae', message: 'Impossible d\'analyser ce chantier', sous: 'Vérifier les données saisies', niveau: 'invalid', priorite: 0 };
        const scored = [...chantiersFiltres].map(c => {
          const etatC = calculerEtatChantier(c, parametres.employes, devis);
          const coherence = assertEtatCoherent(etatC);
          // Erreur critique → fallback immédiat, aucun calcul supplémentaire
          if (!coherence.ok)
            return { c, etatC, decision: DECISION_INVALIDE, indicateurs: [], actions: [] };
          const decision = getDecisionChantier(etatC);
          // Indicateurs secondaires — guards stricts
          const estTermine = etatC.avancementPct >= 100;
          const perteDejaExprimee = decision.priorite === 2 || (decision.priorite === 1 && decision.sous !== null);
          const deriveDejaExprimee = decision.priorite === 1 || decision.priorite === 3;
          const dataDejaExprimee   = decision.priorite === 4;
          const margeAbs = (etatC.margeEstimee !== null && !isNaN(etatC.margeEstimee)) ? Math.round(Math.abs(etatC.margeEstimee)) : 0;
          const todayStr = new Date().toISOString().split('T')[0];
          const hasHeuresAuj = (c.journal || []).some(e =>
            e.date === todayStr && (e.employes || []).some(emp => (parseFloat(emp.heuresTravaillees) || 0) > 0)
          );
          const ind = [];
          if (!estTermine && !perteDejaExprimee && etatC.projectionDisponible && margeAbs > 0 && etatC.margeEstimee < 0)
            ind.push({ type: 'perte',  label: `Perte CHF ${fmtN(margeAbs)}`,  couleur: C.danger,  tooltip: 'Le chantier est déficitaire selon la projection' });
          if (!estTermine && !dataDejaExprimee && etatC.totalJoursReels === 0 && etatC.coutTotalReel > 0)
            ind.push({ type: 'data',   label: 'Données',                        couleur: '#90a4ae', tooltip: 'Des données sont incohérentes ou manquantes' });
          if (!estTermine && !deriveDejaExprimee && etatC.totalJoursReels > 0 && etatC.deriveJours >= 2 && !isNaN(etatC.deriveJours))
            ind.push({ type: 'derive', label: `+${etatC.deriveJours} j`,        couleur: C.warning, tooltip: 'Décalage entre prévu et réel' });
          if (!estTermine && isChantierActif(c) && etatC.totalJoursReels > 0 && !hasHeuresAuj)
            ind.push({ type: 'no_hours', label: 'Aucune saisie aujourd\'hui', couleur: C.warning, tooltip: 'Aucune heure déclarée pour ce chantier aujourd\'hui' });
          const PRIO_IND = { perte: 0, data: 1, derive: 2, no_hours: 3 };
          const indicateurs = ind.sort((a, b) => PRIO_IND[a.type] - PRIO_IND[b.type]).slice(0, 2);
          return { c, etatC, decision, indicateurs, actions: getActionsChantier(etatC, c) };
        }).sort((a, b) => a.decision.priorite - b.decision.priorite);
        const nbCritique = scored.filter(x => x.decision.niveau === 'critique').length;
        const nbWarning  = scored.filter(x => x.decision.niveau === 'warning').length;
        return (
          <>
            {nbCritique > 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 18px', borderRadius: 12, marginBottom: 16,
                background: C.danger + '0f', border: `1px solid ${C.danger}30`, borderLeft: `4px solid ${C.danger}`,
              }}>
                <AlertTriangle size={18} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: C.danger }}>
                  {nbCritique} chantier{nbCritique > 1 ? 's' : ''} bloque{nbCritique > 1 ? 'nt' : ''} aujourd'hui
                </span>
              </div>
            ) : nbWarning > 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 18px', borderRadius: 12, marginBottom: 16,
                background: C.warning + '0f', border: `1px solid ${C.warning}30`, borderLeft: `4px solid ${C.warning}`,
              }}>
                <AlertTriangle size={18} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: C.warning }}>
                  {nbWarning} chantier{nbWarning > 1 ? 's' : ''} à surveiller
                </span>
              </div>
            ) : null}
            <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
              {scored.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  Aucun chantier à afficher
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Référence', 'Chantier', 'Client', 'Avancement', 'Marge', 'Statut', 'Actions'].map(col => (
                          <th key={col} style={DS.th}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scored.map(({ c, etatC, decision }) => {
                        const client = clients.find(cl => cl.id === c.clientId);
                        const sc = couleurStatut(c.statut);
                        const initiales = (c.nom || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const avancePct = Math.min(100, Math.max(0, etatC.avancementPct || 0));
                        return (
                          <tr
                            key={c.id}
                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                            onClick={() => { setSelected(c); setVue('detail'); setDetailOnglet('vue'); }}
                          >
                            <td style={DS.td}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>{c.numero}</span>
                            </td>
                            <td style={{ ...DS.td, maxWidth: 240 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                  background: decision.couleur + '22',
                                  border: `1px solid ${decision.couleur}40`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 800, color: decision.couleur,
                                }}>{initiales}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{c.ville}</div>
                                </div>
                              </div>
                            </td>
                            <td style={DS.td}>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{client?.entreprise || '—'}</span>
                            </td>
                            <td style={{ ...DS.td, minWidth: 140 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 100, height: 5, borderRadius: 3, background: 'var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${avancePct}%`, background: decision.couleur, borderRadius: 3, transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 30 }}>{avancePct}%</span>
                              </div>
                            </td>
                            <td style={DS.td}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: decision.couleur,
                                background: decision.couleur + '18', border: `1px solid ${decision.couleur}40`,
                                borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                              }}>{decision.label}</span>
                            </td>
                            <td style={DS.td}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg,
                                borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                              }}>{c.statut}</span>
                            </td>
                            <td style={{ ...DS.td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  onClick={() => { setSelected(c); setVue('detail'); setDetailOnglet('vue'); }}
                                  style={DS.iconBtn}
                                  title="Voir le détail"
                                ><Eye size={14} /></button>
                                <button
                                  onClick={() => ouvrirModification(c)}
                                  style={DS.iconBtn}
                                  title="Modifier"
                                ><Pencil size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>

  </React.Fragment>);
}

function Devis({ devis, setDevis, clients, parametres, naviguer, setChantiers, chantiers, contexte = {} }) {
  const [ajout, setAjout] = useState(false);
  const [filtreDevis, setFiltreDevis] = useState('Tous');
  const [confirmConversion, setConfirmConversion] = useState(null); // { devis, nomChantier }
  const vide = {
    numero: `DEV-${new Date().getFullYear()}-${String(Math.max(0, ...devis.map(d => parseInt((d.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`,
    clientId: '', date: new Date().toISOString().split('T')[0], statut: 'brouillon',
    montantHT: '', dureeEstimee: '', heuresRegie: [], notes: '',
  };
  const [form, setForm] = useState(vide);

  // Préremplissage depuis Import PDF
  React.useEffect(() => {
    if (!contexte?.prixPropose && !contexte?.lignes?.length) return;
    const lignesTexte = (contexte.lignes || []).length > 0
      ? '\n\nPostes détectés (PDF' + (contexte.source ? ' : ' + contexte.source : '') + ') :\n'
        + contexte.lignes.map(l => `• ${l.description}${l.prix > 0 ? ' — CHF ' + fmtN(l.prix) : ''}`).join('\n')
      : (contexte.source ? `\nSource : ${contexte.source}` : '');
    setForm(f => ({ ...f, montantHT: contexte.prixPropose || f.montantHT, notes: lignesTexte.trim() }));
    setAjout(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDateCH = (s) => { if (!s) return '—'; const [y, m, d] = (s || '').split('-'); return (d && m && y) ? `${d}.${m}.${y}` : s; };

  const sauvegarder = () => {
    if (!form.clientId) return;
    if (form.id) {
      setDevis(devis.map(d => d.id === form.id ? form : d));
      // Sync CA sur les chantiers liés si montantHT a changé
      if (form.montantHT) {
        setChantiers(chantiers.map(ch =>
          String(ch.devisId) === String(form.id) ? { ...ch, montantDevis: parseFloat(form.montantHT) || ch.montantDevis } : ch
        ));
      }
    } else {
      setDevis([...devis, { ...form, id: Date.now() }]);
    }
    setAjout(false); setForm(vide);
  };

  const ouvrirConfirmConversion = (d) => {
    const client = clients.find(c => c.id === d.clientId);
    const nomSuggere = client?.entreprise
      ? `${client.entreprise} — ${d.numero}`
      : `Chantier ${d.numero}`;
    setConfirmConversion({ devis: d, nomChantier: nomSuggere });
  };

  const confirmerConversion = () => {
    if (!confirmConversion) return;
    const { devis: d, nomChantier } = confirmConversion;
    const newId = Date.now();
    setChantiers(prev => [...prev, {
      id: newId,
      devisId: d.id,
      nom: nomChantier.trim() || `Chantier ${d.numero}`,
      numero: `CH-${new Date().getFullYear()}-${String(Math.max(0, ...prev.map(c => parseInt((c.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`,
      clientId: d.clientId,
      montantDevis: parseFloat(d.montantHT || d.prixPropose) || 0,
      surface: 0,
      statut: 'Planifié', priorite: 'Normale', avancement: 0,
      dateDebut: '', nombreJours: d.dureeEstimee || '',
      inclusSamedi: false, avenants: [], montantFacture: 0,
      typesTravaux: [], ville: '', canton: '', adresse: '',
      conducteur: '', directeurTravauxId: '', equipe: [], employes: [],
      coutMaterielPrevu: '', materielReel: '',
      coutSousTraitancePrevu: '', sousTraitanceReelle: '',
      autresCoutsPrevu: '', autresCoutsReels: '', imprevus: [],
      notes: `Créé depuis devis ${d.numero}`,
      journal: [],
    }]);
    setConfirmConversion(null);
    naviguer('chantiers', { chantierActif: newId, modeCompleter: true });
  };

  const STATUTS_COULEUR = {
    'brouillon': '#64748b', 'envoyé': C.info, 'accepté': C.secondaire, 'refusé': C.danger,
    'En cours': C.info, 'Validé': C.secondaire, 'Envoyé': C.info, 'Refusé': C.danger, 'Annulé': '#64748b', 'Signé': C.secondaire,
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Devis</div>
          <div className="page-title-sub">{devis.length} devis · {devis.filter(d => d.statut === 'accepté').length} acceptés ce mois</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => { setForm(vide); setAjout(!ajout); }} style={btnPrimaire}><Plus size={14} /> Nouveau devis</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const devisAcceptes = devis.filter(d => d.statut === 'accepté');
        const caSigné = devisAcceptes.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);
        const tauxAcceptation = devis.length > 0 ? Math.round((devisAcceptes.length / devis.length) * 100) : 0;
        const enAttente = devis.filter(d => d.statut === 'envoyé');
        const montantAttente = enAttente.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);
        const now = Date.now();
        const delaisMoyen = enAttente.length > 0
          ? Math.round(enAttente.reduce((s, d) => { const dt = d.dateEmission || d.date || 0; return s + Math.floor((now - new Date(dt)) / 86400000); }, 0) / enAttente.length)
          : null;
        const kpiItems = [
          { label: 'CA SIGNÉ',            val: `CHF ${fmtN(caSigné)}`, sous: `${devisAcceptes.length} devis accepté${devisAcceptes.length !== 1 ? 's' : ''}`, Icon: DollarSign, ...DS.kpi.green },
          { label: "TAUX D'ACCEPTATION",  val: `${tauxAcceptation}%`, sous: `sur ${devis.length} devis total`, Icon: TrendingUp, ...DS.kpi.blue },
          { label: 'EN ATTENTE RÉPONSE',  val: enAttente.length, sous: montantAttente > 0 ? `CHF ${fmtN(montantAttente)} en jeu` : 'Aucun en cours', Icon: Clock, ...DS.kpi.amber },
          { label: 'DÉLAI MOYEN',         val: delaisMoyen !== null ? `${delaisMoyen}j` : '—', sous: 'depuis envoi', Icon: FileText, ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.sous && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', marginTop: 5, position: 'relative' }}>{k.sous}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Filter pills ── */}
      {(() => {
        const STATUTS_DEVIS = ['Tous', 'brouillon', 'envoyé', 'accepté', 'refusé'];
        return (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {STATUTS_DEVIS.map(s => (
              <button key={s} onClick={() => setFiltreDevis(s)} style={{
                background: filtreDevis === s ? '#EEF2FF' : 'transparent',
                color: filtreDevis === s ? '#4F46E5' : 'var(--text-muted)',
                border: '1px solid transparent',
                padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
                fontWeight: filtreDevis === s ? 600 : 400, fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}>{s}</button>
            ))}
          </div>
        );
      })()}

      {ajout && (
        <div style={carteStyle}>
          <div style={{ marginBottom: 20 }}>
            <div className="ds-card-title" style={{ margin: 0 }}>{form.id ? 'Modifier' : 'Nouveau'} devis</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '14px', marginBottom: 20 }}>
            <div><label style={labelStyle}>Numéro</label><input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Client</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: parseInt(e.target.value) })} style={inputStyle}>
                <option value="">Sélectionner...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.entreprise}</option>)}
              </select></div>
            <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Statut</label>
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}>
                {['brouillon', 'envoyé', 'accepté', 'refusé'].map(s => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981', marginBottom: 12 }}>Montant signé HT</div>
            <input
              type="text" inputMode="numeric"
              placeholder="Ex : 45'000"
              value={form.montantHT ? fmtN(form.montantHT) : ''}
              onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, montantHT: raw }); }}
              style={{ ...inputStyle, fontSize: '22px', fontWeight: 800, borderColor: '#10b98160', letterSpacing: '-0.5px' }}
            />
            {form.montantHT && parseFloat(form.montantHT) > 0 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>CA enregistré :</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(parseFloat(form.montantHT))}</span>
                <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.14)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>HT</span>
              </div>
            )}
          </div>
          {/* ── Durée estimée ── */}
          <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6', marginBottom: 6 }}>Durée estimée (jours ouvrables)</div>
              <input
                type="number" min="1" step="1"
                placeholder="Ex : 15"
                value={form.dureeEstimee}
                onChange={e => setForm({ ...form, dureeEstimee: e.target.value })}
                style={{ ...inputStyle, width: 120, fontSize: 18, fontWeight: 700, borderColor: '#3b82f660' }}
              />
            </div>
            {form.dureeEstimee && parseInt(form.dureeEstimee) > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                ≈ <strong style={{ color: '#3b82f6' }}>{Math.ceil(parseInt(form.dureeEstimee) / 5)} semaine{Math.ceil(parseInt(form.dureeEstimee) / 5) > 1 ? 's' : ''}</strong> de travail
              </div>
            )}
          </div>

          {/* ── Heures en régie ── */}
          <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>⏱ Heures en régie (CA supplémentaire)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Heures facturées au temps passé — s'ajoutent au CA du devis</div>
              </div>
              <button
                onClick={() => setForm({ ...form, heuresRegie: [...(form.heuresRegie || []), { id: Date.now(), description: '', heures: '', tarifHeure: '' }] })}
                style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}
              >+ Ajouter une ligne</button>
            </div>
            {(form.heuresRegie || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune heure en régie — cliquez sur "Ajouter une ligne" pour en saisir.</div>
            )}
            {(form.heuresRegie || []).map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  placeholder="Description (ex: Travaux imprévus toiture)"
                  value={r.description}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, description: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="Heures"
                  value={r.heures}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, heures: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="CHF/h"
                  value={r.tarifHeure}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, tarifHeure: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setForm({ ...form, heuresRegie: form.heuresRegie.filter((_, j) => j !== i) })}
                  style={{ ...DS.btnDanger, padding: '6px 10px', fontSize: 12 }}
                >×</button>
              </div>
            ))}
            {(form.heuresRegie || []).length > 0 && (() => {
              const totalRegie = (form.heuresRegie || []).reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0);
              const totalCA = (parseFloat(form.montantHT) || 0) + totalRegie;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Régie total : </span><span style={{ fontWeight: 700, color: '#f59e0b' }}>CHF {fmtN(Math.round(totalRegie))}</span></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CA total (devis + régie) : </span><span style={{ fontWeight: 800, color: '#10b981' }}>CHF {fmtN(Math.round(totalCA))}</span></div>
                </div>
              );
            })()}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea placeholder="Observations, conditions particulières..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '70px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>Sauvegarder</button>
            <button onClick={() => { setAjout(false); setForm(vide); }} style={btnDanger}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── Liste des devis ── */}
      {(() => {
        const devisFiltres = filtreDevis === 'Tous' ? devis : devis.filter(d => d.statut === filtreDevis);
        return (
      <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
        {devisFiltres.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucun devis à afficher
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Référence', 'Date', 'Client', 'Chantier lié', 'CA HT', 'Statut', 'Actions'].map(col => (
                    <th key={col} style={DS.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devisFiltres.map(d => {
                  const client = clients.find(c => c.id === d.clientId);
                  const montant = parseFloat(d.montantHT || d.prixPropose) || 0;
                  const totalRegie = Array.isArray(d.heuresRegie)
                    ? d.heuresRegie.reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0)
                    : 0;
                  const chantierLie = chantiers.find(ch => String(ch.devisId) === String(d.id));
                  const isAccepte = d.statut === 'accepté';
                  const statutStyle = DS.statuts[d.statut] || { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr
                      key={d.id}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={DS.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>{d.numero}</span>
                      </td>
                      <td style={DS.td}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateCH(d.date)}</span>
                      </td>
                      <td style={{ ...DS.td, maxWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client?.entreprise || 'Client inconnu'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{client?.prenom} {client?.nom}</div>
                      </td>
                      <td style={DS.td}>
                        {chantierLie ? (
                          <span
                            onClick={() => naviguer('chantiers', { chantierActif: chantierLie.id })}
                            style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', display: 'inline-block' }}
                          >{chantierLie.numero} →</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={DS.td}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isAccepte ? '#10b981' : 'var(--text-primary)' }}>
                          CHF {fmtN(montant + totalRegie)}
                        </span>
                        {totalRegie > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>dont CHF {fmtN(Math.round(totalRegie))} régie</div>
                        )}
                      </td>
                      <td style={DS.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: statutStyle.color, background: statutStyle.bg,
                          borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                        }}>{d.statut}</span>
                      </td>
                      <td style={{ ...DS.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!chantierLie && isAccepte && (
                            <button onClick={() => ouvrirConfirmConversion(d)} style={{ ...DS.btnSuccess, padding: '6px 12px', fontSize: 12, gap: 5 }}>
                              <HardHat size={13} /> Créer le chantier
                            </button>
                          )}
                          <button
                            onClick={() => { setForm({ ...d, montantHT: d.montantHT || d.prixPropose || '' }); setAjout(true); }}
                            style={DS.iconBtn}
                            title="Modifier"
                          ><Pencil size={14} /></button>
                          <button
                            onClick={() => { if (window.confirm(`Supprimer le devis "${d.numero}" ?`)) setDevis(devis.filter(dv => dv.id !== d.id)); }}
                            style={{ ...DS.iconBtn, color: '#EF4444' }}
                            title="Supprimer"
                          ><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        );
      })()}

      {/* ── Modale confirmation conversion devis → chantier ── */}
      {confirmConversion && (() => {
        const d = confirmConversion.devis;
        const client = clients.find(c => c.id === d.clientId);
        const montant = parseFloat(d.montantHT || d.prixPropose) || 0;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmConversion(null)}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ds-card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#065F46,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardHat size={20} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Créer le chantier</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Depuis le devis {d.numero}</div>
                </div>
              </div>

              {/* Récap devis */}
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--ds-card-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Client</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{client?.entreprise || client?.nom || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Montant HT</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>CHF {fmtN(montant)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Durée estimée</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: d.dureeEstimee ? '#3b82f6' : 'var(--text-muted)' }}>
                    {d.dureeEstimee ? `${d.dureeEstimee}j ouvrables` : 'Non renseignée'}
                  </div>
                </div>
              </div>

              {/* Nom du chantier */}
              <div style={{ marginBottom: 24 }}>
                <label style={DS.label}>Nom du chantier</label>
                <input
                  autoFocus
                  value={confirmConversion.nomChantier}
                  onChange={e => setConfirmConversion({ ...confirmConversion, nomChantier: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && confirmerConversion()}
                  style={DS.input}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Statut initial : <strong>Planifié</strong> · Vous pourrez ajouter la date dans le Planning
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmConversion(null)} style={DS.btnGhost}>Annuler</button>
                <button onClick={confirmerConversion} style={DS.btnSuccess}>
                  <HardHat size={14} /> Créer le chantier
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Clients({ clients, setClients, chantiers, devis = [], naviguer }) {
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
  const sauvegarder = () => {
    if (!form.nom || !form.prenom) return;
    const formSain = sanitiser(form);
    if (form.id) setClients(clients.map(c => c.id === form.id ? formSain : c));
    else setClients([...clients, { ...formSain, id: Date.now() }]);
    setAjout(false);
    setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
  };
  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Clients</div>
          <div className="page-title-sub">{clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => { setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); setAjout(true); }} style={btnPrimaire}><Plus size={14}/> Nouveau client</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const caTotal = clients.reduce((s, c) => { const ch = chantiers.filter(ch => ch.clientId === c.id); return s + ch.reduce((t, ch) => t + (calculerCA(ch, devis) || 0), 0); }, 0);
        const nbAvecChantier = clients.filter(c => chantiers.some(ch => ch.clientId === c.id)).length;
        const nbActifs = clients.filter(c => chantiers.some(ch => ch.clientId === c.id && ch.statut === 'En cours')).length;
        const entreprises = clients.filter(c => c.type === 'Entreprise').length;
        const kpiItems = [
          { label: 'TOTAL CLIENTS',    val: clients.length,      Icon: Users,      ...DS.kpi.blue,   badge: `${nbActifs} actifs` },
          { label: 'CA TOTAL',         val: `CHF ${fmtN(caTotal)}`, Icon: DollarSign, ...DS.kpi.green },
          { label: 'AVEC CHANTIER',    val: nbAvecChantier,       Icon: HardHat,    ...DS.kpi.amber },
          { label: 'ENTREPRISES',       val: entreprises,           Icon: FileText,   ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
              </div>
            ))}
          </div>
        );
      })()}

      {ajout && (
        <div style={carteStyle}>
          <div className="ds-card-title">{form.id ? 'Modifier' : 'Nouveau'} client</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            {[['Prénom *', 'prenom', 'Marc'], ['Nom *', 'nom', 'Dupont'], ['Entreprise', 'entreprise', 'Dupont SA'], ['Téléphone', 'telephone', '022 000 00 00'], ['Email', 'email', 'email@example.ch'], ['Adresse', 'adresse', 'Rue...'], ['Ville', 'ville', 'Genève'], ['Canton', 'canton', 'GE']].map(([label, key, ph]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input placeholder={ph} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                {['Entreprise', 'Particulier', 'Architecte', "Bureau d'études", 'Promoteur'].map(t => <option key={t}>{t}</option>)}
              </select></div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea placeholder="Informations complémentaires, préférences, historique..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>{form.id ? 'Enregistrer les modifications' : 'Créer le client'}</button>
            <button onClick={() => { setAjout(false); setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); }} style={btnDanger}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        {clients.map(c => {
          const chantiersC = chantiers.filter(ch => ch.clientId === c.id);
          const ca = chantiersC.reduce((t, ch) => t + (calculerCA(ch, devis) ?? 0), 0);
          return (
            <div key={c.id} className="ds-card ds-animate-in" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '42px', height: '42px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.25) 100%)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.primaire, fontWeight: 800, fontSize: '15px',
                  boxShadow: '0 0 14px rgba(59,130,246,0.2)',
                }}>
                  {c.prenom?.charAt(0)}{c.nom?.charAt(0)}
                </div>
                <Badge texte={c.type} couleur={C.info} />
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.prenom} {c.nom}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>{c.entreprise}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.adresse}, {c.ville}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.telephone} · {c.email}</div>
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>Chantiers</div>
                  <div style={{ fontWeight: 800, color: C.primaire, fontSize: '20px' }}>{chantiersC.length}</div>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>CA Total</div>
                  <div style={{ fontWeight: 800, color: C.secondaire, fontSize: '14px' }}>CHF {fmtN(ca)}</div>
                </div>
              </div>
              {c.notes && (
                <div style={{ marginTop: '10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {c.notes}
                </div>
              )}
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => naviguer('chantiers', { clientActif: c.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <HardHat size={13} /> Chantiers ({chantiersC.length})
                </button>
                <button onClick={() => naviguer('devis', { clientActif: c.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <FileText size={13} /> Devis
                </button>
                <button onClick={() => { setForm(c); setAjout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <Pencil size={13} /> Modifier
                </button>
                <button onClick={() => { if (window.confirm(`Supprimer ${c.prenom} ${c.nom} ?`)) setClients(clients.filter(cl => cl.id !== c.id)); }} style={{ ...btnDanger, padding: '6px 10px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Employes({ parametres, setParametres, chantiers, naviguer }) {
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
  const sauvegarder = () => {
    if (!form.nom || !form.tarifJour) return;
    if (form.id) setParametres({ ...parametres, employes: parametres.employes.map(e => e.id === form.id ? { ...form, tarifJour: parseFloat(form.tarifJour) } : e) });
    else setParametres({ ...parametres, employes: [...parametres.employes, { ...form, id: Date.now(), tarifJour: parseFloat(form.tarifJour) }] });
    setAjout(false);
    setForm({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
  };
  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Équipe</div>
          <div className="page-title-sub">{(parametres.employes || []).length} employé{(parametres.employes || []).length !== 1 ? 's' : ''} · {(parametres.employes || []).filter(e => e.actif !== false).length} actifs sur le terrain</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => setAjout(!ajout)} style={btnPrimaire}><Plus size={14}/> Nouvel employé</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const employes = parametres.employes || [];
        const nbActifs = employes.filter(e => e.actif !== false).length;
        const heuresTotal = chantiers.reduce((s, c) => s + (c.journal || []).reduce((js, j) => js + (j.employes || []).reduce((es, e) => es + (parseFloat(e.heuresTravaillees) || 0), 0), 0), 0);
        const coutMensuel = employes.filter(e => e.actif !== false).reduce((s, e) => s + (parseFloat(e.tarifJour) || 0) * 20, 0);
        const tarifMoyen = nbActifs > 0 ? Math.round(employes.filter(e => e.actif !== false).reduce((s, e) => s + (parseFloat(e.tarifJour) || 0), 0) / nbActifs) : 0;
        const kpiItems = [
          { label: 'EFFECTIF',      val: employes.length, Icon: Users,      ...DS.kpi.blue,   badge: `${nbActifs} actifs` },
          { label: 'HEURES TOTALES',val: `${fmtN(Math.round(heuresTotal))}h`, Icon: Clock, ...DS.kpi.green },
          { label: 'COÛT MENSUEL',  val: `CHF ${fmtN(coutMensuel)}`, Icon: DollarSign, ...DS.kpi.amber },
          { label: 'TARIF MOYEN',   val: `CHF ${fmtN(tarifMoyen)}/j`, Icon: TrendingUp, ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
              </div>
            ))}
          </div>
        );
      })()}

      {ajout && (
        <div style={carteStyle}>
          <div className="ds-card-title">{form.id ? 'Modifier' : 'Nouvel'} employé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div><label style={labelStyle}>Nom complet *</label><input placeholder="Jean Martin" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Rôle *</label>
              <select value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} style={inputStyle}>
                {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
              </select></div>
            <div><label style={labelStyle}>Tarif/jour (CHF) *</label><input type="text" inputMode="numeric" placeholder="350" value={form.tarifJour ? fmtN(form.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, tarifJour: raw }); }} style={inputStyle} /></div>
            <div><label style={labelStyle}>Téléphone</label><input placeholder="079 000 00 00" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input placeholder="email@cyna.ch" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} />
                <label>Employé actif</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={form.tarifDejaCharge || false} onChange={e => setForm({ ...form, tarifDejaCharge: e.target.checked })} />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tarif déjà chargé (charges incluses)</label>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>Sauvegarder</button>
            <button onClick={() => setAjout(false)} style={btnDanger}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        {parametres.employes.map(e => {
          const chantiersEmp = chantiers.filter(c => c.equipe?.some(m => parseInt(m.employeId) === e.id));
          const joursTotal = chantiers.reduce((t, c) => { const m = c.equipe?.find(m => parseInt(m.employeId) === e.id); return t + (m ? parseInt(m.joursPlannifies || 0) : 0); }, 0);
          const couleurPoste = { 'Chef de chantier': C.primaire, "Chef d'équipe": C.info, 'Ouvrier qualifié': C.secondaire, 'Manœuvre': C.orange, 'Sous-traitant': C.violet, 'Technicien': '#06b6d4', 'Comptable': '#a855f7' }[e.poste] || C.primaire;
          return (
            <div key={e.id} style={{ ...carteStyle, opacity: e.actif ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '44px', height: '44px',
                  background: `linear-gradient(135deg, ${couleurPoste}40 0%, ${couleurPoste}20 100%)`,
                  border: `1px solid ${couleurPoste}40`,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: couleurPoste, fontWeight: 800, fontSize: '17px',
                  boxShadow: `0 0 14px ${couleurPoste}25`,
                }}>{e.nom.charAt(0)}</div>
                <Badge texte={e.poste} couleur={couleurPoste} />
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{e.nom}</div>
                {e.telephone && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>{e.telephone}</div>}
                {e.email && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{e.email}</div>}
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'CHF/jour', val: `${e.tarifJour}`, couleur: C.primaire },
                  { label: 'Chantiers', val: chantiersEmp.length, couleur: C.secondaire },
                  { label: 'Jours', val: joursTotal, couleur: C.violet },
                ].map(s => (
                  <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ fontWeight: 800, color: s.couleur, fontSize: '15px' }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => naviguer('chantiers', { employeActif: e.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <HardHat size={13} /> Chantiers ({chantiersEmp.length})
                </button>
                <button onClick={() => { setForm(e); setAjout(true); }} style={{ ...DS.btnGhost, padding: '6px 10px' }}><Pencil size={13} /></button>
                <button onClick={() => { if (window.confirm(`Supprimer ${e.nom} ?`)) setParametres({ ...parametres, employes: parametres.employes.filter(emp => emp.id !== e.id) }); }} style={{ ...btnDanger, padding: '6px 10px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Composant défini à niveau module pour stabilité React (ne pas définir à l'intérieur d'un autre composant)
function EditEmployeRow({ e, parametres, sauv }) {
  const [ed, setEd] = useState({ ...e });
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <tr key={e.id}>
      <td style={tdStyle}><strong>{e.nom}</strong></td>
      <td style={tdStyle}>{e.poste || '—'}</td>
      <td style={tdStyle}><strong style={{ color: C.primaire }}>CHF {e.tarifJour}.-/j</strong></td>
      <td style={tdStyle}>{e.telephone || '—'}</td>
      <td style={tdStyle}>{e.email || '—'}</td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditing(true)} style={{ ...DS.btnGhost, padding: '4px 10px', fontSize: 12 }}><Pencil size={12} /> Modifier</button>
          <button onClick={() => { if (window.confirm(`Supprimer ${e.nom} ?`)) sauv({ ...parametres, employes: parametres.employes.filter(emp => emp.id !== e.id) }); }} style={{ ...btnDanger, padding: '4px 8px' }}>Suppr</button>
        </div>
      </td>
    </tr>
  );
  return (
    <tr key={e.id} style={{ background: 'rgba(59,130,246,0.06)' }}>
      <td style={tdStyle}><input value={ed.nom} onChange={ev => setEd({ ...ed, nom: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}>
        <select value={ed.poste || ''} onChange={ev => setEd({ ...ed, poste: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }}>
          {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
        </select>
      </td>
      <td style={tdStyle}><input type="text" inputMode="numeric" value={ed.tarifJour ? fmtN(ed.tarifJour) : ''} onChange={ev => { const raw = ev.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setEd({ ...ed, tarifJour: raw }); }} style={{ ...inputStyle, padding: '5px 8px', width: 80 }} /></td>
      <td style={tdStyle}><input value={ed.telephone || ''} onChange={ev => setEd({ ...ed, telephone: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}><input value={ed.email || ''} onChange={ev => setEd({ ...ed, email: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { sauv({ ...parametres, employes: parametres.employes.map(emp => emp.id === e.id ? { ...ed, tarifJour: parseFloat(ed.tarifJour) } : emp) }); setEditing(false); }} style={btnSucces}>OK</button>
          <button onClick={() => setEditing(false)} style={btnDanger}>×</button>
        </div>
      </td>
    </tr>
  );
}

// ── Planning + Calendrier ─────────────────────────────────────────────────
function PlanningPage({ chantiers, setChantiers, clients, devis, factures, naviguer }) {
  const [onglet, setOnglet] = useState('planning');
  const tabs = [{ id: 'planning', label: 'Planning' }, { id: 'calendrier', label: 'Calendrier' }];
  const pillActive = { background: '#EEF2FF', color: '#4F46E5', border: '1px solid transparent' };
  const pillInactive = { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ ...onglet === t.id ? pillActive : pillInactive, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>
      {onglet === 'planning'   && <Planning chantiers={chantiers} setChantiers={setChantiers} clients={clients} naviguer={naviguer} />}
      {onglet === 'calendrier' && <Calendrier chantiers={chantiers} clients={clients} devis={devis} factures={factures} />}
    </div>
  );
}

// ── Rapport + Statistiques + Analyse ─────────────────────────────────────
function RapportsPage({ chantiers, clients, devis, parametres, setParametres, paiementsData, qualiteData, periodeGlobale, naviguer }) {
  const [onglet, setOnglet] = useState('marges');
  const tabs = [
    { id: 'marges',       label: 'Marges' },
    { id: 'rapport',      label: 'Rapport' },
    { id: 'statistiques', label: 'Statistiques' },
    { id: 'analyse',      label: 'Analyse' },
  ];
  const pillActive = { background: '#EEF2FF', color: '#4F46E5', border: '1px solid transparent' };
  const pillInactive = { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ ...onglet === t.id ? pillActive : pillInactive, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>
      {onglet === 'marges'       && <Marges chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} />}
      {onglet === 'rapport'      && <Rapport chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} paiementsData={paiementsData} qualiteData={qualiteData} naviguer={naviguer} />}
      {onglet === 'statistiques' && <Statistiques chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} periodeGlobale={periodeGlobale} />}
      {onglet === 'analyse'      && <Analyse chantiers={chantiers} clients={clients} devis={devis} parametres={parametres} setParametres={setParametres} paiementsData={paiementsData} qualiteData={qualiteData} />}
    </div>
  );
}

function Parametres({ parametres, setParametres, clients = [], setClients = () => {}, chantiers = [], devis = [], naviguer = () => {} }) {
  const [onglet, setOnglet] = useState('dashboard');
  const [nouvelEmploye, setNouvelEmploye] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '' });
  const [nouvelleLocalite, setNouvelleLocalite] = useState({ nom: '', tarifJour: '' });
  const [nouveauTravail, setNouveauTravail] = useState({ nom: '', unite: 'm²', tarifBase: '' });
  const [saved, setSaved] = useState(false);
  const timerSaved = React.useRef(null);

  const sauv = (data) => {
    setParametres(data);
    if (timerSaved.current) clearTimeout(timerSaved.current);
    setSaved(true);
    timerSaved.current = setTimeout(() => setSaved(false), 2500);
  };

  const onglets = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Alertes et affichage' },
    { id: 'chantiers', label: 'Chantiers', desc: 'Statuts et priorités' },
    { id: 'devis', label: 'Devis', desc: 'Marges et tarifs' },
    { id: 'employes', label: 'Employés', desc: 'Tarifs journaliers' },
    { id: 'clients_param', label: 'Clients', desc: 'Carnet d\'adresses' },
    { id: 'localites', label: 'Localités', desc: 'Frais déplacement' },
    { id: 'travaux', label: 'Travaux', desc: 'Types et tarifs' },
    { id: 'zones', label: 'Zones géo.', desc: 'Tarifs par région' },
    { id: 'metrage', label: 'Métrage', desc: 'Rendements équipe' },
    { id: 'qualite', label: 'Qualité', desc: 'Checklists' },
    { id: 'paiements', label: 'Paiements', desc: 'Délais et rappels' },
    { id: 'rapport', label: 'Rapport', desc: 'Alertes hebdo' },
  ];

  return (
    <div>
      {/* ── Toast de confirmation ── */}
      {saved && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
          border: '1px solid rgba(16,185,129,0.5)', borderRadius: 14,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(16,185,129,0.35)', backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ fontSize: 18 }}>✔</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Paramètres enregistrés</span>
        </div>
      )}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Paramètres</div>
          <div className="page-title-sub">Configuration de l'application · sauvegarde automatique</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => sauv({ ...parametres })} style={btnSucces}>
            Sauvegarder tout
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Sidebar nav ── */}
        <div style={{ ...DS.card, padding: 8 }}>
          {onglets.map(o => {
            const isActive = onglet === o.id;
            return (
              <div key={o.id} onClick={() => setOnglet(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? '#EEF2FF' : 'transparent',
                color: isActive ? '#4F46E5' : 'var(--text-primary)',
                transition: 'all 0.15s', marginBottom: 2,
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500 }}>{o.label}</span>
                <span style={{ fontSize: 10, color: isActive ? '#6366F1' : 'var(--text-muted)', flex: 2, display: 'none' }}>{o.desc}</span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: isActive ? '#4F46E5' : 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div>
      {onglet === 'dashboard' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            {[['Alerte jours restants', 'joursAlerte'], ['Nb chantiers affichés', 'nbChantiersAffiche'], ['Période stats (mois)', 'periodeStats']].map(([label, key]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || ''} placeholder="5"
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'chantiers' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Chantiers</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Statuts disponibles</div>
              {['À chiffrer', 'Devis envoyé', 'Validé', 'En préparation', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: { 'En cours': C.warning, 'Terminé': C.secondaire, 'Planifié': C.info, 'Suspendu': C.danger, 'Facturé': C.violet }[s] || C.primaire }} />
                  <span style={{ fontSize: '14px' }}>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Priorités</div>
              {['Basse', 'Normale', 'Haute', 'Urgente'].map(p => (
                <div key={p} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-secondary)' }}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === 'devis' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Devis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '15px' }}>
            {[['Marge cible (%)', 'margeCible'], ['Seuil min. (%)', 'seuilRentabiliteMin'], ['Plafond crédibilité (%)', 'plafondCredi'], ['Frais généraux (%)', 'tauxFraisGeneraux'], ['Coeff. MO', 'coefficientMainOeuvre'], ['TVA (%)', 'tauxTVA']].map(([label, key]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || ''}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'employes' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Tarifs employés</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Nom', 'Rôle', 'CHF/jour', 'Téléphone', 'Email', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {parametres.employes.map(e => <EditEmployeRow key={e.id} e={e} parametres={parametres} sauv={sauv} />)}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un employé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            {[['Nom', 'nom', 'Jean Martin'], ['CHF/jour', 'tarifJour', '350'], ['Téléphone', 'telephone', '079...'], ['Email', 'email', 'email@cyna.ch']].map(([label, key, ph]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type={key === 'tarifJour' ? 'number' : 'text'} placeholder={ph} value={nouvelEmploye[key]}
                  onChange={e => setNouvelEmploye({ ...nouvelEmploye, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={labelStyle}>Rôle</label>
              <select value={nouvelEmploye.poste} onChange={e => setNouvelEmploye({ ...nouvelEmploye, poste: e.target.value })} style={inputStyle}>
                {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
              </select></div>
            <button onClick={() => {
              if (nouvelEmploye.nom && nouvelEmploye.tarifJour) {
                sauv({ ...parametres, employes: [...parametres.employes, { ...nouvelEmploye, id: Date.now(), tarifJour: parseFloat(nouvelEmploye.tarifJour) }] });
                setNouvelEmploye({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'localites' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Localités & Déplacements</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Ville', 'CHF/jour déplacement', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {parametres.localites.map(l => (
                <tr key={l.id}>
                  <td style={tdStyle}><input value={l.nom} onChange={e => { const u = parametres.localites.map(loc => loc.id === l.id ? { ...loc, nom: e.target.value } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
                  <td style={tdStyle}><input type="text" inputMode="numeric" value={l.tarifJour ? fmtN(l.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const u = parametres.localites.map(loc => loc.id === l.id ? { ...loc, tarifJour: parseFloat(raw) || 0 } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px', width: 100, color: C.primaire, fontWeight: 700 }} /></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm(`Supprimer ${l.nom} ?`)) sauv({ ...parametres, localites: parametres.localites.filter(loc => loc.id !== l.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter une localité</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Ville</label><input placeholder="Fribourg" value={nouvelleLocalite.nom} onChange={e => setNouvelleLocalite({ ...nouvelleLocalite, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>CHF/jour</label><input type="text" inputMode="numeric" placeholder="45" value={nouvelleLocalite.tarifJour ? fmtN(nouvelleLocalite.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setNouvelleLocalite({ ...nouvelleLocalite, tarifJour: raw }); }} style={inputStyle} /></div>
            <button onClick={() => {
              if (nouvelleLocalite.nom && nouvelleLocalite.tarifJour) {
                sauv({ ...parametres, localites: [...parametres.localites, { ...nouvelleLocalite, id: Date.now(), tarifJour: parseFloat(nouvelleLocalite.tarifJour) }] });
                setNouvelleLocalite({ nom: '', tarifJour: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'travaux' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Types de travaux</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Type de travaux', 'Unité', 'Tarif de base', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {parametres.typesTravaux.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}><input value={t.nom} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, nom: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '200px' }} /></td>
                  <td style={tdStyle}><select value={t.unite} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, unite: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '100px' }}>{['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}</select></td>
                  <td style={tdStyle}><input type="text" inputMode="numeric" value={t.tarifBase ? fmtN(t.tarifBase) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, tarifBase: parseFloat(raw) || 0 } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '100px' }} /></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm('Supprimer ce type de travaux ?')) sauv({ ...parametres, typesTravaux: parametres.typesTravaux.filter(tr => tr.id !== t.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Nom</label><input placeholder="Ex: Bardage" value={nouveauTravail.nom} onChange={e => setNouveauTravail({ ...nouveauTravail, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Unité</label>
              <select value={nouveauTravail.unite} onChange={e => setNouveauTravail({ ...nouveauTravail, unite: e.target.value })} style={inputStyle}>
                {['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}
              </select></div>
            <div><label style={labelStyle}>Tarif base (CHF)</label><input type="text" inputMode="numeric" placeholder="100" value={nouveauTravail.tarifBase ? fmtN(nouveauTravail.tarifBase) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setNouveauTravail({ ...nouveauTravail, tarifBase: raw }); }} style={inputStyle} /></div>
            <button onClick={() => {
              if (nouveauTravail.nom) {
                sauv({ ...parametres, typesTravaux: [...parametres.typesTravaux, { ...nouveauTravail, id: Date.now(), tarifBase: parseFloat(nouveauTravail.tarifBase) || 0 }] });
                setNouveauTravail({ nom: '', unite: 'm²', tarifBase: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'zones' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Tarifs par zone géographique</div>
          <table className="table-cards" style={{ width: '100%' }}>
            <thead><tr>
              <th style={thStyle}>Type de travaux</th>
              {parametres.zones.slice(0, 4).map(z => <th key={z.id} style={thStyle}>{z.nom}</th>)}
            </tr></thead>
            <tbody>
              {parametres.typesTravaux.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}><strong>{t.nom}</strong></td>
                  {parametres.zones.slice(0, 4).map(z => (
                    <td key={z.id} style={tdStyle}>
                      <input type="text" inputMode="numeric"
                        value={z.tarifs?.[t.nom] ? fmtN(z.tarifs[t.nom]) : ''}
                        placeholder={t.tarifBase}
                        onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const nz = parametres.zones.map(zone => zone.id === z.id ? { ...zone, tarifs: { ...zone.tarifs, [t.nom]: parseFloat(raw) } } : zone); sauv({ ...parametres, zones: nz }); }}
                        style={{ ...inputStyle, width: '80px', padding: '4px 8px' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'metrage' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Métrage</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            {[
              { label: 'Rendement fp surélevé (m²/j)', key: 'rendementFPSureleve', defaut: 70 },
              { label: 'Rendement fp non démontable', key: 'rendementFPNonDemo', defaut: 80 },
              { label: 'Rendement dallettes doubles', key: 'rendementDallettes', defaut: 40 },
              { label: 'Rendement moquette', key: 'rendementMoquette', defaut: 120 },
              { label: 'Rendement carrelage', key: 'rendementCarrelage', defaut: 35 },
              { label: 'Rendement joint (ml/j)', key: 'rendementJoint', defaut: 60 },
            ].map(s => (
              <div key={s.key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                <label style={labelStyle}>{s.label}</label>
                <input type="number" value={parametres.parametres?.[s.key] || s.defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [s.key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', color: C.primaire, borderColor: C.primaire }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            {[
              ["Tarif chef d'équipe (CHF/j)", 'tarifChefEquipe', 450],
              ['Tarif ouvrier qualifié (CHF/j)', 'tarifOuvrier', 350],
              ["Tarif main d'œuvre (CHF/j)", 'tarifMainOeuvre', 280],
            ].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'qualite' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres Qualité</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {[['Seuil score Bon (%)', 'qualiteSeuilBon', 80], ['Seuil score Moyen (%)', 'qualiteSeuilMoyen', 50]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'paiements' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres Paiements</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            {[['Délai paiement (jours)', 'delaiPaiement', 30], ['Alerte retard (jours)', 'alerteRetardPaiement', 7], ['Acompte standard (%)', 'acompteStandard', 30]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'rapport' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Rapport</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            {[['Seuil alerte chantier (jours)', 'joursAlerte', 5], ['Marge minimale alerte (%)', 'margeMinAlerte', 15], ['Montant retard alerte (CHF)', 'montantRetardAlerte', 1000]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'clients_param' && (
        <Clients clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />
      )}
        </div>{/* end content panel */}
      </div>{/* end 260/1fr grid */}
    </div>
  );
}

export default App;