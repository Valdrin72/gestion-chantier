export class AlertEngine {
  constructor(rules) {
    this.rules = rules.filter(r => r.enabled !== false);
    this.cooldowns = new Map();
    this.listeners = new Set();
  }

  evaluateAll(ctx) {
    return this._evaluateMatching(this.rules, ctx);
  }

  evaluateForEvent(event, ctx) {
    const matching = this.rules.filter(
      r => r.trigger === 'event' && r.eventTypes?.includes(event.type)
    );
    return this._evaluateMatching(matching, ctx);
  }

  evaluateScheduled(ctx) {
    const scheduled = this.rules.filter(r => r.trigger === 'schedule');
    return this._evaluateMatching(scheduled, ctx);
  }

  _evaluateMatching(rules, ctx) {
    const newAlerts = [];

    for (const rule of rules) {
      let generated = [];
      try {
        generated = rule.evaluate(ctx);
      } catch (err) {
        console.error(`[AlertEngine] Rule ${rule.id} failed:`, err);
        continue;
      }

      for (const g of generated) {
        const cooldownKey = `${rule.id}:${g.contextRef?.id ?? 'global'}`;
        const lastFired = this.cooldowns.get(cooldownKey);

        if (lastFired && rule.cooldownMinutes) {
          const elapsedMin = (ctx.now.getTime() - lastFired.getTime()) / 60_000;
          if (elapsedMin < rule.cooldownMinutes) continue;
        }

        this.cooldowns.set(cooldownKey, ctx.now);
        newAlerts.push(this._materialize(rule, g, ctx));
      }
    }

    if (newAlerts.length > 0) this._notify(newAlerts);
    return newAlerts;
  }

  _materialize(rule, g, ctx) {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      title: g.title,
      message: g.message,
      contextRef: g.contextRef,
      destinataires: rule.destinataires,
      canaux: rule.canaux,
      state: 'active',
      createdAt: ctx.now,
      actions: g.actions,
      data: g.data,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify(alerts) {
    this.listeners.forEach(l => {
      try { l(alerts); } catch (err) { console.error('[AlertEngine] Listener error:', err); }
    });
  }

  reset() {
    this.cooldowns.clear();
  }
}
