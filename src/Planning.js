import React, { useState, useMemo, useCallback } from 'react';
import { Zap, Calendar } from 'lucide-react';
import { calculerDateFinOuvrables, getAlerte } from './donnees';
import { DS } from './ds';
import { TOUS_STATUTS } from './constants/statuts';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

export default function Planning({ chantiers, setChantiers, clients, parametres, naviguer }) {
  const [moisActuel, setMoisActuel] = useState(new Date().getMonth());
  const [anneeActuelle, setAnneeActuelle] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(null); // null ou { chantier, form }
  const [showOptimiseur, setShowOptimiseur] = useState(false);

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
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0), c.inclusSamedi));
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
        const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0), c.inclusSamedi));
        return date >= debut && date <= fin;
      });
    });
    return map;
  }, [chantiers, anneeActuelle, moisActuel, cellules]);

  const aujourdhui = new Date();
  const estAujourdhui = (jour) => jour && anneeActuelle === aujourdhui.getFullYear() &&
    moisActuel === aujourdhui.getMonth() && jour === aujourdhui.getDate();

  const btnEdit = {
    background: 'rgba(59,130,246,0.14)', color: '#60a5fa',
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
        const finStr = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi);
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
        const joursR = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
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
  }, [chantiers, parametres]);

  return (
    <div>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Planning</div>
          <div className="page-title-sub">
            {chantiersDuMois.length} chantier{chantiersDuMois.length !== 1 ? 's' : ''} ce mois
            {chantiersNonPlanifies.length > 0 && ` · ${chantiersNonPlanifies.length} sans date`}
          </div>
        </div>
        <div className="page-actions-group">
          <button onClick={moisPrecedent} style={btnNav} title="Mois précédent">←</button>
          <button onClick={() => { setMoisActuel(new Date().getMonth()); setAnneeActuelle(new Date().getFullYear()); }} style={btnNav}>Aujourd'hui</button>
          <button onClick={moisSuivant} style={btnNav} title="Mois suivant">→</button>
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

      {/* ── LAYOUT 2 COLONNES ───────────────────────────────────── */}
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
              const joursRealises_ = new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
              const jours = c.nombreJours > 0 ? c.nombreJours - joursRealises_ : null;
              const progress = Math.max(0, Math.min(100, parseFloat(c.avancement) || 0));
              const dateFin = calculerDateFinOuvrables(c.dateDebut, parseInt(c.nombreJours) || 0, c.inclusSamedi);
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
                    background: isToday ? '#3b82f6' : 'transparent',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: isToday ? 700 : 400, lineHeight: 1,
                      color: isToday ? '#fff' : jour ? 'var(--text-primary)' : 'transparent',
                    }}>{jour}</span>
                    {busyChantiers.length > 0 && !isToday && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {busyChantiers.slice(0, 3).map(c => (
                          <div key={c.id} style={{ width: 6, height: 6, borderRadius: 2, background: chantierColors[c.id] || '#3b82f6', flexShrink: 0 }} />
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
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: chantierColors[c.id] || '#3b82f6', flexShrink: 0 }} />
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
                  Fin prévue : <strong style={{ color: 'var(--text-primary)' }}>{calculerDateFinOuvrables(modal.form.dateDebut, modal.form.nombreJours || 0, modal.form.inclusSamedi)}</strong>
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
