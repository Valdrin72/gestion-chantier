import { AlertEngine } from './lib/engine.js';
import { AlertScheduler } from './lib/scheduler.js';
import { NotificationRouter, InAppAdapter } from './lib/notifications.js';
import { ALL_RULES } from './lib/rules/index.js';
import { useAlertsStore } from './lib/store.js';

export function bootstrapAlertSystem(contextProvider, schedulerIntervalMs = 5 * 60 * 1000) {
  const engine = new AlertEngine(ALL_RULES);
  const router = new NotificationRouter();
  router.register(new InAppAdapter());

  // Réhydrate l'état persisté (acquittements/snooze) avant le premier tick.
  // Le premier reconcile (scheduler.start → tick initial) fait le ménage :
  // condition encore active → reste acquittée ; condition disparue → auto-résolue.
  useAlertsStore.getState().hydrateFromStorage();

  // Event-triggered and evaluateAll alerts: additive (no reconciliation needed).
  engine.subscribe(async (alerts) => {
    useAlertsStore.getState().add(alerts);
    await router.route(alerts);
  });

  // Scheduled evaluation: full snapshot every tick → reconcile the store.
  // subscribeScheduled is always called, even with 0 alerts, so disappeared
  // conditions are auto-resolved.
  engine.subscribeScheduled(async (scheduledAlerts) => {
    useAlertsStore.getState().reconcile(scheduledAlerts);
    if (scheduledAlerts.length > 0) await router.route(scheduledAlerts);
  });

  const scheduler = new AlertScheduler(engine, contextProvider, schedulerIntervalMs);
  scheduler.start();

  return {
    engine,
    scheduler,
    router,
    dispatchEvent: async (event) => {
      const ctx = await contextProvider();
      engine.evaluateForEvent(event, ctx);
    },
    evaluateNow: async () => {
      const ctx = await contextProvider();
      engine.evaluateAll(ctx);
    },
    stop: () => scheduler.stop(),
  };
}
