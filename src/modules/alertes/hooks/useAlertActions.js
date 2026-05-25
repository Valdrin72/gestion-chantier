import { useAlertsStore } from '../lib/store.js';

export function useAlertActions() {
  const acknowledge = useAlertsStore(s => s.acknowledge);
  const snooze = useAlertsStore(s => s.snooze);
  const resolve = useAlertsStore(s => s.resolve);

  return {
    acknowledge,
    snooze24h: (id) => {
      const until = new Date();
      until.setDate(until.getDate() + 1);
      snooze(id, until);
    },
    snooze7j: (id) => {
      const until = new Date();
      until.setDate(until.getDate() + 7);
      snooze(id, until);
    },
    resolve,
  };
}
