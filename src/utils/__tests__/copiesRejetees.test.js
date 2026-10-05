import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enregistrerCopieRejetee, PREFIXE_COPIE_REJETEE, NB_COPIES_REJETEES } from '../copiesRejetees';

const cles = () => Object.keys(localStorage).filter(k => k.startsWith(PREFIXE_COPIE_REJETEE)).sort();

describe('copiesRejetees — rétention et protection de la copie écrite', () => {
  beforeEach(() => localStorage.clear());

  it('REV-01 : un conflit en cours réécrit APRÈS 5 refus plus récents survit et garde ses dernières modifications', () => {
    // Conflit ouvert (id ancien), puis 5 refus de formulaire plus récents.
    expect(enregistrerCopieRejetee('1000-conflit', { devis: [{ id: 'v1' }] })).toBe(true);
    for (let i = 1; i <= 5; i++) enregistrerCopieRejetee(`${2000 + i}-garde${i}`, { clients: [{ id: `g${i}` }] });
    // Nouvelle modification pendant la récupération du conflit : même id, contenu enrichi.
    expect(enregistrerCopieRejetee('1000-conflit', { devis: [{ id: 'v2' }] })).toBe(true);
    const copie = JSON.parse(localStorage.getItem(`${PREFIXE_COPIE_REJETEE}1000-conflit`));
    expect(copie.devis).toEqual([{ id: 'v2' }]);
    expect(cles()).toHaveLength(NB_COPIES_REJETEES);
    // Ce sont les plus anciens refus de formulaire qui partent, pas la copie qu'on vient d'écrire.
    expect(cles()).not.toContain(`${PREFIXE_COPIE_REJETEE}2001-garde1`);
  });

  it('au-delà de 5 refus distincts, seules les 5 plus récentes restent (la nouvelle comprise)', () => {
    for (let i = 1; i <= 7; i++) enregistrerCopieRejetee(`${1000 * i}-r${i}`, { devis: [{ id: `r${i}` }] });
    expect(cles().map(k => k.split('-r')[1])).toEqual(['3', '4', '5', '6', '7']);
  });

  it('écriture refusée (stockage plein) → false, et les copies existantes ne sont pas touchées', () => {
    enregistrerCopieRejetee('1000-a', { devis: [{ id: 'a' }] });
    const espion = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    try { expect(enregistrerCopieRejetee('2000-b', { devis: [{ id: 'b' }] })).toBe(false); } finally { espion.mockRestore(); }
    expect(cles()).toEqual([`${PREFIXE_COPIE_REJETEE}1000-a`]);
  });
});
