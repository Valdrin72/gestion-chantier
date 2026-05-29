/**
 * Fix #2 — Démarrage propre : jamais de données démo dans un vrai compte
 *
 * Prouve que resolveDataFromBlob (le VRAI chemin de décision de useSupabaseData) :
 * (A) Vrai compte + blob vide     → tout vide + PARAMETRES_DEFAUT, ZERO chantier démo
 * (B) Vrai compte + blob existant → préservé tel quel, pas d'injection démo
 * (C) Mode démo + blob vide       → donneesInitiales injectés (démo non cassée)
 * (D) Mode démo + version périmée → rechargement donneesInitiales
 */
import { describe, it, expect, vi } from 'vitest';

// Mock supabase avant l'import du module testé (sinon throw env manquant)
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() })),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}));

import { resolveDataFromBlob, PARAMETRES_DEFAUT } from '../useSupabaseData';
import { donneesInitiales } from '../../donnees';

// ── (A) Vrai compte + blob vide / null ──────────────────────────────────────
describe('Fix #2-A — vrai compte + blob vide → démarrage propre', () => {
  it('blob null → chantiers vides, zéro chantier démo', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.chantiers).toHaveLength(0);
  });

  it('blob null → devis vides', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.devis).toHaveLength(0);
  });

  it('blob null → clients vides', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.clients).toHaveLength(0);
  });

  it('blob null → factures vides', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.factures).toHaveLength(0);
  });

  it('blob null → employes vides (pas les 10 employés démo)', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.parametres.employes).toHaveLength(0);
  });

  it('blob null → demoVersion alignée', () => {
    const r = resolveDataFromBlob(null, false);
    expect(r.parametres.demoVersion).toBeGreaterThan(0);
  });

  it('blob null → config BTP GE présente (typesTravaux non vide)', () => {
    // typesTravaux est config standard GE — utile dès le 1er jour
    const r = resolveDataFromBlob(null, false);
    expect(r.parametres.typesTravaux?.length).toBeGreaterThan(0);
  });

  it('blob vide {} → même résultat que null', () => {
    const r = resolveDataFromBlob({}, false);
    expect(r.chantiers).toHaveLength(0);
    expect(r.devis).toHaveLength(0);
    expect(r.parametres.employes).toHaveLength(0);
  });
});

// ── (B) Vrai compte + blob existant → préservé, pas d'injection démo ────────
describe('Fix #2-B — vrai compte + blob existant → préservé', () => {
  const CHANTIER_REEL = { id: 'c-reel-1', nom: 'Rénovation bureau Genève', journal: [] };
  const DEVIS_REEL = { id: 'd-reel-1', numero: 'D-2026-001', montantHT: 50000 };
  const CLIENT_REEL = { id: 'cl-reel-1', nom: 'Dupont SA' };
  const EMPLOYE_REEL = { id: 'emp-1', nom: 'Müller', tarifJour: 800 };
  const BLOB_EXISTANT = {
    chantiers: [CHANTIER_REEL],
    devis: [DEVIS_REEL],
    factures: [],
    clients: [CLIENT_REEL],
    parametres: { employes: [EMPLOYE_REEL], demoVersion: 5, tauxFraisGeneraux: 12 },
    pointages: [],
  };

  it('blob existant → chantier réel préservé', () => {
    const r = resolveDataFromBlob(BLOB_EXISTANT, false);
    expect(r.chantiers).toHaveLength(1);
    expect(r.chantiers[0].id).toBe('c-reel-1');
  });

  it('blob existant → aucune injection de chantiers démo', () => {
    const r = resolveDataFromBlob(BLOB_EXISTANT, false);
    const hasDemo = r.chantiers.some(c => donneesInitiales.chantiers.some(d => String(d.id) === String(c.id)));
    expect(hasDemo).toBe(false);
  });

  it("blob existant + demoVersion 0 (ancien) → toujours pas d'injection démo", () => {
    const blobAncien = { ...BLOB_EXISTANT, parametres: { ...BLOB_EXISTANT.parametres, demoVersion: 0 } };
    const r = resolveDataFromBlob(blobAncien, false);
    expect(r.chantiers).toHaveLength(1);
    expect(r.chantiers[0].id).toBe('c-reel-1');
  });

  it('blob existant → employé réel préservé', () => {
    const r = resolveDataFromBlob(BLOB_EXISTANT, false);
    expect(r.parametres.employes).toHaveLength(1);
    expect(r.parametres.employes[0].id).toBe('emp-1');
  });
});

// ── (C) Mode démo + blob vide → donneesInitiales injectés ───────────────────
describe('Fix #2-C — mode démo + blob vide → données démo présentes', () => {
  it('blob null isDemo=true → chantiers démo non vides', () => {
    const r = resolveDataFromBlob(null, true);
    expect(r.chantiers.length).toBeGreaterThan(0);
  });

  it('blob null isDemo=true → devis démo non vides', () => {
    const r = resolveDataFromBlob(null, true);
    expect(r.devis.length).toBeGreaterThan(0);
  });

  it('blob null isDemo=true → employés démo présents', () => {
    const r = resolveDataFromBlob(null, true);
    expect(r.parametres.employes.length).toBeGreaterThan(0);
  });
});

// ── (D) Mode démo + version périmée → rechargement ──────────────────────────
describe('Fix #2-D — mode démo + demoVersion périmée → rechargement donneesInitiales', () => {
  it('blob avec demoVersion=0 isDemo=true → rechargement donneesInitiales', () => {
    const blobPerime = {
      chantiers: [],
      devis: [],
      parametres: { demoVersion: 0 },
    };
    const r = resolveDataFromBlob(blobPerime, true);
    expect(r.chantiers.length).toBeGreaterThan(0);
    expect(r.parametres.demoVersion).toBeGreaterThan(0);
  });
});
