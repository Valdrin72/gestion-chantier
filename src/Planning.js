import React, { useState, useMemo, useCallback } from 'react';
import { calculerDateFinOuvrables, joursOuvrableRestants, getAlerte, C } from './donnees';
import { DS } from './ds';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const STATUTS = ['Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'];

export default function Planning({ chantiers, setChantiers, clients, naviguer }) {
  const [vue, setVue] = useState('timeline');
  const [moisActuel, setMoisActuel] = useState(new Date().getMonth());
  const [anneeActuelle, setAnneeActuelle] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(null); // null ou { chantier, form }

  const couleurStatut = (s) => ({
    'En cours': C.warning,
    'Terminé': C.secondaire,
    'Planifié': C.info,
    'Suspendu': C.danger,
    'Facturé': C.violet,
    'Clôturé': '#455a64'
  }[s] || C.primaire);

  // ── Modal helpers ──────────────────────────────────────────────
  const ouvrirModal = useCallback((c) => {
    setModal({
      chantier: c,
      form: {
        dateDebut: c.dateDebut || '',
        nombreJours: c.nombreJours || '',
        joursImprevus: c.joursImprevus || 0,
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
          ? { ...c, dateDebut: form.dateDebut, nombreJours: parseInt(form.nombreJours) || c.nombreJours, joursImprevus: parseInt(form.joursImprevus) || 0, statut: form.statut, inclusSamedi: form.inclusSamedi }
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

  const jours = useMemo(
    () => Array.from({ length: nbJoursMois }, (_, i) => i + 1),
    [nbJoursMois]
  );

  const chantiersDuMois = useMemo(() => chantiers.filter(c => {
    if (!c.dateDebut || !c.nombreJours) return false;
    const debut = new Date(c.dateDebut);
    const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0) + (parseInt(c.joursImprevus) || 0), c.inclusSamedi));
    const debutMois = new Date(anneeActuelle, moisActuel, 1);
    const finMois = new Date(anneeActuelle, moisActuel + 1, 0);
    return debut <= finMois && fin >= debutMois;
  }), [chantiers, anneeActuelle, moisActuel]);

  const chantiersNonPlanifies = useMemo(
    () => chantiers.filter(c => !c.dateDebut && c.statut !== 'Terminé' && c.statut !== 'Clôturé' && c.statut !== 'Facturé'),
    [chantiers]
  );

  const getPositionChantier = useCallback((chantier) => {
    const debut = new Date(chantier.dateDebut);
    const fin = new Date(calculerDateFinOuvrables(chantier.dateDebut, (chantier.nombreJours || 0) + (parseInt(chantier.joursImprevus) || 0), chantier.inclusSamedi));
    const debutMois = new Date(anneeActuelle, moisActuel, 1);
    const finMois = new Date(anneeActuelle, moisActuel + 1, 0);
    const debutVisible = debut < debutMois ? debutMois : debut;
    const finVisible = fin > finMois ? finMois : fin;
    const startDay = debutVisible.getDate();
    const endDay = finVisible.getDate();
    const left = ((startDay - 1) / nbJoursMois) * 100;
    const width = ((endDay - startDay + 1) / nbJoursMois) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  }, [anneeActuelle, moisActuel, nbJoursMois]);

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
        const fin = new Date(calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0) + (parseInt(c.joursImprevus) || 0), c.inclusSamedi));
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
    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
  };

  return (
    <div>
      {/* ── EN-TÊTE ─────────────────────────────────────────────── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Planning des chantiers</div>
          <div className="page-title-sub">{chantiersDuMois.length} chantier{chantiersDuMois.length !== 1 ? 's' : ''} ce mois · {chantiersNonPlanifies.length} non planifié{chantiersNonPlanifies.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions-group">
          {['timeline', 'calendrier', 'liste'].map(v => (
            <button key={v} onClick={() => setVue(v)} style={{
              background: vue === v ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
              color: vue === v ? '#3b82f6' : 'var(--text-secondary)',
              border: vue === v ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
              padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '13px', fontWeight: vue === v ? 700 : 500,
              fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
            }}>
              {{ timeline: '📊 Timeline', calendrier: '📅 Calendrier', liste: '📋 Liste' }[v]}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHANTIERS NON PLANIFIÉS ─────────────────────────────── */}
      {chantiersNonPlanifies.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: C.warning, fontWeight: 700, fontSize: 13 }}>⚠️ {chantiersNonPlanifies.length} chantier{chantiersNonPlanifies.length > 1 ? 's' : ''} sans date :</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chantiersNonPlanifies.map(c => (
              <button key={c.id} onClick={() => ouvrirModal(c)} style={{ background: 'rgba(245,158,11,0.14)', color: C.warning, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                + Planifier {c.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── NAVIGATION MOIS ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={moisPrecedent} style={{ ...DS.btnPrimary, padding: '8px 14px', fontSize: '16px' }}>←</button>
        <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', minWidth: '200px', textAlign: 'center', letterSpacing: '-0.3px' }}>{MOIS[moisActuel]} {anneeActuelle}</div>
        <button onClick={moisSuivant} style={{ ...DS.btnPrimary, padding: '8px 14px', fontSize: '16px' }}>→</button>
        <button onClick={() => { setMoisActuel(new Date().getMonth()); setAnneeActuelle(new Date().getFullYear()); }}
          style={{ ...DS.btnPrimary }}>
          Aujourd'hui
        </button>
      </div>

      {/* ===== VUE TIMELINE ===================================== */}
      {vue === 'timeline' && (
        <div style={DS.card}>
          {/* EN-TÊTE JOURS */}
          <div style={{ display: 'flex', marginBottom: '10px', marginLeft: '200px' }}>
            {jours.map(j => {
              const date = new Date(anneeActuelle, moisActuel, j);
              const jourSemaine = date.getDay();
              const estWeekend = jourSemaine === 0 || jourSemaine === 6;
              const estToday = estAujourdhui(j);
              return (
                <div key={j} style={{
                  flex: 1, textAlign: 'center', fontSize: '11px',
                  color: estToday ? C.danger : estWeekend ? 'var(--border)' : 'var(--text-secondary)',
                  fontWeight: estToday ? 'bold' : 'normal',
                  borderLeft: estToday ? `2px solid ${C.danger}` : '1px solid var(--border)',
                  paddingBottom: '5px'
                }}>
                  {j}
                  <div style={{ fontSize: '9px', color: estWeekend ? 'var(--border)' : 'var(--text-secondary)' }}>
                    {JOURS[jourSemaine === 0 ? 6 : jourSemaine - 1]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIGNES CHANTIERS */}
          {chantiersDuMois.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
              Aucun chantier ce mois
            </div>
          ) : (
            chantiersDuMois.map(c => {
              const pos = getPositionChantier(c);
              const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
              const al = getAlerte(j);
              const client = clients.find(cl => cl.id === c.clientId);

              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', position: 'relative' }}>
                  {/* NOM CHANTIER */}
                  <div style={{ width: '200px', minWidth: '200px', paddingRight: '10px', cursor: 'pointer' }}
                    onClick={() => ouvrirModal(c)}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline' }}>{c.nom}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{client?.entreprise || c.ville}</div>
                  </div>

                  {/* BARRE TIMELINE */}
                  <div style={{ flex: 1, position: 'relative', height: '35px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                    {/* GRILLE WEEKEND */}
                    {jours.filter(j => {
                      const d = new Date(anneeActuelle, moisActuel, j).getDay();
                      return d === 0 || d === 6;
                    }).map(j => (
                        <div key={j} style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${((j - 1) / nbJoursMois) * 100}%`,
                          width: `${(1 / nbJoursMois) * 100}%`,
                          background: 'rgba(255,255,255,0.03)'
                        }} />
                    ))}

                    {/* LIGNE AUJOURD'HUI */}
                    {moisActuel === aujourdhui.getMonth() && anneeActuelle === aujourdhui.getFullYear() && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${((aujourdhui.getDate() - 1) / nbJoursMois) * 100}%`,
                        width: '2px', background: C.danger, zIndex: 2
                      }} />
                    )}

                    {/* BARRE CHANTIER (cliquable) */}
                    <div onClick={() => ouvrirModal(c)} style={{
                      position: 'absolute', top: '4px', bottom: '4px',
                      left: pos.left, width: pos.width,
                      background: al ? al.couleur : couleurStatut(c.statut),
                      borderRadius: '4px', display: 'flex', alignItems: 'center',
                      paddingLeft: '8px', overflow: 'hidden', zIndex: 1,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)', cursor: 'pointer',
                    }}>
                      <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {c.nom}
                      </span>
                    </div>
                  </div>

                  {/* STATUT + BOUTON MODIFIER */}
                  <div style={{ marginLeft: '10px', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ background: couleurStatut(c.statut) + '18', color: couleurStatut(c.statut), padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      {c.statut}
                    </span>
                    {al && j <= 5 && (
                      <div style={{ fontSize: '10px', color: al.couleur, fontWeight: 'bold' }}>{al.texte}</div>
                    )}
                    <button onClick={() => ouvrirModal(c)} style={{ ...btnEdit, fontSize: 11, padding: '3px 10px' }}>✏️ Modifier</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== VUE CALENDRIER ==================================== */}
      {vue === 'calendrier' && (
        <div style={DS.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {JOURS.map(j => (
              <div key={j} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)', padding: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{j}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {cellules.map((jour, i) => {
              const chantiersJour = chantiersParJour[jour] || [];
              const estWE = i % 7 >= 5;
              const estToday = estAujourdhui(jour);
              return (
                <div key={`${anneeActuelle}-${moisActuel}-${i}`} style={{
                  minHeight: '90px',
                  background: jour
                    ? (estToday ? 'rgba(59,130,246,0.12)' : estWE ? 'var(--bg-hover)' : 'var(--bg-card)')
                    : 'var(--bg-hover)',
                  border: `1px solid ${estToday ? '#3b82f6' : 'var(--border)'}`,
                  borderRadius: '6px', padding: '5px', overflow: 'hidden'
                }}>
                  {jour && (
                    <>
                      <div key="day" style={{
                        fontSize: '13px', fontWeight: estToday ? 'bold' : 'normal',
                        color: estToday ? '#3b82f6' : estWE ? 'var(--text-secondary)' : 'var(--text-primary)',
                        marginBottom: '3px'
                      }}>{jour}</div>
                      {chantiersJour.slice(0, 2).map(c => (
                        <div key={c.id} onClick={() => ouvrirModal(c)} style={{
                          background: couleurStatut(c.statut) + '18', color: couleurStatut(c.statut),
                          fontSize: '10px', padding: '2px 5px', borderRadius: '3px',
                          marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: 600, cursor: 'pointer',
                        }}>
                          {c.nom}
                        </div>
                      ))}
                      {chantiersJour.length > 2 && (
                        <div key="more" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>+{chantiersJour.length - 2} autres</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== VUE LISTE ========================================= */}
      {vue === 'liste' && (
        <div style={DS.card}>
          {chantiersDuMois.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Aucun chantier ce mois</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Chantier', 'Client', 'Début', 'Fin prévue', 'Jours', 'Statut', 'Alerte', ''].map(h => (
                    <th key={h} style={DS.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chantiersDuMois.map((c) => {
                  const j = joursOuvrableRestants(c.dateDebut, c.nombreJours, c.inclusSamedi);
                  const al = getAlerte(j);
                  const client = clients.find(cl => cl.id === c.clientId);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                      onClick={() => ouvrirModal(c)}>
                      <td style={{ padding: '10px 15px', color: 'var(--text-primary)' }}><strong>{c.nom}</strong><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.numero}</div></td>
                      <td style={{ padding: '10px 15px', color: 'var(--text-primary)' }}>{client?.entreprise || '-'}</td>
                      <td style={{ padding: '10px 15px', color: 'var(--text-primary)' }}>{c.dateDebut}</td>
                      <td style={{ padding: '10px 15px', color: 'var(--text-primary)' }}>{calculerDateFinOuvrables(c.dateDebut, (c.nombreJours || 0) + (parseInt(c.joursImprevus) || 0), c.inclusSamedi)}</td>
                      <td style={{ padding: '10px 15px', color: 'var(--text-primary)' }}>{c.nombreJours}j {c.joursImprevus > 0 && <span style={{ color: C.warning }}>+{c.joursImprevus}j</span>}</td>
                      <td style={{ padding: '10px 15px' }}>
                        <span style={{ background: couleurStatut(c.statut) + '18', color: couleurStatut(c.statut), padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{c.statut}</span>
                      </td>
                      <td style={{ padding: '10px 15px' }}>
                        {al && <span style={{ color: al.couleur, fontWeight: 'bold', fontSize: '12px' }}>{al.texte}</span>}
                      </td>
                      <td style={{ padding: '10px 15px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => ouvrirModal(c)} style={btnEdit}>✏️ Modifier</button>
                          {naviguer && (
                            <button onClick={() => naviguer('chantiers', { chantierActif: c.id })} style={{ ...btnEdit, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>Voir →</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── LÉGENDE ────────────────────────────────────────────── */}
      <div style={{ ...DS.card, padding: '15px 25px', marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Légende :</strong>
          {[
            { label: 'En cours', couleur: C.warning },
            { label: 'Planifié', couleur: C.info },
            { label: 'Terminé', couleur: C.secondaire },
            { label: 'Suspendu', couleur: C.danger },
            { label: 'Alerte < 5j', couleur: C.orange },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.couleur }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '3px', height: '14px', background: C.danger }} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Aujourd'hui</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>Cliquer sur un chantier pour modifier</span>
        </div>
      </div>

      {/* ===== MODAL ÉDITION ===================================== */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }} onClick={() => setModal(null)}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18, padding: 32, minWidth: 420, maxWidth: 520, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>

            {/* Titre */}
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              ✏️ Modifier le planning
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              {modal.chantier.nom} · {modal.chantier.numero}
            </div>

            {/* Date de début */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de début</label>
              <input type="date" value={modal.form.dateDebut}
                onChange={e => setModal({ ...modal, form: { ...modal.form, dateDebut: e.target.value } })}
                style={{ ...DS.input, width: '100%' }} />
            </div>

            {/* Nombre de jours */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Durée prévue (jours ouvrables)</label>
              <input type="number" min="1" value={modal.form.nombreJours}
                onChange={e => setModal({ ...modal, form: { ...modal.form, nombreJours: e.target.value } })}
                style={{ ...DS.input, width: '100%' }} />
              {modal.form.dateDebut && modal.form.nombreJours && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  Fin prévue : <strong style={{ color: 'var(--text-primary)' }}>{calculerDateFinOuvrables(modal.form.dateDebut, (modal.form.nombreJours || 0) + (parseInt(modal.form.joursImprevus) || 0), modal.form.inclusSamedi)}</strong>
                </div>
              )}
            </div>

            {/* Jours imprévus */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jours imprévus</label>
              <input type="number" min="0" value={modal.form.joursImprevus}
                onChange={e => setModal({ ...modal, form: { ...modal.form, joursImprevus: e.target.value } })}
                style={{ ...DS.input, width: '100%' }} />
            </div>

            {/* Inclure samedi */}
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="inclus-samedi" checked={!!modal.form.inclusSamedi}
                onChange={e => setModal({ ...modal, form: { ...modal.form, inclusSamedi: e.target.checked } })}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="inclus-samedi" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Inclure le samedi comme jour ouvrable</label>
            </div>

            {/* Statut */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statut</label>
              <select value={modal.form.statut}
                onChange={e => setModal({ ...modal, form: { ...modal.form, statut: e.target.value } })}
                style={{ ...DS.input, width: '100%' }}>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button onClick={supprimerDuPlanning} style={{
                background: 'rgba(239,68,68,0.12)', color: C.danger,
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}>
                🗑 Retirer du planning
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(null)} style={{
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}>Annuler</button>
                <button onClick={sauvegarderModal} style={{
                  ...DS.btnPrimary, borderRadius: 10, padding: '10px 20px', fontSize: 13,
                }}>
                  ✓ Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
