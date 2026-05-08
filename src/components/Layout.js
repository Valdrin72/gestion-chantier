import React from 'react';
import { Plus, Sun, Moon, Menu, X, ChevronRight } from 'lucide-react';

export function Sidebar({ sidebarOuvert, setSidebarOuvert, navAutorisees, page, naviguer, darkMode, toggleDarkMode, profil, setProfil }) {
  return (
    <>
      {sidebarOuvert && <div className="sidebar-overlay" onClick={() => setSidebarOuvert(false)} />}
      <aside className={`sidebar${sidebarOuvert ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img
            src={`${process.env.PUBLIC_URL}/Logo.png.png`}
            alt="CYNA"
            style={{
              height: 36,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: darkMode ? 'brightness(0) invert(1)' : 'none',
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
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{profil.nom.substring(0, 2).toUpperCase()}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{profil.nom}</div>
            <div className="sidebar-profile-role">{profil.id}</div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ setSidebarOuvert, canGoBack, page, revenirArriere, navAutorisees, darkMode, toggleDarkMode, profil }) {
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
      <div className="topbar-right">
        <button className="topbar-icon-btn" onClick={toggleDarkMode} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
          {darkMode ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </button>
        <div className="topbar-avatar">{profil.nom.substring(0, 2).toUpperCase()}</div>
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
