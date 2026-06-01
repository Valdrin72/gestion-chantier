import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlertScheduler } from '../scheduler.js';
import { AlertEngine } from '../engine.js';

// ── Fixtures réelles ──────────────────────────────────────────────
function mockCtx(overrides = {}) {
  return {
    now: new Date('2026-05-15T10:00:00'),
    chantiers: [], devis: [], factures: [], employes: [],
    pointages: [], clients: [], photos: [], pvs: [], audit: [],
    treso: { solde_actuel: 0 },
    ...overrides,
  };
}

const RULE_SCHEDULE = {
  id: 'sched.always',
  category: 'financier',
  trigger: 'schedule',
  severity: 'LOW',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60,
  evaluate: () => [{ title: 'Sched', message: 'Scheduled alert' }],
};

const RULE_EVENT = {
  id: 'evt.always',
  category: 'financier',
  trigger: 'event',
  eventTypes: ['x.event'],
  severity: 'LOW',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60,
  evaluate: () => [{ title: 'Evt', message: 'Event alert' }],
};

describe('AlertScheduler', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runOnce() appelle le contextProvider puis evaluateScheduled', async () => {
    const engine = new AlertEngine([RULE_SCHEDULE]);
    const spy = vi.spyOn(engine, 'evaluateScheduled');
    const provider = vi.fn().mockResolvedValue(mockCtx());
    const scheduler = new AlertScheduler(engine, provider);

    await scheduler.runOnce();

    expect(provider).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    // Le ctx passé à l'engine est bien celui du provider
    expect(spy.mock.calls[0][0].now).toBeInstanceOf(Date);
  });

  it("n'évalue QUE les règles 'schedule' (une règle 'event' ne se déclenche pas)", async () => {
    // Engine réel avec UNE règle event ET UNE règle schedule.
    // evaluateScheduled → _notifyScheduled uniquement (pas _notify).
    const scheduledReceived = [];
    const subscribeReceived = [];
    const engine = new AlertEngine([RULE_EVENT, RULE_SCHEDULE]);
    engine.subscribeScheduled(a => scheduledReceived.push(...a));
    engine.subscribe(a => subscribeReceived.push(...a));
    const scheduler = new AlertScheduler(engine, vi.fn().mockResolvedValue(mockCtx()));

    await scheduler.runOnce();

    // subscribeScheduled reçoit la règle schedule uniquement
    expect(scheduledReceived).toHaveLength(1);
    expect(scheduledReceived[0].ruleId).toBe('sched.always');
    // subscribe ne reçoit RIEN (la règle event n'est pas déclenchée par un tick)
    expect(subscribeReceived).toHaveLength(0);
  });

  it('start() déclenche un tick initial immédiat', () => {
    const provider = vi.fn().mockResolvedValue(mockCtx());
    const scheduler = new AlertScheduler(new AlertEngine([RULE_SCHEDULE]), provider, 1000);
    scheduler.start();
    // L'appel au provider est synchrone au moment du tick initial
    expect(provider).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('re-déclenche à chaque intervalMs', async () => {
    const provider = vi.fn().mockResolvedValue(mockCtx());
    const scheduler = new AlertScheduler(new AlertEngine([RULE_SCHEDULE]), provider, 1000);
    scheduler.start();             // tick initial (1)
    await vi.advanceTimersByTimeAsync(1000); // +1
    await vi.advanceTimersByTimeAsync(1000); // +1
    expect(provider).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('start() est idempotent (un seul interval, pas de double cadence)', async () => {
    const provider = vi.fn().mockResolvedValue(mockCtx());
    const scheduler = new AlertScheduler(new AlertEngine([RULE_SCHEDULE]), provider, 1000);
    scheduler.start();   // tick initial (1)
    scheduler.start();   // doit retourner tôt — pas de 2e interval ni 2e tick
    expect(provider).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(provider).toHaveBeenCalledTimes(2); // et non 3
    scheduler.stop();
  });

  it('stop() arrête les ticks', async () => {
    const provider = vi.fn().mockResolvedValue(mockCtx());
    const scheduler = new AlertScheduler(new AlertEngine([RULE_SCHEDULE]), provider, 1000);
    scheduler.start();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(provider).toHaveBeenCalledTimes(1); // uniquement le tick initial
  });

  it("start() n'explose pas si le contextProvider rejette (erreur avalée)", async () => {
    const provider = vi.fn().mockRejectedValue(new Error('ctx boom'));
    const scheduler = new AlertScheduler(new AlertEngine([RULE_SCHEDULE]), provider, 1000);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => scheduler.start()).not.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(errSpy).toHaveBeenCalled();
    scheduler.stop();
    errSpy.mockRestore();
  });
});
