import { describe, it, expect } from 'vitest';
import { paques, feriesGeneve, feriesVaud, estFerie } from '../feries';

// ── Pâques ────────────────────────────────────────────────────────────────────

describe('paques', () => {
  it('retourne 2025-04-20', () => {
    const p = paques(2025);
    expect(`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`).toBe('2025-04-20');
  });
  it('retourne 2026-04-05', () => {
    const p = paques(2026);
    expect(`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`).toBe('2026-04-05');
  });
  it('retourne 2024-03-31', () => {
    const p = paques(2024);
    expect(`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`).toBe('2024-03-31');
  });
});

// ── Genève — jours fixes ──────────────────────────────────────────────────────

describe('feriesGeneve — fixes 2025', () => {
  const ge = feriesGeneve(2025);
  it('Nouvel An', () => expect(ge.has('2025-01-01')).toBe(true));
  it('Fête du Travail', () => expect(ge.has('2025-05-01')).toBe(true));
  it('Fête nationale', () => expect(ge.has('2025-08-01')).toBe(true));
  it('Noël', () => expect(ge.has('2025-12-25')).toBe(true));
  it('Restauration genevoise', () => expect(ge.has('2025-12-31')).toBe(true));
  it('Saint-Étienne (12-26) EXCLU', () => expect(ge.has('2025-12-26')).toBe(false));
  it('Berchtoldstag (01-02) EXCLU de GE', () => expect(ge.has('2025-01-02')).toBe(false));
});

describe('feriesGeneve — mobiles 2025 (Pâques 20 avril)', () => {
  const ge = feriesGeneve(2025);
  it('Vendredi Saint', () => expect(ge.has('2025-04-18')).toBe(true));
  it('Lundi de Pâques', () => expect(ge.has('2025-04-21')).toBe(true));
  it('Ascension', () => expect(ge.has('2025-05-29')).toBe(true));
  it('Lundi de Pentecôte', () => expect(ge.has('2025-06-09')).toBe(true));
  it('Jeûne genevois 2025 = 11 sept', () => expect(ge.has('2025-09-11')).toBe(true));
  it('Jeûne genevois 2026 = 10 sept', () => expect(feriesGeneve(2026).has('2026-09-10')).toBe(true));
  it('10 jours au total', () => expect(ge.size).toBe(10));
});

// ── Vaud — jours ─────────────────────────────────────────────────────────────

describe('feriesVaud — fixes 2025', () => {
  const vd = feriesVaud(2025);
  it('Berchtoldstag', () => expect(vd.has('2025-01-02')).toBe(true));
  it('Nouvel An', () => expect(vd.has('2025-01-01')).toBe(true));
  it('Restauration GE (12-31) EXCLU de VD', () => expect(vd.has('2025-12-31')).toBe(false));
  it('Jeûne fédéral VD 2025 = 3e lundi sept = 15 sept', () => expect(vd.has('2025-09-15')).toBe(true));
  it('Jeûne fédéral VD 2026 = 21 sept', () => expect(feriesVaud(2026).has('2026-09-21')).toBe(true));
  it('10 jours au total', () => expect(vd.size).toBe(10));
});

// ── estFerie ──────────────────────────────────────────────────────────────────

describe('estFerie', () => {
  it('01-01 est férié GE', () => expect(estFerie('2025-01-01', 'GE')).toBe(true));
  it('01-02 est férié VD', () => expect(estFerie('2026-01-02', 'VD')).toBe(true));
  it('01-02 N\'est PAS férié GE', () => expect(estFerie('2026-01-02', 'GE')).toBe(false));
  it('12-31 est férié GE', () => expect(estFerie('2025-12-31', 'GE')).toBe(true));
  it('12-31 N\'est PAS férié VD', () => expect(estFerie('2025-12-31', 'VD')).toBe(false));
  it('lundi ouvrable', () => expect(estFerie('2025-09-01', 'GE')).toBe(false));
  it('défaut canton = GE', () => expect(estFerie('2025-12-31')).toBe(true));
  it('cache — appels répétés cohérents', () => {
    expect(estFerie('2025-04-18', 'GE')).toBe(true);
    expect(estFerie('2025-04-18', 'GE')).toBe(true);
  });
});
