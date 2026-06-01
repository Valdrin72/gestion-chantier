import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertsStore } from '../store.js';
import { AlertEngine } from '../engine.js';

const store = () => useAlertsStore.getState();

// Alerte brute (additive, pas de stableKey) pour les tests de add/acknowledge/etc.
function alerte(over = {}) {
  return {
    id: `a_${Math.random().toString(36).slice(2)}`,
    ruleId: 'r.test',
    severity: 'MEDIUM',
    category: 'financier',
    title: 'T', message: 'M',
    contextRef: { type: 'chantier', id: 'CH-1' },
    destinataires: ['direction'],
    canaux: ['in_app'],
    state: 'active',
    createdAt: new Date('2026-05-15T10:00:00'),
    ...over,
  };
}

// Alerte avec stableKey + triggerType (pour reconcile)
function alerteSched(over = {}) {
  const base = alerte(over);
  return {
    ...base,
    stableKey: `${base.ruleId}:${base.contextRef?.id ?? 'global'}`,
    triggerType: 'schedule',
    ...over,
    // recalcule stableKey si ruleId/contextRef overridés
    stableKey: `${over.ruleId ?? 'r.test'}:${over.contextRef?.id ?? over.id ?? 'CH-1'}`,
  };
}

describe('useAlertsStore', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    store().clear();
  });

  // ── add / getActive ──────────────────────────────────────────────
  it('add() empile en tête et getActive() les retourne', () => {
    store().add([alerte({ id: 'a1' })]);
    store().add([alerte({ id: 'a2' })]);
    const active = store().getActive();
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('a2');
  });

  it('add() plafonne le buffer à 500 alertes', () => {
    const lot = Array.from({ length: 600 }, (_, i) => alerte({ id: `x${i}` }));
    store().add(lot);
    expect(store().alerts).toHaveLength(500);
  });

  // ── acknowledge ──────────────────────────────────────────────────
  it('acknowledge() marque acknowledged + horodate, reste visible dans getActive()', () => {
    store().add([alerte({ id: 'a1' })]);
    store().acknowledge('a1');
    const a = store().alerts.find(x => x.id === 'a1');
    expect(a.state).toBe('acknowledged');
    expect(a.acknowledgedAt).toBeInstanceOf(Date);
    expect(store().getActive().map(x => x.id)).toContain('a1');
  });

  // ── resolve ──────────────────────────────────────────────────────
  it('resolve() retire l\'alerte de getActive() et horodate', () => {
    store().add([alerte({ id: 'a1' })]);
    store().resolve('a1');
    const a = store().alerts.find(x => x.id === 'a1');
    expect(a.state).toBe('resolved');
    expect(a.resolvedAt).toBeInstanceOf(Date);
    expect(store().getActive()).toHaveLength(0);
  });

  // ── snooze ────────────────────────────────────────────────────────
  it('snooze() vers le futur masque l\'alerte de getActive()', () => {
    store().add([alerte({ id: 'a1' })]);
    store().snooze('a1', new Date(Date.now() + 60_000));
    expect(store().getActive()).toHaveLength(0);
  });

  it('snooze() expiré réaffiche l\'alerte dans getActive()', () => {
    store().add([alerte({ id: 'a1' })]);
    store().snooze('a1', new Date(Date.now() - 60_000));
    expect(store().getActive().map(x => x.id)).toContain('a1');
  });

  // ── remove / clear ────────────────────────────────────────────────
  it('remove() supprime définitivement', () => {
    store().add([alerte({ id: 'a1' }), alerte({ id: 'a2' })]);
    store().remove('a1');
    expect(store().alerts.map(x => x.id)).toEqual(['a2']);
  });

  it('clear() vide tout', () => {
    store().add([alerte({ id: 'a1' })]);
    store().clear();
    expect(store().alerts).toHaveLength(0);
  });

  // ── filtres ───────────────────────────────────────────────────────
  it('getByCategory() filtre les actives par catégorie', () => {
    store().add([
      alerte({ id: 'a1', category: 'financier' }),
      alerte({ id: 'a2', category: 'tresorerie' }),
    ]);
    expect(store().getByCategory('tresorerie').map(x => x.id)).toEqual(['a2']);
  });

  it('getBySeverity() retourne les sévérités >= seuil', () => {
    store().add([
      alerte({ id: 'low', severity: 'LOW' }),
      alerte({ id: 'med', severity: 'MEDIUM' }),
      alerte({ id: 'crit', severity: 'CRITICAL' }),
    ]);
    const ids = store().getBySeverity('MEDIUM').map(x => x.id).sort();
    expect(ids).toEqual(['crit', 'med']);
  });

  it('getForRole() filtre par destinataire', () => {
    store().add([
      alerte({ id: 'a1', destinataires: ['direction'] }),
      alerte({ id: 'a2', destinataires: ['comptable'] }),
    ]);
    expect(store().getForRole('comptable').map(x => x.id)).toEqual(['a2']);
  });

  it('countActive() combine filtres sévérité + rôle', () => {
    store().add([
      alerte({ id: 'a1', severity: 'HIGH', destinataires: ['direction'] }),
      alerte({ id: 'a2', severity: 'LOW', destinataires: ['direction'] }),
      alerte({ id: 'a3', severity: 'HIGH', destinataires: ['comptable'] }),
    ]);
    expect(store().countActive({ severity: ['HIGH'], role: 'direction' })).toBe(1);
  });

  // ── cas limites ───────────────────────────────────────────────────
  it('store vide : getActive/countActive sûrs', () => {
    expect(store().getActive()).toEqual([]);
    expect(store().countActive()).toBe(0);
    expect(store().getBySeverity('CRITICAL')).toEqual([]);
  });

  it('acknowledge/resolve sur un id inexistant ne plante pas', () => {
    expect(() => store().acknowledge('zzz')).not.toThrow();
    expect(() => store().resolve('zzz')).not.toThrow();
    expect(store().alerts).toHaveLength(0);
  });

  // ── reconcile : dédup ─────────────────────────────────────────────
  describe('reconcile()', () => {
    it('crée une alerte si la stableKey est absente du store', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      expect(store().getActive()).toHaveLength(1);
    });

    it('ne duplique PAS si la stableKey est déjà ACTIVE', () => {
      const a = alerteSched({ ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().reconcile([{ ...a, id: 'a_autre' }]); // 2e tick, même condition
      expect(store().getActive()).toHaveLength(1); // ✅ dédup
    });

    it('ne re-surface PAS une alerte ACQUITTÉE (condition persiste)', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().acknowledge('a1');
      // Condition toujours active au prochain tick
      store().reconcile([{ ...a, id: 'a_autre' }]);
      const active = store().getActive();
      // L'alerte acquittée reste là, mais aucune nouvelle alerte créée
      expect(active).toHaveLength(1);
      expect(active[0].state).toBe('acknowledged');
    });

    it('ne re-surface PAS une alerte SNOOZÉE', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().snooze('a1', new Date(Date.now() + 60_000));
      store().reconcile([{ ...a, id: 'a_autre' }]); // condition toujours active
      // La snoozée persiste, aucune nouvelle alerte active
      expect(store().getActive()).toHaveLength(0);
      expect(store().alerts).toHaveLength(1); // snoozée existe toujours
    });

    it('auto-résout une alerte quand la condition disparaît', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]); // condition active
      store().reconcile([]); // condition disparue → auto-résolution
      const a1 = store().alerts.find(x => x.id === 'a1');
      expect(a1.state).toBe('resolved');
      expect(a1.autoResolved).toBe(true);
      expect(store().getActive()).toHaveLength(0);
    });

    it('auto-résout une alerte ACQUITTÉE quand la condition disparaît', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().acknowledge('a1');
      store().reconcile([]); // condition disparue
      expect(store().getActive()).toHaveLength(0);
      expect(store().alerts.find(x => x.id === 'a1').state).toBe('resolved');
    });

    it('crée une NOUVELLE alerte quand la condition réapparaît après résolution', () => {
      const a = alerteSched({ id: 'a1', ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]); // condition active
      store().reconcile([]); // condition disparue → résolue
      store().reconcile([{ ...a, id: 'a2' }]); // condition revenue → vraie news
      const actives = store().getActive().filter(x => x.state === 'active');
      expect(actives).toHaveLength(1);
      expect(actives[0].id).toBe('a2'); // nouvel id, état active
    });

    it('ne touche pas les alertes event (triggerType !== schedule)', () => {
      const evt = alerte({ id: 'evt1', triggerType: 'event', stableKey: 'r.evt:CH-1' });
      store().add([evt]);
      store().reconcile([]); // snapshot vide — mais evt n'est pas concerné
      expect(store().getActive().find(x => x.id === 'evt1')?.state).toBe('active');
    });

    it('reconcile() avec store vide et 0 incomings ne plante pas', () => {
      expect(() => store().reconcile([])).not.toThrow();
      expect(store().alerts).toHaveLength(0);
    });

    // ── 🐛 → ✅ : les 3 bugs documentés dans la session précédente sont corrigés ──

    it('✅ (ex-🐛 dédup) reconcile() dédup : même condition → 1 seule alerte', () => {
      const a = alerteSched({ ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().reconcile([{ ...a, id: 'a_autre' }]);
      expect(store().getActive()).toHaveLength(1); // ✅ corrigé
    });

    it('✅ (ex-🐛 auto-résolution) condition disparue → résolue', () => {
      const a = alerteSched({ ruleId: 'r.X', contextRef: { id: 'CH-1' } });
      store().reconcile([a]);
      store().reconcile([]); // condition disparue
      expect(store().getActive()).toHaveLength(0); // ✅ corrigé
    });

    it('✅ (ex-🐛 acquittement) alerte acquittée NE réapparaît PAS après un nouveau tick — intégration engine+store', () => {
      // Chemin réel : engine.subscribeScheduled → store.reconcile
      const RULE = {
        id: 'r.recurr', category: 'financier', trigger: 'schedule',
        severity: 'HIGH', destinataires: ['direction'], canaux: ['in_app'],
        evaluate: () => [{ title: 'Marge basse', message: '...', contextRef: { type: 'chantier', id: 'CH-9' } }],
      };
      const engine = new AlertEngine([RULE]);
      engine.subscribeScheduled(a => store().reconcile(a)); // câblage réel

      const t0 = new Date('2026-05-15T10:00:00');
      engine.evaluateScheduled({ now: t0 });
      const premier = store().getActive()[0];
      store().acknowledge(premier.id);

      // Nouveau tick (condition toujours active)
      engine.evaluateScheduled({ now: new Date(t0.getTime() + 61 * 60_000) });

      // L'alerte acquittée NE réapparaît PAS (dédup par stableKey)
      const actives = store().getActive().filter(a => a.state === 'active');
      expect(actives).toHaveLength(0); // ✅ corrigé — plus de doublon
      const acked = store().getActive().filter(a => a.state === 'acknowledged');
      expect(acked).toHaveLength(1); // l'acquittée reste là
      expect(acked[0].id).toBe(premier.id); // même id, pas de nouvel UUID
    });
  });
});
