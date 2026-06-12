/**
 * Couverture RapportsPage — reporting historique.
 * Vrais composants rendus (RapportsPage → Analyse), pas de logic-mirror.
 * Cohérence Phase 3 : les totaux HISTORIQUES incluent les chantiers archivés.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithApp } from '../../test-utils/renderWithApp.jsx';
import RapportsPage from '../RapportsPage.js';
import { fmtN } from '../../donnees.js';

const ANNEE = new Date().getFullYear();

const PARAMETRES = {
  employes: [], localites: [], typesTravaux: [],
  parametres: { tauxTVA: 8.1, tauxFraisGeneraux: 12, tauxChargesSociales: 25, tauxImpots: 15 },
};

const DEVIS = [
  { id: 'dv-1', montantHT: 60000, statut: 'Accepté', clientId: 'cl-1' },
  { id: 'dv-2', montantHT: 40000, statut: 'Accepté', clientId: 'cl-1' },
];

const CLIENTS = [{ id: 'cl-1', nom: 'Dupont', prenom: 'Jean', entreprise: 'Dupont SA' }];

function makeChantiers({ archiverPremier = false } = {}) {
  return [
    {
      id: 'c-1', nom: 'Chantier Un', statut: 'En cours', clientId: 'cl-1', devisId: 'dv-1',
      dateDebut: `${ANNEE}-02-01`, nombreJours: 10, journal: [], equipe: [],
      ...(archiverPremier ? { archive: true, dateArchivage: `${ANNEE}-03-01T00:00:00.000Z` } : {}),
    },
    {
      id: 'c-2', nom: 'Chantier Deux', statut: 'Terminé', clientId: 'cl-1', devisId: 'dv-2',
      dateDebut: `${ANNEE}-03-01`, nombreJours: 5, journal: [], equipe: [],
    },
  ];
}

function renderRapports(props = {}) {
  return renderWithApp(
    <RapportsPage
      chantiers={props.chantiers ?? []}
      clients={CLIENTS}
      devis={DEVIS}
      parametres={PARAMETRES}
      setParametres={() => {}}
      paiementsData={[]}
      periodeGlobale="annee"
      naviguer={() => {}}
      factures={[]}
    />,
    props.ctx ?? {}
  );
}

describe('RapportsPage — structure et onglets', () => {
  it('rend les 4 onglets : Rapport IA, Analyse, Simulateur, Benchmark', () => {
    renderRapports();
    expect(screen.getByRole('button', { name: /Rapport IA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulateur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Benchmark/i })).toBeInTheDocument();
  });

  it('onglet par défaut = Rapport IA, message si pas encore généré', () => {
    renderRapports();
    expect(screen.getByText(/Rapport IA non encore généré/i)).toBeInTheDocument();
  });

  it('rapport IA généré → paragraphes + score affichés', () => {
    renderRapports({
      ctx: {
        agentState: {
          agentData: {
            RapportNaturel: {
              date: 'Semaine du 08.06', scoreEntreprise: 72,
              paras: ['La semaine a été solide.', 'Deux chantiers en retard.'],
              actionPrincipale: { action: 'Relancer la facture F-12', detail: 'En retard de 45 jours' },
            },
          },
        },
      },
    });
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('La semaine a été solide.')).toBeInTheDocument();
    expect(screen.getByText('Relancer la facture F-12')).toBeInTheDocument();
  });
});

describe('RapportsPage → Analyse — agrégats corrects', () => {
  it('onglet Analyse : CA total = somme des devis des chantiers en période (100 000)', () => {
    renderRapports({ chantiers: makeChantiers() });
    fireEvent.click(screen.getByRole('button', { name: /^Analyse$/i }));

    // CA total = 60 000 + 40 000 = 100 000 → affiché "100'000" (fmtN)
    expect(screen.getAllByText(new RegExp(fmtN(100000).replace("'", "['']"))).length).toBeGreaterThan(0);
  });

  it('MONEY / cohérence Phase 3 : archiver un chantier ne fait PAS baisser le CA du rapport', () => {
    // Avant archivage
    const { unmount } = renderRapports({ chantiers: makeChantiers() });
    fireEvent.click(screen.getByRole('button', { name: /^Analyse$/i }));
    const avant = screen.getAllByText(new RegExp(fmtN(100000).replace("'", "['']"))).length;
    expect(avant).toBeGreaterThan(0);
    unmount();

    // Après archivage du chantier c-1 (60 000) → total INCHANGÉ à 100 000
    renderRapports({ chantiers: makeChantiers({ archiverPremier: true }) });
    fireEvent.click(screen.getByRole('button', { name: /^Analyse$/i }));
    const apres = screen.getAllByText(new RegExp(fmtN(100000).replace("'", "['']"))).length;
    expect(apres).toBeGreaterThan(0);
  });

  it('chantier archivé toujours visible dans le détail "Prévu vs Réel" du rapport', () => {
    renderRapports({ chantiers: makeChantiers({ archiverPremier: true }) });
    fireEvent.click(screen.getByRole('button', { name: /^Analyse$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Prévu vs Réel/i }));

    // L'onglet "Prévu vs Réel" d'Analyse liste les chantiers de la période — l'archivé y reste
    expect(screen.getAllByText(/Chantier Un/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chantier Deux/).length).toBeGreaterThan(0);
  });

  it('aucun chantier → la page Analyse rend sans NaN', () => {
    const { container } = renderRapports({ chantiers: [] });
    fireEvent.click(screen.getByRole('button', { name: /^Analyse$/i }));
    expect(container.textContent).not.toContain('NaN');
  });
});
