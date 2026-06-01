import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAlertsStore } from '../store.js';
import { AlertEngine } from '../engine.js';

// ── Helpers ───────────────────────────────────────────────────────
const store = () => useAlertsStore.getState();

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

describe('useAlertsStore', () => {
  beforeEach(() => { store().clear(); });

  // ── add / getActive ──────────────────────────────────────────────
  it('add() empile en tête et getActive() les retourne', () => {
    store().add([alerte({ id: 'a1' })]);
    store().add([alerte({ id: 'a2' })]);
    const active = store().getActive();
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('a2'); // dernier ajouté en tête
  });

  it('add() plafonne le buffer à 500 alertes', () => {
    const lot = Array.from({ length: 600 }, (_, i) => alerte({ id: `x${i}` }));
    store().add(lot);
    expect(store().alerts).toHaveLength(500);
  });

  // ── acknowledge ──────────────────────────────────────────────────
  it('acknowledge() marque acknowledged + horodate, mais reste ACTIVE (par design)', () => {
    store().add([alerte({ id: 'a1' })]);
    store().acknowledge('a1');
    const a = store().alerts.find(x => x.id === 'a1');
    expect(a.state).toBe('acknowledged');
    expect(a.acknowledgedAt).toBeInstanceOf(Date);
    // getActive ne filtre QUE resolved + snoozed → un acquittement reste visible
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
    store().snooze('a1', new Date(Date.now() - 60_000)); // déjà passé
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

  // ── 🐛 CONSTATS RÉELS — comportements documentés (NE PAS corriger ici) ──

  it('🐛 add() ne déduplique PAS par ruleId+contextRef (doublons possibles)', () => {
    // Deux alertes pour la MÊME règle + MÊME chantier, ids différents → les deux passent.
    // Le store n'a aucune dédup ; seule la barrière de cooldown de l'engine évite le spam.
    store().add([alerte({ id: 'a1', ruleId: 'r.X', contextRef: { type: 'chantier', id: 'CH-1' } })]);
    store().add([alerte({ id: 'a2', ruleId: 'r.X', contextRef: { type: 'chantier', id: 'CH-1' } })]);
    expect(store().getActive()).toHaveLength(2); // ⚠️ deux entrées pour la même condition
  });

  it('🐛 aucune auto-résolution : condition disparue → l\'alerte reste active', () => {
    // Rien dans le store ne ferme une alerte quand la condition disparaît.
    // L'engine ne « rappelle » pas les alertes : il n'émet que de nouvelles alertes.
    // Tant que resolve() n'est pas appelé manuellement, l'alerte reste dans getActive().
    store().add([alerte({ id: 'a1' })]);
    // Simule un nouveau run où la règle ne génère plus rien (engine.add([]))
    store().add([]);
    expect(store().getActive().map(x => x.id)).toContain('a1'); // ⚠️ toujours active
  });

  it('🐛 une alerte acquittée RÉAPPARAÎT après expiration du cooldown (engine+store réels)', () => {
    // Chemin réel : engine matérialise → store.add → utilisateur acquitte →
    // cooldown expire → engine re-matérialise une NOUVELLE alerte (nouvel UUID, state active).
    // Le store n'a aucun lien avec l'état acquitté précédent → l'alerte revient.
    const RULE = {
      id: 'r.recurr', category: 'financier', trigger: 'schedule',
      severity: 'HIGH', destinataires: ['direction'], canaux: ['in_app'],
      cooldownMinutes: 60,
      evaluate: () => [{ title: 'Marge basse', message: '...', contextRef: { type: 'chantier', id: 'CH-9' } }],
    };
    const engine = new AlertEngine([RULE]);
    engine.subscribe(a => store().add(a));

    const t0 = new Date('2026-05-15T10:00:00');
    engine.evaluateScheduled({ now: t0 });
    const premier = store().getActive()[0];
    store().acknowledge(premier.id);
    expect(store().getActive().find(x => x.id === premier.id).state).toBe('acknowledged');

    // 61 min plus tard, cooldown expiré → nouvelle alerte émise
    engine.evaluateScheduled({ now: new Date(t0.getTime() + 61 * 60_000) });
    const actives = store().getActive().filter(a => a.state === 'active');
    expect(actives).toHaveLength(1); // ⚠️ l'alerte « revient » malgré l'acquittement
    expect(actives[0].id).not.toBe(premier.id); // nouvel UUID, aucun lien avec l'ancienne
  });
});
