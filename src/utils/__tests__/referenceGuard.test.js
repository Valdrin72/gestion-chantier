import { describe, it, expect } from 'vitest';
import {
  chantierEstReferencé,
  clientEstReferencé,
  devisEstReferencé,
  employeEstReferencé,
} from '../referenceGuard';

// ── chantierEstReferencé ────────────────────────────────────────────────────

describe('chantierEstReferencé', () => {
  const ch = { id: 'CH-1' };

  it('retourne null si aucune facture ni pointage', () => {
    expect(chantierEstReferencé(ch, { factures: [], pointages: [] })).toBeNull();
  });

  it('retourne null avec données vides par défaut', () => {
    expect(chantierEstReferencé(ch)).toBeNull();
  });

  it('bloque si une facture lie ce chantier', () => {
    const factures = [{ id: 'F-1', chantierId: 'CH-1' }];
    expect(chantierEstReferencé(ch, { factures })).toMatch(/ne peut pas être supprimé/);
  });

  it('bloque si un pointage a une répartition sur ce chantier', () => {
    const pointages = [{ id: 'P-1', repartitions: [{ chantierId: 'CH-1', heures: 8 }] }];
    expect(chantierEstReferencé(ch, { pointages })).toMatch(/heures pointées/);
  });

  it('tolère la coercion de type string/number sur les IDs', () => {
    const ch2 = { id: 1 };
    const factures = [{ id: 'F-1', chantierId: '1' }];
    expect(chantierEstReferencé(ch2, { factures })).not.toBeNull();
  });

  it('ne bloque pas si les factures et pointages appartiennent à un autre chantier', () => {
    const factures = [{ id: 'F-1', chantierId: 'CH-99' }];
    const pointages = [{ id: 'P-1', repartitions: [{ chantierId: 'CH-99', heures: 8 }] }];
    expect(chantierEstReferencé(ch, { factures, pointages })).toBeNull();
  });
});

// ── clientEstReferencé ─────────────────────────────────────────────────────

describe('clientEstReferencé', () => {
  const cl = { id: 'CL-1' };

  it('retourne null si client vierge', () => {
    expect(clientEstReferencé(cl)).toBeNull();
  });

  it('bloque si ce client a des chantiers', () => {
    const chantiers = [{ id: 'CH-1', clientId: 'CL-1' }];
    expect(clientEstReferencé(cl, { chantiers })).toMatch(/ne peut pas être supprimé/);
  });

  it('bloque si ce client a des devis', () => {
    const devis = [{ id: 'D-1', clientId: 'CL-1' }];
    expect(clientEstReferencé(cl, { devis })).not.toBeNull();
  });

  it('bloque si ce client a des factures via chantier', () => {
    const chantiers = [{ id: 'CH-1', clientId: 'CL-1' }];
    const factures = [{ id: 'F-1', chantierId: 'CH-1' }];
    expect(clientEstReferencé(cl, { chantiers, factures })).not.toBeNull();
  });

  it('bloque si ce client a des factures via devis', () => {
    const devis = [{ id: 'D-1', clientId: 'CL-1' }];
    const factures = [{ id: 'F-1', devisId: 'D-1' }];
    expect(clientEstReferencé(cl, { devis, factures })).not.toBeNull();
  });

  it('ne bloque pas pour les entités d\'un autre client', () => {
    const chantiers = [{ id: 'CH-99', clientId: 'CL-99' }];
    expect(clientEstReferencé(cl, { chantiers })).toBeNull();
  });
});

// ── devisEstReferencé ──────────────────────────────────────────────────────

describe('devisEstReferencé', () => {
  const dv = { id: 'D-1', numero: 'DV-001' };

  it('retourne null si devis vierge', () => {
    expect(devisEstReferencé(dv)).toBeNull();
  });

  it('bloque si un chantier est lié à ce devis', () => {
    const chantiers = [{ id: 'CH-1', devisId: 'D-1' }];
    expect(devisEstReferencé(dv, { chantiers })).toMatch(/ne peut pas être supprimé/);
  });

  it('bloque si une facture est directement liée au devis', () => {
    const factures = [{ id: 'F-1', devisId: 'D-1' }];
    expect(devisEstReferencé(dv, { factures })).not.toBeNull();
  });

  it('bloque si une facture est liée via chantier lié', () => {
    const chantiers = [{ id: 'CH-1', devisId: 'D-1' }];
    const factures = [{ id: 'F-1', chantierId: 'CH-1' }];
    expect(devisEstReferencé(dv, { chantiers, factures })).not.toBeNull();
  });

  it('message mentionne le nombre de chantiers et factures', () => {
    const chantiers = [{ id: 'CH-1', devisId: 'D-1' }, { id: 'CH-2', devisId: 'D-1' }];
    const msg = devisEstReferencé(dv, { chantiers });
    expect(msg).toMatch(/2 chantier/);
  });

  it('ne bloque pas pour les entités liées à un autre devis', () => {
    const chantiers = [{ id: 'CH-99', devisId: 'D-99' }];
    expect(devisEstReferencé(dv, { chantiers })).toBeNull();
  });
});

// ── employeEstReferencé ────────────────────────────────────────────────────

describe('employeEstReferencé', () => {
  const emp = { id: 'EMP-1' };

  it('retourne null si aucun pointage', () => {
    expect(employeEstReferencé(emp)).toBeNull();
  });

  it('bloque si un pointage a une répartition pour cet employé', () => {
    const pointages = [{ id: 'P-1', repartitions: [{ employeId: 'EMP-1', heures: 8 }] }];
    expect(employeEstReferencé(emp, { pointages })).toMatch(/ne peut pas être supprimé/);
  });

  it('bloque si le champ employeId du pointage matche (ancienne structure)', () => {
    const pointages = [{ id: 'P-1', employeId: 'EMP-1', repartitions: [] }];
    expect(employeEstReferencé(emp, { pointages })).not.toBeNull();
  });

  it('ne bloque pas pour les pointages d\'un autre employé', () => {
    const pointages = [{ id: 'P-1', repartitions: [{ employeId: 'EMP-99', heures: 8 }] }];
    expect(employeEstReferencé(emp, { pointages })).toBeNull();
  });
});
