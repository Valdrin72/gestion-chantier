import { useAlertsStore } from '../lib/store.js';

export function useAlertCount(filter) {
  return useAlertsStore(s => s.countActive(filter));
}

export function useUrgentCount(role) {
  return useAlertsStore(s => s.countActive({ severity: ['HIGH', 'CRITICAL'], role }));
}
