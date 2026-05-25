import React, { useState, useMemo } from 'react';
import {
  Calculator, UserCog, Percent, FileText, Calendar,
  TrendingUp, Banknote, Target, Users, Plus, Trash2,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { DS } from '../ds';

// ─── CONSTANTES MÉTIER ───────────────────────────────────────────────────────

const PARAMS = {
  TVA: 0.081,
  COEFF_ACHAT_MAT: 1.20,
  HEURES_PROD_AN: 1700,
  CHARGES_SOCIALES: 0.16,
  DSO_CIBLE: 45,
};

// ─── FONCTIONS PURES ─────────────────────────────────────────────────────────

function fmtCHF(n) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const s = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return (n < 0 ? '-' : '') + 'CHF ' + s;
}

function fmtPct(v, dec = 1) {
  return (v * 100).toFixed(dec) + '%';
}

function fmtJ(j) {
  if (!isFinite(j) || j <= 0) return '0 j';
  if (j < 1) return Math.round(j * 8) + ' h';
  if (j < 5) return j.toFixed(1) + ' j';
  const sem = j / 5;
  if (sem < 4) return sem.toFixed(1) + ' sem';
  return (sem / 4).toFixed(1) + ' mois';
}

function calculerCHR({ salaire, tauxCharges, indirects, heuresProd }) {
  const treizieme = salaire / 12;
  const brut13 = salaire + treizieme;
  const charges = brut13 * tauxCharges;
  const total = brut13 + charges + indirects;
  const chr = heuresProd > 0 ? total / heuresProd : 0;
  return { total, chr, coutJour: chr * 8, treizieme, charges };
}

function tauxMarque(pv, cout) { return pv > 0 ? (pv - cout) / pv : 0; }
function tauxMarge(pv, cout) { return cout > 0 ? (pv - cout) / cout : 0; }
function coeffVente(marque) { return marque < 1 ? 1 / (1 - marque) : null; }
function pvDepuisMarque(cout, marque) {
  const k = coeffVente(marque);
  return k !== null ? cout * k : null;
}

function pricingPoste({ qte, coutMatUnit, tempsH, coutHMO, coeffMat, marqueMatPct, marqueMOPct }) {
  const coutMat = qte * coutMatUnit * coeffMat;
  const coutMO = qte * tempsH * coutHMO;
  const total = coutMat + coutMO;
  const pvMat = coutMat * (coeffVente(marqueMatPct / 100) || 1);
  const pvMO = coutMO * (coeffVente(marqueMOPct / 100) || 1);
  const pvHT = pvMat + pvMO;
  const marge = pvHT > 0 ? (pvHT - total) / pvHT : 0;
  return { coutMat, coutMO, total, pvMat, pvMO, pvHT, marge };
}

function calculerEVM({ budget, tempsEcoule, travauxRealises, coutsEngages }) {
  const PV = (tempsEcoule / 100) * budget;
  const EV = (travauxRealises / 100) * budget;
  const AC = coutsEngages;
  const CPI = AC > 0 ? EV / AC : 1;
  const SPI = PV > 0 ? EV / PV : 1;
  const EAC = CPI > 0 ? budget / CPI : Infinity;
  const ETC = EAC - AC;
  let statut = 'OK';
  if (CPI < 0.9 || SPI < 0.85) statut = 'CRITIQUE';
  else if (CPI < 1 || SPI < 1) statut = 'VIGILANCE';
  return { PV, EV, AC, CPI, SPI, EAC, ETC, statut };
}

function calculerDSO(creances, ca, jours) {
  return ca > 0 ? (creances / ca) * jours : 0;
}

function calculerBFR({ creances, stocks, tec, dettes, acomptes }) {
  return creances + stocks + tec - dettes - acomptes;
}

function interetsMoratoires(montant, joursRetard) {
  return montant * 0.05 * joursRetard / 360;
}

function seuilRentabilite(fixe, tauxMB) {
  return tauxMB > 0 ? fixe / (tauxMB / 100) : Infinity;
}

