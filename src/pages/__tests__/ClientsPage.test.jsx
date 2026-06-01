import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Clients from '../ClientsPage';
import { renderWithApp } from '../../test-utils/renderWithApp';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })) },
}));

// ── matchMedia polyfill (requis par useIsMobile) ─────────────────────────────
beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
  }
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const CLIENT_1 = { id: 1, nom: 'Dupont', prenom: 'Marc', entreprise: 'Dupont SA', type: 'Entreprise', telephone: '022 000 00 00', email: 'marc@dupont.ch', adresse: 'Rue de la Paix 1', ville: 'Genève', canton: 'GE', notes: '' };
const CLIENT_2 = { id: 2, nom: 'Martin', prenom: 'Julie', entreprise: 'Martin SARL', type: 'Particulier', telephone: '079 000 00 00', email: 'julie@martin.ch', adresse: 'Av. des Alpes 5', ville: 'Genève', canton: 'GE', notes: '' };
const CHANTIER_1 = { id: 100, clientId: 1, nom: 'Salle de bain Dupont', statut: 'En cours', numero: 'CH-2026-001', montantDevis: '5000', avancement: 50, typesTravaux: [], equipe: [], employes: [], journal: [], imprevus: [], avenants: [] };
const DEVIS_1 = { id: 200, clientId: 1, nom: 'Devis cuisine', statut: 'Signé', montantHT: '5000', numero: 'DEV-001' };
const FACTURE_1 = { id: 300, chantierId: 100, devisId: null, montantTTC: '5405', statut: 'envoyee', dateEcheance: '2025-01-01', montantPaye: '0' };
const POINTAGE_1 = { id: 'p1', date: '2026-05-01', employeId: 1, repartitions: [{ chantierId: 100, categorie: 'production', heures: 8 }] };

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── Helper ────────────────────────────────────────────────────────────────────
function renderClients(propsOver = {}, ctxOver = {}) {
  const props = {
    clients: [clone(CLIENT_1), clone(CLIENT_2)],
    setClients: vi.fn(),
    chantiers: [],
    setChantiers: vi.fn(),
    devis: [],
    setDevis: vi.fn(),
    factures: [],
    setFactures: vi.fn(),
    naviguer: vi.fn(),
    ...propsOver,
  };
  const ctx = {
    afficherNotif: vi.fn(),
    confirmer: vi.fn().mockResolvedValue(true),
    ...ctxOver,
  };
  const result = renderWithApp(<Clients {...props} />, ctx);
  return { ...result, props, ctx };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('ClientsPage', () => {

  // ── 1. Liste ─────────────────────────────────────────────────────────────────
  describe('Liste des clients', () => {
    it('affiche tous les clients avec nom + prénom', () => {
      renderClients();
      expect(screen.getByText('Marc Dupont')).toBeInTheDocument();
      expect(screen.getByText('Julie Martin')).toBeInTheDocument();
    });

    it('affiche le type de chaque client (badge)', () => {
      renderClients();
      expect(screen.getByText('Entreprise')).toBeInTheDocument();
      expect(screen.getByText('Particulier')).toBeInTheDocument();
    });

    it('affiche le KPI total clients correct', () => {
      renderClients();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('liste vide : aucune carte client, bouton Nouveau visible', () => {
      renderClients({ clients: [] });
      expect(screen.queryByText('Marc Dupont')).not.toBeInTheDocument();
      expect(screen.getByText(/Nouveau client/i)).toBeInTheDocument();
    });
  });

  // ── 2. Créer un client ────────────────────────────────────────────────────────
  describe('Créer un client', () => {
    it('ouvre le formulaire vide au clic sur Nouveau client', () => {
      renderClients();
      fireEvent.click(screen.getByText(/Nouveau client/i));
      // Le formulaire est ouvert quand "Créer le client" (bouton submit) est visible
      expect(screen.getByText(/Créer le client/i)).toBeInTheDocument();
    });

    it('appelle setClients avec les bons champs (id, nom, prenom, entreprise)', async () => {
      const setClients = vi.fn();
      renderClients({ clients: [], setClients });
      fireEvent.click(screen.getByText(/Nouveau client/i));

      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      // Champs : Prénom, Nom, Entreprise, Téléphone, Email, Adresse, Ville, Canton
      fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: 'Jean' } });
      fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Leblanc' } });
      fireEvent.change(screen.getByPlaceholderText('Dupont SA'), { target: { value: 'Leblanc SA' } });
      fireEvent.change(screen.getByPlaceholderText('022 000 00 00'), { target: { value: '022 111 22 33' } });
      fireEvent.change(screen.getByPlaceholderText('Genève'), { target: { value: 'Carouge' } });

      fireEvent.click(screen.getByText(/Créer le client/i));

      expect(setClients).toHaveBeenCalledTimes(1);
      const nouvellesListe = setClients.mock.calls[0][0];
      expect(nouvellesListe).toHaveLength(1);
      expect(nouvellesListe[0].prenom).toBe('Jean');
      expect(nouvellesListe[0].nom).toBe('Leblanc');
      expect(nouvellesListe[0].entreprise).toBe('Leblanc SA');
      expect(nouvellesListe[0].ville).toBe('Carouge');
      expect(typeof nouvellesListe[0].id).toBe('number'); // id auto-généré
    });

    it('type par défaut = Entreprise', async () => {
      const setClients = vi.fn();
      renderClients({ clients: [], setClients });
      fireEvent.click(screen.getByText(/Nouveau client/i));
      fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: 'A' } });
      fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'B' } });
      fireEvent.click(screen.getByText(/Créer le client/i));
      const c = setClients.mock.calls[0][0][0];
      expect(c.type).toBe('Entreprise');
    });
  });

  // ── 3. Éditer un client ───────────────────────────────────────────────────────
  describe('Éditer un client', () => {
    it('pré-remplit le formulaire avec les valeurs existantes', () => {
      renderClients();
      const btnsModifier = screen.getAllByTitle
        ? screen.getAllByText(/Modifier/i)
        : screen.getAllByText(/Modifier/i);
      fireEvent.click(btnsModifier[0]); // premier client = Marc Dupont
      expect(screen.getByDisplayValue('Marc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dupont SA')).toBeInTheDocument();
    });

    it('sauvegarder une édition conserve l\'id et applique les changements', () => {
      const setClients = vi.fn();
      renderClients({ setClients });
      fireEvent.click(screen.getAllByText(/Modifier/i)[0]);
      const prenomInput = screen.getByDisplayValue('Marc');
      fireEvent.change(prenomInput, { target: { value: 'Marco' } });
      fireEvent.click(screen.getByText(/Enregistrer les modifications/i));
      expect(setClients).toHaveBeenCalledTimes(1);
      const updated = setClients.mock.calls[0][0];
      const client1 = updated.find(c => c.id === 1);
      expect(client1).toBeTruthy();
      expect(client1.prenom).toBe('Marco');
      expect(client1.nom).toBe('Dupont'); // inchangé
    });

    it('une notification est affichée après modification', () => {
      const afficherNotif = vi.fn();
      renderClients({}, { afficherNotif });
      fireEvent.click(screen.getAllByText(/Modifier/i)[0]);
      fireEvent.click(screen.getByText(/Enregistrer les modifications/i));
      expect(afficherNotif).toHaveBeenCalledWith('Client mis à jour');
    });
  });

  // ── 4. Validation ─────────────────────────────────────────────────────────────
  describe('Validation des champs obligatoires', () => {
    it('nom vide → afficherNotif erreur, setClients non appelé', () => {
      const setClients = vi.fn();
      const afficherNotif = vi.fn();
      renderClients({ clients: [], setClients }, { afficherNotif });
      fireEvent.click(screen.getByText(/Nouveau client/i));
      // Remplit prénom mais pas nom
      fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: 'Jean' } });
      fireEvent.click(screen.getByText(/Créer le client/i));
      expect(setClients).not.toHaveBeenCalled();
      expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('obligatoires'), 'error');
    });

    it('prénom vide → afficherNotif erreur, setClients non appelé', () => {
      const setClients = vi.fn();
      const afficherNotif = vi.fn();
      renderClients({ clients: [], setClients }, { afficherNotif });
      fireEvent.click(screen.getByText(/Nouveau client/i));
      fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Leblanc' } });
      fireEvent.click(screen.getByText(/Créer le client/i));
      expect(setClients).not.toHaveBeenCalled();
      expect(afficherNotif).toHaveBeenCalledWith(expect.stringContaining('obligatoires'), 'error');
    });
  });

  // ── 5. Suppression client sans référence ──────────────────────────────────────
  describe('Suppression client sans référence', () => {
    it('confirmer → retire le client de la liste', async () => {
      const setClients = vi.fn();
      renderClients({ setClients });
      // Clique sur la corbeille du premier client (Marc Dupont)
      const corbeilles = document.querySelectorAll('[title="Supprimer ce client"]');
      fireEvent.click(corbeilles[0]);
      await waitFor(() => {
        expect(setClients).toHaveBeenCalledTimes(1);
      });
      const restants = setClients.mock.calls[0][0];
      expect(restants).toHaveLength(1);
      expect(restants.find(c => c.id === 1)).toBeFalsy(); // Dupont supprimé
      expect(restants.find(c => c.id === 2)).toBeTruthy(); // Martin conservé
    });

    it('refuser la confirmation → setClients non appelé', async () => {
      const setClients = vi.fn();
      renderClients({ setClients }, { confirmer: vi.fn().mockResolvedValue(false) });
      const corbeilles = document.querySelectorAll('[title="Supprimer ce client"]');
      fireEvent.click(corbeilles[0]);
      await waitFor(() => {}); // laisse la promesse se résoudre
      expect(setClients).not.toHaveBeenCalled();
    });
  });

  // ── 6. Suppression client RÉFÉRENCÉ — cascade complète ───────────────────────
  describe('Suppression client référencé', () => {
    it('supprime le client ET ses chantiers EN CASCADE', async () => {
      const setClients = vi.fn();
      const setChantiers = vi.fn();
      const setDevis = vi.fn();
      const setFactures = vi.fn();
      renderClients({
        setClients, setChantiers, setDevis, setFactures,
        chantiers: [clone(CHANTIER_1)],     // chantier du client 1
        devis: [clone(DEVIS_1)],             // devis du client 1
        factures: [clone(FACTURE_1)],        // facture liée au chantier 100
      });
      const corbeilles = document.querySelectorAll('[title="Supprimer ce client"]');
      fireEvent.click(corbeilles[0]);       // supprime client 1 (Marc Dupont)
      await waitFor(() => expect(setClients).toHaveBeenCalled());

      // Le client est supprimé
      const clientsRestants = setClients.mock.calls[0][0];
      expect(clientsRestants.find(c => c.id === 1)).toBeFalsy();

      // Les chantiers du client sont supprimés
      expect(setChantiers).toHaveBeenCalledTimes(1);
      const chantiersRestants = setChantiers.mock.calls[0][0];
      expect(chantiersRestants.find(ch => ch.id === 100)).toBeFalsy();

      // Les devis du client sont supprimés
      expect(setDevis).toHaveBeenCalledTimes(1);
      const devisRestants = setDevis.mock.calls[0][0];
      expect(devisRestants.find(d => d.id === 200)).toBeFalsy();

      // Les factures liées aux chantiers sont supprimées
      expect(setFactures).toHaveBeenCalledTimes(1);
      const facturesRestantes = setFactures.mock.calls[0][0];
      expect(facturesRestantes.find(f => f.id === 300)).toBeFalsy();
    });

    it('le message de confirmation mentionne le nombre de chantiers liés', async () => {
      const confirmer = vi.fn().mockResolvedValue(false);
      renderClients({
        chantiers: [clone(CHANTIER_1)],
        confirmer,
      }, { confirmer });
      const corbeilles = document.querySelectorAll('[title="Supprimer ce client"]');
      fireEvent.click(corbeilles[0]);
      await waitFor(() => expect(confirmer).toHaveBeenCalled());
      const msgConfirm = confirmer.mock.calls[0][0];
      expect(msgConfirm).toContain('1'); // 1 chantier mentionné
      expect(msgConfirm).toMatch(/chantier/i);
    });

    // 🐛 POINTAGES ORPHELINS après suppression d'un client avec chantiers
    it('🐛 suppression client avec chantiers → pointages qui référencent ces chantiers deviennent ORPHELINS', async () => {
      // La cascade supprime chantiers + devis + factures mais JAMAIS les pointages.
      // Les pointages dont repartitions[].chantierId = 100 pointent désormais vers
      // un chantier inexistant → perte silencieuse de la source de vérité heures/coûts.
      const setClients = vi.fn();
      const setChantiers = vi.fn();
      const setDevis = vi.fn();
      const setFactures = vi.fn();
      // Les pointages ne sont PAS passés à Clients (pas dans sa signature)
      // → impossible de les nettoyer ; ils restent en mémoire, orphelins.
      renderClients({
        setClients, setChantiers, setDevis, setFactures,
        chantiers: [clone(CHANTIER_1)],
        devis: [],
        factures: [],
      });
      const corbeilles = document.querySelectorAll('[title="Supprimer ce client"]');
      fireEvent.click(corbeilles[0]);
      await waitFor(() => expect(setClients).toHaveBeenCalled());

      // Le composant NE reçoit pas setPointages et ne peut donc pas nettoyer les pointages.
      // Un pointage { repartitions: [{ chantierId: 100 }] } reste en mémoire/Supabase
      // après que chantier 100 a été supprimé → orphelin silencieux.
      // NOTE : ce test documente que le composant ne gère pas les pointages orphelins.
      // FIX : soit passer setPointages à Clients + le nettoyer en cascade,
      //        soit bloquer la suppression si des pointages existent (Option 2 comme pour les chantiers).
    });
  });

  // ── 7. Navigation ─────────────────────────────────────────────────────────────
  describe('Navigation', () => {
    it('bouton Chantiers navigue vers la page chantiers filtrée par client', () => {
      const naviguer = vi.fn();
      renderClients({ naviguer });
      fireEvent.click(screen.getAllByText(/Chantiers/i)[1]); // premier card client
      expect(naviguer).toHaveBeenCalledWith('chantiers', { clientActif: CLIENT_1.id });
    });

    it('bouton Devis navigue vers la page devis filtrée par client', () => {
      const naviguer = vi.fn();
      renderClients({ naviguer });
      const devisBtn = screen.getAllByText(/Devis/i);
      fireEvent.click(devisBtn[0]);
      expect(naviguer).toHaveBeenCalledWith('devis', { clientActif: CLIENT_1.id });
    });
  });

  // ── 8. XSS sanitisation ───────────────────────────────────────────────────────
  describe('Sanitisation XSS', () => {
    it('les balises HTML (<tag>) sont retirées avant sauvegarde — protection injection PDF', () => {
      const setClients = vi.fn();
      renderClients({ clients: [], setClients });
      fireEvent.click(screen.getByText(/Nouveau client/i));
      fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: '<b>Jean</b>' } });
      fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Leblanc' } });
      fireEvent.click(screen.getByText(/Créer le client/i));
      const c = setClients.mock.calls[0][0][0];
      // sanitiser retire les <tag> → reste "Jean"
      expect(c.prenom).toBe('Jean');
      expect(c.prenom).not.toContain('<b>');
    });

    it('🐛 sanitiser retire les balises mais CONSERVE le texte interne — <script>alert(1)</script>Nom → alert(1)Nom (protection PDF seulement, pas XSS complet)', () => {
      const setClients = vi.fn();
      renderClients({ clients: [], setClients });
      fireEvent.click(screen.getByText(/Nouveau client/i));
      fireEvent.change(screen.getByPlaceholderText('Marc'), { target: { value: '<script>alert(1)</script>Jean' } });
      fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Leblanc' } });
      fireEvent.click(screen.getByText(/Créer le client/i));
      const c = setClients.mock.calls[0][0][0];
      // Les balises sont supprimées mais le contenu entre les tags reste
      expect(c.prenom).toBe('alert(1)Jean'); // ⚠️ "alert(1)" conservé — sanitiser ≠ XSS-safe complet
      expect(c.prenom).not.toContain('<script>');
    });
  });
});
