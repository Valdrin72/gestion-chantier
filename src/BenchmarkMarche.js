import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { useApp } from './context/AppContext';
import { fmtN, calculerCoutsChantier, calculerCA, SEUILS } from './donnees';
import { V1, BADGES_V1, mono, carteV1 } from './design/v1';

const STATUTS_TERMINES = ['terminé', 'facturé', 'clôturé'];
const isTermine = c => STATUTS_TERMINES.includes(c.statut?.trim().toLowerCase());

function BadgeMarge({ pct }) {
  if (pct === null || isNaN(pct)) return <span style={{ color: V1.texteMuted }}>—</span>;
  const couleur = pct >= SEUILS.margeRentable ? V1.ok : pct >= SEUILS.margeLimite ? V1.warn : V1.danger;
  const bg = pct >= SEUILS.margeRentable ? BADGES_V1.ok.bg : pct >= SEUILS.margeLimite ? BADGES_V1.warn.bg : BADGES_V1.danger.bg;
  return (
    <span style={{ ...mono(12, couleur, 700), background: bg, border: `1px solid ${couleur}30`, borderRadius: 20, padding: '2px 10px' }}>
      {pct >= 0 ? '+' : ''}{Math.round(pct * 10) / 10}%
    </span>
  );
}


export default function BenchmarkMarche({ chantiers = [], devis = [], parametres = {}, agentData = {} }) {
  const { pointages = [] } = useApp();
  const [vue, setVue] = useState('type'); // 'type' | 'client' | 'taille'
  const [triBenchmark, setTriBenchmark] = useState('marge'); // 'marge' | 'ca' | 'nb'

  const termines = useMemo(() => chantiers.filter(isTermine), [chantiers]);

  // ── Benchmark par type de travaux ──
  const benchmarkType = useMemo(() => {
    const map = {};
    termines.forEach(c => {
      const ca = calculerCA(c, devis);
      if (!ca) return;
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
      const types = c.typesTravaux?.length > 0 ? c.typesTravaux : [c.typeChantier || 'Non classifié'];
      types.forEach(t => {
        if (!t) return;
        if (!map[t]) map[t] = { nom: t, chantiers: [], caTotal: 0, coutTotal: 0 };
        map[t].chantiers.push(c);
        map[t].caTotal += ca;
        map[t].coutTotal += couts.totalCoutsReel || 0;
      });
    });
    return Object.values(map).map(g => {
      const marge = g.caTotal > 0 ? ((g.caTotal - g.coutTotal) / g.caTotal) * 100 : null;
      const marges = g.chantiers.map(c => {
        const co = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
        return co.margeActuellePct;
      }).filter(m => m !== null && !isNaN(m));
      const margeMediane = marges.length > 0
        ? [...marges].sort((a, b) => a - b)[Math.floor(marges.length / 2)]
        : null;
      const caMin = Math.min(...g.chantiers.map(c => calculerCA(c, devis) || 0));
      const caMax = Math.max(...g.chantiers.map(c => calculerCA(c, devis) || 0));
      return { ...g, marge, margeMediane, caMin, caMax, nbChantiers: g.chantiers.length };
    });
  }, [termines, devis, parametres, pointages]);

  // ── Benchmark par client ──
  const benchmarkClient = useMemo(() => {
    const map = {};
    termines.forEach(c => {
      const ca = calculerCA(c, devis);
      if (!ca) return;
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
      const key = String(c.clientId || 'Inconnu');
      if (!map[key]) map[key] = { clientId: c.clientId, chantiers: [], caTotal: 0, coutTotal: 0 };
      map[key].chantiers.push(c);
      map[key].caTotal += ca;
      map[key].coutTotal += couts.totalCoutsReel || 0;
    });
    return Object.values(map).map(g => {
      const marge = g.caTotal > 0 ? ((g.caTotal - g.coutTotal) / g.caTotal) * 100 : null;
      return { ...g, marge, nbChantiers: g.chantiers.length };
    });
  }, [termines, devis, parametres, pointages]);

  // ── Benchmark par taille ──
  const benchmarkTaille = useMemo(() => {
    const buckets = {
      'Petit (< 20k)': { min: 0, max: 20000 },
      'Moyen (20–80k)': { min: 20000, max: 80000 },
      'Grand (80–200k)': { min: 80000, max: 200000 },
      'Très grand (> 200k)': { min: 200000, max: Infinity },
    };
    const map = {};
    Object.keys(buckets).forEach(k => { map[k] = { nom: k, chantiers: [], caTotal: 0, coutTotal: 0 }; });
    termines.forEach(c => {
      const ca = calculerCA(c, devis);
      if (!ca) return;
      const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
      const bucket = Object.entries(buckets).find(([, r]) => ca >= r.min && ca < r.max);
      if (!bucket) return;
      map[bucket[0]].chantiers.push(c);
      map[bucket[0]].caTotal += ca;
      map[bucket[0]].coutTotal += couts.totalCoutsReel || 0;
    });
    return Object.values(map).filter(g => g.chantiers.length > 0).map(g => {
      const marge = g.caTotal > 0 ? ((g.caTotal - g.coutTotal) / g.caTotal) * 100 : null;
      return { ...g, marge, nbChantiers: g.chantiers.length };
    });
  }, [termines, devis, parametres, pointages]);

  const donneesActives = (vue === 'type' ? benchmarkType : vue === 'client' ? benchmarkClient : benchmarkTaille)
    .sort((a, b) => {
      if (triBenchmark === 'marge') return (b.marge ?? -999) - (a.marge ?? -999);
      if (triBenchmark === 'ca') return b.caTotal - a.caTotal;
      return b.nbChantiers - a.nbChantiers;
    });

  const meilleurMarge = Math.max(...donneesActives.map(d => d.marge ?? -999));
  const piresMarge = Math.min(...donneesActives.map(d => d.marge ?? 999));

  if (termines.length === 0) {
    return (
      <div style={{ ...carteV1, textAlign: 'center', padding: '60px 40px', color: V1.texteMuted }}>
        <TrendingUp size={40} strokeWidth={1.2} style={{ opacity: 0.3, marginBottom: 16 }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: V1.texte }}>Aucun chantier terminé</div>
        <div style={{ fontSize: 13 }}>Le benchmark s'affiche après la clôture de vos premiers chantiers</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div className="page-title-block">
          <div className="page-title-main">Benchmark Interne</div>
          <div className="page-title-sub">Comparaison de performance basée sur {termines.length} chantier{termines.length > 1 ? 's' : ''} terminé{termines.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* KPIs résumé — cartes v1 sobres */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Chantiers analysés', val: termines.length, couleur: V1.bleu },
          { label: 'CA total réalisé', val: `CHF ${fmtN(Math.round(termines.reduce((s, c) => s + (calculerCA(c, devis) || 0), 0) / 1000))}k`, couleur: V1.ok },
          { label: 'Marge max (type)', val: meilleurMarge > -999 ? `${Math.round(meilleurMarge * 10) / 10}%` : '—', couleur: V1.ok },
          { label: 'Marge min (type)', val: piresMarge < 999 ? `${Math.round(piresMarge * 10) / 10}%` : '—', couleur: piresMarge < 0 ? V1.danger : V1.warn },
        ].map(k => (
          <div key={k.label} style={{ ...carteV1, borderTop: `3px solid ${k.couleur}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: V1.texteMuted, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ ...mono(20, k.couleur, 700) }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Contrôles — pastilles v1 (actif bleu CYNA plein), défilables sur mobile */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {[
            { id: 'type', label: 'Par type de travaux' },
            { id: 'client', label: 'Par client' },
            { id: 'taille', label: 'Par taille' },
          ].map(v => (
            <button key={v.id} onClick={() => setVue(v.id)}
              style={{ borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                background: vue === v.id ? V1.bleu : 'transparent',
                color: vue === v.id ? '#fff' : V1.texteMuted,
                borderColor: vue === v.id ? V1.bleu : V1.separation }}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: V1.texteMuted }}>Trier par :</span>
          {[{ id: 'marge', label: 'Marge' }, { id: 'ca', label: 'CA' }, { id: 'nb', label: 'Nb chantiers' }].map(t => (
            <button key={t.id} onClick={() => setTriBenchmark(t.id)}
              style={{ borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', whiteSpace: 'nowrap',
                background: triBenchmark === t.id ? V1.bleuFond : 'transparent',
                color: triBenchmark === t.id ? V1.bleu : V1.texteMuted,
                borderColor: triBenchmark === t.id ? V1.bleu + '55' : V1.separation }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau — v1 (défilable sur mobile) */}
      <div style={{ ...carteV1, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: V1.page, borderBottom: `1px solid ${V1.separation}` }}>
              {[
                { label: vue === 'type' ? 'Type de travaux' : vue === 'client' ? 'Client' : 'Taille', align: 'left' },
                { label: 'Nb chantiers', align: 'center' },
                { label: 'CA total', align: 'right' },
                { label: 'CA moyen', align: 'right' },
                { label: 'Marge globale', align: 'center' },
                { label: 'Performance', align: 'center' },
              ].map(h => (
                <th key={h.label} style={{ padding: '10px 14px', textAlign: h.align, fontWeight: 700, fontSize: 10, color: V1.texteMuted, textTransform: 'uppercase' }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donneesActives.map((g, i) => {
              const estMeilleur = g.marge === meilleurMarge && meilleurMarge > -999;
              const estPire = g.marge === piresMarge && piresMarge < 999 && donneesActives.length > 1;
              const caMoyen = g.nbChantiers > 0 ? g.caTotal / g.nbChantiers : 0;
              const label = vue === 'client'
                ? (g.chantiers[0]?.clientNom || `Client #${g.clientId}`)
                : g.nom;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${V1.separation}`, background: estMeilleur ? V1.ok + '0d' : estPire ? V1.danger + '0d' : 'transparent' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: V1.texte }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {estMeilleur && <Award size={14} color={V1.warn} title="Meilleur type" />}
                      {estPire && <AlertTriangle size={14} color={V1.warn} title="À améliorer" />}
                      {label}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ ...mono(12, V1.texte, 700), background: V1.bleuFond, borderRadius: 20, padding: '2px 10px' }}>{g.nbChantiers}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', ...mono(13, V1.texte, 700) }}>CHF {fmtN(Math.round(g.caTotal))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', ...mono(13, V1.texteMuted) }}>CHF {fmtN(Math.round(caMoyen))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <BadgeMarge pct={g.marge} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {g.marge >= SEUILS.margeRentable ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: V1.ok }}><CheckCircle size={12} /> Rentable</span>
                    ) : g.marge >= SEUILS.margeLimite ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: V1.warn }}><AlertTriangle size={12} /> Limite</span>
                    ) : g.marge !== null ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: V1.danger }}><TrendingDown size={12} /> Non rentable</span>
                    ) : <span style={{ color: V1.texteMuted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Insight automatique — encarts v1 (empilés sur mobile) */}
      {donneesActives.length >= 2 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {donneesActives[0]?.marge !== null && (
            <div style={{ padding: '14px 16px', background: BADGES_V1.ok.bg, border: `1px solid ${V1.ok}44`, borderLeft: `4px solid ${V1.ok}`, borderRadius: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: V1.ok, marginBottom: 4 }}><Lightbulb size={13} /> Type le plus rentable</div>
              <div style={{ color: V1.texte }}><strong>{donneesActives[0].nom}</strong> — marge de {Math.round(donneesActives[0].marge * 10) / 10}% sur {donneesActives[0].nbChantiers} chantier{donneesActives[0].nbChantiers > 1 ? 's' : ''}. Priorisez ce type de contrat.</div>
            </div>
          )}
          {donneesActives[donneesActives.length - 1]?.marge !== null && donneesActives[donneesActives.length - 1].marge < SEUILS.margeRentable && (
            <div style={{ padding: '14px 16px', background: BADGES_V1.warn.bg, border: `1px solid ${V1.warn}44`, borderLeft: `4px solid ${V1.warn}`, borderRadius: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: V1.warn, marginBottom: 4 }}><TrendingDown size={13} /> Type à améliorer</div>
              <div style={{ color: V1.texte }}><strong>{donneesActives[donneesActives.length - 1].nom}</strong> — marge de {Math.round(donneesActives[donneesActives.length - 1].marge * 10) / 10}%. Revoir le pricing ou réduire les coûts sur ces chantiers.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
