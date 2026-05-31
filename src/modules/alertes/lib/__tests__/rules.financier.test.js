import { describe, it, expect } from 'vitest';
import { MARGE_NEGATIVE, MARGE_FAIBLE, MARGE_LIMITE, CPI_CRITIQUE, DEPASSEMENT_BUDGET_25, DEVIS_SANS_RELANCE } from '../rules/financier.js';

function baseCtx(overrides = {}) {
  return {
    now: new Date('2026-05-15'),
    chantiers: [], devis: [], factures: [], employes: [],
    pointages: [], clients: [], photos: [], pvs: [], audit: [],
    treso: { solde_actuel: 0, encaissements_prevus_30j: 0, decaissements_prevus_30j: 0, solde_projete_30j: 0, dso_actuel: 0 },
    ...overrides,
  };
}

function makeChantier(overrides = {}) {
  return {
    id: 'c-1', nom: 'Chantier Test', client_id: 'cl-1',
    statut: 'actif', budget_total: 50_000,
    date_debut: new Date('2026-04-01'),
    date_fin_prevue: new Date('2026-07-01'),
    ...overrides,
  };
}

describe('MARGE_NEGATIVE', () => {
  it('déclenche si marge brute actuelle < 0', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_brute_actuelle: -5_000 })] });
    expect(MARGE_NEGATIVE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si marge positive', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_brute_actuelle: 10_000 })] });
    expect(MARGE_NEGATIVE.evaluate(ctx)).toHaveLength(0);
  });

  it('ignore les chantiers non actifs', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_brute_actuelle: -5_000, statut: 'cloture' })] });
    expect(MARGE_NEGATIVE.evaluate(ctx)).toHaveLength(0);
  });

  it('ignore si marge_brute_actuelle non définie', () => {
    const ctx = baseCtx({ chantiers: [makeChantier()] });
    expect(MARGE_NEGATIVE.evaluate(ctx)).toHaveLength(0);
  });
});

describe('MARGE_FAIBLE', () => {
  it('déclenche si marge nette 0–14% (danger)', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: 5_000, budget_total: 50_000 })] });
    expect(MARGE_FAIBLE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si marge nette >= 15%', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: 10_000, budget_total: 50_000 })] });
    expect(MARGE_FAIBLE.evaluate(ctx)).toHaveLength(0);
  });

  it('déclenche si marge nette négative (< 15% inclut le négatif)', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: -1_000, budget_total: 50_000 })] });
    expect(MARGE_FAIBLE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si marge_nette_actuelle absente', () => {
    const ctx = baseCtx({ chantiers: [makeChantier()] });
    expect(MARGE_FAIBLE.evaluate(ctx)).toHaveLength(0);
  });
});

describe('MARGE_LIMITE', () => {
  it('déclenche si marge nette 15–19%', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: 8_000, budget_total: 50_000 })] });
    // 8000/50000 = 16% → [15, 20[
    expect(MARGE_LIMITE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si marge nette >= 20%', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: 11_000, budget_total: 50_000 })] });
    // 11000/50000 = 22% → pas dans [15, 20[
    expect(MARGE_LIMITE.evaluate(ctx)).toHaveLength(0);
  });

  it('ne déclenche pas si marge nette < 15% (couvert par MARGE_FAIBLE)', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ marge_nette_actuelle: 5_000, budget_total: 50_000 })] });
    expect(MARGE_LIMITE.evaluate(ctx)).toHaveLength(0);
  });
});

describe('CPI_CRITIQUE', () => {
  it('déclenche si CPI < 0.9 avec avancement >= 30%', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({
      pourcent_temps_ecoule: 50,
      pourcent_travaux_realises: 40,
      couts_engages: 24_000, // EV=20k, AC=24k → CPI=0.833
    })] });
    expect(CPI_CRITIQUE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas avant 30% d\'avancement', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({
      pourcent_temps_ecoule: 20,
      pourcent_travaux_realises: 20,
      couts_engages: 15_000,
    })] });
    expect(CPI_CRITIQUE.evaluate(ctx)).toHaveLength(0);
  });

  it('ne déclenche pas si CPI >= 0.9', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({
      pourcent_temps_ecoule: 50,
      pourcent_travaux_realises: 50,
      couts_engages: 24_000, // EV=25k, AC=24k → CPI=1.04
    })] });
    expect(CPI_CRITIQUE.evaluate(ctx)).toHaveLength(0);
  });
});

describe('DEPASSEMENT_BUDGET_25', () => {
  it('déclenche si coûts > 125% budget', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ couts_engages: 65_000, budget_total: 50_000 })] });
    expect(DEPASSEMENT_BUDGET_25.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si coûts <= 125% budget', () => {
    const ctx = baseCtx({ chantiers: [makeChantier({ couts_engages: 60_000, budget_total: 50_000 })] });
    expect(DEPASSEMENT_BUDGET_25.evaluate(ctx)).toHaveLength(0);
  });
});

describe('DEVIS_SANS_RELANCE', () => {
  it('déclenche si devis envoyé sans relance depuis 14j', () => {
    const dateVieille = new Date('2026-04-01');
    const ctx = baseCtx({ devis: [{ id: 'd-1', numero: 'D-001', statut: 'envoye', total_ht: 50_000, date_emission: dateVieille }] });
    expect(DEVIS_SANS_RELANCE.evaluate(ctx)).toHaveLength(1);
  });

  it('ne déclenche pas si statut != envoye', () => {
    const ctx = baseCtx({ devis: [{ id: 'd-1', numero: 'D-001', statut: 'accepte', total_ht: 50_000, date_emission: new Date('2026-04-01') }] });
    expect(DEVIS_SANS_RELANCE.evaluate(ctx)).toHaveLength(0);
  });
});
