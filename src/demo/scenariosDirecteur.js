// CYNA SÀRL — Simulateur de scénarios pour le "Directeur du matin"
//
// SÉCURITÉ : ce module ne fait que GÉNÉRER des données d'entrée fictives, cohérentes
// avec le modèle réel (chantiers, devis, factures, pointages). Il ne truque AUCUN
// résultat : les moteurs de calcul et le score santé s'appliquent normalement dessus.
// Le chargement/reset se fait UNIQUEMENT en mode démo (voir SimulateurScenarios.js).
//
// Toutes les entités sont clairement marquées « SIMULATION — » pour qu'aucune confusion
// avec de vraies données ne soit possible. Rien ne persiste après un reset.

import { donneesDemo } from '../donnees-demo';
import { migrerJournalVersPointages } from '../migration/migrerJournalVersPointages';

const MARQUE = 'SIMULATION —';
const TVA = 1.081;

// Config de base réutilisée (employés, tarifs, localités, types) — sans les entités métier.
const { chantiers: _c, devis: _d, factures: _f, clients: _cl, ...CONFIG_BASE } = donneesDemo;
const EMPLOYES = CONFIG_BASE.employes;

// ── Helpers dates (locales, sans dérive UTC) ──────────────────────────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ilYaJours(now, n) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}
// `count` jours ouvrés (lun–ven) récents, finissant hier, ordre chronologique.
function joursOuvresRecents(now, count) {
  const out = [];
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  while (out.length < count) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.push(fmtDate(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

// ── Builders d'entités (mêmes champs canoniques que donnees-demo.js) ──────────
function jour(date, employeIds) {
  return { date, employes: employeIds.map(id => ({ employeId: id, heuresTravaillees: 8 })) };
}

function bClient({ id, nom, prenom, entreprise, canton = 'GE', ville = 'Genève' }) {
  return {
    id, nom, prenom, entreprise: `${MARQUE} ${entreprise}`,
    telephone: '022 000 00 00', email: 'demo@simulation.ch',
    adresse: 'Rue de la Démo 1', ville, canton, type: 'Entreprise',
    notes: 'Client fictif — scénario de simulation',
  };
}

function bDevis({ id, clientId, montantHT, statut = 'accepté', date }) {
  return {
    id, numero: `SIM-DEV-${id}`, clientId, date, statut,
    zone: 'Genève', typeTravaux: 'Cloisons amovibles', typesTravaux: ['Cloisons amovibles'],
    surface: 200, dureeEstimee: 20, complexite: 'Normale', urgence: 'Non', acces: 'Normal',
    coutMateriel: Math.round(montantHT * 0.25), coutTransport: 500, coutSousTraitance: 0,
    margeCible: 25, montantHT, prixPropose: montantHT, heuresRegie: [], avenants: [],
    notes: 'Devis fictif — scénario de simulation',
  };
}

function bChantier({ id, nom, clientId, devisId, canton = 'GE', ville = 'Genève', nombreJours,
  statut = 'En cours', materielReel, sousTraitanceReelle = 0, autresCoutsReels = 0,
  equipeIds, nbJoursJournal, now }) {
  const dates = joursOuvresRecents(now, nbJoursJournal);
  return {
    id, numero: `SIM-CH-${id}`, nom: `${MARQUE} ${nom}`,
    clientId, devisId, conducteur: EMPLOYES[0].nom,
    adresse: 'Chantier de démonstration', ville, canton,
    dateDebut: dates[0] || ilYaJours(now, 40), nombreJours, inclusSamedi: false,
    statut, priorite: 'Normale', typesTravaux: ['Cloisons amovibles'], surface: 200,
    equipe: equipeIds.map(eid => ({ employeId: eid, joursPlannifies: nombreJours })),
    coutMaterielPrevu: materielReel, materielReel,
    coutSousTraitancePrevu: sousTraitanceReelle, sousTraitanceReelle,
    autresCoutsPrevu: autresCoutsReels, autresCoutsReels,
    imprevus: [], avenants: [], notes: 'Chantier fictif — scénario de simulation',
    journal: dates.map(dt => jour(dt, equipeIds)),
  };
}

function bFacture({ id, clientId, chantierId, devisId, montantHT, statut, emissionIlYa, echeanceIlYa, montantPaye = 0, now }) {
  const montantTTC = Math.round(montantHT * TVA * 100) / 100;
  return {
    id, numero: `SIM-F-${id}`, clientId, chantierId, devisId, type: 'situation', statut,
    dateEmission: ilYaJours(now, emissionIlYa),
    dateEcheance: ilYaJours(now, echeanceIlYa),
    datePaiement: statut === 'payee' ? ilYaJours(now, Math.max(0, echeanceIlYa - 5)) : null,
    montantHT, tva: 8.1, montantTTC,
    montantPaye: statut === 'payee' ? montantTTC : montantPaye,
    paiementsHistorique: [], objet: 'Facture fictive — scénario de simulation',
    notes: 'Scénario de simulation',
  };
}

// Assemble un jeu complet + config trésorerie, et dérive les pointages.
function assembler({ clients, devis, chantiers, factures, treso }) {
  const parametres = {
    ...CONFIG_BASE,
    parametres: { ...CONFIG_BASE.parametres, ...treso },
    // Drapeaux migration neutralisés : le journal fourni fait foi, pas de re-migration destructrice.
    migrationJournalV2Done: true, backfillMajorationPhase4Done: true, backfillCoefMO10Done: true,
  };
  const pointages = migrerJournalVersPointages(chantiers, EMPLOYES);
  return { clients, devis, chantiers, factures, pointages, parametres };
}

// ══════════════════════════════════════════════════════════════════════════════
// LES 5 SCÉNARIOS
// ══════════════════════════════════════════════════════════════════════════════

// 🟢 1 — Tout roule : chantiers rentables, trésorerie confortable, factures à jour.
function scToutRoule(now) {
  const clients = [
    bClient({ id: 1, nom: 'Favre', prenom: 'Léa', entreprise: 'Alpha Bureaux SA' }),
    bClient({ id: 2, nom: 'Girard', prenom: 'Paul', entreprise: 'Beta Immo' }),
  ];
  const devis = [
    bDevis({ id: 1, clientId: 1, montantHT: 120000, date: ilYaJours(now, 60) }),
    bDevis({ id: 2, clientId: 2, montantHT: 90000, date: ilYaJours(now, 45) }),
    bDevis({ id: 3, clientId: 1, montantHT: 70000, date: ilYaJours(now, 30) }),
  ];
  const chantiers = [
    bChantier({ id: 1, nom: 'Bureaux Alpha', clientId: 1, devisId: 1, materielReel: 18000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 15, now }),
    bChantier({ id: 2, nom: 'Résidence Beta', clientId: 2, devisId: 2, materielReel: 14000, autresCoutsReels: 1500, equipeIds: [5, 6], nombreJours: 25, nbJoursJournal: 12, now }),
    bChantier({ id: 3, nom: 'Atelier Alpha 2', clientId: 1, devisId: 3, materielReel: 10000, autresCoutsReels: 1000, equipeIds: [8, 9], nombreJours: 20, nbJoursJournal: 10, now }),
  ];
  const factures = [
    bFacture({ id: 1, clientId: 1, chantierId: 1, devisId: 1, montantHT: 70000, statut: 'payee', emissionIlYa: 40, echeanceIlYa: 10, now }),
    bFacture({ id: 2, clientId: 2, chantierId: 2, devisId: 2, montantHT: 50000, statut: 'payee', emissionIlYa: 30, echeanceIlYa: 5, now }),
  ];
  return assembler({ clients, devis, chantiers, factures, treso: {
    soldeBancaire: 160000, soldeBancaireDate: ilYaJours(now, 2), seuilTresorerie: 20000, chargesMensuelles: 45000,
  } });
}

// 🟠 2 — Trésorerie qui se tend : rentable MAIS solde bas + grosses sorties → sous le seuil.
function scTresorerieTendue(now) {
  const clients = [bClient({ id: 1, nom: 'Favre', prenom: 'Léa', entreprise: 'Alpha Bureaux SA' })];
  const devis = [
    bDevis({ id: 1, clientId: 1, montantHT: 120000, date: ilYaJours(now, 60) }),
    bDevis({ id: 2, clientId: 1, montantHT: 90000, date: ilYaJours(now, 45) }),
  ];
  const chantiers = [
    bChantier({ id: 1, nom: 'Bureaux Alpha', clientId: 1, devisId: 1, materielReel: 18000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 15, now }),
    bChantier({ id: 2, nom: 'Résidence Alpha 2', clientId: 1, devisId: 2, materielReel: 14000, autresCoutsReels: 1500, equipeIds: [5, 6], nombreJours: 25, nbJoursJournal: 12, now }),
  ];
  // Peu de créances entrantes (petite facture récente) → l'encaissement ne sauve pas la trésorerie.
  const factures = [
    bFacture({ id: 1, clientId: 1, chantierId: 1, devisId: 1, montantHT: 60000, statut: 'payee', emissionIlYa: 40, echeanceIlYa: 10, now }),
    bFacture({ id: 2, clientId: 1, chantierId: 2, devisId: 2, montantHT: 9000, statut: 'envoyee', emissionIlYa: 8, echeanceIlYa: -20, now }),
  ];
  return assembler({ clients, devis, chantiers, factures, treso: {
    // solde 40k + ~9.7k encaissés − 45k sorties ≈ 4.7k → 0 ≤ projeté < seuil 20k (pénalité trésorerie).
    soldeBancaire: 40000, soldeBancaireDate: ilYaJours(now, 2), seuilTresorerie: 20000, chargesMensuelles: 45000,
  } });
}

// 🔴 3 — Chantier qui dérape : un chantier clairement en perte (coûts réels > CA).
function scChantierDerape(now) {
  const clients = [
    bClient({ id: 1, nom: 'Favre', prenom: 'Léa', entreprise: 'Alpha Bureaux SA' }),
    bClient({ id: 2, nom: 'Girard', prenom: 'Paul', entreprise: 'Beta Immo' }),
  ];
  const devis = [
    bDevis({ id: 1, clientId: 1, montantHT: 100000, date: ilYaJours(now, 60) }),
    bDevis({ id: 2, clientId: 2, montantHT: 40000, date: ilYaJours(now, 50) }),
  ];
  const chantiers = [
    bChantier({ id: 1, nom: 'Bureaux Alpha', clientId: 1, devisId: 1, materielReel: 16000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 15, now }),
    // Perte : CA 40k, coûts ≈ MO 20j×1350 (27k) + matériel 30k + ST 5k + 2k ≈ 64k >> 40k.
    bChantier({ id: 2, nom: 'Villa Beta EN PERTE', clientId: 2, devisId: 2, materielReel: 30000, sousTraitanceReelle: 5000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 20, now }),
  ];
  const factures = [
    bFacture({ id: 1, clientId: 1, chantierId: 1, devisId: 1, montantHT: 60000, statut: 'payee', emissionIlYa: 30, echeanceIlYa: 5, now }),
  ];
  return assembler({ clients, devis, chantiers, factures, treso: {
    soldeBancaire: 120000, soldeBancaireDate: ilYaJours(now, 2), seuilTresorerie: 20000, chargesMensuelles: 45000,
  } });
}

// 🟡 4 — Retards d'encaissement : plusieurs factures anciennes impayées (>30/>60/>90j).
function scRetardsEncaissement(now) {
  const clients = [
    bClient({ id: 1, nom: 'Favre', prenom: 'Léa', entreprise: 'Alpha Bureaux SA' }),
    bClient({ id: 2, nom: 'Girard', prenom: 'Paul', entreprise: 'Beta Immo' }),
  ];
  const devis = [
    bDevis({ id: 1, clientId: 1, montantHT: 120000, date: ilYaJours(now, 70) }),
    bDevis({ id: 2, clientId: 2, montantHT: 80000, date: ilYaJours(now, 60) }),
  ];
  const chantiers = [
    bChantier({ id: 1, nom: 'Bureaux Alpha', clientId: 1, devisId: 1, materielReel: 18000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 15, now }),
    bChantier({ id: 2, nom: 'Résidence Beta', clientId: 2, devisId: 2, materielReel: 14000, autresCoutsReels: 1500, equipeIds: [5, 6], nombreJours: 25, nbJoursJournal: 12, now }),
  ];
  const factures = [
    bFacture({ id: 1, clientId: 1, chantierId: 1, devisId: 1, montantHT: 32000, statut: 'envoyee', emissionIlYa: 95, echeanceIlYa: 65, now }),
    bFacture({ id: 2, clientId: 2, chantierId: 2, devisId: 2, montantHT: 22000, statut: 'envoyee', emissionIlYa: 70, echeanceIlYa: 40, now }),
    bFacture({ id: 3, clientId: 1, chantierId: 1, devisId: 1, montantHT: 12000, statut: 'envoyee', emissionIlYa: 40, echeanceIlYa: 10, now }),
  ];
  return assembler({ clients, devis, chantiers, factures, treso: {
    soldeBancaire: 90000, soldeBancaireDate: ilYaJours(now, 2), seuilTresorerie: 20000, chargesMensuelles: 45000,
  } });
}

// ⚫ 5 — Plusieurs problèmes : trésorerie tendue + 1 chantier en perte + impayés anciens.
function scPlusieursProblemes(now) {
  const clients = [
    bClient({ id: 1, nom: 'Favre', prenom: 'Léa', entreprise: 'Alpha Bureaux SA' }),
    bClient({ id: 2, nom: 'Girard', prenom: 'Paul', entreprise: 'Beta Immo' }),
  ];
  const devis = [
    bDevis({ id: 1, clientId: 1, montantHT: 100000, date: ilYaJours(now, 70) }),
    bDevis({ id: 2, clientId: 2, montantHT: 40000, date: ilYaJours(now, 55) }),
  ];
  const chantiers = [
    bChantier({ id: 1, nom: 'Bureaux Alpha', clientId: 1, devisId: 1, materielReel: 16000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 15, now }),
    bChantier({ id: 2, nom: 'Villa Beta EN PERTE', clientId: 2, devisId: 2, materielReel: 30000, sousTraitanceReelle: 5000, autresCoutsReels: 2000, equipeIds: [1, 2, 3], nombreJours: 30, nbJoursJournal: 20, now }),
  ];
  const factures = [
    bFacture({ id: 1, clientId: 1, chantierId: 1, devisId: 1, montantHT: 30000, statut: 'envoyee', emissionIlYa: 95, echeanceIlYa: 65, now }),
    bFacture({ id: 2, clientId: 2, chantierId: 2, devisId: 2, montantHT: 18000, statut: 'envoyee', emissionIlYa: 70, echeanceIlYa: 40, now }),
  ];
  return assembler({ clients, devis, chantiers, factures, treso: {
    // solde 20k + créances − 130k de sorties (mois de grosses charges) → projeté NÉGATIF (survie).
    soldeBancaire: 20000, soldeBancaireDate: ilYaJours(now, 2), seuilTresorerie: 20000, chargesMensuelles: 130000,
  } });
}

// ── Catalogue exporté ─────────────────────────────────────────────────────────
export const SCENARIOS = [
  { id: 'tout-roule',        emoji: '🟢', titre: 'Tout roule',              description: '3 chantiers rentables, trésorerie confortable, factures à jour.', attendu: 'Score vert, peu d\'actions.',                         construire: scToutRoule },
  { id: 'tresorerie-tendue', emoji: '🟠', titre: 'Trésorerie qui se tend',  description: 'Chantiers rentables mais solde bas + grosses sorties à venir.',   attendu: 'Le score baisse malgré la rentabilité, trésorerie en tête.', construire: scTresorerieTendue },
  { id: 'chantier-derape',   emoji: '🔴', titre: 'Chantier qui dérape',     description: 'Un chantier clairement en perte (coûts réels > CA).',            attendu: 'Le chantier est pointé nommément, chiffré, avec action.', construire: scChantierDerape },
  { id: 'retards-encaissement', emoji: '🟡', titre: 'Retards d\'encaissement', description: 'Plusieurs factures anciennes impayées (>30, >60, >90 jours).',  attendu: 'Priorité relances, cash bloqué dehors chiffré.',       construire: scRetardsEncaissement },
  { id: 'plusieurs-problemes', emoji: '⚫', titre: 'Plusieurs problèmes',    description: 'Trésorerie tendue + 1 chantier en perte + impayés anciens.',      attendu: 'Hiérarchisation claire — par quoi commencer.',         construire: scPlusieursProblemes },
];

// Construit les données d'un scénario par id (now injectable pour déterminisme des tests).
export function construireScenario(id, now = new Date()) {
  const sc = SCENARIOS.find(s => s.id === id);
  if (!sc) return null;
  return sc.construire(now);
}

// Jeu de démonstration standard (pour la réinitialisation).
export function donneesDemoStandard() {
  const { chantiers, devis, factures, clients, ...reste } = donneesDemo;
  return {
    chantiers, devis, factures, clients,
    pointages: [],
    parametres: { ...reste, parametres: reste.parametres },
  };
}
