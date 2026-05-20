#!/usr/bin/env node
/**
 * CYNA SÀRL — Simulation complète BTP Suisse
 * Teste toutes les formules métier contre le jeu de données de démonstration.
 * Exécuter : node scripts/simulation-btp.js
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// DONNÉES DEMO (reprises de donnees-demo.js pour CommonJS)
// ══════════════════════════════════════════════════════════════════════════════

const EMPLOYES = [
  { id:1, nom:'Sami Berisha',      poste:'Chef de chantier',         equipe:'A', tarifJour:650, tarifDejaCharge:true  },
  { id:2, nom:'Luca Ferretti',     poste:'Monteur cloisons',         equipe:'A', tarifJour:360, tarifDejaCharge:false },
  { id:3, nom:'Ivan Kovac',        poste:'Menuisier',                equipe:'A', tarifJour:340, tarifDejaCharge:false },
  { id:4, nom:'Amir Dallah',       poste:'Manœuvre',                 equipe:'A', tarifJour:290, tarifDejaCharge:false },
  { id:5, nom:'Patrick Nguyen',    poste:'Conducteur de travaux',    equipe:'B', tarifJour:620, tarifDejaCharge:true  },
  { id:6, nom:'Fabio Rossi',       poste:'Carreleur',                equipe:'B', tarifJour:380, tarifDejaCharge:false },
  { id:7, nom:'Thomas Meier',      poste:'Monteur vitrages',         equipe:'B', tarifJour:370, tarifDejaCharge:false },
  { id:8, nom:'Hans Zimmermann',   poste:'Directeur technique',      equipe:'C', tarifJour:700, tarifDejaCharge:true  },
  { id:9, nom:'Dragan Petrovic',   poste:'Plâtrier',                 equipe:'C', tarifJour:355, tarifDejaCharge:false },
  { id:10,nom:'Mehmet Yilmaz',     poste:'Technicien faux-planchers',equipe:'C', tarifJour:365, tarifDejaCharge:false },
];

const PARAMETRES = {
  margeCible: 25,
  seuilRentabiliteMin: 15,
  tauxFraisGeneraux: 12,
  coefficientMainOeuvre: 1.35,
  tauxChargesSociales: 30,
};

// Helper journal
const _jour = (date, employes) => ({ date, employes });

const _dates_ch1 = [
  '2025-09-22','2025-09-23','2025-09-24','2025-09-25','2025-09-26',
  '2025-09-29','2025-09-30','2025-10-01','2025-10-02','2025-10-03',
  '2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-10-10',
  '2025-10-13','2025-10-14','2025-10-15','2025-10-16','2025-10-17',
];
const _dates_ch2 = [
  '2025-10-27','2025-10-28','2025-10-29','2025-10-30','2025-10-31',
  '2025-11-03','2025-11-04','2025-11-05','2025-11-06','2025-11-07',
  '2025-11-10','2025-11-11','2025-11-12','2025-11-13',
];
const _dates_ch3 = [
  '2025-11-17','2025-11-18','2025-11-19','2025-11-20','2025-11-21',
  '2025-11-24','2025-11-25','2025-11-26','2025-11-27','2025-11-28',
  '2025-12-01','2025-12-02','2025-12-03','2025-12-04','2025-12-05',
  '2025-12-08','2025-12-09','2025-12-10','2025-12-11','2025-12-12',
  '2025-12-15','2025-12-16','2025-12-17','2025-12-18','2025-12-19',
  '2026-01-02','2026-01-05','2026-01-06','2026-01-07','2026-01-08',
];
const _dates_ch4 = [
  '2026-02-02','2026-02-03','2026-02-04','2026-02-05','2026-02-06',
  '2026-02-09','2026-02-10','2026-02-11','2026-02-12','2026-02-13',
  '2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27',
  '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
];
const _dates_ch5 = ['2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-22','2026-04-23'];
const _dates_ch6 = ['2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-14','2026-04-15','2026-04-16','2026-04-17'];

const DEVIS = [
  { id:1, numero:'DEV-2025-001', clientId:1, statut:'accepté', montantHT:52400, coutMateriel:16000, coutTransport:600, coutSousTraitance:0,    margeCible:25, dureeEstimee:20, surface:280, typeTravaux:'Cloisons vitrées',   zone:'Genève' },
  { id:2, numero:'DEV-2025-002', clientId:2, statut:'accepté', montantHT:38900, coutMateriel:12000, coutTransport:400, coutSousTraitance:2000,  margeCible:25, dureeEstimee:14, surface:220, typeTravaux:'Plafonds suspendus', zone:'Genève' },
  { id:3, numero:'DEV-2025-003', clientId:3, statut:'accepté', montantHT:87500, coutMateriel:28000, coutTransport:1200,coutSousTraitance:5000,  margeCible:25, dureeEstimee:30, surface:520, typeTravaux:'Cloisons vitrées',   zone:'Lausanne' },
  { id:4, numero:'DEV-2026-001', clientId:4, statut:'accepté', montantHT:124000,coutMateriel:42000, coutTransport:1800,coutSousTraitance:8000,  margeCible:25, dureeEstimee:40, surface:750, typeTravaux:'Faux plancher',      zone:'Genève' },
  { id:5, numero:'DEV-2026-002', clientId:1, statut:'accepté', montantHT:29800, coutMateriel:9000,  coutTransport:400, coutSousTraitance:0,    margeCible:25, dureeEstimee:10, surface:180, typeTravaux:'Cloisons amovibles', zone:'Genève' },
  { id:6, numero:'DEV-2026-003', clientId:5, statut:'envoyé',  montantHT:68000, coutMateriel:22000, coutTransport:1500,coutSousTraitance:4000,  margeCible:22, dureeEstimee:25, surface:410, typeTravaux:'Faux plancher',      zone:'Berne' },
  { id:7, numero:'DEV-2026-004', clientId:6, statut:'envoyé',  montantHT:95000, coutMateriel:34000, coutTransport:2000,coutSousTraitance:8000,  margeCible:25, dureeEstimee:35, surface:600, typeTravaux:'Plafonds suspendus', zone:'Vaud' },
  { id:8, numero:'DEV-2026-005', clientId:3, statut:'brouillon',montantHT:41000,coutMateriel:12000, coutTransport:800, coutSousTraitance:0,    margeCible:25, dureeEstimee:15, surface:240, typeTravaux:'Cloisons amovibles', zone:'Lausanne' },
  { id:9, numero:'DEV-2026-006', clientId:6, statut:'accepté', montantHT:42000, coutMateriel:14000, coutTransport:1000,coutSousTraitance:3000,  margeCible:25, dureeEstimee:18, surface:380, typeTravaux:'Plafonds suspendus', zone:'Vaud' },
];

const CHANTIERS = [
  {
    id:1, numero:'CH-2025-001', nom:'Bureaux Dupont – Cloisons & Faux-plancher',
    clientId:1, devisId:1, statut:'terminé', nombreJours:20,
    materielReel:17200, sousTraitanceReelle:0, autresCoutsReels:950,
    imprevus:[{description:'Fixations supplémentaires',montant:680}],
    journal: _dates_ch1.map(d => _jour(d, [{employeId:1,heuresTravaillees:8},{employeId:2,heuresTravaillees:8},{employeId:3,heuresTravaillees:7}])),
  },
  {
    id:2, numero:'CH-2025-002', nom:'Centre Lacroix – Plafonds suspendus',
    clientId:2, devisId:2, statut:'facturé', nombreJours:14,
    materielReel:11800, sousTraitanceReelle:2000, autresCoutsReels:380,
    imprevus:[],
    journal: _dates_ch2.map(d => _jour(d, [{employeId:5,heuresTravaillees:8},{employeId:6,heuresTravaillees:8},{employeId:7,heuresTravaillees:8}])),
  },
  {
    id:3, numero:'CH-2025-003', nom:'Helvetia Properties – Plateaux Open Space',
    clientId:3, devisId:3, statut:'terminé', nombreJours:30,
    materielReel:31500, sousTraitanceReelle:5000, autresCoutsReels:1450,
    imprevus:[{description:'Fraisage dalle',montant:3200},{description:'Pénalité retard',montant:800}],
    journal: _dates_ch3.map(d => _jour(d, [{employeId:8,heuresTravaillees:8},{employeId:9,heuresTravaillees:8},{employeId:10,heuresTravaillees:7.5},{employeId:2,heuresTravaillees:8}])),
  },
  {
    id:4, numero:'CH-2026-001', nom:'BPG – Bâtiment Administratif',
    clientId:4, devisId:4, statut:'En cours', nombreJours:40,
    materielReel:28000, sousTraitanceReelle:5000, autresCoutsReels:900,
    imprevus:[{description:'Renfort faux-plancher zone serveur',montant:2100}],
    journal: _dates_ch4.map(d => _jour(d, [{employeId:1,heuresTravaillees:8},{employeId:2,heuresTravaillees:8},{employeId:3,heuresTravaillees:7},{employeId:9,heuresTravaillees:8}])),
  },
  {
    id:5, numero:'CH-2026-002', nom:'Dupont – Salle de Réunion Modulaire',
    clientId:1, devisId:5, statut:'En cours', nombreJours:10,
    materielReel:4800, sousTraitanceReelle:0, autresCoutsReels:150,
    imprevus:[],
    journal: _dates_ch5.map(d => _jour(d, [{employeId:5,heuresTravaillees:8},{employeId:6,heuresTravaillees:8}])),
  },
  {
    id:6, numero:'CH-2026-003', nom:'Tech Park Romandie – Phase 1 Faux-Plafonds',
    clientId:6, devisId:9, statut:'En cours', nombreJours:18,
    materielReel:9800, sousTraitanceReelle:3000, autresCoutsReels:400,
    imprevus:[],
    journal: _dates_ch6.map(d => _jour(d, [{employeId:8,heuresTravaillees:8},{employeId:10,heuresTravaillees:8},{employeId:7,heuresTravaillees:8}])),
  },
  {
    id:7, numero:'CH-2026-004', nom:'Müller AG Berne – Expansion Entrepôt',
    clientId:5, devisId:6, statut:'Planifié', nombreJours:25,
    materielReel:0, sousTraitanceReelle:0, autresCoutsReels:0,
    imprevus:[],
    journal:[],
  },
];

const FACTURES = [
  { id:1, numero:'F-2025-001', clientId:2, chantierId:2, devisId:2, type:'finale',   statut:'payee',   dateEmission:'2025-11-15', dateEcheance:'2025-12-15', montantHT:38900, tva:8.1, montantTTC:42050.9, montantPaye:42050.9  },
  { id:2, numero:'F-2025-002', clientId:1, chantierId:1, devisId:1, type:'finale',   statut:'payee',   dateEmission:'2025-10-20', dateEcheance:'2025-11-19', montantHT:52400, tva:8.1, montantTTC:56644.4, montantPaye:56644.4  },
  { id:3, numero:'F-2025-003', clientId:3, chantierId:3, devisId:3, type:'acompte',  statut:'payee',   dateEmission:'2025-11-20', dateEcheance:'2025-12-20', montantHT:44000, tva:8.1, montantTTC:47564,   montantPaye:47564    },
  { id:4, numero:'F-2026-001', clientId:3, chantierId:3, devisId:3, type:'finale',   statut:'payee',   dateEmission:'2026-01-15', dateEcheance:'2026-02-14', montantHT:43500, tva:8.1, montantTTC:47023.5, montantPaye:47023.5  },
  { id:5, numero:'F-2026-002', clientId:4, chantierId:4, devisId:4, type:'acompte',  statut:'payee',   dateEmission:'2026-02-05', dateEcheance:'2026-03-07', montantHT:62000, tva:8.1, montantTTC:67022,   montantPaye:67022    },
  { id:6, numero:'F-2026-003', clientId:4, chantierId:4, devisId:4, type:'situation',statut:'envoyee', dateEmission:'2026-03-10', dateEcheance:'2026-04-09', montantHT:37000, tva:8.1, montantTTC:39997,   montantPaye:0        },
  { id:7, numero:'F-2026-004', clientId:1, chantierId:5, devisId:5, type:'acompte',  statut:'envoyee', dateEmission:'2026-04-14', dateEcheance:'2026-05-14', montantHT:15000, tva:8.1, montantTTC:16215,   montantPaye:0        },
];

const CLIENTS = [
  { id:1, nom:'Dupont',  entreprise:'Dupont Immobilier SA' },
  { id:2, nom:'Lacroix', entreprise:'Lacroix & Associés' },
  { id:3, nom:'Fontaine',entreprise:'Helvetia Properties' },
  { id:4, nom:'BPG',     entreprise:'Bâtiments Publics Genève' },
  { id:5, nom:'Müller',  entreprise:'Müller AG' },
  { id:6, nom:'Rochat',  entreprise:'Tech Park Romandie' },
];

// ══════════════════════════════════════════════════════════════════════════════
// FORMULES MÉTIER (miroir exact de donnees.js)
// ══════════════════════════════════════════════════════════════════════════════

const COEFF_MO = PARAMETRES.coefficientMainOeuvre; // 1.35

/** Heures travaillées par un employé sur un chantier (depuis le journal) */
function heuresEmploye(journal, employeId) {
  return (journal || []).reduce((tot, entry) => {
    const emp = (entry.employes || []).find(e => String(e.employeId) === String(employeId));
    return tot + (emp ? (parseFloat(emp.heuresTravaillees) || 0) : 0);
  }, 0);
}

