export const HEURES_SUP_ELEVEES = {
  id: 'rh.heures_sup.mois',
  nom: 'Heures supplémentaires élevées sur le mois',
  description: "Un employé dépasse 25h sup sur le mois en cours",
  category: 'rh',
  trigger: 'schedule',
  cron: '0 9 * * 1',
  severity: 'MEDIUM',
  destinataires: ['direction', 'administratif'],
  canaux: ['in_app'],
  cooldownMinutes: 60 * 24 * 7,
  evaluate: (ctx) => {
    const debutMois = new Date(ctx.now.getFullYear(), ctx.now.getMonth(), 1);
    const heuresSupParEmp = new Map();

    for (const p of ctx.pointages) {
      if (new Date(p.date) < debutMois) continue;
      heuresSupParEmp.set(p.employe_id, (heuresSupParEmp.get(p.employe_id) ?? 0) + (p.heures_sup || 0));
    }

    const alerts = [];
    for (const [empId, totalSup] of heuresSupParEmp) {
      if (totalSup <= 25) continue;
      const emp = ctx.employes.find(e => e.id === empId);
      if (!emp) continue;
      alerts.push({
        contextRef: { type: 'employe', id: empId, label: `${emp.prenom} ${emp.nom}` },
        title: `${emp.prenom} ${emp.nom} : ${totalSup.toFixed(0)}h sup ce mois`,
        message: 'Risque de surcharge. Compensation à organiser.',
        data: { totalSup },
        actions: [{ label: 'Voir employés', type: 'navigate', target: 'employes' }],
      });
    }
    return alerts;
  },
};

export const RH_RULES = [HEURES_SUP_ELEVEES];
