import { create } from 'zustand';

const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// ── Persistance localStorage ──────────────────────────────────────
// L'état des alertes (acquitté/snoozé/résolu) n'est PAS de la donnée métier :
// il ne va NI dans le blob Supabase NI dans le backup. Juste localStorage.
export const ALERTS_STORAGE_KEY = 'cyna-alertes-v1';

const DATE_FIELDS = ['createdAt', 'acknowledgedAt', 'resolvedAt', 'snoozedUntil'];

function reviveDates(alert) {
  const out = { ...alert };
  for (const f of DATE_FIELDS) {
    if (out[f]) {
      const d = new Date(out[f]);
      if (!Number.isNaN(d.getTime())) out[f] = d;
    }
  }
  return out;
}

// Lit + parse + réhydrate les Dates. localStorage corrompu/illisible → [].
export function loadPersistedAlerts() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveDates);
  } catch {
    return [];
  }
}

// Écrit en localStorage. On élague les résolues (storage léger) — un re-fire après
// résolution recrée une alerte fraîche via reconcile (stableKey alors absente).
export function persistAlerts(alerts) {
  try {
    if (typeof localStorage === 'undefined') return;
    const aPersister = alerts.filter(a => a.state !== 'resolved');
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(aPersister));
  } catch {
    /* quota / mode privé / illisible : on ignore silencieusement, jamais de crash */
  }
}

export const useAlertsStore = create((set, get) => ({
  // Réhydratation au chargement du module (= au reload de page).
  alerts: loadPersistedAlerts(),

  add: (newAlerts) => {
    const alerts = [...newAlerts, ...get().alerts].slice(0, 500);
    set({ alerts });
    persistAlerts(alerts);
  },

  // Reconcile the store against a full scheduled-evaluation snapshot.
  // Called every scheduler tick with ALL conditions that currently match.
  reconcile: (incomingAlerts) => {
    const now = new Date();
    const s = get();

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

    const alerts = [...toAdd, ...updated].slice(0, 500);
    set({ alerts });
    persistAlerts(alerts);
  },

  acknowledge: (id) => {
    const alerts = get().alerts.map(a =>
      a.id === id ? { ...a, state: 'acknowledged', acknowledgedAt: new Date() } : a
    );
    set({ alerts });
    persistAlerts(alerts);
  },

  snooze: (id, until) => {
    const alerts = get().alerts.map(a =>
      a.id === id ? { ...a, state: 'snoozed', snoozedUntil: until } : a
    );
    set({ alerts });
    persistAlerts(alerts);
  },

  resolve: (id) => {
    const alerts = get().alerts.map(a =>
      a.id === id ? { ...a, state: 'resolved', resolvedAt: new Date() } : a
    );
    set({ alerts });
    persistAlerts(alerts);
  },

  remove: (id) => {
    const alerts = get().alerts.filter(a => a.id !== id);
    set({ alerts });
    persistAlerts(alerts);
  },

  // Vide la mémoire ET le localStorage (action explicite de purge).
  clear: () => {
    set({ alerts: [] });
    persistAlerts([]);
  },

  // Recharge l'état depuis localStorage (simulation de reload / réhydratation explicite).
  hydrateFromStorage: () => {
    set({ alerts: loadPersistedAlerts() });
  },

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
