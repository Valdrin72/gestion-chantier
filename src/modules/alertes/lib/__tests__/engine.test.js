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

const RULE_SCHEDULE = {
  id: 'test.sched',
  category: 'financier',
  trigger: 'schedule',
  severity: 'MEDIUM',
  destinataires: ['direction'],
  canaux: ['in_app'],
  evaluate: () => [{ title: 'Sched', message: 'Scheduled alert', contextRef: { type: 'global', id: 'CH-1' } }],
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

  // Cooldown retiré : même contexte évalué deux fois → deux alertes (dédup = responsabilité du store).
  it('sans cooldown : même contexte évalué deux fois génère deux alertes', () => {
    const ctx = mockCtx();
    expect(engine.evaluateAll(ctx)).toHaveLength(1);
    expect(engine.evaluateAll(ctx)).toHaveLength(1);
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

  it('notifie les listeners via subscribe', () => {
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

  it('reset() est désormais un no-op (cooldown retiré)', () => {
    const ctx = mockCtx();
    engine.evaluateAll(ctx);
    engine.reset(); // ne plante pas, ne change pas le comportement
    expect(engine.evaluateAll(ctx)).toHaveLength(1);
  });

  it('ne génère pas d\'alertes pour règles disabled', () => {
    const disabled = { ...RULE_ALWAYS, id: 'test.disabled', enabled: false };
    const eng = new AlertEngine([disabled]);
    expect(eng.evaluateAll(mockCtx())).toHaveLength(0);
  });

  // ── stableKey + triggerType ────────────────────────────────────────
  it('_materialize porte stableKey = ruleId:contextRef.id', () => {
    const eng = new AlertEngine([RULE_SCHEDULE]);
    const alerts = eng.evaluateScheduled(mockCtx());
    expect(alerts[0].stableKey).toBe('test.sched:CH-1');
  });

  it('_materialize porte stableKey = ruleId:global quand contextRef absent', () => {
    const ruleNoRef = { ...RULE_ALWAYS, id: 'test.noref', trigger: 'event', eventTypes: ['x'] };
    const eng = new AlertEngine([ruleNoRef]);
    const alerts = eng.evaluateAll(mockCtx());
    expect(alerts[0].stableKey).toBe('test.noref:global');
  });

  it('_materialize porte triggerType', () => {
    const eng = new AlertEngine([RULE_SCHEDULE]);
    const alerts = eng.evaluateScheduled(mockCtx());
    expect(alerts[0].triggerType).toBe('schedule');
  });

  // ── subscribeScheduled ────────────────────────────────────────────
  it('subscribeScheduled reçoit le snapshot même avec 0 alertes', () => {
    const snapshots = [];
    const eng = new AlertEngine([]); // aucune règle
    eng.subscribeScheduled(a => snapshots.push(a));
    eng.evaluateScheduled(mockCtx());
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual([]); // snapshot vide → signal "aucune condition active"
  });

  it('subscribeScheduled reçoit les alertes schedules', () => {
    const received = [];
    const eng = new AlertEngine([RULE_SCHEDULE]);
    eng.subscribeScheduled(a => received.push(...a));
    eng.evaluateScheduled(mockCtx());
    expect(received).toHaveLength(1);
    expect(received[0].ruleId).toBe('test.sched');
  });

  it('subscribe ne reçoit PAS les alertes de evaluateScheduled', () => {
    // evaluateScheduled passe par _notifyScheduled uniquement, pas _notify
    const received = [];
    const eng = new AlertEngine([RULE_SCHEDULE]);
    eng.subscribe(a => received.push(...a));
    eng.evaluateScheduled(mockCtx());
    expect(received).toHaveLength(0);
  });

  it('unsubscribeScheduled retire le listener', () => {
    const received = [];
    const eng = new AlertEngine([RULE_SCHEDULE]);
    const unsub = eng.subscribeScheduled(a => received.push(...a));
    unsub();
    eng.evaluateScheduled(mockCtx());
    expect(received).toHaveLength(0);
  });
});
