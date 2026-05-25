export class InAppAdapter {
  constructor() { this.channel = 'in_app'; }
  async send(_alert) { /* handled by store */ }
}

export class EmailAdapter {
  constructor(sendFn) {
    this.channel = 'email';
    this.sendFn = sendFn;
  }

  async send(alert) {
    const subject = `[CYNA ${alert.severity}] ${alert.title}`;
    const body = [
      alert.message,
      '',
      ...(alert.actions?.map(a => `→ ${a.label}`) ?? []),
    ].join('\n');
    const emails = this._rolesToEmails(alert.destinataires);
    if (emails.length === 0) return;
    await this.sendFn(emails, subject, body);
  }

  _rolesToEmails(_roles) {
    // Branch on user module when available
    return [];
  }
}

export class NotificationRouter {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    this.adapters.set(adapter.channel, adapter);
  }

  async route(alerts) {
    for (const alert of alerts) {
      for (const channel of alert.canaux) {
        const adapter = this.adapters.get(channel);
        if (!adapter) continue;
        try { await adapter.send(alert); }
        catch (err) { console.error(`[NotificationRouter] ${channel} failed:`, err); }
      }
    }
  }
}
