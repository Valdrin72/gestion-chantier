import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  LayoutDashboard, HardHat, FileText, Users, Calendar,
  BarChart2, CheckSquare, ClipboardList, TrendingUp,
  Settings, Moon, Sun, LogOut,
  Menu, X, Plus, Pencil, Trash2, AlertTriangle,
  ChevronRight, DollarSign, Clock, Bot, Eye,
} from 'lucide-react';
import { donneesInitiales, fmtN, calculerDateFinOuvrables, joursOuvrableRestants, getAlerte, getAlerteChantier, getChantierStatus, calculerCoutsChantier, statutRentabilite, C, getPeriodeLabel, chantiersInPeriode, calculerJoursRestants, calculerEcartChantier, calculerEtatChantier, assertEtatValide, assertEtatCoherent, calculerVitesseChantier, migrerJournal, migrerDevisId, heuresEmploye, heuresJour, sommeAvenants, calculerCA, isChantierActif } from './donnees';
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
import { STATUTS_CLOS } from './constants/statuts';
import ModalSaisieHeures from './components/ModalSaisieHeures';
import { Badge, CoutBadge, BarreAvancement, BadgeRentabilite } from './components/SharedBadges';
import Dashboard from './pages/Dashboard';
import Chantiers from './pages/ChantiersPage';

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
  const [qualiteData, setQualiteDataState] = useState(() => charger('cyna_qualite', {}));
  const [factures, setFacturesState] = useState(() => charger('cyna_factures', [], Array.isArray));
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

        {/* ── MODAL SAISIE HEURES — chantier dérivé en live depuis chantiers[] (jamais stale) ── */}
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

function Devis({ devis, setDevis, clients, parametres, naviguer, setChantiers, chantiers, contexte = {} }) {
  const [ajout, setAjout] = useState(false);
  const [filtreDevis, setFiltreDevis] = useState('Tous');
  const [confirmConversion, setConfirmConversion] = useState(null); // { devis, nomChantier }
  const vide = {
    numero: `DEV-${new Date().getFullYear()}-${String(Math.max(0, ...devis.map(d => parseInt((d.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`,
    clientId: '', date: new Date().toISOString().split('T')[0], statut: 'brouillon',
    montantHT: '', dureeEstimee: '', nombrePersonnes: '', avenants: [], heuresRegie: [], notes: '',
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
      dateDebut: '', nombreJours: d.dureeEstimee || '', nombrePersonnes: d.nombrePersonnes || '',
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
          {/* ── Durée estimée + Personnes prévues ── */}
          <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6', marginBottom: 6 }}>Durée estimée (jours ouvrables)</div>
                <input
                  type="number" min="1" step="1"
                  placeholder="Ex : 15"
                  value={form.dureeEstimee}
                  onChange={e => setForm({ ...form, dureeEstimee: e.target.value })}
                  style={{ ...inputStyle, width: 120, fontSize: 18, fontWeight: 700, borderColor: '#3b82f660' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b', marginBottom: 6 }}>Personnes prévues</div>
                <input
                  type="number" min="1" step="1"
                  placeholder="Ex : 3"
                  value={form.nombrePersonnes || ''}
                  onChange={e => setForm({ ...form, nombrePersonnes: e.target.value })}
                  style={{ ...inputStyle, width: 100, fontSize: 18, fontWeight: 700, borderColor: '#f59e0b60' }}
                />
              </div>
              {form.dureeEstimee && parseInt(form.dureeEstimee) > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 6 }}>
                  ≈ <strong style={{ color: '#3b82f6' }}>{Math.ceil(parseInt(form.dureeEstimee) / 5)} semaine{Math.ceil(parseInt(form.dureeEstimee) / 5) > 1 ? 's' : ''}</strong> de travail
                  {parseInt(form.nombrePersonnes) > 0 && (
                    <span style={{ marginLeft: 12, color: '#f59e0b', fontWeight: 700 }}>
                      · {parseInt(form.dureeEstimee) * parseInt(form.nombrePersonnes)} jours-homme
                      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                        ({form.dureeEstimee}j × {form.nombrePersonnes} pers.)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Avenants ── */}
          <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b5cf6' }}>📋 Avenants (travaux supplémentaires)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Travaux additionnels négociés — s'ajoutent au CA du devis</div>
              </div>
              <button
                onClick={() => setForm({ ...form, avenants: [...(form.avenants || []), { id: Date.now(), description: '', montant: '' }] })}
                style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}
              >+ Ajouter un avenant</button>
            </div>
            {(form.avenants || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun avenant — cliquez sur "Ajouter un avenant" si des travaux supplémentaires ont été négociés.</div>
            )}
            {(form.avenants || []).map((a, i) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  placeholder="Description (ex: Extension terrasse sud)"
                  value={a.description}
                  onChange={e => { const l = [...form.avenants]; l[i] = { ...a, description: e.target.value }; setForm({ ...form, avenants: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="Montant CHF HT"
                  value={a.montant}
                  onChange={e => { const l = [...form.avenants]; l[i] = { ...a, montant: e.target.value }; setForm({ ...form, avenants: l }); }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setForm({ ...form, avenants: form.avenants.filter((_, j) => j !== i) })}
                  style={{ ...DS.btnDanger, padding: '6px 10px', fontSize: 12 }}
                >×</button>
              </div>
            ))}
            {(form.avenants || []).length > 0 && (() => {
              const totalAvenants = (form.avenants || []).reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);
              const totalCA = (parseFloat(form.montantHT) || 0) + totalAvenants;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(139,92,246,0.2)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total avenants : </span><span style={{ fontWeight: 700, color: '#8b5cf6' }}>CHF {fmtN(Math.round(totalAvenants))}</span></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CA total (devis + avenants) : </span><span style={{ fontWeight: 800, color: '#10b981' }}>CHF {fmtN(Math.round(totalCA))}</span></div>
                </div>
              );
            })()}
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
                  const totalAvenants = Array.isArray(d.avenants)
                    ? d.avenants.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)
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
                          CHF {fmtN(montant + totalRegie + totalAvenants)}
                        </span>
                        {totalAvenants > 0 && (
                          <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 1 }}>dont CHF {fmtN(Math.round(totalAvenants))} avenants</div>
                        )}
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
                  {d.nombrePersonnes && parseInt(d.nombrePersonnes) > 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
                      {parseInt(d.dureeEstimee) * parseInt(d.nombrePersonnes)} jours-homme ({d.nombrePersonnes} pers.)
                    </div>
                  )}
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