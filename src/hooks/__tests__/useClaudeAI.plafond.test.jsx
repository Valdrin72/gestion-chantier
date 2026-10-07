import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { supabase } from '../../lib/supabase';
import { useClaudeAI } from '../useClaudeAI';
import { AppProvider } from '../../context/AppContext';
import ClaudeIAPanel from '../../components/ia/ClaudeIAPanel';
import AideDevisPanel from '../../components/devis/AideDevisPanel';
const limite = "Limite d'utilisation de l'assistant atteinte pour aujourd'hui, réessayez demain.";
const generic = "L'assistant est momentanément indisponible. Réessayez plus tard.";
const value = { parametres: { parametres: { iaConsentement: true }, employes: [] }, chantiers: [{ id: 1, nom: "Test", statut: "En cours" }], clients: [], devis: [], factures: [], pointages: [], agentState: { alertes: [] } };
const wrapper = ({ children }) => <AppProvider value={value}>{children}</AppProvider>;
function refusal(status, body) { supabase.functions.invoke.mockResolvedValue({ error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => { if (body === null) throw new SyntaxError('bad JSON'); return body; } } } }); }
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); cleanup(); localStorage.clear(); vi.clearAllMocks(); });
describe('plafond HTTP', () => {
  it.each([[429, { error: limite }, limite, true], [429, null, limite, true], [500, { error: 'Erreur sûre 500' }, 'Erreur sûre 500', false], [502, { error: 'Erreur sûre 502' }, 'Erreur sûre 502', false], [500, null, generic, false], [502, null, generic, false]])('%s %j', async (status, body, message, flag) => {
    refusal(status, body);
    const { result } = renderHook(useClaudeAI, { wrapper });
    let ret; await act(async () => { ret = await result.current.appeler('anticiper', {}); });
    expect(ret).toBeNull(); expect(result.current.error).toBe(message);
    expect(result.current.limiteAtteinte).toBe(flag); expect(result.current.error).not.toContain('non-2xx');
  });
  it('ClaudeIAPanel affiche le 429 et reste utilisable', async () => {
    refusal(429, { error: limite }); render(<ClaudeIAPanel />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Anticiper à J/ }));
    expect(await screen.findByText(limite)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anticiper à J/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Suggestion de devis/ }));
    expect(screen.getByPlaceholderText(/Pose de faux-plafond/)).toBeEnabled();
  });
  it('AideDevisPanel affiche le plafond', async () => {
    refusal(429, { error: limite }); render(<AideDevisPanel typesSelectionnes={['Peinture']} />, { wrapper });
    fireEvent.click(screen.getByTestId('aide-marche-bouton'));
    expect(await screen.findByText(limite)).toBeInTheDocument();
  });
  it('mémoire inchangée après condensation refusée', async () => {
    const memoire = '[01.10.2026] A\n[02.10.2026] B\n[03.10.2026] C\n[04.10.2026] D';
    localStorage.setItem('cyna_ia_memoire', memoire); refusal(429, { error: limite });
    render(<ClaudeIAPanel />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Chat libre/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mémoire CYNA/ }));
    fireEvent.click(screen.getByRole('button', { name: /Condenser avec Claude/ }));
    expect(await screen.findByText(limite)).toBeInTheDocument();
    expect(screen.getAllByRole('textbox').some(el => el.value === memoire)).toBe(true);
    expect(localStorage.getItem('cyna_ia_memoire')).toBe(memoire);
  });
});
it('serveur : réservation unique avant chacun des cinq appels, erreurs sûres', () => {
  const source = readFileSync('supabase/functions/claude-ia/index.ts', 'utf8');
  expect(source.match(/api\.anthropic\.com/g)).toHaveLength(1);
  expect(source.match(/await appelerAnthropic\(token,/g)).toHaveLength(5);
  expect(source).not.toMatch(/error: err\.message|throw new Error\(`Anthropic/);
  const helper = source.slice(source.indexOf('async function appelerAnthropic'), source.indexOf('function isAllowedOrigin'));
  expect(helper.indexOf('rpc/ia_reserver_appel')).toBeGreaterThan(-1);
  expect(helper.indexOf('rpc/ia_reserver_appel')).toBeLessThan(helper.indexOf('https://api.anthropic.com'));
});
