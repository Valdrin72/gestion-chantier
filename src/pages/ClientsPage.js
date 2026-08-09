import React, { useState, useLayoutEffect } from 'react';
import {
  FileText, HardHat, Plus, Pencil, Trash2, Archive, Menu,
} from 'lucide-react';
import { fmtN, calculerCA } from '../donnees';
import { DS } from '../ds';
import { V1, mono, carteV1, heroFond, heroMono } from '../design/v1';
import { useApp } from '../context/AppContext';
import useIsMobile from '../hooks/useIsMobile';
import { clientEstReferencé } from '../utils/referenceGuard';
import { archiver, restaurer, filtrerActifs, filtrerArchives } from '../utils/archiveHelpers';
import ArchiveToggle from '../components/shared/ArchiveToggle';
import ArchivedRow from '../components/shared/ArchivedRow';

// Supprime les balises HTML des champs texte avant sauvegarde (protection XSS dans PDF)
const sanitiser = (obj) => {
  const nettoyer = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').substring(0, 2000) : v;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nettoyer(v)]));
};

const inputStyle = DS.input;
const labelStyle = DS.label;
const carteStyle = DS.card;
const btnPrimaire = DS.btnPrimary;

// Bouton translucide du hero bleu nuit (mêmes tokens que les autres pages v1).
const heroBtn = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
// Couleur du badge type client (Entreprise bleu, Institutionnel ambre, Particulier gris).
const couleurType = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'entreprise') return V1.bleu;
  if (t === 'particulier') return V1.texteMuted;
  return V1.warn; // Architecte / Bureau d'études / Promoteur = institutionnel
};

