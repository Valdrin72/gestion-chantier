import React, { useState } from 'react';
import {
  Users, HardHat, TrendingUp, Plus, Pencil, Trash2,
  DollarSign, Clock,
} from 'lucide-react';
import { fmtN, C } from '../donnees';
import { DS } from '../ds';
import { Badge } from '../components/SharedBadges';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Employes({ parametres, setParametres, chantiers, naviguer }) {
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
  const sauvegarder = () => {
    if (!form.nom || !form.tarifJour) return;
    if (form.id) setParametres({ ...parametres, employes: parametres.employes.map(e => e.id === form.id ? { ...form, tarifJour: parseFloat(form.tarifJour) } : e) });
    else setParametres({ ...parametres, employes: [...parametres.employes, { ...form, id: Date.now(), tarifJour: parseFloat(form.tarifJour) }] });
    setAjout(false);
    setForm({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '', actif: true });
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
          { label: 'COÛT MENSUEL',  val: `CHF ${fmtN(coutMensuel)}`, Icon: DollarSign, ...DS.kpi.amber },
          { label: 'TARIF MOYEN',   val: `CHF ${fmtN(tarifMoyen)}/j`, Icon: TrendingUp, ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g4)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
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
            <div><label style={labelStyle}>Tarif/jour (CHF) *</label><input type="text" inputMode="numeric" placeholder="350" value={form.tarifJour ? fmtN(form.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, tarifJour: raw }); }} style={inputStyle} /></div>
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
        {parametres.employes.map(e => {
          const chantiersEmp = chantiers.filter(c => c.equipe?.some(m => parseInt(m.employeId) === e.id));
          const joursTotal = chantiers.reduce((t, c) => { const m = c.equipe?.find(m => parseInt(m.employeId) === e.id); return t + (m ? parseInt(m.joursPlannifies || 0) : 0); }, 0);
          const couleurPoste = { 'Chef de chantier': C.primaire, "Chef d'équipe": C.info, 'Ouvrier qualifié': C.secondaire, 'Manœuvre': C.orange, 'Sous-traitant': C.violet, 'Technicien': '#06b6d4', 'Comptable': '#a855f7' }[e.poste] || C.primaire;
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
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'var(--g3)', gap: '8px' }}>
                {[
                  { label: 'CHF/jour', val: `${e.tarifJour}`, couleur: C.primaire },
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
                <button onClick={() => { if (window.confirm(`Supprimer ${e.nom} ?`)) setParametres({ ...parametres, employes: parametres.employes.filter(emp => emp.id !== e.id) }); }} style={{ ...btnDanger, padding: '6px 10px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
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
          <button onClick={() => { if (window.confirm(`Supprimer ${e.nom} ?`)) sauv({ ...parametres, employes: parametres.employes.filter(emp => emp.id !== e.id) }); }} style={{ ...btnDanger, padding: '4px 8px' }}>Suppr</button>
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
          <button onClick={() => { sauv({ ...parametres, employes: parametres.employes.map(emp => emp.id === e.id ? { ...ed, tarifJour: parseFloat(ed.tarifJour) } : emp) }); setEditing(false); }} style={btnSucces}>OK</button>
          <button onClick={() => setEditing(false)} style={btnDanger}>×</button>
        </div>
      </td>
    </tr>
  );
}

export default Employes;