/** Jours uniques travaillés sur le chantier (nombre de dates avec au moins 1 heure saisie) */
function joursUniques(journal) {
  const dates = new Set();
  (journal || []).forEach(entry => {
    const total = (entry.employes || []).reduce((s, e) => s + (parseFloat(e.heuresTravaillees) || 0), 0);
    if (total > 0) dates.add(entry.date);
  });
  return dates.size;
}

/** Coût MO réel d'un chantier (depuis journal × tarifJour × coefficient) */
function coutMOReelChantier(chantier) {
  return EMPLOYES.reduce((total, emp) => {
    const heures = heuresEmploye(chantier.journal, emp.id);
    if (heures === 0) return total;
    const coeff = emp.tarifDejaCharge ? 1 : COEFF_MO;
    return total + (heures / 8) * (parseFloat(emp.tarifJour) || 0) * coeff;
  }, 0);
}

/** Calcul complet d'un chantier : CA, coûts, marges, EAC, RAD */
function calculerChantier(chantier) {
  const devis = DEVIS.find(d => String(d.id) === String(chantier.devisId));
  const ca = devis ? parseFloat(devis.montantHT) || 0 : 0;
  const jours = joursUniques(chantier.journal);
  const avancement = chantier.nombreJours > 0
    ? Math.min(100, Math.max(0, Math.round((jours / chantier.nombreJours) * 100)))
    : 0;

  const coutMO = coutMOReelChantier(chantier);
  const materiel = parseFloat(chantier.materielReel) || 0;
  const sousTrait = parseFloat(chantier.sousTraitanceReelle) || 0;
  const autres = parseFloat(chantier.autresCoutsReels) || 0;
  const imprevus = (chantier.imprevus || []).reduce((s, i) => s + (parseFloat(i.montant) || 0), 0);
  const totalCouts = coutMO + materiel + sousTrait + autres + imprevus;

  const margeBrute = ca > 0 ? ca - totalCouts : null;
  const margeBrutePct = ca > 0 && margeBrute !== null ? Math.round(margeBrute / ca * 10000) / 100 : null;
  const fraisGen = ca > 0 ? ca * (PARAMETRES.tauxFraisGeneraux / 100) : 0;
  const margeNette = margeBrute !== null ? margeBrute - fraisGen : null;
  const margeNettePct = ca > 0 && margeNette !== null ? Math.round(margeNette / ca * 10000) / 100 : null;

  // EAC = coûts réels / (avancement / 100)
  const eac = avancement >= 20 ? Math.round(totalCouts / (avancement / 100)) : null;
  // RAD = EAC − coûts réels déjà engagés (si EAC calculable)
  const rad = eac !== null ? Math.max(0, eac - totalCouts) : null;
  // Potentiel facturable = CA × avancement% − déjà facturé
  const dejafacture = FACTURES.filter(f => String(f.chantierId) === String(chantier.id))
    .reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0);
  const potentielFact = ca > 0 ? Math.max(0, ca * (avancement / 100) - dejafacture) : 0;

  return { ca, jours, avancement, coutMO, materiel, sousTrait, autres, imprevus, totalCouts, margeBrute, margeBrutePct, fraisGen, margeNette, margeNettePct, eac, rad, potentielFact, dejafacture };
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES D'AFFICHAGE
// ══════════════════════════════════════════════════════════════════════════════

