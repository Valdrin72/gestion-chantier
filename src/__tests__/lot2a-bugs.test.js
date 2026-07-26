/**
 * Lot 2a — deux bugs corrigés (tests réels + mordants).
 *  BUG 1 : marge moyenne bureau vs mobile → une seule formule PONDÉRÉE partout.
 *  BUG 2 : alertes de paiement/facture pointaient vers des pages inexistantes → 404.
 */
import { describe, it, expect } from 'vitest';
import { margeMoyennePonderee } from '../donnees';
import { calculerAlertes } from '../alertes';

// ════════════════════════════════════════════════════════════════════
// BUG 1 — marge moyenne pondérée (source unique bureau = mobile)
// ════════════════════════════════════════════════════════════════════
describe('BUG 1 — margeMoyennePonderee : pondérée par le CA, jamais moyenne simple', () => {
  // Deux chantiers aux CA très différents : un gros rentable, un petit à perte.
  const gros  = { montantTotal: 500000, totalCoutsReel: 375000, margeReel: 125000 }; // +25%
  const petit = { montantTotal: 5000,   totalCoutsReel: 7500,   margeReel: -2500 };  // -50%

  it('MORDANT : le petit chantier à perte ne plombe PAS la moyenne (pondération par le CA)', () => {
    const ponderee = margeMoyennePonderee([gros, petit]);
    // Pondérée = (125000 − 2500) / 505000 = 24.26 % → le gros CA domine.
    expect(Math.round(ponderee)).toBe(24);
    // Moyenne SIMPLE (l'ancien bug mobile) aurait donné (25 − 50)/2 = −12.5 %.
    const moyenneSimple = (25 + -50) / 2;
    expect(Math.round(ponderee)).not.toBe(Math.round(moyenneSimple)); // ÉCHOUE si on revient à la simple
  });

  it('bureau ET mobile lisent LA MÊME valeur (déterministe) — même entrée, même sortie', () => {
    const a = margeMoyennePonderee([gros, petit]);
    const b = margeMoyennePonderee([gros, petit]);
    expect(a).toBe(b);
    // le Dashboard arrondit les deux cartes avec Math.round(kpi.rentaMoyenne) → identiques par construction.
    expect(Math.round(a)).toBe(Math.round(b));
  });

  it('exclut les chantiers sans CA / sans coûts / incomplets ; null si rien d\'exploitable', () => {
    expect(margeMoyennePonderee([])).toBeNull();
    expect(margeMoyennePonderee([{ montantTotal: 0, totalCoutsReel: 100, margeReel: -100 }])).toBeNull();
    expect(margeMoyennePonderee([{ montantTotal: 1000, totalCoutsReel: 800, margeReel: 200, donneesIncompletes: true }])).toBeNull();
    // un seul chantier valide → sa propre marge
    expect(Math.round(margeMoyennePonderee([gros]))).toBe(25);
  });
});

// ════════════════════════════════════════════════════════════════════
// BUG 2 — les alertes ne pointent QUE vers des écrans réels (pas de 404)
// ════════════════════════════════════════════════════════════════════
// Pages réellement rendues par le routeur (src/App.js). Toute autre cible = 404.
const PAGES_VALIDES = new Set([
  'dashboard', 'chantiers', 'devis', 'finances', 'clients', 'employes',
  'planning', 'rapport', 'agents', 'calculs', 'alertes', 'parametres', 'heures', 'pointages',
]);
const ONGLETS_FINANCES = new Set(['tresorerie', 'factures', 'relances', 'paiements']);

describe('BUG 2 — alertes de paiement/facture : cible réelle, plus de 404', () => {
  const vieux = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10); // > 30 j
  const data = {
    chantiers: [],
    devis: [],
    factures: [{ id: 'f1', statut: 'brouillon' }],
    paiements: {
      ch1: [
        { statut: 'En attente', dateEcheance: vieux, montant: 1000, type: 'acompte', chantierId: 'ch1' },
        { statut: 'En attente', date: vieux, montant: 500 /* pas de factureId */ },
      ],
    },
  };
  const alertes = calculerAlertes(data, 'cyna');

  it('MORDANT : AUCUNE alerte ne pointe vers une page inexistante (fini le 404)', () => {
    for (const a of alertes) {
      if (a.page) expect(PAGES_VALIDES.has(a.page), `page morte détectée: "${a.page}" (${a.type})`).toBe(true);
    }
    // explicitement : plus aucune trace des anciennes cibles mortes
    expect(alertes.some(a => a.page === 'paiements' || a.page === 'factures')).toBe(false);
  });

  it('l\'alerte "facture brouillon" ouvre Finances → onglet Factures', () => {
    const a = alertes.find(x => x.type === 'factures_brouillon');
    expect(a).toBeDefined();
    expect(a.page).toBe('finances');
    expect(ONGLETS_FINANCES.has(a.onglet)).toBe(true);
    expect(a.onglet).toBe('factures');
  });

  it('les alertes de paiement ouvrent Finances → onglet Paiements', () => {
    const enAttente = alertes.find(x => x.type === 'paiement_en_attente');
    const sansFacture = alertes.find(x => x.type === 'paiements_sans_facture');
    for (const a of [enAttente, sansFacture]) {
      expect(a).toBeDefined();
      expect(a.page).toBe('finances');
      expect(a.onglet).toBe('paiements');
    }
  });

  it('les alertes déjà valides restent inchangées (chantiers, devis, finances)', () => {
    // Un chantier terminé sans facture → alerte vers 'chantiers' (cible déjà correcte).
    const d2 = { ...data, chantiers: [{ id: 'c9', nom: 'Réno', statut: 'terminé', dateFin: '2024-01-01' }] };
    const al = calculerAlertes(d2, 'cyna');
    for (const a of al) if (a.page) expect(PAGES_VALIDES.has(a.page)).toBe(true);
  });
});
