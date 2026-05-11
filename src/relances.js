/**
 * CYNA — Système de relances factures impayées
 *
 * Conforme au droit suisse :
 * - Rappel 1 (J+15) : ton aimable, présume bonne foi
 * - Rappel 2 (J+30) : ton ferme, annonce mise en demeure
 * - Mise en demeure (J+45) : CO art. 102, délai 20 jours, intérêts 5%
 *
 * Tout se passe DANS l'app — pas d'envoi automatique externe.
 * Le PDF/texte est généré pour impression ou copie manuelle.
 */

const JOURS_RAPPEL_1       = 15;
const JOURS_RAPPEL_2       = 30;
const JOURS_MISE_DEMEURE   = 45;
const JOURS_DELAI_DEMEURE  = 20; // CO art. 102

const NIVEAUX = {
  1: { label: 'Rappel 1',         couleur: '#f59e0b', delaiJours: JOURS_RAPPEL_1 },
  2: { label: 'Rappel 2',         couleur: '#ef4444', delaiJours: JOURS_RAPPEL_2 },
  3: { label: 'Mise en demeure',  couleur: '#991b1b', delaiJours: JOURS_MISE_DEMEURE },
};

function joursDepuis(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function montantRestant(facture) {
  const total = parseFloat(facture.montantTTC) || parseFloat(facture.montantHT) * 1.081 || 0;
  const paye  = (facture.paiementsHistorique || []).reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
  return Math.max(0, total - paye);
}

/**
 * Renvoie le prochain rappel à envoyer pour cette facture, ou null.
 * Niveau 1, 2 ou 3 selon le retard et les rappels déjà envoyés.
 */
export function prochainRappel(facture) {
  if (!facture || facture.statut === 'payee' || facture.statut === 'annulee') return null;
  if (!facture.dateEcheance) return null;
  if (montantRestant(facture) <= 0) return null;

  const retard = joursDepuis(facture.dateEcheance);
  const rappels = facture.rappels || [];
  const dernierNiveau = rappels.reduce((m, r) => Math.max(m, r.niveau || 0), 0);

  if (dernierNiveau >= 3) return null; // déjà tout fait
  if (retard >= JOURS_MISE_DEMEURE && dernierNiveau < 3) return { niveau: 3, joursRetard: retard };
  if (retard >= JOURS_RAPPEL_2     && dernierNiveau < 2) return { niveau: 2, joursRetard: retard };
  if (retard >= JOURS_RAPPEL_1     && dernierNiveau < 1) return { niveau: 1, joursRetard: retard };
  return null;
}

export function niveauInfo(niveau) {
  return NIVEAUX[niveau] || null;
}

/**
 * Génère le texte du rappel (modèle suisse).
 * `client` peut être null → placeholder "Madame, Monsieur".
 */
export function genererTexteRappel(niveau, facture, client, societe = {}) {
  const fmtCHF = (n) => (parseFloat(n) || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (s) => {
    if (!s) return '—';
    const [y, m, d] = String(s).split('-');
    return d && m && y ? `${d}.${m}.${y}` : s;
  };

  const montant     = fmtCHF(montantRestant(facture));
  const numero      = facture.numero || '—';
  const dateEmission = fmtDate(facture.dateEmission || facture.dateFacture || facture.creeLe);
  const dateEcheance = fmtDate(facture.dateEcheance);
  const joursRetard  = joursDepuis(facture.dateEcheance);
  const rappels      = facture.rappels || [];
  const dateRappel1  = fmtDate(rappels.find(r => r.niveau === 1)?.date);
  const dateRappel2  = fmtDate(rappels.find(r => r.niveau === 2)?.date);

  const dateLimite = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (niveau === 3 ? JOURS_DELAI_DEMEURE : 8));
    return fmtDate(d.toISOString().slice(0, 10));
  })();

  const dest = client?.entreprise || client?.nom || 'Madame, Monsieur';
  const adresse = [client?.adresse, client?.npa && client?.ville ? `${client.npa} ${client.ville}` : (client?.ville || '')]
    .filter(Boolean).join('\n');
  const societeNom = societe.nom || 'CYNA SÀRL';
  const societeAdresse = societe.adresse || '';
  const societeContact = [societe.email, societe.telephone].filter(Boolean).join(' · ');

  const entete = `${societeNom}\n${societeAdresse}\n${societeContact}\n\n${dest}\n${adresse}\n\nGenève, le ${fmtDate(new Date().toISOString().slice(0, 10))}\n`;

  if (niveau === 1) {
    return {
      objet: `Rappel de paiement — Facture ${numero}`,
      texte: `${entete}
Objet : Rappel de paiement — Facture ${numero}

Madame, Monsieur,

Nous nous permettons de vous rappeler que la facture ${numero} d'un montant de CHF ${montant}, émise le ${dateEmission} et venue à échéance le ${dateEcheance}, n'a pas encore été réglée à ce jour.

Si ce paiement vous a échappé, nous vous remercions de bien vouloir le régulariser dans les meilleurs délais.

Si vous avez déjà procédé au règlement, veuillez ne pas tenir compte du présent rappel.

Nous restons à votre disposition pour tout complément d'information.

Avec nos salutations distinguées,

${societeNom}`
    };
  }

  if (niveau === 2) {
    return {
      objet: `2e rappel — Facture ${numero} en souffrance`,
      texte: `${entete}
Objet : 2e rappel — Facture ${numero} en souffrance

Madame, Monsieur,

Malgré notre rappel du ${dateRappel1}, nous n'avons toujours pas reçu le règlement de la facture ${numero} d'un montant de CHF ${montant}, échue le ${dateEcheance}.

Nous vous prions de bien vouloir procéder au paiement sous huitaine, soit au plus tard le ${dateLimite}.

À défaut de paiement dans ce délai, nous nous verrons contraints de vous adresser une mise en demeure formelle conformément à l'article 102 du Code des Obligations suisse.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${societeNom}`
    };
  }

  // niveau 3 — mise en demeure formelle
  return {
    objet: `MISE EN DEMEURE — Facture ${numero}`,
    texte: `${entete}
Objet : MISE EN DEMEURE — Facture ${numero}
Recommandé avec accusé de réception

Madame, Monsieur,

Nous constatons qu'à ce jour, malgré nos deux rappels précédents (du ${dateRappel1} et du ${dateRappel2}), la facture ${numero} d'un montant de CHF ${montant}, échue le ${dateEcheance} (soit ${joursRetard} jours de retard), demeure impayée.

Par la présente, nous vous mettons formellement en demeure, conformément à l'article 102 du Code des Obligations suisse, de régler l'intégralité de la somme due dans un délai de ${JOURS_DELAI_DEMEURE} jours à compter de la date de la présente, soit jusqu'au ${dateLimite}.

À défaut de paiement intégral dans ce délai, nous nous réservons le droit, sans nouvel avis :
  • d'introduire une poursuite par voie de réquisition de poursuite auprès de l'Office des Poursuites compétent ;
  • de réclamer des intérêts moratoires au taux légal de 5% l'an à compter de la présente mise en demeure (CO art. 104) ;
  • de réclamer le remboursement des frais et dommages-intérêts liés au recouvrement.

Nous espérons que vous ferez le nécessaire pour éviter cette procédure et restons dans cette attente.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${societeNom}`
  };
}

/**
 * Ajoute un rappel à l'historique d'une facture (immutable).
 */
export function marquerRappelEnvoye(facture, niveau, methode = 'imprime') {
  const rappels = facture.rappels || [];
  const dejaEnvoye = rappels.some(r => r.niveau === niveau);
  if (dejaEnvoye) return facture;
  return {
    ...facture,
    rappels: [...rappels, {
      niveau,
      date: new Date().toISOString().slice(0, 10),
      methode,
    }],
  };
}

/**
 * Statistiques globales pour le dashboard.
 */
export function statsRelances(factures = []) {
  let aEnvoyer1 = 0, aEnvoyer2 = 0, miseEnDemeure = 0, montantTotal = 0;
  for (const f of factures) {
    const p = prochainRappel(f);
    if (!p) continue;
    montantTotal += montantRestant(f);
    if (p.niveau === 1) aEnvoyer1++;
    else if (p.niveau === 2) aEnvoyer2++;
    else if (p.niveau === 3) miseEnDemeure++;
  }
  return { aEnvoyer1, aEnvoyer2, miseEnDemeure, total: aEnvoyer1 + aEnvoyer2 + miseEnDemeure, montantTotal };
}
