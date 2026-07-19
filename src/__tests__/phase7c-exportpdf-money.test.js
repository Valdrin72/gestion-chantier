/**
 * Phase 7c — PREUVE que le PDF client (fiche chantier) reçoit le vrai coût MO.
 * On capture les lignes autoTable et on vérifie que la ligne "Main d'œuvre" (colonne
 * RÉEL) est NON NULLE quand on passe les pointages — et retombe à "CHF 0" sans eux (mordant).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks jsPDF + jspdf-autotable (repris du mock éprouvé d'ExportPDF.test.js).
vi.mock('jspdf', () => {
  const instances = [];
  class FakeJsPDF {
    constructor() {
      this.texts = []; this.savedAs = null; this.lastAutoTable = { finalY: 60 };
      this.internal = { getNumberOfPages: () => 1, pageSize: { height: 297 } };
      instances.push(this);
    }
    text(t) { (Array.isArray(t) ? t : [t]).forEach(s => this.texts.push(String(s))); }
    save(name) { this.savedAs = name; }
    splitTextToSize(t) { return Array.isArray(t) ? t : [String(t)]; }
    addPage() {} setPage() {} addImage() {} rect() {} line() {}
    setFillColor() {} setDrawColor() {} setLineWidth() {} setLineDashPattern() {}
    setFont() {} setFontSize() {} setTextColor() {}
  }
  return { default: FakeJsPDF, __instances: instances };
});
vi.mock('jspdf-autotable', () => {
  const __tables = [];
  return { default: (doc, opts) => { __tables.push(opts); doc.lastAutoTable = { finalY: (opts.startY || 0) + 20 }; }, __tables };
});

const autoTableMock = await import('jspdf-autotable');
const { migrerJournalVersPointages } = await import('../migration/migrerJournalVersPointages');
const { exportFicheChantier } = await import('../ExportPDF.js');

beforeEach(() => {
  autoTableMock.__tables.length = 0;
  // jsdom ne charge pas d'image → stub Image pour déclencher onerror immédiatement
  // (chargerLogo résout null, ajouterEntete ne hang pas).
  vi.stubGlobal('Image', class {
    set src(_) { queueMicrotask(() => this.onerror && this.onerror()); }
  });
});

const EMP = { id: 1, nom: 'Müller', tarifJour: 400, tarifDejaCharge: true, actif: true };
const CHANTIER = {
  id: 'CH1', nom: 'Chantier Preuve', statut: 'en cours', nombreJours: 23,
  devisId: 'd1', clientId: 'cl1', ville: 'Genève', equipe: [{ employeId: 1, joursPlannifies: 23 }],
  dateDebut: '2026-03-02',
  journal: [
    { date: '2026-03-02', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-03-03', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-03-04', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-03-05', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
    { date: '2026-03-06', employes: [{ employeId: 1, heuresTravaillees: 8 }] },
  ],
};
const CLIENTS = [{ id: 'cl1', nom: 'Client', type: 'prive' }];
const PARAMS = { employes: [EMP], localites: [{ nom: 'Genève', tarifJour: 60 }], parametres: { coefficientMainOeuvre: 1.0, tauxFraisGeneraux: 12 } };
const DEVIS = [{ id: 'd1', montantHT: 80_000, statut: 'Accepté', clientId: 'cl1' }];
const POINTAGES = migrerJournalVersPointages([CHANTIER], [EMP]);

// Trouve la cellule RÉEL (index 2) de la ligne "Main d'œuvre" dans les tableaux capturés.
function moReel() {
  for (const t of autoTableMock.__tables) {
    for (const row of (t.body || [])) {
      if (Array.isArray(row) && String(row[0]).includes("Main d'œuvre")) return String(row[2]);
    }
  }
  return null;
}

describe('Phase 7c — ExportPDF fiche chantier : coût MO réel dans le document', () => {
  it('AVEC pointages → ligne "Main d\'œuvre" RÉEL non nulle (5j×400 = 2 000)', async () => {
    await exportFicheChantier(CHANTIER, CLIENTS, PARAMS, DEVIS, POINTAGES);
    const cell = moReel();
    expect(cell).toBeTruthy();
    expect(cell).not.toBe('CHF 0');
    expect(cell).toMatch(/2[  ,]?000/); // 2000 formaté (séparateur de milliers selon locale)
  });

  it('🔴 MORDANT : SANS pointages → "Main d\'œuvre" RÉEL = CHF 0 (l\'ancien bug, document client faux)', async () => {
    await exportFicheChantier(CHANTIER, CLIENTS, PARAMS, DEVIS, []);
    expect(moReel()).toBe('CHF 0');
  });
});
