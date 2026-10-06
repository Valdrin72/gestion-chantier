import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Finances from '../FinancesPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Factures : affiche preRemplir pour vérifier l'orchestration
vi.mock('../../Factures', () => ({
  default: ({ preRemplir, onConsumePreRemplir }) => (
    <div data-testid="mock-factures">
      {preRemplir && (
        <>
          <span data-testid="pre-remplir-type">{preRemplir.type}</span>
          {preRemplir.extraId && <span data-testid="pre-remplir-extraid">{preRemplir.extraId}</span>}
          {preRemplir.chantierId && <span data-testid="pre-remplir-chantierid">{preRemplir.chantierId}</span>}
        </>
      )}
    </div>
  ),
}));

vi.mock('../../RelancesTab', () => ({
  default: () => <div data-testid="mock-relances" />,
}));

// Supabase : requis indirectement via donnees.js helpers
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));


it.each(['devis', 'chantiers', 'clients'])('facture liée à %s à la corbeille reste valide pendant nettoyage', async type => {
 const facture = { id: 'f', numero: 'F-001', chantierId: 'ch', devisId: 'd', clientId: 'c', montantTTC: 100, montantHT: 90, statut: 'brouillon' };
 const references = { clients: [{ id: 'c', nom: 'Dupont' }], devis: [{ id: 'd', clientId: 'c', numero: 'D-001', montantHT: 100 }], chantiers: [{ id: 'ch', nom: 'Bureaux', devisId: 'd', clientId: 'c', extras: [], statut: 'En cours' }], factures: [facture], pointages: [] };
 references[type][0].supprime_le = '2026-10-01T00:00:00Z';
 const visibles = Object.fromEntries(['clients','devis','chantiers'].map(t => [t, references[t].filter(x => !x.supprime_le)]));
 const onSave = vi.fn(); const orpheline = { ...facture, id: 'orpheline', chantierId: 'absent', devisId: null, clientId: null };
 renderWithApp(<Finances {...visibles} factures={[facture, orpheline]} onSave={onSave} parametres={{ employes: [], parametres: {} }} contexte={{}} pointages={[]} />, { listesCompletes: references, confirmer: vi.fn().mockResolvedValue(true) });
 expect(screen.getByText(/1 facture sans chantier ni devis rattaché/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Supprimer', exact: true }));
 await waitFor(() => expect(onSave).toHaveBeenCalledWith([facture]));
});
