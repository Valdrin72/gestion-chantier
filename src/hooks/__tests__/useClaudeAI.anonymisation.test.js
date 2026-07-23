/**
 * Confidentialité — ANONYMISATION du panneau IA (garde-fou permanent).
 *
 * On intercepte le payload RÉELLEMENT envoyé (spy sur supabase.functions.invoke)
 * et on vérifie, pour CHAQUE action, que la chaîne JSON complète ne contient
 * AUCUN nom réel (chantier, client, employé, adresse, ville) — alors que les
 * montants, eux, sont bien présents. La réponse pseudonymisée est ré-identifiée.
 *
 * MORDANT : ce test échoue si on retire la pseudonymisation de useClaudeAI —
 * les vrais noms réapparaîtraient dans le payload intercepté.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Réponse IA volontairement pseudonymisée → prouve la ré-identification à l'affichage.
const REPONSE_PSEUDO = 'Le Chantier 1 (Client A), suivi par Employé 1, dépasse le budget de CHF 120000 (marge 18.5%).';
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: { texte: REPONSE_PSEUDO }, error: null })) } },
}));

import { supabase } from '../../lib/supabase';
import { useClaudeAI } from '../useClaudeAI';
import { AppProvider } from '../../context/AppContext';

// ── Données de démo avec des noms bien reconnaissables ───────────────────────
const CHANTIERS = [{ id: 'c1', nom: 'Villa Dupont', adresse: 'Chemin des Roses 12', ville: 'Cologny' }];
const CLIENTS = [{ id: 'cl1', prenom: 'Paul', nom: 'Meier', entreprise: 'Banque Pictet', adresse: 'Rue du Rhône 8', ville: 'Genève' }];
const EMPLOYES = [{ id: 'e1', nom: 'Jean Rochat' }];
const PARAMETRES = { parametres: { iaActivee: true }, employes: EMPLOYES };

const wrapper = ({ children }) => (
  <AppProvider value={{ parametres: PARAMETRES, chantiers: CHANTIERS, clients: CLIENTS }}>{children}</AppProvider>
);

// Noms réels qui ne doivent JAMAIS apparaître dans le payload sérialisé.
const NOMS_REELS = ['Villa Dupont', 'Banque Pictet', 'Paul Meier', 'Meier', 'Jean Rochat', 'Chemin des Roses', 'Rue du Rhône', 'Cologny', 'Genève'];

// Toutes les actions envoyant potentiellement des données.
const ACTIONS = [
  'analyser_chantier', 'analyse_portefeuille', 'comparer_devis', 'suggerer_devis',
  'chat_libre', 'chat_email', 'chat_pdf', 'resumer_memoire',
];

// Un payload qui truffe les noms réels partout : champs structurés ET textes libres.
const dataAvecNoms = () => ({
  nom: 'Villa Dupont',
  clientNom: 'Banque Pictet',
  employe: 'Jean Rochat',
  adresse: 'Chemin des Roses 12',
  ville: 'Cologny',
  ca: 120000, marge: 18.5, avancement: 42,           // chiffres → doivent rester
  contexte_cyna: 'Historique : Villa Dupont pour Banque Pictet, chef Jean Rochat à Cologny.',
  messages: [{ role: 'user', content: 'Le chantier Villa Dupont à Genève dépasse le budget, voir avec Banque Pictet.' }],
  pdfTexte: 'FACTURE — Banque Pictet — Villa Dupont — Rue du Rhône 8, Genève — CHF 120000',
});

describe('useClaudeAI — anonymisation du payload sortant', () => {
  beforeEach(() => { supabase.functions.invoke.mockClear(); });

  for (const action of ACTIONS) {
    it(`[${action}] le payload envoyé ne contient AUCUN nom réel, mais garde les montants`, async () => {
      const { result } = renderHook(() => useClaudeAI(), { wrapper });
      await act(async () => { await result.current.appeler(action, dataAvecNoms()); });

      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      const body = supabase.functions.invoke.mock.calls[0][1].body;
      const json = JSON.stringify(body);

      // MORDANT : aucun nom réel ne doit survivre dans ce qui part sur le réseau.
      for (const nom of NOMS_REELS) {
        expect(json, `« ${nom} » ne doit pas quitter l'app (action ${action})`).not.toContain(nom);
      }
      // Les étiquettes neutres sont bien là (on a remplacé, pas supprimé).
      expect(json).toContain('Chantier 1');
      expect(json).toContain('Client A');
      expect(json).toContain('Employé 1');
      // Les chiffres (non nominatifs) sont préservés → on n'a pas cassé l'analyse.
      expect(json).toContain('120000');
      expect(json).toContain('18.5');
    });
  }

  it('la réponse pseudonymisée est RÉ-IDENTIFIÉE avec les vrais noms pour l\'affichage', async () => {
    const { result } = renderHook(() => useClaudeAI(), { wrapper });
    let texte;
    await act(async () => { texte = await result.current.appeler('analyser_chantier', dataAvecNoms()); });
    // "Chantier 1"/"Client A"/"Employé 1" redeviennent les vrais noms côté utilisateur.
    expect(texte).toContain('Villa Dupont');
    expect(texte).toContain('Banque Pictet');
    expect(texte).toContain('Jean Rochat');
    expect(texte).not.toContain('Chantier 1');
    expect(texte).toContain('120000'); // les montants inchangés
  });
});
