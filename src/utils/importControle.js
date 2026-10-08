import { totalHeuresPointages } from './importGuard';

export const LIMITE_IMPORT = 20 * 1024 * 1024;
export const LISTES_IMPORT = ['chantiers', 'devis', 'factures', 'clients'];
const objet = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const vide = v => v === undefined || v === null || v === '';
const numerique = v => vide(v) || (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && /^\s*-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v) && Number.isFinite(parseFloat(v)));
const dateValide = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export const CHAMPS_NUMERIQUES = {
  devis: ['montantHT', 'tva', 'prixPropose', 'surface', 'coutMateriel', 'coutTransport', 'coutSousTraitance', 'nombreJours', 'dureeEstimee', 'nombrePersonnes'],
  factures: ['montantHT', 'montantTVA', 'montantTTC', 'montantPaye', 'tva', 'pourcentage'],
  chantiers: ['montantDevis', 'montantFacture', 'surface', 'nombreJours', 'avancement', 'coutMaterielPrevu', 'coutSousTraitancePrevu', 'autresCoutsPrevu', 'coutMaterielReel', 'coutSousTraitanceReel', 'autresCoutsReel', 'materielReel', 'sousTraitanceReelle', 'autresCoutsReels', 'nombrePersonnes'],
};
const CHAMPS_NUMERIQUES_PLAN = {
  devis: ['montantHT', 'tva'],
  factures: ['montantHT', 'montantTVA', 'montantTTC', 'montantPaye'],
  chantiers: ['montantDevis', 'montantFacture'],
};
export function verifierSauvegarde(data, { tailleOctets = 0 } = {}) {
  const erreurs = [], anomalies = [], ignorees = [], donnees = {};
  const resultat = { erreurs, anomalies, ignorees, donnees };
  if (tailleOctets > LIMITE_IMPORT) erreurs.push('Le fichier dépasse 20 Mo.');
  if (!objet(data)) { erreurs.push('La racine de la sauvegarde doit être un objet.'); return resultat; }
  function nombres(o, champs, lieu, strict = false, avertir = false) {
    for (const champ of champs) {
      const v = o[champ];
      if (strict ? typeof v === 'number' && Number.isFinite(v) : numerique(v)) continue;
      const texte = JSON.stringify(v) ?? String(v);
      (avertir ? anomalies : erreurs).push(typeof v === 'string' && v.includes(',')
        ? `${lieu} : ${champ} ${texte} utilise une virgule ; utilisez un point (${v.replace(',', '.')})`
        : `${lieu} : ${champ} ${texte} ${strict ? 'doit être un nombre fini' : "n’est pas un nombre fini"}`);
    }
  }
  function valeursSimples(o, champ, lieu, identifiants = false, avertirForme = false) {
    const v = o[champ];
    if (v == null) return;
    if (!Array.isArray(v)) (avertirForme ? anomalies : erreurs).push(`${lieu} : ${champ} doit être une liste`);
    else if (v.some(x => typeof x !== 'string' && !(identifiants && typeof x === 'number' && Number.isFinite(x)))) anomalies.push(`${lieu} : ${champ} doit être une liste de ${identifiants ? 'chaînes ou nombres finis' : 'textes'}`);
  }
  function collection(o, champ, lieu, champs = [], obligatoire = false, strict = false) {
    const v = o[champ];
    if (v == null && !obligatoire) return;
    if (!Array.isArray(v)) { erreurs.push(`${lieu} : ${champ} doit être une liste`); return; }
    v.forEach((entree, i) => {
      const position = `${lieu}, ${champ} n° ${i + 1}`;
      if (!objet(entree)) {
        (lieu === 'parametres' && champ === 'typesTravaux' && entree != null ? anomalies : erreurs).push(`${position} doit être un objet non nul`);
        return;
      }
      nombres(entree, champs, position, strict, !['lignes','paiementsHistorique','avenants','heuresRegie','imprevus','repartitions'].includes(champ));
      if (champ === 'journal') {
        if (entree.date != null && !dateValide(entree.date)) erreurs.push(`${position} : date ${JSON.stringify(entree.date)} invalide (attendu AAAA-MM-JJ)`);
        collection(entree, 'employes', position, ['heuresTravaillees']);
        valeursSimples(entree, 'employesPresents', position, true, true);
        nombres(entree, ['heuresTravaillees'], position, false, true);
      }
    });
  }
  if (!objet(data.parametres)) erreurs.push('parametres doit être un objet');
  else {
    donnees.parametres = data.parametres;
    collection(data.parametres, 'employes', 'parametres');
    collection(data.parametres, 'typesTravaux', 'parametres');
    const ids = data.parametres.idsSupprimes;
    if (ids !== undefined) {
      if (!objet(ids)) erreurs.push('parametres.idsSupprimes doit être un objet');
      else for (const [cle, valeurs] of Object.entries(ids)) if (!Array.isArray(valeurs) || valeurs.some(v => typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)))) erreurs.push(`parametres.idsSupprimes.${cle} doit être une liste d’identifiants`);
    }
  }
  for (const liste of [...LISTES_IMPORT, 'pointages']) {
    if (liste === 'pointages' && !Object.prototype.hasOwnProperty.call(data, liste)) { anomalies.push('Ancien format sans pointages : les heures actuelles sont conservées.'); continue; }
    if (!Array.isArray(data[liste])) { erreurs.push(`${liste} doit être une liste`); continue; }
    donnees[liste] = data[liste];
    const ids = new Set();
    data[liste].forEach((e, i) => {
      const lieu = `${({chantiers:'Chantier',devis:'Devis',factures:'Facture',clients:'Client',pointages:'Pointage'})[liste]} n° ${i+1} (id ${e?.id ?? 'absent'})`;
      if (!objet(e)) { erreurs.push(`${lieu} doit être un objet non nul`); return; }
      if (vide(e.id)) erreurs.push(`${lieu} : id manquant`);
      else if (ids.has(String(e.id))) erreurs.push(`${lieu} : id en double`);
      ids.add(String(e.id));
      nombres(e, CHAMPS_NUMERIQUES_PLAN[liste] || [], lieu);
      nombres(e, (CHAMPS_NUMERIQUES[liste] || []).filter(k => !CHAMPS_NUMERIQUES_PLAN[liste]?.includes(k)), lieu, false, true);
      if (['chantiers', 'devis', 'factures'].includes(liste) && e.statut != null && typeof e.statut !== 'string') anomalies.push(`${lieu} : statut doit être un texte`);
      if (liste === 'chantiers' || liste === 'devis') valeursSimples(e, 'typesTravaux', lieu);
      if (liste === 'chantiers') valeursSimples(e, 'employes', lieu, true, true);
      if (liste === 'devis' || liste === 'factures') collection(e, 'lignes', lieu, ['quantite', 'prixUnitaire', 'tva']);
      if (liste === 'devis' || liste === 'chantiers') {
        if (liste === 'chantiers' && e.avenants != null && !Array.isArray(e.avenants)) nombres(e, ['avenants'], lieu);
        else collection(e, 'avenants', lieu, ['montant']);
      }
      if (liste === 'devis') { collection(e, 'heuresRegie', lieu, ['heures', 'tarifHeure']); collection(e, 'equipe', lieu, ['joursPlannifies', 'joursRealises']); }
      if (liste === 'factures') { collection(e, 'paiementsHistorique', lieu, ['montant']); collection(e, 'rappels', lieu, ['niveau']); }
      if (liste === 'chantiers') {
        collection(e, 'imprevus', lieu, ['montant']); collection(e, 'extras', lieu, ['montantForfait', 'heures', 'tarifHeure']);
        collection(e, 'equipe', lieu, ['joursPlannifies', 'joursRealises']); collection(e, 'journal', lieu);
      }
      if (liste === 'pointages') {
        if (!dateValide(e.date)) erreurs.push(`${lieu} : date ${JSON.stringify(e.date)} invalide (attendu AAAA-MM-JJ)`);
        collection(e, 'repartitions', lieu, ['heures'], true, true);
        collection(e, 'majoration', lieu, ['heures', 'facteur', 'cout_supplementaire']);
        if (e.deplacement != null) {
          if (!objet(e.deplacement)) anomalies.push(`${lieu} : deplacement doit être un objet`);
          else nombres(e.deplacement, ['indemnite_chf', 'duree_h'], `${lieu}, deplacement`, false, true);
        }
      }
    });
  }
  for (const [liste, refs] of Object.entries({chantiers:{clientId:'clients',devisId:'devis'},factures:{chantierId:'chantiers',clientId:'clients'},devis:{clientId:'clients'}})) {
    for (const e of donnees[liste] || []) if (objet(e)) for (const [champ, cible] of Object.entries(refs)) {
      if (!vide(e[champ]) && !(donnees[cible] || []).some(x => objet(x) && String(x.id) === String(e[champ]))) anomalies.push(`${liste} (id ${e.id}) : ${champ} ${e[champ]} absent de ${cible}`);
    }
  }
  ignorees.push(...Object.keys(data).filter(k => ![...LISTES_IMPORT, 'parametres', 'pointages'].includes(k)));
  return resultat;
}
export function instantaneComplet(etat, maintenant = new Date()) {
  const listes = etat.listesCompletes || etat;
  return { meta: { date: new Date(maintenant).toISOString(), version: 1, app: 'CYNA', source: 'avant-import' },
    ...Object.fromEntries(LISTES_IMPORT.map(k => [k, listes[k] || []])), parametres: etat.parametres, pointages: etat.pointages || [] };
}
export function resumerImport(actuel, donnees) {
  const avant = actuel.listesCompletes || actuel;
  const ancienFormat = !Object.prototype.hasOwnProperty.call(donnees, 'pointages');
  const heuresActuelles = totalHeuresPointages(actuel.pointages), heuresImportees = ancienFormat ? heuresActuelles : totalHeuresPointages(donnees.pointages);
  const corbeille = d => ['devis','clients','chantiers'].reduce((n,k) => n + (d[k] || []).filter(e => e.supprime_le).length, 0);
  return { date: donnees.meta?.date || donnees.date || 'date inconnue', ancienFormat, heuresActuelles, heuresImportees,
    lignes: [...LISTES_IMPORT.map(k => ({label:({chantiers:'Chantiers',devis:'Devis',factures:'Factures',clients:'Clients'})[k], actuel:(avant[k] || []).length, sauvegarde:donnees[k].length})),
      {label:'Pointages', actuel:(actuel.pointages || []).length, sauvegarde:ancienFormat ? (actuel.pointages || []).length : donnees.pointages.length},
      {label:'Heures', actuel:heuresActuelles, sauvegarde:heuresImportees}, {label:'Corbeille', actuel:corbeille(avant), sauvegarde:corbeille(donnees)}] };
}
export function telechargerTexte(texte, nom) {
  const blob = new Blob([texte], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try { const a = document.createElement('a'); a.href = url; a.download = nom; a.click(); }
  finally { URL.revokeObjectURL(url); }
}
