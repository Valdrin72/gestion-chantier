import React, { useState, useMemo, useLayoutEffect } from 'react';
import { Bell, Menu } from 'lucide-react';
import { DS } from '../../ds.js';
import { V1, mono, carteV1, heroFond, heroMono, RYTHME } from '../../design/v1.js';
import { useApp } from '../../context/AppContext';
import { useAlertsStore } from './lib/store.js';
import { useAlerts } from './hooks/useAlerts.js';
import { AlertCard } from './components/AlertCard.js';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
// Libellés + couleurs de gravité (claires, lisibles sur le fond bleu nuit du hero).
const SEV_LABEL = { CRITICAL: 'Critique', HIGH: 'Élevé', MEDIUM: 'Moyen', LOW: 'Faible', INFO: 'Info' };
const SEV_HERO_COULEUR = { CRITICAL: '#FF7A6B', HIGH: '#F5D14A', MEDIUM: '#F5B14A', LOW: '#8FBCE6', INFO: '#B8C4D4' };
// Bouton translucide du hero (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 7, cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 };
const CATEGORIES = [
  { value: '',           label: 'Toutes' },
  { value: 'financier',  label: 'Financier' },
  { value: 'tresorerie', label: 'Trésorerie' },
  { value: 'planning',   label: 'Planning' },
  { value: 'rh',         label: 'RH' },
  { value: 'qualite',    label: 'Qualité' },
  { value: 'securite',   label: 'Sécurité' },
];

export function AlertsPage({ naviguer }) {
  const { ouvrirMenu } = useApp();
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);
  const [minSeverity, setMinSeverity] = useState('LOW');
  const [category, setCategory] = useState('');

  const alerts = useAlerts({
    minSeverity,
    category: category || undefined,
  });

  // Sélectionner le tableau brut (référence stable) pour éviter boucle infinie
  const rawAlerts = useAlertsStore(s => s.alerts);
  const allActive = useMemo(() => {
    const now = Date.now();
    return rawAlerts.filter(a => {
      if (a.state === 'resolved') return false;
      if (a.state === 'snoozed' && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return false;
      return true;
    });
  }, [rawAlerts]);
  const countBySeverity = useMemo(() => {
    return SEVERITIES.reduce((acc, sev) => {
      acc[sev] = allActive.filter(a => a.severity === sev).length;
      return acc;
    }, {});
  }, [allActive]);

  const totalActif = allActive.length;
  const totalCritique = (countBySeverity.CRITICAL ?? 0) + (countBySeverity.HIGH ?? 0);

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-alertes" style={{ ...heroFond, padding: '20px 32px 24px', position: 'relative' }}>
        {/* Ligne 1 — ☰ · CYNA · ALERTES / 10 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={heroBtn}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· ALERTES / 10</span>
        </div>

        {/* Ligne 2 — cloche + titre + ligne mono */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: totalCritique > 0 ? '#FF7A6B' : 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, padding: 8, display: 'flex' }}>
            <Bell size={20} color="#fff" />
          </div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>Alertes</h1>
        </div>
        <div style={{ ...heroMono(11, 0.7), marginTop: 8 }}>
          {totalActif} ALERTE{totalActif !== 1 ? 'S' : ''} ACTIVE{totalActif !== 1 ? 'S' : ''} · SURVEILLANCE EN TEMPS RÉEL
        </div>

        {/* Ligne 3 — les 5 compteurs de gravité (clic = filtre) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 20 }} data-testid="hero-compteurs">
          {SEVERITIES.map(sev => {
            const couleur = SEV_HERO_COULEUR[sev];
            const nb = countBySeverity[sev] ?? 0;
            const enAvant = nb > 0;
            const selectionne = minSeverity === sev;
            return (
              <button
                key={sev}
                onClick={() => setMinSeverity(sev)}
                data-testid={`compteur-${sev}`}
                style={{
                  textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                  background: enAvant ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectionne ? 'rgba(255,255,255,0.5)' : enAvant ? couleur + '66' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, padding: '12px 14px', transition: 'all 0.15s',
                }}
              >
                <div style={{ ...heroMono(9, 0.7), color: couleur, letterSpacing: '0.06em' }}>{SEV_LABEL[sev].toUpperCase()}</div>
                <div style={{ ...mono(24, enAvant ? couleur : 'rgba(255,255,255,0.4)', 500), lineHeight: 1.1, marginTop: 4 }}>{nb}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtres v1 sobres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: RYTHME.entreCartes, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={minSeverity}
          onChange={(e) => setMinSeverity(e.target.value)}
          style={{ ...DS.input, width: 'auto', padding: '7px 12px', fontSize: 13 }}
        >
          {SEVERITIES.map(s => (
            <option key={s} value={s}>Sévérité ≥ {SEV_LABEL[s]}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ ...DS.input, width: 'auto', padding: '7px 12px', fontSize: 13 }}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Liste d'alertes */}
      <div>
        {alerts.length === 0 ? (
          <div style={{
            ...carteV1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 32px', textAlign: 'center',
          }}>
            <Bell size={40} style={{ color: V1.texteMuted, opacity: 0.35 }} />
            <p style={{ marginTop: 16, fontSize: 15, color: V1.texteMuted }}>
              Aucune alerte ne correspond aux filtres sélectionnés.
            </p>
          </div>
        ) : (
          alerts.map(a => <AlertCard key={a.id} alert={a} onNavigate={naviguer} />)
        )}
      </div>
    </div>
  );
}
