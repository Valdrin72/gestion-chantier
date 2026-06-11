import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArchivedRow from '../ArchivedRow';

describe('ArchivedRow', () => {
  it('affiche label + sublabel', () => {
    render(<ArchivedRow label="Bureaux Dupont" sublabel="CH-2026-001 · Terminé" onRestaurer={vi.fn()} />);
    expect(screen.getByText('Bureaux Dupont')).toBeInTheDocument();
    expect(screen.getByText('CH-2026-001 · Terminé')).toBeInTheDocument();
  });

  it('affiche la date d\'archivage formatée fr-CH', () => {
    render(<ArchivedRow label="X" dateArchivage="2026-06-11T08:00:00.000Z" onRestaurer={vi.fn()} />);
    expect(screen.getByText(/Archivé le 11\.06\.26/)).toBeInTheDocument();
  });

  it('sans dateArchivage → pas de mention "Archivé le"', () => {
    render(<ArchivedRow label="X" onRestaurer={vi.fn()} />);
    expect(screen.queryByText(/Archivé le/)).toBeNull();
  });

  it('bouton Restaurer → appelle onRestaurer', () => {
    const onRestaurer = vi.fn();
    render(<ArchivedRow label="X" onRestaurer={onRestaurer} />);
    fireEvent.click(screen.getByRole('button', { name: /Restaurer/i }));
    expect(onRestaurer).toHaveBeenCalledOnce();
  });

  it('clic sur la ligne → onClick ; clic Restaurer ne déclenche PAS onClick', () => {
    const onClick = vi.fn();
    const onRestaurer = vi.fn();
    render(<ArchivedRow label="Voir détail" onClick={onClick} onRestaurer={onRestaurer} />);
    fireEvent.click(screen.getByText('Voir détail'));
    expect(onClick).toHaveBeenCalledOnce();
    // Restaurer stoppe la propagation
    fireEvent.click(screen.getByRole('button', { name: /Restaurer/i }));
    expect(onRestaurer).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce(); // toujours 1, pas 2
  });
});
