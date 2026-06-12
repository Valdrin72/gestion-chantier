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

  // ── 6. Suppression client RÉFÉRENCÉ — ARCHIVAGE (rien ne se détruit) ─────────
  describe('Client référencé → archivage (pas de suppression dure)', () => {
    const QArchiver = '[title="Archiver ce client (historique conservé)"]';
    const QSupprimer = '[title="Supprimer ce client"]';

    it('AVEC chantiers → bouton Archiver (pas Supprimer), clic → confirmer + setClients avec archive:true', async () => {
      const setClients = vi.fn();
      const confirmer = vi.fn().mockResolvedValue(true);
      renderClients(
        { setClients, chantiers: [clone(CHANTIER_1)] },
        { confirmer },
      );
      // Le client référencé n'expose PAS de bouton Supprimer dur, mais un bouton Archiver
      const archiver = document.querySelectorAll(QArchiver);
      const supprimer = document.querySelectorAll(QSupprimer);
      expect(archiver.length).toBe(1);          // Dupont (référencé)
      expect(supprimer.length).toBe(1);          // Martin (vierge)

      fireEvent.click(archiver[0]);
      await waitFor(() => expect(setClients).toHaveBeenCalled());
      expect(confirmer).toHaveBeenCalled();
      const after = setClients.mock.calls[0][0];
      const dupont = after.find(c => c.id === 1);
      expect(dupont.archive).toBe(true);
      expect(typeof dupont.dateArchivage).toBe('string');
      // Martin (vierge) reste intact, non archivé
      expect(after.find(c => c.id === 2).archive).toBeUndefined();
    });

    it('refuser la confirmation d\'archivage → setClients non appelé', async () => {
      const setClients = vi.fn();
      renderClients(
        { setClients, chantiers: [clone(CHANTIER_1)] },
        { confirmer: vi.fn().mockResolvedValue(false) },
      );
      fireEvent.click(document.querySelector(QArchiver));
      await waitFor(() => {});
      expect(setClients).not.toHaveBeenCalled();
    });

    it('AVEC devis (sans chantier) → bouton Archiver présent', () => {
      renderClients({ chantiers: [], devis: [clone(DEVIS_1)] }); // DEVIS_1.clientId === 1
      expect(document.querySelectorAll(QArchiver).length).toBe(1);
    });

    it('AVEC factures (via devis du client, sans chantier) → bouton Archiver présent', () => {
      const factureSurDevis = { id: 301, chantierId: null, devisId: 200, montantTTC: '1000', statut: 'envoyee', montantPaye: '0' };
      renderClients({ chantiers: [], devis: [clone(DEVIS_1)], factures: [factureSurDevis] });
      expect(document.querySelectorAll(QArchiver).length).toBe(1);
    });

    it('AVEC factures (via chantier du client) → bouton Archiver présent', () => {
      renderClients({ chantiers: [clone(CHANTIER_1)], factures: [clone(FACTURE_1)] });
      expect(document.querySelectorAll(QArchiver).length).toBe(1);
    });

    it('client 2 (Martin) sans aucun lien reste SUPPRIMABLE (dur) même si client 1 est référencé', async () => {
      const setClients = vi.fn();
      const confirmer = vi.fn().mockResolvedValue(true);
      renderClients(
        { setClients, chantiers: [clone(CHANTIER_1)] },
        { confirmer },
      );
      const supprimer = document.querySelectorAll(QSupprimer);
      expect(supprimer.length).toBe(1); // uniquement Martin (vierge)
      fireEvent.click(supprimer[0]);
      await waitFor(() => expect(setClients).toHaveBeenCalled());
      const restants = setClients.mock.calls[0][0];
      expect(restants.find(c => c.id === 2)).toBeFalsy(); // Martin supprimé (dur)
      expect(restants.find(c => c.id === 1)).toBeTruthy(); // Dupont conservé
    });
  });

  // ── 6b. Archivés : masqués de la liste active, toggle + restauration ─────────
  describe('Clients archivés — toggle + restauration', () => {
    it('un client archivé n\'apparaît pas dans la liste active', () => {
      renderClients({
        clients: [{ ...clone(CLIENT_1), archive: true, dateArchivage: '2026-06-01T00:00:00.000Z' }, clone(CLIENT_2)],
      });
      expect(screen.queryByText('Marc Dupont')).not.toBeInTheDocument(); // archivé → masqué
      expect(screen.getByText('Julie Martin')).toBeInTheDocument();
    });

    it('toggle "Voir les archivés" → la ligne grisée + bouton Restaurer apparaissent', () => {
      renderClients({
        clients: [{ ...clone(CLIENT_1), archive: true, dateArchivage: '2026-06-01T00:00:00.000Z' }, clone(CLIENT_2)],
      });
      fireEvent.click(screen.getByRole('button', { name: /Voir 1 client archivé/i }));
      expect(screen.getByText('Marc Dupont')).toBeInTheDocument(); // visible dans la section archivés
      expect(screen.getByText(/Archivé le 01\.06\.26/)).toBeInTheDocument();
    });

    it('Restaurer → setClients avec archive:false', async () => {
      const setClients = vi.fn();
      renderClients({
        clients: [{ ...clone(CLIENT_1), archive: true, dateArchivage: '2026-06-01T00:00:00.000Z' }, clone(CLIENT_2)],
        setClients,
      });
      fireEvent.click(screen.getByRole('button', { name: /Voir 1 client archivé/i }));
      fireEvent.click(screen.getByRole('button', { name: /Restaurer/i }));
      await waitFor(() => expect(setClients).toHaveBeenCalled());
      const after = setClients.mock.calls[0][0];
      expect(after.find(c => c.id === 1).archive).toBe(false);
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
