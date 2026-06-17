/**
 * Phase 7a — Pré-condition de complétude du switchover pointages.
 *
 * RISQUE DÉSAMORCÉ (🔴) : un chantier "legacy" peut avoir des heures dans son journal
 * MAIS aucun pointage référençant son chantierId (migration Phase 3 incomplète, ou
 * chantier créé avant migration alors que d'autres avaient déjà des pointages).
 * Dans ce cas, regenererJournalDepuisPointages() régénère son journal à [] →
 * TOUTES ses heures disparaissent silencieusement (CA et coûts à zéro).
 *
 * Cette fonction détecte ces chantiers et crée les pointages manquants à partir de
 * leur journal (via la migration existante migrerJournalVersPointages), AVANT toute
 * régénération. Les nouveaux pointages sont fusionnés dans le tableau existant en
 * respectant l'unicité (date, employeId) du modèle Pointage : un pointage existant
 * sur une autre repartition reçoit une repartition supplémentaire plutôt qu'un doublon.
 *
 * IDEMPOTENTE : après exécution, chaque chantier concerné A des pointages → un second
 * appel ne détecte plus rien et retourne le tableau inchangé (référence identique).
 *
 * PURE : aucun effet de bord, retourne un nouveau tableau (ou l'original si rien à faire).
 */

import { migrerJournalVersPointages } from './migrerJournalVersPointages';

/**
 * @param {Object[]} chantiers - chantiers avec chantier.journal[] (format groupé)
 * @param {import('../types/pointage').Pointage[]} pointages - pointages actuels
 * @param {Object[]} employes - parametres.employes
 * @returns {{ pointages: import('../types/pointage').Pointage[], migres: number, chantiersMigres: (string|number)[] }}
 */
export function completerPointagesDepuisJournal(chantiers, pointages = [], employes = []) {
  // Chantiers déjà couverts par au moins un pointage.
  const chantiersAvecPointage = new Set();
  for (const p of (pointages || [])) {
    for (const r of (p.repartitions || [])) {
      if (r.chantierId != null) chantiersAvecPointage.add(String(r.chantierId));
    }
  }

  // Chantiers à migrer : journal avec heures réelles MAIS aucun pointage sur leur id.
  const aMigrer = (chantiers || []).filter(c => {
    const journal = c?.journal;
    if (!Array.isArray(journal) || journal.length === 0) return false;
    const aDesHeures = journal.some(e =>
      (e.employes || []).some(em => (parseFloat(em.heuresTravaillees) || 0) > 0)
    );
    return aDesHeures && !chantiersAvecPointage.has(String(c.id));
  });

  if (aMigrer.length === 0) {
    return { pointages, migres: 0, chantiersMigres: [] };
  }

  const nouveaux = migrerJournalVersPointages(aMigrer, employes);

  // Fusion par (date, employeId) — respecte l'unicité du modèle Pointage.
  const cle = (date, empId) => `${date}_${parseInt(empId)}`;
  // Clone défensif des pointages existants (on ne mute jamais l'entrée d'origine).
  const resultat = (pointages || []).map(p => ({ ...p, repartitions: [...(p.repartitions || [])] }));
  const index = new Map();
  resultat.forEach(p => index.set(cle(p.date, p.employeId), p));

  for (const np of nouveaux) {
    const k = cle(np.date, np.employeId);
    const existant = index.get(k);
    if (existant) {
      existant.repartitions.push(...np.repartitions);
    } else {
      resultat.push(np);
      index.set(k, np);
    }
  }

  return { pointages: resultat, migres: nouveaux.length, chantiersMigres: aMigrer.map(c => c.id) };
}
