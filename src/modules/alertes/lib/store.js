import { create } from 'zustand';

const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const useAlertsStore = create((set, get) => ({
  alerts: [],

  add: (newAlerts) => set(s => ({
    alerts: [...newAlerts, ...s.alerts].slice(0, 500),
  })),

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
