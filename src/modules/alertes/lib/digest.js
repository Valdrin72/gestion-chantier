const SEVERITY_ORDER = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function genererDigestQuotidien(role, alerts, date = new Date()) {
  const alertsRole = alerts.filter(a => a.destinataires.includes(role) && a.state === 'active');

  const groupes = new Map();
  for (const a of alertsRole) {
    if (!groupes.has(a.severity)) groupes.set(a.severity, []);
    groupes.get(a.severity).push(a);
  }

  const sections = Array.from(groupes.entries())
    .sort((a, b) => (SEVERITY_ORDER[b[0]] ?? 0) - (SEVERITY_ORDER[a[0]] ?? 0))
    .map(([severity, items]) => ({ severity, alerts: items }));

  const criticalCount = (groupes.get('CRITICAL') ?? []).length;
  const highCount = (groupes.get('HIGH') ?? []).length;

  const resume = criticalCount > 0
    ? `${criticalCount} alerte(s) critique(s) à traiter immédiatement.`
    : highCount > 0
    ? `${highCount} alerte(s) haute priorité à examiner aujourd'hui.`
    : alertsRole.length > 0
    ? `${alertsRole.length} point(s) de vigilance, rien d'urgent.`
    : 'Tout est sous contrôle. Bonne journée.';

  return { role, date, totalAlertes: alertsRole.length, sections, resume };
}
