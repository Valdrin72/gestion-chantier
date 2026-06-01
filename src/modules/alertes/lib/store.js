import { create } from 'zustand';

const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const useAlertsStore = create((set, get) => ({
  alerts: [],

  add: (newAlerts) => set(s => ({
    alerts: [...newAlerts, ...s.alerts].slice(0, 500),
  })),

  // Reconcile the store against a full scheduled-evaluation snapshot.
  // Called every scheduler tick with ALL conditions that currently match.
  reconcile: (incomingAlerts) => set(s => {
    const now = new Date();

    // Map of stableKey → first non-resolved scheduled alert that exists in the store.
    const existingByKey = new Map();
    for (const a of s.alerts) {
      if (a.stableKey && a.triggerType === 'schedule' && a.state !== 'resolved') {
        if (!existingByKey.has(a.stableKey)) existingByKey.set(a.stableKey, a);
      }
    }

    // Set of stableKeys currently active (the "conditions active right now" snapshot).
    const incomingKeys = new Set(incomingAlerts.map(a => a.stableKey).filter(Boolean));

    // Auto-resolve scheduled alerts whose condition has disappeared.
    const updated = s.alerts.map(a => {
      if (!a.stableKey || a.triggerType !== 'schedule') return a;
      if (a.state === 'resolved') return a;
      if (!incomingKeys.has(a.stableKey)) {
        return { ...a, state: 'resolved', resolvedAt: now, autoResolved: true };
      }
      return a;
    });

    // Add only alerts whose stableKey has no existing non-resolved scheduled entry.
    // — condition active, aucune alerte → CRÉER
    // — condition active, alerte active → NE RIEN FAIRE (dédup)
    // — condition active, alerte acquittée → RESTER ACQUITTÉE (pas de re-surface)
    // — condition active, alerte snoozée → rester snoozée
    // — condition revenue après résolution → existingByKey vide → CRÉER (vraie news)
    const toAdd = incomingAlerts.filter(a => !existingByKey.has(a.stableKey));

    return { alerts: [...toAdd, ...updated].slice(0, 500) };
  }),

  acknowledge: (id) => set(s => ({
    alerts: s.alerts.map(a =>
      a.id === id ? { ...a, state: 'acknowledged', acknowledgedAt: new Date() } : a
    ),
  })),

  snooze: (id, until) => set(s => ({
    alerts: s.alerts.map(a =>
      a.id === id ? { ...a, state: 'snoozed', snoozedUntil: until } : a
    ),
  })),

  resolve: (id) => set(s => ({
    alerts: s.alerts.map(a =>
      a.id === id ? { ...a, state: 'resolved', resolvedAt: new Date() } : a
    ),
  })),

  remove: (id) => set(s => ({ alerts: s.alerts.filter(a => a.id !== id) })),

  clear: () => set({ alerts: [] }),

  getActive: () => {
    const now = Date.now();
    return get().alerts.filter(a => {
      if (a.state === 'resolved') return false;
      if (a.state === 'snoozed' && a.snoozedUntil && a.snoozedUntil.getTime() > now) return false;
      return true;
    });
  },

  getByCategory: (category) => get().getActive().filter(a => a.category === category),

  getBySeverity: (min) => {
    const threshold = SEVERITY_ORDER[min] ?? 0;
    return get().getActive().filter(a => (SEVERITY_ORDER[a.severity] ?? 0) >= threshold);
  },

  getForRole: (role) => get().getActive().filter(a => a.destinataires.includes(role)),

  countActive: (filter) => {
    let list = get().getActive();
    if (filter?.severity) list = list.filter(a => filter.severity.includes(a.severity));
    if (filter?.role) list = list.filter(a => a.destinataires.includes(filter.role));
    return list.length;
  },
}));
