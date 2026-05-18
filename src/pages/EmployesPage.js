import React, { useState } from 'react';
import {
  Users, HardHat, TrendingUp, Plus, Pencil, Trash2,
  DollarSign, Clock, BarChart2,
} from 'lucide-react';
import { fmtN, C, getIntervallesPeriode, getPeriodeLabel } from '../donnees';
import { DS } from '../ds';
import { Badge } from '../components/SharedBadges';
import { useApp } from '../context/AppContext';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Employes({ parametres, setParametres, chantiers, naviguer }) {
  const { profil, afficherNotif, periodeGlobale } = useApp();
  const voirSalaires = ['direction', 'sinaap', 'sinatec'].includes(profil?.id);
  const [onglet, setOnglet] = useState('equipe');
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
  const sauvegarder = () => {
    if (!form.nom || !form.tarifJour) {
      if (afficherNotif) afficherNotif('Le nom et le tarif journalier sont obligatoires', 'error');
      return;
    }
    const isEdit = !!form.id;
    if (isEdit) setParametres({ ...parametres, employes: (parametres.employes || []).map(e => String(e.id) === String(form.id) ? { ...form, tarifJour: parseFloat(form.tarifJour) } : e) });
    else setParametres({ ...parametres, employes: [...(parametres.employes || []), { ...form, id: Date.now(), tarifJour: parseFloat(form.tarifJour) }] });
    setAjout(false);
    setForm({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
    if (afficherNotif) afficherNotif(isEdit ? 'Employé mis à jour' : 'Employé ajouté à l\'équipe');
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

      {/* ── ONGLETS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'equipe', label: 'Équipe', Icon: Users },
          { key: 'performance', label: 'Performance', Icon: BarChart2 },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setOnglet(key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: onglet === key ? 'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)' : 'var(--ds-btn-ghost-bg)',
              color: onglet === key ? '#fff' : 'var(--text-secondary)',
              boxShadow: onglet === key ? '0 2px 10px rgba(59,130,246,0.30)' : 'none',
              border: onglet === key ? 'none' : '1px solid var(--ds-btn-ghost-border)',
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {onglet === 'equipe' && <>

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
          ...(voirSalaires ? [
            { label: 'COÛT MENSUEL',  val: `CHF ${fmtN(coutMensuel)}`, Icon: DollarSign, ...DS.kpi.amber },
            { label: 'TARIF MOYEN',   val: `CHF ${fmtN(tarifMoyen)}/j`, Icon: TrendingUp, ...DS.kpi.purple },
          ] : []),
        ];
        return (
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} className="kpi-card" style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div className="kpi-val" style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.badge && <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, position: 'relative' }}>{k.badge}</span>}
              </div>
            ))}
          </div>
        );
      })()}

      {ajout && (
        <div style={carteStyle}>
          <div className="ds-card-title">{form.id ? 'Modifier' : 'Nouvel'} employé</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '15px' }}>
            <div><label style={labelStyle}>Nom complet *</label><input placeholder="Jean Martin" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Rôle *</label>
              <select value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })} style={inputStyle}>
                {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
              </select></div>
            {voirSalaires && <div><label style={labelStyle}>Tarif/jour (CHF) *</label><input type="text" inputMode="numeric" placeholder="350" value={form.tarifJour ? fmtN(form.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, tarifJour: raw }); }} style={inputStyle} /></div>}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g3)', gap: '15px' }}>
        {(parametres.employes || []).map(e => {
          const chantiersEmp = chantiers.filter(c => c.equipe?.some(m => String(m.employeId) === String(e.id)));
          const joursTotal = chantiers.reduce((t, c) => {
            const joursReels = (c.journal || []).filter(entry =>
              (entry.employes || []).some(emp => String(emp.employeId) === String(e.id) && parseFloat(emp.heuresTravaillees) > 0)
            ).length;
            return t + joursReels;
          }, 0);
          const couleurPoste = { 'Chef de chantier': C.primaire, "Chef d'équipe": C.info, 'Ouvrier qualifié': C.secondaire, 'Manœuvre': C.orange, 'Sous-traitant': C.violet, 'Technicien': C.cyan, 'Comptable': C.mauve }[e.poste] || C.primaire;
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
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: voirSalaires ? 'var(--g3)' : 'var(--g2)', gap: '8px' }}>
                {[
                  ...(voirSalaires ? [{ label: 'CHF/jour', val: `${e.tarifJour}`, couleur: C.primaire }] : []),
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
                <button onClick={() => {
                  const heuresEmp = chantiers.reduce((total, c) => total + (c.journal || []).reduce((jt, j) => jt + (j.employes || []).filter(m => String(m.employeId) === String(e.id)).reduce((et, m) => et + (parseFloat(m.heuresTravaillees) || 0), 0), 0), 0);
                  const joursEmp = heuresEmp > 0 ? Math.round(heuresEmp / 8 * 10) / 10 : 0;
                  const avertissement = heuresEmp > 0
                    ? `\n\n⚠ ATTENTION : ${e.nom} a ${Math.round(heuresEmp)}h travaillées (≈ ${joursEmp} jours) dans le journal. Après suppression, le coût MO de ces entrées sera recalculé à 0 CHF dans tous les chantiers concernés.`
                    : '';
                  if (window.confirm(`Supprimer ${e.nom} ?${avertissement}`)) setParametres({ ...parametres, employes: (parametres.employes || []).filter(emp => String(emp.id) !== String(e.id)) });
                }} style={{ ...btnDanger, padding: '6px 10px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      </>}

      {/* ── ONGLET PERFORMANCE ── */}
      {onglet === 'performance' && (() => {
        const { debut, fin } = getIntervallesPeriode(periodeGlobale || 'mois');
        const employesActifs = (parametres.employes || []).filter(e => e.actif !== false);

        // Calcul des métriques par employé
        const metriques = employesActifs.map(e => {
          const heures = chantiers.reduce((total, c) =>
            total + (c.journal || [])
              .filter(j => {
                const dt = new Date(j.date);
                return dt >= debut && dt <= fin;
              })
              .reduce((s, j) =>
                s + (j.employes || [])
                  .filter(je => String(je.employeId) === String(e.id))
                  .reduce((h, je) => h + (parseFloat(je.heuresTravaillees) || 0), 0)
              , 0)
          , 0);

          const jours = Math.round(heures / 8 * 10) / 10;
          const coutReel = jours * (parseFloat(e.tarifJour) || 0);
          const chantiersActifs = chantiers.filter(c =>
            (c.journal || []).some(j =>
              j.employes?.some(je => String(je.employeId) === String(e.id))
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
          { label: 'HEURES ÉQUIPE', val: `${fmtN(Math.round(totalHeures))}h`, Icon: Clock, ...DS.kpi.blue },
          ...(voirSalaires ? [{ label: 'COÛT MO RÉEL', val: `CHF ${fmtN(Math.round(totalCout))}`, Icon: DollarSign, ...DS.kpi.amber }] : []),
          { label: 'PLUS ACTIF', val: plusActif ? plusActif.e.nom : '—', Icon: TrendingUp, ...DS.kpi.green },
        ];

        const aucuneDonnee = metriques.every(m => m.heures === 0);

        return (
          <div>
            {/* Titre période */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={14} />
              Performance équipe — {getPeriodeLabel(periodeGlobale || 'mois')}
            </div>

            {/* KPIs performance */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiPerf.length}, 1fr)`, gap: 16, marginBottom: 20 }}>
              {kpiPerf.map(k => (
                <div key={k.label} className="kpi-card" style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 110, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
                    <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, position: 'relative' }}>{k.label}</div>
                  <div className="kpi-val" style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* État vide */}
            {(employesActifs.length === 0 || aucuneDonnee) ? (
              <div style={{ ...carteStyle, textAlign: 'center', padding: '48px 24px' }}>
                <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {employesActifs.length === 0 ? 'Aucun employé actif' : 'Aucune heure enregistrée sur cette période'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {employesActifs.length === 0
                    ? 'Ajoutez des employés actifs dans l\'onglet Équipe.'
                    : 'Les heures sont enregistrées dans le journal des chantiers.'}
                </div>
              </div>
            ) : (
              <div style={{ ...carteStyle, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Employé', 'Poste', 'Heures', 'Jours', ...(voirSalaires ? ['Coût MO réel'] : []), 'Chantiers', 'Moy. h/jour'].map(h => (
                        <th key={h} style={DS.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metriques.map(({ e, heures, jours, coutReel, chantiersActifs, moyHParJour, alerteHeuresSup }) => (
                      <tr key={e.id} style={{ opacity: heures === 0 ? 0.5 : 1 }}>
                        <td style={DS.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F620 0%, #4F46E520 100%)', border: '1px solid #3B82F630', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#3B82F6', flexShrink: 0 }}>
                              {e.nom.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{e.nom}</span>
                            {alerteHeuresSup && (
                              <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                ⚠ Heures sup.
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={DS.td}><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.poste || '—'}</span></td>
                        <td style={DS.td}><strong style={{ color: '#3B82F6' }}>{fmtN(Math.round(heures * 10) / 10)}h</strong></td>
                        <td style={DS.td}>{jours > 0 ? <strong>{jours}j</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        {voirSalaires && (
                          <td style={DS.td}><strong style={{ color: coutReel > 0 ? '#065F46' : 'var(--text-muted)' }}>{coutReel > 0 ? `CHF ${fmtN(Math.round(coutReel))}` : '—'}</strong></td>
                        )}
                        <td style={DS.td}>
                          {chantiersActifs > 0
                            ? <span style={{ background: '#DBEAFE', color: '#1E40AF', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{chantiersActifs}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={DS.td}>{moyHParJour > 0 ? <span style={{ color: moyHParJour > 9 ? '#92400E' : 'var(--text-secondary)' }}>{moyHParJour}h</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          <button onClick={() => { if (window.confirm(`Supprimer ${e.nom} ?\n\n⚠ ATTENTION : si cet employé a des heures dans le journal des chantiers, le coût MO de ces entrées sera recalculé à 0 CHF après suppression.`)) sauv({ ...parametres, employes: (parametres.employes || []).filter(emp => String(emp.id) !== String(e.id)) }); }} style={{ ...btnDanger, padding: '4px 8px' }}>Suppr</button>
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
          <button onClick={() => {
            const tarif = parseFloat(ed.tarifJour);
            if (!ed.nom?.trim()) return alert('Le nom est obligatoire.');
            if (!tarif || tarif <= 0) return alert('Le tarif journalier doit être supérieur à 0.');
            sauv({ ...parametres, employes: (parametres.employes || []).map(emp => String(emp.id) === String(e.id) ? { ...ed, tarifJour: tarif } : emp) });
            setEditing(false);
          }} style={btnSucces}>OK</button>
          <button onClick={() => setEditing(false)} style={btnDanger}>×</button>
        </div>
      </td>
    </tr>
  );
}

export default Employes;
