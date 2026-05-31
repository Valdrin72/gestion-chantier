import { calculerEtatChantier } from '../../donnees.js';
import { calculerDSO } from '../../calculs/tresorerie.js';

const STATUT_CHANTIER_MAP = {
  'en cours':    'actif',
  'planifié':    'actif',
  'planifie':    'actif',
  'terminé':     'cloture',
  'termine':     'cloture',
  'clôturé':     'cloture',
  'cloture':     'cloture',
  'facturé':     'cloture',
  'facture':     'cloture',
  'suspendu':    'en_pause',
  'réception':   'reception',
  'reception':   'reception',
};

const STATUT_FACTURE_MAP = {
  'émise':                'emise',
  'emise':                'emise',
  'payée':                'payee',
  'payee':                'payee',
  'partiellement payée':  'partiellement_payee',
  'partiellement payee':  'partiellement_payee',
  'annulée':              'annulee',
  'annulee':              'annulee',
  'brouillon':            'brouillon',
};

const STATUT_DEVIS_MAP = {
  'envoyé':   'envoye',
  'envoye':   'envoye',
  'accepté':  'accepte',
  'accepte':  'accepte',
  'refusé':   'refuse',
  'refuse':   'refuse',
  'expiré':   'expire',
  'expire':   'expire',
  'brouillon':'brouillon',
};

