function joursDepuis(d, now) {
  return Math.floor((now.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export const CHANTIER_EN_RETARD = {
  id: 'planning.chantier.retard',
  nom: 'Chantier en retard sur livraison',
  description: 'Date fin prévue dépassée pour un chantier actif',
  category: 'planning',
  trigger: 'schedule',
  cron: '0 8 * * *',
  severity: 'HIGH',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app', 'email'],
  cooldownMinutes: 60 * 24 * 2,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => c.statut === 'actif' && c.date_fin_prevue && new Date(c.date_fin_prevue) < ctx.now)
    .map(c => {
      const retard = joursDepuis(c.date_fin_prevue, ctx.now);
      const avPct = typeof c.pourcent_travaux_realises === 'number'
        ? (c.pourcent_travaux_realises).toFixed(0) + '%'
        : '?';
      return {
        contextRef: { type: 'chantier', id: c.id, label: c.nom },
        title: `${c.nom} : ${retard}j de retard livraison`,
        message: `Date prévue : ${new Date(c.date_fin_prevue).toLocaleDateString('fr-CH')}. Avancement ${avPct}.`,
        data: { joursRetard: retard },
        actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
      };
    }),
};

export const RETARD_AVANCEMENT = {
  id: 'planning.avancement.retard',
  nom: "Retard d'avancement significatif",
  description: "L'avancement travaux est très en retard sur le temps écoulé",
  category: 'planning',
  trigger: 'event',
  eventTypes: ['chantier.avancement.updated'],
  severity: 'MEDIUM',
  destinataires: ['conducteur'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => {
      if (c.statut !== 'actif') return false;
      const temps = c.pourcent_temps_ecoule;
      const travaux = c.pourcent_travaux_realises;
      if (typeof temps !== 'number' || typeof travaux !== 'number') return false;
      return temps >= 30 && (temps - travaux) > 15;
    })
    .map(c => ({
      contextRef: { type: 'chantier', id: c.id, label: c.nom },
      title: `Retard d'avancement : ${c.nom}`,
      message: `Temps écoulé ${c.pourcent_temps_ecoule.toFixed(0)}% vs travaux ${c.pourcent_travaux_realises.toFixed(0)}%.`,
      actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
    })),
};

export const PLANNING_RULES = [CHANTIER_EN_RETARD, RETARD_AVANCEMENT];
