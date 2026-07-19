/**
 * Fix C2 — une vraie facture ne doit JAMAIS être supprimée au chargement.
 * Avant : une liste codée en dur (F-2026-005…018) était filtrée à chaque chargement, y compris
 * sur un vrai compte → une facture client portant ce numéro (format RÉEL CYNA) disparaissait.
 * Chemin RÉEL exercé : la vraie fonction de chargement resolveDataFromBlob.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock supabase avant l'import du module (sinon throw env manquant).
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() })),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}));

import { resolveDataFromBlob } from '../hooks/useSupabaseData';

// Numéros qui étaient dans l'ancienne liste noire — ce sont des numéros CYNA plausibles.
const FACTURES = [
  { id: 'f7', numero: 'F-2026-007', chantierId: 'c1', montantHT: 12000, montantTTC: 12972, statut: 'emise' },
  { id: 'f11', numero: 'F-2026-011', chantierId: 'c1', montantHT: 5000, statut: 'payee' },
  { id: 'f1', numero: 'F-2026-001', chantierId: 'c1', montantHT: 3000, statut: 'emise' },
];
const BLOB = { factures: FACTURES, chantiers: [], devis: [], clients: [], pointages: [], parametres: {} };

describe('Fix C2 — les factures réelles survivent au chargement', () => {
  it('vrai compte : F-2026-007 et F-2026-011 SURVIVENT (aucun filtrage runtime)', () => {
    const r = resolveDataFromBlob(BLOB, false); // isDemo = false → vrai compte
    const numeros = r.factures.map(f => f.numero);
    expect(numeros).toContain('F-2026-007');
    expect(numeros).toContain('F-2026-011');
    expect(numeros).toContain('F-2026-001');
    expect(r.factures).toHaveLength(3); // aucune perte
    // Pas de re-sync déclenché par un « nettoyage » de factures.
    expect(r.needsSync).toBe(false);
  });

  it('cycle complet : recharger le blob rendu ne perd toujours aucune facture (idempotent)', () => {
    const r1 = resolveDataFromBlob(BLOB, false);
    const r2 = resolveDataFromBlob({ ...BLOB, factures: r1.factures }, false);
    expect(r2.factures.map(f => f.numero).sort()).toEqual(['F-2026-001', 'F-2026-007', 'F-2026-011']);
  });
});
