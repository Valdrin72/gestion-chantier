import { describe, it, expect, beforeEach } from 'vitest';
import { AlertEngine } from '../engine.js';

function mockCtx(overrides = {}) {
  return {
    now: new Date('2026-05-15T10:00:00'),
    chantiers: [], devis: [], factures: [], employes: [],
    pointages: [], clients: [], photos: [], pvs: [], audit: [],
    treso: { solde_actuel: 0, encaissements_prevus_30j: 0, decaissements_prevus_30j: 0, solde_projete_30j: 0, dso_actuel: 0 },
    ...overrides,
  };
}

const RULE_ALWAYS = {
  id: 'test.always',
  nom: 'Always fires',
  description: '',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['test.event'],
  severity: 'LOW',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60,
  evaluate: () => [{ title: 'Test', message: 'Test alert' }],
};

describe('AlertEngine', () => {
  let engine;
  beforeEach(() => { engine = new AlertEngine([RULE_ALWAYS]); });

  it('génère une alerte sur évaluation', () => {
    const alerts = engine.evaluateAll(mockCtx());
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('Test');
    expect(alerts[0].severity).toBe('LOW');
    expect(alerts[0].state).toBe('active');
  });

  it('respecte le cooldown (même contexte)', () => {
    const ctx = mockCtx();
    expect(engine.evaluateAll(ctx)).toHaveLength(1);
    expect(engine.evaluateAll(ctx)).toHaveLength(0);
  });

  it('cooldown expire après le délai configuré', () => {
    const ctx1 = mockCtx();
    engine.evaluateAll(ctx1);
    const ctx2 = mockCtx({ now: new Date(ctx1.now.getTime() + 61 * 60 * 1000) });
    expect(engine.evaluateAll(ctx2)).toHaveLength(1);
  });

  it('filtre par type d\'événement', () => {
    const ctx = mockCtx();
    const alerts = engine.evaluateForEvent({ type: 'autre.event', occurredAt: ctx.now }, ctx);
    expect(alerts).toHaveLength(0);
  });

  it('évalue l\'événement correct', () => {
    const ctx = mockCtx();
    const alerts = engine.evaluateForEvent({ type: 'test.event', occurredAt: ctx.now }, ctx);
    expect(alerts).toHaveLength(1);
  });

  it('notifie les listeners', () => {
    const received = [];
    engine.subscribe((alerts) => received.push(...alerts));
    engine.evaluateAll(mockCtx());
    expect(received).toHaveLength(1);
  });

  it('unsubscribe retire le listener', () => {
    const received = [];
    const unsub = engine.subscribe((alerts) => received.push(...alerts));
    unsub();
    engine.evaluateAll(mockCtx());
    expect(received).toHaveLength(0);
  });

  it('attrape les erreurs de règles sans planter', () => {
    const failing = {
      ...RULE_ALWAYS,
      id: 'test.fail',
      evaluate: () => { throw new Error('boom'); },
    };
    const eng = new AlertEngine([failing, RULE_ALWAYS]);
    const alerts = eng.evaluateAll(mockCtx());
    expect(alerts).toHaveLength(1);
  });

  it('reset vide les cooldowns', () => {
    const ctx = mockCtx();
    engine.evaluateAll(ctx);
    engine.reset();
    expect(engine.evaluateAll(ctx)).toHaveLength(1);
  });

  it('ne génère pas d\'alertes pour règles disabled', () => {
    const disabled = { ...RULE_ALWAYS, id: 'test.disabled', enabled: false };
    const eng = new AlertEngine([disabled]);
    expect(eng.evaluateAll(mockCtx())).toHaveLength(0);
  });
});
