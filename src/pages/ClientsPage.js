import React, { useState } from 'react';
import {
  Users, FileText, HardHat, DollarSign, Plus, Pencil, Trash2, Download,
  Upload, X, CheckCircle, AlertCircle,
} from 'lucide-react';
import { fmtN, C, calculerCA } from '../donnees';
import { exportCSV } from '../utils/exportCSV';
import { parseCSV, mapClientsFromCSV } from '../utils/importCSV';
import { DS } from '../ds';
import { Badge } from '../components/SharedBadges';
import { useApp } from '../context/AppContext';

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

function ImportCSVModal({ onClose, onImport }) {
  const [etape, setEtape] = useState('upload'); // 'upload' | 'preview' | 'done'
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [clients, setClients] = useState([]);
  const [mode, setMode] = useState('fusionner'); // 'fusionner' | 'remplacer'
  const [erreur, setErreur] = useState('');
  const fileRef = React.useRef(null);

  const handleFile = async (fichier) => {
    if (!fichier) return;
    setErreur('');
    try {
      const text = await fichier.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) { setErreur('Fichier CSV vide ou format non reconnu.'); return; }
      const mapped = mapClientsFromCSV(headers, rows);
      if (mapped.length === 0) { setErreur('Aucune ligne de données trouvée. Vérifiez que le fichier contient les colonnes Nom et/ou Entreprise.'); return; }
      setParsed({ headers, rows });
      setClients(mapped);
      setEtape('preview');
    } catch { setErreur("Erreur de lecture du fichier. Assurez-vous que c'est un fichier CSV valide."); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleConfirm = () => {
    onImport(clients, mode);
    setEtape('done');
  };

  // Modal overlay style
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const modalStyle = {
    background: 'var(--ds-card-bg)', borderRadius: 18,
    border: '1px solid var(--ds-card-border)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
    width: '100%', maxWidth: 680, maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
  };

  if (etape === 'done') {
    return (
      <div onClick={onClose} style={overlayStyle}>
        <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center' }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{clients.length} client{clients.length > 1 ? 's' : ''} importé{clients.length > 1 ? 's' : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Mode : {mode === 'fusionner' ? 'Fusion (ajout aux existants)' : 'Remplacement complet'}</div>
          <button onClick={onClose} style={DS.btnPrimary}>Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ds-card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0d3d6e18', border: '1px solid #0d3d6e30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Upload size={16} color="#0d3d6e" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              {etape === 'upload' ? 'Importer des clients depuis CSV' : `Aperçu — ${clients.length} client${clients.length > 1 ? 's' : ''} détecté${clients.length > 1 ? 's' : ''}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Format : Nom;Prénom;Entreprise;Type;Téléphone;Email;Ville;Canton</div>
          </div>
          <button onClick={onClose} style={{ ...DS.iconBtn, width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}><X size={15} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {etape === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--ds-card-border)', borderRadius: 14, padding: '40px 20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                  background: 'var(--ds-input-bg)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d3d6e'; e.currentTarget.style.background = '#0d3d6e08'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ds-card-border)'; e.currentTarget.style.background = 'var(--ds-input-bg)'; }}
              >
                <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Déposer votre fichier CSV ici</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ou cliquer pour sélectionner · .csv · séparateur ; ou ,</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
              </div>
              {erreur && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
                  <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#ef4444' }}>{erreur}</span>
                </div>
              )}
              {/* Template download */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#065f46' }}>
                <strong>Modèle CSV :</strong> Nom;Prénom;Entreprise;Type;Téléphone;Email;Adresse;Ville;Canton;Notes
                <br />Types acceptés : Entreprise · Particulier · Architecte · Bureau d'études · Promoteur
              </div>
            </div>
          )}

          {etape === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[['fusionner', 'Fusionner (ajouter aux existants)'], ['remplacer', 'Remplacer tous les clients']].map(([val, label]) => (
                  <button key={val} onClick={() => setMode(val)} style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                    background: mode === val ? (val === 'remplacer' ? '#fef2f2' : '#f0fdf4') : 'transparent',
                    color: mode === val ? (val === 'remplacer' ? '#ef4444' : '#065f46') : 'var(--text-muted)',
                    border: mode === val ? (val === 'remplacer' ? '1px solid #fecaca' : '1px solid #bbf7d0') : '1px solid var(--border)',
                  }}>{label}</button>
                ))}
              </div>
              {mode === 'remplacer' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                  <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#ef4444' }}>Mode Remplacer : tous les clients actuels seront supprimés et remplacés par ceux du fichier CSV.</span>
                </div>
              )}
              {/* Preview table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--ds-card-border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--ds-input-bg)' }}>
                      {['Nom', 'Prénom', 'Entreprise', 'Type', 'Téléphone', 'Email', 'Ville'].map(h => (
                        <th key={h} style={{ ...DS.th, fontSize: 11, padding: '8px 12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.slice(0, 8).map((c, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--ds-card-border)' }}>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.nom || '—'}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.prenom || '—'}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.entreprise || '—'}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.type}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.telephone || '—'}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.email || '—'}</td>
                        <td style={{ ...DS.td, padding: '7px 12px' }}>{c.ville || '—'}</td>
                      </tr>
                    ))}
                    {clients.length > 8 && (
                      <tr style={{ borderTop: '1px solid var(--ds-card-border)' }}>
                        <td colSpan={7} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                          … et {clients.length - 8} autre{clients.length - 8 > 1 ? 's' : ''} client{clients.length - 8 > 1 ? 's' : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={() => { setEtape('upload'); setParsed(null); setClients([]); }} style={{ ...DS.btnGhost, alignSelf: 'flex-start', fontSize: 12 }}>
                ← Choisir un autre fichier
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ds-card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={DS.btnGhost}>Annuler</button>
          {etape === 'preview' && (
            <button onClick={handleConfirm} style={mode === 'remplacer' ? DS.btnDanger : DS.btnSuccess}>
              <Upload size={14} />
              {mode === 'fusionner' ? `Importer ${clients.length} client${clients.length > 1 ? 's' : ''}` : `Remplacer par ${clients.length} client${clients.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Clients({ clients, setClients, chantiers, setChantiers, devis = [], setDevis, factures = [], setFactures, naviguer }) {
  const { confirmer, afficherNotif } = useApp();
  const [ajout, setAjout] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
  const sauvegarder = () => {
    if (!form.nom || !form.prenom) {
      if (afficherNotif) afficherNotif('Le nom et le prénom du client sont obligatoires', 'error');
      return;
    }
    const formSain = sanitiser(form);
    const isEdit = !!form.id;
    if (isEdit) setClients(clients.map(c => c.id === form.id ? formSain : c));
    else setClients([...clients, { ...formSain, id: Date.now() }]);
    setAjout(false);
    setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' });
    if (afficherNotif) afficherNotif(isEdit ? 'Client mis à jour' : 'Client créé');
  };
  const exporterCSV = () => {
    const entetes = ['Nom', 'Prénom', 'Entreprise', 'Type', 'Téléphone', 'Email', 'Ville', 'Canton', 'Nb chantiers', 'CA total (CHF)'];
    const lignes = clients.map(c => {
      const chantiersC = chantiers.filter(ch => String(ch.clientId) === String(c.id));
      const ca = chantiersC.reduce((t, ch) => t + (calculerCA(ch, devis) || 0), 0);
      return [
        c.nom || '',
        c.prenom || '',
        c.entreprise || '',
        c.type || '',
        c.telephone || '',
        c.email || '',
        c.ville || '',
        c.canton || '',
        chantiersC.length,
        Math.round(ca),
      ];
    });
    exportCSV(`clients_${new Date().toISOString().slice(0,10)}.csv`, entetes, lignes);
  };

  const handleImport = (nouveauxClients, mode) => {
    // Re-assign fresh IDs to avoid collisions
    const withIds = nouveauxClients.map(c => ({ ...c, id: Date.now() + Math.floor(Math.random() * 1000000) }));
    if (mode === 'remplacer') {
      setClients(withIds);
    } else {
      setClients(prev => [...prev, ...withIds]);
    }
    if (afficherNotif) afficherNotif(`${withIds.length} client${withIds.length > 1 ? 's' : ''} importé${withIds.length > 1 ? 's' : ''} avec succès`, 'succes');
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Clients</div>
          <div className="page-title-sub">{clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions-group">
          {clients.length > 0 && (
            <button onClick={exporterCSV} style={{ ...DS.btnGhost }}><Download size={14}/> Exporter CSV</button>
          )}
          <button onClick={() => setShowImport(true)} style={{ ...DS.btnGhost }}>
            <Upload size={14} /> Importer CSV
          </button>
          <button onClick={() => { setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); setAjout(true); }} style={btnPrimaire}><Plus size={14}/> Nouveau client</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const caTotal = clients.reduce((s, c) => { const ch = chantiers.filter(ch => String(ch.clientId) === String(c.id)); return s + ch.reduce((t, ch) => t + (calculerCA(ch, devis) || 0), 0); }, 0);
        const nbAvecChantier = clients.filter(c => chantiers.some(ch => String(ch.clientId) === String(c.id))).length;
        const nbActifs = clients.filter(c => chantiers.some(ch => String(ch.clientId) === String(c.id) && (ch.statut || '').trim().toLowerCase() === 'en cours')).length;
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
          const chantiersC = chantiers.filter(ch => String(ch.clientId) === String(c.id));
          const ca = chantiersC.reduce((t, ch) => t + (calculerCA(ch, devis) ?? 0), 0);
          const idsCh = new Set(chantiersC.map(ch => String(ch.id)));
          const facturesC = factures.filter(f => idsCh.has(String(f.chantierId)));
          const impayees = facturesC.filter(f => {
            const s = (f.statut || '').toLowerCase();
            if (!['envoyee', 'partielle', 'retard'].includes(s)) return false;
            const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null;
            return echeance ? echeance < new Date() : false;
          });
          const montantImpaye = impayees.reduce((t, f) => t + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
          return (
            <div key={c.id} className="ds-card ds-animate-in" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: '42px', height: '42px',
                  background: 'linear-gradient(135deg, rgba(13,61,110,0.35) 0%, rgba(8,45,82,0.25) 100%)',
                  border: '1px solid rgba(13,61,110,0.3)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.primaire, fontWeight: 800, fontSize: '15px',
                  boxShadow: '0 0 14px rgba(13,61,110,0.2)',
                }}>
                  {c.prenom?.charAt(0)}{c.nom?.charAt(0)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Badge texte={c.type} couleur={C.info} />
                  {impayees.length > 0 && (
                    <span style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#dc2626' }}>
                      {impayees.length} impayée{impayees.length > 1 ? 's' : ''} · CHF {fmtN(Math.round(montantImpaye))}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.prenom} {c.nom}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>{c.entreprise}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.adresse}, {c.ville}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.telephone} · {c.email}</div>
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(13,61,110,0.08)', border: '1px solid rgba(13,61,110,0.18)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
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
                <button onClick={async () => {
                  const nbCh = chantiers.filter(ch => String(ch.clientId) === String(c.id)).length;
                  const msg = `Supprimer ${c.prenom} ${c.nom} ?${nbCh > 0 ? `\n→ ${nbCh} chantier(s) et leurs factures liées seront aussi supprimés.` : ''}\n\nCette action est irréversible.`;
                  if (!await confirmer(msg, { labelOui: 'Supprimer' })) return;
                  const chantiersDuClient = chantiers.filter(ch => String(ch.clientId) === String(c.id));
                  const idsCh = new Set(chantiersDuClient.map(ch => String(ch.id)));
                  const devisDuClient = devis.filter(dv => String(dv.clientId) === String(c.id));
                  const idsFactures = new Set(factures.filter(f => idsCh.has(String(f.chantierId)) || devisDuClient.some(dv => String(dv.id) === String(f.devisId))).map(f => String(f.id)));
                  if (idsCh.size > 0) setChantiers(chantiers.filter(ch => !idsCh.has(String(ch.id))));
                  if (devisDuClient.length > 0) setDevis(devis.filter(dv => String(dv.clientId) !== String(c.id)));
                  if (idsFactures.size > 0) setFactures(factures.filter(f => !idsFactures.has(String(f.id))));
                  setClients(clients.filter(cl => String(cl.id) !== String(c.id)));
                }} style={{ ...btnDanger, padding: '6px 10px' }} title="Supprimer ce client"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onImport={(importedClients, mode) => { handleImport(importedClients, mode); setShowImport(false); }}
        />
      )}
    </div>
  );
}

export default Clients;
