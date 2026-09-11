/**
 * Anti-zoom mobile TRANSVERSAL — 2 correctifs CSS (mobile only, PC inchangé) :
 *   1. .table-cards : tables → cartes empilées sur mobile (classe auparavant MORTE → débordement).
 *   2. grilles --g* (dont --g6) : overrides mobiles déplacés dans :root pour s'appliquer réellement.
 *
 * ⚠ jsdom n'évalue PAS les @media → on ne peut pas lire le reflow via getComputedStyle.
 * Preuve RÉELLE en 2 volets :
 *   (A) ARTEFACT CSS : les règles existent bien DANS la media query mobile et NULLE PART en PC.
 *   (B) RENDU RÉEL : les vraies tables (Factures) portent la classe `table-cards` et leur contenu
 *       est inchangé → le correctif CSS s'applique bien aux bons éléments.
 */
import React from 'react';
import fs from 'fs';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithApp } from '../test-utils/renderWithApp';
import Factures from '../Factures';

const CSS = fs.readFileSync('src/index.css', 'utf8'); // vitest s'exécute depuis la racine du projet
const MEDIA = '@media (max-width: 767px)';
const idxMedia = CSS.indexOf(MEDIA);
const avantMedia = CSS.slice(0, idxMedia);   // tout le CSS « PC » (hors media mobile)
const apresMedia = CSS.slice(idxMedia);       // le bloc mobile (jusqu'à la fin du fichier)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, media: '', onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
      removeEventListener: () => {}, dispatchEvent: () => false });
  }
});

describe('(A) Artefact CSS — .table-cards : cartes empilées, MOBILE uniquement', () => {
  it('la media query mobile transforme les tables .table-cards en blocs empilés', () => {
    expect(idxMedia).toBeGreaterThan(-1);
    expect(apresMedia).toContain('.table-cards');
    expect(apresMedia).toMatch(/\.table-cards[^{]*\{[^}]*display:\s*block/); // lignes/cellules en bloc
    expect(apresMedia).toMatch(/\.table-cards thead\s*\{\s*display:\s*none/);  // en-têtes masqués
  });

  it('AUCUNE règle .table-cards en PC (hors media) → rendu desktop strictement inchangé', () => {
    expect(avantMedia).not.toContain('.table-cards'); // la classe n'est stylée QUE dans le bloc mobile
  });
});

describe('(A) Artefact CSS — grilles --g* dans :root (overrides mobiles activés)', () => {
  it('le bloc mobile redéfinit --g6 à 1 colonne, DANS un :root', () => {
    expect(apresMedia).toMatch(/--g6\s*:\s*1fr/);          // 6 colonnes → 1 colonne sur mobile
    // Les overrides sont bien dans une règle :root (sinon ignorés par les navigateurs).
    const rootMobile = apresMedia.slice(apresMedia.indexOf(':root'));
    expect(rootMobile).toMatch(/--g6\s*:\s*1fr/);
    expect(rootMobile).toMatch(/--g-form2\s*:\s*1fr/);      // correctif : les autres grilles s'appliquent aussi
  });
});

describe('(B) Rendu réel — les vraies tables Factures portent .table-cards, contenu inchangé', () => {
  const CLIENT = { id: '1', prenom: 'Alice', nom: 'Dupont', entreprise: 'Dupont SA' };
  const CHANTIER_F = { id: 'CH1', nom: 'Chantier Test', numero: 'C-001', statut: 'en cours', clientId: '1', devisId: 'D1' };
  const DEVIS_F = { id: 'D1', numero: 'D-001', clientId: '1', montantHT: 50000, statut: 'accepté' };
  const FACTURE = {
    id: 'F1', numero: 'F-2026-001', clientId: '1', chantierId: 'CH1', devisId: 'D1',
    type: 'situation', statut: 'envoyee', dateEmission: '2026-03-01', dateEcheance: '2026-03-31',
    montantHT: 20000, tva: 8.1, montantTTC: 21620, montantPaye: 0, lignes: [],
  };
  const props = {
    factures: [FACTURE], onSave: vi.fn(), clients: [CLIENT], chantiers: [CHANTIER_F], devis: [DEVIS_F],
    paiementsData: {}, setPaiementsData: vi.fn(), naviguer: vi.fn(),
    profil: { id: 'cyna', pages: ['finances'], role: 'cyna' }, periodeGlobale: 'annee',
    parametres: { employes: [] }, preRemplir: null, onConsumePreRemplir: vi.fn(),
  };

  it('mobile (375) : une table.table-cards est rendue ET la valeur affichée est inchangée', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container } = renderWithApp(<Factures {...props} />, {});
    expect(container.querySelector('table.table-cards')).not.toBeNull(); // le correctif CSS s'appliquera
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();           // contenu inchangé
  });

  it('desktop (1200) : la même table porte toujours .table-cards, contenu inchangé', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    const { container } = renderWithApp(<Factures {...props} />, {});
    expect(container.querySelector('table.table-cards')).not.toBeNull();
    expect(screen.getByText('Dupont SA')).toBeInTheDocument();
  });
});
