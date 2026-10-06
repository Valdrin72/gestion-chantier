import { describe, it, expect } from 'vitest';
import { estSupprime, visibles, corbeille, mettreALaCorbeille, restaurerDeLaCorbeille, appliquerSurVisibles, aPurger, referentsALaCorbeille, fusionnerIdsSupprimes } from '../corbeille';
const ancien = { id: 1, supprime_le: '2026-09-01T00:00:00Z', supprime_par: 'Salihu' };
const listes = (extra = {}) => ({ clients: [ancien], devis: [], chantiers: [], factures: [], pointages: [], ...extra });
describe('corbeille', () => {
 it('marque, filtre et restaure sans mutation', () => {
  const x = { id: 2 }; const marque = mettreALaCorbeille(x, 'Moi', '2026-10-01T00:00:00Z');
  expect(estSupprime(marque)).toBe(true); expect(x).toEqual({ id: 2 });
  expect(visibles([x, marque])).toEqual([x]); expect(corbeille([x, marque])).toEqual([marque]);
  expect(restaurerDeLaCorbeille(marque)).toEqual(x);
 });
 it('préserve la corbeille et identité neutre', () => {
  const prev = [{ id: 2 }, ancien]; expect(appliquerSurVisibles(prev, x => x)).toBe(prev);
  expect(appliquerSurVisibles(prev, [])).toEqual([ancien]);
 });
 it('refuse les tableaux périmés et les ids détruits', () => {
  expect(appliquerSurVisibles([ancien], [{ id: 1 }, { id: 2 }], [2])).toEqual([ancien]);
 });
 it('purge à 31 jours mais pas à 29 jours', () => {
  expect(aPurger(listes(), '2026-10-02T00:00:00Z')).toEqual([{ type: 'clients', element: ancien }]);
  expect(aPurger(listes(), '2026-09-30T00:00:00Z')).toEqual([]);
 });
 it.each(['factures', 'devis'])('ne purge pas le client référencé par %s, même à la corbeille', type => {
  expect(aPurger(listes({ [type]: [{ id: 2, clientId: 1, supprime_le: ancien.supprime_le }] }), '2026-10-02').some(r => r.type === 'clients')).toBe(false);
 });
 it.each(['factures', 'pointages'])('ne purge pas le chantier référencé par %s', type => {
  const ref = type === 'factures' ? { chantierId: 1 } : { repartitions: [{ chantierId: 1 }] };
  expect(aPurger(listes({ clients: [], chantiers: [ancien], [type]: [ref] }), '2026-10-02')).toEqual([]);
 });
 it('propose les référents et fusionne les ids par type', () => {
  expect(referentsALaCorbeille('devis', { clientId: 1 }, listes())).toEqual([{ type: 'clients', element: ancien }]);
  expect(fusionnerIdsSupprimes({ clients: [1] }, { clients: [1, 2], devis: [1] })).toEqual({ clients: [1, 2], devis: [1] });
 });
});