function Clients({ clients, setClients, chantiers, devis = [], factures = [], naviguer }) {
  const { confirmer, afficherNotif, ouvrirMenu } = useApp();
  const isMobile = useIsMobile();
  // La page passe en « hero plein écran » (Topbar blanc masqué) comme les autres pages v1.
  useLayoutEffect(() => {
    document.body.classList.add('hero-fullscreen');
    return () => document.body.classList.remove('hero-fullscreen');
  }, []);
  const [ajout, setAjout] = useState(false);
  const [voirArchives, setVoirArchives] = useState(false);
  // Liste active = clients non archivés. Les archivés restent en base, restaurables.
  const clientsActifs = filtrerActifs(clients);
  const clientsArchives = filtrerArchives(clients);
  // Un client référencé (chantiers/devis/factures) ne se supprime pas → on l'archive.
  const estReference = (c) => clientEstReferencé(c, { chantiers, devis, factures }) !== null;
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
  // Client vierge (aucun chantier/devis/facture) → suppression dure autorisée.
  const supprimer = async (c) => {
    if (!await confirmer(`Supprimer ${c.prenom} ${c.nom} ?\n\nCette action est irréversible.`, { labelOui: 'Supprimer' })) return;
    setClients(clients.filter(cl => String(cl.id) !== String(c.id)));
    if (afficherNotif) afficherNotif('Client supprimé');
  };

  // Client référencé → archivage (soft) : rangé hors de la liste active, rien n'est détruit.
  const archiverClient = async (c) => {
    if (!await confirmer(`Archiver ${c.prenom} ${c.nom} ?\n\nIl sera rangé hors de la liste active mais conservé (chantiers, devis, factures, historique).`, { labelOui: 'Archiver' })) return;
    setClients(clients.map(cl => String(cl.id) === String(c.id) ? archiver(cl) : cl));
    if (afficherNotif) afficherNotif('Client archivé — visible via « Voir les archivés »');
  };

  const restaurerClient = (c) => {
    setClients(clients.map(cl => String(cl.id) === String(c.id) ? restaurer(cl) : cl));
    if (afficherNotif) afficherNotif('Client restauré dans la liste active');
  };

  const ouvrirNouveau = () => { setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); setAjout(true); };

  return (
    <div>
      {/* ══ HERO BLEU NUIT (design v1, bord à bord, collé au sommet) ══ */}
      {(() => {
        const caTotal = clientsActifs.reduce((s, c) => { const ch = chantiers.filter(ch => String(ch.clientId) === String(c.id)); return s + ch.reduce((t, ch) => t + (calculerCA(ch, devis) || 0), 0); }, 0);
        const nbAvecChantier = clientsActifs.filter(c => chantiers.some(ch => String(ch.clientId) === String(c.id))).length;
        const nbActifs = clientsActifs.filter(c => chantiers.some(ch => String(ch.clientId) === String(c.id) && (ch.statut || '').trim().toLowerCase() === 'en cours')).length;
        const entreprises = clientsActifs.filter(c => c.type === 'Entreprise').length;
        const heroChiffres = [
          { label: 'TOTAL CLIENTS', val: String(clientsActifs.length),  couleur: '#8FBCE6', sub: `${nbActifs} actif${nbActifs !== 1 ? 's' : ''}` },
          { label: 'CA TOTAL',      val: `CHF ${fmtN(caTotal)}`,        couleur: '#4ADE80', sub: null },
          { label: 'AVEC CHANTIER', val: String(nbAvecChantier),        couleur: '#F5B14A', sub: null },
          { label: 'ENTREPRISES',   val: String(entreprises),           couleur: '#8FBCE6', sub: null },
        ];
        return (
          <div className="page-hero-bleed" data-testid="hero-clients" style={{ ...heroFond, padding: '20px 32px 0', position: 'relative' }}>
            {/* Ligne 1 — ☰ · CYNA · CLIENTS / 08 · Nouveau client */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {ouvrirMenu && (
                <button onClick={ouvrirMenu} aria-label="Menu" style={{ ...heroBtn, padding: 7 }}><Menu size={16} /></button>
              )}
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#fff' }}>CYNA</span>
              <span style={heroMono(10, 0.55)}>· CLIENTS / 08</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={ouvrirNouveau} style={{ ...heroBtn, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <Plus size={14} /> Nouveau client
                </button>
              </div>
            </div>

            {/* Ligne 2 — titre + ligne mono */}
            <div style={heroMono(11, 0.6)}>CLIENTS / 08</div>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 34, margin: '8px 0 8px', letterSpacing: '-0.02em', color: '#fff' }}>Clients</h1>
            <div style={heroMono(11, 0.7)}>{clientsActifs.length} CLIENT{clientsActifs.length !== 1 ? 'S' : ''} ENREGISTRÉ{clientsActifs.length !== 1 ? 'S' : ''} · {nbActifs} ACTIF{nbActifs !== 1 ? 'S' : ''}</div>

            {/* Ligne 3 — les 4 chiffres clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20, paddingBottom: 24 }} data-testid="hero-chiffres">
              {heroChiffres.map(t => (
                <div key={t.label} data-testid={`hero-kpi-${t.label.toLowerCase().replace(/[^a-zà-ÿ]+/g, '-').replace(/^-|-$/g, '')}`}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={heroMono(9, 0.6)}>{t.label}</div>
                  <div style={{ ...mono(22, t.couleur, 500), lineHeight: 1.1, marginTop: 4 }}>{t.val}</div>
                  {t.sub && <div style={heroMono(9, 0.5)}>{t.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {ajout && (
        <div style={{ ...carteStyle, borderTop: `3px solid ${V1.bleu}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="ds-card-title" style={{ margin: 0 }}>{form.id ? 'Modifier le' : 'Nouveau'} client</div>
            {form.id && <span style={{ ...mono(11, V1.bleu, 600) }}>{`${form.prenom || ''} ${form.nom || ''}`.trim()}</span>}
          </div>
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
            <button onClick={sauvegarder} style={btnPrimaire}>{form.id ? 'Enregistrer les modifications' : 'Créer le client'}</button>
            <button onClick={() => { setAjout(false); setForm({ nom: '', prenom: '', entreprise: '', telephone: '', email: '', adresse: '', ville: '', canton: '', type: 'Entreprise', notes: '' }); }} style={DS.btnGhost}>Annuler</button>
          </div>
        </div>
      )}
      {clientsArchives.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ArchiveToggle
            voirArchives={voirArchives}
            onToggle={() => setVoirArchives(v => !v)}
            count={clientsArchives.length}
            labelSingulier="client archivé"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'var(--g3)', gap: isMobile ? '10px' : '15px' }}>
        {clientsActifs.map(c => {
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
          const cType = couleurType(c.type);
          return (
            <div key={c.id} className="ds-animate-in" style={{ ...carteV1, marginBottom: 0, borderTop: `3px solid ${cType}` }}>
              {/* En-tête : nom/entreprise/contact (initiales retirées) + badge type + impayé */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: V1.texte }}>{c.prenom} {c.nom}</div>
                  {c.entreprise && <div style={{ fontSize: 12, color: V1.texteMuted, marginTop: 3, fontWeight: 600 }}>{c.entreprise}</div>}
                  {(c.adresse || c.ville) && <div style={{ ...mono(10, V1.texteMuted), marginTop: 3 }}>{[c.adresse, c.ville].filter(Boolean).join(', ').toUpperCase()}</div>}
                  {(c.telephone || c.email) && <div style={{ ...mono(10, V1.texteMuted), marginTop: 1 }}>{[c.telephone, c.email].filter(Boolean).join(' · ')}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ ...mono(10, cType, 600), textTransform: 'uppercase', letterSpacing: '0.04em', background: cType + '16', border: `1px solid ${cType}30`, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{c.type}</span>
                  {impayees.length > 0 && (
                    <span style={{ ...mono(10, V1.danger, 700), background: V1.danger + '12', border: `1px solid ${V1.danger}30`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      {impayees.length} IMPAYÉE{impayees.length > 1 ? 'S' : ''} · CHF {fmtN(Math.round(montantImpaye))}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: V1.bleuFond, border: `1px solid ${V1.bleu}22`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: V1.texteMuted, marginBottom: '3px' }}>Chantiers</div>
                  <div style={{ ...mono(20, V1.bleu, 600) }}>{chantiersC.length}</div>
                </div>
                <div style={{ background: V1.ok + '10', border: `1px solid ${V1.ok}22`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: V1.texteMuted, marginBottom: '3px' }}>CA Total</div>
                  <div style={{ ...mono(14, V1.ok, 600) }}>CHF {fmtN(ca)}</div>
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
                {estReference(c)
                  ? <button onClick={() => archiverClient(c)} style={{ ...DS.btnGhost, padding: '6px 10px' }} title="Archiver ce client (historique conservé)"><Archive size={13} /></button>
                  : <button onClick={() => supprimer(c)} style={{ ...DS.btnGhost, padding: '6px 10px', color: V1.danger }} title="Supprimer ce client"><Trash2 size={13} /></button>}
              </div>
            </div>
          );
        })}
      </div>
      {voirArchives && clientsArchives.length > 0 && (
        <div style={{ ...DS.card, padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
            Clients archivés ({clientsArchives.length})
          </div>
          {clientsArchives.map(c => (
            <ArchivedRow
              key={c.id}
              label={`${c.prenom || ''} ${c.nom || ''}`.trim() || c.entreprise || '—'}
              sublabel={[c.entreprise, c.email].filter(Boolean).join(' · ')}
              dateArchivage={c.dateArchivage}
              onRestaurer={() => restaurerClient(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Clients;
