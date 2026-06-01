export class AlertEngine {
  constructor(rules) {
    this.rules = rules.filter(r => r.enabled !== false);
    this.listeners = new Set();
    this.scheduledListeners = new Set();
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
    const newAlerts = this._evaluateMatchingRaw(scheduled, ctx);
    // Always notify scheduled listeners — even with 0 results — so the store can
    // auto-resolve conditions that have disappeared this tick.
    // NOTE: _notify is NOT called here; scheduled alerts go through _notifyScheduled only.
    this._notifyScheduled(newAlerts);
    return newAlerts;
  }

  _evaluateMatchingRaw(rules, ctx) {
    const alerts = [];
    for (const rule of rules) {
      let generated = [];
      try {
        generated = rule.evaluate(ctx);
      } catch (err) {
        console.error(`[AlertEngine] Rule ${rule.id} failed:`, err);
        continue;
      }
      for (const g of generated) {
        alerts.push(this._materialize(rule, g, ctx));
      }
    }
    return alerts;
  }

  _evaluateMatching(rules, ctx) {
    const newAlerts = this._evaluateMatchingRaw(rules, ctx);
    if (newAlerts.length > 0) this._notify(newAlerts);
    return newAlerts;
  }

  _materialize(rule, g, ctx) {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      stableKey: `${rule.id}:${g.contextRef?.id ?? 'global'}`,
      triggerType: rule.trigger,
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

  // Receives the full scheduled snapshot (always called, even with 0 alerts).
  subscribeScheduled(listener) {
    this.scheduledListeners.add(listener);
    return () => this.scheduledListeners.delete(listener);
  }

  _notify(alerts) {
    this.listeners.forEach(l => {
      try { l(alerts); } catch (err) { console.error('[AlertEngine] Listener error:', err); }
    });
  }

  _notifyScheduled(alerts) {
    this.scheduledListeners.forEach(l => {
      try { l(alerts); } catch (err) { console.error('[AlertEngine] Scheduled listener error:', err); }
    });
  }

  reset() {
    // No-op: cooldown removed in favour of store-level reconciliation via reconcile().
  }
}
