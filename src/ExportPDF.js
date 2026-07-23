import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculerDateFinOuvrables, calculerCoutsChantier, calculerCA, heuresEmploye, tauxDocumentFige } from './donnees';

// ===== COORDONNÉES CYNA =====
const CYNA = {
  nom: 'CYNA Sàrl',
  adresse: 'Cardinal-Journet 5',
  codePostal: '1217 Meyrin',
  ville: 'Genève',
  tel1: '078 747 14 48',
  tel2: '079 480 94 41',
  tel3: '078 748 90 29',
  email: 'info@cyna.ch',
  nTVA: 'CHE-xxx.xxx.xxx TVA',
  iban: 'CH00 0000 0000 0000 0000 0',
};

// ===== COORDONNÉES CYNA (dynamiques depuis paramètres) =====
const getCYNA = (parametres) => ({
  nom:        parametres?.parametres?.nomSociete  || 'CYNA Sàrl',
  adresse:    parametres?.parametres?.adresseSoc  || 'Cardinal-Journet 5',
  codePostal: parametres?.parametres?.cpSoc       || '1217 Meyrin',
  tel1:       parametres?.parametres?.tel1Soc     || '078 747 14 48',
  tel2:       parametres?.parametres?.tel2Soc     || '079 480 94 41',
  email:      parametres?.parametres?.emailSoc    || 'info@cyna.ch',
  nTVA:       parametres?.parametres?.nTVA        || 'CHE-xxx.xxx.xxx TVA',
});

// ===== CONDITIONS GÉNÉRALES =====
const CONDITIONS = `CONDITIONS GÉNÉRALES — CYNA Sàrl

1. VALIDITÉ DU DEVIS : Le présent devis est valable 30 jours dès sa date d'émission. Passé ce délai, CYNA Sàrl se réserve le droit de le réviser.

2. PAIEMENT : Acompte de 30% à la commande. Solde à réception des travaux, net à 30 jours. Tout retard de paiement entraîne des intérêts moratoires de 5% l'an.

3. TRAVAUX SUPPLÉMENTAIRES : Tout travail non prévu au présent devis fera l'objet d'un avenant chiffré et accepté avant exécution.

4. DÉLAIS : Les délais indiqués sont donnés à titre indicatif. CYNA Sàrl ne peut être tenu responsable des retards dus à des causes indépendantes de sa volonté.

5. GARANTIE : Les travaux sont garantis conformément aux normes SIA et à la loi sur le contrat d'entreprise (CO art. 363 ss). Garantie de 2 ans sur les travaux exécutés.

6. LITIGES : En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le tribunal compétent sera celui du canton de Genève.`;

// ===== SANITISATION TEXTE LIBRE =====
// Strip les vraies balises HTML (<b>, </b>, <br/>, etc.) des champs utilisateur
// avant écriture dans le PDF. NE touche PAS <5mm ni "< 2 jours" (regex [a-zA-Z/]).
export const stripHtml = (val) => {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<[a-zA-Z/][^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
};

// ===== COULEURS =====
const BLEU = [51, 130, 194];
const BLEU_FONCE = [26, 90, 154];
const VERT = [46, 125, 50];
const ROUGE = [183, 28, 28];
const ORANGE = [230, 81, 0];
const GRIS = [69, 90, 100];
const GRIS_CLAIR = [240, 244, 248];

// ===== LOGO EN BASE64 =====
let logoBase64 = null;
const chargerLogo = () => {
  return new Promise((resolve) => {
    if (logoBase64) { resolve(logoBase64); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      logoBase64 = canvas.toDataURL('image/png');
      resolve(logoBase64);
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
};

// ===== EN-TÊTE PROFESSIONNEL =====
const ajouterEntete = async (doc, titre, sousTitre = '') => {
  const logo = await chargerLogo();

  // BANDE BLEUE PRINCIPALE
  doc.setFillColor(...BLEU);
  doc.rect(0, 0, 210, 42, 'F');

  // BANDE BLEUE FONCÉE EN BAS
  doc.setFillColor(...BLEU_FONCE);
  doc.rect(0, 38, 210, 4, 'F');

  // LOGO OU TEXTE CYNA
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 10, 6, 30, 30);
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('CYNA', 12, 22);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('CYNA', 12, 25);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Sàrl', 42, 25);
  }

  // TITRE DOCUMENT (rétréci si long, pour ne pas chevaucher les coordonnées à droite)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(titre.length > 24 ? 12 : 18);
  doc.setFont('helvetica', 'bold');
  doc.text(titre, 50, 20);
  if (sousTitre) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 225, 255);
    doc.text(sousTitre, 50, 30);
  }

  // COORDONNÉES À DROITE
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 235, 255);
  doc.text(CYNA.adresse, 210 - 10, 12, { align: 'right' });
  doc.text(CYNA.codePostal, 210 - 10, 17, { align: 'right' });
  doc.text(`☎ ${CYNA.tel1}  |  ${CYNA.tel2}`, 210 - 10, 22, { align: 'right' });
  doc.text(`✉ ${CYNA.email}`, 210 - 10, 27, { align: 'right' });

  // DATE
  doc.setTextColor(180, 210, 255);
  doc.text(`Genève, le ${new Date().toLocaleDateString('fr-CH')}`, 210 - 10, 35, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  return 50;
};

