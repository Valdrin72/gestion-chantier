import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArchiveToggle from '../ArchiveToggle';

describe('ArchiveToggle', () => {
  it('count=0 → ne rend rien', () => {
    const { container } = render(<ArchiveToggle voirArchives={false} onToggle={vi.fn()} count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('count>0 → affiche "Voir N archivés"', () => {
    render(<ArchiveToggle voirArchives={false} onToggle={vi.fn()} count={3} labelSingulier="chantier archivé" />);
    expect(screen.getByRole('button', { name: /Voir 3 chantier archivés/i })).toBeInTheDocument();
  });

  it('singulier vs pluriel selon le count', () => {
    const { rerender } = render(<ArchiveToggle voirArchives={false} onToggle={vi.fn()} count={1} labelSingulier="chantier archivé" />);
    expect(screen.getByRole('button', { name: /Voir 1 chantier archivé$/i })).toBeInTheDocument();
    rerender(<ArchiveToggle voirArchives={false} onToggle={vi.fn()} count={2} labelSingulier="chantier archivé" />);
    expect(screen.getByRole('button', { name: /Voir 2 chantier archivés/i })).toBeInTheDocument();
  });

  it('voirArchives=true → affiche "Masquer"', () => {
    render(<ArchiveToggle voirArchives={true} onToggle={vi.fn()} count={2} labelSingulier="archivé" />);
    expect(screen.getByRole('button', { name: /Masquer 2 archivés/i })).toBeInTheDocument();
  });

  it('clic → appelle onToggle', () => {
    const onToggle = vi.fn();
    render(<ArchiveToggle voirArchives={false} onToggle={onToggle} count={1} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
