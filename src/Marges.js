import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DS } from './ds';
import { calculerCoutsChantier, fmtN, SEUILS, getIntervallesPeriode, chantiersInPeriode, getPeriodeLabel } from './donnees';
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
  const { pointages = [] } = useApp();
  const chantiersFiltres = useMemo(() => {
    const { debut, fin } = getIntervallesPeriode(periodeGlobale);
    return chantiers.filter(c => chantiersInPeriode(c, debut, fin));
  }, [chantiers, periodeGlobale]);

  const rows = useMemo(() => {
    return chantiersFiltres
      .map(c => {
        const couts = calculerCoutsChantier(
          c,
          parametres.employes,
          parametres.localites,
          parametres.parametres,
          devis,
          pointages
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
          margeActuellePct: hasCa && hasCouts ? couts.margeActuellePct : null,
          margePrevu: hasCa && couts.totalCoutsPrevu > 0 ? couts.margePrevu : null,
          margePrevuPct: hasCa && couts.totalCoutsPrevu > 0 ? couts.margePrevuPct : null,
        };
      })
      .sort((a, b) => {
        // Trier : données dispo d'abord, puis par marge croissante (problèmes en haut)
        if (a.margeActuellePct === null && b.margeActuellePct !== null) return 1;
        if (a.margeActuellePct !== null && b.margeActuellePct === null) return -1;
        if (a.margeActuellePct === null && b.margeActuellePct === null) return 0;
        return a.margeActuellePct - b.margeActuellePct;
      });
  }, [chantiersFiltres, clients, devis, parametres, pointages]);

  const kpi = useMemo(() => {
    const avecDonnees = rows.filter(r => r.ca !== null && r.coutsReel !== null);
    const caTotal = avecDonnees.reduce((s, r) => s + r.ca, 0);
    const coutsTotal = avecDonnees.reduce((s, r) => s + r.coutsReel, 0);
    const margeTotal = caTotal - coutsTotal;
    const margePct = caTotal > 0 ? (margeTotal / caTotal) * 100 : null;
    const nbRouge = avecDonnees.filter(r => r.margeActuellePct < seuils.ok).length;
    const nbVert  = avecDonnees.filter(r => r.margeActuellePct >= seuils.bon).length;
    return { caTotal, coutsTotal, margeTotal, margePct, nbRouge, nbVert, nbAvecDonnees: avecDonnees.length };
  }, [rows]);

  const fmt = (v) => v !== null ? `CHF ${fmtN(Math.round(v))}` : '—';

  const kpiColor = kpi.margePct === null ? V1.bleu
    : kpi.margePct >= seuils.bon ? V1.ok
    : kpi.margePct >= seuils.ok  ? V1.warn
    : V1.danger;

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title-block">
          <div className="page-title-main">Marges par chantier</div>
          <div className="page-title-sub">
            {getPeriodeLabel(periodeGlobale)} · {kpi.nbAvecDonnees} chantier{kpi.nbAvecDonnees !== 1 ? 's' : ''} analysé{kpi.nbAvecDonnees !== 1 ? 's' : ''}
            {kpi.nbRouge > 0 && ` · ${kpi.nbRouge} sous le seuil`}
          </div>
        </div>
      </div>

      {/* KPI — cartes v1 sobres (liseré coloré par état) */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'CA SIGNÉ TOTAL', val: fmt(kpi.caTotal), couleur: V1.bleu },
          { label: 'COÛTS RÉELS', val: fmt(kpi.coutsTotal), couleur: V1.texteMuted },
          { label: 'MARGE TOTALE', val: fmt(kpi.margeTotal), couleur: kpi.margeTotal >= 0 ? V1.ok : V1.danger },
          { label: 'MARGE MOYENNE', val: kpi.margePct !== null ? `${Math.round(kpi.margePct * 10) / 10}%` : '—', couleur: kpiColor,
            badge: kpi.nbRouge > 0 ? `${kpi.nbRouge} critique${kpi.nbRouge > 1 ? 's' : ''}` : kpi.nbVert > 0 ? `${kpi.nbVert} rentable${kpi.nbVert > 1 ? 's' : ''}` : null },
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
                  {['CHANTIER', 'CLIENT', 'STATUT', 'CA DEVIS', 'COÛTS RÉELS', 'MARGE CHF', 'MARGE %', 'MARGE PRÉV.'].map(h => (
                    <th key={h} style={{ ...DS.th, textAlign: ['CA DEVIS','COÛTS RÉELS','MARGE CHF'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const sm = statutMarge(r.margeActuellePct);
                  const sp = statutMarge(r.margePrevuPct);
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
                      <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte, 600) }}>{fmt(r.ca)}</td>
                      <td style={{ ...DS.td, textAlign: 'right', ...mono(13, V1.texte) }}>{fmt(r.coutsReel)}</td>
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
                      <td style={DS.td}>
                        {r.margePrevuPct !== null ? (
                          <span style={{ ...mono(11, sp.color, 600), background: sp.bg, borderRadius: 6, padding: '3px 10px' }}>
                            {sp.label}
                          </span>
                        ) : <span style={{ color: V1.texteMuted, fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne total */}
              {kpi.nbAvecDonnees > 0 && (
                <tfoot>
                  <tr style={{ background: V1.page, borderTop: `2px solid ${V1.separation}` }}>
                    <td colSpan={3} style={{ ...DS.td, fontWeight: 800, fontSize: 13, color: V1.texte }}>TOTAL ({kpi.nbAvecDonnees} chantiers)</td>
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
