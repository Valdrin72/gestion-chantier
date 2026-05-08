import React, { useState } from 'react';
import {
  Plus, Pencil, Trash2, HardHat, Receipt,
  DollarSign, Clock, FileText, TrendingUp,
} from 'lucide-react';
import { fmtN, C, creerFactureDepuisDevis } from '../donnees';
import { DS } from '../ds';
import { useApp } from '../context/AppContext';

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const btnPrimaire = DS.btnPrimary;
const btnSucces = DS.btnSuccess;
const btnDanger = DS.btnDanger;

function Devis() {
  const { devis, setDevis, clients, parametres, naviguer, setChantiers, chantiers, factures, setFactures, contexte = {} } = useApp();
  const [ajout, setAjout] = useState(false);
  const [filtreDevis, setFiltreDevis] = useState('Tous');
  const [confirmConversion, setConfirmConversion] = useState(null); // { devis, nomChantier }
  const vide = {
    numero: `DEV-${new Date().getFullYear()}-${String(Math.max(0, ...devis.map(d => parseInt((d.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`,
    clientId: '', date: new Date().toISOString().split('T')[0], statut: 'brouillon',
    montantHT: '', dureeEstimee: '', nombrePersonnes: '', avenants: [], heuresRegie: [], notes: '',
  };
  const [form, setForm] = useState(vide);

  // Ouverture directe du formulaire depuis la sidebar
  React.useEffect(() => {
    if (contexte?.ouvrirNouveau) { setForm(vide); setAjout(true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Préremplissage depuis Import PDF
  React.useEffect(() => {
    if (!contexte?.prixPropose && !contexte?.lignes?.length) return;
    const lignesTexte = (contexte.lignes || []).length > 0
      ? '\n\nPostes détectés (PDF' + (contexte.source ? ' : ' + contexte.source : '') + ') :\n'
        + contexte.lignes.map(l => `• ${l.description}${l.prix > 0 ? ' — CHF ' + fmtN(l.prix) : ''}`).join('\n')
      : (contexte.source ? `\nSource : ${contexte.source}` : '');
    setForm(f => ({ ...f, montantHT: contexte.prixPropose || f.montantHT, notes: lignesTexte.trim() }));
    setAjout(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDateCH = (s) => { if (!s) return '—'; const [y, m, d] = (s || '').split('-'); return (d && m && y) ? `${d}.${m}.${y}` : s; };

  const sauvegarder = () => {
    if (!form.clientId) return;
    if (form.id) {
      setDevis(devis.map(d => d.id === form.id ? form : d));
      // Sync CA sur les chantiers liés si montantHT a changé
      if (form.montantHT) {
        setChantiers(chantiers.map(ch =>
          String(ch.devisId) === String(form.id) ? { ...ch, montantDevis: parseFloat(form.montantHT) || ch.montantDevis } : ch
        ));
      }
    } else {
      setDevis([...devis, { ...form, id: Date.now() }]);
    }
    setAjout(false); setForm(vide);
  };

  const ouvrirConfirmConversion = (d) => {
    const client = clients.find(c => c.id === d.clientId);
    const nomSuggere = client?.entreprise
      ? `${client.entreprise} — ${d.numero}`
      : `Chantier ${d.numero}`;
    setConfirmConversion({ devis: d, nomChantier: nomSuggere });
  };

  const confirmerConversion = () => {
    if (!confirmConversion) return;
    const { devis: d, nomChantier } = confirmConversion;
    const newId = Date.now();
    setChantiers(prev => [...prev, {
      id: newId,
      devisId: d.id,
      nom: nomChantier.trim() || `Chantier ${d.numero}`,
      numero: `CH-${new Date().getFullYear()}-${String(Math.max(0, ...prev.map(c => parseInt((c.numero || '').split('-').pop()) || 0)) + 1).padStart(3, '0')}`,
      clientId: d.clientId,
      montantDevis: parseFloat(d.montantHT || d.prixPropose) || 0,
      surface: 0,
      statut: 'Planifié', priorite: 'Normale', avancement: 0,
      dateDebut: '', nombreJours: d.dureeEstimee || '', nombrePersonnes: d.nombrePersonnes || '',
      inclusSamedi: false, avenants: [], montantFacture: 0,
      typesTravaux: [], ville: '', canton: '', adresse: '',
      conducteur: '', directeurTravauxId: '', equipe: [], employes: [],
      coutMaterielPrevu: '', materielReel: '',
      coutSousTraitancePrevu: '', sousTraitanceReelle: '',
      autresCoutsPrevu: '', autresCoutsReels: '', imprevus: [],
      notes: `Créé depuis devis ${d.numero}`,
      journal: [],
    }]);
    setConfirmConversion(null);
    naviguer('chantiers', { chantierActif: newId, modeCompleter: true });
  };

  const STATUTS_COULEUR = {
    'brouillon': '#64748b', 'envoyé': C.info, 'accepté': C.secondaire, 'refusé': C.danger,
    'En cours': C.info, 'Validé': C.secondaire, 'Envoyé': C.info, 'Refusé': C.danger, 'Annulé': '#64748b', 'Signé': C.secondaire,
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Devis</div>
          <div className="page-title-sub">{devis.length} devis · {devis.filter(d => d.statut === 'accepté').length} acceptés ce mois</div>
        </div>
        <div className="page-actions-group">
          <button onClick={() => { setForm(vide); setAjout(!ajout); }} style={btnPrimaire}><Plus size={14} /> Nouveau devis</button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {(() => {
        const devisAcceptes = devis.filter(d => d.statut === 'accepté');
        const caSigné = devisAcceptes.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);
        const tauxAcceptation = devis.length > 0 ? Math.round((devisAcceptes.length / devis.length) * 100) : 0;
        const enAttente = devis.filter(d => d.statut === 'envoyé');
        const montantAttente = enAttente.reduce((s, d) => s + (parseFloat(d.montantHT || d.prixPropose) || 0), 0);
        const now = Date.now();
        const delaisMoyen = enAttente.length > 0
          ? Math.round(enAttente.reduce((s, d) => { const dt = d.dateEmission || d.date || 0; return s + Math.floor((now - new Date(dt)) / 86400000); }, 0) / enAttente.length)
          : null;
        const kpiItems = [
          { label: 'CA SIGNÉ',            val: `CHF ${fmtN(caSigné)}`, sous: `${devisAcceptes.length} devis accepté${devisAcceptes.length !== 1 ? 's' : ''}`, Icon: DollarSign, ...DS.kpi.green },
          { label: "TAUX D'ACCEPTATION",  val: `${tauxAcceptation}%`, sous: `sur ${devis.length} devis total`, Icon: TrendingUp, ...DS.kpi.blue },
          { label: 'EN ATTENTE RÉPONSE',  val: enAttente.length, sous: montantAttente > 0 ? `CHF ${fmtN(montantAttente)} en jeu` : 'Aucun en cours', Icon: Clock, ...DS.kpi.amber },
          { label: 'DÉLAI MOYEN',         val: delaisMoyen !== null ? `${delaisMoyen}j` : '—', sous: 'depuis envoi', Icon: FileText, ...DS.kpi.purple },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {kpiItems.map(k => (
              <div key={k.label} style={{ background: k.gradient, borderRadius: 16, padding: '22px 20px', minHeight: 120, boxShadow: `0 4px 20px ${k.glow}, 0 1px 4px rgba(0,0,0,0.12)`, border: '1px solid rgba(255,255,255,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
                  <k.Icon size={17} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1, position: 'relative' }}>{k.val}</div>
                {k.sous && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', marginTop: 5, position: 'relative' }}>{k.sous}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Filter pills ── */}
      {(() => {
        const STATUTS_DEVIS = ['Tous', 'brouillon', 'envoyé', 'accepté', 'refusé'];
        return (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {STATUTS_DEVIS.map(s => (
              <button key={s} onClick={() => setFiltreDevis(s)} style={{
                background: filtreDevis === s ? '#EEF2FF' : 'transparent',
                color: filtreDevis === s ? '#4F46E5' : 'var(--text-muted)',
                border: '1px solid transparent',
                padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
                fontWeight: filtreDevis === s ? 600 : 400, fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}>{s}</button>
            ))}
          </div>
        );
      })()}

      {ajout && (
        <div style={carteStyle}>
          <div style={{ marginBottom: 20 }}>
            <div className="ds-card-title" style={{ margin: 0 }}>{form.id ? 'Modifier' : 'Nouveau'} devis</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '14px', marginBottom: 20 }}>
            <div><label style={labelStyle}>Numéro</label><input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Client</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: parseInt(e.target.value) })} style={inputStyle}>
                <option value="">Sélectionner...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.entreprise}</option>)}
              </select></div>
            <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Statut</label>
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}>
                {['brouillon', 'envoyé', 'accepté', 'refusé'].map(s => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981', marginBottom: 12 }}>Montant signé HT</div>
            <input
              type="text" inputMode="numeric"
              placeholder="Ex : 45'000"
              value={form.montantHT ? fmtN(form.montantHT) : ''}
              onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, montantHT: raw }); }}
              style={{ ...inputStyle, fontSize: '22px', fontWeight: 800, borderColor: '#10b98160', letterSpacing: '-0.5px' }}
            />
            {form.montantHT && parseFloat(form.montantHT) > 0 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>CA enregistré :</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>CHF {fmtN(parseFloat(form.montantHT))}</span>
                <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.14)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>HT</span>
              </div>
            )}
          </div>
          {/* ── Durée estimée + Personnes prévues ── */}
          <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6', marginBottom: 6 }}>Durée estimée (jours ouvrables)</div>
                <input
                  type="number" min="1" step="1"
                  placeholder="Ex : 15"
                  value={form.dureeEstimee}
                  onChange={e => setForm({ ...form, dureeEstimee: e.target.value })}
                  style={{ ...inputStyle, width: 120, fontSize: 18, fontWeight: 700, borderColor: '#3b82f660' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b', marginBottom: 6 }}>Personnes prévues</div>
                <input
                  type="number" min="1" step="1"
                  placeholder="Ex : 3"
                  value={form.nombrePersonnes || ''}
                  onChange={e => setForm({ ...form, nombrePersonnes: e.target.value })}
                  style={{ ...inputStyle, width: 100, fontSize: 18, fontWeight: 700, borderColor: '#f59e0b60' }}
                />
              </div>
              {form.dureeEstimee && parseInt(form.dureeEstimee) > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 6 }}>
                  ≈ <strong style={{ color: '#3b82f6' }}>{Math.ceil(parseInt(form.dureeEstimee) / 5)} semaine{Math.ceil(parseInt(form.dureeEstimee) / 5) > 1 ? 's' : ''}</strong> de travail
                  {parseInt(form.nombrePersonnes) > 0 && (
                    <span style={{ marginLeft: 12, color: '#f59e0b', fontWeight: 700 }}>
                      · {parseInt(form.dureeEstimee) * parseInt(form.nombrePersonnes)} jours-homme
                      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                        ({form.dureeEstimee}j × {form.nombrePersonnes} pers.)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Avenants ── */}
          <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b5cf6' }}>📋 Avenants (travaux supplémentaires)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Travaux additionnels négociés — s'ajoutent au CA du devis</div>
              </div>
              <button
                onClick={() => setForm({ ...form, avenants: [...(form.avenants || []), { id: Date.now(), description: '', montant: '' }] })}
                style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}
              >+ Ajouter un avenant</button>
            </div>
            {(form.avenants || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun avenant — cliquez sur "Ajouter un avenant" si des travaux supplémentaires ont été négociés.</div>
            )}
            {(form.avenants || []).map((a, i) => (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  placeholder="Description (ex: Extension terrasse sud)"
                  value={a.description}
                  onChange={e => { const l = [...form.avenants]; l[i] = { ...a, description: e.target.value }; setForm({ ...form, avenants: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="Montant CHF HT"
                  value={a.montant}
                  onChange={e => { const l = [...form.avenants]; l[i] = { ...a, montant: e.target.value }; setForm({ ...form, avenants: l }); }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setForm({ ...form, avenants: form.avenants.filter((_, j) => j !== i) })}
                  style={{ ...DS.btnDanger, padding: '6px 10px', fontSize: 12 }}
                >×</button>
              </div>
            ))}
            {(form.avenants || []).length > 0 && (() => {
              const totalAvenants = (form.avenants || []).reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);
              const totalCA = (parseFloat(form.montantHT) || 0) + totalAvenants;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(139,92,246,0.2)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total avenants : </span><span style={{ fontWeight: 700, color: '#8b5cf6' }}>CHF {fmtN(Math.round(totalAvenants))}</span></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CA total (devis + avenants) : </span><span style={{ fontWeight: 800, color: '#10b981' }}>CHF {fmtN(Math.round(totalCA))}</span></div>
                </div>
              );
            })()}
          </div>

          {/* ── Heures en régie ── */}
          <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>⏱ Heures en régie (CA supplémentaire)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Heures facturées au temps passé — s'ajoutent au CA du devis</div>
              </div>
              <button
                onClick={() => setForm({ ...form, heuresRegie: [...(form.heuresRegie || []), { id: Date.now(), description: '', heures: '', tarifHeure: '' }] })}
                style={{ ...DS.btnGhost, fontSize: 12, padding: '5px 12px' }}
              >+ Ajouter une ligne</button>
            </div>
            {(form.heuresRegie || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune heure en régie — cliquez sur "Ajouter une ligne" pour en saisir.</div>
            )}
            {(form.heuresRegie || []).map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  placeholder="Description (ex: Travaux imprévus toiture)"
                  value={r.description}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, description: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="Heures"
                  value={r.heures}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, heures: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <input
                  type="number" min="0" placeholder="CHF/h"
                  value={r.tarifHeure}
                  onChange={e => { const l = [...form.heuresRegie]; l[i] = { ...r, tarifHeure: e.target.value }; setForm({ ...form, heuresRegie: l }); }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setForm({ ...form, heuresRegie: form.heuresRegie.filter((_, j) => j !== i) })}
                  style={{ ...DS.btnDanger, padding: '6px 10px', fontSize: 12 }}
                >×</button>
              </div>
            ))}
            {(form.heuresRegie || []).length > 0 && (() => {
              const totalRegie = (form.heuresRegie || []).reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0);
              const totalCA = (parseFloat(form.montantHT) || 0) + totalRegie;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Régie total : </span><span style={{ fontWeight: 700, color: '#f59e0b' }}>CHF {fmtN(Math.round(totalRegie))}</span></div>
                  <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CA total (devis + régie) : </span><span style={{ fontWeight: 800, color: '#10b981' }}>CHF {fmtN(Math.round(totalCA))}</span></div>
                </div>
              );
            })()}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea placeholder="Observations, conditions particulières..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: '70px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={sauvegarder} style={btnSucces}>Sauvegarder</button>
            <button onClick={() => { setAjout(false); setForm(vide); }} style={btnDanger}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── Liste des devis ── */}
      {(() => {
        const devisFiltres = filtreDevis === 'Tous' ? devis : devis.filter(d => d.statut === filtreDevis);
        return (
      <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
        {devisFiltres.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucun devis à afficher
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Référence', 'Date', 'Client', 'Chantier lié', 'CA HT', 'Statut', 'Actions'].map(col => (
                    <th key={col} style={DS.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devisFiltres.map(d => {
                  const client = clients.find(c => c.id === d.clientId);
                  const montant = parseFloat(d.montantHT || d.prixPropose) || 0;
                  const totalRegie = Array.isArray(d.heuresRegie)
                    ? d.heuresRegie.reduce((s, r) => s + (parseFloat(r.heures) || 0) * (parseFloat(r.tarifHeure) || 0), 0)
                    : 0;
                  const totalAvenants = Array.isArray(d.avenants)
                    ? d.avenants.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)
                    : 0;
                  const chantierLie = chantiers.find(ch => String(ch.devisId) === String(d.id));
                  const isAccepte = d.statut === 'accepté';
                  const statutStyle = DS.statuts[d.statut] || { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr
                      key={d.id}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={DS.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>{d.numero}</span>
                      </td>
                      <td style={DS.td}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateCH(d.date)}</span>
                      </td>
                      <td style={{ ...DS.td, maxWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client?.entreprise || 'Client inconnu'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{client?.prenom} {client?.nom}</div>
                      </td>
                      <td style={DS.td}>
                        {chantierLie ? (
                          <span
                            onClick={() => naviguer('chantiers', { chantierActif: chantierLie.id })}
                            style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', display: 'inline-block' }}
                          >{chantierLie.numero} →</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={DS.td}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isAccepte ? '#10b981' : 'var(--text-primary)' }}>
                          CHF {fmtN(montant + totalRegie + totalAvenants)}
                        </span>
                        {totalAvenants > 0 && (
                          <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 1 }}>dont CHF {fmtN(Math.round(totalAvenants))} avenants</div>
                        )}
                        {totalRegie > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>dont CHF {fmtN(Math.round(totalRegie))} régie</div>
                        )}
                      </td>
                      <td style={DS.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: statutStyle.color, background: statutStyle.bg,
                          borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
                        }}>{d.statut}</span>
                      </td>
                      <td style={{ ...DS.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {!chantierLie && isAccepte && (
                            <button onClick={() => ouvrirConfirmConversion(d)} style={{ ...DS.btnSuccess, padding: '6px 12px', fontSize: 12, gap: 5 }}>
                              <HardHat size={13} /> Créer le chantier
                            </button>
                          )}
                          {isAccepte && (() => {
                            const factureExistante = factures.some(f => String(f.devisId) === String(d.id) && f.statut !== 'annulee');
                            if (factureExistante) return null;
                            return (
                              <button
                                onClick={() => {
                                  const nouvelleFacture = creerFactureDepuisDevis(d, chantierLie || null, factures);
                                  setFactures([...factures, nouvelleFacture]);
                                  naviguer('finances');
                                }}
                                style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', transition: 'all 0.15s' }}
                                title="Créer la facture depuis ce devis"
                              >
                                <Receipt size={13} /> Créer la facture
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => { setForm({ ...d, montantHT: d.montantHT || d.prixPropose || '' }); setAjout(true); }}
                            style={DS.iconBtn}
                            title="Modifier"
                          ><Pencil size={14} /></button>
                          <button
                            onClick={() => {
                              const chantiersLies = chantiers.filter(ch => String(ch.devisId) === String(d.id));
                              const facturesLiees = factures.filter(f => chantiersLies.some(ch => String(ch.id) === String(f.chantierId)) || String(f.devisId) === String(d.id));
                              const lignes = [`Supprimer le devis "${d.numero}" ?`];
                              if (chantiersLies.length > 0) lignes.push(`→ ${chantiersLies.length} chantier(s) lié(s) seront aussi supprimé(s)`);
                              if (facturesLiees.length > 0) lignes.push(`→ ${facturesLiees.length} facture(s) liée(s) seront aussi supprimée(s)`);
                              lignes.push('Cette action est irréversible.');
                              if (!window.confirm(lignes.join('\n'))) return;
                              const idsChantiers = new Set(chantiersLies.map(ch => ch.id));
                              setDevis(devis.filter(dv => dv.id !== d.id));
                              if (idsChantiers.size > 0) setChantiers(chantiers.filter(ch => !idsChantiers.has(ch.id)));
                              if (facturesLiees.length > 0) {
                                const idsFactures = new Set(facturesLiees.map(f => f.id));
                                setFactures(factures.filter(f => !idsFactures.has(f.id)));
                              }
                            }}
                            style={{ ...DS.iconBtn, color: '#EF4444' }}
                            title="Supprimer"
                          ><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        );
      })()}

      {/* ── Modale confirmation conversion devis → chantier ── */}
      {confirmConversion && (() => {
        const d = confirmConversion.devis;
        const client = clients.find(c => c.id === d.clientId);
        const montant = parseFloat(d.montantHT || d.prixPropose) || 0;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmConversion(null)}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ds-card-border)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#065F46,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardHat size={20} strokeWidth={2} style={{ color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Créer le chantier</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Depuis le devis {d.numero}</div>
                </div>
              </div>

              {/* Récap devis */}
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--ds-card-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Client</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{client?.entreprise || client?.nom || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Montant HT</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>CHF {fmtN(montant)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>Durée estimée</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: d.dureeEstimee ? '#3b82f6' : 'var(--text-muted)' }}>
                    {d.dureeEstimee ? `${d.dureeEstimee}j ouvrables` : 'Non renseignée'}
                  </div>
                  {d.nombrePersonnes && parseInt(d.nombrePersonnes) > 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
                      {parseInt(d.dureeEstimee) * parseInt(d.nombrePersonnes)} jours-homme ({d.nombrePersonnes} pers.)
                    </div>
                  )}
                </div>
              </div>

              {/* Nom du chantier */}
              <div style={{ marginBottom: 24 }}>
                <label style={DS.label}>Nom du chantier</label>
                <input
                  autoFocus
                  value={confirmConversion.nomChantier}
                  onChange={e => setConfirmConversion({ ...confirmConversion, nomChantier: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && confirmerConversion()}
                  style={DS.input}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Statut initial : <strong>Planifié</strong> · Vous pourrez ajouter la date dans le Planning
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmConversion(null)} style={DS.btnGhost}>Annuler</button>
                <button onClick={confirmerConversion} style={DS.btnSuccess}>
                  <HardHat size={14} /> Créer le chantier
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Devis;
