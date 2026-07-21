import { calculerEtatChantier } from '../../donnees.js';
import { calculerDSO } from '../../calculs/tresorerie.js';
import { CYNA_PARAMS } from '../../calculs/constants.js';

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

  // La config vit sous parametres.parametres (le top-level porte employes/localites/zones…).
  const cfg = parametres?.parametres ?? parametres ?? {};
  // I2 — FG au bon niveau (comme le moteur donnees.js). L'ancienne lecture top-level
  // `parametres.tauxFraisGeneraux` valait undefined → marge nette TOUJOURS à 12% dans les
  // alertes → l'alerte "marge danger/limite" était aveugle aux vrais FG (trop optimiste).
  const tauxFG = parseFloat(cfg.tauxFraisGeneraux ?? parametres?.tauxFraisGeneraux) || 12;
  const devisMap = new Map(devis.map(d => [String(d.id), d]));

  const chantiersAdaptes = chantiers.filter(c => c.archive !== true).map(c => {
    const devisLie = devisMap.get(String(c.devisId));
    let etat = null;
    try {
      // I2 — le moteur lit coefficientMainOeuvre depuis son 4e arg ; il vit sous cfg
      // (parametres.parametres), pas au top-level → passer cfg pour honorer le coefficient réel.
      etat = calculerEtatChantier(c, employesList, devis, cfg, rawPointages);
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
      // I2 — tauxMargeObjectif lu au bon niveau (n'alimente aujourd'hui aucune règle, mais lecture corrigée).
      marge_brute_prevue: ca > 0 && devisLie ? ca * (parseFloat(cfg.tauxMargeObjectif ?? parametres?.tauxMargeObjectif ?? 0.25)) : null,
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

  // ── Solde bancaire : SAISIE MANUELLE HORODATÉE uniquement (décision métier) ──────────────
  // L'app ne voit ni salaires, ni charges sociales, ni achats payés en direct → un solde
  // reconstruit serait faux et faussement rassurant. On n'utilise donc QUE la valeur saisie
  // par l'utilisateur, avec sa date. Jamais de calcul silencieux sur 0.
  const soldeSaisiRaw = cfg.soldeBancaire;
  const soldeSaisi = (soldeSaisiRaw === '' || soldeSaisiRaw == null || isNaN(parseFloat(soldeSaisiRaw)))
    ? null : parseFloat(soldeSaisiRaw);
  const soldeDate = safeDate(cfg.soldeBancaireDate);
  const soldeConfigure = soldeSaisi !== null && soldeDate !== null;
  const soldeAgeJours = soldeDate ? Math.floor((now.getTime() - soldeDate.getTime()) / 86400000) : null;
  const fraicheurMax = CYNA_PARAMS.TRESORERIE_FRAICHEUR_JOURS;
  const soldeFrais = soldeConfigure && soldeAgeJours !== null && soldeAgeJours <= fraicheurMax && soldeAgeJours >= 0;
  const seuilTreso = parseFloat(cfg.seuilTresorerie) || CYNA_PARAMS.TRESORERIE_SEUIL_ALERTE;

  // Encaissements ATTENDUS à 30j : soldes restant dus des factures émises/partiellement payées
  // dont l'échéance tombe dans les 30 prochains jours (argent réellement à venir).
  const horizon = now.getTime() + 30 * 86400000;
  const encaissementsAttendus30j = facturesAdaptees
    .filter(f => (f.statut === 'emise' || f.statut === 'partiellement_payee') && f.date_echeance.getTime() <= horizon)
    .reduce((s, f) => s + Math.max(0, f.total_ttc - f.total_paye), 0);
  const chargesConnues30j = 0; // non modélisé (salaires/charges/achats directs) — voir décision métier

  const soldeProjete30j = soldeConfigure
    ? soldeSaisi + encaissementsAttendus30j - chargesConnues30j
    : null;

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
      solde_configure: soldeConfigure,
      solde_frais: soldeFrais,
      solde_saisi: soldeConfigure ? soldeSaisi : null,
      solde_date: soldeDate,
      solde_age_jours: soldeAgeJours,
      fraicheur_max_jours: fraicheurMax,
      seuil_alerte: seuilTreso,
      encaissements_attendus_30j: encaissementsAttendus30j,
      charges_connues_30j: chargesConnues30j,
      solde_projete_30j: soldeProjete30j,
      dso_actuel: dsoActuel,
    },
  };
}
