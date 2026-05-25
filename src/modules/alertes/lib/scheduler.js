export class AlertScheduler {
  constructor(engine, contextProvider, intervalMs = 5 * 60 * 1000) {
    this.engine = engine;
    this.contextProvider = contextProvider;
    this.intervalMs = intervalMs;
    this.intervalId = null;
  }

  start() {
    if (this.intervalId) return;
    this._tick().catch(err => console.error('[Scheduler] Initial tick failed:', err));
    this.intervalId = setInterval(() => {
      this._tick().catch(err => console.error('[Scheduler] Tick failed:', err));
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async _tick() {
    const ctx = await this.contextProvider();
    this.engine.evaluateScheduled(ctx);
  }

  async runOnce() {
    return this._tick();
  }
}
