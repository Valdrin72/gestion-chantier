import React, { useState, useLayoutEffect } from 'react';
import {
  HardHat, Plus, Pencil, Power, BarChart2, Clock, Menu,
} from 'lucide-react';
import { fmtN, C, tarifHoraireEmploye } from '../donnees';
import { estDansPeriode, periodeLabel } from '../calculs/periode';
import { DS } from '../ds';
import { V1, mono, carteV1, heroFond, heroMono } from '../design/v1';
import { useApp } from '../context/AppContext';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
// Couleur du badge poste : métiers terrain bleu, rôles direction/admin ambre.
const ROLES_DIRECTION = ['chef de chantier', "chef d'équipe", 'comptable'];
const couleurPosteV1 = (poste) => ROLES_DIRECTION.includes((poste || '').trim().toLowerCase()) ? V1.warn : V1.bleu;

function Employes({ parametres, setParametres, chantiers, naviguer }) {
  const { profil, afficherNotif, periodeGlobale, ouvrirMenu } = useApp();
  const voirSalaires = ['cyna', 'cynatech'].includes(profil?.id);
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);
  const [onglet, setOnglet] = useState('equipe');
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifHeure: '', tarifRegieHeure: '', telephone: '', email: '', actif: true });
  const sauvegarder = () => {
    if (!form.nom || !form.tarifHeure) {
      if (afficherNotif) afficherNotif('Le nom et le tarif horaire sont obligatoires', 'error');
      return;
    }
    const isEdit = !!form.id;
    // E3 : le tarif est saisi à l'HEURE ; tarifJour dérivé (× 8, règle 8) pour les moteurs.
    const tarifHeure = parseFloat(form.tarifHeure);
    const empData = { ...form, tarifHeure, tarifJour: tarifHeure * 8, tarifRegieHeure: form.tarifRegieHeure ? parseFloat(form.tarifRegieHeure) : undefined };
    if (isEdit) setParametres({ ...parametres, employes: (parametres.employes || []).map(e => String(e.id) === String(form.id) ? empData : e) });
    else setParametres({ ...parametres, employes: [...(parametres.employes || []), { ...empData, id: Date.now() }] });
    setAjout(false);
    setForm({ nom: '', poste: 'Ouvrier qualifié', tarifHeure: '', tarifRegieHeure: '', telephone: '', email: '', actif: true });
    if (afficherNotif) afficherNotif(isEdit ? 'Employé mis à jour' : 'Employé ajouté à l\'équipe');
  };
  const employesAll = parametres.employes || [];
  const nbActifsTotal = employesAll.filter(e => e.actif !== false).length;

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      {(() => {
        const nbActifs = nbActifsTotal;
        const heuresTotal = chantiers.reduce((s, c) => s + (c.journal || []).reduce((js, j) => js + (j.employes || []).reduce((es, e) => es + (parseFloat(e.heuresTravaillees) || 0), 0), 0), 0);
        const coutMensuel = employesAll.filter(e => e.actif !== false).reduce((s, e) => s + (parseFloat(e.tarifJour) || 0) * 20, 0);
        // E3 : tarif moyen affiché à l'HEURE (source de saisie) — 2 décimales (ex. 43.75/h).
        const tarifMoyen = nbActifs > 0 ? Math.round(employesAll.filter(e => e.actif !== false).reduce((s, e) => s + tarifHoraireEmploye(e), 0) / nbActifs * 100) / 100 : 0;
        const heroChiffres = [
          { label: 'EFFECTIF',       val: String(employesAll.length),                                              couleur: '#8FBCE6', sub: `${nbActifs} actif${nbActifs !== 1 ? 's' : ''}` },
          { label: 'HEURES TOTALES', val: `${fmtN(Math.round(heuresTotal))}h`,                                      couleur: '#8FBCE6', sub: 'toutes périodes' },
          ...(voirSalaires ? [
            { label: 'COÛT MENSUEL',  val: `CHF ${fmtN(coutMensuel)}`,                                              couleur: '#F5B14A', sub: null },
            { label: 'TARIF MOYEN',   val: `CHF ${fmtN(tarifMoyen, tarifMoyen % 1 !== 0 ? 2 : 0)}/h`,               couleur: '#4ADE80', sub: null },
          ] : []),
        ];
        const onglets = [{ key: 'equipe', label: 'Équipe' }, { key: 'performance', label: 'Performance' }];
        return (
          <div className="page-hero-bleed" data-testid="hero-equipe" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
            {/* Ligne 1 — ☰ · CYNA · ÉQUIPE / 09 · Nouvel employé */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {ouvrirMenu && (
                <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
              )}
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
              <span style={heroMono(10, 0.55)}>· ÉQUIPE / 09</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setAjout(!ajout)} style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <Plus size={14} /> Nouvel employé
                </button>
              </div>
            </div>

            {/* Ligne 2 — titre + ligne mono */}
            <div style={heroMono(11, 0.6)}>ÉQUIPE / 09</div>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Équipe</h1>
            <div style={heroMono(11, 0.7)}>{employesAll.length} EMPLOYÉ{employesAll.length !== 1 ? 'S' : ''} · {nbActifs} ACTIF{nbActifs !== 1 ? 'S' : ''} SUR LE TERRAIN</div>

            {/* Ligne 3 — les 4 chiffres clés */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${heroChiffres.length}, 1fr)`, gap: 12, marginTop: 20 }} data-testid="hero-chiffres">
              {heroChiffres.map(t => (
                <div key={t.label} data-testid={`hero-kpi-${t.label.toLowerCase().replace(/[^a-zà-ÿ]+/g, '-').replace(/^-|-$/g, '')}`}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={heroMono(9, 0.6)}>{t.label}</div>
                  <div style={{ ...mono(22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.val}</div>
                  {t.sub && <div style={heroMono(9, 0.5)}>{t.sub}</div>}
                </div>
              ))}
            </div>

            {/* Ligne 4 — onglets collés au bas du hero */}
            <div style={{ display: 'flex', gap: 2, marginTop: 22, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {onglets.map(o => {
                const actif = onglet === o.key;
                return (
                  <button key={o.key} onClick={() => setOnglet(o.key)} style={{
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
        );
      })()}

      {onglet === 'equipe' && <>

      {ajout && (
        <div style={{ ...carteStyle, borderTop: `3px solid ${V1.bleu}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="ds-card-title" style={{ margin: 0 }}>{form.id ? 'Modifier' : 'Nouvel'} employé</div>
            {form.id && form.nom && <span style={{ ...mono(11, V1.bleu, 600) }}>{form.nom}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '15px' }}>
            <div><label style={labelStyle}>Nom complet *</label><input placeholder="Jean Martin" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Rôle *</label>
              <select value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} style={inputStyle}>
                {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
              </select></div>
            {voirSalaires && <div><label style={labelStyle}>Tarif horaire (CHF/h) * <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>— coût, 1 j = 8 h</span></label><input type="text" inputMode="numeric" placeholder="43.75" value={form.tarifHeure || ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, tarifHeure: raw }); }} style={inputStyle} /></div>}
            {voirSalaires && <div><label style={labelStyle}>Tarif régie /h (CHF HT — prix facturé)</label><input type="text" inputMode="numeric" placeholder="85" value={form.tarifRegieHeure ? fmtN(form.tarifRegieHeure) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, tarifRegieHeure: raw }); }} style={inputStyle} /></div>}
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
            <button onClick={sauvegarder} style={btnPrimaire}>Sauvegarder</button>
            <button onClick={() => setAjout(false)} style={DS.btnGhost}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g3)', gap: '15px' }}>
        {(parametres.employes || []).map(e => {
          const chantiersEmp = chantiers.filter(c => c.equipe?.some(m => String(m.employeId) === String(e.id)));
          const joursTotal = chantiers.reduce((t, c) => {
            const joursReels = (c.journal || []).filter(entry =>
              (entry.employes || []).some(emp => String(emp.employeId) === String(e.id) && parseFloat(emp.heuresTravaillees) > 0)
            ).length;
            return t + joursReels;
          }, 0);
          const cPoste = couleurPosteV1(e.poste);
          return (
            <div key={e.id} style={{ ...carteV1, borderTop: `3px solid ${cPoste}`, opacity: e.actif === false ? 0.55 : 1 }}>
              {/* En-tête : nom + contact (initiales retirées) + badge poste */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: V1.texte }}>{e.nom}</div>
                  {e.telephone && <div style={{ ...mono(10, V1.texteMuted), marginTop: 3 }}>{e.telephone}</div>}
                  {e.email && <div style={{ ...mono(10, V1.texteMuted), marginTop: 1 }}>{e.email}</div>}
                </div>
                <span style={{ ...mono(10, cPoste, 600), textTransform: 'uppercase', letterSpacing: '0.04em', background: cPoste + '16', border: `1px solid ${cPoste}30`, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>{e.poste}</span>
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: voirSalaires ? 'var(--g3)' : 'var(--g2)', gap: '8px' }}>
                {[
                  ...(voirSalaires ? [{ label: 'CHF/h', val: `${(() => { const h = tarifHoraireEmploye(e); return h % 1 !== 0 ? h.toFixed(2) : h; })()}`, couleur: V1.bleu }] : []),
                  { label: 'Chantiers', val: chantiersEmp.length, couleur: V1.ok },
                  { label: 'Jours', val: joursTotal, couleur: V1.texteMuted },
                ].map(s => (
                  <div key={s.label} style={{ background: s.couleur + '10', border: `1px solid ${s.couleur}25`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: V1.texteMuted, marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ ...mono(15, s.couleur, 600) }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => naviguer('chantiers', { employeActif: e.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <HardHat size={13} /> Chantiers ({chantiersEmp.length})
                </button>
                <button onClick={() => { setForm({ ...e, tarifHeure: tarifHoraireEmploye(e) || '' }); setAjout(true); }} style={{ ...DS.btnGhost, padding: '6px 10px' }}><Pencil size={13} /></button>
                <button
                  onClick={() => setParametres({ ...parametres, employes: (parametres.employes || []).map(emp => String(emp.id) === String(e.id) ? { ...emp, actif: e.actif === false } : emp) })}
                  style={{ ...(e.actif === false ? btnSucces : DS.btnGhost), padding: '6px 10px', fontSize: '12px' }}
                  title={e.actif === false ? 'Réactiver cet employé' : 'Désactiver cet employé (conserve l\'historique)'}
                >
                  <Power size={13} /> {e.actif === false ? 'Réactiver' : 'Désactiver'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      </>}

      {/* ── ONGLET PERFORMANCE ── */}
      {onglet === 'performance' && (() => {
        const periode = periodeGlobale || 'mois';
        const employesActifs = (parametres.employes || []).filter(e => e.actif !== false);

        // Calcul des métriques par employé
        const metriques = employesActifs.map(e => {
          const heures = chantiers.reduce((total, c) =>
            total + (c.journal || [])
              .filter(j => estDansPeriode(j.date, periode)) // source unique periode.js (local, inclusif — plus de décalage UTC)
              .reduce((s, j) =>
                s + (j.employes || [])
                  .filter(je => String(je.employeId) === String(e.id))
                  .reduce((h, je) => h + (parseFloat(je.heuresTravaillees) || 0), 0)
              , 0)
          , 0);

          const jours = Math.round(heures / 8 * 10) / 10;
          const coeffMO = e.tarifDejaCharge ? 1 : (parseFloat(parametres?.parametres?.coefficientMainOeuvre) || 1.0);
          const coutReel = jours * (parseFloat(e.tarifJour) || 0) * coeffMO;
          // Cohérence avec `heures` : chantiers où l'employé a pointé DANS la période (pas tout l'historique).
          const chantiersActifs = chantiers.filter(c =>
            (c.journal || []).some(j =>
              estDansPeriode(j.date, periode) && j.employes?.some(je => String(je.employeId) === String(e.id))
            )
          ).length;
          const moyHParJour = jours > 0 ? Math.round(heures / jours * 10) / 10 : 0;
          const alerteHeuresSup = jours > 0 && (heures / jours) > 9;

          return { e, heures, jours, coutReel, chantiersActifs, moyHParJour, alerteHeuresSup };
        });

        // KPIs globaux
        const totalHeures = metriques.reduce((s, m) => s + m.heures, 0);
        const totalCout = metriques.reduce((s, m) => s + m.coutReel, 0);
        const plusActif = metriques.reduce((best, m) => m.heures > (best?.heures || 0) ? m : best, null);

        const kpiPerf = [
          { label: 'HEURES ÉQUIPE', val: `${fmtN(Math.round(totalHeures))}h`, couleur: V1.bleu },
          ...(voirSalaires ? [{ label: 'COÛT MAIN-D\'ŒUVRE', val: `CHF ${fmtN(Math.round(totalCout))}`, couleur: V1.warn }] : []),
          { label: 'PLUS ACTIF', val: plusActif ? plusActif.e.nom : '—', couleur: V1.ok },
        ];

        const aucuneDonnee = metriques.every(m => m.heures === 0);
        const td = { padding: '13px 14px', borderBottom: `1px solid ${V1.separation}`, verticalAlign: 'middle' };

        return (
          <div>
            {/* Titre période */}
            <div style={{ ...mono(11, V1.bleu, 600), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={14} />
              Performance équipe — {periodeLabel(periodeGlobale || 'mois')}
            </div>

            {/* KPIs performance — cartes v1 sobres à liseré coloré */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiPerf.length}, 1fr)`, gap: 16, marginBottom: 20 }} data-testid="perf-kpis">
              {kpiPerf.map(k => (
                <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: V1.texteMuted, marginBottom: 8 }}>{k.label}</div>
                  <div style={{ ...mono(20, k.couleur, 600), lineHeight: 1.1 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* État vide */}
            {(employesActifs.length === 0 || aucuneDonnee) ? (
              <div style={{ ...carteV1, textAlign: 'center', padding: '48px 24px' }}>
                <Clock size={40} style={{ color: V1.texteMuted, marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: V1.texte, marginBottom: 6 }}>
                  {employesActifs.length === 0 ? 'Aucun employé actif' : 'Aucune heure enregistrée sur cette période'}
                </div>
                <div style={{ fontSize: 12, color: V1.texteMuted }}>
                  {employesActifs.length === 0
                    ? 'Ajoutez des employés actifs dans l\'onglet Équipe.'
                    : 'Les heures sont enregistrées dans le journal des chantiers.'}
                </div>
              </div>
            ) : (
              <div style={{ ...carteV1, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Employé', 'Poste', 'Heures', 'Jours', ...(voirSalaires ? ['Coût main-d\'œuvre'] : []), 'Chantiers', 'Moy. h/jour'].map(h => (
                        <th key={h} style={{ ...mono(10, V1.texteMuted), textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 14px', borderBottom: `1px solid ${V1.separation}`, background: '#FAFBFC', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metriques.map(({ e, heures, jours, coutReel, chantiersActifs, moyHParJour, alerteHeuresSup }) => (
                      <tr key={e.id} style={{ opacity: heures === 0 ? 0.5 : 1 }}>
                        <td style={td}>
                          {/* Initiales retirées — nom seul + alerte heures sup. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: V1.texte }}>{e.nom}</span>
                            {alerteHeuresSup && (
                              <span style={{ ...mono(10, V1.warn, 700), background: V1.warn + '18', border: `1px solid ${V1.warn}30`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                ⚠ Heures sup.
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={td}><span style={{ color: V1.texteMuted, fontSize: 12 }}>{e.poste || '—'}</span></td>
                        <td style={td}><span style={{ ...mono(13, V1.bleu, 600) }}>{fmtN(Math.round(heures * 10) / 10)}h</span></td>
                        <td style={td}>{jours > 0 ? <span style={{ ...mono(13, V1.texte, 600) }}>{jours}j</span> : <span style={{ color: V1.texteMuted }}>—</span>}</td>
                        {voirSalaires && (
                          <td style={td}><span style={{ ...mono(13, coutReel > 0 ? V1.ok : V1.texteMuted, 600) }}>{coutReel > 0 ? `CHF ${fmtN(Math.round(coutReel))}` : '—'}</span></td>
                        )}
                        <td style={td}>
                          {chantiersActifs > 0
                            ? <span style={{ ...mono(11, V1.bleu, 600), background: V1.bleuFond, borderRadius: 20, padding: '2px 9px' }}>{chantiersActifs}</span>
                            : <span style={{ color: V1.texteMuted }}>—</span>}
                        </td>
                        <td style={td}>{moyHParJour > 0 ? <span style={{ ...mono(12, moyHParJour > 9 ? V1.warn : V1.texteMuted, 600) }}>{moyHParJour}h</span> : <span style={{ color: V1.texteMuted }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// Composant défini à niveau module pour stabilité React (ne pas définir à l'intérieur d'un autre composant)
export function EditEmployeRow({ e, parametres, sauv }) {
  // E3 : l'édition porte sur le tarif HORAIRE (dérivé du journalier legacy si absent).
  const [ed, setEd] = useState({ ...e, tarifHeure: tarifHoraireEmploye(e) || '' });
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <tr key={e.id}>
      <td style={tdStyle}><strong>{e.nom}</strong></td>
      <td style={tdStyle}>{e.poste || '—'}</td>
      <td style={tdStyle}><strong style={{ color: C.primaire }}>CHF {(() => { const h = tarifHoraireEmploye(e); return h % 1 !== 0 ? h.toFixed(2) : h; })()}/h</strong></td>
      <td style={tdStyle}>{e.telephone || '—'}</td>
      <td style={tdStyle}>{e.email || '—'}</td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditing(true)} style={{ ...DS.btnGhost, padding: '4px 10px', fontSize: 12 }}><Pencil size={12} /> Modifier</button>
          <button
            onClick={() => sauv({ ...parametres, employes: (parametres.employes || []).map(emp => String(emp.id) === String(e.id) ? { ...emp, actif: e.actif === false } : emp) })}
            style={{ ...(e.actif === false ? btnSucces : DS.btnGhost), padding: '4px 10px', fontSize: 12 }}
            title={e.actif === false ? 'Réactiver cet employé' : 'Désactiver cet employé (conserve l\'historique)'}
          >
            <Power size={12} /> {e.actif === false ? 'Réactiver' : 'Désactiver'}
          </button>
        </div>
      </td>
    </tr>
  );
  return (
    <tr key={e.id} style={{ background: 'rgba(13,61,110,0.06)' }}>
      <td style={tdStyle}><input value={ed.nom} onChange={ev => setEd({ ...ed, nom: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}>
        <select value={ed.poste || ''} onChange={ev => setEd({ ...ed, poste: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }}>
          {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
        </select>
      </td>
      <td style={tdStyle}><input type="text" inputMode="numeric" value={ed.tarifHeure || ''} onChange={ev => { const raw = ev.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setEd({ ...ed, tarifHeure: raw }); }} style={{ ...inputStyle, padding: '5px 8px', width: 80 }} /></td>
      <td style={tdStyle}><input value={ed.telephone || ''} onChange={ev => setEd({ ...ed, telephone: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}><input value={ed.email || ''} onChange={ev => setEd({ ...ed, email: ev.target.value })} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => {
            const tarifH = parseFloat(ed.tarifHeure);
            if (!ed.nom?.trim()) return alert('Le nom est obligatoire.');
            if (!tarifH || tarifH <= 0) return alert('Le tarif horaire doit être supérieur à 0.');
            // E3 : horaire saisi ; tarifJour dérivé (× 8) pour les moteurs — coût inchangé.
            sauv({ ...parametres, employes: (parametres.employes || []).map(emp => String(emp.id) === String(e.id) ? { ...ed, tarifHeure: tarifH, tarifJour: tarifH * 8 } : emp) });
            setEditing(false);
          }} style={btnSucces}>OK</button>
          <button onClick={() => setEditing(false)} style={btnDanger}>×</button>
        </div>
      </td>
    </tr>
  );
}

export default Employes;
