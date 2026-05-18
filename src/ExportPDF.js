import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculerDateFinOuvrables, calculerCoutsChantier, calculerCA } from './donnees';

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
};

// ===== CONDITIONS GÉNÉRALES =====
const CONDITIONS = `CONDITIONS GÉNÉRALES — CYNA Sàrl

1. VALIDITÉ DU DEVIS : Le présent devis est valable 30 jours dès sa date d'émission. Passé ce délai, CYNA Sàrl se réserve le droit de le réviser.

2. PAIEMENT : Acompte de 30% à la commande. Solde à réception des travaux, net à 30 jours. Tout retard de paiement entraîne des intérêts moratoires de 5% l'an.

3. TRAVAUX SUPPLÉMENTAIRES : Tout travail non prévu au présent devis fera l'objet d'un avenant chiffré et accepté avant exécution.

4. DÉLAIS : Les délais indiqués sont donnés à titre indicatif. CYNA Sàrl ne peut être tenu responsable des retards dus à des causes indépendantes de sa volonté.

5. GARANTIE : Les travaux sont garantis conformément aux normes SIA et à la loi sur le contrat d'entreprise (CO art. 363 ss). Garantie de 2 ans sur les travaux exécutés.

6. LITIGES : En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le tribunal compétent sera celui du canton de Genève.`;

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

  // TITRE DOCUMENT
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
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
const ajouterPiedPage = (doc, avecConditions = false) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;

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
export const exportFicheChantier = async (chantier, clients, parametres, devis = []) => {
  const doc = new jsPDF();
  const client = clients.find(c => String(c.id) === String(chantier.clientId));
  const couts = calculerCoutsChantier(chantier, parametres.employes, parametres.localites, parametres.parametres, devis);
  const dateFin = calculerDateFinOuvrables(chantier.dateDebut, chantier.nombreJours, chantier.inclusSamedi);

  let y = await ajouterEntete(doc, 'FICHE CHANTIER', chantier.nom);

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
    ['Nom du chantier', chantier.nom],
    ['Client', client ? `${client.prenom} ${client.nom}` : '-'],
    ['Entreprise', client?.entreprise || '-'],
    ['Téléphone client', client?.telephone || '-'],
    ['Email client', client?.email || '-'],
  ];
  const col2 = [
    ['Conducteur', chantier.conducteur || '-'],
    ['Adresse chantier', `${chantier.adresse || ''}, ${chantier.ville || ''}`],
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
      doc.text(`▶ ${t}`, 15, y + 5);
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
        const emp = parametres.employes.find(e => e.id === parseInt(m.employeId));
        return [
          emp?.nom || '-', emp?.poste || '-', m.role || '-',
          `${m.joursPlannifies}j`, `${m.joursRealises || 0}j`,
          `CHF ${((emp?.tarifJour || 0) * (m.joursPlannifies || 0)).toLocaleString()}`,
          `CHF ${((emp?.tarifJour || 0) * (parseFloat(m.joursRealises) || 0)).toLocaleString()}`,
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
      ['MARGE', couts.margePrevu !== null ? `CHF ${Math.round(couts.margePrevu).toLocaleString()} (${couts.margePrevuPct}%)` : '—', couts.margeReel !== null ? `CHF ${Math.round(couts.margeReel).toLocaleString()} (${couts.margeReelPct ?? '—'}%)` : '—', '-'],
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
    { label: 'Marge réelle', val: couts.margeReelPct !== null ? `${couts.margeReelPct}%` : '—', ok: Number.isFinite(couts.margeReelPct) && couts.margeReelPct >= 15 },
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
    const lines = doc.splitTextToSize(chantier.notes, 180);
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
    doc.text(`${client.prenom} ${client.nom}`, 15, y + 14);
    doc.text(client.entreprise || '', 15, y + 20);
    doc.text(client.adresse || '', 15, y + 26);
    doc.text(`${client.ville || ''} (${client.canton || ''})`, 15, y + 32);
    doc.text(client.telephone || '', 15, y + 38);
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
      ['Zone géographique', devis.zone || '-'],
      ['Type de travaux', devis.typeTravaux || '-'],
      ['Surface', `${devis.surface || 0} m²`],
      ['Complexité', devis.complexite || 'Normale'],
      ['Urgence', devis.urgence || 'Non'],
      ['Accès chantier', devis.acces || 'Normal'],
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

  [
    [`Prix HT :`, `CHF ${prixPropose.toLocaleString()}`],
    [`TVA ${parseFloat(devis.tva) || parseFloat(parametres.parametres?.tauxTVA) || 8.1}% :`, `CHF ${Math.round(prixPropose * ((parseFloat(devis.tva) || parseFloat(parametres.parametres?.tauxTVA) || 8.1) / 100)).toLocaleString()}`],
    [`TOTAL TTC :`, `CHF ${Math.round(prixPropose * (1 + (parseFloat(devis.tva) || parseFloat(parametres.parametres?.tauxTVA) || 8.1) / 100)).toLocaleString()}`],
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
    const lines = doc.splitTextToSize(devis.notes, 180);
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
export const exportRapportMensuel = async (chantiers, clients, parametres, mois, annee, devis = []) => {
  const doc = new jsPDF();
  const nomsMois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  let y = await ajouterEntete(doc, 'RAPPORT MENSUEL', `${nomsMois[mois]} ${annee}`);

  const chantiersMois = chantiers.filter(c => {
    if (!c.dateDebut) return false;
    const d = new Date(c.dateDebut);
    return d.getMonth() === mois && d.getFullYear() === annee;
  });

  const caTotal = chantiersMois.reduce((t, c) => t + (calculerCA(c, devis) ?? 0), 0);
  const coutsTotal = chantiersMois.reduce((t, c) => t + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
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
        const couts = calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis);
        return [
          c.nom, client?.entreprise || '-', c.ville || '-', c.statut,
          couts.montantTotal !== null ? Math.round(couts.montantTotal).toLocaleString() : '—',
          Math.round(couts.totalCoutsReel).toLocaleString(),
          couts.margeReelPct !== null ? `${couts.margeReelPct}%` : '—',
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
    const couts = cs.reduce((s, c) => s + calculerCoutsChantier(c, parametres.employes, parametres.localites, parametres.parametres, devis).totalCoutsReel, 0);
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
