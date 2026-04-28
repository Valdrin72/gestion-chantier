import React, { useState } from 'react';
import { C, fmtN } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;
const inputStyle = DS.input;
const labelStyle = DS.label;

export default function Paiements({ chantiers, clients, paiementsData, setPaiementsData, hideHeader = false }) {
  const [chantierSelectionne, setChantierSelectionne] = useState(null);
  const [ajoutPaiement, setAjoutPaiement] = useState(false);
  const [form, setForm] = useState({ type: 'Acompte', montant: '', dateEcheance: '', statut: 'En attente', notes: '' });

  // ===== CALCULS =====
  const getPaiements = (chantierId) => paiementsData[chantierId] || [];

  const getMontantTotal = (chantier) => (parseFloat(chantier.montantDevis) || 0) + (parseFloat(chantier.avenants) || 0);

  const getMontantPaye = (chantierId) => {
    return getPaiements(chantierId).filter(p => p.statut === 'Payé').reduce((t, p) => t + (parseFloat(p.montant) || 0), 0);
  };

  const getMontantEnAttente = (chantierId) => {
    return getPaiements(chantierId).filter(p => p.statut === 'En attente').reduce((t, p) => t + (parseFloat(p.montant) || 0), 0);
  };

  const getMontantEnRetard = (chantierId) => {
    const today = new Date();
    return getPaiements(chantierId).filter(p => p.statut === 'En attente' && new Date(p.dateEcheance) < today).reduce((t, p) => t + (parseFloat(p.montant) || 0), 0);
  };

  const estEnRetard = (paiement) => {
    return paiement.statut === 'En attente' && new Date(paiement.dateEcheance) < new Date();
  };

  const couleurStatut = (statut, enRetard) => {
    if (enRetard) return '#ef4444';
    if (statut === 'Payé') return '#10b981';
    if (statut === 'En attente') return '#f59e0b';
    return '#3b82f6';
  };

  const ajouterPaiement = (chantierId) => {
    if (!form.montant || !form.dateEcheance) return;
    const paiements = getPaiements(chantierId);
    const nouveau = { ...form, id: Date.now(), chantierId };
    setPaiementsData({ ...paiementsData, [chantierId]: [...paiements, nouveau] });
    setForm({ type: 'Acompte', montant: '', dateEcheance: '', statut: 'En attente', notes: '' });
    setAjoutPaiement(false);
  };

  const modifierStatut = (chantierId, paiementId, statut) => {
    const paiements = getPaiements(chantierId).map(p => p.id === paiementId ? { ...p, statut } : p);
    setPaiementsData({ ...paiementsData, [chantierId]: paiements });
  };

  const supprimerPaiement = (chantierId, paiementId) => {
    const paiements = getPaiements(chantierId).filter(p => p.id !== paiementId);
    setPaiementsData({ ...paiementsData, [chantierId]: paiements });
  };

  // ===== TOTAUX GLOBAUX =====
  const totalCA = chantiers.reduce((t, c) => t + getMontantTotal(c), 0);
  const totalPaye = chantiers.reduce((t, c) => t + getMontantPaye(c.id), 0);
  const totalEnAttente = chantiers.reduce((t, c) => t + getMontantEnAttente(c.id), 0);
  const totalEnRetard = chantiers.reduce((t, c) => t + getMontantEnRetard(c.id), 0);
  const chantiersEnRetard = chantiers.filter(c => getMontantEnRetard(c.id) > 0);

  // ===== VUE DÉTAIL =====
  if (chantierSelectionne) {
    const c = chantierSelectionne;
    const paiements = getPaiements(c.id);
    const montantTotal = getMontantTotal(c);
    const montantPaye = getMontantPaye(c.id);
    const montantRestant = montantTotal - montantPaye;
    const pctPaye = montantTotal > 0 ? Math.round((montantPaye / montantTotal) * 100) : 0;
    const client = clients.find(cl => cl.id === c.clientId);

    return (
      <div>
        <button onClick={() => { setChantierSelectionne(null); setAjoutPaiement(false); }}
          style={{ ...DS.btnPrimary, marginBottom: '20px' }}>
          ← Retour
        </button>

        {/* EN-TÊTE */}
        <div style={{ ...carteStyle, borderTop: `5px solid var(--text-primary)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title-main" style={{ fontSize: 20, marginBottom: 4 }}>{c.nom}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>
                👥 {client?.prenom} {client?.nom} — {client?.entreprise}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>📞 {client?.telephone} · ✉️ {client?.email}</div>
            </div>
            <button onClick={() => setAjoutPaiement(!ajoutPaiement)}
              style={{ ...DS.btnPrimary }}>
              + Ajouter paiement
            </button>
          </div>

          {/* BARRE PROGRESSION */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Encaissement</span>
              <span style={{ fontWeight: 'bold', color: '#10b981' }}>{pctPaye}% encaissé</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', height: '12px' }}>
              <div style={{ background: 'linear-gradient(90deg, #10b981, #34d399)', width: `${pctPaye}%`, height: '12px', borderRadius: '10px', transition: 'width 0.3s', boxShadow: '0 0 10px rgba(16,185,129,0.45)' }} />
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginTop: '20px' }}>
            {[
              { label: 'Total devis', val: `CHF ${fmtN(montantTotal)}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
              { label: '✅ Encaissé', val: `CHF ${fmtN(montantPaye)}`, couleur: '#10b981', bg: 'rgba(16,185,129,0.12)' },
              { label: '⏳ En attente', val: `CHF ${fmtN(getMontantEnAttente(c.id))}`, couleur: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
              { label: '💰 Restant', val: `CHF ${fmtN(montantRestant)}`, couleur: montantRestant > 0 ? '#ef4444' : '#10b981', bg: montantRestant > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.couleur}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: s.couleur, marginTop: '4px' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FORMULAIRE AJOUT */}
        {ajoutPaiement && (
          <div style={carteStyle}>
            <div className="ds-card-title">Nouveau paiement</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={labelStyle}>Type de paiement</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                  {['Acompte', 'Solde', 'Avenant', 'Paiement partiel'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Montant (CHF) *</label>
                <input type="text" inputMode="numeric" placeholder="Ex: 15'000" value={form.montant ? fmtN(form.montant) : ''}
                  onChange={e => { const raw = e.target.value.replace(/'/g, '').replace(/[^0-9.]/g, ''); setForm({ ...form, montant: raw }); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date d'échéance *</label>
                <input type="date" value={form.dateEcheance}
                  onChange={e => setForm({ ...form, dateEcheance: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Statut</label>
                <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} style={inputStyle}>
                  {['En attente', 'Payé', 'Annulé'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '2 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <input placeholder="Ex: Virement bancaire, chèque..." value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {/* SUGGESTION ACOMPTE */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', alignSelf: 'center' }}>Suggestions rapides :</span>
              {[30, 50, 70].map(pct => (
                <button key={pct} onClick={() => setForm({ ...form, montant: Math.round(montantTotal * pct / 100) })}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '13px' }}>
                  {pct}% = CHF {fmtN(Math.round(montantTotal * pct / 100))}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => ajouterPaiement(c.id)}
                style={{ ...DS.btnPrimary }}>
                ✅ Ajouter
              </button>
              <button onClick={() => setAjoutPaiement(false)}
                style={{ ...DS.btnDanger }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* LISTE PAIEMENTS — CARDS */}
        <div style={{ ...carteStyle }}>
          <div className="ds-card-title">Échéancier des paiements</div>
          {paiements.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>Aucun paiement enregistré — Cliquez sur "+ Ajouter paiement"</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paiements.map((p) => {
                const retard = estEnRetard(p);
                const couleur = retard ? '#ef4444' : couleurStatut(p.statut, false);
                return (
                  <div key={p.id} className="premium-card" style={{
                    background: retard
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)'
                      : 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
                    backdropFilter: 'blur(12px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
                    borderRadius: '12px',
                    border: `1px solid ${retard ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderLeft: `4px solid ${couleur}`,
                    boxShadow: retard
                      ? '0 2px 8px rgba(239,68,68,0.15), 0 8px 24px rgba(0,0,0,0.35)'
                      : 'var(--shadow-card)',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}>
                    {/* Icône + type */}
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '10px', background: couleur + '22', border: `1px solid ${couleur}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {p.statut === 'Payé' ? '✅' : retard ? '⚠️' : '💳'}
                      </div>
                    </div>
                    {/* Type */}
                    <div style={{ width: 110, flexShrink: 0 }}>
                      <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.3px' }}>{p.type}</span>
                    </div>
                    {/* Montant */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        CHF {fmtN(parseFloat(p.montant))}
                      </div>
                      {p.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>{p.notes}</div>}
                    </div>
                    {/* Échéance */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Échéance</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: retard ? '#ef4444' : 'var(--text-primary)' }}>{p.dateEcheance}</div>
                      {retard && <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, marginTop: 2 }}>EN RETARD</div>}
                    </div>
                    {/* Statut badge */}
                    <div style={{ flexShrink: 0 }}>
                      <span style={{
                        background: couleur + '1a',
                        color: couleur,
                        border: `1px solid ${couleur}44`,
                        padding: '5px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.2px',
                      }}>
                        {retard ? '⚠️ Retard' : p.statut}
                      </span>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {p.statut !== 'Payé' && (
                        <button onClick={() => modifierStatut(c.id, p.id, 'Payé')}
                          style={{ ...DS.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>
                          ✅ Payé
                        </button>
                      )}
                      {p.statut === 'Payé' && (
                        <button onClick={() => modifierStatut(c.id, p.id, 'En attente')}
                          style={{ ...DS.btnWarning, padding: '6px 12px', fontSize: '12px' }}>
                          ↩️ Annuler
                        </button>
                      )}
                      <button onClick={() => supprimerPaiement(c.id, p.id)}
                        style={{ ...DS.btnDanger, padding: '6px 10px', fontSize: '13px' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== VUE LISTE =====
  return (
    <div>
      {!hideHeader && <div className="page-title-main" style={{ marginBottom: 24 }}>Suivi des paiements</div>}

      {/* ALERTES RETARD */}
      {chantiersEnRetard.length > 0 && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '25px' }}>
          <div style={{ fontWeight: 'bold', color: '#ef4444', marginBottom: '10px', fontSize: '16px' }}>⚠️ Paiements en retard !</div>
          {chantiersEnRetard.map(c => (
            <div key={c.id} style={{ color: '#ef4444', marginBottom: '5px' }}>
              ▶ <strong>{c.nom}</strong> — CHF {fmtN(getMontantEnRetard(c.id))} en retard
            </div>
          ))}
        </div>
      )}

      {/* KPIs GLOBAUX */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px' }}>
        {[
          { label: '💰 CA Total', val: `CHF ${fmtN(totalCA)}`, couleur: '#10b981' },
          { label: '✅ Encaissé', val: `CHF ${fmtN(totalPaye)}`, couleur: '#10b981' },
          { label: '⏳ En attente', val: `CHF ${fmtN(totalEnAttente)}`, couleur: '#f59e0b' },
          { label: '⚠️ En retard', val: `CHF ${fmtN(totalEnRetard)}`, couleur: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="premium-card" style={{
            background: `linear-gradient(145deg, ${s.couleur}14 0%, ${s.couleur}07 60%, rgba(255,255,255,0.02) 100%)`,
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            border: `1px solid ${s.couleur}2e`,
            borderRadius: 16, padding: '22px 24px',
            boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4), 0 0 0 0 ${s.couleur}00`,
            flex: 1, minWidth: 150, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${s.couleur}40 50%, transparent)` }} />
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: s.couleur + '22', border: `1px solid ${s.couleur}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 }}>{s.label.split(' ')[0]}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 6, letterSpacing: '-1px' }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label.substring(s.label.indexOf(' ') + 1)}</div>
          </div>
        ))}
      </div>

      {/* LISTE CHANTIERS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chantiers.map(c => {
          const montantTotal = getMontantTotal(c);
          const montantPaye = getMontantPaye(c.id);
          const montantRetard = getMontantEnRetard(c.id);
          const pctPaye = montantTotal > 0 ? Math.round((montantPaye / montantTotal) * 100) : 0;
          const client = clients.find(cl => cl.id === c.clientId);
          const nbPaiements = getPaiements(c.id).length;

          return (
            <div key={c.id} className="premium-card" style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.038) 100%)',
                backdropFilter: 'blur(14px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
                borderRadius: '14px', boxShadow: 'var(--shadow-card)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid ${montantRetard > 0 ? '#ef4444' : montantPaye >= montantTotal && montantTotal > 0 ? '#10b981' : '#3b82f6'}`,
                padding: '20px', cursor: 'pointer',
              }}
              onClick={() => setChantierSelectionne(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.nom}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    👥 {client?.entreprise || 'N/A'} · 📍 {c.ville} · {nbPaiements} paiement(s)
                  </div>

                  {/* BARRE PROGRESSION */}
                  <div style={{ marginTop: '10px', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Encaissement</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{pctPaye}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', height: '8px' }}>
                      <div style={{ background: 'linear-gradient(90deg, #10b981, #34d399)', width: `${pctPaye}%`, height: '8px', borderRadius: '10px', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }} />
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total</div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-primary)' }}>CHF {fmtN(montantTotal)}</div>
                  <div style={{ fontSize: '13px', color: '#10b981' }}>✅ CHF {fmtN(montantPaye)}</div>
                  {montantRetard > 0 && (
                    <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ CHF {fmtN(montantRetard)} retard</div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#22d3ee' }}>👁️ Voir détail →</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