// ===== PIED DE PAGE PROFESSIONNEL =====
const ajouterPiedPage = (doc, avecConditions = false, mentionInterne = '') => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;

    // Mention « document interne » sur CHAQUE page, juste au-dessus du bandeau bleu.
    if (mentionInterne) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text(mentionInterne, 105, pageHeight - 15, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    }

    if (avecConditions && i === pageCount) {
      // CONDITIONS GÉNÉRALES SUR LA DERNIÈRE PAGE
      const yConditions = pageHeight - 80;
      doc.setFillColor(...GRIS_CLAIR);
      doc.rect(10, yConditions - 5, 190, 65, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRIS);
      doc.text('CONDITIONS GÉNÉRALES', 15, yConditions);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const lignes = doc.splitTextToSize(CONDITIONS.split('\n').slice(2).join(' '), 180);
      doc.text(lignes.slice(0, 8), 15, yConditions + 5);
    }

    // PIED DE PAGE
    doc.setFillColor(...BLEU);
    doc.rect(0, pageHeight - 12, 210, 12, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(`${CYNA.nom}  ·  ${CYNA.adresse}, ${CYNA.codePostal}  ·  ${CYNA.tel1}  ·  ${CYNA.email}`, 105, pageHeight - 5, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`${i} / ${pageCount}`, 200, pageHeight - 5);
    doc.setTextColor(0, 0, 0);
  }
};

// ===== SECTION TITRE =====
const sectionTitre = (doc, y, titre, couleur = BLEU) => {
  doc.setFillColor(...couleur);
  doc.rect(10, y, 190, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(titre, 15, y + 5);
  doc.setTextColor(0, 0, 0);
  return y + 10;
};

// ===== BOÎTE INFO =====
const boiteInfo = (doc, y, label, valeur, couleur = BLEU) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...couleur);
  doc.text(label + ' :', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(String(valeur || '-'), 60, y);
  return y + 6;
};

