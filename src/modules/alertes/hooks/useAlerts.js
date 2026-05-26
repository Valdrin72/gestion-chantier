import { useMemo } from 'react';
import { useAlertsStore } from '../lib/store.js';

const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function useAlerts(filters) {
  const alerts = useAlertsStore(s => s.alerts);

  return useMemo(() => {
    const now = Date.now();
    // Recalcul getActive() inline pour éviter la sélection d'une méthode (instable)
    let list = alerts.filter(a => {
      if (a.state === 'resolved') return false;
      if (a.state === 'snoozed' && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return false;
      return true;
    });
    if (filters?.state === 'all') list = [...alerts];
    if (filters?.category) list = list.filter(a => a.category === filters.category);
    if (filters?.role) list = list.filter(a => a.destinataires.includes(filters.role));
    if (filters?.minSeverity) {
      const threshold = SEVERITY_ORDER[filters.minSeverity] ?? 0;
      list = list.filter(a => (SEVERITY_ORDER[a.severity] ?? 0) >= threshold);
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, filters?.category, filters?.role, filters?.minSeverity, filters?.state]);
}
