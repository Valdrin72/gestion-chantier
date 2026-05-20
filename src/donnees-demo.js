// CYNA SÀRL — Données de démonstration BTP Genève
// Jeu de test complet : 3 équipes, 10 employés, 6 clients, 9 devis, 7 chantiers, 7 factures
//
// RÈGLES RESPECTÉES :
//   - CA chantier = devis.montantHT (jamais montantDevis sur le chantier)
//   - Tous IDs sont des numbers
//   - Journal format groupé : [{ date, employes: [{ employeId, heuresTravaillees }] }]
//   - TVA 8.1% — montantTTC = Math.round(montantHT * 1.081 * 100) / 100
//   - dateEmission sur les factures (jamais dateFacture)
//   - Marge sur vente : (CA − coûts) / CA × 100
//   - coefficient MO 1.35 pour tarifDejaCharge absent ou false
//   - Tous les champs numériques protégés parseFloat(x) || 0

// ── Helpers internes (génération du journal) ─────────────────────────────────
// Jours ouvrables (lun–ven) listés explicitement par chantier (voir commentaires).
// Les arrays de dates sont précalculées pour éviter toute erreur de week-end.

const _jour = (date, employes) => ({ date, employes });

// Chantier 1 — 20 jours ouvrables 2025-09-22 → 2025-10-17
// 22,23,24,25,26/09 | 29,30/09,01,02,03/10 | 06,07,08,09,10/10 | 13,14,15,16,17/10
const _dates_ch1 = [
  '2025-09-22','2025-09-23','2025-09-24','2025-09-25','2025-09-26',
  '2025-09-29','2025-09-30','2025-10-01','2025-10-02','2025-10-03',
  '2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-10-10',
  '2025-10-13','2025-10-14','2025-10-15','2025-10-16','2025-10-17',
];

// Chantier 2 — 14 jours ouvrables 2025-10-27 → 2025-11-13
// 27,28,29,30,31/10 | 03,04,05,06,07/11 | 10,11,12,13/11
const _dates_ch2 = [
  '2025-10-27','2025-10-28','2025-10-29','2025-10-30','2025-10-31',
  '2025-11-03','2025-11-04','2025-11-05','2025-11-06','2025-11-07',
  '2025-11-10','2025-11-11','2025-11-12','2025-11-13',
];

// Chantier 3 — 30 jours ouvrables 2025-11-17 → 2026-01-09 (pause Noël 24-31 déc)
// 17,18,19,20,21/11 | 24,25,26,27,28/11 | 01,02,03,04,05/12
// 08,09,10,11,12/12 | 15,16,17,18,19/12 — pause 24-31 déc
// puis 02,05,06,07,08,09/01/2026
const _dates_ch3 = [
  '2025-11-17','2025-11-18','2025-11-19','2025-11-20','2025-11-21',
  '2025-11-24','2025-11-25','2025-11-26','2025-11-27','2025-11-28',
  '2025-12-01','2025-12-02','2025-12-03','2025-12-04','2025-12-05',
  '2025-12-08','2025-12-09','2025-12-10','2025-12-11','2025-12-12',
  '2025-12-15','2025-12-16','2025-12-17','2025-12-18','2025-12-19',
  '2026-01-02','2026-01-05','2026-01-06','2026-01-07','2026-01-08',
];

// Chantier 4 — 25 jours saisis (sur 40 prévus) 2026-02-02 → 2026-03-06
// 02,03,04,05,06/02 | 09,10,11,12,13/02 | 16,17,18,19,20/02
// 23,24,25,26,27/02 | 02,03,04,05,06/03
const _dates_ch4 = [
  '2026-02-02','2026-02-03','2026-02-04','2026-02-05','2026-02-06',
  '2026-02-09','2026-02-10','2026-02-11','2026-02-12','2026-02-13',
  '2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27',
  '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
];

// Chantier 5 — 6 jours saisis (sur 10 prévus) 2026-04-14 → 2026-04-23
// 14,15,16,17/04 — pause Pâques 18-21 avr — 22,23/04
const _dates_ch5 = [
  '2026-04-14','2026-04-15','2026-04-16','2026-04-17',
  '2026-04-22','2026-04-23',
];

// Chantier 6 — 8 jours saisis (sur 18 prévus) 2026-04-07 → 2026-04-17
// 07,08,09,10/04 | 14,15,16,17/04 (17 avr = jeudi, avant Vendredi saint 18)
const _dates_ch6 = [
  '2026-04-07','2026-04-08','2026-04-09','2026-04-10',
  '2026-04-14','2026-04-15','2026-04-16','2026-04-17',
];

