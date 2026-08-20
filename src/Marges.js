import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DS } from './ds';
import { fmtN, SEUILS } from './donnees';
import { indicateursMargeChantier, periodeLabel } from './calculs/periode';
import { useApp } from './context/AppContext';
import { V1, BADGES_V1, mono, carteV1 } from './design/v1';

const seuils = { bon: SEUILS.margeRentable, ok: SEUILS.margeLimite };

// Couleurs d'état — socle v1 (seuils métier inchangés).
function statutMarge(pct) {
  if (pct === null) return { label: 'N/D', bg: V1.separation, color: V1.texteMuted, Icon: Minus };
  if (pct >= seuils.bon) return { label: `${Math.round(pct * 10) / 10}%`, bg: BADGES_V1.ok.bg, color: BADGES_V1.ok.color, Icon: TrendingUp };
  if (pct >= seuils.ok)  return { label: `${Math.round(pct * 10) / 10}%`, bg: BADGES_V1.warn.bg, color: BADGES_V1.warn.color, Icon: Minus };
  return { label: `${Math.round(pct * 10) / 10}%`, bg: BADGES_V1.danger.bg, color: BADGES_V1.danger.color, Icon: TrendingDown };
}

export default function Marges({ chantiers = [], clients = [], devis = [], parametres = {}, periodeGlobale = 'annee' }) {
  const { pointages = [], factures = [] } = useApp();

  // CA = CA FACTURÉ HT de la période (Σ montantHT des factures, dateEmission ∈ période) ; coûts au prorata
  // via coutChantierDansPeriode ; « à facturer » = coûts engagés non couverts par une facture. Tout passe
  // par le helper partagé indicateursMargeChantier (source unique periode.js). Un chantier n'apparaît que
  // s'il a une facture OU des coûts SUR la période (indicateur `actif`).
  const rows = useMemo(() => {
    const cfg = parametres.parametres;
    return chantiers
      .map(c => {
        const ind = indicateursMargeChantier(c, parametres.employes, cfg, pointages, factures, periodeGlobale);
        const client = clients.find(cl => String(cl.id) === String(c.clientId));
        return {
          id: c.id,
          nom: c.nom || c.numero,
          statut: c.statut || '—',
          client: client?.nom || '—',
          actif: ind.actif,
          caHT: ind.caHT,
          couts: ind.couts,
          margeReel: ind.marge,          // null si aucune facture sur la période
          margeActuellePct: ind.margePct, // null si aucune facture → pas de -100 % trompeur
          aFacturer: ind.aFacturer,
        };
      })
      .filter(r => r.actif)
      .sort((a, b) => {
        // Trier : marges connues d'abord (problèmes en haut), puis les « à facturer » (sans marge %).
        if (a.margeActuellePct === null && b.margeActuellePct !== null) return 1;
        if (a.margeActuellePct !== null && b.margeActuellePct === null) return -1;
        if (a.margeActuellePct === null && b.margeActuellePct === null) return b.aFacturer - a.aFacturer;
        return a.margeActuellePct - b.margeActuellePct;
      });
  }, [chantiers, clients, parametres, pointages, factures, periodeGlobale]);

  const kpi = useMemo(() => {
    const facturees = rows.filter(r => r.caHT > 0);            // chantiers ayant une facture sur la période
    const caTotal = facturees.reduce((s, r) => s + r.caHT, 0);
    const coutsTotal = facturees.reduce((s, r) => s + r.couts, 0);
    const margeTotal = caTotal - coutsTotal;
    const margePct = caTotal > 0 ? (margeTotal / caTotal) * 100 : null;
    const aFacturerTotal = rows.reduce((s, r) => s + r.aFacturer, 0); // toutes lignes, y c. sans facture
    const nbRouge = facturees.filter(r => r.margeActuellePct < seuils.ok).length;
    const nbVert  = facturees.filter(r => r.margeActuellePct >= seuils.bon).length;
    return { caTotal, coutsTotal, margeTotal, margePct, aFacturerTotal, nbRouge, nbVert, nbAvecDonnees: facturees.length };
  }, [rows]);

  const fmt = (v) => v !== null ? `CHF ${fmtN(Math.round(v))}` : '—';

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Marges par chantier</div>
          <div className="page-title-sub">
            {periodeLabel(periodeGlobale)} · {kpi.nbAvecDonnees} chantier{kpi.nbAvecDonnees !== 1 ? 's' : ''} facturé{kpi.nbAvecDonnees !== 1 ? 's' : ''}
            {kpi.nbRouge > 0 && ` · ${kpi.nbRouge} sous le seuil`}
          </div>
        </div>
      </div>

      {/* KPI — cartes v1 sobres (liseré coloré par état) */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'CA FACTURÉ TOTAL', val: fmt(kpi.caTotal), couleur: V1.bleu },
          { label: 'COÛTS RÉELS', val: fmt(kpi.coutsTotal), couleur: V1.texteMuted },
          { label: 'MARGE TOTALE', val: fmt(kpi.margeTotal), couleur: kpi.margeTotal >= 0 ? V1.ok : V1.danger,
            badge: kpi.margePct !== null ? `${Math.round(kpi.margePct * 10) / 10}%` : null },
          { label: 'À FACTURER', val: fmt(kpi.aFacturerTotal), couleur: kpi.aFacturerTotal > 0 ? V1.warn : V1.texteMuted,
            badge: kpi.aFacturerTotal > 0 ? 'coûts non facturés' : null },
        ].map(k => (
          <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: V1.texteMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ ...mono(22, k.couleur, 700), lineHeight: 1.1 }}>{k.val}</div>
            {k.badge && <span style={{ ...mono(10, k.couleur, 700), display: 'inline-block', marginTop: 7, background: k.couleur + '18', borderRadius: 20, padding: '2px 9px' }}>{k.badge}</span>}
          </div>
        ))}
      </div>

      {/* Légende seuils */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { bg: BADGES_V1.ok.bg, color: BADGES_V1.ok.color, label: `Rentable ≥ ${seuils.bon}%` },
          { bg: BADGES_V1.warn.bg, color: BADGES_V1.warn.color, label: `Correct ${seuils.ok}–${seuils.bon}%` },
          { bg: BADGES_V1.danger.bg, color: BADGES_V1.danger.color, label: `Critique < ${seuils.ok}%` },
          { bg: V1.separation, color: V1.texteMuted, label: 'Données manquantes' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V1.texteMuted }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: `1px solid ${s.color}40` }} />
            <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div style={carteV1}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: V1.texteMuted }}>
            <TrendingUp size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun chantier</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['CHANTIER', 'CLIENT', 'STATUT', 'CA FACTURÉ', 'COÛTS RÉELS', 'MARGE CHF', 'MARGE %', 'À FACTURER'].map(h => (
                    <th key={h} style={{ ...DS.th, textAlign: ['CA FACTURÉ','COÛTS RÉELS','MARGE CHF','À FACTURER'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const sm = statutMarge(r.margeActuellePct);
                  const bs = DS.statuts[r.statut] || { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr key={r.id} style={{ background: r.margeActuellePct !== null && r.margeActuellePct < seuils.ok ? `${sm.bg}44` : 'transparent' }}>
                      <td style={{ ...DS.td, fontWeight: 700, color: V1.texte }}>{r.nom}</td>
                      <td style={{ ...DS.td, color: V1.texteMuted }}>{r.client}</td>
                      <td style={DS.td}>
                        <span style={{ background: bs.bg, color: bs.color, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                          {r.statut}
                        </span>
                      </td>
                      <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte, 600) }}>{fmt(r.caHT)}</td>
                      <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte) }}>{fmt(r.couts)}</td>
                      <td style={{ ...DS.td, textAlign: 'right', ...mono(13, r.margeReel === null ? V1.texteMuted : r.margeReel >= 0 ? V1.ok : V1.danger, 700) }}>
                        {r.margeReel !== null ? `CHF ${fmtN(Math.round(r.margeReel))}` : '—'}
                      </td>
                      <td style={DS.td}>
                        {r.margeActuellePct !== null ? (
                          <span style={{ ...mono(12, sm.color, 700), background: sm.bg, borderRadius: 6, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <sm.Icon size={11} strokeWidth={2.5} />
                            {sm.label}
                          </span>
                        ) : <span style={{ color: V1.texteMuted, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...DS.td, textAlign: 'right' }}>
                        {r.aFacturer > 0 ? (
                          <span style={{ ...mono(12, V1.warn, 700), background: V1.warn + '18', borderRadius: 6, padding: '3px 10px' }}>
                            CHF {fmtN(Math.round(r.aFacturer))}
                          </span>
                        ) : <span style={{ color: V1.texteMuted, fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne total */}
              {(kpi.nbAvecDonnees > 0 || kpi.aFacturerTotal > 0) && (
                <tfoot>
                  <tr style={{ background: V1.page, borderTop: `2px solid ${V1.separation}` }}>
                    <td colSpan={3} style={{ ...DS.td, fontWeight: 800, fontSize: 13, color: V1.texte }}>TOTAL ({kpi.nbAvecDonnees} facturé{kpi.nbAvecDonnees !== 1 ? 's' : ''})</td>
                    <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte, 800) }}>{fmt(kpi.caTotal)}</td>
                    <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte, 800) }}>{fmt(kpi.coutsTotal)}</td>
                    <td style={{ ...DS.td, textAlign: 'right', ...mono(13, kpi.margeTotal >= 0 ? V1.ok : V1.danger, 800) }}>
                      {fmt(kpi.margeTotal)}
                    </td>
                    <td style={DS.td}>
                      {kpi.margePct !== null && (() => {
                        const st = statutMarge(kpi.margePct);
                        return (
                          <span style={{ ...mono(12, st.color, 800), background: st.bg, borderRadius: 6, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {Math.round(kpi.margePct * 10) / 10}%
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ ...DS.td, textAlign: 'right', ...mono(13, kpi.aFacturerTotal > 0 ? V1.warn : V1.texteMuted, 800) }}>
                      {kpi.aFacturerTotal > 0 ? `CHF ${fmtN(Math.round(kpi.aFacturerTotal))}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
