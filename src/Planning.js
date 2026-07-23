import React, { useState, useMemo, useCallback } from 'react';
import { Zap, Calendar, LayoutList } from 'lucide-react';
import { calculerDateFinOuvrables, getAlerte } from './donnees';
import { joursReelsChantier } from './calculs/pointagesHelper';
import { useApp } from './context/AppContext';
import { DS } from './ds';
import { TOUS_STATUTS } from './constants/statuts';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PALETTE = ['#0d3d6e','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

// ── Helpers Gantt ────────────────────────────────────────────────
function getLundiDeSemaine(d) {
  const r = new Date(d);
  const jour = r.getDay(); // 0=dim, 1=lun, ...
  const decal = jour === 0 ? -6 : 1 - jour;
  r.setDate(r.getDate() + decal);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDateCourt(d) {
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' });
}

// ── Composant GanttView ──────────────────────────────────────────
function GanttView({ chantiers, chantiersNonPlanifies, offsetSemaines, ouvrirModal }) {
  const NB_SEMAINES = 12;
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const timelineStart = useMemo(() => addDays(getLundiDeSemaine(today), offsetSemaines * 7), [today, offsetSemaines]);
  const timelineEnd   = useMemo(() => addDays(timelineStart, NB_SEMAINES * 7), [timelineStart]);
  const dureeTotaleMs = NB_SEMAINES * 7 * 86400000;

  // Chantiers avec dateDebut (affichables sur la timeline)
  const chantiersGantt = useMemo(() => {
    return chantiers
      .map((c, idx) => {
        if (!c.dateDebut) return null;
        const debut = new Date(c.dateDebut); debut.setHours(0,0,0,0);
        let fin;
        if (c.nombreJours) {
          const finStr = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi, c.canton ?? 'GE');
          fin = finStr ? new Date(finStr) : new Date(debut);
          fin.setHours(0,0,0,0);
        } else {
          // Chantier "en cours" sans nombre de jours : montrer 1 semaine par défaut
          fin = addDays(debut, 6);
        }

        // Vérifier que la barre intersecte la timeline
        if (fin < timelineStart || debut >= timelineEnd) return null;

        // Positions en %
        const debutClipped = debut < timelineStart ? timelineStart : debut;
        const finClipped   = fin   > timelineEnd   ? timelineEnd   : fin;

        const debutPct = Math.max(0, (debutClipped - timelineStart) / dureeTotaleMs * 100);
        const largeurPct = Math.max(0.5, (finClipped - debutClipped + 86400000) / dureeTotaleMs * 100);
        const color = PALETTE[idx % PALETTE.length];

        return { c, debut, fin, debutPct, largeurPct, color, idx };
      })
      .filter(Boolean);
  }, [chantiers, timelineStart, timelineEnd, dureeTotaleMs]);

  // Marqueur aujourd'hui
  const todayPct = useMemo(() => {
    if (today < timelineStart || today >= timelineEnd) return null;
    return (today - timelineStart) / dureeTotaleMs * 100;
  }, [today, timelineStart, timelineEnd, dureeTotaleMs]);

  // Headers semaines
  const semaines = useMemo(() => {
    const s = [];
    for (let i = 0; i < NB_SEMAINES; i++) {
      const lundi = addDays(timelineStart, i * 7);
      // Numéro de semaine ISO approximatif
      const startOfYear = new Date(lundi.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((lundi - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      s.push({ lundi, weekNum });
    }
    return s;
  }, [timelineStart]);

  const COL_NOM = '30%';
  const COL_TIMELINE = '70%';

  const rowStyle = (isAlt) => ({
    display: 'flex',
    height: 44,
    alignItems: 'center',
    background: isAlt ? 'var(--bg-card)' : 'transparent',
    borderBottom: '1px solid var(--border)',
  });

  return (
    <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--ds-th-bg)' }}>
        <div style={{ width: COL_NOM, flexShrink: 0, padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>
          Chantier
        </div>
        <div style={{ width: COL_TIMELINE, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', minWidth: '100%' }}>
            {semaines.map(({ lundi, weekNum }, i) => (
              <div key={i} style={{ flex: `0 0 ${100 / NB_SEMAINES}%`, padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', borderRight: i < NB_SEMAINES - 1 ? '1px solid var(--border)' : 'none', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                S{weekNum}<br />
                <span style={{ fontWeight: 500, letterSpacing: 0 }}>{formatDateCourt(lundi)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lignes chantiers */}
      {chantiersGantt.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          <Calendar size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, fontSize: 15 }}>Aucun chantier sur cette période</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Utilisez les flèches pour naviguer dans le temps</div>
        </div>
      ) : (
        chantiersGantt.map(({ c, debutPct, largeurPct, color }, i) => (
          <div key={c.id} style={rowStyle(i % 2 === 0)}>
            {/* Nom chantier */}
            <div style={{ width: COL_NOM, flexShrink: 0, padding: '0 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom || c.numero}</span>
            </div>
            {/* Barre Gantt */}
            <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
              {/* Quadrillage semaines */}
              {semaines.map((_, si) => (
                <div key={si} style={{ position: 'absolute', top: 0, bottom: 0, left: `${si / NB_SEMAINES * 100}%`, width: 1, background: 'var(--border)', opacity: 0.5 }} />
              ))}
              {/* Marqueur aujourd'hui */}
              {todayPct !== null && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPct}%`, width: 2, background: '#ef4444', opacity: 0.8, zIndex: 3, borderLeft: '2px dashed #ef4444' }} />
              )}
              {/* Barre chantier */}
              <div
                onClick={() => ouvrirModal(c)}
                title={`${c.nom || c.numero}\nDébut : ${c.dateDebut}\nDurée : ${c.nombreJours || '?'}j`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: `${debutPct}%`,
                  width: `${largeurPct}%`,
                  height: 22,
                  background: color,
                  opacity: 0.85,
                  borderRadius: 4,
                  cursor: 'pointer',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}
              >
                {/* Label texte si assez large (≥80px estimé comme ≥7% sur 12 semaines) */}
                {largeurPct > 7 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.nom || c.numero}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Légende */}
      {chantiersGantt.length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginRight: 4 }}>Légende :</span>
          {chantiersGantt.map(({ c, color }) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.nom || c.numero}</span>
            </div>
          ))}
          {todayPct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <div style={{ width: 12, height: 2, borderTop: '2px dashed #ef4444' }} />
              <span style={{ fontSize: 12, color: '#ef4444' }}>Aujourd'hui</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Planning({ chantiers, setChantiers, clients, parametres, naviguer }) {
  const { pointages = [] } = useApp();
  const [moisActuel, setMoisActuel] = useState(new Date().getMonth());
  const [anneeActuelle, setAnneeActuelle] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(null); // null ou { chantier, form }
  const [showOptimiseur, setShowOptimiseur] = useState(false);
  const [vue, setVue] = useState('calendrier'); // 'calendrier' | 'gantt'
  const [ganttOffset, setGanttOffset] = useState(0); // offset en semaines pour la timeline Gantt

  // couleurStatut importé depuis ds.js — source unique DS.statuts

  // ── Modal helpers ──────────────────────────────────────────────
  const ouvrirModal = useCallback((c) => {
    setModal({
      chantier: c,
      form: {
        dateDebut: c.dateDebut || '',
        nombreJours: c.nombreJours || '',
        statut: c.statut || 'Planifié',
        inclusSamedi: c.inclusSamedi || false,
      }
    });
  }, []);

  const sauvegarderModal = useCallback(() => {
    setModal(prev => {
      if (!prev) return null;
      const { chantier, form } = prev;
      setChantiers(ch => ch.map(c =>
        c.id === chantier.id
          ? { ...c, dateDebut: form.dateDebut, nombreJours: parseInt(form.nombreJours) || c.nombreJours, statut: form.statut, inclusSamedi: form.inclusSamedi }
          : c
      ));
      return null;
    });
  }, [setChantiers]);

  const supprimerDuPlanning = useCallback(() => {
    setModal(prev => {
      if (!prev) return null;
      const { chantier } = prev;
      if (!window.confirm(`Retirer "${chantier.nom}" du planning ?\nLa date de début sera effacée mais le chantier sera conservé.`)) return prev;
      setChantiers(ch => ch.map(c =>
        c.id === chantier.id ? { ...c, dateDebut: '' } : c
      ));
      return null;
    });
  }, [setChantiers]);

  // ── Navigation mois ────────────────────────────────────────────
  const moisPrecedent = () => {
    if (moisActuel === 0) { setMoisActuel(11); setAnneeActuelle(anneeActuelle - 1); }
    else setMoisActuel(moisActuel - 1);
  };

  const moisSuivant = () => {
    if (moisActuel === 11) { setMoisActuel(0); setAnneeActuelle(anneeActuelle + 1); }
    else setMoisActuel(moisActuel + 1);
  };

  const nbJoursMois = useMemo(
    () => new Date(anneeActuelle, moisActuel + 1, 0).getDate(),
    [anneeActuelle, moisActuel]
  );

  const chantiersDuMois = useMemo(() => chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const statut = (c.statut || '').trim().toLowerCase();
    // Un chantier "en cours" est toujours visible dans le planning, même si sa date de fin prévue est dépassée
    if (statut === 'en cours') return true;
    if (!c.nombreJours) return false;
    const debut = new Date(c.dateDebut);
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0), c.inclusSamedi, c.canton ?? 'GE'));
    const debutMois = new Date(anneeActuelle, moisActuel, 1);
    const finMois = new Date(anneeActuelle, moisActuel + 1, 0);
    return debut <= finMois && fin >= debutMois;
  }), [chantiers, anneeActuelle, moisActuel]);

  const chantiersNonPlanifies = useMemo(
    () => chantiers.filter(c => { const s = (c.statut || '').trim().toLowerCase(); return !c.dateDebut && s !== 'terminé' && s !== 'clôturé' && s !== 'facturé'; }),
    [chantiers]
  );

  // ── Calendrier ─────────────────────────────────────────────────
  const cellules = useMemo(() => {
    const premierJourMois = new Date(anneeActuelle, moisActuel, 1).getDay();
    const decalage = premierJourMois === 0 ? 6 : premierJourMois - 1;
    const totalCellules = Math.ceil((nbJoursMois + decalage) / 7) * 7;
    return Array.from({ length: totalCellules }, (_, i) => {
      const jour = i - decalage + 1;
      return jour >= 1 && jour <= nbJoursMois ? jour : null;
    });
  }, [anneeActuelle, moisActuel, nbJoursMois]);

  // Précalcul de tous les chantiers par jour — évite les appels répétés dans cellules.map()
  // et stabilise le résultat quand seul `modal` change (pas de recalcul inutile)
  const chantiersParJour = useMemo(() => {
    const map = {};
    cellules.forEach(jour => {
      if (!jour) return;
      const date = new Date(anneeActuelle, moisActuel, jour);
      map[jour] = chantiers.filter(c => {
        if (!c.dateDebut || !c.nombreJours) return false;
        const debut = new Date(c.dateDebut);
        const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0), c.inclusSamedi, c.canton ?? 'GE'));
        return date >= debut && date <= fin;
      });
    });
    return map;
  }, [chantiers, anneeActuelle, moisActuel, cellules]);

  const aujourdhui = new Date();
  const estAujourdhui = (jour) => jour && anneeActuelle === aujourdhui.getFullYear() &&
    moisActuel === aujourdhui.getMonth() && jour === aujourdhui.getDate();

  const btnEdit = {
    background: 'rgba(13,61,110,0.14)', color: '#0d3d6e',
    border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
    padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', transition: 'all 0.15s',
  };

  // ── Prochains jalons ──────────────────────────────────────────
  const prochainsJalons = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(today.getDate() + 60);
    const list = [];
    chantiers.forEach((c, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      if (c.dateDebut) {
        const d = new Date(c.dateDebut); d.setHours(0,0,0,0);
        if (d >= today && d <= limit)
          list.push({ label: c.nom || c.numero, type: 'Début', date: d, color });
      }
      if (c.dateDebut && c.nombreJours) {
        const finStr = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi, c.canton ?? 'GE');
        if (finStr) {
          const d = new Date(finStr); d.setHours(0,0,0,0);
          if (d >= today && d <= limit)
            list.push({ label: c.nom || c.numero, type: 'Fin prévue', date: d, color });
        }
      }
    });
    return list.sort((a, b) => a.date - b.date).slice(0, 6);
  }, [chantiers]);

  const btnNav = { background: 'var(--ds-btn-ghost-bg)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'inherit' };

  const chantierColors = useMemo(() => {
    const map = {};
    chantiersDuMois.forEach((c, i) => { map[c.id] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [chantiersDuMois]);

  // ── Optimiseur d'équipe ────────────────────────────────────────
  const suggestionsOptimiseur = useMemo(() => {
    const employes = (parametres?.employes || []).filter(e => e.actif !== false);
    if (employes.length === 0 || chantiers.length === 0) return { employes, suggestions: [] };

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Chantiers actifs (En cours ou Planifié), insensible à la casse
    const chantiersActifs = chantiers
      .filter(c => {
        const s = (c.statut || '').trim().toLowerCase();
        return s === 'en cours' || s === 'planifié';
      })
      .map(c => {
        const joursR = joursReelsChantier(pointages, c.id);
        const joursRestants = c.nombreJours > 0 ? c.nombreJours - joursR : null;
        return { ...c, _joursRestants: joursRestants };
      })
      // Trier par urgence : jours restants les plus courts en premier, null à la fin
      .sort((a, b) => {
        if (a._joursRestants === null && b._joursRestants === null) return 0;
        if (a._joursRestants === null) return 1;
        if (b._joursRestants === null) return -1;
        return a._joursRestants - b._joursRestants;
      });

    if (chantiersActifs.length === 0) return { employes, suggestions: [] };

    // Calculer la charge de chaque employé (nombre de chantiers actifs où il est affecté)
    const chargeParEmp = {};
    employes.forEach(e => { chargeParEmp[e.id] = 0; });
    chantiersActifs.forEach(ch => {
      (ch.equipe || []).forEach(m => {
        if (chargeParEmp[m.employeId] !== undefined) chargeParEmp[m.employeId]++;
      });
    });

    const suggestions = chantiersActifs.map(c => {
      // Trier les employés par charge croissante puis alphabétiquement
      const empsTries = [...employes].sort((a, b) => {
        const diff = (chargeParEmp[a.id] || 0) - (chargeParEmp[b.id] || 0);
        if (diff !== 0) return diff;
        return (a.nom || '').localeCompare(b.nom || '');
      });

      const nb = parseInt(c.nombrePersonnes) || 2;
      const typeChantier = (c.typeChantier || c.typesTravaux?.[0] || '').toLowerCase();

      const equipes = empsTries.slice(0, nb).map(e => {
        const charge = chargeParEmp[e.id] || 0;
        const posteMatch = typeChantier && (e.poste || '').toLowerCase().includes(typeChantier.split(' ')[0]);
        let raison;
        if (charge === 0 && posteMatch) raison = 'Disponible · Spécialité correspondante';
        else if (charge === 0) raison = 'Disponible';
        else if (posteMatch) raison = `Spécialité correspondante · ${charge} chantier(s) en cours`;
        else raison = `${charge} chantier(s) en cours`;

        return { nom: e.nom, poste: e.poste, charge, raison };
      });

      return { chantier: c, joursRestants: c._joursRestants, equipes };
    });

    return { employes, suggestions };
  }, [chantiers, parametres, pointages]);

  // ── Style pills toggle ──────────────────────────────────────
  const pillActive   = { background: 'rgba(13,61,110,0.12)', color: '#0d3d6e', border: '1px solid rgba(13,61,110,0.35)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' };
  const pillInactive = { background: 'var(--ds-btn-ghost-bg)', color: 'var(--text-secondary)', border: '1px solid var(--ds-btn-ghost-border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' };

  return (
    <div>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Planning</div>
          <div className="page-title-sub">
            {vue === 'calendrier'
              ? `${chantiersDuMois.length} chantier${chantiersDuMois.length !== 1 ? 's' : ''} ce mois`
              : `Vue Gantt — 12 semaines`}
            {chantiersNonPlanifies.length > 0 && ` · ${chantiersNonPlanifies.length} sans date`}
          </div>
        </div>
        <div className="page-actions-group">
          {/* Toggle Calendrier / Gantt */}
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 10, padding: 3, gap: 3 }}>
            <button onClick={() => setVue('calendrier')} style={vue === 'calendrier' ? pillActive : pillInactive} title="Vue calendrier mensuel">
              <Calendar size={14} />Calendrier
            </button>
            <button onClick={() => setVue('gantt')} style={vue === 'gantt' ? pillActive : pillInactive} title="Vue Gantt timeline">
              <LayoutList size={14} />Gantt
            </button>
          </div>

          {/* Navigation contextuelle */}
          {vue === 'calendrier' ? (
            <>
              <button onClick={moisPrecedent} style={btnNav} title="Mois précédent">←</button>
              <button onClick={() => { setMoisActuel(new Date().getMonth()); setAnneeActuelle(new Date().getFullYear()); }} style={btnNav}>Aujourd'hui</button>
              <button onClick={moisSuivant} style={btnNav} title="Mois suivant">→</button>
            </>
          ) : (
            <>
              <button onClick={() => setGanttOffset(v => v - 4)} style={btnNav} title="−4 semaines">←</button>
              <button onClick={() => setGanttOffset(0)} style={btnNav} title="Centrer sur aujourd'hui">Aujourd'hui</button>
              <button onClick={() => setGanttOffset(v => v + 4)} style={btnNav} title="+4 semaines">→</button>
            </>
          )}

          <button
            onClick={() => setShowOptimiseur(v => !v)}
            style={{
              background: showOptimiseur ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.08)',
              color: '#8b5cf6',
              border: `1px solid ${showOptimiseur ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.25)'}`,
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <Zap size={14} style={{ marginRight: 5 }} />Optimiser l'équipe
          </button>
        </div>
      </div>

      {/* ── PANNEAU OPTIMISEUR ──────────────────────────────────── */}
      {showOptimiseur && (
        <div style={{ ...DS.card, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={15} />Suggestions IA — Affectation optimale</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Basé sur la charge actuelle et les spécialités
              </div>
            </div>
            <button
              onClick={() => setShowOptimiseur(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', fontFamily: 'inherit', lineHeight: 1, padding: '4px 8px' }}
              aria-label="Fermer"
            >×</button>
          </div>

          {suggestionsOptimiseur.employes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Ajoutez des employés dans Paramètres pour obtenir des suggestions
            </div>
          ) : suggestionsOptimiseur.suggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun chantier actif à optimiser
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {suggestionsOptimiseur.suggestions.map(({ chantier: c, joursRestants, equipes }, idx) => {
                const urgenceColor = joursRestants === null ? '#94a3b8' : joursRestants < 0 ? '#ef4444' : joursRestants <= 3 ? '#f59e0b' : '#10b981';
                const accentColor = PALETTE[idx % PALETTE.length];
                return (
                  <div key={c.id} style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${accentColor}` }}>
                    {/* En-tête chantier */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {c.nom || c.numero}
                        </div>
                        {c.typeChantier || c.typesTravaux?.[0] ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {c.typeChantier || c.typesTravaux?.[0]}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 2 }}>
                          Jours restants
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: urgenceColor }}>
                          {joursRestants === null ? '—' : joursRestants < 0 ? `${Math.abs(joursRestants)}j retard` : joursRestants === 0 ? 'Fin auj.' : `${joursRestants}j`}
                        </div>
                      </div>
                    </div>

                    {/* Équipe suggérée */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {equipes.map((emp, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${accentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: accentColor, flexShrink: 0 }}>
                              {(emp.nom || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.nom || '—'}</div>
                              {emp.poste && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.poste}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: emp.charge === 0 ? '#10b981' : emp.charge >= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                              {emp.raison}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Ces suggestions sont basées sur la charge actuelle. Modifiez les équipes dans la fiche chantier.
          </div>
        </div>
      )}

      {/* ── VUE GANTT ───────────────────────────────────────────── */}
      {vue === 'gantt' && (
        <div>
          <GanttView
            chantiers={chantiers}
            chantiersNonPlanifies={chantiersNonPlanifies}
            offsetSemaines={ganttOffset}
            ouvrirModal={ouvrirModal}
          />
          {/* Chantiers non planifiés dans la vue Gantt */}
          {chantiersNonPlanifies.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {chantiersNonPlanifies.length} non planifié{chantiersNonPlanifies.length !== 1 ? 's' : ''} :
              </span>
              {chantiersNonPlanifies.map(c => (
                <button key={c.id} onClick={() => ouvrirModal(c)}
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  + Planifier {c.nom || c.numero}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LAYOUT 2 COLONNES (vue calendrier uniquement) ───────── */}
      {vue === 'calendrier' && (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── COLONNE GAUCHE : liste chantiers ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Chantiers sans date */}
          {chantiersNonPlanifies.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {chantiersNonPlanifies.length} sans date :
              </span>
              {chantiersNonPlanifies.map(c => (
                <button key={c.id} onClick={() => ouvrirModal(c)}
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  + Planifier {c.nom || c.numero}
                </button>
              ))}
            </div>
          )}

          {/* Chantiers du mois */}
          {chantiersDuMois.length === 0 ? (
            <div style={{ ...DS.card, textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Calendar size={32} color="var(--text-muted)" /></div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Aucun chantier ce mois</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Changez de mois ou planifiez un chantier</div>
            </div>
          ) : (
            chantiersDuMois.map(c => {
              const joursRealises_ = joursReelsChantier(pointages, c.id);
              const jours = c.nombreJours > 0 ? c.nombreJours - joursRealises_ : null;
              const progress = Math.max(0, Math.min(100, parseFloat(c.avancement) || 0));
              const dateFin = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi, c.canton ?? 'GE');
              const barColor = jours === null ? '#94a3b8' : jours < 0 ? '#ef4444' : jours <= 3 ? '#f59e0b' : '#10b981';
              const cs = DS.statuts[c.statut] || { bg: '#F1F5F9', color: '#475569' };
              const client = clients.find(cl => String(cl.id) === String(c.clientId));
              const alerte = getAlerte(jours);
              return (
                <div key={c.id} style={{ ...DS.card, transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--ds-card-shadow)'; }}
                >
                  {/* Ligne 1 : nom + statut + bouton */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nom || c.numero}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {[client?.nom, c.ville, c.canton].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ background: cs.bg, color: cs.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{c.statut}</span>
                      <button onClick={() => ouvrirModal(c)} style={btnEdit}>Modifier</button>
                    </div>
                  </div>

                  {/* Ligne 2 : dates + jours restants */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, marginBottom: 14 }}>
                    {[
                      { lbl: 'Début', val: c.dateDebut ? new Date(c.dateDebut).toLocaleDateString('fr-CH') : '—' },
                      { lbl: 'Fin prévue', val: dateFin ? new Date(dateFin).toLocaleDateString('fr-CH') : '—' },
                      { lbl: 'Durée', val: c.nombreJours ? `${c.nombreJours}j` : '—' },
                    ].map(item => (
                      <div key={item.lbl}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 3 }}>{item.lbl}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</div>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 3 }}>Restant</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
                        {jours === null ? '—' : jours < 0 ? `${Math.abs(jours)}j retard` : jours === 0 ? "Fin auj." : `${jours}j`}
                      </div>
                    </div>
                  </div>

                  {/* Ligne 3 : barre de progression */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avancement</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{progress}%</span>
                    </div>
                    <div style={{ background: 'var(--bg-hover)', borderRadius: 6, height: 7, overflow: 'hidden' }}>
                      <div style={{ background: barColor, width: `${progress}%`, height: '100%', borderRadius: 6, transition: 'width 0.4s ease' }} />
                    </div>
                    {alerte && alerte.banniere && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: alerte.couleur }}>
                        {alerte.texte}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── COLONNE DROITE : mini calendrier + jalons ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mini calendrier */}
          <div style={DS.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button onClick={moisPrecedent} style={btnNav} title="Mois précédent">‹</button>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{MOIS[moisActuel]} {anneeActuelle}</div>
              <button onClick={moisSuivant} style={btnNav} title="Mois suivant">›</button>
            </div>

            {/* En-têtes jours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
              {JOURS.map(j => (
                <div key={j} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 6 }}>{j[0]}</div>
              ))}
            </div>

            {/* Cellules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cellules.map((jour, i) => {
                const busyChantiers = jour ? (chantiersParJour[jour] || []) : [];
                const isToday = estAujourdhui(jour);
                return (
                  <div key={i} style={{
                    aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 2, borderRadius: 6, padding: '2px 1px',
                    background: isToday ? '#0d3d6e' : 'transparent',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: isToday ? 700 : 400, lineHeight: 1,
                      color: isToday ? '#fff' : jour ? 'var(--text-primary)' : 'transparent',
                    }}>{jour}</span>
                    {busyChantiers.length > 0 && !isToday && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {busyChantiers.slice(0, 3).map(c => (
                          <div key={c.id} style={{ width: 6, height: 6, borderRadius: 2, background: chantierColors[c.id] || '#0d3d6e', flexShrink: 0 }} />
                        ))}
                        {busyChantiers.length > 3 && (
                          <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-muted)', lineHeight: '6px' }}>+{busyChantiers.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Légende chantiers */}
            {chantiersDuMois.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 2 }}>Légende</div>
                {chantiersDuMois.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: chantierColors[c.id] || '#0d3d6e', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom || c.numero}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prochains jalons */}
          <div style={DS.card}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>Prochains jalons</div>
            {prochainsJalons.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Aucun jalon dans les 60 prochains jours</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {prochainsJalons.map((ev, i) => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const diffJ = Math.round((ev.date - today) / 86400000);
                  const quand = diffJ === 0 ? "Aujourd'hui" : diffJ === 1 ? 'Demain' : `Dans ${diffJ}j`;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 36, background: ev.color, borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.type}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ev.color }}>{quand}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ev.date.toLocaleDateString('fr-CH')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      )} {/* fin vue === 'calendrier' */}

      {/* ── MODAL ÉDITION ───────────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setModal(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass-strong)', borderRadius: 18, padding: 32, minWidth: 420, maxWidth: 520, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Modifier le planning</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>{modal.chantier.nom} · {modal.chantier.numero}</div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de début</label>
              <input type="date" value={modal.form.dateDebut} onChange={e => setModal({ ...modal, form: { ...modal.form, dateDebut: e.target.value } })} style={{ ...DS.input, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Durée (jours ouvrables)</label>
              <input type="number" min="1" value={modal.form.nombreJours} onChange={e => setModal({ ...modal, form: { ...modal.form, nombreJours: e.target.value } })} style={{ ...DS.input, width: '100%' }} />
              {modal.form.dateDebut && modal.form.nombreJours && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  Fin prévue : <strong style={{ color: 'var(--text-primary)' }}>{calculerDateFinOuvrables(modal.form.dateDebut, modal.form.nombreJours || 0, modal.form.inclusSamedi, modal.form.canton ?? 'GE')}</strong>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="inclus-samedi" checked={!!modal.form.inclusSamedi} onChange={e => setModal({ ...modal, form: { ...modal.form, inclusSamedi: e.target.checked } })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="inclus-samedi" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Inclure le samedi</label>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statut</label>
              <select value={modal.form.statut} onChange={e => setModal({ ...modal, form: { ...modal.form, statut: e.target.value } })} style={{ ...DS.input, width: '100%' }}>
                {TOUS_STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button onClick={supprimerDuPlanning} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Retirer du planning</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(null)} style={{ background: 'var(--border-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass-strong)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={sauvegarderModal} style={{ ...DS.btnPrimary, borderRadius: 10, padding: '10px 20px', fontSize: 13 }}>Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