function mapStatut(val, map) {
  return map[(val ?? '').trim().toLowerCase()] ?? 'actif';
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const CATS_TRAVAIL = new Set(['production', 'atelier']);

export function adapterContexteAlertes({ chantiers = [], devis = [], factures = [], clients = [], parametres = {}, pointages: rawPointages = [] }) {
  const now = new Date();
  const employesList = Array.isArray(parametres?.employes) ? parametres.employes : [];

  const tauxFG = parseFloat(parametres?.tauxFraisGeneraux) || 12;
  const devisMap = new Map(devis.map(d => [String(d.id), d]));

  const chantiersAdaptes = chantiers.map(c => {
    const devisLie = devisMap.get(String(c.devisId));
    let etat = null;
    try {
      etat = calculerEtatChantier(c, employesList, devis, parametres, rawPointages);
    } catch { /* skip */ }

    const ca = parseFloat(etat?.devisTotal ?? devisLie?.montantHT ?? 0) || 0;
    const couts = parseFloat(etat?.coutTotalReel) || 0;
    const avancement = parseFloat(etat?.avancementPct ?? c.avancement) || 0;

    // Calcul du % temps écoulé
    let pctTemps = null;
    const dateDebut = safeDate(c.dateDebut);
    const dateFin = safeDate(etat?.dateFin ?? null);
    if (dateDebut && dateFin && dateFin > dateDebut) {
      const total = dateFin.getTime() - dateDebut.getTime();
      const ecoule = Math.min(now.getTime() - dateDebut.getTime(), total);
      pctTemps = total > 0 ? Math.max(0, Math.min(100, (ecoule / total) * 100)) : 0;
    }

    return {
      id: String(c.id),
      nom: c.nom || c.numero || `Chantier ${c.id}`,
      client_id: String(c.clientId || ''),
      statut: mapStatut(c.statut, STATUT_CHANTIER_MAP),
      budget_total: ca,
      date_debut: dateDebut ?? now,
      date_fin_prevue: dateFin ?? new Date(now.getTime() + 30 * 86400000),
      date_reception: safeDate(c.dateReception),
      pourcent_temps_ecoule: pctTemps,
      pourcent_travaux_realises: avancement,
      couts_engages: couts,
      marge_brute_prevue: ca > 0 && devisLie ? ca * (parseFloat(parametres?.tauxMargeObjectif ?? 0.25)) : null,
      marge_brute_actuelle: ca > 0 ? ca - couts : null,
      marge_nette_actuelle: ca > 0 ? (ca - couts) - ca * (tauxFG / 100) : null,
    };
  });

  const facturesAdaptees = factures.map(f => ({
    id: String(f.id),
    numero: f.numero || `F-${f.id}`,
    client_id: String(f.clientId || ''),
    chantier_id: f.chantierId ? String(f.chantierId) : undefined,
    statut: mapStatut(f.statut, STATUT_FACTURE_MAP),
    total_ttc: parseFloat(f.montantTTC) || 0,
    total_paye: parseFloat(f.montantPaye) || 0,
    date_emission: safeDate(f.dateEmission) ?? now,
    date_echeance: safeDate(f.dateEcheance) ?? new Date(now.getTime() + 30 * 86400000),
    dernier_travail_chantier: safeDate(f.dernierTravailChantier),
  }));

  const devisAdaptes = devis.map(d => ({
    id: String(d.id),
    numero: d.numero || `D-${d.id}`,
    client_id: String(d.clientId || ''),
    statut: mapStatut(d.statut, STATUT_DEVIS_MAP),
    total_ht: parseFloat(d.montantHT) || 0,
    date_emission: safeDate(d.dateEmission) ?? now,
    date_validite: safeDate(d.dateValidite) ?? new Date(now.getTime() + 30 * 86400000),
    derniere_relance: safeDate(d.derniereRelance),
  }));

  // Employes normalisés pour les règles RH
  const employesAdaptes = employesList.map(e => ({
    id: String(e.id),
    prenom: e.prenom || '',
    nom: e.nom || '',
    poste: e.poste || '',
    tarifJour: parseFloat(e.tarifJour) || 0,
  }));

  // Pointages depuis les vrais pointages[] — heures_sup correct par employé/jour
  // (multi-chantier : un pointage = toutes les répartitions d'un employé ce jour-là)
  const pointages = rawPointages.map(p => {
    const heuresJour = (p.repartitions || [])
      .filter(r => CATS_TRAVAIL.has(r.categorie))
      .reduce((s, r) => s + (parseFloat(r.heures) || 0), 0);
    return {
      employe_id: String(p.employeId),
      date: p.date,
      heures: heuresJour,
      heures_sup: Math.max(0, heuresJour - 8),
    };
  }).filter(p => p.heures > 0);

  // Calcul DSO réel
  const facturesEmises = facturesAdaptees.filter(f => f.statut === 'emise' || f.statut === 'partiellement_payee');
  const totalCreances = facturesEmises.reduce((s, f) => s + (f.total_ttc - f.total_paye), 0);
  const caTotal = devisAdaptes.filter(d => d.statut === 'accepte').reduce((s, d) => s + d.total_ht, 0);
  const dsoActuel = calculerDSO(totalCreances, caTotal, 30);

  const facturespayees30j = facturesAdaptees.filter(f => {
    if (f.statut !== 'payee') return false;
    const recente = (now.getTime() - f.date_emission.getTime()) < 30 * 86400000;
    return recente;
  });
  const encaissements30j = facturespayees30j.reduce((s, f) => s + f.total_ttc, 0);
  const decaissements30j = 0; // pas encore modélisé dans l'app
  const soldeActuel = parseFloat(parametres?.soldeActuel ?? 0) || 0;

  return {
    now,
    chantiers: chantiersAdaptes,
    devis: devisAdaptes,
    factures: facturesAdaptees,
    employes: employesAdaptes,
    pointages,
    clients: clients.map(cl => ({ id: String(cl.id), raison_sociale: cl.nom || cl.raisonSociale || '', type: cl.type ?? 'prive' })),
    photos: [],
    pvs: [],
    audit: [],
    treso: {
      solde_actuel: soldeActuel,
      encaissements_prevus_30j: encaissements30j,
      decaissements_prevus_30j: decaissements30j,
      solde_projete_30j: soldeActuel + encaissements30j - decaissements30j,
      dso_actuel: dsoActuel,
    },
  };
}