export const donneesDemo = {

  // ══════════════════════════════════════════════════════════════════════════
  // PARAMÈTRES GLOBAUX
  // ══════════════════════════════════════════════════════════════════════════
  parametres: {
    margeCible: 25,
    seuilRentabiliteMin: 15,
    plafondCredi: 40,
    tauxFraisGeneraux: 12,
    coefficientMainOeuvre: 1.35,
    joursAlerte: 5,
    tauxChargesSociales: 30,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIG AGENTS IA
  // ══════════════════════════════════════════════════════════════════════════
  agentsConfig: {
    alerteChantier: {
      seuilMargeDanger: 0,
      seuilMargeAttention: 15,
      seuilRetardAttention: 3,
      seuilRetardCritique: 7,
      seuilBudgetAttention: 5,
      seuilBudgetDanger: 20,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ZONES GÉOGRAPHIQUES (reprises de donneesInitiales)
  // ══════════════════════════════════════════════════════════════════════════
  zones: [
    {
      id: 1, nom: 'Genève',
      tarifs: {
        'Cloisons vitrées': 135,
        'Cloisons amovibles': 95,
        'Faux plancher': 85,
        'Plafonds suspendus': 90,
        'Portes standards': 650,
        'Portes coupe-feu': 950,
        'Panneaux sandwich': 110,
      },
      tarifDeplacement: 60,
    },
    {
      id: 2, nom: 'Lausanne',
      tarifs: {
        'Cloisons vitrées': 120,
        'Cloisons amovibles': 85,
        'Faux plancher': 75,
        'Plafonds suspendus': 80,
        'Portes standards': 580,
        'Portes coupe-feu': 850,
        'Panneaux sandwich': 95,
      },
      tarifDeplacement: 50,
    },
    { id: 3, nom: 'Berne', tarifs: {}, tarifDeplacement: 45 },
    { id: 4, nom: 'Zurich', tarifs: {}, tarifDeplacement: 65 },
    { id: 5, nom: 'Fribourg', tarifs: {}, tarifDeplacement: 40 },
    { id: 6, nom: 'Neuchâtel', tarifs: {}, tarifDeplacement: 40 },
    { id: 7, nom: 'Vaud (autre)', tarifs: {}, tarifDeplacement: 45 },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // TYPES DE TRAVAUX (repris de donneesInitiales)
  // ══════════════════════════════════════════════════════════════════════════
  typesTravaux: [
    { id: 1, nom: 'Cloisons vitrées',    unite: 'm²',    tarifBase: 125 },
    { id: 2, nom: 'Cloisons amovibles',  unite: 'm²',    tarifBase: 90  },
    { id: 3, nom: 'Faux plancher',       unite: 'm²',    tarifBase: 80  },
    { id: 4, nom: 'Plafonds suspendus',  unite: 'm²',    tarifBase: 85  },
    { id: 5, nom: 'Portes standards',    unite: 'unité', tarifBase: 620 },
    { id: 6, nom: 'Portes coupe-feu',    unite: 'unité', tarifBase: 900 },
    { id: 7, nom: 'Panneaux sandwich',   unite: 'm²',    tarifBase: 100 },
    { id: 8, nom: 'Autre',               unite: 'forfait', tarifBase: 0 },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // LOCALITÉS — déplacements (reprises de donneesInitiales)
  // ══════════════════════════════════════════════════════════════════════════
  localites: [
    { id: 1, nom: 'Genève',      tarifJour: 60 },
    { id: 2, nom: 'Lausanne',    tarifJour: 50 },
    { id: 3, nom: 'Berne',       tarifJour: 45 },
    { id: 4, nom: 'Zurich',      tarifJour: 65 },
    { id: 5, nom: 'Fribourg',    tarifJour: 40 },
    { id: 6, nom: 'Neuchâtel',   tarifJour: 40 },
    { id: 7, nom: 'Vaud (autre)', tarifJour: 45 },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILS UTILISATEURS (repris de donneesInitiales)
  // ══════════════════════════════════════════════════════════════════════════
  profils: [
    { id: 1, nom: 'Direction',              acces: ['tout'] },
    { id: 2, nom: 'Conducteur de travaux',  acces: ['chantiers', 'equipes', 'couts'] },
    { id: 3, nom: 'Administratif',          acces: ['clients', 'devis', 'factures'] },
    { id: 4, nom: 'Métreur / Deviseur',     acces: ['devis', 'tarification'] },
    { id: 5, nom: "Chef d'équipe",          acces: ['mes_chantiers'] },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYÉS — 10 personnes, 3 équipes
  // Règle : tarifDejaCharge:true → tarif utilisé tel quel (déjà chargé)
  //         absent / false      → multiplier par coefficientMainOeuvre (1.35)
  // ══════════════════════════════════════════════════════════════════════════
  employes: [
    // ── Équipe A ────────────────────────────────────────────────────────────
    {
      id: 1,
      nom: 'Sami Berisha',
      poste: 'Chef de chantier',
      equipe: 'A',
      tarifJour: 650,
      tarifDejaCharge: true,   // 650 CHF/j toutes charges comprises
      telephone: '079 111 11 11',
      email: 's.berisha@cyna.ch',
      actif: true,
    },
    {
      id: 2,
      nom: 'Luca Ferretti',
      poste: 'Monteur cloisons',
      equipe: 'A',
      tarifJour: 360,
      tarifDejaCharge: false,  // × 1.35 = 486 CHF/j chargé
      telephone: '079 222 22 22',
      email: 'l.ferretti@cyna.ch',
      actif: true,
    },
    {
      id: 3,
      nom: 'Ivan Kovac',
      poste: 'Menuisier',
      equipe: 'A',
      tarifJour: 340,
      tarifDejaCharge: false,  // × 1.35 = 459 CHF/j chargé
      telephone: '079 333 33 33',
      email: 'i.kovac@cyna.ch',
      actif: true,
    },
    {
      id: 4,
      nom: 'Amir Dallah',
      poste: 'Manœuvre',
      equipe: 'A',
      tarifJour: 290,
      tarifDejaCharge: false,  // × 1.35 = 391.50 CHF/j chargé
      telephone: '079 444 44 44',
      email: 'a.dallah@cyna.ch',
      actif: true,
    },
    // ── Équipe B ────────────────────────────────────────────────────────────
    {
      id: 5,
      nom: 'Patrick Nguyen',
      poste: 'Conducteur de travaux',
      equipe: 'B',
      tarifJour: 620,
      tarifDejaCharge: true,   // 620 CHF/j toutes charges comprises
      telephone: '079 555 55 55',
      email: 'p.nguyen@cyna.ch',
      actif: true,
    },
    {
      id: 6,
      nom: 'Fabio Rossi',
      poste: 'Carreleur',
      equipe: 'B',
      tarifJour: 380,
      tarifDejaCharge: false,  // × 1.35 = 513 CHF/j chargé
      telephone: '079 666 66 66',
      email: 'f.rossi@cyna.ch',
      actif: true,
    },
    {
      id: 7,
      nom: 'Thomas Meier',
      poste: 'Monteur vitrages',
      equipe: 'B',
      tarifJour: 370,
      tarifDejaCharge: false,  // × 1.35 = 499.50 CHF/j chargé
      telephone: '079 777 77 77',
      email: 't.meier@cyna.ch',
      actif: true,
    },
    // ── Équipe C ────────────────────────────────────────────────────────────
    {
      id: 8,
      nom: 'Hans Zimmermann',
      poste: 'Directeur technique',
      equipe: 'C',
      tarifJour: 700,
      tarifDejaCharge: true,   // 700 CHF/j toutes charges comprises
      telephone: '079 888 88 88',
      email: 'h.zimmermann@cyna.ch',
      actif: true,
    },
    {
      id: 9,
      nom: 'Dragan Petrovic',
      poste: 'Plâtrier',
      equipe: 'C',
      tarifJour: 355,
      tarifDejaCharge: false,  // × 1.35 = 479.25 CHF/j chargé
      telephone: '079 999 99 99',
      email: 'd.petrovic@cyna.ch',
      actif: true,
    },
    {
      id: 10,
      nom: 'Mehmet Yilmaz',
      poste: 'Technicien faux-planchers',
      equipe: 'C',
      tarifJour: 365,
      tarifDejaCharge: false,  // × 1.35 = 492.75 CHF/j chargé
      telephone: '079 100 10 10',
      email: 'm.yilmaz@cyna.ch',
      actif: true,
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENTS — 6 clients (entreprises + institutionnels)
  // ══════════════════════════════════════════════════════════════════════════
  clients: [
    {
      id: 1,
      nom: 'Dupont',
      prenom: 'Marc',
      entreprise: 'Dupont Immobilier SA',
      telephone: '022 100 00 01',
      email: 'marc.dupont@dupont-immo.ch',
      adresse: 'Rue de Rive 12',
      ville: 'Genève',
      canton: 'GE',
      type: 'Entreprise',
      notes: 'Client fidèle depuis 2020 — paiements ponctuels',
    },
    {
      id: 2,
      nom: 'Lacroix',
      prenom: 'Sophie',
      entreprise: 'Lacroix & Associés',
      telephone: '022 200 00 02',
      email: 'sophie.lacroix@lacroix.ch',
      adresse: 'Boulevard du Pont-d\'Arve 22',
      ville: 'Genève',
      canton: 'GE',
      type: 'Entreprise',
      notes: 'Délai paiement habituel 30 jours',
    },
    {
      id: 3,
      nom: 'Fontaine',
      prenom: 'Jean-Pierre',
      entreprise: 'Helvetia Properties',
      telephone: '021 300 00 03',
      email: 'jp.fontaine@helvetia-prop.ch',
      adresse: 'Avenue de la Gare 18',
      ville: 'Lausanne',
      canton: 'VD',
      type: 'Entreprise',
      notes: 'Promoteur actif VD — plusieurs projets en cours',
    },
    {
      id: 4,
      nom: 'BPG',
      prenom: '',
      entreprise: 'Bâtiments Publics Genève',
      telephone: '022 400 00 04',
      email: 'commandes@bpg.ge.ch',
      adresse: 'Place de la République 1',
      ville: 'Genève',
      canton: 'GE',
      type: 'Institutionnel',
      notes: 'Marché public — procédure appel d\'offres',
    },
    {
      id: 5,
      nom: 'Müller',
      prenom: 'Klaus',
      entreprise: 'Müller AG',
      telephone: '031 500 00 05',
      email: 'k.muller@mueller-ag.ch',
      adresse: 'Industriestrasse 45',
      ville: 'Berne',
      canton: 'BE',
      type: 'Entreprise',
      notes: 'Client Alémanique — contrat cadre 2026',
    },
    {
      id: 6,
      nom: 'Rochat',
      prenom: 'Isabelle',
      entreprise: 'Tech Park Romandie',
      telephone: '021 600 00 06',
      email: 'i.rochat@techpark-romandie.ch',
      adresse: 'Route de Morges 12',
      ville: 'Morges',
      canton: 'VD',
      type: 'Entreprise',
      notes: 'Projet phare 2026 — plusieurs phases prévues',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // DEVIS — 9 devis (8 définis + 1 pour chantier 6)
  // Règle : montantHT est la SOURCE UNIQUE du CA du chantier lié
  // ══════════════════════════════════════════════════════════════════════════
  devis: [
    // ── Devis terminés / soldés ──────────────────────────────────────────────
    {
      id: 1,
      numero: 'DEV-2025-001',
      clientId: 1,
      date: '2025-09-10',
      statut: 'accepté',
      zone: 'Genève',
      typeTravaux: 'Cloisons vitrées',
      typesTravaux: ['Cloisons vitrées', 'Faux plancher'],
      surface: 280,
      dureeEstimee: 20,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 16000,
      coutTransport: 600,
      coutSousTraitance: 0,
      margeCible: 25,
      montantHT: 52400,
      prixPropose: 52400,
      heuresRegie: [],
      avenants: [],
      notes: 'Bureaux Dupont Rive Gauche — cloisons aluminium + faux plancher technique',
    },
    {
      id: 2,
      numero: 'DEV-2025-002',
      clientId: 2,
      date: '2025-10-15',
      statut: 'accepté',
      zone: 'Genève',
      typeTravaux: 'Plafonds suspendus',
      typesTravaux: ['Plafonds suspendus'],
      surface: 220,
      dureeEstimee: 14,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 12000,
      coutTransport: 400,
      coutSousTraitance: 2000,
      margeCible: 25,
      montantHT: 38900,
      prixPropose: 38900,
      heuresRegie: [],
      avenants: [],
      notes: 'Centre Lacroix — plafonds acoustiques dalles minérales',
    },
    {
      id: 3,
      numero: 'DEV-2025-003',
      clientId: 3,
      date: '2025-11-02',
      statut: 'accepté',
      zone: 'Lausanne',
      typeTravaux: 'Cloisons vitrées',
      typesTravaux: ['Cloisons vitrées', 'Cloisons amovibles'],
      surface: 520,
      dureeEstimee: 30,
      complexite: 'Élevée',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 28000,
      coutTransport: 1200,
      coutSousTraitance: 5000,
      margeCible: 25,
      montantHT: 87500,
      prixPropose: 87500,
      heuresRegie: [],
      avenants: [],
      notes: 'Helvetia Properties — plateaux open space, dalle béton irrégulière découverte en cours',
    },
    // ── Chantiers en cours ───────────────────────────────────────────────────
    {
      id: 4,
      numero: 'DEV-2026-001',
      clientId: 4,
      date: '2026-01-08',
      statut: 'accepté',
      zone: 'Genève',
      typeTravaux: 'Faux plancher',
      typesTravaux: ['Faux plancher', 'Plafonds suspendus', 'Portes coupe-feu'],
      surface: 750,
      dureeEstimee: 40,
      complexite: 'Élevée',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 42000,
      coutTransport: 1800,
      coutSousTraitance: 8000,
      margeCible: 25,
      montantHT: 124000,
      prixPropose: 124000,
      heuresRegie: [],
      avenants: [],
      notes: 'BPG — bâtiment administratif cantonal, priorité haute, accès sécurisé',
    },
    {
      id: 5,
      numero: 'DEV-2026-002',
      clientId: 1,
      date: '2026-02-20',
      statut: 'accepté',
      zone: 'Genève',
      typeTravaux: 'Cloisons amovibles',
      typesTravaux: ['Cloisons amovibles'],
      surface: 180,
      dureeEstimee: 10,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 9000,
      coutTransport: 400,
      coutSousTraitance: 0,
      margeCible: 25,
      montantHT: 29800,
      prixPropose: 29800,
      heuresRegie: [],
      avenants: [],
      notes: 'Dupont — salle de réunion modulaire, cloisons escamotables haut de gamme',
    },
    // ── Devis envoyés (en attente acceptation) ───────────────────────────────
    {
      id: 6,
      numero: 'DEV-2026-003',
      clientId: 5,
      date: '2026-04-01',
      statut: 'envoyé',
      zone: 'Berne',
      typeTravaux: 'Faux plancher',
      typesTravaux: ['Faux plancher', 'Cloisons vitrées'],
      surface: 410,
      dureeEstimee: 25,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 22000,
      coutTransport: 1500,
      coutSousTraitance: 4000,
      margeCible: 22,
      montantHT: 68000,
      prixPropose: 68000,
      heuresRegie: [],
      avenants: [],
      notes: 'Müller AG Berne — expansion entrepôt, déplacement à prévoir (45 CHF/j)',
    },
    {
      id: 7,
      numero: 'DEV-2026-004',
      clientId: 6,
      date: '2026-04-28',
      statut: 'envoyé',
      zone: 'Vaud (autre)',
      typeTravaux: 'Plafonds suspendus',
      typesTravaux: ['Plafonds suspendus', 'Faux plancher'],
      surface: 600,
      dureeEstimee: 35,
      complexite: 'Élevée',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 34000,
      coutTransport: 2000,
      coutSousTraitance: 8000,
      margeCible: 25,
      montantHT: 95000,
      prixPropose: 95000,
      heuresRegie: [],
      avenants: [],
      notes: 'Tech Park Romandie — Phase 2 (phase 1 en cours avec devis DEV-2026-006)',
    },
    // ── Devis brouillon ──────────────────────────────────────────────────────
    {
      id: 8,
      numero: 'DEV-2026-005',
      clientId: 3,
      date: '2026-05-10',
      statut: 'brouillon',
      zone: 'Lausanne',
      typeTravaux: 'Cloisons amovibles',
      typesTravaux: ['Cloisons amovibles', 'Portes standards'],
      surface: 240,
      dureeEstimee: 15,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 12000,
      coutTransport: 800,
      coutSousTraitance: 0,
      margeCible: 25,
      montantHT: 41000,
      prixPropose: 41000,
      heuresRegie: [],
      avenants: [],
      notes: 'Helvetia Properties — nouveau projet VD, chiffrage en cours',
    },
    // ── Devis accepté pour chantier 6 (Tech Park Phase 1) ───────────────────
    {
      id: 9,
      numero: 'DEV-2026-006',
      clientId: 6,
      date: '2026-03-15',
      statut: 'accepté',
      zone: 'Vaud (autre)',
      typeTravaux: 'Plafonds suspendus',
      typesTravaux: ['Plafonds suspendus'],
      surface: 380,
      dureeEstimee: 18,
      complexite: 'Normale',
      urgence: 'Non',
      acces: 'Normal',
      coutMateriel: 14000,
      coutTransport: 1000,
      coutSousTraitance: 3000,
      margeCible: 25,
      montantHT: 42000,
      prixPropose: 42000,
      heuresRegie: [],
      avenants: [],
      notes: 'Tech Park Romandie — Phase 1 faux-plafonds, accord verbal devenu commande ferme',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // CHANTIERS — 7 chantiers
  // IMPORTANT : PAS de montantDevis sur le chantier — le CA vient de devis.montantHT
  // Les champs materielReel / sousTraitanceReelle / autresCoutsReels sont les
  // noms canoniques (double-fallback dans calculerCoutsChantier).
  // ══════════════════════════════════════════════════════════════════════════
  chantiers: [
    // ── CH1 — Terminé, rentable, journal complet 20 jours ───────────────────
    {
      id: 1,
      numero: 'CH-2025-001',
      nom: 'Bureaux Dupont – Cloisons & Faux-plancher',
      clientId: 1,
      devisId: 1,
      conducteur: 'Sami Berisha',
      adresse: 'Rue de Rive 12',
      ville: 'Genève',
      canton: 'GE',
      dateDebut: '2025-09-22',
      dateFin: '2025-10-17',
      nombreJours: 20,
      inclusSamedi: false,
      statut: 'terminé',
      priorite: 'Haute',
      typesTravaux: ['Cloisons vitrées', 'Faux plancher'],
      surface: 280,
      // Pas de montantDevis — CA = devis[id=1].montantHT = 52400
      equipe: [
        { employeId: 1, joursPlannifies: 20 },
        { employeId: 2, joursPlannifies: 20 },
        { employeId: 3, joursPlannifies: 18 },
      ],
      coutMaterielPrevu: 16000,
      materielReel: 17200,
      coutSousTraitancePrevu: 0,
      sousTraitanceReelle: 0,
      autresCoutsPrevu: 800,
      autresCoutsReels: 950,
      imprevus: [
        { description: 'Fixations supplémentaires dalle béton', montant: 680 },
      ],
      avenants: [],
      notes: 'Chantier livré à temps, légère dérive matériel compensée par la marge',
      // Journal : 20 jours — emp 1: 8h, emp 2: 8h, emp 3: 7h
      journal: _dates_ch1.map(date => _jour(date, [
        { employeId: 1, heuresTravaillees: 8 },
        { employeId: 2, heuresTravaillees: 8 },
        { employeId: 3, heuresTravaillees: 7 },
      ])),
    },

    // ── CH2 — Facturé (soldé), rentable, journal complet 14 jours ───────────
    {
      id: 2,
      numero: 'CH-2025-002',
      nom: 'Centre Lacroix – Plafonds suspendus',
      clientId: 2,
      devisId: 2,
      conducteur: 'Patrick Nguyen',
      adresse: 'Boulevard du Pont-d\'Arve 22',
      ville: 'Genève',
      canton: 'GE',
      dateDebut: '2025-10-27',
      dateFin: '2025-11-13',
      nombreJours: 14,
      inclusSamedi: false,
      statut: 'facturé',
      priorite: 'Normale',
      typesTravaux: ['Plafonds suspendus'],
      surface: 220,
      // CA = devis[id=2].montantHT = 38900
      equipe: [
        { employeId: 5, joursPlannifies: 14 },
        { employeId: 6, joursPlannifies: 14 },
        { employeId: 7, joursPlannifies: 12 },
      ],
      coutMaterielPrevu: 12000,
      materielReel: 11800,
      coutSousTraitancePrevu: 2000,
      sousTraitanceReelle: 2000,
      autresCoutsPrevu: 400,
      autresCoutsReels: 380,
      imprevus: [],
      avenants: [],
      notes: 'Chantier modèle — sous budget sur le matériel, qualité validée client',
      // Journal : 14 jours — emp 5: 8h, emp 6: 8h, emp 7: 8h
      journal: _dates_ch2.map(date => _jour(date, [
        { employeId: 5, heuresTravaillees: 8 },
        { employeId: 6, heuresTravaillees: 8 },
        { employeId: 7, heuresTravaillees: 8 },
      ])),
    },

    // ── CH3 — Terminé avec dépassement matériel (test alerte dépassement) ───
    {
      id: 3,
      numero: 'CH-2025-003',
      nom: 'Helvetia Properties – Plateaux Open Space',
      clientId: 3,
      devisId: 3,
      conducteur: 'Hans Zimmermann',
      adresse: 'Rue du Valentin 8',
      ville: 'Lausanne',
      canton: 'VD',
      dateDebut: '2025-11-17',
      dateFin: '2026-01-09',
      nombreJours: 30,
      inclusSamedi: false,
      statut: 'terminé',
      priorite: 'Haute',
      typesTravaux: ['Cloisons vitrées', 'Cloisons amovibles'],
      surface: 520,
      // CA = devis[id=3].montantHT = 87500
      equipe: [
        { employeId: 8,  joursPlannifies: 30 },
        { employeId: 9,  joursPlannifies: 30 },
        { employeId: 10, joursPlannifies: 28 },
        { employeId: 2,  joursPlannifies: 25 },
      ],
      coutMaterielPrevu: 28000,
      materielReel: 31500,        // dépassement +3500 CHF (+12.5%) — test alerte
      coutSousTraitancePrevu: 5000,
      sousTraitanceReelle: 5000,
      autresCoutsPrevu: 1200,
      autresCoutsReels: 1450,
      imprevus: [
        { description: 'Fraisage dalle béton irrégulière', montant: 3200 },
        { description: 'Pénalité retard livraison cloisons (transporteur)', montant: 800 },
      ],
      avenants: [],
      notes: 'Dépassement matériel dû à la dalle irrégulière — marge finale réduite mais positive',
      // Journal : 30 jours — emp 8: 8h, emp 9: 8h, emp 10: 7.5h, emp 2: 8h
      journal: _dates_ch3.map(date => _jour(date, [
        { employeId: 8,  heuresTravaillees: 8   },
        { employeId: 9,  heuresTravaillees: 8   },
        { employeId: 10, heuresTravaillees: 7.5 },
        { employeId: 2,  heuresTravaillees: 8   },
      ])),
    },

    // ── CH4 — En cours, gros chantier public, 25/40 jours saisis ────────────
    // Test projection EAC/RAD, alerte facture impayée (F-2026-003 > 60j)
    {
      id: 4,
      numero: 'CH-2026-001',
      nom: 'BPG – Bâtiment Administratif',
      clientId: 4,
      devisId: 4,
      conducteur: 'Sami Berisha',
      adresse: 'Place de la République 1',
      ville: 'Genève',
      canton: 'GE',
      dateDebut: '2026-02-02',
      nombreJours: 40,
      inclusSamedi: false,
      statut: 'En cours',
      priorite: 'Haute',
      typesTravaux: ['Faux plancher', 'Plafonds suspendus', 'Portes coupe-feu'],
      surface: 750,
      // CA = devis[id=4].montantHT = 124000
      equipe: [
        { employeId: 1, joursPlannifies: 40 },
        { employeId: 2, joursPlannifies: 40 },
        { employeId: 3, joursPlannifies: 35 },
        { employeId: 9, joursPlannifies: 30 },
      ],
      coutMaterielPrevu: 42000,
      materielReel: 28000,       // partiel (en cours)
      coutSousTraitancePrevu: 8000,
      sousTraitanceReelle: 5000, // partiel
      autresCoutsPrevu: 1500,
      autresCoutsReels: 900,     // partiel
      imprevus: [
        { description: 'Renfort structure faux-plancher zone serveur', montant: 2100 },
      ],
      avenants: [],
      notes: 'Chantier institutionnel — accès badge requis, horaires 07h00-17h00',
      // Journal : 25 jours sur 40 — emp 1: 8h, emp 2: 8h, emp 3: 7h, emp 9: 8h
      journal: _dates_ch4.map(date => _jour(date, [
        { employeId: 1, heuresTravaillees: 8 },
        { employeId: 2, heuresTravaillees: 8 },
        { employeId: 3, heuresTravaillees: 7 },
        { employeId: 9, heuresTravaillees: 8 },
      ])),
    },

    // ── CH5 — En cours, petit chantier, 6/10 jours, alerte relance facture ──
    {
      id: 5,
      numero: 'CH-2026-002',
      nom: 'Dupont – Salle de Réunion Modulaire',
      clientId: 1,
      devisId: 5,
      conducteur: 'Patrick Nguyen',
      adresse: 'Rue de Rive 12',
      ville: 'Genève',
      canton: 'GE',
      dateDebut: '2026-04-14',
      nombreJours: 10,
      inclusSamedi: false,
      statut: 'En cours',
      priorite: 'Normale',
      typesTravaux: ['Cloisons amovibles'],
      surface: 180,
      // CA = devis[id=5].montantHT = 29800
      equipe: [
        { employeId: 5, joursPlannifies: 10 },
        { employeId: 6, joursPlannifies: 10 },
      ],
      coutMaterielPrevu: 9000,
      materielReel: 4800,        // partiel
      coutSousTraitancePrevu: 0,
      sousTraitanceReelle: 0,
      autresCoutsPrevu: 300,
      autresCoutsReels: 150,     // partiel
      imprevus: [],
      avenants: [],
      notes: 'Client prioritaire — livraison souhaitée avant fin avril',
      // Journal : 6 jours sur 10 — emp 5: 8h, emp 6: 8h
      journal: _dates_ch5.map(date => _jour(date, [
        { employeId: 5, heuresTravaillees: 8 },
        { employeId: 6, heuresTravaillees: 8 },
      ])),
    },

    // ── CH6 — En cours, Tech Park Phase 1, 8/18 jours saisis ────────────────
    {
      id: 6,
      numero: 'CH-2026-003',
      nom: 'Tech Park Romandie – Phase 1 Faux-Plafonds',
      clientId: 6,
      devisId: 9,             // devis DEV-2026-006
      conducteur: 'Hans Zimmermann',
      adresse: 'Route de Morges 12',
      ville: 'Morges',
      canton: 'VD',
      dateDebut: '2026-04-07',
      nombreJours: 18,
      inclusSamedi: false,
      statut: 'En cours',
      priorite: 'Normale',
      typesTravaux: ['Plafonds suspendus'],
      surface: 380,
      // CA = devis[id=9].montantHT = 42000
      equipe: [
        { employeId: 8,  joursPlannifies: 18 },
        { employeId: 10, joursPlannifies: 18 },
        { employeId: 7,  joursPlannifies: 15 },
      ],
      coutMaterielPrevu: 14000,
      materielReel: 9800,        // partiel
      coutSousTraitancePrevu: 3000,
      sousTraitanceReelle: 3000,
      autresCoutsPrevu: 600,
      autresCoutsReels: 400,     // partiel
      imprevus: [],
      avenants: [],
      notes: 'Phase 1 de 3 — client stratégique, qualité de finition prioritaire',
      // Journal : 8 jours sur 18 — emp 8: 8h, emp 10: 8h, emp 7: 8h
      journal: _dates_ch6.map(date => _jour(date, [
        { employeId: 8,  heuresTravaillees: 8 },
        { employeId: 10, heuresTravaillees: 8 },
        { employeId: 7,  heuresTravaillees: 8 },
      ])),
    },

    // ── CH7 — Planifié (non démarré) — test chantier sans journal ───────────
    // Devis envoyé (en attente signature) → chantier planifié
    {
      id: 7,
      numero: 'CH-2026-004',
      nom: 'Müller AG Berne – Expansion Entrepôt',
      clientId: 5,
      devisId: 6,             // devis DEV-2026-003 (statut 'envoyé')
      conducteur: 'Sami Berisha',
      adresse: 'Industriestrasse 45',
      ville: 'Berne',
      canton: 'BE',
      dateDebut: '2026-06-02',
      nombreJours: 25,
      inclusSamedi: false,
      statut: 'Planifié',
      priorite: 'Normale',
      typesTravaux: ['Faux plancher', 'Cloisons vitrées'],
      surface: 410,
      // CA = devis[id=6].montantHT = 68000
      equipe: [
        { employeId: 1, joursPlannifies: 25 },
        { employeId: 3, joursPlannifies: 25 },
        { employeId: 4, joursPlannifies: 20 },
      ],
      coutMaterielPrevu: 22000,
      materielReel: 0,
      coutSousTraitancePrevu: 4000,
      sousTraitanceReelle: 0,
      autresCoutsPrevu: 1000,
      autresCoutsReels: 0,
      imprevus: [],
      avenants: [],
      notes: 'Démarrage conditionné à la signature du contrat — déplacement Berne prévoir',
      journal: [],             // pas encore démarré — coûts réels = 0, avancement = 0
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // FACTURES — 7 factures
  // Règles :
  //   - dateEmission (jamais dateFacture ou creeLe)
  //   - montantTTC = Math.round(montantHT * 1.081 * 100) / 100
  //   - facture.clientId / chantierId / devisId doivent exister
  //   - F-2026-003 impayée >60j → déclenche alerte relance (statut 'envoyee')
  //   - F-2026-004 récente ~30j → pas encore en retard
  // ══════════════════════════════════════════════════════════════════════════
  factures: [
    // ── F1 — Lacroix / CH2 — payée ──────────────────────────────────────────
    // montantTTC = Math.round(38900 * 1.081 * 100) / 100 = 42050.9
    {
      id: 1,
      numero: 'F-2025-001',
      clientId: 2,
      chantierId: 2,
      devisId: 2,
      type: 'finale',
      statut: 'payee',
      dateEmission: '2025-11-15',
      dateEcheance: '2025-12-15',
      datePaiement: '2025-12-08',
      montantHT: 38900,
      tva: 8.1,
      montantTTC: 42050.9,
      montantPaye: 42050.9,
      paiementsHistorique: [
        { date: '2025-12-08', montant: 42050.9, mode: 'virement', reference: 'VIR-2025-1115' },
      ],
      objet: 'Travaux plafonds suspendus – Centre Lacroix',
      notes: 'Solde total payé avant échéance',
    },

    // ── F2 — Dupont / CH1 — payée ────────────────────────────────────────────
    // montantTTC = Math.round(52400 * 1.081 * 100) / 100 = 56644.4
    {
      id: 2,
      numero: 'F-2025-002',
      clientId: 1,
      chantierId: 1,
      devisId: 1,
      type: 'finale',
      statut: 'payee',
      dateEmission: '2025-10-20',
      dateEcheance: '2025-11-19',
      datePaiement: '2025-11-18',
      montantHT: 52400,
      tva: 8.1,
      montantTTC: 56644.4,
      montantPaye: 56644.4,
      paiementsHistorique: [
        { date: '2025-11-18', montant: 56644.4, mode: 'virement', reference: 'VIR-2025-1020' },
      ],
      objet: 'Travaux cloisons & faux-plancher – Bureaux Dupont',
      notes: '',
    },

    // ── F3 — Helvetia / CH3 — acompte 50%, payée ────────────────────────────
    // montantTTC = Math.round(44000 * 1.081 * 100) / 100 = 47564
    {
      id: 3,
      numero: 'F-2025-003',
      clientId: 3,
      chantierId: 3,
      devisId: 3,
      type: 'acompte',
      statut: 'payee',
      dateEmission: '2025-11-20',
      dateEcheance: '2025-12-20',
      datePaiement: '2025-12-15',
      montantHT: 44000,
      tva: 8.1,
      montantTTC: 47564,
      montantPaye: 47564,
      paiementsHistorique: [
        { date: '2025-12-15', montant: 47564, mode: 'virement', reference: 'VIR-2025-1120' },
      ],
      objet: 'Acompte 50% – Plateaux Open Space Helvetia',
      notes: 'Acompte à la signature, solde après réception',
    },

    // ── F4 — Helvetia / CH3 — solde, payée ──────────────────────────────────
    // montantTTC = Math.round(43500 * 1.081 * 100) / 100 = 47023.5
    {
      id: 4,
      numero: 'F-2026-001',
      clientId: 3,
      chantierId: 3,
      devisId: 3,
      type: 'finale',
      statut: 'payee',
      dateEmission: '2026-01-15',
      dateEcheance: '2026-02-14',
      datePaiement: '2026-02-10',
      montantHT: 43500,
      tva: 8.1,
      montantTTC: 47023.5,
      montantPaye: 47023.5,
      paiementsHistorique: [
        { date: '2026-02-10', montant: 47023.5, mode: 'virement', reference: 'VIR-2026-0115' },
      ],
      objet: 'Solde – Plateaux Open Space Helvetia',
      notes: 'F3 + F4 = 87500 CHF HT = devis DEV-2025-003 soldé',
    },

    // ── F5 — BPG / CH4 — acompte 50%, payée ─────────────────────────────────
    // montantTTC = Math.round(62000 * 1.081 * 100) / 100 = 67022
    {
      id: 5,
      numero: 'F-2026-002',
      clientId: 4,
      chantierId: 4,
      devisId: 4,
      type: 'acompte',
      statut: 'payee',
      dateEmission: '2026-02-05',
      dateEcheance: '2026-03-07',
      datePaiement: '2026-03-05',
      montantHT: 62000,
      tva: 8.1,
      montantTTC: 67022,
      montantPaye: 67022,
      paiementsHistorique: [
        { date: '2026-03-05', montant: 67022, mode: 'virement', reference: 'VIR-2026-0205' },
      ],
      objet: 'Acompte 50% – BPG Bâtiment Administratif',
      notes: 'Acompte à la commande selon conditions marché public',
    },

    // ── F6 — BPG / CH4 — situation travaux IMPAYÉE >60j → alerte relance ────
    // montantTTC = Math.round(37000 * 1.081 * 100) / 100 = 39997
    // dateEmission 2026-03-10, aujourd'hui 2026-05-20 = 71 jours → alerte critique
    {
      id: 6,
      numero: 'F-2026-003',
      clientId: 4,
      chantierId: 4,
      devisId: 4,
      type: 'situation',
      statut: 'envoyee',      // impayée — déclenche alerte relance (>30j)
      dateEmission: '2026-03-10',
      dateEcheance: '2026-04-09',
      datePaiement: null,
      montantHT: 37000,
      tva: 8.1,
      montantTTC: 39997,
      montantPaye: 0,
      paiementsHistorique: [],
      objet: 'Situation travaux 63% – BPG Bâtiment Administratif',
      notes: 'RELANCE REQUISE — échue depuis le 09/04/2026, aucun retour du service comptable BPG',
    },

    // ── F7 — Dupont / CH5 — acompte récent (~30j) ───────────────────────────
    // montantTTC = Math.round(15000 * 1.081 * 100) / 100 = 16215
    // dateEmission 2026-04-14, aujourd'hui 2026-05-20 = 36 jours → pas encore critique
    {
      id: 7,
      numero: 'F-2026-004',
      clientId: 1,
      chantierId: 5,
      devisId: 5,
      type: 'acompte',
      statut: 'envoyee',      // récente, pas encore en retard
      dateEmission: '2026-04-14',
      dateEcheance: '2026-05-14',
      datePaiement: null,
      montantHT: 15000,
      tva: 8.1,
      montantTTC: 16215,
      montantPaye: 0,
      paiementsHistorique: [],
      objet: 'Acompte 50% – Salle de Réunion Modulaire Dupont',
      notes: 'Envoyée le 14/04, relance possible dès le 15/05',
    },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// RÉSUMÉ DES CAS DE TEST COUVERTS
// ══════════════════════════════════════════════════════════════════════════════
//
//  Agent              | Cas testés
//  ─────────────────────────────────────────────────────────────────────────
//  rentabilite-analyst | CH1 marge ~22%, CH3 dépassement matériel, CH4 EAC/RAD,
//                      | CH7 planifié sans coûts réels → projection impossible
//  facturation-suisse  | TVA 8.1% sur 7 factures, acompte+solde CH3, F6 impayée >60j
//  planning-chantier   | CH4 En cours 25/40j, CH5 6/10j pause Pâques, CH6 8/18j
//  alerts-engine       | F6 retard paiement >60j, CH3 dépassement matériel +12.5%,
//                      | CH7 devis 'envoyé' (pas encore 'accepté')
//  bug-hunter          | Tous les IDs sont numbers, statuts .toLowerCase() sûrs,
//                      | aucun NaN (coefficients appliqués), aucun montantDevis
//  devis-generator     | 9 devis, 3 statuts différents, typesTravaux arrays
//  security-auditor    | clientId/chantierId/devisId présents sur toutes les factures
//  code-reviewer       | Journal format groupé, dates lun-ven uniquement,
//                      | double-fallback materielReel/coutMaterielReel
//
// FORMULES VÉRIFIABLES :
//   CH1  CA=52400 | coût MO réel = 650×20 + 486×20 + 459×17.5 = 31082.5 CHF
//        totalCoûts = 31082.5 + 17200 + 0 + 950 + 680 = 49912.5
//        marge brute = 52400 − 49912.5 = 2487.5 → ~4.7% (chantier limite)
//        (les frais généraux 12% viendraient encore réduire la marge nette)
//   CH3  CA=87500 | imprevus=4000 | materielReel=31500 → dépassement vs prévu 28000
//   CH4  25/40j = 62.5% avancement → projection EAC disponible (>=20%)
//   CH7  journal=[] → avancement=0%, projection impossible, RAD=null, EAC=null
//
// ══════════════════════════════════════════════════════════════════════════════
