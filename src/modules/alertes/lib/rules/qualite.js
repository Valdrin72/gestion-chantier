function joursDepuis(d, now) {
  return Math.floor((now.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export const PV_NON_SIGNE = {
  id: 'qualite.pv.non_signe',
  nom: 'PV de chantier non signé depuis 7j',
  description: "Un procès-verbal attend signature depuis plus d'une semaine",
  category: 'qualite',
  trigger: 'schedule',
  cron: '0 9 * * *',
  severity: 'MEDIUM',
  destinataires: ['direction', 'conducteur'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 3,
  evaluate: (ctx) => ctx.pvs
    .filter(pv => !pv.signe && joursDepuis(pv.date, ctx.now) >= 7)
    .map(pv => {
      const chantier = ctx.chantiers.find(c => c.id === pv.chantier_id);
      return {
        contextRef: { type: 'chantier', id: pv.chantier_id, label: chantier?.nom },
        title: `PV non signé : ${chantier?.nom ?? pv.chantier_id}`,
        message: `Émis le ${new Date(pv.date).toLocaleDateString('fr-CH')}. Relancer client.`,
        actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
      };
    }),
};

export const PHOTOS_RECEPTION_MANQUANTES = {
  id: 'qualite.photos.reception',
  nom: 'Photos de réception manquantes',
  description: 'Chantier en réception sans photos taggées "reception"',
  category: 'qualite',
  trigger: 'event',
  eventTypes: ['chantier.statut.changed'],
  severity: 'MEDIUM',
  destinataires: ['conducteur', 'chef_equipe'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => c.statut === 'reception')
    .filter(c => !ctx.photos.some(p => p.chantier_id === c.id && p.tags.includes('reception')))
    .map(c => ({
      contextRef: { type: 'chantier', id: c.id, label: c.nom },
      title: `Photos réception : ${c.nom}`,
      message: 'Aucune photo taggée "reception". Documentation manquante.',
      actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
    })),
};

export const GARANTIE_EXPIRE = {
  id: 'qualite.garantie.expire',
  nom: 'Garantie expire dans 30 jours',
  description: 'Préparer libération retenue de garantie',
  category: 'qualite',
  trigger: 'schedule',
  cron: '0 9 * * 1',
  severity: 'LOW',
  destinataires: ['direction', 'administratif'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 30,
  evaluate: (ctx) => ctx.chantiers
    .filter(c => c.statut === 'cloture' && c.date_reception)
    .map(c => {
      const expiration = new Date(c.date_reception);
      expiration.setFullYear(expiration.getFullYear() + 2);
      const jours = Math.floor((expiration.getTime() - ctx.now.getTime()) / (1000 * 60 * 60 * 24));
      return { c, jours };
    })
    .filter(({ jours }) => jours > 0 && jours <= 30)
    .map(({ c, jours }) => ({
      contextRef: { type: 'chantier', id: c.id, label: c.nom },
      title: `Garantie ${c.nom} : J-${jours}`,
      message: `Garantie SIA 118 expire dans ${jours}j. Préparer libération retenue.`,
      actions: [{ label: 'Voir chantier', type: 'navigate', target: 'chantiers' }],
    })),
};

export const QUALITE_RULES = [PV_NON_SIGNE, PHOTOS_RECEPTION_MANQUANTES, GARANTIE_EXPIRE];
