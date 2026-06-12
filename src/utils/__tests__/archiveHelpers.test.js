import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  archiver,
  restaurer,
  estArchive,
  filtrerActifs,
  filtrerArchives,
} from '../archiveHelpers';

afterEach(() => { vi.useRealTimers(); });

describe('archiver', () => {
  it('pose archive:true + dateArchivage ISO', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T08:30:00.000Z'));
    const r = archiver({ id: 1, nom: 'X' });
    expect(r.archive).toBe(true);
    expect(r.dateArchivage).toBe('2026-06-11T08:30:00.000Z');
  });

  it('immutable — ne mute pas l\'entité source', () => {
    const src = { id: 1, nom: 'X' };
    archiver(src);
    expect(src.archive).toBeUndefined();
  });

  it('préserve les autres champs', () => {
    const r = archiver({ id: 1, nom: 'X', statut: 'Terminé' });
    expect(r.id).toBe(1);
    expect(r.nom).toBe('X');
    expect(r.statut).toBe('Terminé');
  });
});

describe('restaurer', () => {
  it('met archive:false et efface dateArchivage', () => {
    const r = restaurer({ id: 1, archive: true, dateArchivage: '2026-06-01T00:00:00.000Z' });
    expect(r.archive).toBe(false);
    expect(r.dateArchivage).toBeUndefined();
  });

  it('immutable — ne mute pas la source', () => {
    const src = { id: 1, archive: true, dateArchivage: 'x' };
    restaurer(src);
    expect(src.archive).toBe(true);
  });
});

describe('estArchive', () => {
  it('true si archive===true', () => {
    expect(estArchive({ archive: true })).toBe(true);
  });
  it('false si archive absent ou false', () => {
    expect(estArchive({})).toBe(false);
    expect(estArchive({ archive: false })).toBe(false);
    expect(estArchive(null)).toBe(false);
  });
});

describe('filtrerActifs', () => {
  it('exclut les entités archive===true', () => {
    const liste = [{ id: 1 }, { id: 2, archive: true }, { id: 3, archive: false }];
    const r = filtrerActifs(liste);
    expect(r.map(e => e.id)).toEqual([1, 3]);
  });
  it('liste vide/undefined → []', () => {
    expect(filtrerActifs([])).toEqual([]);
    expect(filtrerActifs(undefined)).toEqual([]);
  });
});

describe('filtrerArchives', () => {
  it('ne garde que les entités archive===true', () => {
    const liste = [{ id: 1 }, { id: 2, archive: true }, { id: 3, archive: false }];
    const r = filtrerArchives(liste);
    expect(r.map(e => e.id)).toEqual([2]);
  });
  it('liste vide/undefined → []', () => {
    expect(filtrerArchives([])).toEqual([]);
    expect(filtrerArchives(undefined)).toEqual([]);
  });
});

describe('archiver → filtrerActifs : intégration', () => {
  it('un élément archivé disparaît de la vue active et apparaît dans les archives', () => {
    const liste = [{ id: 1, nom: 'A' }, { id: 2, nom: 'B' }];
    const apresArchive = liste.map(e => e.id === 1 ? archiver(e) : e);
    expect(filtrerActifs(apresArchive).map(e => e.id)).toEqual([2]);
    expect(filtrerArchives(apresArchive).map(e => e.id)).toEqual([1]);
  });

  it('restaurer le ramène dans la vue active', () => {
    const liste = [archiver({ id: 1, nom: 'A' }), { id: 2, nom: 'B' }];
    const apresRestore = liste.map(e => e.id === 1 ? restaurer(e) : e);
    expect(filtrerActifs(apresRestore).map(e => e.id)).toEqual([1, 2]);
    expect(filtrerArchives(apresRestore)).toEqual([]);
  });
});
