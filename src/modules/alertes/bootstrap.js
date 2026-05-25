import { AlertEngine } from './lib/engine.js';
import { AlertScheduler } from './lib/scheduler.js';
import { NotificationRouter, InAppAdapter } from './lib/notifications.js';
import { ALL_RULES } from './lib/rules/index.js';
import { useAlertsStore } from './lib/store.js';

export function bootstrapAlertSystem(contextProvider, schedulerIntervalMs = 5 * 60 * 1000) {
  const engine = new AlertEngine(ALL_RULES);
  const router = new NotificationRouter();
  router.register(new InAppAdapter());

  engine.subscribe(async (alerts) => {
    useAlertsStore.getState().add(alerts);
    await router.route(alerts);
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
