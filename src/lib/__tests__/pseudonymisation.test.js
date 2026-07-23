/**
 * Module de pseudonymisation — tests unitaires du VRAI code exporté.
 */
import { describe, it, expect } from 'vitest';
import { construireCorrespondance, pseudonymiser, pseudonymiserTexte, reidentifier } from '../pseudonymisation';

const ENTITES = {
  chantiers: [
    { id: 'c1', nom: 'Villa Dupont', adresse: 'Chemin des Roses 12', ville: 'Cologny' },
    { id: 'c2', nom: 'Rénovation Rhône', ville: 'Genève' },
  ],
  clients: [{ id: 'cl1', prenom: 'Paul', nom: 'Meier', entreprise: 'Banque Pictet', ville: 'Genève' }],
  employes: [{ id: 'e1', nom: 'Jean Rochat' }, { id: 'e2', nom: 'Ana Costa' }],
};

describe('construireCorrespondance + pseudonymiser', () => {
  const corr = construireCorrespondance(ENTITES);

  it('remplace noms de chantier, client, employé, adresse, ville par des étiquettes neutres', () => {
    const p = pseudonymiserTexte('Villa Dupont (Banque Pictet) — Jean Rochat, Chemin des Roses 12, Cologny', corr);
    expect(p).not.toContain('Villa Dupont');
    expect(p).not.toContain('Banque Pictet');
    expect(p).not.toContain('Jean Rochat');
    expect(p).not.toContain('Chemin des Roses');
    expect(p).not.toContain('Cologny');
    expect(p).toContain('Chantier 1');
    expect(p).toContain('Client A');
    expect(p).toContain('Employé 1');
  });

  it('les montants, %, dates ne sont pas touchés', () => {
    const p = pseudonymiserTexte('CA 120000, marge 18.5%, début 2026-06-01, 8h/j', corr);
    expect(p).toBe('CA 120000, marge 18.5%, début 2026-06-01, 8h/j');
  });

  it('frontières de mots : un nom court ne mutile pas un mot plus long', () => {
    // 'Ana' (employé) ne doit PAS transformer 'Analyse' ni 'banane'.
    const p = pseudonymiserTexte('Analyse de la banane pour Ana Costa', corr);
    expect(p).toContain('Analyse');
    expect(p).toContain('banane');
    expect(p).not.toContain('Ana Costa');
  });

  it('pseudonymise en profondeur un objet (structuré + texte libre), garde les nombres', () => {
    const out = pseudonymiser({
      nom: 'Villa Dupont', ca: 120000, marge: 18.5,
      messages: [{ content: 'Le chantier Villa Dupont dépasse' }],
    }, corr);
    const json = JSON.stringify(out);
    expect(json).not.toContain('Villa Dupont');
    expect(json).toContain('Chantier 1');
    expect(json).toContain('120000');
    expect(json).toContain('18.5');
  });
});

describe('reidentifier', () => {
  const corr = construireCorrespondance(ENTITES);

  it('restaure les vrais noms depuis les pseudonymes', () => {
    expect(reidentifier('Chantier 1 suivi par Employé 1', corr)).toBe('Villa Dupont suivi par Jean Rochat');
  });

  it('ne confond pas « Chantier 1 » et « Chantier 10 » (frontière numérique)', () => {
    const many = construireCorrespondance({
      chantiers: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, nom: `NOM_${i}` })),
      clients: [], employes: [],
    });
    // 'Chantier 10' → 10e chantier ; 'Chantier 1' → 1er, sans corruption mutuelle.
    const r = reidentifier('Voir Chantier 10 puis Chantier 1', many);
    expect(r).toContain(many.versReel['Chantier 10']);
    expect(r).toContain(many.versReel['Chantier 1']);
    expect(r).not.toContain('Chantier 1'); // plus aucun pseudo résiduel
  });

  it('aller-retour : pseudonymiser puis reidentifier redonne le texte d\'origine', () => {
    const src = 'Villa Dupont (Banque Pictet) avec Jean Rochat';
    expect(reidentifier(pseudonymiserTexte(src, corr), corr)).toBe(src);
  });
});