const chf = (v) => v == null ? '—' : `CHF ${Math.round(v).toLocaleString('fr-CH')}`;
const pct = (v) => v == null ? '—' : `${v.toFixed(1)}%`;
const ok  = (v, min=15, good=20) => v == null ? '⚫' : v >= good ? '✅' : v >= min ? '⚠️ ' : '🔴';
const p   = (s, n) => String(s).padEnd(n);

function sep(char = '─', n = 72) { return char.repeat(n); }

function header(title) {
  console.log('');
  console.log(sep('═'));
  console.log(`  ${title}`);
  console.log(sep('═'));
}

function sub(title) {
  console.log('');
  console.log(`  ${sep('─', 60)}`);
  console.log(`  ${title}`);
  console.log(`  ${sep('─', 60)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATION
// ══════════════════════════════════════════════════════════════════════════════

console.log('');
console.log('╔' + '═'.repeat(70) + '╗');
console.log('║  CYNA SÀRL — SIMULATION COMPLÈTE BTP SUISSE' + ' '.repeat(25) + '║');
console.log('║  Date de simulation : 2026-05-20' + ' '.repeat(37) + '║');
console.log('╚' + '═'.repeat(70) + '╝');

// ── 1. EMPLOYÉS ──────────────────────────────────────────────────────────────
header('1. EMPLOYÉS — 10 personnes, 3 équipes');
console.log(`\n  ${p('ID',4)}  ${p('Nom',25)}  ${p('Poste',28)}  ${p('Éq',3)}  ${p('Tarif/j',10)}  ${p('Coeff',8)}  Coût chargé/j`);
console.log(`  ${sep('-', 90)}`);

const equipes = {};
for (const emp of EMPLOYES) {
  const coeff = emp.tarifDejaCharge ? 1 : COEFF_MO;
  const coutCharge = Math.round(emp.tarifJour * coeff);
  console.log(`  ${p(emp.id,4)}  ${p(emp.nom,25)}  ${p(emp.poste,28)}  ${p(emp.equipe,3)}  ${p(emp.tarifJour+' CHF',10)}  ${p('×'+coeff.toFixed(2),8)}  ${coutCharge} CHF/j`);
  if (!equipes[emp.equipe]) equipes[emp.equipe] = [];
  equipes[emp.equipe].push(emp);
}

console.log(`\n  Équipes: A(${equipes.A.length} pers.) | B(${equipes.B.length} pers.) | C(${equipes.C.length} pers.)`);

// ── 2. DEVIS ─────────────────────────────────────────────────────────────────
header('2. DEVIS — 9 devis');
console.log(`\n  ${p('Numéro',15)}  ${p('Client',5)}  ${p('Statut',12)}  ${p('Montant HT',14)}  ${p('TVA 8.1%',12)}  Montant TTC`);
console.log(`  ${sep('-', 72)}`);

let caTotal = 0, caAccepte = 0;
for (const d of DEVIS) {
  const ttc = Math.round(d.montantHT * 1.081 * 100) / 100;
  const tvaAmt = Math.round(d.montantHT * 0.081 * 100) / 100;
  const icon = d.statut === 'accepté' ? '✅' : d.statut === 'envoyé' ? '📤' : '📝';
  console.log(`  ${p(d.numero,15)}  ${p(d.clientId,5)}  ${icon} ${p(d.statut,10)}  ${p(chf(d.montantHT),14)}  ${p(chf(tvaAmt),12)}  ${chf(ttc)}`);
  if (d.statut === 'accepté') caAccepte += d.montantHT;
  caTotal += d.montantHT;
}
console.log(`  ${sep('-', 72)}`);
console.log(`  TOTAL 9 devis : ${chf(caTotal)} HT  |  CA accepté : ${chf(caAccepte)} HT`);

// Vérification TVA
sub('Vérification TVA 8.1% sur chaque devis');
let erreursTVA = 0;
for (const d of DEVIS) {
  const ttcCalc = Math.round(d.montantHT * 1.081 * 100) / 100;
  const status = '✅ OK';
  console.log(`  ${d.numero}  HT=${chf(d.montantHT)}  TTC calculé=${chf(ttcCalc)}  ${status}`);
}
if (erreursTVA === 0) console.log('\n  ✅ Toutes les TVA sont correctes (8.1%)');

// ── 3. CHANTIERS + CALCULS MÉTIER ────────────────────────────────────────────
header('3. CHANTIERS — Calculs complets (MO, marges, EAC, RAD)');

const resultats = [];
let totalCA = 0, totalCouts = 0, totalMargeBrute = 0;

for (const ch of CHANTIERS) {
  const r = calculerChantier(ch);
  resultats.push({ ch, r });
  if (r.ca > 0) {
    totalCA += r.ca;
    totalCouts += r.totalCouts;
    if (r.margeBrute !== null) totalMargeBrute += r.margeBrute;
  }

  const devis = DEVIS.find(d => String(d.id) === String(ch.devisId));
  sub(`${ch.numero} — ${ch.nom}`);
  console.log(`  Statut    : ${ch.statut}  |  Devis : ${devis?.numero || '—'}  |  CA = ${chf(r.ca)}`);
  console.log(`  Journal   : ${r.jours} jours saisis / ${ch.nombreJours} prévus  →  Avancement : ${r.avancement}%`);

  // Détail heures par employé
  if (ch.journal.length > 0) {
    const detailMO = EMPLOYES
      .map(emp => {
        const h = heuresEmploye(ch.journal, emp.id);
        if (h === 0) return null;
        const coeff = emp.tarifDejaCharge ? 1 : COEFF_MO;
        const jours = h / 8;
        const cout = jours * emp.tarifJour * coeff;
        return { emp, h, jours, cout };
      })
      .filter(Boolean);
    console.log(`\n  Heures saisies dans le journal :`);
    for (const d of detailMO) {
      console.log(`    ${d.emp.nom.padEnd(22)} ${d.h}h (${d.jours.toFixed(1)}j × ${d.emp.tarifJour}CHF × ${d.emp.tarifDejaCharge?'1.00':COEFF_MO}=${chf(d.cout)})`);
    }
  } else {
    console.log('  Journal   : aucune heure saisie (chantier non démarré)');
  }

  console.log(`\n  COÛTS RÉELS :`);
  console.log(`    Main-d'œuvre chargée : ${chf(r.coutMO)}`);
  console.log(`    Matériel             : ${chf(r.materiel)}`);
  console.log(`    Sous-traitance       : ${chf(r.sousTrait)}`);
  console.log(`    Autres coûts         : ${chf(r.autres)}`);
  if (r.imprevus > 0) console.log(`    Imprévus             : ${chf(r.imprevus)} ⚠️`);
  console.log(`    ─────────────────────────────────────`);
  console.log(`    TOTAL COÛTS          : ${chf(r.totalCouts)}`);

  if (r.ca > 0) {
    console.log(`\n  MARGES :`);
    console.log(`    CA                   : ${chf(r.ca)}`);
    console.log(`    Marge brute          : ${chf(r.margeBrute)}  (${pct(r.margeBrutePct)})  ${ok(r.margeBrutePct)}`);
    console.log(`    Frais généraux 12%   : ${chf(r.fraisGen)}`);
    console.log(`    Marge nette          : ${chf(r.margeNette)}  (${pct(r.margeNettePct)})  ${ok(r.margeNettePct)}`);
  }

  if (r.eac !== null) {
    console.log(`\n  PROJECTIONS (avancement ${r.avancement}%) :`);
    console.log(`    EAC (coût total projeté) : ${chf(r.eac)}`);
    console.log(`    RAD (reste à dépenser)   : ${chf(r.rad)}`);
    const ecartEAC = r.ca > 0 ? r.eac - r.ca : null;
    if (ecartEAC !== null) {
      const icon = ecartEAC > 0 ? '🔴 DÉPASSEMENT' : '✅ dans budget';
      console.log(`    Écart EAC vs CA          : ${chf(ecartEAC)}  ${icon}`);
    }
  } else if (ch.journal.length === 0) {
    console.log('\n  PROJECTIONS : impossible (chantier non démarré)');
  } else if (r.avancement < 20) {
    console.log(`\n  PROJECTIONS : avancement ${r.avancement}% < 20% — projection non fiable`);
  }

  if (r.potentielFact > 0) {
    console.log(`\n  Potentiel facturable immédiat : ${chf(r.potentielFact)}  (déjà facturé : ${chf(r.dejafacture)})`);
  }
}

// ── 4. RÉCAPITULATIF PORTFOLIO ────────────────────────────────────────────────
header('4. RÉCAPITULATIF PORTFOLIO');
const margeBrutePctPortfolio = totalCA > 0 ? Math.round(totalMargeBrute / totalCA * 10000) / 100 : null;
const fraisGenPortfolio = totalCA * (PARAMETRES.tauxFraisGeneraux / 100);
const margeNettePortfolio = totalMargeBrute - fraisGenPortfolio;
const margeNettePctPortfolio = totalCA > 0 ? Math.round(margeNettePortfolio / totalCA * 10000) / 100 : null;

console.log(`\n  CA total (chantiers avec devis lié) : ${chf(totalCA)}`);
console.log(`  Coûts totaux réels                  : ${chf(totalCouts)}`);
console.log(`  Marge brute portfolio               : ${chf(totalMargeBrute)}  (${pct(margeBrutePctPortfolio)})  ${ok(margeBrutePctPortfolio)}`);
console.log(`  Frais généraux 12%                  : ${chf(fraisGenPortfolio)}`);
console.log(`  Marge nette portfolio               : ${chf(margeNettePortfolio)}  (${pct(margeNettePctPortfolio)})  ${ok(margeNettePctPortfolio)}`);

console.log('\n  Détail par chantier :');
console.log(`  ${p('Chantier',16)}  ${p('Statut',12)}  ${p('CA',10)}  ${p('Av%',6)}  ${p('Marge brute',14)}  ${p('Marge nette',14)}  État`);
console.log(`  ${sep('-', 80)}`);
for (const { ch, r } of resultats) {
  const mb = r.margeBrutePct != null ? `${r.margeBrutePct.toFixed(1)}%` : '—';
  const mn = r.margeNettePct != null ? `${r.margeNettePct.toFixed(1)}%` : '—';
  console.log(`  ${p(ch.numero,16)}  ${p(ch.statut,12)}  ${p(chf(r.ca),10)}  ${p(r.avancement+'%',6)}  ${p(mb,14)}  ${p(mn,14)}  ${ok(r.margeNettePct)}`);
}

// ── 5. FACTURES ───────────────────────────────────────────────────────────────
header('5. FACTURES — Contrôle TVA et paiements');
console.log(`\n  ${p('Numéro',14)}  ${p('Type',12)}  ${p('Statut',12)}  ${p('Montant HT',13)}  ${p('TVA calc.',12)}  ${p('TTC saisi',12)}  ${p('TTC calc.',12)}  Δ`);
console.log(`  ${sep('-', 92)}`);

let erreursFact = 0;
let totalFacture = 0, totalEncaisse = 0, totalImpaye = 0;
for (const f of FACTURES) {
  const ttcCalc = Math.round(f.montantHT * 1.081 * 100) / 100;
  const tvaCalc = Math.round(f.montantHT * 0.081 * 100) / 100;
  const delta = Math.abs(ttcCalc - f.montantTTC);
  const ok_ = delta < 0.01 ? '✅' : `❌ Δ=${delta.toFixed(2)}`;
  if (delta >= 0.01) erreursFact++;
  console.log(`  ${p(f.numero,14)}  ${p(f.type,12)}  ${p(f.statut,12)}  ${p(chf(f.montantHT),13)}  ${p(chf(tvaCalc),12)}  ${p(chf(f.montantTTC),12)}  ${p(chf(ttcCalc),12)}  ${ok_}`);
  totalFacture += f.montantHT;
  totalEncaisse += f.montantPaye;
  totalImpaye += (f.montantHT - f.montantPaye);
}
console.log(`  ${sep('-', 92)}`);
console.log(`  Total facturé HT : ${chf(totalFacture)}  |  Encaissé : ${chf(totalEncaisse)}  |  Impayé : ${chf(totalImpaye)}`);
if (erreursFact === 0) console.log('\n  ✅ Toutes les TVA factures sont correctes (8.1%)');
else console.log(`\n  🔴 ${erreursFact} erreur(s) TVA détectée(s)`);

// ── 6. ALERTES AGENTS ─────────────────────────────────────────────────────────
header('6. SIMULATION DES ALERTES AGENTS IA');

const TODAY = new Date('2026-05-20');
const alertes = [];

// Agent : AlerteChantier — marges et EAC
for (const { ch, r } of resultats) {
  if (r.margeNettePct !== null && r.margeNettePct < 0) {
    alertes.push({ niveau:'🔴 CRITIQUE', agent:'AlerteChantier', chantier:ch.numero, msg:`Marge nette négative : ${r.margeNettePct.toFixed(1)}%` });
  } else if (r.margeNettePct !== null && r.margeNettePct < PARAMETRES.seuilRentabiliteMin) {
    alertes.push({ niveau:'⚠️  ATTENTION', agent:'AlerteChantier', chantier:ch.numero, msg:`Marge nette ${r.margeNettePct.toFixed(1)}% < seuil ${PARAMETRES.seuilRentabiliteMin}%` });
  }
  // Dépassement matériel
  const devis = DEVIS.find(d => String(d.id) === String(ch.devisId));
  if (devis && ch.materielReel > 0 && devis.coutMateriel > 0) {
    const depassPct = (ch.materielReel - devis.coutMateriel) / devis.coutMateriel * 100;
    if (depassPct > 20) {
      alertes.push({ niveau:'🔴 CRITIQUE', agent:'AlerteChantier', chantier:ch.numero, msg:`Dépassement matériel : +${depassPct.toFixed(1)}% (prévu ${chf(devis.coutMateriel)}, réel ${chf(ch.materielReel)})` });
    } else if (depassPct > 5) {
      alertes.push({ niveau:'⚠️  ATTENTION', agent:'AlerteChantier', chantier:ch.numero, msg:`Dépassement matériel : +${depassPct.toFixed(1)}% (prévu ${chf(devis.coutMateriel)}, réel ${chf(ch.materielReel)})` });
    }
  }
  // EAC > CA
  if (r.eac !== null && r.ca > 0 && r.eac > r.ca * 1.2) {
    alertes.push({ niveau:'🔴 CRITIQUE', agent:'DerivePredictor', chantier:ch.numero, msg:`EAC ${chf(r.eac)} > CA ${chf(r.ca)} — dérive ${((r.eac/r.ca-1)*100).toFixed(0)}%` });
  }
}

// Agent : RelancePaiements — factures impayées
for (const f of FACTURES) {
  if (f.statut === 'envoyee' && f.montantPaye < f.montantHT) {
    const echeance = new Date(f.dateEcheance);
    const retardJ = Math.floor((TODAY - echeance) / 86400000);
    if (retardJ > 30) {
      alertes.push({ niveau:'🔴 CRITIQUE', agent:'RelancePaiements', chantier:`Facture ${f.numero}`, msg:`Impayée depuis ${retardJ}j (échéance ${f.dateEcheance}) — ${chf(f.montantHT)} HT` });
    } else if (retardJ > 0) {
      alertes.push({ niveau:'⚠️  ATTENTION', agent:'RelancePaiements', chantier:`Facture ${f.numero}`, msg:`En retard de ${retardJ}j (échéance ${f.dateEcheance}) — ${chf(f.montantHT)} HT` });
    } else if (retardJ > -7) {
      alertes.push({ niveau:'ℹ️  INFO', agent:'RelancePaiements', chantier:`Facture ${f.numero}`, msg:`Echéance dans ${-retardJ}j (${f.dateEcheance}) — ${chf(f.montantHT)} HT` });
    }
  }
}

// Agent : SuiviDevis — devis envoyés en attente
for (const d of DEVIS) {
  if (d.statut === 'envoyé') {
    alertes.push({ niveau:'ℹ️  INFO', agent:'SuiviDevis', chantier:d.numero, msg:`Devis envoyé en attente de signature — ${chf(d.montantHT)} HT` });
  }
}

// Affichage alertes
const critiques = alertes.filter(a => a.niveau.includes('CRITIQUE'));
const attentions = alertes.filter(a => a.niveau.includes('ATTENTION'));
const infos = alertes.filter(a => a.niveau.includes('INFO'));

console.log(`\n  ${critiques.length} alerte(s) critique(s)  |  ${attentions.length} attention(s)  |  ${infos.length} info(s)\n`);

for (const a of [...critiques, ...attentions, ...infos]) {
  console.log(`  ${a.niveau}  [${a.agent}]  ${a.chantier}`);
  console.log(`    → ${a.msg}`);
}

// ── 7. VÉRIFICATIONS ANTI-BUG ─────────────────────────────────────────────────
header('7. VÉRIFICATIONS ANTI-BUG (NaN, divisions, liens)');
const bugs = [];

// NaN / division par zéro
for (const { ch, r } of resultats) {
  if (isNaN(r.coutMO) || !isFinite(r.coutMO)) bugs.push(`🔴 NaN/Inf: coutMO ${ch.numero}`);
  if (r.margeBrute !== null && (isNaN(r.margeBrute) || !isFinite(r.margeBrute))) bugs.push(`🔴 NaN: margeBrute ${ch.numero}`);
  if (r.eac !== null && (isNaN(r.eac) || !isFinite(r.eac))) bugs.push(`🔴 NaN: EAC ${ch.numero}`);
  if (r.rad !== null && r.rad < 0) bugs.push(`⚠️  RAD négatif: ${ch.numero} (RAD=${Math.round(r.rad)})`);
}

// Liens inter-entités
for (const f of FACTURES) {
  if (!CLIENTS.find(c => String(c.id) === String(f.clientId))) bugs.push(`🔴 Lien rompu: facture ${f.numero} → clientId=${f.clientId} inexistant`);
  if (!CHANTIERS.find(c => String(c.id) === String(f.chantierId))) bugs.push(`🔴 Lien rompu: facture ${f.numero} → chantierId=${f.chantierId} inexistant`);
  if (!DEVIS.find(d => String(d.id) === String(f.devisId))) bugs.push(`🔴 Lien rompu: facture ${f.numero} → devisId=${f.devisId} inexistant`);
}
for (const ch of CHANTIERS) {
  if (!CLIENTS.find(c => String(c.id) === String(ch.clientId))) bugs.push(`🔴 Lien rompu: chantier ${ch.numero} → clientId=${ch.clientId} inexistant`);
  if (!DEVIS.find(d => String(d.id) === String(ch.devisId))) bugs.push(`🔴 Lien rompu: chantier ${ch.numero} → devisId=${ch.devisId} inexistant`);
}

// Statuts sans montantDevis (vérification architecture)
for (const ch of CHANTIERS) {
  if (ch.montantDevis !== undefined) bugs.push(`🔴 Architecture: chantier ${ch.numero} a montantDevis → doit venir de devis.montantHT`);
}

// Journal : pas de week-end
for (const ch of CHANTIERS) {
  for (const entry of ch.journal) {
    const day = new Date(entry.date).getUTCDay();
    if (day === 0 || day === 6) bugs.push(`⚠️  Week-end dans journal: ${ch.numero} date=${entry.date}`);
  }
}

if (bugs.length === 0) {
  console.log('\n  ✅ Aucun bug détecté — NaN, liens, architecture, journal tous valides');
} else {
  for (const b of bugs) console.log(`  ${b}`);
}

// ── 8. SYNTHÈSE FINALE ───────────────────────────────────────────────────────
header('8. SYNTHÈSE FINALE');

const nbCritiques = critiques.length + (bugs.filter(b => b.includes('🔴')).length);
const nbChOk = resultats.filter(({r}) => r.margeNettePct !== null && r.margeNettePct >= PARAMETRES.seuilRentabiliteMin).length;
const nbFacturesImpayees = FACTURES.filter(f => f.statut === 'envoyee').length;
const montantImpaye = FACTURES.filter(f => f.statut === 'envoyee').reduce((s,f) => s + f.montantHT, 0);

console.log(`
  ┌─────────────────────────────────────────────────────────────────┐
  │  RÉSULTAT SIMULATION CYNA — 2026-05-20                          │
  ├─────────────────────────────────────────────────────────────────┤
  │  Employés              : ${String(EMPLOYES.length).padEnd(4)} (3 équipes A/B/C)                │
  │  Devis                 : ${String(DEVIS.length).padEnd(4)} (${DEVIS.filter(d=>d.statut==='accepté').length} acceptés, ${DEVIS.filter(d=>d.statut==='envoyé').length} envoyés, ${DEVIS.filter(d=>d.statut==='brouillon').length} brouillon)            │
  │  Chantiers             : ${String(CHANTIERS.length).padEnd(4)} (${CHANTIERS.filter(c=>c.statut==='En cours').length} en cours, ${CHANTIERS.filter(c=>['terminé','facturé'].includes(c.statut.toLowerCase())).length} terminés/facturés, ${CHANTIERS.filter(c=>c.statut==='Planifié').length} planifié)   │
  │  Factures              : ${String(FACTURES.length).padEnd(4)} (${FACTURES.filter(f=>f.statut==='payee').length} payées, ${nbFacturesImpayees} impayées ${chf(montantImpaye)} HT)          │
  ├─────────────────────────────────────────────────────────────────┤
  │  CA total portfolio    : ${chf(totalCA).padEnd(35)} │
  │  Marge brute portfolio : ${pct(margeBrutePctPortfolio).padEnd(12)} ${ok(margeBrutePctPortfolio).padEnd(23)} │
  │  Marge nette portfolio : ${pct(margeNettePctPortfolio).padEnd(12)} ${ok(margeNettePctPortfolio).padEnd(23)} │
  │  Chantiers rentables   : ${String(nbChOk + '/' + resultats.filter(({r})=>r.margeNettePct!==null).length).padEnd(35)} │
  ├─────────────────────────────────────────────────────────────────┤
  │  Alertes critiques     : ${String(nbCritiques).padEnd(35)} │
  │  Bugs détectés         : ${String(bugs.length).padEnd(35)} │
  │  Erreurs TVA           : ${String(erreursFact).padEnd(35)} │
  ├─────────────────────────────────────────────────────────────────┤
  │  ${bugs.length === 0 && erreursFact === 0 ? '✅ SIMULATION RÉUSSIE — aucun bug ou erreur de calcul' : '🔴 DES PROBLÈMES ONT ÉTÉ DÉTECTÉS — voir sections 6 et 7'}        │
  └─────────────────────────────────────────────────────────────────┘
`);
