import React, { useState } from 'react';
import {
  Users, FileText, HardHat, DollarSign, Plus, Pencil, Trash2,
} from 'lucide-react';
import { fmtN, C, calculerCA } from '../donnees';
import { DS } from '../ds';
import { Badge } from '../components/SharedBadges';

// Supprime les balises HTML des champs texte avant sauvegarde (protection XSS dans PDF)
const sanitiser = (obj) => {
  const nettoyer = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').substring(0, 2000) : v;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nettoyer(v)]));
};

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const btnPrimaire = DS.btnPrimary;
const btnSucces = DS.btnSuccess;
const btnDanger = DS.btnDanger;

function Clients({ clients, setClients, chantiers, setChantiers, devis = [], setDevis, factures = [], setFactures, naviguer }) {
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
  const sauvegarder = () => {
    if (!form.nom || !form.prenom) return;
    const formSain = sanitiser(form);
    if (form.id) setClients(clients.map(c => c.id === form.id ? formSain : c));
    else setClients([...clients, { ...formSain, id: Date.now() }]);
    setAjout(false);
    setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
  };
  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Clients</div>
          <div className="page-title-sub">{clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => { setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); setAjout(true); }} style={btnPrimaire}><Plus size={14}/> Nouveau client</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const caTotal = clients.reduce((s, c) => { const ch = chantiers.filter(ch => ch.clientId === c.id); return s + ch.reduce((t, ch) => t + (calculerCA(ch, devis) || 0), 0); }, 0);
        const nbAvecChantier = clients.filter(c => chantiers.some(ch => ch.clientId === c.id)).length;
        const nbActifs = clients.filter(c => chantiers.some(ch => ch.clientId === c.id && ch.statut === 'En cours')).length;
        const entreprises = clients.filter(c => c.type === 'Entreprise').length;
        const kpiItems = [
          { label: 'TOTAL CLIENTS',    val: clients.length,      Icon: Users,      ...DS.kpi.blue,   badge: `${nbActifs} actifs` },
          { label: 'CA TOTAL',         val: `CHF ${fmtN(caTotal)}`, Icon: DollarSign, ...DS.kpi.green },
          { label: 'AVEC CHANTIER',    val: nbAvecChantier,       Icon: HardHat,    ...DS.kpi.amber },
          { label: 'ENTREPRISES',       val: entreprises,           Icon: FileText,   ...DS.kpi.purple },
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
          <div className="ds-card-title">{form.id ? 'Modifier' : 'Nouveau'} client</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '15px' }}>
            {[['Prénom *', 'prenom', 'Marc'], ['Nom *', 'nom', 'Dupont'], ['Entreprise', 'entreprise', 'Dupont SA'], ['Téléphone', 'telephone', '022 000 00 00'], ['Email', 'email', 'email@example.ch'], ['Adresse', 'adresse', 'Rue...'], ['Ville', 'ville', 'Genève'], ['Canton', 'canton', 'GE']].map(([label, key, ph]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input placeholder={ph} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                {['Entreprise', 'Particulier', 'Architecte', "Bureau d'études", 'Promoteur'].map(t => <option key={t}>{t}</option>)}
              </select></div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea placeholder="Informations complémentaires, préférences, historique..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>{form.id ? 'Enregistrer les modifications' : 'Créer le client'}</button>
            <button onClick={() => { setAjout(false); setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); }} style={btnDanger}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g3)', gap: '15px' }}>
        {clients.map(c => {
          const chantiersC = chantiers.filter(ch => ch.clientId === c.id);
          const ca = chantiersC.reduce((t, ch) => t + (calculerCA(ch, devis) ?? 0), 0);
          return (
            <div key={c.id} className="ds-card ds-animate-in" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '42px', height: '42px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.25) 100%)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.primaire, fontWeight: 800, fontSize: '15px',
                  boxShadow: '0 0 14px rgba(59,130,246,0.2)',
                }}>
                  {c.prenom?.charAt(0)}{c.nom?.charAt(0)}
                </div>
                <Badge texte={c.type} couleur={C.info} />
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.prenom} {c.nom}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>{c.entreprise}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.adresse}, {c.ville}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.telephone} · {c.email}</div>
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>Chantiers</div>
                  <div style={{ fontWeight: 800, color: C.primaire, fontSize: '20px' }}>{chantiersC.length}</div>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>CA Total</div>
                  <div style={{ fontWeight: 800, color: C.secondaire, fontSize: '14px' }}>CHF {fmtN(ca)}</div>
                </div>
              </div>
              {c.notes && (
                <div style={{ marginTop: '10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {c.notes}
                </div>
              )}
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => naviguer('chantiers', { clientActif: c.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <HardHat size={13} /> Chantiers ({chantiersC.length})
                </button>
                <button onClick={() => naviguer('devis', { clientActif: c.id })} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <FileText size={13} /> Devis
                </button>
                <button onClick={() => { setForm(c); setAjout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...DS.btnGhost, fontSize: '12px', padding: '6px 11px' }}>
                  <Pencil size={13} /> Modifier
                </button>
                <button onClick={() => {
                  if (!window.confirm(`Supprimer ${c.prenom} ${c.nom} ?\nLes chantiers, devis et factures liés seront aussi supprimés.`)) return;
                  const chantiersDuClient = chantiers.filter(ch => String(ch.clientId) === String(c.id));
                  const idsCh = new Set(chantiersDuClient.map(ch => ch.id));
                  const devisDuClient = devis.filter(dv => String(dv.clientId) === String(c.id));
                  const idsFactures = new Set(factures.filter(f => idsCh.has(f.chantierId) || devisDuClient.some(dv => String(dv.id) === String(f.devisId))).map(f => f.id));
                  if (idsCh.size > 0) setChantiers(chantiers.filter(ch => !idsCh.has(ch.id)));
                  if (devisDuClient.length > 0) setDevis(devis.filter(dv => String(dv.clientId) !== String(c.id)));
                  if (idsFactures.size > 0) setFactures(factures.filter(f => !idsFactures.has(f.id)));
                  setClients(clients.filter(cl => cl.id !== c.id));
                }} style={{ ...btnDanger, padding: '6px 10px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Clients;
