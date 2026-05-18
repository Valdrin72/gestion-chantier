// ============================================================
// CYNA — Tableau de relances factures
// ============================================================
import React, { useState, useMemo } from 'react';
import { CheckCircle, Mail, Send, Copy, X, AlertTriangle, Clock, FileText } from 'lucide-react';
import { prochainRappel, niveauInfo, genererTexteRappel, marquerRappelEnvoye } from './relances';
import { DS } from './ds';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function montantRestant(f) {
  const total = parseFloat(f.montantTTC) || parseFloat(f.montantHT) || 0;
  const paye = (f.paiementsHistorique || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  return Math.max(0, total - paye);
}

// ── Modal lettre de relance ──────────────────────────────────
function ModalLettre({ item, client, onClose }) {
  const [copie, setCopie] = useState(false);
  const info = niveauInfo(item.prochaine.niveau);
  const lettre = genererTexteRappel(item.prochaine.niveau, item.f, client || null, {});

  const handleCopier = () => {
    navigator.clipboard.writeText(lettre.texte).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--ds-card-bg)', borderRadius: 18,
          border: '1px solid var(--ds-card-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: 680, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* En-tête */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--ds-card-border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: info?.couleur + '18',
            border: `1px solid ${info?.couleur}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={16} style={{ color: info?.couleur }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lettre.objet}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Facture {item.f.numero || item.f.id} · {client?.entreprise || client?.nom || 'Client inconnu'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ ...DS.iconBtn, flexShrink: 0, width: 32, height: 32, borderRadius: 8 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Texte lettre */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <textarea
            readOnly
            value={lettre.texte}
            style={{
              width: '100%', height: 380, resize: 'vertical',
              padding: '16px', borderRadius: 10,
              border: '1px solid var(--ds-input-border)',
              background: 'var(--ds-input-bg)',
              color: 'var(--text-primary)',
              fontSize: 12.5, fontFamily: 'monospace',
              lineHeight: 1.65, boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Pied */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--ds-card-border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={DS.btnGhost}>
            Fermer
          </button>
          <button
            onClick={handleCopier}
            style={{ ...DS.btnPrimary, background: copie ? 'linear-gradient(135deg, #065F46 0%, #10B981 100%)' : DS.btnPrimary.background }}
          >
            <Copy size={14} />
            {copie ? 'Copié !' : 'Copier le texte'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Badge niveau ─────────────────────────────────────────────
function BadgeNiveau({ niveau }) {
  const info = niveauInfo(niveau);
  if (!info) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: info.couleur + '18',
      color: info.couleur,
      border: `1px solid ${info.couleur}30`,
      whiteSpace: 'nowrap',
    }}>
      {niveau === 3 && <AlertTriangle size={10} />}
      {info.label}
    </span>
  );
}

// ── KPI card gradient ─────────────────────────────────────────
function KpiCard({ label, val, sub, gradient, glow, Icon }) {
  return (
    <div style={{
      background: gradient, borderRadius: 16, padding: '20px',
      boxShadow: `0 4px 20px ${glow}, 0 1px 4px rgba(0,0,0,0.12)`,
      border: '1px solid rgba(255,255,255,0.15)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -18, top: -18, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', right: -28, bottom: -28, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
        <Icon size={16} strokeWidth={2} style={{ color: '#fff' }} />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, position: 'relative' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, position: 'relative' }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 7, position: 'relative' }}>{sub}</div>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function RelancesTab({ factures = [], clients = [], chantiers = [], setFactures, afficherNotif }) {
  const [modalItem, setModalItem] = useState(null);

  const aRelancer = useMemo(() =>
    factures
      .map(f => ({ f, prochaine: prochainRappel(f) }))
      .filter(({ prochaine }) => prochaine !== null)
      .sort((a, b) => b.prochaine.joursRetard - a.prochaine.joursRetard),
    [factures]
  );

  // KPIs
  const totalSouffrance = useMemo(() =>
    aRelancer.reduce((s, { f }) => s + montantRestant(f), 0),
    [aRelancer]
  );
  const nbNiveau1 = aRelancer.filter(({ prochaine }) => prochaine.niveau === 1).length;
  const nbNiveau3 = aRelancer.filter(({ prochaine }) => prochaine.niveau === 3).length;

  const handleMarquerEnvoye = (item) => {
    const miseAJour = marquerRappelEnvoye(item.f, item.prochaine.niveau);
    setFactures(prev => prev.map(f => String(f.id) === String(item.f.id) ? miseAJour : f));
    const info = niveauInfo(item.prochaine.niveau);
    afficherNotif(`Rappel marqué envoyé — ${info?.label || 'Niveau ' + item.prochaine.niveau}`, 'succes');
  };

  if (aRelancer.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={28} style={{ color: '#10b981' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Aucune relance en cours</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 340 }}>
          Toutes les factures sont à jour ou en attente de délai. Aucune action requise.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard
          label="Factures à relancer"
          val={String(aRelancer.length)}
          sub={`${aRelancer.length > 1 ? 'relances' : 'relance'} à envoyer`}
          gradient={DS.kpi.amber.gradient}
          glow={DS.kpi.amber.glow}
          Icon={Clock}
        />
        <KpiCard
          label="Montant en souffrance"
          val={`CHF ${fmt(totalSouffrance)}`}
          sub="Solde total impayé à relancer"
          gradient={DS.kpi.red.gradient}
          glow={DS.kpi.red.glow}
          Icon={AlertTriangle}
        />
        <KpiCard
          label="Rappel 1"
          val={String(nbNiveau1)}
          sub={`facture${nbNiveau1 !== 1 ? 's' : ''} — 1er rappel`}
          gradient={DS.kpi.blue.gradient}
          glow={DS.kpi.blue.glow}
          Icon={FileText}
        />
        <KpiCard
          label="Mise en demeure"
          val={String(nbNiveau3)}
          sub={`facture${nbNiveau3 !== 1 ? 's' : ''} — niveau critique`}
          gradient={DS.kpi.purple.gradient}
          glow={DS.kpi.purple.glow}
          Icon={AlertTriangle}
        />
      </div>

      {/* ── Tableau ── */}
      <div style={{ ...DS.card, padding: 0, overflow: 'hidden', marginBottom: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Facture', 'Client', 'Chantier', 'Montant restant', 'Retard', 'Niveau', 'Actions'].map(col => (
                  <th key={col} style={DS.th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aRelancer.map(({ f, prochaine }) => {
                const client = clients.find(c => String(c.id) === String(f.clientId));
                const chantier = chantiers.find(c => String(c.id) === String(f.chantierId));
                const restant = montantRestant(f);
                const info = niveauInfo(prochaine.niveau);

                return (
                  <tr key={f.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Facture */}
                    <td style={DS.td}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.numero || f.id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Échue le {f.dateEcheance ? f.dateEcheance.split('-').reverse().join('.') : '—'}
                      </div>
                    </td>

                    {/* Client */}
                    <td style={DS.td}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {client?.entreprise || client?.nom || '—'}
                      </span>
                    </td>

                    {/* Chantier */}
                    <td style={{ ...DS.td, maxWidth: 180 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'var(--text-secondary)' }}>
                        {chantier?.nom || chantier?.numero || '—'}
                      </span>
                    </td>

                    {/* Montant restant */}
                    <td style={DS.td}>
                      <span style={{ fontWeight: 800, color: info?.couleur || 'var(--text-primary)', fontSize: 14 }}>
                        CHF {fmt(restant)}
                      </span>
                    </td>

                    {/* Retard */}
                    <td style={DS.td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.22)',
                      }}>
                        {prochaine.joursRetard}j de retard
                      </span>
                    </td>

                    {/* Niveau */}
                    <td style={DS.td}>
                      <BadgeNiveau niveau={prochaine.niveau} />
                    </td>

                    {/* Actions */}
                    <td style={{ ...DS.td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => setModalItem({ f, prochaine })}
                          style={DS.btnGhost}
                          title="Voir la lettre de relance"
                        >
                          <Mail size={13} />
                          Voir lettre
                        </button>
                        <button
                          onClick={() => handleMarquerEnvoye({ f, prochaine })}
                          style={DS.btnSuccess}
                          title="Marquer ce rappel comme envoyé"
                        >
                          <Send size={13} />
                          Marquer envoyé
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal lettre ── */}
      {modalItem && (
        <ModalLettre
          item={modalItem}
          client={clients.find(c => String(c.id) === String(modalItem.f.clientId))}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
