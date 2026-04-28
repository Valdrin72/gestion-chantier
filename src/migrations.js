// ============================================================
// CYNA — MIGRATION DOUCE v2
// S'exécute une seule fois au démarrage. Ne modifie jamais
// les données existantes, enrichit uniquement par ajout.
// ============================================================

const MIGRATION_KEY = 'cyna_migration_v2';

export function migrerDonnees() {
  try {
    if (localStorage.getItem(MIGRATION_KEY) === 'true') return;

    // ── Chantiers : ajouter devisId si absent ──
    const rawChantiers = localStorage.getItem('cyna_chantiers');
    if (rawChantiers) {
      const chantiers = JSON.parse(rawChantiers);
      if (Array.isArray(chantiers)) {
        const migrated = chantiers.map(c => ({ devisId: null, ...c }));
        localStorage.setItem('cyna_chantiers', JSON.stringify(migrated));
      }
    }

    // ── Devis : ajouter chantierId si absent ──
    const rawDevis = localStorage.getItem('cyna_devis');
    if (rawDevis) {
      const devis = JSON.parse(rawDevis);
      if (Array.isArray(devis)) {
        const migrated = devis.map(d => ({ chantierId: null, ...d }));
        localStorage.setItem('cyna_devis', JSON.stringify(migrated));
      }
    }

    // ── Paiements : ajouter factureId dans chaque paiement ──
    const rawPaiements = localStorage.getItem('cyna_paiements');
    if (rawPaiements) {
      const paiements = JSON.parse(rawPaiements);
      if (paiements && typeof paiements === 'object') {
        const migrated = {};
        for (const [chantierId, liste] of Object.entries(paiements)) {
          migrated[chantierId] = Array.isArray(liste)
            ? liste.map(p => ({ factureId: null, ...p }))
            : liste;
        }
        localStorage.setItem('cyna_paiements', JSON.stringify(migrated));
      }
    }

    // ── Factures : initialiser si absent ──
    if (!localStorage.getItem('cyna_factures')) {
      localStorage.setItem('cyna_factures', JSON.stringify([]));
    }

    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch (e) {
    // Non bloquant — l'application fonctionne même si la migration échoue
    console.warn('[CYNA] Migration v2 non critique :', e.message);
  }
}
