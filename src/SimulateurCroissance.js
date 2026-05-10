import React, { useState, useMemo } from 'react';
import { TrendingUp, Users, DollarSign, Target, Info } from 'lucide-react';
import { DS } from './ds';
import { fmtN, calculerCoutsChantier, SEUILS } from './donnees';

const JOURS_AN_SUISSE = 220; // ~46 semaines × 5j (jours ouvrables Suisse hors vacances)

function Jauge({ pct, couleur }) {
  const v = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: 8, background: 'var(--bg-glass)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${v}%`, background: couleur, borderRadius: 4, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function KpiSim({ label, value, sub, couleur = 'var(--text-primary)', icon: Icon }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ds-card-border)', borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {Icon && <Icon size={14} color={couleur} strokeWidth={2.5} />}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: couleur, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format = v => v, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 10px', borderRadius: 20 }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function SimulateurCroissance({ chantiers = [], devis = [], factures = [], parametres = {} }) {
  const employes = parametres.employes || [];
  const actifs = employes.filter(e => e.actif !== false);

  // ── Métriques de base calculées depuis les données réelles ──
  const baseMetrics = useMemo(() => {
    const terminés = chantiers.filter(c => ['terminé', 'clôturé', 'facturé'].includes(c.statut?.trim().toLowerCase()));

    // Tarif jour moyen des employés actifs
    const tarifsValides = actifs.map(e => parseFloat(e.tarifJour) || 0).filter(t => t > 0);
    const tarifMoyen = tarifsValides.length > 0
      ? Math.round(tarifsValides.reduce((s, t) => s + t, 0) / tarifsValides.length)
      : 450;

    // CA annuel réel (chantiers de l'année courante)
    const annee = new Date().getFullYear();
    const chantiersCetteAnnee = chantiers.filter(c => {
      const d = new Date(c.dateDebut || '');
      return d.getFullYear() === annee;
    });
    const devisMap = Object.fromEntries(devis.map(d => [String(d.id), d]));
    const caAnnuel = chantiersCetteAnnee.reduce((s, c) => {
      const d = devisMap[String(c.devisId)];
      return s + (parseFloat(d?.montantHT) || 0);
    }, 0);

    // Marge nette moyenne sur chantiers terminés
    let margesMoyenne = 18; // défaut BTP Genève
    if (terminés.length > 0) {
      const marges = terminés.map(c => {
        const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
        return couts.margeReelPct;
      }).filter(m => m !== null && !isNaN(m));
      if (marges.length > 0) margesMoyenne = Math.round(marges.reduce((s, m) => s + m, 0) / marges.length * 10) / 10;
    }

    // Jours facturés par employé par an (depuis le journal)
    const totalJoursJournal = chantiersCetteAnnee.reduce((s, c) => {
      return s + new Set((c.journal || []).map(e => e.date).filter(Boolean)).size;
    }, 0);
    const joursParEmploye = actifs.length > 0 ? Math.round(totalJoursJournal / actifs.length) : 0;
    const txUtilisation = joursParEmploye > 0 ? Math.min(100, Math.round(joursParEmploye / JOURS_AN_SUISSE * 100)) : 75;

    return { tarifMoyen, caAnnuel, margesMoyenne, nbEmployes: actifs.length, txUtilisation, joursParEmploye, nbChantiersAnnee: chantiersCetteAnnee.length };
  }, [chantiers, devis, parametres, actifs]);

  // ── Paramètres de simulation ──
  const [nbNouveaux, setNbNouveaux] = useState(1);
  const [tarifSim, setTarifSim] = useState(baseMetrics.tarifMoyen);
  const [txUtil, setTxUtil] = useState(baseMetrics.txUtilisation || 75);
  const [txFG, setTxFG] = useState(12); // frais généraux %

  // ── Calcul de la projection ──
  const projection = useMemo(() => {
    const joursFactures = Math.round(JOURS_AN_SUISSE * txUtil / 100);

    // Revenus additionnels (tarif est le coût chargé → CA = tarif × jours)
    const caAdditionnel = nbNouveaux * tarifSim * joursFactures;

    // Coût charges supplémentaires (frais généraux sur le CA additionnel)
    const fraisGeneraux = caAdditionnel * (txFG / 100);

    // Marge brute = CA − (coût MO inclus dans tarif + FG)
    // Le tarifJour est déjà le coût chargé employeur, donc la marge est ce qui reste après le coût MO
    // Marge brute % = marge historique de l'entreprise (incluant matériel, sous-traitance, etc.)
    const margeBrute = caAdditionnel * (baseMetrics.margesMoyenne / 100);
    const margeNette = margeBrute - fraisGeneraux;
    const margeNettePct = caAdditionnel > 0 ? Math.round(margeNette / caAdditionnel * 1000) / 10 : 0;

    // Break-even : combien de jours/an pour couvrir le coût de l'employé
    // Coût annuel employé = tarifSim × JOURS_AN_SUISSE (si 100% utilisé)
    const coutAnnuelEmploye = tarifSim * JOURS_AN_SUISSE;
    const breakEvenJours = coutAnnuelEmploye > 0 ? Math.ceil(coutAnnuelEmploye / tarifSim) : 0;
    const breakEvenMois = Math.ceil(breakEvenJours / (JOURS_AN_SUISSE / 12));

    // Projection totale entreprise
    const caTotal = baseMetrics.caAnnuel + caAdditionnel;
    const margeNetteTotal = baseMetrics.caAnnuel * (baseMetrics.margesMoyenne / 100) * (1 - txFG / 100) + margeNette;

    return {
      caAdditionnel: Math.round(caAdditionnel),
      margeBrute: Math.round(margeBrute),
      margeNette: Math.round(margeNette),
      margeNettePct,
      fraisGeneraux: Math.round(fraisGeneraux),
      joursFactures,
      breakEvenJours,
      breakEvenMois,
      caTotal: Math.round(caTotal),
      margeNetteTotal: Math.round(margeNetteTotal),
      rentable: margeNettePct >= SEUILS.margeLimite,
    };
  }, [nbNouveaux, tarifSim, txUtil, txFG, baseMetrics]);

  const couleurMarge = projection.margeNettePct >= SEUILS.margeRentable ? '#10b981'
    : projection.margeNettePct >= SEUILS.margeLimite ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 24 }}>
        <div className="page-title-block">
          <div className="page-title-main">Simulateur de Croissance</div>
          <div className="page-title-sub">Projetez l'impact d'une embauche sur votre CA et vos marges</div>
        </div>
      </div>

      {/* Base actuelle */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Base actuelle (données réelles)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiSim label="Employés actifs" value={baseMetrics.nbEmployes} sub="équipe actuelle" icon={Users} couleur="#3b82f6" />
          <KpiSim label="CA annuel" value={baseMetrics.caAnnuel > 0 ? `CHF ${fmtN(Math.round(baseMetrics.caAnnuel / 1000))}k` : '—'} sub={`${baseMetrics.nbChantiersAnnee} chantiers`} icon={DollarSign} couleur="#10b981" />
          <KpiSim label="Marge nette moy." value={`${baseMetrics.margesMoyenne}%`} sub="sur chantiers terminés" icon={TrendingUp} couleur={baseMetrics.margesMoyenne >= SEUILS.margeRentable ? '#10b981' : '#f59e0b'} />
          <KpiSim label="Tarif jour moyen" value={`CHF ${fmtN(baseMetrics.tarifMoyen)}`} sub="coût chargé employeur" icon={Target} couleur="#8b5cf6" />
          <KpiSim label="Taux d'utilisation" value={`${baseMetrics.txUtilisation}%`} sub={`${baseMetrics.joursParEmploye}j facturés/an/emp.`} icon={TrendingUp} couleur="#f59e0b" />
        </div>
        {baseMetrics.caAnnuel === 0 && (
          <div style={{ display: 'flex', gap: 10, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginTop: 12 }}>
            <Info size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#92400e' }}>Aucun chantier cette année — les projections utilisent les paramètres par défaut BTP Genève. Ajoutez des chantiers pour des simulations basées sur vos données réelles.</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Panneau paramètres */}
        <div style={DS.card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>Paramètres de simulation</div>

          <Slider
            label="Nombre d'embauches"
            min={1} max={10} step={1} value={nbNouveaux}
            onChange={setNbNouveaux}
            format={v => `${v} employé${v > 1 ? 's' : ''}`}
            hint="Nouveaux collaborateurs à intégrer"
          />
          <Slider
            label="Tarif jour (coût chargé)"
            min={300} max={900} step={10} value={tarifSim}
            onChange={setTarifSim}
            format={v => `CHF ${fmtN(v)}/j`}
            hint="Salaire brut + charges sociales (~35%) inclus"
          />
          <Slider
            label="Taux d'utilisation cible"
            min={50} max={100} step={5} value={txUtil}
            onChange={setTxUtil}
            format={v => `${v}%`}
            hint={`= ${Math.round(JOURS_AN_SUISSE * txUtil / 100)}j facturés/an · base ${JOURS_AN_SUISSE}j ouvrables Suisse`}
          />
          <Slider
            label="Frais généraux"
            min={5} max={25} step={1} value={txFG}
            onChange={setTxFG}
            format={v => `${v}%`}
            hint="Administration, véhicules, outillage, bureaux (défaut BTP GE : 12%)"
          />
        </div>

        {/* Panneau résultats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Score global */}
          <div style={{ background: projection.rentable ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: `1px solid ${couleurMarge}40`, borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: couleurMarge, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {projection.rentable ? '✅ Opération rentable' : '⚠️ Rentabilité à surveiller'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: couleurMarge, fontVariantNumeric: 'tabular-nums' }}>
              {projection.margeNettePct >= 0 ? '+' : ''}{projection.margeNettePct}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Marge nette après frais généraux</div>
            <Jauge pct={projection.margeNettePct} couleur={couleurMarge} />
          </div>

          {/* KPIs simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <KpiSim
              label="CA additionnel"
              value={`CHF ${fmtN(Math.round(projection.caAdditionnel / 1000))}k`}
              sub={`${projection.joursFactures}j × CHF ${fmtN(tarifSim)} × ${nbNouveaux} emp.`}
              icon={DollarSign} couleur="#3b82f6"
            />
            <KpiSim
              label="Marge nette générée"
              value={`CHF ${fmtN(Math.round(projection.margeNette / 1000))}k`}
              sub="après frais généraux"
              icon={TrendingUp} couleur={couleurMarge}
            />
            <KpiSim
              label="Break-even"
              value={`${projection.breakEvenMois} mois`}
              sub={`${projection.breakEvenJours}j pour couvrir le coût`}
              icon={Target} couleur="#8b5cf6"
            />
            <KpiSim
              label="CA total entreprise"
              value={baseMetrics.caAnnuel > 0 ? `CHF ${fmtN(Math.round(projection.caTotal / 1000))}k` : '—'}
              sub={baseMetrics.caAnnuel > 0 ? `vs CHF ${fmtN(Math.round(baseMetrics.caAnnuel / 1000))}k actuel` : 'Ajoutez des chantiers'}
              icon={TrendingUp} couleur="#10b981"
            />
          </div>

          {/* Détail calcul */}
          <div style={{ ...DS.card, background: 'var(--bg-glass)' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Détail du calcul</div>
            {[
              { label: 'CA additionnel brut', val: `+ CHF ${fmtN(projection.caAdditionnel)}`, couleur: '#10b981' },
              { label: `Frais généraux (${txFG}%)`, val: `− CHF ${fmtN(projection.fraisGeneraux)}`, couleur: '#ef4444' },
              { label: 'Marge nette projetée', val: `= CHF ${fmtN(projection.margeNette)}`, couleur: couleurMarge, bold: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: r.bold ? 800 : 600, color: r.couleur, fontVariantNumeric: 'tabular-nums' }}>{r.val}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              * Le tarif jour saisi représente le coût total employeur (salaire + charges ~35%). La marge estimée est basée sur votre marge historique de {baseMetrics.margesMoyenne}%.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
