export function calculerDSO(creances, ca, jours) {
  return ca > 0 ? (creances / ca) * jours : 0;
}

export function calculerDPO(dettes, achats, jours) {
  return achats > 0 ? (dettes / achats) * jours : 0;
}

export function calculerBFR({ creancesClients, stocks, travauxEnCours, dettesFournisseurs, acomptesRecus }) {
  return (creancesClients ?? 0) + (stocks ?? 0) + (travauxEnCours ?? 0) -
         (dettesFournisseurs ?? 0) - (acomptesRecus ?? 0);
}

export function interetsMoratoires(montant, joursRetard, taux = 0.05) {
  return montant * taux * joursRetard / 360;
}

export function delaiHypothequeLegale(dateDernierTravail) {
  const limite = new Date(dateDernierTravail);
  limite.setMonth(limite.getMonth() + 4);
  const joursRestants = Math.ceil((limite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { dateLimite: limite, joursRestants };
}

export function projectionSolde(soldeInitial, mouvements, joursProjection = 90) {
  const aujourd = new Date();
  aujourd.setHours(0, 0, 0, 0);
  let solde = soldeInitial;
  const resultats = [];

  for (let i = 0; i <= joursProjection; i++) {
    const date = new Date(aujourd);
    date.setDate(date.getDate() + i);
    const dateStr = date.toDateString();
    for (const m of mouvements) {
      if (new Date(m.date).toDateString() === dateStr) {
        solde += m.montant * m.probabilite;
      }
    }
    resultats.push({ date, solde: Math.round(solde * 100) / 100 });
  }
  return resultats;
}
