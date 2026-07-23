/**
 * Confidentialité — interrupteur maître de l'Assistant IA.
 * PREUVE : tant que iaActivee n'est pas true, AUCUN appel réseau ne part,
 * quelle que soit l'action. On teste le VRAI hook useClaudeAI (pas un mirror),
 * avec supabase mocké pour espionner functions.invoke.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock supabase AVANT import du hook (évite aussi le throw "env manquantes" du vrai module).
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: { texte: 'ok' }, error: null })) } },
}));

import { supabase } from '../../lib/supabase';
import { useClaudeAI } from '../useClaudeAI';
import { AppProvider } from '../../context/AppContext';

const wrapper = (parametres) => ({ children }) => (
  <AppProvider value={{ parametres }}>{children}</AppProvider>
);

// Toutes les actions déclenchables depuis le panneau IA.
const ACTIONS = [
  'chat_libre', 'analyser_chantier', 'suggerer_devis', 'expliquer_alertes',
  'analyse_portefeuille', 'anticiper', 'chat_email', 'comparer_devis',
  'chat_pdf', 'resumer_memoire',
];

describe('useClaudeAI — kill-switch confidentialité', () => {
  beforeEach(() => { supabase.functions.invoke.mockClear(); });

  it('OFF (défaut) → AUCUN appel réseau, pour AUCUNE action', async () => {
    const { result } = renderHook(() => useClaudeAI(), { wrapper: wrapper({ parametres: { iaActivee: false } }) });
    for (const action of ACTIONS) {
      let ret;
      await act(async () => { ret = await result.current.appeler(action, { contexte_cyna: 'x', montant: 1000 }); });
      expect(ret).toBeNull(); // court-circuité
    }
    expect(supabase.functions.invoke).not.toHaveBeenCalled(); // MORDANT : zéro appel
  });

  it('paramètre absent → ON par défaut (l\'appel part) — le kill-switch n\'agit que si explicitement false', async () => {
    const { result } = renderHook(() => useClaudeAI(), { wrapper: wrapper({}) });
    await act(async () => { await result.current.appeler('anticiper', {}); });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('iaActivee=true → l\'appel part (invoke appelé une fois)', async () => {
    const { result } = renderHook(() => useClaudeAI(), { wrapper: wrapper({ parametres: { iaActivee: true } }) });
    await act(async () => { await result.current.appeler('anticiper', { horizon: 30 }); });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('claude-ia', expect.objectContaining({
      body: expect.objectContaining({ action: 'anticiper' }),
    }));
  });

  it('ON → la mémoire envoyée est PLAFONNÉE à 8000 caractères (plafond strict)', async () => {
    const { result } = renderHook(() => useClaudeAI(), { wrapper: wrapper({ parametres: { iaActivee: true } }) });
    const longue = 'A'.repeat(12000);
    await act(async () => { await result.current.appeler('chat_libre', { contexte_cyna: longue }); });
    const body = supabase.functions.invoke.mock.calls[0][1].body;
    expect(body.data.contexte_cyna.length).toBe(8000); // tronqué, pas 12000
  });
});
