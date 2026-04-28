// ============================================================
// CYNA — MODULE FINANCES (Factures + Paiements unifiés)
// ============================================================
import React, { useState, useMemo } from 'react';
import { DollarSign, FileText, Clock, AlertTriangle, CreditCard } from 'lucide-react';
import Factures from './Factures';
import Paiements from './Paiements';
import { DS } from './ds';
import { getIntervallesPeriode, getPeriodeLabel, facturesInPeriode } from './donnees';

const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Finances({
  factures = [], onSave,
  clients = [], chantiers = [], devis = [],
  paiementsData = {}, setPaiementsData,
  naviguer, contexte = {}, profil,
  periodeGlobale = 'mois',
}) {
  const [onglet, setOnglet] = useState('factures');

  // ── Factures filtrées par période ────────────────────────────
  const facturesPeriode = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return factures.filter(f => facturesInPeriode(f, debut, fin));
  }, [factures, periodeGlobale]);

  // ── KPIs synthèse (filtrés par période) ─────────────────────
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const actives = facturesPeriode.filter(f => f.statut !== 'annulee');
    const totalFacture  = actives.reduce((s, f) => s + (parseFloat(f.montantTTC)  || 0), 0);
    const totalPaye     = actives.reduce((s, f) => s + (parseFloat(f.montantPaye) || 0), 0);
    const enRetard      = actives
      .filter(f => f.statut !== 'payee' && f.dateEcheance && f.dateEcheance < today)
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    const enAttente     = actives
      .filter(f => f.statut !== 'payee' && !(f.dateEcheance && f.dateEcheance < today))
      .reduce((s, f) => s + Math.max(0, (parseFloat(f.montantTTC) || 0) - (parseFloat(f.montantPaye) || 0)), 0);
    return { totalFacture, totalPaye, enAttente, enRetard };
  }, [facturesPeriode]);

  const tabs = [
    { id: 'factures',  label: '🧾 Factures',          count: facturesPeriode.filter(f => f.statut !== 'annulee').length },
    { id: 'paiements', label: '💳 Paiements chantiers', count: null },
  ];

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Finances</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {getPeriodeLabel(periodeGlobale)} — Factures, paiements et suivi financier
          </div>
        </div>
      </div>

      {/* ── KPIs résumé ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Total facturé',  val: `CHF ${fmt(kpis.totalFacture)}`,  couleur: '#3b82f6', Icon: FileText },
          { label: 'Total encaissé', val: `CHF ${fmt(kpis.totalPaye)}`,     couleur: '#10b981', Icon: DollarSign },
          { label: 'En attente',     val: `CHF ${fmt(kpis.enAttente)}`,     couleur: '#f59e0b', Icon: Clock },
          { label: 'En retard',      val: `CHF ${fmt(kpis.enRetard)}`,      couleur: '#ef4444', Icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="premium-card" style={{
            flex: 1, minWidth: 180,
            background: `linear-gradient(145deg, ${k.couleur}14 0%, ${k.couleur}07 60%, rgba(255,255,255,0.025) 100%)`,
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            border: `1px solid ${k.couleur}30`,
            borderRadius: 16, padding: '20px 22px',
            boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4)`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${k.couleur}50 50%, transparent)` }} />
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.couleur + '22', border: `1px solid ${k.couleur}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <k.Icon size={17} style={{ color: k.couleur }} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.6px', lineHeight: 1, marginBottom: 5 }}>{k.val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Alertes retard ── */}
      {kpis.enRetard > 0 && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: 20 }}>
          <strong>⚠️ {facturesPeriode.filter(f => f.statut === 'retard').length} facture(s) en retard</strong>
          {' — '}CHF {fmt(kpis.enRetard)} impayé(s). Consultez l'onglet Factures pour les détails.
        </div>
      )}

      {/* ── Navigation onglets ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${onglet === t.id ? 'rgba(59,130,246,0.8)' : 'transparent'}`,
            color: onglet === t.id ? '#60a5fa' : 'var(--text-secondary)',
            padding: '10px 22px', fontSize: 14,
            fontWeight: onglet === t.id ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.18s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {t.label}
            {t.count !== null && (
              <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      <div style={{ display: onglet === 'factures' ? 'block' : 'none' }}>
        <Factures
          factures={factures}
          onSave={onSave}
          clients={clients}
          chantiers={chantiers}
          devis={devis}
          paiementsData={paiementsData}
          setPaiementsData={setPaiementsData}
          naviguer={naviguer}
          profil={profil}
          periodeGlobale={periodeGlobale}
          hideHeader
        />
      </div>
      <div style={{ display: onglet === 'paiements' ? 'block' : 'none' }}>
        <Paiements
          chantiers={chantiers}
          clients={clients}
          paiementsData={paiementsData}
          setPaiementsData={setPaiementsData}
          hideHeader
        />
      </div>
    </div>
  );
}
