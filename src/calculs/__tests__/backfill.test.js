/**
 * Tests unitaires du backfill Phase 4 :
 * - Un pointage sans majoration sur un samedi doit être enrichi
 * - Un pointage déjà enrichi ne doit pas être modifié
 * - Un pointage sur un lundi reste sans majoration
 */
import { describe, it, expect } from 'vitest';
import { calculerMajorationDate } from '../majorations';

// Simule la logique de backfill de App.js (sans les hooks React)
function backfillPointage(p, canton = 'GE') {
  if (p.majoration !== null && p.majoration !== undefined) return p;
  const repProd = p.repartitions.find(r => ['production', 'atelier'].includes(r.categorie));
  if (!repProd) return p;
  const maj = calculerMajorationDate(p.date, canton);
  if (!maj) return p;
  const heuresProd = p.repartitions
    .filter(r => ['production', 'atelier'].includes(r.categorie))
    .reduce((s, r) => s + r.heures, 0);
  if (heuresProd <= 0) return p;
  return { ...p, majoration: [{ type: maj.type, facteur: maj.facteur, heures: heuresProd, cout_supplementaire: 0 }] };
}

describe('backfill Phase 4', () => {
  it('pointage sur samedi sans majoration → enrichi avec facteur 1.25', () => {
    const p = {
      id: 'ptg_sam',
      date: '2025-09-06', // samedi
      employeId: '1',
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
      majoration: null,
    };
    const enrichi = backfillPointage(p, 'GE');
    expect(enrichi.majoration).not.toBeNull();
    expect(enrichi.majoration[0].facteur).toBe(1.25);
    expect(enrichi.majoration[0].heures).toBe(8);
  });

  it('pointage déjà enrichi → non modifié', () => {
    const majExistante = [{ type: 'samedi', facteur: 1.25, heures: 8, cout_supplementaire: 0 }];
    const p = {
      id: 'ptg_sam_existing',
      date: '2025-09-06',
      employeId: '1',
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
      majoration: majExistante,
    };
    const result = backfillPointage(p, 'GE');
    expect(result).toBe(p); // même référence — non muté
  });

  it('pointage sur lundi ouvrable → majoration reste null', () => {
    const p = {
      id: 'ptg_lundi',
      date: '2025-09-01', // lundi
      employeId: '1',
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH1' }],
      majoration: null,
    };
    const result = backfillPointage(p, 'GE');
    expect(result.majoration).toBeNull();
    expect(result).toBe(p);
  });

  it('Berchtoldstag VD (2026-01-02) → enrichi si canton=VD', () => {
    const p = {
      id: 'ptg_berch',
      date: '2026-01-02',
      employeId: '1',
      repartitions: [{ categorie: 'production', heures: 8, chantierId: 'CH3' }],
      majoration: null,
    };
    const enrichi = backfillPointage(p, 'VD');
    expect(enrichi.majoration).not.toBeNull();
    expect(enrichi.majoration[0].facteur).toBe(1.50);
    expect(enrichi.majoration[0].type).toBe('ferie');
  });
});