// ===== EXPORT FICHE CHANTIER =====
export const exportFicheChantier = async (chantier, clients, parametres, devis = [], pointages = []) => {
  const doc = new jsPDF();
  const client = clients.find(c => String(c.id) === String(chantier.clientId));
  const couts = calculerCoutsChantier(chantier, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
  const dateFin = calculerDateFinOuvrables(chantier.dateDebut, chantier.nombreJours, chantier.inclusSamedi, chantier.canton ?? 'GE');

  let y = await ajouterEntete(doc, 'FICHE CHANTIER', stripHtml(chantier.nom));

  // NUMÉRO ET STATUT
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(10, y - 5, 190, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLEU);
  doc.text(chantier.numero || '-', 15, y + 2);
  doc.setFontSize(10);
  doc.setTextColor(...VERT);
  doc.text(chantier.statut || '-', 210 - 15, y + 2, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // INFORMATIONS GÉNÉRALES
  y = sectionTitre(doc, y, 'INFORMATIONS GÉNÉRALES');
  const col1 = [
    ['Nom du chantier', stripHtml(chantier.nom)],
    ['Client', client ? `${stripHtml(client.prenom)} ${stripHtml(client.nom)}` : '-'],
    ['Entreprise', stripHtml(client?.entreprise) || '-'],
    ['Téléphone client', stripHtml(client?.telephone) || '-'],
    ['Email client', stripHtml(client?.email) || '-'],
  ];
  const col2 = [
    ['Conducteur', stripHtml(chantier.conducteur) || '-'],
    ['Adresse chantier', `${stripHtml(chantier.adresse) || ''}, ${stripHtml(chantier.ville) || ''}`],
    ['Date de début', chantier.dateDebut || '-'],
    ['Date de fin prévue', dateFin || '-'],
    ['Surface', `${chantier.surface || 0} m²`],
  ];

  col1.forEach((item, i) => {
    boiteInfo(doc, y + (i * 6), item[0], item[1]);
  });
  col2.forEach((item, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BLEU);
    doc.text(item[0] + ' :', 110, y + (i * 6));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(String(item[1] || '-'), 155, y + (i * 6));
  });
  y += 35;

  // DURÉE ET PLANNING
  y = sectionTitre(doc, y, 'PLANNING');
  autoTable(doc, {
    startY: y,
    head: [['Paramètre', 'Valeur']],
    body: [
      ['Durée prévue', `${chantier.nombreJours} jours ouvrables`],
      ['Jours ouvrables', chantier.inclusSamedi ? 'Lundi - Samedi' : 'Lundi - Vendredi'],
      ['Avancement', `${chantier.avancement || 0}%`],
    ],
    headStyles: { fillColor: BLEU, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // TYPES DE TRAVAUX
  if (chantier.typesTravaux?.length > 0) {
    y = sectionTitre(doc, y, 'TYPES DE TRAVAUX');
    doc.setFontSize(9);
    chantier.typesTravaux.forEach((t, i) => {
      doc.setFillColor(i % 2 === 0 ? 240 : 250, 244, 248);
      doc.rect(10, y, 190, 7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(`▶ ${stripHtml(t)}`, 15, y + 5);
      y += 7;
    });
    y += 5;
  }

  // ÉQUIPE
  if (chantier.equipe?.length > 0) {
    y = sectionTitre(doc, y, '👷 ÉQUIPE CHANTIER');
    autoTable(doc, {
      startY: y,
      head: [['Employé', 'Poste', 'Rôle', 'Jours prévus', 'Jours réalisés', 'Coût prévu', 'Coût réel']],
      body: chantier.equipe.map(m => {
        const emp = (parametres.employes || []).find(e => String(e.id) === String(m.employeId));
        const joursReelsReel = Math.round(heuresEmploye(chantier.journal || [], parseInt(m.employeId)) / 8 * 10) / 10;
        return [
          emp?.nom || '-', emp?.poste || '-', m.role || '-',
          `${m.joursPlannifies}j`, `${joursReelsReel}j`,
          `CHF ${((emp?.tarifJour || 0) * (m.joursPlannifies || 0)).toLocaleString()}`,
          `CHF ${((emp?.tarifJour || 0) * joursReelsReel).toLocaleString()}`,
        ];
      }),
      headStyles: { fillColor: BLEU, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // DONNÉES FINANCIÈRES
  if (y > 220) { doc.addPage(); y = 20; }
  y = sectionTitre(doc, y, 'DONNÉES FINANCIÈRES', VERT);
  autoTable(doc, {
    startY: y,
    head: [['Poste', 'Prévu', 'Réel', 'Écart']],
    body: [
      ['CA devis', calculerCA(chantier, devis) !== null ? `CHF ${calculerCA(chantier, devis).toLocaleString()}` : 'Aucun devis lié', '-', '-'],
      ["Main d'œuvre", `CHF ${couts.coutEquipePrevu.toLocaleString()}`, `CHF ${couts.coutEquipeReel.toLocaleString()}`, `${couts.coutEquipeReel > couts.coutEquipePrevu ? '+' : ''}CHF ${(couts.coutEquipeReel - couts.coutEquipePrevu).toLocaleString()}`],
      ['Matériel', `CHF ${couts.coutMaterielPrevu.toLocaleString()}`, `CHF ${couts.coutMaterielReel.toLocaleString()}`, `${couts.coutMaterielReel > couts.coutMaterielPrevu ? '+' : ''}CHF ${(couts.coutMaterielReel - couts.coutMaterielPrevu).toLocaleString()}`],
      ['Déplacement', `CHF ${couts.coutDeplacement.toLocaleString()}`, `CHF ${couts.coutDeplacement.toLocaleString()}`, '-'],
      ['Imprévus', 'CHF 0', `CHF ${couts.coutImprevus.toLocaleString()}`, `+CHF ${couts.coutImprevus.toLocaleString()}`],
      ['TOTAL COÛTS', `CHF ${couts.totalCoutsPrevu.toLocaleString()}`, `CHF ${couts.totalCoutsReel.toLocaleString()}`, `${couts.totalCoutsReel > couts.totalCoutsPrevu ? '+' : ''}CHF ${(couts.totalCoutsReel - couts.totalCoutsPrevu).toLocaleString()}`],
      ['MARGE', couts.margePrevu !== null ? `CHF ${Math.round(couts.margePrevu).toLocaleString()} (${couts.margePrevuPct}%)` : '—', couts.margeReel !== null ? `CHF ${Math.round(couts.margeReel).toLocaleString()} (${couts.margeActuellePct ?? '—'}%)` : '—', '-'],
    ],
    headStyles: { fillColor: VERT, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    didParseCell: (data) => {
      if (data.row.index === 6) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = GRIS_CLAIR; }
      if (data.row.index === 7) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = couts.margeReel >= 0 ? [232, 245, 233] : [255, 235, 238];
        data.cell.styles.textColor = couts.margeReel >= 0 ? VERT : ROUGE;
      }
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // KPIs
  const kpis = [
    { label: 'Marge réelle', val: couts.margeActuellePct !== null ? `${couts.margeActuellePct}%` : '—', ok: Number.isFinite(couts.margeActuellePct) && couts.margeActuellePct >= 15 },
    { label: 'Coût/m² réel', val: couts.coutParM2Reel !== null ? `CHF ${couts.coutParM2Reel}/m²` : '—', ok: true },
    { label: 'Prix/m² devis', val: couts.prixParM2Devis !== null ? `CHF ${couts.prixParM2Devis}/m²` : '—', ok: true },
    { label: 'Avancement', val: `${chantier.avancement || 0}%`, ok: true },
  ];
  const kpiW = 44;
  kpis.forEach((k, i) => {
    const x = 10 + (i * (kpiW + 4));
    doc.setFillColor(...(k.ok ? [232, 245, 233] : [255, 235, 238]));
    doc.rect(x, y, kpiW, 16, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(k.label, x + kpiW / 2, y + 5, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(k.ok ? VERT : ROUGE));
    doc.text(k.val, x + kpiW / 2, y + 12, { align: 'center' });
  });
  y += 22;

  // NOTES
  if (chantier.notes) {
    y = sectionTitre(doc, y, 'NOTES ET OBSERVATIONS', GRIS);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(stripHtml(chantier.notes), 180);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 5;
  }

  ajouterPiedPage(doc, false);
  doc.save(`Fiche_Chantier_${chantier.nom.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

// ===== EXPORT DEVIS CLIENT =====
export const exportDevis = async (devis, clients, parametres) => {
  const doc = new jsPDF();
  const client = clients.find(c => String(c.id) === String(devis.clientId));

  let y = await ajouterEntete(doc, 'DEVIS', `N° ${devis.numero}  ·  ${devis.date}`);

  // BLOC CLIENT
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(10, y, 90, 40, 'F');
  doc.setFillColor(230, 240, 255);
  doc.rect(110, y, 90, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLEU);
  doc.text('CLIENT', 15, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  if (client) {
    doc.text(`${stripHtml(client.prenom)} ${stripHtml(client.nom)}`, 15, y + 14);
    doc.text(stripHtml(client.entreprise) || '', 15, y + 20);
    doc.text(stripHtml(client.adresse) || '', 15, y + 26);
    doc.text(`${stripHtml(client.ville) || ''} (${stripHtml(client.canton) || ''})`, 15, y + 32);
    doc.text(stripHtml(client.telephone) || '', 15, y + 38);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLEU);
  doc.text('PRESTATAIRE', 115, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(CYNA.nom, 115, y + 14);
  doc.text(CYNA.adresse, 115, y + 20);
  doc.text(CYNA.codePostal, 115, y + 26);
  doc.text(`☎ ${CYNA.tel1}`, 115, y + 32);
  doc.text(`✉ ${CYNA.email}`, 115, y + 38);
  y += 48;

  // OBJET
  y = sectionTitre(doc, y, 'OBJET DU DEVIS');
  autoTable(doc, {
    startY: y,
    body: [
      ['Zone géographique', stripHtml(devis.zone) || '-'],
      ['Type de travaux', stripHtml(devis.typeTravaux) || '-'],
      ['Surface', `${devis.surface || 0} m²`],
      ['Complexité', stripHtml(devis.complexite) || 'Normale'],
      ['Urgence', stripHtml(devis.urgence) || 'Non'],
      ['Accès chantier', stripHtml(devis.acces) || 'Normal'],
    ],
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70, fillColor: GRIS_CLAIR } },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // DÉTAIL FINANCIER
  y = sectionTitre(doc, y, 'DÉTAIL FINANCIER', VERT);
  const prixPropose = parseFloat(devis.prixPropose) || 0;
  const coutMateriel = parseFloat(devis.coutMateriel) || 0;
  const coutTransport = parseFloat(devis.coutTransport) || 0;
  const coutSousTraitance = parseFloat(devis.coutSousTraitance) || 0;
  const totalCouts = coutMateriel + coutTransport + coutSousTraitance;
  const fraisGen = totalCouts * ((parametres.parametres?.tauxFraisGeneraux || 12) / 100);
  const surface = parseFloat(devis.surface) || 0;
  const fmtM2 = (val) => surface > 0 ? `CHF ${Math.round(val / surface).toLocaleString()}/m²` : '—';

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Montant HT', 'CHF/m²']],
    body: [
      ['Fournitures et matériaux', `CHF ${coutMateriel.toLocaleString()}`, fmtM2(coutMateriel)],
      ['Transport et logistique', `CHF ${coutTransport.toLocaleString()}`, fmtM2(coutTransport)],
      ['Sous-traitance', `CHF ${coutSousTraitance.toLocaleString()}`, fmtM2(coutSousTraitance)],
      ['Frais généraux', `CHF ${Math.round(fraisGen).toLocaleString()}`, fmtM2(fraisGen)],
      ['PRIX DE VENTE HT', `CHF ${prixPropose.toLocaleString()}`, fmtM2(prixPropose)],
    ],
    headStyles: { fillColor: VERT, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 11;
        data.cell.styles.fillColor = [232, 245, 233];
        data.cell.styles.textColor = VERT;
      }
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // RÉCAPITULATIF PRIX
  const recapX = 110;
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(recapX, y, 90, 50, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLEU);
  doc.text('RÉCAPITULATIF', recapX + 5, y + 8);

  // Taux FIGÉ du devis : le document fait foi, jamais le paramètre courant.
  const tauxDevis = tauxDocumentFige(devis, parametres);
  [
    [`Prix HT :`, `CHF ${prixPropose.toLocaleString()}`],
    [`TVA ${tauxDevis}% :`, `CHF ${Math.round(prixPropose * (tauxDevis / 100)).toLocaleString()}`],
    [`TOTAL TTC :`, `CHF ${Math.round(prixPropose * (1 + tauxDevis / 100)).toLocaleString()}`],
  ].forEach(([label, val], i) => {
    doc.setFont('helvetica', i === 2 ? 'bold' : 'normal');
    doc.setFontSize(i === 2 ? 12 : 10);
    if (i === 2) {
  doc.setTextColor(...VERT);
} else {
  doc.setTextColor(50, 50, 50);
}
    doc.text(label, recapX + 5, y + 18 + (i * 10));
    doc.text(val, recapX + 85, y + 18 + (i * 10), { align: 'right' });
  });
  y += 58;

  // NOTES
  if (devis.notes) {
    y = sectionTitre(doc, y, 'REMARQUES');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(stripHtml(devis.notes), 180);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 8;
  }

  // SIGNATURES
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(10, y, 88, 35, 'F');
  doc.rect(112, y, 88, 35, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLEU);
  doc.text('Signature CYNA Sàrl :', 15, y + 7);
  doc.text('Signature et cachet client :', 117, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Lu et approuvé', 15, y + 28);
  doc.text(`Date : ${new Date().toLocaleDateString('fr-CH')}`, 15, y + 33);
  doc.text('Lu et approuvé', 117, y + 28);
  doc.text('Date : _______________', 117, y + 33);

  ajouterPiedPage(doc, true);
  doc.save(`Devis_${devis.numero}.pdf`);
};

// ===== EXPORT RAPPORT MENSUEL =====
export const exportRapportMensuel = async (chantiers, clients, parametres, mois, annee, devis = [], pointages = []) => {
  const doc = new jsPDF();
  const nomsMois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  let y = await ajouterEntete(doc, 'RAPPORT MENSUEL', `${nomsMois[mois]} ${annee}`);

  const chantiersMois = chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const d = new Date(c.dateDebut);
    return d.getMonth() === mois && d.getFullYear() === annee;
  });

  const caTotal = chantiersMois.reduce((t, c) => t + (calculerCA(c, devis) ?? 0), 0);
  const coutsTotal = chantiersMois.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages).totalCoutsReel, 0);
  const margeTotal = caTotal - coutsTotal;
  const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 1000) / 10 : 0;

  // KPIs VISUELS
  const kpis = [
    { label: 'Chantiers du mois', val: chantiersMois.length, couleur: BLEU, bg: [227, 242, 253] },
    { label: "Chiffre d'affaires", val: `CHF ${caTotal.toLocaleString()}`, couleur: VERT, bg: [232, 245, 233] },
    { label: 'Total coûts', val: `CHF ${coutsTotal.toLocaleString()}`, couleur: ORANGE, bg: [255, 243, 224] },
    { label: 'Marge nette', val: `CHF ${margeTotal.toLocaleString()} (${margePct}%)`, couleur: margeTotal >= 0 ? VERT : ROUGE, bg: margeTotal >= 0 ? [232, 245, 233] : [255, 235, 238] },
  ];

  kpis.forEach((k, i) => {
    const x = 10 + (i * 47);
    doc.setFillColor(...k.bg);
    doc.rect(x, y, 44, 20, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(k.label, x + 22, y + 6, { align: 'center' });
    doc.setFontSize(k.val.toString().length > 10 ? 8 : 10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...k.couleur);
    doc.text(String(k.val), x + 22, y + 15, { align: 'center' });
  });
  y += 25;

  // RÉSUMÉ
  y = sectionTitre(doc, y, 'RÉSUMÉ DU MOIS');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur', 'Statut']],
    body: [
      ['Nombre de chantiers', chantiersMois.length, chantiersMois.length > 0 ? 'Actif' : '—'],
      ["Chiffre d'affaires", `CHF ${caTotal.toLocaleString()}`, '💰'],
      ['Total coûts', `CHF ${coutsTotal.toLocaleString()}`, '💸'],
      ['Marge brute', `CHF ${margeTotal.toLocaleString()}`, margeTotal >= 0 ? 'Positif' : 'Négatif'],
      ['Taux de marge', `${margePct}%`, parseFloat(margePct) >= 20 ? 'Excellent' : parseFloat(margePct) >= 15 ? 'Correct' : 'Faible'],
    ],
    headStyles: { fillColor: BLEU, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 2: { halign: 'center' } },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // DÉTAIL CHANTIERS
  if (chantiersMois.length > 0) {
    y = sectionTitre(doc, y, 'DÉTAIL DES CHANTIERS');
    autoTable(doc, {
      startY: y,
      head: [['Chantier', 'Client', 'Ville', 'Statut', 'Devis CHF', 'Coûts CHF', 'Marge %', 'Gain CHF']],
      body: chantiersMois.map(c => {
        const client = clients.find(cl => String(cl.id) === String(c.clientId));
        const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages);
        return [
          stripHtml(c.nom), stripHtml(client?.entreprise) || '-', stripHtml(c.ville) || '-', c.statut,
          couts.montantTotal !== null ? Math.round(couts.montantTotal).toLocaleString() : '—',
          Math.round(couts.totalCoutsReel).toLocaleString(),
          couts.margeActuellePct !== null ? `${couts.margeActuellePct}%` : '—',
          couts.margeReel !== null ? Math.round(couts.margeReel).toLocaleString() : '—',
        ];
      }),
      headStyles: { fillColor: BLEU, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      didParseCell: (data) => {
        if (data.column.index === 7 && data.section === 'body') {
          const val = parseFloat(data.cell.raw);
          data.cell.styles.textColor = val >= 20 ? VERT : val >= 15 ? ORANGE : ROUGE;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ANALYSE PAR TYPE DE TRAVAUX
  const parType = parametres.typesTravaux.map(t => {
    const cs = chantiersMois.filter(c => (c.typesTravaux || []).includes(t.nom));
    if (cs.length === 0) return null;
    const ca = cs.reduce((s, c) => s + calculerCA(c, devis), 0);
    const couts = cs.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis, pointages).totalCoutsReel, 0);
    return [t.nom, cs.length, `CHF ${ca.toLocaleString()}`, `CHF ${couts.toLocaleString()}`, `CHF ${(ca - couts).toLocaleString()}`, ca > 0 ? `${Math.round(((ca - couts) / ca) * 1000) / 10}%` : '-'];
  }).filter(Boolean);

  if (parType.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = sectionTitre(doc, y, 'ANALYSE PAR TYPE DE TRAVAUX');
    autoTable(doc, {
      startY: y,
      head: [['Type de travaux', 'Chantiers', 'CA', 'Coûts', 'Marge', 'Taux']],
      body: parType,
      headStyles: { fillColor: BLEU, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
  }

  ajouterPiedPage(doc, false);
  doc.save(`Rapport_Mensuel_${nomsMois[mois]}_${annee}.pdf`);
};

// ===== EXPORT FACTURE (QR-FACTURE SIX GROUP) =====
export const exportFacture = async (facture, client, chantier, devis, parametres) => {
  const doc = new jsPDF();
  const cyna = getCYNA(parametres);

  // --- Protections calculs (règles CYNA SÀRL) ---
  const montantHT    = parseFloat(facture.montantHT) || 0;
  const tva          = tauxDocumentFige(facture, parametres);   // taux FIGÉ du document, jamais le paramètre courant
  const montantTVA   = montantHT * (tva / 100);
  const montantTTC   = montantHT * (1 + tva / 100);   // recalculé, jamais depuis facture.montantTTC
  const montantPaye  = parseFloat(facture.montantPaye) || 0;
  const montantRestant = Math.max(0, montantTTC - montantPaye);
  const estSolde     = montantRestant <= 0;

  const formatCHF = (val) => `CHF ${Math.round(val).toLocaleString('fr-CH')}`;

  // ─────────────────────────────────────────────
  // 1. EN-TÊTE — titre « document interne » (le mot FACTURE seul n'est plus le titre)
  // ─────────────────────────────────────────────
  let y = await ajouterEntete(
    doc,
    'SUIVI DE FACTURATION — DOCUMENT INTERNE',
    `N° ${facture.numero || '—'}  ·  ${facture.dateEmission || '—'}`
  );

  // ─────────────────────────────────────────────
  // 1bis. BANDEAU « document interne » — visible immédiatement sous l'en-tête
  // ─────────────────────────────────────────────
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(10, y, 190, 12, 'F');
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(10, y, 190, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 90, 90);
  doc.text(
    'Document de suivi interne — ne constitue pas une facture. La facture officielle est émise séparément.',
    105, y + 7.5, { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  y += 18;

  // ─────────────────────────────────────────────
  // 2. BLOC CLIENT + PRESTATAIRE
  // ─────────────────────────────────────────────
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(10, y, 90, 46, 'F');
  doc.setFillColor(230, 240, 255);
  doc.rect(110, y, 90, 46, 'F');

  // Colonne gauche — CLIENT
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLEU);
  doc.text('CLIENT', 15, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  if (client) {
    doc.text(`${stripHtml(client.prenom || '')} ${stripHtml(client.nom || '')}`.trim() || '—', 15, y + 14);
    if (client.entreprise) doc.text(stripHtml(client.entreprise), 15, y + 20);
    if (client.adresse)    doc.text(stripHtml(client.adresse),    15, y + 26);
    const villeCantonClient = [client.ville, client.canton].filter(Boolean).map(stripHtml).join(' (') + (client.canton ? ')' : '');
    if (villeCantonClient) doc.text(villeCantonClient, 15, y + 32);
    if (client.telephone)  doc.text(stripHtml(client.telephone),  15, y + 38);
  } else {
    doc.text('—', 15, y + 14);
  }

  // Colonne droite — PRESTATAIRE
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLEU);
  doc.text('PRESTATAIRE', 115, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(cyna.nom,       115, y + 14);
  doc.text(cyna.adresse,   115, y + 20);
  doc.text(cyna.codePostal,115, y + 26);
  doc.text(`☎ ${cyna.tel1}`, 115, y + 32);
  doc.text(`✉ ${cyna.email}`, 115, y + 38);
  doc.text(`N° TVA : ${cyna.nTVA}`, 115, y + 44);
  y += 54;

  // ─────────────────────────────────────────────
  // 3. TABLEAU DE FACTURATION
  // ─────────────────────────────────────────────
  y = sectionTitre(doc, y, 'DÉTAIL DE LA FACTURE', BLEU_FONCE);

  const lignesFacture = [
    [
      'Travaux selon devis / chantier',
      stripHtml(chantier?.nom || devis?.numero || '—'),
      formatCHF(montantHT),
    ],
  ];
  if (facture.notes) {
    lignesFacture.push([
      { content: `Notes : ${stripHtml(facture.notes)}`, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } },
      '',
      '',
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Réf.', 'Montant HT']],
    body: lignesFacture,
    headStyles: { fillColor: BLEU_FONCE, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 45 },
      2: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Récapitulatif financier (sous le tableau)
  const recapX = 110;
  doc.setFillColor(...GRIS_CLAIR);
  doc.rect(recapX, y, 90, 40, 'F');

  const lignesRecap = [
    [`Sous-total HT :`,         formatCHF(montantHT),   false, false],
    [`TVA ${tva}% :`,           formatCHF(montantTVA),  false, false],
    [`TOTAL TTC :`,             formatCHF(montantTTC),  true,  false],
  ];
  lignesRecap.forEach(([label, val, bold, _], i) => {
    const ry = y + 10 + i * 10;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? BLEU_FONCE : [50, 50, 50]));
    doc.text(label, recapX + 5, ry);
    doc.text(val, recapX + 85, ry, { align: 'right' });
  });
  y += 48;

  // ─────────────────────────────────────────────
  // 4. INFORMATIONS DE PAIEMENT
  // ─────────────────────────────────────────────
  if (y > 190) { doc.addPage(); y = 20; }
  y = sectionTitre(doc, y, 'INFORMATIONS DE PAIEMENT', BLEU);

  doc.setFillColor(...GRIS_CLAIR);
  const infoBoxHeight = montantPaye > 0 ? 46 : 40;
  doc.rect(10, y, 190, infoBoxHeight, 'F');

  const infoLines = [
    [`Numéro de facture :`, facture.numero || '—'],
    [`Date d'émission :`,   facture.dateEmission || '—'],
    [`Échéance :`,          facture.dateEcheance || '30 jours net'],
  ];
  if (montantPaye > 0) {
    infoLines.push([`Déjà payé :`, formatCHF(montantPaye)]);
  }

  infoLines.forEach(([label, val], i) => {
    const iy = y + 8 + i * 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLEU);
    doc.text(label, 15, iy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(String(val), 75, iy);
  });

  // Solde à payer
  const soldeY = y + 8 + infoLines.length * 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...(estSolde ? VERT : ROUGE));
  doc.text('SOLDE À PAYER :', 15, soldeY);
  doc.text(formatCHF(montantRestant), 195, soldeY, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += infoBoxHeight + 10;

  // ─────────────────────────────────────────────
  // 5. PIED DE PAGE — mention interne sur chaque page
  // ─────────────────────────────────────────────
  ajouterPiedPage(doc, false, 'Document interne CYNA Sàrl — sans valeur comptable ni fiscale.');

  doc.save(`suivi-facturation_${facture.numero || 'sans-numero'}_${facture.dateEmission || 'date'}.pdf`);
};
