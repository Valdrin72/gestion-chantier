export const ECHECS_AUTH_REPETES = {
  id: 'securite.auth.echecs',
  nom: "5+ échecs d'authentification en 10 min",
  description: 'Tentative possible de brute force',
  category: 'securite',
  trigger: 'event',
  eventTypes: ['auth.login.failed'],
  severity: 'HIGH',
  destinataires: ['direction'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 30,
  evaluate: (ctx) => {
    const fenetre = new Date(ctx.now.getTime() - 10 * 60 * 1000);
    const echecsParUser = new Map();

    for (const a of ctx.audit) {
      if (a.type !== 'login_fail' || new Date(a.date) < fenetre) continue;
      echecsParUser.set(a.user_id, (echecsParUser.get(a.user_id) ?? 0) + 1);
    }

    return Array.from(echecsParUser.entries())
      .filter(([, count]) => count >= 5)
      .map(([userId, count]) => ({
        contextRef: { type: 'global', id: `auth-${userId}` },
        title: `${count} échecs auth pour ${userId}`,
        message: "Vérifier si tentative d'intrusion.",
        data: { userId, count },
      }));
  },
};

export const EXPORT_MASSIF = {
  id: 'securite.export.massif',
  nom: 'Export massif de données',
  description: 'Audit pour traçabilité fuite potentielle',
  category: 'securite',
  trigger: 'event',
  eventTypes: ['data.export'],
  severity: 'MEDIUM',
  destinataires: ['direction'],
  canaux: ['in_app'],
  cooldownMinutes: 60,
  evaluate: (ctx) => ctx.audit
    .filter(a => a.type === 'export')
    .filter(a => (ctx.now.getTime() - new Date(a.date).getTime()) < 60 * 1000)
    .map(a => ({
      contextRef: { type: 'global', id: `export-${a.id}` },
      title: `Export effectué par ${a.user_id}`,
      message: `Détails : ${JSON.stringify(a.details ?? {})}`,
    })),
};

export const SECURITE_RULES = [ECHECS_AUTH_REPETES, EXPORT_MASSIF];
