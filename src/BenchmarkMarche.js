import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { DS } from './ds';
import { useApp } from './context/AppContext';
import { fmtN, calculerCoutsChantier, calculerCA, SEUILS } from './donnees';

const STATUTS_TERMINES = ['terminé', 'facturé', 'clôturé'];
const isTermine = c => STATUTS_TERMINES.includes(c.statut?.trim().toLowerCase());

function BadgeMarge({ pct }) {
  if (pct === null || isNaN(pct)) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const couleur = pct >= SEUILS.margeRentable ? '#10b981' : pct >= SEUILS.margeLimite ? '#f59e0b' : '#ef4444';
  const bg = pct >= SEUILS.margeRentable ? '#f0fdf4' : pct >= SEUILS.margeLimite ? '#fffbeb' : '#fef2f2';
  return (
    <span style={{ background: bg, color: couleur, border: `1px solid ${couleur}30`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
      <div style={{ ...DS.card, textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
        <TrendingUp size={40} strokeWidth={1.2} style={{ opacity: 0.3, marginBottom: 16 }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Aucun chantier terminé</div>
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

      {/* KPIs résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Chantiers analysés', val: termines.length, couleur: '#0d3d6e' },
          { label: 'CA total réalisé', val: `CHF ${fmtN(Math.round(termines.reduce((s, c) => s + (calculerCA(c, devis) || 0), 0) / 1000))}k`, couleur: '#10b981' },
          { label: 'Marge max (type)', val: meilleurMarge > -999 ? `${Math.round(meilleurMarge * 10) / 10}%` : '—', couleur: '#10b981' },
          { label: 'Marge min (type)', val: piresMarge < 999 ? `${Math.round(piresMarge * 10) / 10}%` : '—', couleur: piresMarge < 0 ? '#ef4444' : '#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ ...DS.card, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: k.couleur }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'type', label: 'Par type de travaux' },
            { id: 'client', label: 'Par client' },
            { id: 'taille', label: 'Par taille' },
          ].map(v => (
            <button key={v.id} onClick={() => setVue(v.id)}
              style={{ borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', transition: 'all 0.15s',
                background: vue === v.id ? '#4f46e5' : 'transparent',
                color: vue === v.id ? 'white' : 'var(--text-muted)',
                borderColor: vue === v.id ? '#4f46e5' : 'var(--border)' }}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trier par :</span>
          {[{ id: 'marge', label: 'Marge' }, { id: 'ca', label: 'CA' }, { id: 'nb', label: 'Nb chantiers' }].map(t => (
            <button key={t.id} onClick={() => setTriBenchmark(t.id)}
              style={{ borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
                background: triBenchmark === t.id ? '#f1f5f9' : 'transparent',
                color: triBenchmark === t.id ? '#1e293b' : 'var(--text-muted)',
                borderColor: triBenchmark === t.id ? '#cbd5e1' : 'var(--border)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div style={{ ...DS.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-glass)', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: vue === 'type' ? 'Type de travaux' : vue === 'client' ? 'Client' : 'Taille', align: 'left' },
                { label: 'Nb chantiers', align: 'center' },
                { label: 'CA total', align: 'right' },
                { label: 'CA moyen', align: 'right' },
                { label: 'Marge globale', align: 'center' },
                { label: 'Performance', align: 'center' },
              ].map(h => (
                <th key={h.label} style={{ padding: '10px 14px', textAlign: h.align, fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h.label}</th>
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
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: estMeilleur ? '#f0fdf440' : estPire ? '#fef2f240' : 'transparent' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {estMeilleur && <Award size={14} color="#f59e0b" title="Meilleur type" />}
                      {estPire && <AlertTriangle size={14} color="#f59e0b" title="À améliorer" />}
                      {label}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ background: 'var(--bg-glass)', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{g.nbChantiers}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>CHF {fmtN(Math.round(g.caTotal))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>CHF {fmtN(Math.round(caMoyen))}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <BadgeMarge pct={g.marge} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {g.marge >= SEUILS.margeRentable ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#10b981' }}><CheckCircle size={12} /> Rentable</span>
                    ) : g.marge >= SEUILS.margeLimite ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f59e0b' }}><AlertTriangle size={12} /> Limite</span>
                    ) : g.marge !== null ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#ef4444' }}><TrendingDown size={12} /> Non rentable</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Insight automatique */}
      {donneesActives.length >= 2 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {donneesActives[0]?.marge !== null && (
            <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#15803d', marginBottom: 4 }}><Lightbulb size={13} /> Type le plus rentable</div>
              <div style={{ color: '#166534' }}><strong>{donneesActives[0].nom}</strong> — marge de {Math.round(donneesActives[0].marge * 10) / 10}% sur {donneesActives[0].nbChantiers} chantier{donneesActives[0].nbChantiers > 1 ? 's' : ''}. Priorisez ce type de contrat.</div>
            </div>
          )}
          {donneesActives[donneesActives.length - 1]?.marge !== null && donneesActives[donneesActives.length - 1].marge < SEUILS.margeRentable && (
            <div style={{ padding: '14px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#92400e', marginBottom: 4 }}><TrendingDown size={13} /> Type à améliorer</div>
              <div style={{ color: '#78350f' }}><strong>{donneesActives[donneesActives.length - 1].nom}</strong> — marge de {Math.round(donneesActives[donneesActives.length - 1].marge * 10) / 10}%. Revoir le pricing ou réduire les coûts sur ces chantiers.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
