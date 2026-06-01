import React, { useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { fmtN, C } from '../donnees';
import { DS } from '../ds';
import { EditEmployeRow } from './EmployesPage';

function EditClientRow({ c, clients, setClients }) {
  const [ed, setEd] = useState({ ...c });
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <tr key={c.id}>
      <td style={DS.td}><strong>{c.nom}</strong></td>
      <td style={DS.td}>{c.prenom || '—'}</td>
      <td style={DS.td}>{c.entreprise || '—'}</td>
      <td style={DS.td}>{c.telephone || '—'}</td>
      <td style={DS.td}>{c.email || '—'}</td>
      <td style={DS.td}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditing(true)} style={{ ...DS.btnGhost, padding: '4px 10px', fontSize: 12 }}><Pencil size={12} /> Modifier</button>
          <button onClick={() => { if (window.confirm(`Supprimer ${c.nom} ?`)) setClients(clients.filter(cl => cl.id !== c.id)); }} style={{ ...DS.btnDanger, padding: '4px 8px' }}>Suppr</button>
        </div>
      </td>
    </tr>
  );
  return (
    <tr key={c.id} style={{ background: 'rgba(59,130,246,0.06)' }}>
      <td style={DS.td}><input value={ed.nom || ''} onChange={ev => setEd({ ...ed, nom: ev.target.value })} style={{ ...DS.input, padding: '5px 8px' }} /></td>
      <td style={DS.td}><input value={ed.prenom || ''} onChange={ev => setEd({ ...ed, prenom: ev.target.value })} style={{ ...DS.input, padding: '5px 8px' }} /></td>
      <td style={DS.td}><input value={ed.entreprise || ''} onChange={ev => setEd({ ...ed, entreprise: ev.target.value })} style={{ ...DS.input, padding: '5px 8px' }} /></td>
      <td style={DS.td}><input value={ed.telephone || ''} onChange={ev => setEd({ ...ed, telephone: ev.target.value })} style={{ ...DS.input, padding: '5px 8px' }} /></td>
      <td style={DS.td}><input value={ed.email || ''} onChange={ev => setEd({ ...ed, email: ev.target.value })} style={{ ...DS.input, padding: '5px 8px' }} /></td>
      <td style={DS.td}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { setClients(clients.map(cl => cl.id === c.id ? ed : cl)); setEditing(false); }} style={DS.btnSuccess}>OK</button>
          <button onClick={() => setEditing(false)} style={DS.btnDanger}>×</button>
        </div>
      </td>
    </tr>
  );
}

// Sanitise une saisie de taux financier : jamais NaN, jamais négatif.
// Champ vide ou non numérique → 0 ; valeur négative → clampée à 0.
function sanitizeFinancier(raw) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  return n;
}

