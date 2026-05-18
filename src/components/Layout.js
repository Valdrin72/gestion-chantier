import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Sun, Moon, Menu, X, ChevronRight, LogOut, Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculerAlertes } from '../alertes';

export function Sidebar({ sidebarOuvert, setSidebarOuvert, navAutorisees, page, naviguer, darkMode, toggleDarkMode, profil, deconnecter }) {
  return (
    <>
      {sidebarOuvert && <div className="sidebar-overlay" onClick={() => setSidebarOuvert(false)} />}
      <aside className={`sidebar${sidebarOuvert ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo" style={{ padding: '18px 16px' }}>
          <img
            src={`${process.env.PUBLIC_URL}/logo-cyna-tech.png`}
            alt="CYNA Tech"
            style={{
              height: 16,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: darkMode ? 'brightness(0) invert(1)' : 'brightness(0)',
            }}
          />
        </div>
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
              {item.badge && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, lineHeight: 1.6, flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button className="sidebar-cta" onClick={() => { naviguer('devis', { ouvrirNouveau: true }); setSidebarOuvert(false); }}>
          <Plus size={16} strokeWidth={2.6} /> Nouveau devis
        </button>
        <button className="sidebar-theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
          <div className={`sidebar-toggle-track${darkMode ? ' on' : ''}`}>
            <div className="sidebar-toggle-thumb" />
          </div>
          {darkMode ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
          <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
        <div className="sidebar-profile" style={{ cursor: 'default' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: profil?.couleur || '#3382c2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: 'white',
          }}>
            {profil?.icone || '◈'}
          </div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{profil?.nom || 'Utilisateur'}</div>
            <div className="sidebar-profile-role">{profil?.id || ''}</div>
          </div>
          {deconnecter && (
            <button
              onClick={deconnecter}
              title="Se déconnecter"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 18, padding: '4px',
                marginLeft: 'auto', opacity: 0.6, transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Utilitaire date relative ────────────────────────────────────────────────
function dateRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures}h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours}j`;
  return `il y a ${Math.floor(jours / 7)} sem`;
}

// ── Icône selon niveau d'alerte ─────────────────────────────────────────────
function IconeNiveau({ niveau }) {
  if (niveau === 'critique') return <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />;
  if (niveau === 'warning')  return <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />;
  return <Info size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />;
}

// ── Centre de notifications ──────────────────────────────────────────────────
function NotificationBell({ naviguer }) {
  const { chantiers, devis, factures, paiementsData, clients, profil } = useApp();
  const [ouvert, setOuvert] = useState(false);
  const [lues, setLues] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyna_notifs_lues') || '[]'); } catch { return []; }
  });

  const alertes = useMemo(() =>
    calculerAlertes(
      { chantiers: chantiers || [], devis: devis || [], factures: factures || [], paiements: paiementsData || {}, clients: clients || [] },
      profil?.id
    ),
    [chantiers, devis, factures, paiementsData, clients, profil]
  );

  // Trier : critiques d'abord, puis warnings, puis info
  const alertesTri = useMemo(() => {
    const ordre = { critique: 0, warning: 1, info: 2 };
    return [...alertes].sort((a, b) => (ordre[a.niveau] ?? 3) - (ordre[b.niveau] ?? 3));
  }, [alertes]);

  const nonLues = alertes.filter(a => !lues.includes(a.id));
  const nbNonLues = nonLues.length;

  const marquerToutesLues = () => {
    const ids = alertes.map(a => a.id);
    localStorage.setItem('cyna_notifs_lues', JSON.stringify(ids));
    setLues(ids);
  };

  const ref = useRef(null);
  useEffect(() => {
    if (!ouvert) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ouvert]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bouton cloche */}
      <button
        onClick={() => setOuvert(v => !v)}
        aria-label="Notifications"
        title="Notifications"
        style={{
          background: ouvert ? 'rgba(59,130,246,0.12)' : 'var(--bg-glass-2)',
          border: ouvert ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
          borderRadius: 8,
          width: 34,
          height: 34,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: ouvert ? '#60a5fa' : 'var(--text-secondary)',
          position: 'relative',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!ouvert) { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; } }}
        onMouseLeave={e => { if (!ouvert) { e.currentTarget.style.background = 'var(--bg-glass-2)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
      >
        <Bell size={16} strokeWidth={2} />
        {nbNonLues > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-topbar)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {nbNonLues > 9 ? '9+' : nbNonLues}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {ouvert && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 44,
          zIndex: 9000,
          width: 360,
          maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
          overflow: 'hidden',
        }}>
          {/* En-tête */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
              {nbNonLues > 0 && (
                <span style={{
                  background: '#ef4444', color: '#fff',
                  borderRadius: 20, padding: '1px 7px',
                  fontSize: 10, fontWeight: 700, lineHeight: 1.6,
                }}>
                  {nbNonLues}
                </span>
              )}
            </div>
            {alertes.length > 0 && (
              <button
                onClick={marquerToutesLues}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
                  fontFamily: 'inherit', padding: '2px 6px', borderRadius: 6,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {alertesTri.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 10, padding: '32px 16px',
                color: 'var(--text-secondary)', fontSize: 13,
              }}>
                <CheckCircle size={32} style={{ color: '#22c55e', opacity: 0.8 }} />
                <span style={{ fontWeight: 600 }}>Aucune alerte active</span>
              </div>
            ) : (
              alertesTri.slice(0, 20).map(a => {
                const estLue = lues.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      if (a.page) naviguer(a.page);
                      setOuvert(false);
                      // Marquer cette alerte comme lue
                      const nouvLues = [...new Set([...lues, a.id])];
                      localStorage.setItem('cyna_notifs_lues', JSON.stringify(nouvLues));
                      setLues(nouvLues);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 16px',
                      background: estLue ? 'transparent' : 'rgba(59,130,246,0.04)',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: a.page ? 'pointer' : 'default',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = estLue ? 'transparent' : 'rgba(59,130,246,0.04)'; }}
                  >
                    <span style={{ marginTop: 2 }}><IconeNiveau niveau={a.niveau} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: estLue ? 400 : 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        whiteSpace: 'normal',
                      }}>
                        {a.message || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                        {dateRelative(a.date)}
                      </div>
                    </div>
                    {!estLue && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#3b82f6', flexShrink: 0, marginTop: 4,
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {alertesTri.length > 20 && (
            <div style={{
              padding: '8px 16px', textAlign: 'center',
              fontSize: 11, color: 'var(--text-muted)',
              borderTop: '1px solid var(--border)',
            }}>
              + {alertesTri.length - 20} alerte{alertesTri.length - 20 > 1 ? 's' : ''} supplémentaire{alertesTri.length - 20 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PERIODES = [
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois',    label: 'Mois' },
  { id: 'annee',   label: 'Année' },
];

// Pages où le filtre période a du sens (données temporelles)
const PAGES_AVEC_PERIODE = ['dashboard', 'finances', 'rapport', 'chantiers', 'devis', 'heures'];

export function Topbar({ setSidebarOuvert, canGoBack, page, revenirArriere, navAutorisees, darkMode, toggleDarkMode, profil, naviguer }) {
  const { periodeGlobale, setPeriodeGlobale } = useApp();
  const montrerPeriode = PAGES_AVEC_PERIODE.includes(page);

  return (
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
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Sélecteur de période — visible sur toutes les pages financières */}
        {montrerPeriode && (
          <div style={{ display: 'flex', background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
            {PERIODES.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodeGlobale(p.id)}
                style={{
                  background: periodeGlobale === p.id ? 'var(--brand, #0d3d6e)' : 'transparent',
                  color: periodeGlobale === p.id ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <NotificationBell naviguer={naviguer} />
        <button
          onClick={toggleDarkMode}
          aria-label="Basculer le thème"
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
          style={{
            background: 'var(--bg-glass-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 34,
            height: 34,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          {darkMode ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>
      </div>
    </header>
  );
}

export function MobileNav({ navMobileItems, page, naviguer, mobileMenuOuvert, setMobileMenuOuvert, navAutorisees }) {
  return (
    <>
      <nav className="bottom-nav">
        {navMobileItems.map(item => (
          <button key={item.id} className={`bottom-nav-item${page === item.id ? ' active' : ''}`} onClick={() => naviguer(item.id)}>
            <span className="bottom-nav-icon"><item.Icon size={22} strokeWidth={page === item.id ? 2.2 : 1.8} /></span>
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
    </>
  );
}
