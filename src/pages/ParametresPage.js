import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtN, C } from '../donnees';
import { DS } from '../ds';
import Clients from './ClientsPage';
import { EditEmployeRow } from './EmployesPage';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const thStyle = DS.th;
const tdStyle = DS.td;
const btnPrimaire = DS.btnPrimary;
const btnSucces  = DS.btnSuccess;
const btnDanger  = DS.btnDanger;

function Parametres({ parametres, setParametres, clients = [], setClients = () => {}, chantiers = [], devis = [], naviguer = () => {} }) {
  const [onglet, setOnglet] = useState('dashboard');
  const [nouvelEmploye, setNouvelEmploye] = useState({ nom: '', poste: 'Ouvrier qualifié', tarifJour: '', telephone: '', email: '' });
  const [nouvelleLocalite, setNouvelleLocalite] = useState({ nom: '', tarifJour: '' });
  const [nouveauTravail, setNouveauTravail] = useState({ nom: '', unite: 'm²', tarifBase: '' });
  const [saved, setSaved] = useState(false);
  const timerSaved = React.useRef(null);

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
          <button onClick={() => sauv({ ...parametres })} style={btnSucces}>
            Sauvegarder tout
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Sidebar nav ── */}
        <div style={{ ...DS.card, padding: 8 }}>
          {onglets.map(o => {
            const isActive = onglet === o.id;
            return (
              <div key={o.id} onClick={() => setOnglet(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? '#EEF2FF' : 'transparent',
                color: isActive ? '#4F46E5' : 'var(--text-primary)',
                transition: 'all 0.15s', marginBottom: 2,
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500 }}>{o.label}</span>
                <span style={{ fontSize: 10, color: isActive ? '#6366F1' : 'var(--text-muted)', flex: 2, display: 'none' }}>{o.desc}</span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: isActive ? '#4F46E5' : 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div>
      {onglet === 'dashboard' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres du Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '15px' }}>
            {[['Marge cible (%)', 'margeCible'], ['Seuil min. (%)', 'seuilRentabiliteMin'], ['Plafond crédibilité (%)', 'plafondCredi'], ['Frais généraux (%)', 'tauxFraisGeneraux'], ['Coeff. MO', 'coefficientMainOeuvre'], ['TVA (%)', 'tauxTVA']].map(([label, key]) => (
              <div key={key} style={{ background: 'var(--bg-glass-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '15px' }}>
                <label style={labelStyle}>{label}</label>
                <input type="number" value={parametres.parametres?.[key] || ''}
                  onChange={e => sauv({ ...parametres, parametres: { ...parametres.parametres, [key]: parseFloat(e.target.value) } })}
                  style={{ ...inputStyle, fontWeight: 'bold', fontSize: '18px', color: C.primaire, borderColor: C.primaire, borderWidth: '2px' }} />
              </div>
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
              {parametres.employes.map(e => <EditEmployeRow key={e.id} e={e} parametres={parametres} sauv={sauv} />)}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter un employé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
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
                sauv({ ...parametres, employes: [...parametres.employes, { ...nouvelEmploye, id: Date.now(), tarifJour: parseFloat(nouvelEmploye.tarifJour) }] });
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
              {parametres.localites.map(l => (
                <tr key={l.id}>
                  <td style={tdStyle}><input value={l.nom} onChange={e => { const u = parametres.localites.map(loc => loc.id === l.id ? { ...loc, nom: e.target.value } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px' }} /></td>
                  <td style={tdStyle}><input type="text" inputMode="numeric" value={l.tarifJour ? fmtN(l.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); const u = parametres.localites.map(loc => loc.id === l.id ? { ...loc, tarifJour: parseFloat(raw) || 0 } : loc); sauv({ ...parametres, localites: u }); }} style={{ ...inputStyle, padding: '5px 8px', width: 100, color: C.primaire, fontWeight: 700 }} /></td>
                  <td style={tdStyle}><button onClick={() => { if (window.confirm(`Supprimer ${l.nom} ?`)) sauv({ ...parametres, localites: parametres.localites.filter(loc => loc.id !== l.id) }); }} style={btnDanger}>Suppr</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '24px' }}>Ajouter une localité</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            <div><label style={labelStyle}>Ville</label><input placeholder="Fribourg" value={nouvelleLocalite.nom} onChange={e => setNouvelleLocalite({ ...nouvelleLocalite, nom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>CHF/jour</label><input type="text" inputMode="numeric" placeholder="45" value={nouvelleLocalite.tarifJour ? fmtN(nouvelleLocalite.tarifJour) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setNouvelleLocalite({ ...nouvelleLocalite, tarifJour: raw }); }} style={inputStyle} /></div>
            <button onClick={() => {
              if (nouvelleLocalite.nom && nouvelleLocalite.tarifJour) {
                sauv({ ...parametres, localites: [...parametres.localites, { ...nouvelleLocalite, id: Date.now(), tarifJour: parseFloat(nouvelleLocalite.tarifJour) }] });
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
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

      {onglet === 'paiements' && (
        <div style={carteStyle}>
          <div className="ds-card-title" style={{ marginBottom: '20px' }}>Paramètres Paiements</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
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
        <Clients clients={clients} setClients={setClients} chantiers={chantiers} devis={devis} naviguer={naviguer} />
      )}
        </div>{/* end content panel */}
      </div>{/* end 260/1fr grid */}
    </div>
  );
}

export default Parametres;