function scoreClient(historique) {
  if (!historique.length) return { retard: 0, score: 50, cat: 'standard', acompte: 0.30 };
  const totalMt = historique.reduce((s, p) => s + p.montant, 0);
  const retardPond = historique.reduce((s, p) => s + Math.max(0, p.retard) * p.montant, 0);
  const retard = totalMt > 0 ? retardPond / totalMt : 0;
  const score = Math.max(0, Math.min(100, 100 - retard * 2));
  let cat, acompte;
  if (score >= 80) { cat = 'Fiable';    acompte = 0.20; }
  else if (score >= 60) { cat = 'Standard'; acompte = 0.30; }
  else if (score >= 40) { cat = 'Lent';     acompte = 0.40; }
  else                  { cat = 'Risque';   acompte = 0.50; }
  return { retard, score, cat, acompte };
}

// ─── COMPOSANTS UI INTERNES ───────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ ...DS.card, marginBottom: 0, ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ Icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
      {Icon && (
        <div style={{
          background: 'rgba(13,61,110,0.08)', borderRadius: 10, padding: 8,
          color: '#0d3d6e', display: 'flex', flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix, type = 'number', step, min, max }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type={type}
          value={value ?? ''}
          step={step}
          min={min}
          max={max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            ...DS.input,
            flex: 1,
            fontSize: 13,
            padding: '7px 10px',
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Grid({ cols = 2, gap = 12, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap,
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, hint, variant = 'default', size = 'md' }) {
  const colors = {
    default: 'var(--text-primary)',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };
  const sizes = { sm: 16, md: 22, lg: 28 };
  return (
    <div style={{
      ...DS.cardInset,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: sizes[size], fontWeight: 700, color: colors[variant], fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── ONGLET 1 — PRICING DEVIS ────────────────────────────────────────────────

const POSTE_VIDE = id => ({
  id, designation: '', qte: 0, coutMatUnit: 0,
  tempsH: 0, coutHMO: 45, coeffMat: 1.20,
  marqueMatPct: 22, marqueMOPct: 5,
});

function TabPricing() {
  const [postes, setPostes] = useState([
    { id: '1', designation: 'Faux-plancher technique h=200mm', qte: 300, coutMatUnit: 110, tempsH: 0.35, coutHMO: 45, coeffMat: 1.20, marqueMatPct: 22, marqueMOPct: 5 },
  ]);

  const calcules = useMemo(() => postes.map(p => ({ ...p, ...pricingPoste(p) })), [postes]);
  const totalHT = calcules.reduce((s, p) => s + p.pvHT, 0);
  const coutTotal = calcules.reduce((s, p) => s + p.total, 0);
  const margeGlobale = totalHT > 0 ? (totalHT - coutTotal) / totalHT : 0;

  function upd(id, k, v) {
    setPostes(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p));
  }

  return (
    <Card>
      <CardHeader Icon={FileText} title="Pricing de devis" subtitle="Décomposition par poste — matériaux + main d'œuvre + marges" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {postes.map((p, i) => {
          const r = calcules[i];
          return (
            <div key={p.id} style={{ ...DS.cardInset, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Poste {i + 1}
                </span>
                {postes.length > 1 && (
                  <button
                    onClick={() => setPostes(ps => ps.filter(x => x.id !== p.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={p.designation}
                onChange={e => upd(p.id, 'designation', e.target.value)}
                placeholder="Désignation du poste..."
                style={{ ...DS.input, width: '100%', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                <Field label="Quantité" value={p.qte} onChange={v => upd(p.id, 'qte', v)} />
                <Field label="Coût mat." suffix="CHF/u" value={p.coutMatUnit} onChange={v => upd(p.id, 'coutMatUnit', v)} />
                <Field label="Temps unit." suffix="h/u" value={p.tempsH} step="0.01" onChange={v => upd(p.id, 'tempsH', v)} />
                <Field label="CHR MO" suffix="CHF/h" value={p.coutHMO} onChange={v => upd(p.id, 'coutHMO', v)} />
                <Field label="Coeff. achat" value={p.coeffMat} step="0.05" onChange={v => upd(p.id, 'coeffMat', v)} />
                <Field label="Marque mat." suffix="%" value={p.marqueMatPct} onChange={v => upd(p.id, 'marqueMatPct', v)} />
              </div>
              {r.pvHT > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>PV HT : <strong>{fmtCHF(r.pvHT)}</strong></span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Marge : <strong style={{ color: r.marge >= 0.25 ? '#10b981' : r.marge >= 0.15 ? '#f59e0b' : '#ef4444' }}>{fmtPct(r.marge)}</strong></span>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setPostes(ps => [...ps, POSTE_VIDE(String(Date.now()))])}
          style={{ ...DS.btnGhost, alignSelf: 'flex-start' }}
        >
          <Plus size={14} /> Ajouter un poste
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 20 }}>
        <Stat label="Coût total" value={fmtCHF(coutTotal)} size="sm" />
        <Stat label="Total HT" value={fmtCHF(totalHT)} size="sm" />
        <Stat label="TVA 8.1%" value={fmtCHF(totalHT * PARAMS.TVA)} size="sm" />
        <Stat label="Total TTC" value={fmtCHF(totalHT * 1.081)} size="md" />
      </div>
      <div style={{ marginTop: 10 }}>
        <Stat
          label="Marge brute globale"
          value={`${fmtCHF(totalHT - coutTotal)} (${fmtPct(margeGlobale)})`}
          variant={margeGlobale >= 0.25 ? 'success' : margeGlobale >= 0.15 ? 'warning' : 'danger'}
          hint={margeGlobale >= 0.25 ? 'Cible CYNA atteinte (≥ 25%)' : margeGlobale >= 0.15 ? 'Sous cible — surveiller' : 'Marge insuffisante — revoir'}
          size="md"
        />
      </div>
    </Card>
  );
}

// ─── ONGLET 2 — MARGE / MARQUE ───────────────────────────────────────────────

function TabMarge() {
  const [cout, setCout] = useState(100);
  const [pv, setPv] = useState(140);
  const [marqueCible, setMarqueCible] = useState(28);

  const marqueObs = tauxMarque(pv, cout);
  const margeObs = tauxMarge(pv, cout);
  const k = coeffVente(marqueCible / 100);
  const pvCible = pvDepuisMarque(cout, marqueCible / 100);

  return (
    <Card>
      <CardHeader Icon={Percent} title="Marge vs Marque" subtitle="Le piège qui coûte le plus cher en BTP — clarifier avant de signer" />

      <Grid cols={3} gap={12}>
        <Field label="Coût" suffix="CHF" value={cout} onChange={setCout} />
        <Field label="Prix de vente" suffix="CHF" value={pv} onChange={setPv} />
        <Field label="Marque cible" suffix="%" value={marqueCible} step="0.5" onChange={setMarqueCible} />
      </Grid>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...DS.cardInset, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 10 }}>
            Résultats observés
          </div>
          <Grid cols={2} gap={10}>
            <Stat label="Taux de MARQUE (sur vente)" value={fmtPct(marqueObs)} hint="(PV − Coût) / PV" size="md" />
            <Stat label="Taux de MARGE (sur coût)" value={fmtPct(margeObs)} hint="(PV − Coût) / Coût" size="md" />
          </Grid>
        </div>

        <div style={{ background: 'rgba(13,61,110,0.04)', borderRadius: 10, padding: 14, border: '1px solid rgba(13,61,110,0.12)' }}>
          <div style={{ fontSize: 11, color: '#0d3d6e', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            À partir de la marque cible ({marqueCible}%)
          </div>
          <Grid cols={2} gap={10}>
            <Stat label="Coefficient de vente" value={k ? k.toFixed(4) : '—'} hint="k = 1 / (1 − marque)" size="md" />
            <Stat label="Prix de vente recommandé" value={pvCible !== null ? fmtCHF(pvCible) : '—'} size="md" />
          </Grid>
        </div>

        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong>Rappel :</strong> "30% de marge" peut signifier 30% du coût (PV=130) ou 30% du prix de vente (PV=142.86). La différence sur un chantier de CHF 500 000 représente CHF 6 400 d'écart.
        </div>
      </div>
    </Card>
  );
}

// ─── ONGLET 3 — CHR ──────────────────────────────────────────────────────────

function TabCHR() {
  const [salaire, setSalaire] = useState(84000);
  const [charges, setCharges] = useState(16);
  const [indirects, setIndirects] = useState(3000);
  const [heuresProd, setHeuresProd] = useState(1700);

  const r = useMemo(() => calculerCHR({
    salaire,
    tauxCharges: charges / 100,
    indirects,
    heuresProd,
  }), [salaire, charges, indirects, heuresProd]);

  const ecartTJF = r.coutJour - 450;

  return (
    <Card>
      <CardHeader Icon={UserCog} title="Coût Horaire Réel (CHR)" subtitle="Combien coûte réellement une heure productive — base du pricing MO" />

      <Grid cols={2} gap={12}>
        <Field label="Salaire brut annuel" suffix="CHF" value={salaire} onChange={setSalaire} />
        <Field label="Charges sociales" suffix="%" step="0.1" value={charges} onChange={setCharges} />
        <Field label="Coûts indirects / an" suffix="CHF" value={indirects} onChange={setIndirects} />
        <Field label="Heures productives / an" suffix="h" value={heuresProd} onChange={setHeuresProd} />
      </Grid>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="Coût total annuel" value={fmtCHF(r.total)} size="sm" />
        <Stat label="13e mois" value={fmtCHF(r.treizieme)} size="sm" />
        <Stat label="Charges sociales" value={fmtCHF(r.charges)} size="sm" />
        <Stat label="Indirects" value={fmtCHF(indirects)} size="sm" />
      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="CHR (par heure productive)" value={fmtCHF(r.chr)} size="lg" />
        <Stat
          label="Coût journalier (8 h)"
          value={fmtCHF(r.coutJour)}
          size="lg"
          variant={ecartTJF < 0 ? 'danger' : 'success'}
          hint={ecartTJF < 0
            ? `TJF chef équipe 450 CHF/j → perte ${fmtCHF(Math.abs(ecartTJF))}/j`
            : `TJF chef équipe 450 CHF/j → marge ${fmtCHF(ecartTJF)}/j`}
        />
      </div>
    </Card>
  );
}

// ─── ONGLET 4 — DURÉE CHANTIER ────────────────────────────────────────────────

const COEFFICIENTS = [
  { label: 'Grande hauteur > 4 m', v: 0.70 },
  { label: 'Très grande hauteur > 6 m', v: 0.50 },
  { label: 'Formes complexes', v: 0.70 },
  { label: 'Plénum exigu', v: 0.70 },
  { label: 'Nombreux obstacles', v: 0.80 },
  { label: 'Sol non plan', v: 0.85 },
  { label: 'Grande surface > 500 m²', v: 1.15 },
  { label: 'Équipe expérimentée', v: 1.10 },
];

function TabDuree() {
  const [qte, setQte] = useState(300);
  const [baseline, setBaseline] = useState(70);
  const [buffer, setBuffer] = useState(10);
  const [prep, setPrep] = useState(1);
  const [nettoyage, setNettoyage] = useState(0.5);
  const [actifs, setActifs] = useState(new Set());

  const { prodAjustee, dureePose, total } = useMemo(() => {
    const coeffs = Array.from(actifs).map(i => COEFFICIENTS[i].v);
    const prodAjustee = coeffs.reduce((acc, c) => acc * c, baseline);
    const dureePose = prodAjustee > 0 ? qte / prodAjustee : 0;
    const buf = dureePose * (buffer / 100);
    return { prodAjustee, dureePose, total: dureePose + prep + nettoyage + buf };
  }, [qte, baseline, buffer, prep, nettoyage, actifs]);

  return (
    <Card>
      <CardHeader Icon={Calendar} title="Durée chantier" subtitle="Productivité ajustée → durée totale avec marges opérationnelles" />

      <Grid cols={3} gap={12}>
        <Field label="Quantité" suffix="m²" value={qte} onChange={setQte} />
        <Field label="Productivité baseline" suffix="u/j" value={baseline} onChange={setBaseline} />
        <Field label="Buffer aléas" suffix="%" value={buffer} onChange={setBuffer} />
        <Field label="Préparation" suffix="j" step="0.5" value={prep} onChange={setPrep} />
        <Field label="Nettoyage / réception" suffix="j" step="0.5" value={nettoyage} onChange={setNettoyage} />
      </Grid>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
          Coefficients d'ajustement
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {COEFFICIENTS.map((c, i) => {
            const on = actifs.has(i);
            return (
              <button
                key={i}
                onClick={() => {
                  const n = new Set(actifs);
                  on ? n.delete(i) : n.add(i);
                  setActifs(n);
                }}
                style={{
                  background: on ? 'rgba(13,61,110,0.08)' : 'var(--ds-card-inset-bg)',
                  border: `1px solid ${on ? '#0d3d6e' : 'var(--ds-card-inset-border)'}`,
                  borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.14s',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: on ? '#0d3d6e' : 'var(--text-secondary)' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>× {c.v}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="Productivité ajustée" value={`${prodAjustee.toFixed(1)} u/j`} size="sm" />
        <Stat label="Durée pose pure" value={fmtJ(dureePose)} size="sm" />
        <Stat label="Buffer" value={fmtJ(dureePose * buffer / 100)} size="sm" />
        <Stat label="Durée totale" value={fmtJ(total)} size="md" variant="success" />
      </div>
    </Card>
  );
}

// ─── ONGLET 5 — EVM ──────────────────────────────────────────────────────────

function TabEVM() {
  const [budget, setBudget] = useState(50000);
  const [tempsEcoule, setTempsEcoule] = useState(50);
  const [travauxRealises, setTravauxRealises] = useState(40);
  const [coutsEngages, setCoutsEngages] = useState(24000);

  const r = useMemo(() => calculerEVM({ budget, tempsEcoule, travauxRealises, coutsEngages }),
    [budget, tempsEcoule, travauxRealises, coutsEngages]);

  const statutColors = { OK: '#10b981', VIGILANCE: '#f59e0b', CRITIQUE: '#ef4444' };
  const StatutIcon = r.statut === 'OK' ? CheckCircle2 : AlertTriangle;

  return (
    <Card>
      <CardHeader Icon={TrendingUp} title="EVM — Pilotage chantier en temps réel" subtitle="Earned Value Management : détecter le dépassement AVANT qu'il arrive" />

      <Grid cols={2} gap={12}>
        <Field label="Budget total" suffix="CHF" value={budget} onChange={setBudget} />
        <Field label="Coûts engagés (AC)" suffix="CHF" value={coutsEngages} onChange={setCoutsEngages} />
        <Field label="% Temps écoulé" suffix="%" min="0" max="100" value={tempsEcoule} onChange={setTempsEcoule} />
        <Field label="% Travaux réalisés" suffix="%" min="0" max="100" value={travauxRealises} onChange={setTravauxRealises} />
      </Grid>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat label="PV (planned value)" value={fmtCHF(r.PV)} size="sm" hint="Dépense prévue à ce stade" />
        <Stat label="EV (earned value)" value={fmtCHF(r.EV)} size="sm" hint="Valeur réellement créée" />
        <Stat label="AC (actual cost)" value={fmtCHF(r.AC)} size="sm" hint="Coût réel engagé" />
      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="CPI" value={r.CPI.toFixed(2)} size="sm"
          variant={r.CPI >= 1 ? 'success' : r.CPI >= 0.9 ? 'warning' : 'danger'}
          hint="≥ 1 = sous budget" />
        <Stat label="SPI" value={r.SPI.toFixed(2)} size="sm"
          variant={r.SPI >= 1 ? 'success' : r.SPI >= 0.85 ? 'warning' : 'danger'}
          hint="≥ 1 = dans les délais" />
        <Stat label="EAC (coût final estimé)" value={fmtCHF(r.EAC)} size="sm"
          variant={r.EAC <= budget ? 'success' : 'danger'} />
        <Stat label="ETC (reste à dépenser)" value={fmtCHF(r.ETC)} size="sm" />
      </div>

      <div style={{
        marginTop: 12,
        background: r.statut === 'OK' ? 'rgba(16,185,129,0.06)' : r.statut === 'VIGILANCE' ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${r.statut === 'OK' ? 'rgba(16,185,129,0.2)' : r.statut === 'VIGILANCE' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
        borderRadius: 10, padding: 14, display: 'flex', gap: 10,
      }}>
        <StatutIcon size={18} color={statutColors[r.statut]} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, color: statutColors[r.statut], fontSize: 13 }}>{r.statut}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {r.statut === 'OK' && 'Chantier conforme aux prévisions — continuer la surveillance.'}
            {r.statut === 'VIGILANCE' && 'Dérive légère détectée — identifier la cause avant la prochaine étape.'}
            {r.statut === 'CRITIQUE' && `Action requise immédiatement — dépassement projeté : ${fmtCHF(Math.max(0, r.EAC - budget))}`}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── ONGLET 6 — TRÉSORERIE ────────────────────────────────────────────────────

function TabTresorerie() {
  const [creances, setCreances] = useState(180000);
  const [caPeriode, setCaPeriode] = useState(120000);
  const [jours, setJours] = useState(30);
  const [stocks, setStocks] = useState(15000);
  const [tec, setTec] = useState(50000);
  const [dettes, setDettes] = useState(60000);
  const [acomptes, setAcomptes] = useState(30000);
  const [montantRetard, setMontantRetard] = useState(50000);
  const [joursRetard, setJoursRetard] = useState(30);

  const dso = useMemo(() => calculerDSO(creances, caPeriode, jours), [creances, caPeriode, jours]);
  const bfr = useMemo(() => calculerBFR({ creances, stocks, tec, dettes, acomptes }), [creances, stocks, tec, dettes, acomptes]);
  const interets = interetsMoratoires(montantRetard, joursRetard);

  return (
    <Card>
      <CardHeader Icon={Banknote} title="Trésorerie — DSO, BFR, intérêts moratoires" subtitle="Combien le retard de tes clients te coûte vraiment" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            DSO — Délai moyen d'encaissement
          </div>
          <Grid cols={3} gap={12}>
            <Field label="Créances clients TTC" suffix="CHF" value={creances} onChange={setCreances} />
            <Field label="CA TTC sur période" suffix="CHF" value={caPeriode} onChange={setCaPeriode} />
            <Field label="Jours dans période" suffix="j" value={jours} onChange={setJours} />
          </Grid>
          <div style={{ marginTop: 10 }}>
            <Stat label="DSO" value={`${Math.round(dso)} jours`}
              variant={dso <= PARAMS.DSO_CIBLE ? 'success' : dso <= 60 ? 'warning' : 'danger'}
              hint={`Cible CYNA : ${PARAMS.DSO_CIBLE} jours`} size="md" />
          </div>
        </section>

        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            BFR — Besoin en fonds de roulement
          </div>
          <Grid cols={2} gap={12}>
            <Field label="Stocks" suffix="CHF" value={stocks} onChange={setStocks} />
            <Field label="Travaux en cours" suffix="CHF" value={tec} onChange={setTec} />
            <Field label="Dettes fournisseurs" suffix="CHF" value={dettes} onChange={setDettes} />
            <Field label="Acomptes reçus" suffix="CHF" value={acomptes} onChange={setAcomptes} />
          </Grid>
          <div style={{ marginTop: 10 }}>
            <Stat label="BFR" value={fmtCHF(bfr)}
              variant={bfr <= 0 ? 'success' : bfr <= 100000 ? 'warning' : 'danger'}
              hint={bfr > 0 ? 'CYNA finance son cycle d\'exploitation' : 'CYNA encaisse avant de décaisser'} size="md" />
          </div>
        </section>

        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
            Intérêts moratoires (CO art. 104 — 5% l'an)
          </div>
          <Grid cols={2} gap={12}>
            <Field label="Montant en retard" suffix="CHF" value={montantRetard} onChange={setMontantRetard} />
            <Field label="Jours de retard" suffix="j" value={joursRetard} onChange={setJoursRetard} />
          </Grid>
          <div style={{ marginTop: 10 }}>
            <Stat label="Intérêts moratoires dus" value={fmtCHF(interets)}
              hint="À facturer ou à intégrer comme coût caché du retard" size="md" />
          </div>
        </section>
      </div>
    </Card>
  );
}

// ─── ONGLET 7 — SEUIL DE RENTABILITÉ ─────────────────────────────────────────

function TabSeuil() {
  const [fixe, setFixe] = useState(600000);
  const [tauxMB, setTauxMB] = useState(28);
  const [caRealise, setCaRealise] = useState(1800000);

  const sr = seuilRentabilite(fixe, tauxMB);
  const ecart = isFinite(sr) ? caRealise - sr : null;
  const jourAtteinte = isFinite(sr) && caRealise > 0 ? Math.round((sr / caRealise) * 365) : null;

  return (
    <Card>
      <CardHeader Icon={Target} title="Seuil de rentabilité" subtitle="À combien de CA tu couvres tous tes frais fixes — point mort annuel" />

      <Grid cols={3} gap={12}>
        <Field label="Frais fixes annuels" suffix="CHF" value={fixe} onChange={setFixe} />
        <Field label="Taux MB moyen" suffix="%" step="0.5" value={tauxMB} onChange={setTauxMB} />
        <Field label="CA réalisé / projeté" suffix="CHF" value={caRealise} onChange={setCaRealise} />
      </Grid>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="Seuil de rentabilité (CA annuel)" value={isFinite(sr) ? fmtCHF(sr) : '—'} size="lg" hint="Frais fixes / Taux MB" />
        <Stat
          label="Position vs seuil"
          value={ecart !== null ? (ecart >= 0 ? `+${fmtCHF(ecart)}` : fmtCHF(ecart)) : '—'}
          variant={ecart === null ? 'default' : ecart >= 0 ? 'success' : 'danger'}
          size="lg"
          hint={ecart !== null && ecart >= 0 ? `Excédent de ${fmtPct(ecart / sr)}` : undefined}
        />
      </div>

      {jourAtteinte !== null && (
        <div style={{ marginTop: 12, ...DS.cardInset, padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
          CYNA doit facturer <strong>{fmtCHF(sr / 12)}</strong> par mois pour ne pas perdre d'argent.
          {ecart >= 0
            ? <> Avec le CA projeté, le point mort est atteint le <strong style={{ color: '#10b981' }}>{jourAtteinte}e jour</strong> de l'année.</>
            : <> Avec le CA projeté, le seuil <strong style={{ color: '#ef4444' }}>n'est pas atteint</strong> — augmenter le CA ou réduire les frais fixes.</>}
        </div>
      )}
    </Card>
  );
}

// ─── ONGLET 8 — SCORE CLIENT ──────────────────────────────────────────────────

const PAIEMENT_VIDE = id => ({ id, montant: 0, retard: 0 });

function TabScoreClient() {
  const [paiements, setPaiements] = useState([
    { id: '1', montant: 12000, retard: 5 },
    { id: '2', montant: 8500, retard: 0 },
    { id: '3', montant: 25000, retard: 18 },
    { id: '4', montant: 15000, retard: 0 },
  ]);

  const r = useMemo(() => scoreClient(paiements), [paiements]);
  const catColors = { Fiable: '#10b981', Standard: 'var(--text-primary)', Lent: '#f59e0b', Risque: '#ef4444' };

  function upd(id, k, v) {
    setPaiements(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p));
  }

  return (
    <Card>
      <CardHeader Icon={Users} title="Score client" subtitle="Historique de paiement → catégorie de risque + acompte recommandé" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', padding: '0 4px' }}>
          <span>Montant facture</span><span>Jours de retard</span><span></span>
        </div>
        {paiements.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <Field label="" value={p.montant} suffix="CHF" onChange={v => upd(p.id, 'montant', v)} />
            <Field label="" value={p.retard} suffix="j" onChange={v => upd(p.id, 'retard', v)} />
            <button
              onClick={() => setPaiements(ps => ps.filter(x => x.id !== p.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '7px 8px' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setPaiements(ps => [...ps, PAIEMENT_VIDE(String(Date.now()))])}
          style={{ ...DS.btnGhost, alignSelf: 'flex-start', marginTop: 4 }}
        >
          <Plus size={14} /> Ajouter un paiement
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="Retard moyen pondéré" value={`${r.retard.toFixed(1)} j`} size="sm" />
        <Stat label="Score" value={`${Math.round(r.score)} / 100`}
          variant={r.score >= 80 ? 'success' : r.score >= 60 ? 'default' : r.score >= 40 ? 'warning' : 'danger'}
          size="sm" />
        <Stat label="Catégorie" value={r.cat}
          variant={r.cat === 'Fiable' ? 'success' : r.cat === 'Lent' ? 'warning' : r.cat === 'Risque' ? 'danger' : 'default'}
          size="sm" />
        <Stat label="Acompte recommandé" value={fmtPct(r.acompte, 0)} hint="À la signature" size="sm" />
      </div>

      <div style={{ marginTop: 12, ...DS.cardInset, padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
        {r.cat === 'Fiable' && 'Client de confiance. Conditions standards acceptables.'}
        {r.cat === 'Standard' && 'Comportement normal. Conditions standards (30 j, acompte 30%).'}
        {r.cat === 'Lent' && 'Délais récurrents. Acompte 40%, échéance ferme, relance automatique J+15.'}
        {r.cat === 'Risque' && 'Profil à risque élevé. Acompte 50%, échéancier obligatoire, ou refus du chantier.'}
      </div>
    </Card>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

const ONGLETS = [
  { id: 'pricing',  label: 'Pricing devis',      Icon: FileText,   Composant: TabPricing },
  { id: 'marge',   label: 'Marge / Marque',      Icon: Percent,    Composant: TabMarge },
  { id: 'chr',     label: 'CHR',                 Icon: UserCog,    Composant: TabCHR },
  { id: 'duree',   label: 'Durée chantier',       Icon: Calendar,   Composant: TabDuree },
  { id: 'evm',     label: 'Pilotage EVM',         Icon: TrendingUp, Composant: TabEVM },
  { id: 'treso',   label: 'Trésorerie',           Icon: Banknote,   Composant: TabTresorerie },
  { id: 'seuil',   label: 'Seuil rentabilité',   Icon: Target,     Composant: TabSeuil },
  { id: 'score',   label: 'Score client',         Icon: Users,      Composant: TabScoreClient },
];

export default function CalculsPage() {
  const [onglet, setOnglet] = useState('pricing');
  const actif = ONGLETS.find(o => o.id === onglet);
  const Composant = actif?.Composant;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'rgba(13,61,110,0.08)', borderRadius: 12, padding: 10, color: '#0d3d6e' }}>
          <Calculator size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Calculs métier CYNA
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            Pricing · Marges · CHR · EVM · Trésorerie — chaque décision avec un chiffre vérifié
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2,
        borderBottom: '1px solid var(--border-light)', marginBottom: 20,
      }}>
        {ONGLETS.map(o => {
          const on = o.id === onglet;
          return (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: '8px 8px 0 0', whiteSpace: 'nowrap',
                border: 'none', borderBottom: on ? '2px solid #0d3d6e' : '2px solid transparent',
                background: on ? 'rgba(13,61,110,0.06)' : 'transparent',
                color: on ? '#0d3d6e' : 'var(--text-tertiary)',
                fontWeight: on ? 700 : 500, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.14s', fontFamily: 'inherit',
              }}
            >
              <o.Icon size={14} />
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {Composant && <Composant />}
    </div>
  );
}
