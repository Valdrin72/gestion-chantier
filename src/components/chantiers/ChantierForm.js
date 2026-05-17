import React, { useState } from 'react';
import { HardHat, X, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import {
  fmtN, calculerDateFinOuvrables, heuresEmploye, C,
} from '../../donnees';
import { DS } from '../../ds';
import { useApp } from '../../context/AppContext';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const thStyle = DS.th;
const tdStyle = DS.td;
const btnSucces = DS.btnSuccess;
const btnDanger = DS.btnDanger;

function ChantierForm({ form, setForm, erreurs, setErreurs, modeCompleter, onSauvegarder, onAnnuler, naviguer }) {
  const { clients, parametres, devis = [] } = useApp();
  const [imprévu, setImprévu] = useState({ description: '', montant: '' });

  const toggleTravaux = (t) => {
    const list = form.typesTravaux || [];
    setForm({ ...form, typesTravaux: list.includes(t) ? list.filter(x => x !== t) : [...list, t] });
  };
  const ajouterImprévu = () => {
    if (imprévu.description && imprévu.montant) {
      setForm({ ...form, imprevus: [...form.imprevus, { ...imprévu }] });
      setImprévu({ description: '', montant: '' });
    }
  };
  return (
    <div style={carteStyle}>
      <div className="ds-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HardHat size={18} /> {form.id ? (modeCompleter ? 'Compléter le chantier' : 'Modifier le chantier') : 'Nouveau chantier'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: C.primaire, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 3, height: 14, background: C.primaire, borderRadius: 2 }} />
          {form.id ? 'Prévision initiale' : 'Prévision'}
        </div>
        {form.id && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Données de référence — modifiable si nécessaire
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '20px' }}>
        {[['Numéro', 'numero', 'text', 'CH-2026-001', {}], ['Nom du chantier *', 'nom', 'text', 'Ex: Bureaux Dupont', {}], ['Conducteur', 'conducteur', 'text', 'Jean Martin', {}], ['Adresse', 'adresse', 'text', 'Rue...', {}], ['Canton', 'canton', 'text', 'GE', {}], ['Date de début *', 'dateDebut', 'date', '', {}], ['Jours ouvrables prévus *', 'nombreJours', 'number', '15', { min: 1, max: 999 }], ['Surface (m²)', 'surface', 'number', '250', { min: 0 }]].map(([label, key, type, placeholder, attrs]) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input
              type={type} placeholder={placeholder} value={form[key] ?? ''}
              onChange={e => {
                let val = e.target.value;
                if (type === 'number' && attrs.min !== undefined && parseFloat(val) < attrs.min) val = String(attrs.min);
                setForm({ ...form, [key]: val });
                if (erreurs[key]) setErreurs(prev => ({ ...prev, [key]: null }));
              }}
              {...attrs}
              style={{ ...inputStyle, ...(erreurs[key] ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef444440' } : {}) }}
            />
            {erreurs[key] && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{erreurs[key]}</div>}
          </div>
        ))}
        <div><label style={labelStyle}>Client</label>
          <select value={form.clientId || ''} onChange={e => setForm({ ...form, clientId: parseInt(e.target.value) })} style={inputStyle}>
            <option value="">Sélectionner...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.entreprise}</option>)}
          </select></div>
        <div><label style={labelStyle}>Directeur de travaux</label>
          <select value={form.directeurTravauxId || ''} onChange={e => setForm({ ...form, directeurTravauxId: e.target.value })} style={inputStyle}>
            <option value="">— Sélectionner —</option>
            {parametres.employes.filter(e => e.actif !== false).map(e => <option key={e.id} value={e.id}>{e.nom} — {e.poste || 'Employé'}</option>)}
          </select></div>
        <div>
          <label style={labelStyle}>Localité <span style={{ color: C.danger }}>*</span></label>
          <select value={form.ville || ''} onChange={e => { setForm({ ...form, ville: e.target.value }); if (erreurs.ville) setErreurs(prev => ({ ...prev, ville: null })); }}
            style={{ ...inputStyle, ...(erreurs.ville ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef444440' } : {}) }}>
            <option value="">Sélectionner...</option>
            {parametres.localites.map(l => <option key={l.id} value={l.nom}>{l.nom} (CHF {l.tarifJour}.-/j)</option>)}
          </select>
          {erreurs.ville && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>La localité est obligatoire</div>}
        </div>
        <div><label style={labelStyle}>Statut</label>
          <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}>
            {['À chiffrer', 'Devis envoyé', 'Validé', 'En préparation', 'Planifié', 'En cours', 'Suspendu', 'Terminé', 'Facturé', 'Clôturé'].map(s => <option key={s}>{s}</option>)}
          </select></div>
        <div><label style={labelStyle}>Priorité</label>
          <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })} style={inputStyle}>
            {['Basse', 'Normale', 'Haute', 'Urgente'].map(s => <option key={s}>{s}</option>)}
          </select></div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={form.inclusSamedi || false} onChange={e => setForm({ ...form, inclusSamedi: e.target.checked })} />
          Inclure le samedi</label>
      </div>
      {form.dateDebut && form.nombreJours && (
        <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', padding: '14px 18px', borderRadius: '12px', marginBottom: '15px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '4px' }}>Date de fin prévue</div>
          <div style={{ fontWeight: 700, color: C.primaire, fontSize: '15px' }}>{calculerDateFinOuvrables(form.dateDebut, form.nombreJours, form.inclusSamedi)}</div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Types de travaux</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {parametres.typesTravaux.map(t => (
            <button key={t.id} onClick={() => toggleTravaux(t.nom)} style={{
              background: (form.typesTravaux || []).includes(t.nom) ? 'rgba(59,130,246,0.18)' : 'var(--bg-glass-2)',
              color: (form.typesTravaux || []).includes(t.nom) ? C.primaire : 'var(--text-secondary)',
              border: (form.typesTravaux || []).includes(t.nom) ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
              padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
              fontWeight: (form.typesTravaux || []).includes(t.nom) ? 700 : 500,
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>{t.nom}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Budget prévisionnel</div>

      {(() => {
        const devisAcceptes = devis.filter(d => d.statut?.toLowerCase() === 'accepté');
        const devisLie = devis.find(d => String(d.id) === String(form.devisId));
        const caBase = parseFloat(devisLie?.montantHT) || 0;
        const caRegie = Array.isArray(devisLie?.heuresRegie)
          ? devisLie.heuresRegie.reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0)
          : 0;
        const caTotal = caBase + caRegie;
        const hasError = erreurs.devisId || !form.devisId;
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Devis lié <span style={{ color: C.danger }}>*</span></label>
              <select
                value={form.devisId || ''}
                onChange={e => {
                  const d = devis.find(x => String(x.id) === String(e.target.value));
                  setForm({ ...form, devisId: d ? d.id : null });
                  setErreurs(prev => ({ ...prev, devisId: null }));
                }}
                style={{ ...inputStyle, borderColor: hasError ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.4)', boxShadow: hasError ? '0 0 0 1px rgba(239,68,68,0.2)' : form.devisId ? '0 0 0 1px rgba(16,185,129,0.15)' : undefined }}
              >
                <option value="">— Sélectionner un devis accepté —</option>
                {devisAcceptes.map(d => {
                  const cli = clients.find(c => String(c.id) === String(d.clientId));
                  return <option key={d.id} value={d.id}>{d.numero} · {cli?.nom || 'Client inconnu'} · CHF {fmtN(parseFloat(d.montantHT) || 0)}</option>;
                })}
              </select>
              {erreurs.devisId
                ? <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{erreurs.devisId}</div>
                : !form.devisId && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4, fontWeight: 600 }}>Un devis signé est obligatoire pour créer un chantier</div>
              }
              {devisAcceptes.length === 0 && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: C.warning, fontWeight: 600 }}>
                  Aucun devis accepté disponible — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => naviguer('devis')}>Créer un devis →</span>
                </div>
              )}
            </div>

            {devisLie ? (
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'grid', gridTemplateColumns: caRegie > 0 ? 'var(--g3)' : 'var(--g-form2)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>CA devis</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(caBase)}</div>
                </div>
                {caRegie > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>Régie</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>+CHF {fmtN(Math.round(caRegie))}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>CA total</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(caTotal)}</div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Aucun devis lié</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Le CA sera indisponible tant qu'aucun devis accepté n'est sélectionné.</div>
                </div>
              </div>
            )}
          </>
        );
      })()}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '20px' }}>
        {[['Matériel prévu (CHF)', 'coutMaterielPrevu'], ['Sous-traitance prévue (CHF)', 'coutSousTraitancePrevu'], ['Autres coûts prévus (CHF)', 'autresCoutsPrevu']].map(([label, key]) => (
          <div key={key}><label style={labelStyle}>{label}</label>
            <input type="text" inputMode="numeric" placeholder="0"
              value={form[key] ? fmtN(form[key]) : ''}
              onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, [key]: raw }); }}
              style={inputStyle} /></div>
        ))}
      </div>
      {form.id && (
        <>
          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 20px' }} />
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: C.warning, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 3, height: 14, background: C.warning, borderRadius: 2 }} />
            Suivi terrain
          </div>

          {(() => {
            const joursR = (form.equipe || []).reduce((s, m) =>
              s + heuresEmploye(form.journal || [], parseInt(m.employeId)) / 8
            , 0);
            const joursP = (form.equipe || []).reduce((s, m) => s + (parseFloat(m.joursPlannifies) || 0), 0);
            const av = joursP > 0 ? Math.min(100, Math.round((joursR / joursP) * 100)) : 0;
            const ratioTemps = joursP > 0 ? joursR / joursP : 0;
            const alerteTemps = ratioTemps > 1.4 ? 'rouge' : ratioTemps > 1.2 ? 'orange' : null;
            const couleurAv = alerteTemps === 'rouge' ? C.danger : alerteTemps === 'orange' ? C.warning : C.secondaire;
            return (
              <div style={{ background: couleurAv + '10', border: `1px solid ${couleurAv}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Avancement&nbsp;
                      <strong style={{ color: couleurAv, fontSize: 16 }}>{av}%</strong>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      — {Math.round(joursR * 10) / 10}j réalisés / {joursP}j prévus
                    </span>
                  </span>
                  {alerteTemps && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: couleurAv, background: couleurAv + '18', border: `1px solid ${couleurAv}40`, padding: '3px 10px', borderRadius: 20 }}>
                      {alerteTemps === 'rouge' ? 'Dépassement temps critique' : 'Dépassement temps élevé'}
                      &nbsp;({Math.round(ratioTemps * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '12px' }}>Coûts réels</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-form3)', gap: '15px', marginBottom: '20px' }}>
            {[['Matériel réel (CHF)', 'materielReel'], ['Sous-traitance réelle (CHF)', 'sousTraitanceReelle'], ['Autres coûts réels (CHF)', 'autresCoutsReels']].map(([label, key]) => (
              <div key={key}><label style={labelStyle}>{label}</label>
                <input type="text" inputMode="numeric" placeholder="0"
                  value={form[key] ? fmtN(form[key]) : ''}
                  onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, [key]: raw }); }}
                  style={inputStyle} /></div>
            ))}
          </div>

          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.danger, marginBottom: '12px' }}>Coûts imprévus</div>
          {form.imprevus.length > 0 && (
            <table className="table-cards" style={{ width: '100%', marginBottom: '10px' }}>
              <thead><tr>{['Description', 'Montant (CHF)', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {form.imprevus.map((imp, i) => (
                  <tr key={`imp-${imp.description}-${imp.montant}-${i}`}>
                    <td style={tdStyle}>{imp.description}</td>
                    <td style={tdStyle}>CHF {fmtN(imp.montant)}</td>
                    <td style={tdStyle}><button onClick={() => setForm({ ...form, imprevus: form.imprevus.filter((_, idx) => idx !== i) })} style={btnDanger}><Trash2 size={13} /> Supprimer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--g-2a)', gap: '10px', alignItems: 'end', marginBottom: '20px' }}>
            <div><label style={labelStyle}>Description</label>
              <input placeholder="Ex: Vitrage supplémentaire" value={imprévu.description} onChange={e => setImprévu({ ...imprévu, description: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Montant (CHF)</label>
              <input type="text" inputMode="numeric" placeholder="1'500" value={imprévu.montant ? fmtN(imprévu.montant) : ''} onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setImprévu({ ...imprévu, montant: raw }); }} style={inputStyle} /></div>
            <button onClick={ajouterImprévu} style={{ ...btnDanger, padding: '10px 15px' }}>+ Ajouter</button>
          </div>

          {(form.journal || []).length > 0 && (() => {
            const parDate = {};
            for (const entry of form.journal || []) {
              if (!parDate[entry.date]) parDate[entry.date] = { heuresParEmp: {}, totalH: 0 };
              for (const e of (entry.employes || [])) {
                const eid = parseInt(e.employeId); const h = parseFloat(e.heuresTravaillees) || 0;
                parDate[entry.date].heuresParEmp[eid] = (parDate[entry.date].heuresParEmp[eid] || 0) + h;
                parDate[entry.date].totalH += h;
              }
            }
            const jours = Object.entries(parDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 10);
            const empsList = parametres.employes || [];
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>Journal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {jours.map(([date, info]) => {
                    const d = new Date(date);
                    const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    const noms = Object.entries(info.heuresParEmp)
                      .filter(([, h]) => h > 0)
                      .map(([eid, h]) => {
                        const emp = empsList.find(e => e.id === parseInt(eid));
                        return `${emp?.nom || '?'} (${h}h)`;
                      }).join(', ');
                    const nbPresents = Object.values(info.heuresParEmp).filter(h => h > 0).length;
                    return (
                      <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'var(--bg-glass)', borderRadius: 8, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{label}</span>
                        <span style={{ color: C.secondaire, fontWeight: 600 }}>{nbPresents} empl. · {info.totalH}h</span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noms}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Notes terrain</label>
            <textarea placeholder="Observations, problèmes rencontrés..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '70px', resize: 'vertical' }} />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onSauvegarder} style={btnSucces}>{form.id ? <><Pencil size={15}/> Enregistrer le suivi</> : <><Plus size={15}/> Créer le chantier</>}</button>
        <button onClick={onAnnuler} style={btnDanger}><X size={14}/> Annuler</button>
      </div>
    </div>
  );
}

export default ChantierForm;
