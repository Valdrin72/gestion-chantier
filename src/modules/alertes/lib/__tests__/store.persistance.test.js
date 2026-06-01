import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAlertsStore,
  loadPersistedAlerts,
  persistAlerts,
  ALERTS_STORAGE_KEY,
} from '../store.js';
import { AlertEngine } from '../engine.js';

const store = () => useAlertsStore.getState();

function alerteSched(over = {}) {
  const ruleId = over.ruleId ?? 'r.test';
  const ctxId = over.contextRef?.id ?? 'CH-1';
  return {
    id: `a_${Math.random().toString(36).slice(2)}`,
    ruleId,
    severity: 'MEDIUM',
    category: 'financier',
    title: 'T', message: 'M',
    contextRef: { type: 'chantier', id: ctxId },
    destinataires: ['direction'],
    canaux: ['in_app'],
    state: 'active',
    createdAt: new Date('2026-05-15T10:00:00'),
    stableKey: `${ruleId}:${ctxId}`,
    triggerType: 'schedule',
    ...over,
  };
}

// Simule un reload de page : on vide la mémoire du store SANS toucher localStorage,
// puis on réhydrate depuis localStorage (comme au démarrage de l'app).
function simulerReload() {
  useAlertsStore.setState({ alerts: [] }); // mémoire fraîche, localStorage intact
  store().hydrateFromStorage();
}

