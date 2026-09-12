import React, { useState, useLayoutEffect, useEffect } from 'react';
import { Zap, Plus, Menu } from 'lucide-react';
import Planning from '../Planning';
import Calendrier from '../Calendrier';
import { heroFond, heroMono } from '../design/v1';
import { useApp } from '../context/AppContext';
import useIsMobile from '../hooks/useIsMobile';

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
// Bouton hero MOBILE : cible tactile 44px (arrows / Aujourd'hui / Nouvel événement).
const heroBtnM = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, minHeight: 44, padding: '0 12px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 };
// Fond hero MOBILE — 3 tons + trame + halo (cohérent Chantiers #179 / Dashboard #182). PC garde heroFond.
const heroFondMobile = {
  background: `
    radial-gradient(220px 220px at 100% -50px, rgba(255,255,255,0.10), transparent 70%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 44px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 44px),
    linear-gradient(168deg, #0B2E55 0%, #0d3d6e 46%, #15528F 100%)`,
  color: '#fff',
};

// ── Planning (Calendrier + Gantt) + Événements — un seul hero, 3 onglets ────
function PlanningPage({ chantiers, setChantiers, clients, devis, factures, parametres, naviguer }) {
  const { ouvrirMenu } = useApp();
  const isMobile = useIsMobile();
  const [onglet, setOnglet] = useState('calendrier');
  // Le Gantt n'a pas d'intérêt sur téléphone (planification large, illisible en petit) :
  // son onglet est retiré du mobile. Si l'utilisateur y était (ex. passage PC→mobile),
  // on bascule proprement sur Calendrier — jamais d'écran vide.
  useEffect(() => {
    if (isMobile && onglet === 'gantt') setOnglet('calendrier');
  }, [isMobile, onglet]);
  // Onglet effectivement rendu : garde anti-écran-vide même avant que l'effet ci-dessus ne s'applique.
  const ongletActif = (isMobile && onglet === 'gantt') ? 'calendrier' : onglet;
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
  const contexteLabel = ongletActif === 'gantt' ? 'TIMELINE 12 SEMAINES'
    : ongletActif === 'evenements' ? evenementsLabel.toUpperCase()
    : moisLabel.toUpperCase();
  const monoLigne = ongletActif === 'gantt' ? 'TIMELINE 12 SEMAINES · CHANTIERS PLANIFIÉS'
    : ongletActif === 'evenements' ? `${evenementsLabel.toUpperCase()} · ÉVÉNEMENTS & ÉCHÉANCES`
    : `${moisLabel.toUpperCase()} · PLANIFICATION CHANTIERS`;

  // Gantt : présent sur PC, RETIRÉ du mobile (illisible sur petit écran, décision patron).
  const onglets = [
    { id: 'calendrier', label: 'Calendrier' },
    ...(isMobile ? [] : [{ id: 'gantt', label: 'Gantt' }]),
    { id: 'evenements', label: 'Événements' },
  ];

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      <div className="page-hero-bleed" data-testid="hero-planning" style={{ ...(isMobile ? heroFondMobile : heroFond), padding: isMobile ? '16px 16px 0' : '20px 32px 0', position: 'relative', overflow: isMobile ? 'hidden' : undefined }}>
        {/* ── EN-TÊTE ────────────────────────────────────────────── */}
        {isMobile ? (
          <>
            {/* Mobile — ligne marque : ☰ · CYNA · PLANNING (doublon triple supprimé, plus de « / 07 ») */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {ouvrirMenu && (
                <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, borderRadius: 12, width: 44, height: 44, padding: 0, justifyContent: 'center' }}><Menu size={18} /></button>
              )}
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff', flexShrink: 0 }}>CYNA</span>
              <span style={{ ...heroMono(10, 0.6), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· PLANNING</span>
            </div>
            {/* Mobile — barre d'outils 44px : nav contextuelle + action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {ongletActif === 'calendrier' && (<>
                <button onClick={moisPrecedent} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="Mois précédent">←</button>
                <button onClick={aujourdhuiCalendrier} style={{ ...heroBtnM, flex: 1, minWidth: 0 }}>Aujourd'hui</button>
                <button onClick={moisSuivant} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="Mois suivant">→</button>
              </>)}
              {ongletActif === 'gantt' && (<>
                <button onClick={() => setGanttOffset(v => v - 4)} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="−4 semaines">←</button>
                <button onClick={() => setGanttOffset(0)} style={{ ...heroBtnM, flex: 1, minWidth: 0 }}>Aujourd'hui</button>
                <button onClick={() => setGanttOffset(v => v + 4)} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="+4 semaines">→</button>
              </>)}
              {ongletActif === 'evenements' && (<>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="Mois précédent">←</button>
                <button onClick={aujourdhuiEvenements} style={{ ...heroBtnM, flex: 1, minWidth: 0 }}>Aujourd'hui</button>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ ...heroBtnM, width: 44, padding: 0 }} aria-label="Mois suivant">→</button>
              </>)}
              {(ongletActif === 'calendrier' || ongletActif === 'gantt') && (
                <button onClick={() => setShowOptimiseur(v => !v)}
                  style={{ ...heroBtnM, background: '#fff', border: '1px solid #fff', color: '#0d3d6e', fontWeight: 700, boxShadow: '0 3px 10px rgba(5,20,40,0.22)' }}>
                  <Zap size={15} /> Optimiser l'équipe
                </button>
              )}
              {ongletActif === 'evenements' && (
                <button onClick={() => setNouvelEvenementSignal(n => n + 1)}
                  style={{ ...heroBtnM, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <Plus size={15} /> Nouvel événement
                </button>
              )}
            </div>
          </>
        ) : (
          /* Ligne 1 (desktop) — ☰ · CYNA · PLANNING / 07 · nav temporelle + actions */
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            {ouvrirMenu && (
              <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
            )}
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
            <span style={heroMono(10, 0.55)}>· PLANNING / 07 · {contexteLabel}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ongletActif === 'calendrier' && (
                <>
                  <button onClick={moisPrecedent} style={heroBtn} title="Mois précédent">←</button>
                  <button onClick={aujourdhuiCalendrier} style={heroBtn}>Aujourd'hui</button>
                  <button onClick={moisSuivant} style={heroBtn} title="Mois suivant">→</button>
                </>
              )}
              {ongletActif === 'gantt' && (
                <>
                  <button onClick={() => setGanttOffset(v => v - 4)} style={heroBtn} title="−4 semaines">←</button>
                  <button onClick={() => setGanttOffset(0)} style={heroBtn}>Aujourd'hui</button>
                  <button onClick={() => setGanttOffset(v => v + 4)} style={heroBtn} title="+4 semaines">→</button>
                </>
              )}
              {ongletActif === 'evenements' && (
                <>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={heroBtn} title="Mois précédent">←</button>
                  <button onClick={aujourdhuiEvenements} style={heroBtn}>Aujourd'hui</button>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={heroBtn} title="Mois suivant">→</button>
                </>
              )}
              {(ongletActif === 'calendrier' || ongletActif === 'gantt') && (
                <button onClick={() => setShowOptimiseur(v => !v)}
                  style={{ ...heroBtn, background: showOptimiseur ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <Zap size={14} /> Optimiser l'équipe
                </button>
              )}
              {ongletActif === 'evenements' && (
                <button onClick={() => setNouvelEvenementSignal(n => n + 1)}
                  style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <Plus size={14} /> Nouvel événement
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ligne 2 — titre + ligne mono contextuelle (fil d'Ariane « PLANNING / 07 » : PC seulement) */}
        {!isMobile && <div style={heroMono(11, 0.6)}>PLANNING / 07</div>}
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Planning</h1>
        <div style={heroMono(11, 0.7)}>{monoLigne}</div>

        {/* Ligne 3 — onglets collés au bas du hero */}
        <div style={{ display: 'flex', gap: 2, marginTop: 22, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {onglets.map(o => {
            const actif = ongletActif === o.id;
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
      {(ongletActif === 'calendrier' || ongletActif === 'gantt') && (
        <Planning
          chantiers={chantiers} setChantiers={setChantiers} clients={clients} parametres={parametres} naviguer={naviguer}
          vue={ongletActif}
          moisActuel={moisActuel} anneeActuelle={anneeActuelle}
          onMoisPrecedent={moisPrecedent} onMoisSuivant={moisSuivant}
          ganttOffset={ganttOffset}
          showOptimiseur={showOptimiseur} setShowOptimiseur={setShowOptimiseur}
        />
      )}
      {ongletActif === 'evenements' && (
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
