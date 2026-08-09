import React, { useState, useLayoutEffect } from 'react';
import { Zap, Plus, Menu } from 'lucide-react';
import Planning from '../Planning';
import Calendrier from '../Calendrier';
import { heroFond, heroMono } from '../design/v1';
import { useApp } from '../context/AppContext';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };

// ── Planning (Calendrier + Gantt) + Événements — un seul hero, 3 onglets ────
function PlanningPage({ chantiers, setChantiers, clients, devis, factures, parametres, naviguer }) {
  const { ouvrirMenu } = useApp();
  const [onglet, setOnglet] = useState('calendrier');
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);

  // ── Navigation temporelle liftée dans le hero (état seulement — logique inchangée) ──
  const [moisActuel, setMoisActuel] = useState(new Date().getMonth());
  const [anneeActuelle, setAnneeActuelle] = useState(new Date().getFullYear());
  const [ganttOffset, setGanttOffset] = useState(0);
  const [showOptimiseur, setShowOptimiseur] = useState(false);
  const [viewDate, setViewDate] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  // Signal incrémental → demande d'ouverture de la modale « Nouvel événement ».
  const [nouvelEvenementSignal, setNouvelEvenementSignal] = useState(0);

  const moisPrecedent = () => {
    if (moisActuel === 0) { setMoisActuel(11); setAnneeActuelle(a => a - 1); }
    else setMoisActuel(m => m - 1);
  };
  const moisSuivant = () => {
    if (moisActuel === 11) { setMoisActuel(0); setAnneeActuelle(a => a + 1); }
    else setMoisActuel(m => m + 1);
  };
  const aujourdhuiCalendrier = () => { setMoisActuel(new Date().getMonth()); setAnneeActuelle(new Date().getFullYear()); };
  const aujourdhuiEvenements = () => { const t = new Date(); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); };

  // Libellés contextuels (affichage pur)
  const moisLabel = new Date(anneeActuelle, moisActuel, 1).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  const evenementsLabel = viewDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  const contexteLabel = onglet === 'gantt' ? 'TIMELINE 12 SEMAINES'
    : onglet === 'evenements' ? evenementsLabel.toUpperCase()
    : moisLabel.toUpperCase();
  const monoLigne = onglet === 'gantt' ? 'TIMELINE 12 SEMAINES · CHANTIERS PLANIFIÉS'
    : onglet === 'evenements' ? `${evenementsLabel.toUpperCase()} · ÉVÉNEMENTS & ÉCHÉANCES`
    : `${moisLabel.toUpperCase()} · PLANIFICATION CHANTIERS`;

  const onglets = [
    { id: 'calendrier', label: 'Calendrier' },
    { id: 'gantt',      label: 'Gantt' },
    { id: 'evenements', label: 'Événements' },
  ];

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-planning" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
        {/* Ligne 1 — ☰ · CYNA · PLANNING / 07 · nav temporelle + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {ouvrirMenu && (
            <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
          <span style={heroMono(10, 0.55)}>· PLANNING / 07 · {contexteLabel}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Navigation temporelle contextuelle à l'onglet */}
            {onglet === 'calendrier' && (
              <>
                <button onClick={moisPrecedent} style={heroBtn} title="Mois précédent">←</button>
                <button onClick={aujourdhuiCalendrier} style={heroBtn}>Aujourd'hui</button>
                <button onClick={moisSuivant} style={heroBtn} title="Mois suivant">→</button>
              </>
            )}
            {onglet === 'gantt' && (
              <>
                <button onClick={() => setGanttOffset(v => v - 4)} style={heroBtn} title="−4 semaines">←</button>
                <button onClick={() => setGanttOffset(0)} style={heroBtn}>Aujourd'hui</button>
                <button onClick={() => setGanttOffset(v => v + 4)} style={heroBtn} title="+4 semaines">→</button>
              </>
            )}
            {onglet === 'evenements' && (
              <>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={heroBtn} title="Mois précédent">←</button>
                <button onClick={aujourdhuiEvenements} style={heroBtn}>Aujourd'hui</button>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={heroBtn} title="Mois suivant">→</button>
              </>
            )}
            {(onglet === 'calendrier' || onglet === 'gantt') && (
              <button onClick={() => setShowOptimiseur(v => !v)}
                style={{ ...heroBtn, background: showOptimiseur ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                <Zap size={14} /> Optimiser l'équipe
              </button>
            )}
            {onglet === 'evenements' && (
              <button onClick={() => setNouvelEvenementSignal(n => n + 1)}
                style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                <Plus size={14} /> Nouvel événement
              </button>
            )}
          </div>
        </div>

        {/* Ligne 2 — titre + ligne mono contextuelle */}
        <div style={heroMono(11, 0.6)}>PLANNING / 07</div>
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Planning</h1>
        <div style={heroMono(11, 0.7)}>{monoLigne}</div>

        {/* Ligne 3 — onglets collés au bas du hero */}
        <div style={{ display: 'flex', gap: 2, marginTop: 22, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {onglets.map(o => {
            const actif = onglet === o.id;
            return (
              <button key={o.id} onClick={() => setOnglet(o.id)} style={{
                background: 'transparent', border: 'none',
                borderBottom: actif ? '2px solid #fff' : '2px solid transparent',
                color: actif ? '#fff' : 'rgba(255,255,255,0.6)',
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: actif ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0,
              }}>{o.label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu — Planning porte les vues Calendrier et Gantt (logique inchangée) ── */}
      {(onglet === 'calendrier' || onglet === 'gantt') && (
        <Planning
          chantiers={chantiers} setChantiers={setChantiers} clients={clients} parametres={parametres} naviguer={naviguer}
          vue={onglet}
          moisActuel={moisActuel} anneeActuelle={anneeActuelle}
          onMoisPrecedent={moisPrecedent} onMoisSuivant={moisSuivant}
          ganttOffset={ganttOffset}
          showOptimiseur={showOptimiseur} setShowOptimiseur={setShowOptimiseur}
        />
      )}
      {onglet === 'evenements' && (
        <Calendrier
          chantiers={chantiers} clients={clients} devis={devis} factures={factures}
          viewDate={viewDate} setViewDate={setViewDate}
          nouvelEvenementSignal={nouvelEvenementSignal}
        />
      )}
    </div>
  );
}

export default PlanningPage;