describe('Persistance localStorage des alertes', () => {
  beforeEach(() => {
    localStorage.clear();
    useAlertsStore.setState({ alerts: [] });
  });

  // ── écriture ──────────────────────────────────────────────────────
  it('acquitter une alerte écrit l\'état en localStorage', () => {
    store().add([alerteSched({ id: 'a1' })]);
    store().acknowledge('a1');
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.find(x => x.id === 'a1').state).toBe('acknowledged');
  });

  it('snooze écrit snoozedUntil en localStorage et se relit en Date', () => {
    const until = new Date(Date.now() + 3600_000);
    store().add([alerteSched({ id: 'a1' })]);
    store().snooze('a1', until);
    const reloaded = loadPersistedAlerts();
    const a1 = reloaded.find(x => x.id === 'a1');
    expect(a1.snoozedUntil).toBeInstanceOf(Date);
    expect(a1.snoozedUntil.getTime()).toBe(until.getTime());
  });

  it('les Dates (createdAt/acknowledgedAt) sont réhydratées en objets Date', () => {
    store().add([alerteSched({ id: 'a1' })]);
    store().acknowledge('a1');
    const a1 = loadPersistedAlerts().find(x => x.id === 'a1');
    expect(a1.createdAt).toBeInstanceOf(Date);
    expect(a1.acknowledgedAt).toBeInstanceOf(Date);
  });

  // ── reload : l'état survit ────────────────────────────────────────
  it('reload simulé : une alerte acquittée RESTE acquittée', () => {
    store().add([alerteSched({ id: 'a1' })]);
    store().acknowledge('a1');
    simulerReload();
    const a1 = store().alerts.find(x => x.id === 'a1');
    expect(a1).toBeTruthy();
    expect(a1.state).toBe('acknowledged');
  });

  it('reload simulé : un snooze futur reste masqué de getActive()', () => {
    store().add([alerteSched({ id: 'a1' })]);
    store().snooze('a1', new Date(Date.now() + 3600_000));
    simulerReload();
    expect(store().getActive().find(x => x.id === 'a1')).toBeFalsy();
    // mais l'alerte existe toujours, snoozée
    expect(store().alerts.find(x => x.id === 'a1').state).toBe('snoozed');
  });

  it('les alertes résolues sont élaguées du localStorage', () => {
    store().add([alerteSched({ id: 'a1' })]);
    store().resolve('a1');
    expect(loadPersistedAlerts().find(x => x.id === 'a1')).toBeFalsy();
  });

  // ── END-TO-END : le « mur d'alertes du matin » a disparu ──────────
  it('END-TO-END reload : acquittée + condition encore active → reconcile la GARDE acquittée (pas de re-surface)', () => {
    // Règle réelle qui matche toujours pour CH-9
    const RULE = {
      id: 'r.marge', category: 'financier', trigger: 'schedule',
      severity: 'HIGH', destinataires: ['direction'], canaux: ['in_app'],
      evaluate: () => [{ title: 'Marge basse', message: '...', contextRef: { type: 'chantier', id: 'CH-9' } }],
    };
    const engine = new AlertEngine([RULE]);
    engine.subscribeScheduled(a => store().reconcile(a));

    // Session 1 : l'alerte apparaît, l'utilisateur l'acquitte
    engine.evaluateScheduled({ now: new Date('2026-05-15T10:00:00') });
    const premier = store().getActive()[0];
    store().acknowledge(premier.id);

    // ── RELOAD (le lendemain matin) ──
    simulerReload();
    // L'acquittée a bien survécu au reload
    const survivor = store().alerts.find(x => x.stableKey === 'r.marge:CH-9');
    expect(survivor.state).toBe('acknowledged');

    // Premier tick du matin : la condition est ENCORE active
    engine.evaluateScheduled({ now: new Date('2026-05-16T08:00:00') });

    // L'alerte NE réapparaît PAS : aucune nouvelle alerte active, l'acquittée reste
    const actives = store().getActive().filter(a => a.state === 'active');
    expect(actives).toHaveLength(0); // ✅ plus de mur d'alertes du matin
    const acked = store().getActive().filter(a => a.state === 'acknowledged');
    expect(acked).toHaveLength(1);
    expect(acked[0].id).toBe(premier.id); // même alerte, pas de nouvel UUID
  });

  it('END-TO-END reload : active rehydratée + condition disparue → auto-résolue au 1er tick', () => {
    const RULE_OFF = {
      id: 'r.off', category: 'financier', trigger: 'schedule',
      severity: 'HIGH', destinataires: ['direction'], canaux: ['in_app'],
      evaluate: () => [], // la condition a disparu
    };
    const engine = new AlertEngine([RULE_OFF]);
    engine.subscribeScheduled(a => store().reconcile(a));

    // Pré-charge localStorage avec une alerte active schedule (comme une session précédente)
    persistAlerts([alerteSched({ id: 'old', ruleId: 'r.off', contextRef: { id: 'CH-1' } })]);

    // ── RELOAD ──
    simulerReload();
    expect(store().getActive().find(x => x.id === 'old')).toBeTruthy(); // active après reload

    // Premier tick : la condition n'existe plus → auto-résolution
    engine.evaluateScheduled({ now: new Date('2026-05-16T08:00:00') });
    expect(store().getActive().find(x => x.id === 'old')).toBeFalsy(); // ✅ résolue
    expect(store().alerts.find(x => x.id === 'old').state).toBe('resolved');
  });

  // ── robustesse ────────────────────────────────────────────────────
  it('localStorage corrompu → loadPersistedAlerts() retourne [] sans crash', () => {
    localStorage.setItem(ALERTS_STORAGE_KEY, '{pas du json valide');
    expect(() => loadPersistedAlerts()).not.toThrow();
    expect(loadPersistedAlerts()).toEqual([]);
  });

  it('localStorage = JSON non-tableau → [] sans crash', () => {
    localStorage.setItem(ALERTS_STORAGE_KEY, '{"foo":"bar"}');
    expect(loadPersistedAlerts()).toEqual([]);
  });

  it('localStorage vide (premier lancement) → [] sans crash', () => {
    localStorage.removeItem(ALERTS_STORAGE_KEY);
    expect(loadPersistedAlerts()).toEqual([]);
    simulerReload();
    expect(store().alerts).toEqual([]);
  });

  it('hydrateFromStorage sur store corrompu → store vide, pas de crash', () => {
    localStorage.setItem(ALERTS_STORAGE_KEY, 'xxx');
    expect(() => simulerReload()).not.toThrow();
    expect(store().alerts).toEqual([]);
  });
});
