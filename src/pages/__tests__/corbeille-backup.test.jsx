import React from 'react';
import { it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import Parametres from '../ParametresPage';
import { renderWithApp } from '../../test-utils/renderWithApp';
it('export inclut les éléments à la corbeille dans sauvegarde', () => {
 let contenu;
 const client = { id: 'c', nom: 'Dupont', supprime_le: '2026-10-01' };
 const OriginalBlob = globalThis.Blob;
 vi.stubGlobal('Blob', class { constructor(parts) { contenu = JSON.parse(parts[0]); } });
 URL.createObjectURL = vi.fn().mockReturnValue('blob:test'); URL.revokeObjectURL = vi.fn();
 const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
 try {
  renderWithApp(<Parametres parametres={{ employes: [], typesTravaux: [], parametres: {} }} />, { listesCompletes: { clients: [client], chantiers: [], devis: [], factures: [], pointages: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'Exporter backup' }));
  expect(contenu.clients).toEqual([client]); expect(contenu.meta.app).toBe('CYNA');
 } finally { click.mockRestore(); vi.stubGlobal('Blob', OriginalBlob); vi.unstubAllGlobals(); }
});