// Champ de taux financier (onglet Devis).
// Buffer string local → la saisie décimale ("8.1", "1.0") n'est jamais cassée.
// Le commit dans parametres passe par sanitizeFinancier → jamais NaN/négatif.
function ChampFinancier({ label, fieldKey, isTVA, value, onCommit }) {
  const [buffer, setBuffer] = React.useState(value == null ? '' : String(value));
  const handle = (raw) => {
    setBuffer(raw);
    onCommit(fieldKey, sanitizeFinancier(raw));
  };
  return (
    <div style={{ background: isTVA ? 'rgba(16,185,129,0.05)' : 'var(--bg-glass-2)', border: `1px solid ${isTVA ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: '12px', padding: '15px' }}>
      <label style={DS.label}>{label}</label>
      <input type="number"
        value={buffer}
        placeholder={isTVA ? '8.1' : ''}
        onChange={e => handle(e.target.value)}
        style={{ ...DS.input, fontWeight: 'bold', fontSize: '18px', color: isTVA ? '#10b981' : C.primaire, borderColor: isTVA ? '#10b981' : C.primaire, borderWidth: '2px' }} />
      {isTVA && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {(value == null || isNaN(value) || value === 0)
            ? <span style={{ color: '#10b981', fontWeight: 600 }}>✓ 8.1% appliqué automatiquement (taux légal CH 2024)</span>
            : <span>Taux actif : <strong style={{ color: '#10b981' }}>{value}%</strong> — TTC = HT × {Math.round((1 + value / 100) * 1000) / 1000}</span>
          }
          <br />
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Standard BTP Suisse : 8.1% · Pas de double comptage — appliqué une seule fois</span>
        </div>
      )}
    </div>
  );
}

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const thStyle = DS.th;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Parametres({ parametres, setParametres, clients = [], setClients = () => {}, chantiers = [], setChantiers = () => {}, devis = [], setDevis = () => {}, factures = [], setFactures = () => {}, pointages = [], setPointages = () => {}, naviguer = () => {} }) {
  const [onglet, setOnglet] = useState('dashboard');
  const [nouvelEmploye, setNouvelEmploye] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '' });
  const [nouveauClient, setNouveauClient] = useState({ nom: '', prenom: '', entreprise: '', telephone: '', email: '' });
  const [nouvelleLocalite, setNouvelleLocalite] = useState({ nom: '', tarifJour: '' });
  const [nouveauTravail, setNouveauTravail] = useState({ nom: '', unite: 'm²', tarifBase: '' });
  const [saved, setSaved] = useState(false);
  const timerSaved = React.useRef(null);
  const importRef = React.useRef(null);

  const exporterDonnees = () => {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob(
      [JSON.stringify({ meta: { date, version: 1, app: 'CYNA' }, chantiers, devis, factures, clients, parametres, pointages }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyna-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importerDonnees = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    e.target.value = '';
    try {
      const texte = await fichier.text();
      const data = JSON.parse(texte);
      if (!data.parametres || !Array.isArray(data.chantiers) ||
          !Array.isArray(data.devis) || !Array.isArray(data.factures) || !Array.isArray(data.clients)) {
        alert('Fichier de sauvegarde invalide — structure incorrecte (chantiers, devis, factures ou clients manquants).');
        return;
      }
      const hasPointages = Array.isArray(data.pointages);
      const ok = window.confirm(
        `Restaurer la sauvegarde du ${data.meta?.date || 'date inconnue'} ?\n\n` +
        `Cette action remplacera TOUTES les données actuelles :\n` +
        `• ${(data.chantiers || []).length} chantiers\n` +
        `• ${(data.devis || []).length} devis\n` +
        `• ${(data.factures || []).length} factures\n` +
        `• ${(data.clients || []).length} clients\n` +
        `• ${hasPointages ? data.pointages.length : 0} pointages${hasPointages ? '' : ' (backup ancien format — pointages réinitialisés)'}`
      );
      if (!ok) return;
      if (data.parametres) setParametres(data.parametres);
      if (data.clients) setClients(data.clients);
      if (data.chantiers) setChantiers(data.chantiers);
      if (data.devis) setDevis(data.devis);
      if (data.factures) setFactures(data.factures);
      setPointages(hasPointages ? data.pointages : []);
      if (!hasPointages) {
        alert('Attention : ce backup ne contient pas de pointages (version antérieure). Les heures pointées ont été réinitialisées. Vérifiez vos coûts MO avant utilisation.');
      } else {
        alert('Sauvegarde restaurée avec succès — chantiers, devis, factures, clients, paramètres et pointages.');
      }
    } catch {
      alert('Erreur lors de la lecture du fichier. Assurez-vous que c\'est un fichier backup CYNA valide.');
    }
  };

  const sauv = (data) => {
    setParametres(data);
    if (timerSaved.current) clearTimeout(timerSaved.current);
    setSaved(true);
    timerSaved.current = setTimeout(() => setSaved(false), 2500);
  };

  const onglets = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Alertes et affichage' },
    { id: 'chantiers', label: 'Chantiers', desc: 'Statuts et priorités' },
    { id: 'devis', label: 'Devis', desc: 'Marges et tarifs' },
    { id: 'employes', label: 'Employés', desc: 'Tarifs journaliers' },
    { id: 'clients_param', label: 'Clients', desc: 'Carnet d\'adresses' },
    { id: 'localites', label: 'Localités', desc: 'Frais déplacement' },
    { id: 'travaux', label: 'Travaux', desc: 'Types et tarifs' },
    { id: 'zones', label: 'Zones géo.', desc: 'Tarifs par région' },
    { id: 'societe', label: 'Société', desc: 'IBAN · N° TVA · Coordonnées' },
    { id: 'paiements', label: 'Paiements', desc: 'Délais et rappels' },
    { id: 'rapport', label: 'Rapport', desc: 'Alertes hebdo' },
    { id: 'agents', label: 'Agents IA', desc: 'Seuils des alertes' },
  ];

  const AGENT_DEFAULTS = {
    seuilMargeDanger: 0,
    seuilMargeAttention: 15,
    seuilRetardAttention: 3,
    seuilRetardCritique: 7,
    seuilBudgetAttention: 5,
    seuilBudgetDanger: 20,
  };
  const agentConf = { ...AGENT_DEFAULTS, ...(parametres.agentsConfig?.alerteChantier || {}) };
  const sauvAgentConf = (key, val) => sauv({
    ...parametres,
    agentsConfig: {
      ...(parametres.agentsConfig || {}),
      alerteChantier: { ...agentConf, [key]: parseFloat(val) || 0 },
    },
  });

  return (
    <div>
      {/* ── Toast de confirmation ── */}
      {saved && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
          border: '1px solid rgba(16,185,129,0.5)', borderRadius: 14,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(16,185,129,0.35)', backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ fontSize: 18 }}>✔</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Paramètres enregistrés</span>
        </div>
      )}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Paramètres</div>
          <div className="page-title-sub">Configuration de l'application · sauvegarde automatique</div>
        </div>
        <div className="page-actions-group">
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importerDonnees} />
          <button onClick={() => importRef.current?.click()} style={btnPrimaire} title="Restaurer depuis un fichier backup CYNA (.json)">
            Restaurer backup
          </button>
          <button onClick={exporterDonnees} style={{ ...btnSucces, background: 'linear-gradient(135deg, #0d3d6e, #1a5a9e)' }} title="Télécharger une sauvegarde complète de vos données">
            Exporter backup
          </button>
          <button onClick={() => sauv({ ...parametres })} style={btnSucces}>
            Sauvegarder tout
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-params)', gap: 20, alignItems: 'start' }}>
        {/* ── Sidebar nav ── */}
        <div style={{ ...DS.card, padding: 8 }}>
          {onglets.map(o => {
            const isActive = onglet === o.id;
            return (
              <div key={o.id} onClick={() => setOnglet(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? DS.brand.soft : 'transparent',
                color: isActive ? DS.brand.secondary : 'var(--text-primary)',
                transition: 'all 0.15s', marginBottom: 2,
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500 }}>{o.label}</span>
                <span style={{ fontSize: 10, color: isActive ? DS.brand.soft : 'var(--text-muted)', flex: 2, display: 'none' }}>{o.desc}</span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: isActive ? DS.brand.secondary : 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div>
      {onglet === 'dashboard' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Alerte jours restants', 'joursAlerte'], ['Nb chantiers affichés', 'nbChantiersAffiche'], ['Période stats (mois)', 'periodeStats']].map(([label, key]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || ''} placeholder="5"
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'chantiers' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Chantiers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Statuts disponibles</div>
              {['À chiffrer', 'Devis envoyé', 'Validé', 'En préparation', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: { 'En cours': C.warning, 'Terminé': C.secondaire, 'Planifié': C.info, 'Suspendu': C.danger, 'Facturé': C.violet }[s] || C.primaire }} />
                  <span style={{ fontSize: '14px' }}>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Priorités</div>
              {['Basse', 'Normale', 'Haute', 'Urgente'].map(p => (
                <div key={p} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-secondary)' }}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === 'devis' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres des Devis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g6)', gap: '15px' }}>
            {[['Marge cible (%)', 'margeCible'], ['Seuil min. (%)', 'seuilRentabiliteMin'], ['Plafond crédibilité (%)', 'plafondCredi'], ['Frais généraux (%)', 'tauxFraisGeneraux'], ['Coeff. MO', 'coefficientMainOeuvre'], ['TVA (%)', 'tauxTVA']].map(([label, key]) => (
              <ChampFinancier
                key={key}
                label={label}
                fieldKey={key}
                isTVA={key === 'tauxTVA'}
                value={parametres.parametres?.[key]}
                onCommit={(k, v) => sauv({ ...parametres, parametres: { ...parametres.parametres, [k]: v } })}
              />
            ))}
          </div>
        </div>
      )}

      {onglet === 'employes' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Tarifs employés</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Nom', 'Rôle', 'CHF/jour', 'Téléphone', 'Email', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(parametres.employes || []).map(e => <EditEmployeRow key={e.id} e={e} parametres={parametres} sauv={sauv} />)}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un employé</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-emp)', gap: '10px', alignItems: 'end' }}>
            {[['Nom', 'nom', 'Jean Martin'], ['CHF/jour', 'tarifJour', '350'], ['Téléphone', 'telephone', '079...'], ['Email', 'email', 'email@cyna.ch']].map(([label, key, ph]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type={key === 'tarifJour' ? 'number' : 'text'} placeholder={ph} value={nouvelEmploye[key]}
                  onChange={e => setNouvelEmploye({ ...nouvelEmploye, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <div><label style={labelStyle}>Rôle</label>
              <select value={nouvelEmploye.poste} onChange={e => setNouvelEmploye({ ...nouvelEmploye, poste: e.target.value })} style={inputStyle}>
                {["Chef de chantier", "Ouvrier qualifié", "Manœuvre", "Technicien", "Comptable", "Chef d'équipe", "Sous-traitant"].map(p => <option key={p}>{p}</option>)}
              </select></div>
            <button onClick={() => {
              if (nouvelEmploye.nom && nouvelEmploye.tarifJour) {
                sauv({ ...parametres, employes: [...(parametres.employes || []), { ...nouvelEmploye, id: Date.now(), tarifJour: parseFloat(nouvelEmploye.tarifJour) }] });
                setNouvelEmploye({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'localites' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Localités & Déplacements</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Ville', 'CHF/jour déplacement', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(parametres.localites || []).map(l => (
                <tr key={l.id}>
                  <td style={tdStyle}><input value={l.nom} onChange={e => { const u = (parametres.localites || []).map(loc => loc.id === l.id ? { ...loc, nom: e.target.value } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
                  <td style={tdStyle}><input type="text" inputMode="numeric" value={l.tarifJour ? fmtN(l.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const u = (parametres.localites || []).map(loc => loc.id === l.id ? { ...loc, tarifJour: parseFloat(raw) || 0 } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px', width: 100, color: C.primaire, fontWeight: 700 }} /></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm(`Supprimer ${l.nom} ?`)) sauv({ ...parametres, localites: (parametres.localites || []).filter(loc => loc.id !== l.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter une localité</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-2a)', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Ville</label><input placeholder="Fribourg" value={nouvelleLocalite.nom} onChange={e => setNouvelleLocalite({ ...nouvelleLocalite, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>CHF/jour</label><input type="text" inputMode="numeric" placeholder="45" value={nouvelleLocalite.tarifJour ? fmtN(nouvelleLocalite.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setNouvelleLocalite({ ...nouvelleLocalite, tarifJour: raw }); }} style={inputStyle} /></div>
            <button onClick={() => {
              if (nouvelleLocalite.nom && nouvelleLocalite.tarifJour) {
                sauv({ ...parametres, localites: [...(parametres.localites || []), { ...nouvelleLocalite, id: Date.now(), tarifJour: parseFloat(nouvelleLocalite.tarifJour) }] });
                setNouvelleLocalite({ nom: '', tarifJour: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'travaux' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Types de travaux</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Type de travaux', 'Unité', 'Tarif de base', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {parametres.typesTravaux.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}><input value={t.nom} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, nom: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '200px' }} /></td>
                  <td style={tdStyle}><select value={t.unite} onChange={e => { const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, unite: e.target.value } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '100px' }}>{['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}</select></td>
                  <td style={tdStyle}><input type="text" inputMode="numeric" value={t.tarifBase ? fmtN(t.tarifBase) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const u = parametres.typesTravaux.map(tr => tr.id === t.id ? { ...tr, tarifBase: parseFloat(raw) || 0 } : tr); sauv({ ...parametres, typesTravaux: u }); }} style={{ ...inputStyle, width: '100px' }} /></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm('Supprimer ce type de travaux ?')) sauv({ ...parametres, typesTravaux: parametres.typesTravaux.filter(tr => tr.id !== t.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-3a)', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Nom</label><input placeholder="Ex: Bardage" value={nouveauTravail.nom} onChange={e => setNouveauTravail({ ...nouveauTravail, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Unité</label>
              <select value={nouveauTravail.unite} onChange={e => setNouveauTravail({ ...nouveauTravail, unite: e.target.value })} style={inputStyle}>
                {['m²', 'ml', 'unité', 'forfait'].map(u => <option key={u}>{u}</option>)}
              </select></div>
            <div><label style={labelStyle}>Tarif base (CHF)</label><input type="text" inputMode="numeric" placeholder="100" value={nouveauTravail.tarifBase ? fmtN(nouveauTravail.tarifBase) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setNouveauTravail({ ...nouveauTravail, tarifBase: raw }); }} style={inputStyle} /></div>
            <button onClick={() => {
              if (nouveauTravail.nom) {
                sauv({ ...parametres, typesTravaux: [...parametres.typesTravaux, { ...nouveauTravail, id: Date.now(), tarifBase: parseFloat(nouveauTravail.tarifBase) || 0 }] });
                setNouveauTravail({ nom: '', unite: 'm²', tarifBase: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}

      {onglet === 'zones' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Tarifs par zone géographique</div>
          <table className="table-cards" style={{ width: '100%' }}>
            <thead><tr>
              <th style={thStyle}>Type de travaux</th>
              {parametres.zones.slice(0, 4).map(z => <th key={z.id} style={thStyle}>{z.nom}</th>)}
            </tr></thead>
            <tbody>
              {parametres.typesTravaux.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}><strong>{t.nom}</strong></td>
                  {parametres.zones.slice(0, 4).map(z => (
                    <td key={z.id} style={tdStyle}>
                      <input type="text" inputMode="numeric"
                        value={z.tarifs?.[t.nom] ? fmtN(z.tarifs[t.nom]) : ''}
                        placeholder={t.tarifBase}
                        onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const nz = parametres.zones.map(zone => zone.id === z.id ? { ...zone, tarifs: { ...zone.tarifs, [t.nom]: parseFloat(raw) } } : zone); sauv({ ...parametres, zones: nz }); }}
                        style={{ ...inputStyle, width: '80px', padding: '4px 8px' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'societe' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: 8 }}>Coordonnées légales</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Ces informations apparaissent sur toutes les factures PDF. Obligatoires pour la conformité légale suisse.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Nom de la société</label>
              <input type="text" placeholder="CYNA Sàrl"
                value={parametres.parametres?.nomSociete || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, nomSociete: e.target.value } })}
                style={inputStyle} />
            </div>
            <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 15 }}>
              <label style={{ ...labelStyle, color: '#10b981' }}>N° TVA AFC (obligatoire)</label>
              <input type="text" placeholder="CHE-123.456.789 TVA"
                value={parametres.parametres?.nTVA || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, nTVA: e.target.value } })}
                style={{ ...inputStyle, borderColor: '#10b981', fontWeight: 700 }} />
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 6 }}>Format : CHE-XXX.XXX.XXX TVA</div>
            </div>
          </div>
          <div style={{ background: 'rgba(13,61,110,0.04)', border: '2px solid rgba(13,61,110,0.3)', borderRadius: 12, padding: 18, marginBottom: 15 }}>
            <label style={{ ...labelStyle, color: '#0d3d6e', fontSize: 13 }}>IBAN (obligatoire — apparaît sur toutes les factures)</label>
            <input type="text" placeholder="CH44 3199 9123 0008 8901 2"
              value={parametres.parametres?.iban || ''}
              onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, iban: e.target.value } })}
              style={{ ...inputStyle, borderColor: '#0d3d6e', fontWeight: 700, fontSize: 16, letterSpacing: '0.05em' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Format IBAN suisse : CH + 2 chiffres contrôle + 17 chiffres (26 caractères sans espaces)
            </div>
            {parametres.parametres?.iban && !/^CH\d{2}[0-9A-Z]{17}$/.test((parametres.parametres.iban || '').replace(/\s/g, '')) && (
              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>⚠ Format IBAN invalide — vérifiez votre numéro</div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 15, marginBottom: 15 }}>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Adresse</label>
              <input type="text" placeholder="Cardinal-Journet 5"
                value={parametres.parametres?.adresseSoc || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, adresseSoc: e.target.value } })}
                style={inputStyle} />
            </div>
            <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
              <label style={labelStyle}>Code postal + Ville</label>
              <input type="text" placeholder="1217 Meyrin"
                value={parametres.parametres?.cpSoc || ''}
                onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, cpSoc: e.target.value } })}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
            {[['Téléphone 1', 'tel1Soc', '078 747 14 48'], ['Téléphone 2', 'tel2Soc', '079 480 94 41'], ['Email', 'emailSoc', 'info@cyna.ch']].map(([label, key, ph]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>{label}</label>
                <input type="text" placeholder={ph}
                  value={parametres.parametres?.[key] || ''}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: e.target.value } })}
                  style={inputStyle} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'paiements' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres Paiements</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Délai paiement (jours)', 'delaiPaiement', 30], ['Alerte retard (jours)', 'alerteRetardPaiement', 7], ['Acompte standard (%)', 'acompteStandard', 30]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'rapport' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Rapport</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px' }}>
            {[['Seuil alerte chantier (jours)', 'joursAlerte', 5], ['Marge minimale alerte (%)', 'margeMinAlerte', 15], ['Montant retard alerte (CHF)', 'montantRetardAlerte', 1000]].map(([label, key, defaut]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || defaut}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'agents' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '8px' }}>Agent Alerte Chantier — Seuils</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>
            Configure les seuils déclenchant les alertes automatiques sur les chantiers actifs.
            Les modifications sont prises en compte à la prochaine exécution de l'agent.
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de marge</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilMargeAttention}
                  onChange={e => sauvAgentConf('seuilMargeAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange si marge réelle en dessous</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil DANGER (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilMargeDanger}
                  onChange={e => sauvAgentConf('seuilMargeDanger', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge si marge réelle en dessous</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de retard</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (jours)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilRetardAttention}
                  onChange={e => sauvAgentConf('seuilRetardAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange à partir de ce nombre de jours</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil CRITIQUE (jours)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilRetardCritique}
                  onChange={e => sauvAgentConf('seuilRetardCritique', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge au-delà de ce nombre de jours</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Seuils de dépassement budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form2)', gap: 15 }}>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil ATTENTION (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilBudgetAttention}
                  onChange={e => sauvAgentConf('seuilBudgetAttention', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.warning, borderColor: C.warning, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte orange au-delà de ce % de dépassement</div>
              </div>
              <div style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 15 }}>
                <label style={labelStyle}>Seuil DANGER (%)</label>
                <input type="number" min="0" max="100" value={agentConf.seuilBudgetDanger}
                  onChange={e => sauvAgentConf('seuilBudgetDanger', e.target.value)}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: 18, color: C.danger, borderColor: C.danger, borderWidth: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Alerte rouge au-delà de ce % de dépassement</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => sauv({ ...parametres })} style={btnSucces}>Sauvegarder</button>
            <button
              onClick={() => sauv({ ...parametres, agentsConfig: { ...(parametres.agentsConfig || {}), alerteChantier: { ...AGENT_DEFAULTS } } })}
              style={btnPrimaire}
            >Réinitialiser aux valeurs par défaut</button>
          </div>
        </div>
      )}

      {onglet === 'clients_param' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Carnet d'adresses clients</div>
          <table className="table-cards" style={{ width: '100%', marginBottom: '20px' }}>
            <thead><tr>
              {['Nom', 'Prénom', 'Entreprise', 'Téléphone', 'Email', 'Action'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {clients.map(c => <EditClientRow key={c.id} c={c} clients={clients} setClients={setClients} />)}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un client</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-emp)', gap: '10px', alignItems: 'end' }}>
            {[['Nom', 'nom', 'Dupont'], ['Prénom', 'prenom', 'Marc'], ['Entreprise', 'entreprise', 'Dupont SA'], ['Téléphone', 'telephone', '022...'], ['Email', 'email', 'email@...']].map(([label, key, ph]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type="text" placeholder={ph} value={nouveauClient[key]}
                  onChange={e => setNouveauClient({ ...nouveauClient, [key]: e.target.value })} style={inputStyle} /></div>
            ))}
            <button onClick={() => {
              if (nouveauClient.nom) {
                setClients([...clients, { ...nouveauClient, id: Date.now() }]);
                setNouveauClient({ nom: '', prenom: '', entreprise: '', telephone: '', email: '' });
              }
            }} style={btnPrimaire}>+ Ajouter</button>
          </div>
        </div>
      )}
        </div>{/* end content panel */}
      </div>{/* end 260/1fr grid */}
    </div>
  );
}

export default Parametres;
