import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DS } from './ds';
import { calculerCoutsChantier, fmtN } from './donnees';
import KpiCard from './components/ui/KpiCard';

const seuils = { bon: 20, ok: 10 };

function statutMarge(pct) {
  if (pct === null) return { label: 'N/D', bg: '#F1F5F9', color: '#94A3B8', Icon: Minus };
  if (pct >= seuils.bon) return { label: `${pct.toFixed(1)}%`, bg: '#D1FAE5', color: '#065F46', Icon: TrendingUp };
  if (pct >= seuils.ok)  return { label: `${pct.toFixed(1)}%`, bg: '#FEF3C7', color: '#92400E', Icon: Minus };
  return { label: `${pct.toFixed(1)}%`, bg: '#FEE2E2', color: '#991B1B', Icon: TrendingDown };
}

export default function Marges({ chantiers = [], clients = [], devis = [], parametres = {} }) {
  const rows = useMemo(() => {
    return chantiers
      .map(c => {
        const couts = calculerCoutsChantier(
          c,
          parametres.employes,
          parametres.localites,
          parametres.parametres,
          devis
        );
        const client = clients.find(cl => String(cl.id) === String(c.clientId));
        const hasCa    = couts.montantTotal > 0;
        const hasCouts = couts.totalCoutsReel > 0;
        return {
          id: c.id,
          nom: c.nom || c.numero,
          statut: c.statut || '—',
          client: client?.nom || '—',
          ca: hasCa ? couts.montantTotal : null,
          coutsReel: hasCouts ? couts.totalCoutsReel : null,
          coutsPrevu: couts.totalCoutsPrevu > 0 ? couts.totalCoutsPrevu : null,
          margeReel: hasCa && hasCouts ? couts.margeReel : null,
          margeReelPct: hasCa && hasCouts ? parseFloat(couts.margeReelPct) : null,
          margePrevu: hasCa && couts.totalCoutsPrevu > 0 ? couts.margePrevu : null,
          margePrevuPct: hasCa && couts.totalCoutsPrevu > 0 ? parseFloat(couts.margePrevuPct) : null,
        };
      })
      .sort((a, b) => {
        // Trier : données dispo d'abord, puis par marge croissante (problèmes en haut)
        if (a.margeReelPct === null && b.margeReelPct !== null) return 1;
        if (a.margeReelPct !== null && b.margeReelPct === null) return -1;
        if (a.margeReelPct === null && b.margeReelPct === null) return 0;
        return a.margeReelPct - b.margeReelPct;
      });
  }, [chantiers, clients, devis, parametres]);

  const kpi = useMemo(() => {
    const avecDonnees = rows.filter(r => r.ca !== null && r.coutsReel !== null);
    const caTotal = avecDonnees.reduce((s, r) => s + r.ca, 0);
    const coutsTotal = avecDonnees.reduce((s, r) => s + r.coutsReel, 0);
    const margeTotal = caTotal - coutsTotal;
    const margePct = caTotal > 0 ? (margeTotal / caTotal) * 100 : null;
    const nbRouge = avecDonnees.filter(r => r.margeReelPct < seuils.ok).length;
    const nbVert  = avecDonnees.filter(r => r.margeReelPct >= seuils.bon).length;
    return { caTotal, coutsTotal, margeTotal, margePct, nbRouge, nbVert, nbAvecDonnees: avecDonnees.length };
  }, [rows]);

  const fmt = (v) => v !== null ? `CHF ${fmtN(Math.round(v))}` : '—';

  const kpiColor = kpi.margePct === null ? DS.kpi.blue
    : kpi.margePct >= seuils.bon ? DS.kpi.green
    : kpi.margePct >= seuils.ok  ? DS.kpi.amber
    : DS.kpi.red;

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Marges par chantier</div>
          <div className="page-title-sub">
            {kpi.nbAvecDonnees} chantier{kpi.nbAvecDonnees !== 1 ? 's' : ''} analysé{kpi.nbAvecDonnees !== 1 ? 's' : ''}
            {kpi.nbRouge > 0 && ` · ${kpi.nbRouge} sous le seuil`}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="CA TOTAL" value={fmt(kpi.caTotal)} {...DS.kpi.blue} />
        <KpiCard label="COÛTS RÉELS" value={fmt(kpi.coutsTotal)} {...DS.kpi.amber} />
        <KpiCard label="MARGE TOTALE" value={fmt(kpi.margeTotal)}
          {...(kpi.margeTotal >= 0 ? DS.kpi.green : DS.kpi.red)} />
        <KpiCard label="MARGE MOYENNE"
          value={kpi.margePct !== null ? `${kpi.margePct.toFixed(1)}%` : '—'}
          badge={kpi.nbRouge > 0 ? `${kpi.nbRouge} critique${kpi.nbRouge > 1 ? 's' : ''}` : kpi.nbVert > 0 ? `${kpi.nbVert} rentable${kpi.nbVert > 1 ? 's' : ''}` : null}
          {...kpiColor} />
      </div>

      {/* Légende seuils */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { bg: '#D1FAE5', color: '#065F46', label: `Rentable ≥ ${seuils.bon}%` },
          { bg: '#FEF3C7', color: '#92400E', label: `Correct ${seuils.ok}–${seuils.bon}%` },
          { bg: '#FEE2E2', color: '#991B1B', label: `Critique < ${seuils.ok}%` },
          { bg: '#F1F5F9', color: '#94A3B8', label: 'Données manquantes' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: `1px solid ${s.color}40` }} />
            <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div style={DS.card}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <TrendingUp size={40} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun chantier</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['CHANTIER', 'CLIENT', 'STATUT', 'CA DEVIS', 'COÛTS RÉELS', 'MARGE CHF', 'MARGE %', 'MARGE PRÉV.'].map(h => (
                    <th key={h} style={{ ...DS.th, textAlign: ['CA DEVIS','COÛTS RÉELS','MARGE CHF'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const sm = statutMarge(r.margeReelPct);
                  const sp = statutMarge(r.margePrevuPct);
                  const bs = DS.statuts[r.statut] || { bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr key={r.id} style={{ background: r.margeReelPct !== null && r.margeReelPct < seuils.ok ? `${sm.bg}44` : 'transparent' }}>
                      <td style={{ ...DS.td, fontWeight: 700 }}>{r.nom}</td>
                      <td style={{ ...DS.td, color: 'var(--text-secondary)' }}>{r.client}</td>
                      <td style={DS.td}>
                        <span style={{ background: bs.bg, color: bs.color, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                          {r.statut}
                        </span>
                      </td>
                      <td style={{ ...DS.td, textAlign: 'right', fontWeight: 600 }}>{fmt(r.ca)}</td>
                      <td style={{ ...DS.td, textAlign: 'right' }}>{fmt(r.coutsReel)}</td>
                      <td style={{ ...DS.td, textAlign: 'right', fontWeight: 700, color: r.margeReel === null ? 'var(--text-muted)' : r.margeReel >= 0 ? '#065F46' : '#991B1B' }}>
                        {r.margeReel !== null ? `CHF ${fmtN(Math.round(r.margeReel))}` : '—'}
                      </td>
                      <td style={DS.td}>
                        {r.margeReelPct !== null ? (
                          <span style={{ background: sm.bg, color: sm.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <sm.Icon size={11} strokeWidth={2.5} />
                            {sm.label}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={DS.td}>
                        {r.margePrevuPct !== null ? (
                          <span style={{ background: sp.bg, color: sp.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                            {sp.label}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne total */}
              {kpi.nbAvecDonnees > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--bg-glass)', borderTop: '2px solid var(--ds-card-border)' }}>
                    <td colSpan={3} style={{ ...DS.td, fontWeight: 800, fontSize: 13 }}>TOTAL ({kpi.nbAvecDonnees} chantiers)</td>
                    <td style={{ ...DS.td, textAlign: 'right', fontWeight: 800 }}>{fmt(kpi.caTotal)}</td>
                    <td style={{ ...DS.td, textAlign: 'right', fontWeight: 800 }}>{fmt(kpi.coutsTotal)}</td>
                    <td style={{ ...DS.td, textAlign: 'right', fontWeight: 900, color: kpi.margeTotal >= 0 ? '#065F46' : '#991B1B' }}>
                      {fmt(kpi.margeTotal)}
                    </td>
                    <td style={DS.td}>
                      {kpi.margePct !== null && (
                        <span style={{ ...statutMarge(kpi.margePct), borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {kpi.margePct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td style={DS.td} />
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
