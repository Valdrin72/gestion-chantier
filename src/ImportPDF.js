import React, { useState, useRef } from 'react';
import { C } from './donnees';
import { DS } from './ds';

const carteStyle = DS.card;
const inputStyle = DS.input;
const labelStyle = DS.label;

// ===== DÉTECTION INTELLIGENTE =====
const detecterMetres = (texte) => {
  const lignes = texte.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const metres = [];

  const patterns = [
    { regex: /(\d+[.,]\d+)\s*m[²2]/gi, type: 'm²', label: 'Surface' },
    { regex: /(\d+[.,]\d+)\s*ml/gi, type: 'ml', label: 'Mètre linéaire' },
    { regex: /(\d+[.,]\d+)\s*m\b/gi, type: 'm', label: 'Mètre' },
    { regex: /(\d+)\s*unit[ée]s?/gi, type: 'unité', label: 'Unité' },
    { regex: /(\d+)\s*pièces?/gi, type: 'pièce', label: 'Pièce' },
  ];

  const motsCles = ['cloison', 'vitrage', 'porte', 'plancher', 'plafond', 'mur', 'dalle', 'isolation', 'revêtement', 'carrelage', 'peinture', 'menuiserie', 'électricité', 'plomberie', 'sanitaire', 'façade', 'toiture', 'terrasse', 'parking'];

  lignes.forEach((ligne, i) => {
    const ligneLower = ligne.toLowerCase();
    const motCle = motsCles.find(m => ligneLower.includes(m));

    patterns.forEach(({ regex, type, label }) => {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(ligne)) !== null) {
        const valeur = parseFloat(match[1].replace(',', '.'));
        if (valeur > 0 && valeur < 100000) {
          metres.push({
            id: Date.now() + Math.random(),
            description: motCle ? ligne.substring(0, 80) : `${label} ligne ${i + 1}`,
            valeur,
            unite: type,
            ligne: i + 1,
            texteOriginal: ligne.substring(0, 100),
            confiance: motCle ? 'haute' : 'moyenne',
            categorie: motCle || 'autre',
          });
        }
      }
    });
  });

  return metres.slice(0, 50);
};

const detecterMontants = (texte) => {
  const lignes = texte.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const montants = [];

  const patterns = [
    /CHF\s*([0-9'.\s]+)/gi,
    /Fr\.\s*([0-9'.\s]+)/gi,
    /([0-9]{1,3}(?:[\s'][0-9]{3})*(?:[.,][0-9]{1,2})?)\s*(?:CHF|Fr\.?)/gi,
    /([0-9]+[.,][0-9]{2})\s*$/gm,
  ];

  const motsClesMontants = ['total', 'montant', 'prix', 'coût', 'forfait', 'main', 'matériel', 'fourniture', 'prestation', 'sous-total', 'tva', 'ttc', 'ht'];

  lignes.forEach((ligne, i) => {
    const ligneLower = ligne.toLowerCase();
    const motCle = motsClesMontants.find(m => ligneLower.includes(m));

    patterns.forEach(regex => {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(ligne)) !== null) {
        const valeurStr = (match[1] || match[0]).replace(/[\s']/g, '').replace(',', '.');
        const valeur = parseFloat(valeurStr);
        if (valeur >= 10 && valeur <= 10000000) {
          montants.push({
            id: Date.now() + Math.random(),
            description: ligne.substring(0, 80) || `Montant ligne ${i + 1}`,
            valeur,
            ligne: i + 1,
            texteOriginal: ligne.substring(0, 100),
            confiance: motCle ? 'haute' : 'moyenne',
            type: motCle || 'inconnu',
            inclus: true,
          });
        }
      }
    });
  });

  // Dédoublonner
  const uniques = montants.filter((m, i, arr) =>
    arr.findIndex(x => Math.abs(x.valeur - m.valeur) < 0.01 && x.ligne === m.ligne) === i
  );

  return uniques.slice(0, 30);
};

// ===== EXTRACTION UNIFIÉE =====
export const extraireDonneesPDF = (texte) => {
  if (!texte || !texte.trim()) {
    return { client: '', montant: 0, surface: 0, lignes: [], texteBrut: '', qualite: 'echec', score: 0 };
  }

  const lignes = texte.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const parseNum = (s) => parseFloat((s || '').replace(/[\s']/g, '').replace(',', '.')) || 0;

  // ── 1. CLIENT ────────────────────────────────────────────────
  let client = '';
  const patternsClient = [
    /(?:client|maître d['']ouvrage|commanditaire|donneur d['']ordre)\s*:?\s*(.+)/i,
    /(?:entreprise|société|raison sociale)\s*:\s*(.+)/i,
    /(?:nom|m\.|mme|mr)\s+([A-ZÀ-Ÿa-zà-ÿ][\w\s\-]+(?:SA|Sàrl|SARL|AG|GmbH)?)/i,
  ];
  for (const ligne of lignes) {
    for (const pat of patternsClient) {
      const m = ligne.match(pat);
      if (m && m[1]?.trim().length > 2) { client = m[1].trim().substring(0, 60); break; }
    }
    if (client) break;
  }

  // ── 2. MONTANT TOTAL (priorité aux lignes TOTAL explicites) ──
  let montant = 0;
  // Passe 1 : lignes marquées TOTAL / Montant total / Total TTC …
  const reTotalExplicite = /\b(?:total\s*(?:ttc|ht|général|general|facture|devis|net)?|montant\s*total|prix\s*total|forfait\s*total)\b/i;
  for (const ligne of lignes) {
    if (!reTotalExplicite.test(ligne)) continue;
    // Extraire tous les nombres de la ligne, prendre le plus grand
    const nums = [...ligne.matchAll(/([0-9][0-9'\s]*(?:[.,][0-9]{1,2})?)/g)]
      .map(m => parseNum(m[1]))
      .filter(v => v >= 100 && v < 50000000);
    if (nums.length) montant = Math.max(montant, ...nums);
  }
  // Passe 2 (fallback) : CHF / Fr. + nombre, ou nombre + CHF
  if (montant === 0) {
    for (const ligne of lignes) {
      const patterns = [
        /CHF\s*([0-9][0-9'\s]*(?:[.,][0-9]{1,2})?)/gi,
        /([0-9][0-9'\s]{3,}(?:[.,][0-9]{2})?)(?:\s*CHF|\s*Fr\.?)/gi,
      ];
      for (const re of patterns) {
        for (const m of ligne.matchAll(re)) {
          const val = parseNum(m[1]);
          if (val > montant && val >= 100 && val < 50000000) montant = val;
        }
      }
    }
  }
  // Passe 3 (PDF fragmenté) : plus grand nombre valide du document entier
  if (montant === 0) {
    const texteFlat3 = texte.replace(/\s+/g, ' ');
    for (const m of texteFlat3.matchAll(/([0-9][0-9'\s]*(?:[.,][0-9]{1,2})?)/g)) {
      const val = parseNum(m[1]);
      if (val > montant && val >= 500 && val < 50000000) montant = val;
    }
  }

  // ── 3. SURFACE — additionner toutes les valeurs m² trouvées ──
  // Pattern tableau : "43.00 m²" ou "43,00 m2" sur n'importe quelle ligne
  let surfaceCumulee = 0;
  const reSurface = /([0-9]+(?:[.,][0-9]{1,3})?)\s*m[²2]/gi;
  for (const ligne of lignes) {
    // Exclure les lignes TOTAL (pour ne pas additionner un m² dans un libellé total)
    if (reTotalExplicite.test(ligne)) continue;
    for (const m of ligne.matchAll(reSurface)) {
      const val = parseNum(m[1]);
      if (val >= 0.5 && val <= 10000) surfaceCumulee += val;
    }
  }
  // surfaceCumulee sera combinée avec surfaceSeqCumulee plus bas (section 4c)

  // ── 4. LIGNES / POSTES ───────────────────────────────────────
  // 4a. Détection tableau structuré : "43.00 m² 35.00 1505.00"
  //     format: quantité(m²)  prix_unitaire  total_ligne
  const reTableau = /([0-9]+(?:[.,][0-9]{1,3})?)\s*m[²2]\s+([0-9]+(?:[.,][0-9]{1,3})?)\s+([0-9]+(?:[.,][0-9]{1,3})?)/i;
  const lignesTableau = [];
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(reTableau);
    if (!m) continue;
    const qte   = parseNum(m[1]);
    const total = parseNum(m[3]);
    if (qte <= 0 || total <= 0 || total > 50000000) continue;
    // Description = ligne précédente si elle n'est pas une ligne de chiffres
    const lignePrecedente = i > 0 ? lignes[i - 1] : '';
    const estLibelle = lignePrecedente && !/^\d/.test(lignePrecedente) && lignePrecedente.length > 2;
    lignesTableau.push({
      description: estLibelle ? lignePrecedente.substring(0, 60) : 'Poste détecté',
      quantite: qte,
      unite: 'm²',
      prix: total,
    });
    if (lignesTableau.length >= 15) break;
  }

  // 4b. Fallback : mots-clés métier BTP (si aucune ligne tableau trouvée)
  const POSTES_BTP = ['peinture', 'carrelage', 'moquette', 'faux-plancher', 'faux plancher', 'plafond', 'cloisons', 'cloison', 'parquet', 'isolation', 'plâtrerie', 'plâtrage', 'menuiserie', 'électricité', 'plomberie', 'façade', 'toiture', 'chape', 'étanchéité', 'revêtement', 'carreaux', 'dallage', 'enduit'];
  const lignesMotsCles = [];
  if (lignesTableau.length === 0) {
    const dejaPris = new Set();
    for (const ligne of lignes) {
      const l = ligne.toLowerCase();
      const poste = POSTES_BTP.find(p => l.includes(p));
      if (poste && !dejaPris.has(poste)) {
        dejaPris.add(poste);
        const mPrix = ligne.match(/([0-9]{2,}(?:[.,][0-9]{1,2})?)/);
        lignesMotsCles.push({
          description: ligne.substring(0, 60).trim(),
          quantite: 1,
          unite: 'm²',
          prix: mPrix ? parseNum(mPrix[1]) : 0,
        });
      }
      if (lignesMotsCles.length >= 10) break;
    }
  }

  // 4c. Fallback séquentiel (PDF fragmenté — valeurs réparties sur plusieurs lignes)
  //     Scan à plat du texte entier : repère chaque "nombre + m²" puis récupère
  //     les 2 prochains nombres comme prix_unitaire et total_ligne.
  const lignesSequentielles = [];
  let surfaceSeqCumulee = 0;
  if (lignesTableau.length === 0 && lignesMotsCles.length === 0) {
    const texteFlat = texte.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
    const reSurfaceFlat = /([0-9]+(?:[.,][0-9]{1,3})?)\s*m[²2]/gi;
    for (const mSurf of texteFlat.matchAll(reSurfaceFlat)) {
      const qte = parseNum(mSurf[1]);
      if (qte < 0.5 || qte > 10000) continue;
      // Vérifier que ce n'est pas dans un contexte TOTAL
      const ctx = texteFlat.slice(Math.max(0, mSurf.index - 30), mSurf.index + 30);
      if (reTotalExplicite.test(ctx)) continue;
      // Trouver les 2 prochains nombres après le match m²
      const apres = texteFlat.slice(mSurf.index + mSurf[0].length);
      const prochains = [...apres.matchAll(/([0-9]+(?:[.,][0-9]{1,3})?)/g)]
        .map(m => parseNum(m[1]))
        .filter(v => v > 0)
        .slice(0, 2);
      if (prochains.length < 2) continue;
      const total = prochains[1];
      if (total <= 0 || total > 50000000) continue;
      surfaceSeqCumulee += qte;
      lignesSequentielles.push({
        description: 'Poste détecté',
        quantite: Math.round(qte * 100) / 100,
        unite: 'm²',
        prix: Math.round(total * 100) / 100,
      });
      if (lignesSequentielles.length >= 15) break;
    }
  }

  // 4d. Fallback brut (aucune méthode précédente n'a rien trouvé)
  //     Extrait tous les nombres du document et applique une logique métier basique.
  const lignesBrutes = [];
  let montantBrut = montant;       // ne remplace que si montant encore 0
  let surfaceBruteCumulee = 0;
  const toutesMethodesVides =
    lignesTableau.length === 0 &&
    lignesMotsCles.length === 0 &&
    lignesSequentielles.length === 0;

  if (toutesMethodesVides) {
    const texteFlat4d = texte.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');

    // Extraire tous les nombres (entiers et décimaux) avec leur position
    const reNombre = /([0-9]+(?:[.,][0-9]{1,3})?)/g;
    const nombresAvecPos = [...texteFlat4d.matchAll(reNombre)].map(m => ({
      val: parseNum(m[1]),
      idx: m.index,
    })).filter(n => n.val > 0);

    // Surface brute : nombres suivis de "m" ou "m²" à moins de 5 caractères
    const reMAdj = /([0-9]+(?:[.,][0-9]{1,3})?)\s*m[²2²]?/gi;
    for (const mM of texteFlat4d.matchAll(reMAdj)) {
      const v = parseNum(mM[1]);
      if (v >= 0.5 && v <= 10000) surfaceBruteCumulee += v;
    }

    // Montant brut : le plus grand nombre du document (si montant encore 0)
    if (montantBrut === 0 && nombresAvecPos.length > 0) {
      const plusGrand = nombresAvecPos.reduce((max, n) => n.val > max.val ? n : max);
      if (plusGrand.val >= 100) montantBrut = plusGrand.val;
    }

    // Lignes brutes : grouper les nombres 3 par 3 → (surface, prixUnit, total)
    const valeursFiltre = nombresAvecPos
      .map(n => n.val)
      .filter(v => v >= 0.5 && v <= 50000000);
    for (let i = 0; i + 2 < valeursFiltre.length; i += 3) {
      const surf = valeursFiltre[i];
      const prixU = valeursFiltre[i + 1];
      const tot = valeursFiltre[i + 2];
      // Sanity check : total ≈ surf * prixU (tolérance 20 %) ou au moins cohérent
      const produit = surf * prixU;
      if (produit > 0 && Math.abs(produit - tot) / produit < 0.2) {
        lignesBrutes.push({
          description: `Poste ${lignesBrutes.length + 1}`,
          quantite: Math.round(surf * 100) / 100,
          unite: 'm²',
          prix: Math.round(tot * 100) / 100,
        });
      }
      if (lignesBrutes.length >= 10) break;
    }
  }

  // Surface finale : préférer la somme séquentielle si la section 3 n'a rien trouvé
  const surfaceFinale = surfaceCumulee > 0
    ? surfaceCumulee
    : surfaceSeqCumulee > 0
      ? surfaceSeqCumulee
      : surfaceBruteCumulee;

  // Montant final : possiblement mis à jour par le fallback brut
  if (montant === 0 && montantBrut > 0) montant = montantBrut;

  const lignesTravaux = lignesTableau.length > 0
    ? lignesTableau
    : lignesMotsCles.length > 0
      ? lignesMotsCles
      : lignesSequentielles.length > 0
        ? lignesSequentielles
        : lignesBrutes;

  // ── Badge qualité ─────────────────────────────────────────────
  const surfaceRetour = Math.round(surfaceFinale * 10) / 10;
  const score = (client ? 1 : 0) + (montant > 0 ? 1 : 0) + (surfaceRetour > 0 ? 1 : 0) + (lignesTravaux.length > 0 ? 1 : 0);
  const qualite = score >= 3 ? 'reussie' : score >= 1 ? 'partielle' : 'echec';

  return {
    client,
    montant: Math.round(montant * 100) / 100,
    surface: surfaceRetour,
    lignes: lignesTravaux,
    texteBrut: texte.replace(/---\s*Page\s*\d+\s*---/g, '').trim().substring(0, 500),
    qualite,
    score,
  };
};

export default function ImportPDF({ parametres, onCreerDevis, onCreerChantier, onCreerMetrage }) {
  const [etape, setEtape] = useState('upload');
  const [typePDF, setTypePDF] = useState('plans');
  const [chargement, setChargement] = useState(false);
  const [metres, setMetres] = useState([]);
  const [montants, setMontants] = useState([]);
  const [nomFichier, setNomFichier] = useState('');
  const [calculs, setCalculs] = useState(null);
  const [analyse, setAnalyse] = useState(null);
  const fileRef = useRef();

  // PARAMÈTRES CALCUL
  const [tauxMO, setTauxMO] = useState(35);
  const [rendement, setRendement] = useState(8);
  const [tarifJour, setTarifJour] = useState(350);
  const [margeCible, setMargeCible] = useState(25);
  const [tauxFraisGen, setTauxFraisGen] = useState(12);

  const lirePDF = async (fichier) => {
    setChargement(true);
    setNomFichier(fichier.name);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

      const arrayBuffer = await fichier.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let texteComplet = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          // Regrouper les items par position Y visuelle (tolérance 2 pts)
          // item.transform = [scaleX, skewX, skewY, scaleY, posX, posY]
          const buckets = new Map();
          for (const item of content.items) {
            if (!item.str) continue;
            const y = item.transform ? Math.round(item.transform[5] / 2) * 2 : 0;
            if (!buckets.has(y)) buckets.set(y, []);
            buckets.get(y).push({ x: item.transform ? item.transform[4] : 0, str: item.str });
          }

          // Trier les buckets de haut en bas (Y décroissant dans PDF = haut de page)
          const lignesPage = [...buckets.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, items]) =>
              items
                .sort((a, b) => a.x - b.x)   // gauche → droite
                .map(it => it.str.trim())
                .filter(Boolean)
                .join(' ')
            )
            .filter(Boolean);

          if (lignesPage.length) texteComplet += `\n--- Page ${i} ---\n${lignesPage.join('\n')}`;
        } catch (pageErr) {
          console.warn(`Page ${i} illisible, ignorée.`, pageErr);
        }
      }

      // Analyse unifiée — toujours appelée, même si texteComplet est vide
      const donnees = extraireDonneesPDF(texteComplet);
      setAnalyse(donnees);

      if (typePDF === 'plans') {
        setMetres(texteComplet ? detecterMetres(texteComplet) : []);
        setEtape('metres');
      } else if (typePDF === 'devis') {
        setMontants(texteComplet ? detecterMontants(texteComplet) : []);
        setEtape('montants');
      } else {
        setMetres(texteComplet ? detecterMetres(texteComplet) : []);
        setMontants(texteComplet ? detecterMontants(texteComplet) : []);
        setEtape('metres');
      }
    } catch (err) {
      // PDF illisible ou corrompu : on affiche quand même une analyse vide
      console.warn('PDF non lisible:', err);
      setAnalyse({ client: '', montant: 0, surface: 0, lignes: [], texteBrut: '', qualite: 'echec', score: 0 });
      setMetres([]);
      setMontants([]);
      setEtape(typePDF === 'devis' ? 'montants' : 'metres');
    }

    setChargement(false);
  };

  const calculerDepuisMetres = () => {
    const metresValides = metres.filter(m => m.actif !== false);
    const surfaceTotal = metresValides.filter(m => m.unite === 'm²').reduce((t, m) => t + m.valeur, 0);
    const mlTotal = metresValides.filter(m => m.unite === 'ml').reduce((t, m) => t + m.valeur, 0);
    const unitesTotal = metresValides.filter(m => m.unite === 'unité' || m.unite === 'pièce').reduce((t, m) => t + m.valeur, 0);

    const joursNecessaires = Math.ceil((surfaceTotal / rendement) + (mlTotal / (rendement * 2)) + (unitesTotal * 0.5));
    const coutMO = joursNecessaires * tarifJour;
    const coutMateriel = surfaceTotal * tauxMO;
    const coutTotal = coutMO + coutMateriel;
    const fraisGen = coutTotal * (tauxFraisGen / 100);
    const coutRevient = coutTotal + fraisGen;
    const prixVente = coutRevient / (1 - margeCible / 100);
    const marge = prixVente - coutRevient;

    setCalculs({
      surfaceTotal, mlTotal, unitesTotal, joursNecessaires,
      coutMO, coutMateriel, coutTotal, fraisGen, coutRevient,
      prixVente, marge, margePct: margeCible
    });
    setEtape('calculs');
  };

  const calculerDepuisMontants = () => {
    const montantsInclus = montants.filter(m => m.inclus);
    const totalFournisseur = montantsInclus.reduce((t, m) => t + m.valeur, 0);
    const fraisGen = totalFournisseur * (tauxFraisGen / 100);
    const coutRevient = totalFournisseur + fraisGen;
    const prixVente = coutRevient / (1 - margeCible / 100);
    const marge = prixVente - coutRevient;

    setCalculs({
      totalFournisseur, fraisGen, coutRevient,
      prixVente, marge, margePct: margeCible,
      nbMontants: montantsInclus.length,
    });
    setEtape('calculs');
  };

  const modifierMetre = (id, champ, valeur) => {
    setMetres(metres.map(m => m.id === id ? { ...m, [champ]: valeur } : m));
  };

  const modifierMontant = (id, champ, valeur) => {
    setMontants(montants.map(m => m.id === id ? { ...m, [champ]: valeur } : m));
  };

  const ajouterMetre = () => {
    setMetres([...metres, { id: Date.now(), description: '', valeur: 0, unite: 'm²', confiance: 'manuelle', actif: true }]);
  };

  const ajouterMontant = () => {
    setMontants([...montants, { id: Date.now(), description: '', valeur: 0, type: 'autre', inclus: true, confiance: 'manuelle' }]);
  };

  const couleurConfiance = (c) => c === 'haute' ? C.secondaire : c === 'moyenne' ? C.warning : C.info;

  return (
    <div>
      <div className="page-title-main" style={{ marginBottom: 6 }}>Import & Analyse PDF</div>

      {/* ÉTAPES */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '25px' }}>
        {[
          { id: 'upload', label: '1. Import PDF' },
          { id: 'metres', label: '2. Métrés' },
          { id: 'montants', label: '3. Montants' },
          { id: 'calculs', label: '4. Calculs' },
        ].map((e, i) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ background: etape === e.id ? '#3b82f6' : ['upload', 'metres', 'montants', 'calculs'].indexOf(etape) > i ? C.secondaire : 'var(--border)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
              {['upload', 'metres', 'montants', 'calculs'].indexOf(etape) > i ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '13px', color: etape === e.id ? '#3b82f6' : 'var(--text-secondary)', fontWeight: etape === e.id ? 'bold' : 'normal' }}>{e.label}</span>
            {i < 3 && <div style={{ width: '30px', height: '2px', background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* ===== ÉTAPE 1 : UPLOAD ===== */}
      {etape === 'upload' && (
        <div style={carteStyle}>
          <div className="ds-card-title">Importer votre PDF</div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Type de document</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { id: 'plans', label: 'Plans / Métrés', desc: 'Plans d\'architecte avec surfaces et dimensions' },
                { id: 'devis', label: 'Devis fournisseur', desc: 'Devis avec montants et prix' },
                { id: 'les_deux', label: 'Les deux', desc: 'Document mixte avec métrés et montants' },
              ].map(t => (
                <div key={t.id} onClick={() => setTypePDF(t.id)}
                  style={{ flex: 1, background: typePDF === t.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${typePDF === t.id ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', padding: '15px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s' }}>
                  <div style={{ fontSize: '20px', marginBottom: '5px' }}>{t.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div onClick={() => fileRef.current?.click()}
            style={{ border: '3px dashed #3b82f6', borderRadius: '16px', padding: '50px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-hover)', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px', color: 'var(--text-muted)' }}>↑</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Cliquez pour sélectionner un PDF</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ou glissez-déposez votre fichier ici</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>Formats acceptés : PDF texte (pas scanné)</div>
          </div>

          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && lirePDF(e.target.files[0])} />

          {chargement && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>...</div>
              <div style={{ fontWeight: 700 }}>Lecture du PDF en cours...</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '5px' }}>Extraction et analyse du texte</div>
            </div>
          )}

          <div style={{ marginTop: '20px', background: 'var(--bg-hover)', border: `1px solid var(--border)`, borderRadius: '8px', padding: '12px' }}>
            <strong style={{ color: C.warning }}>Conseil :</strong> Pour de meilleurs résultats, utilisez des PDF avec du texte sélectionnable (pas des scans ou images). Les PDFs générés par logiciels CAO ou Excel fonctionnent parfaitement.
          </div>
        </div>
      )}

      {/* ===== ÉTAPE 2 : MÉTRÉS ===== */}
      {etape === 'metres' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <button onClick={() => setEtape('upload')} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Retour</button>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#3b82f6' }}>{nomFichier}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '10px' }}>{metres.length} métrés détectés</span>
            </div>
            <button onClick={ajouterMetre} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>+ Ajouter</button>
            <button onClick={calculerDepuisMetres} style={{ ...DS.btnPrimary }}>
              Calculer →
            </button>
          </div>

          {/* PARAMÈTRES */}
          <div style={carteStyle}>
            <div className="ds-section-label" style={{ marginTop: 0 }}>Paramètres de calcul</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
              {[
                { label: 'Matériel CHF/m²', val: tauxMO, set: setTauxMO },
                { label: 'Rendement m²/jour', val: rendement, set: setRendement },
                { label: 'Tarif jour (CHF)', val: tarifJour, set: setTarifJour },
                { label: 'Marge cible (%)', val: margeCible, set: setMargeCible },
                { label: 'Frais généraux (%)', val: tauxFraisGen, set: setTauxFraisGen },
              ].map(s => (
                <div key={s.label}>
                  <label style={labelStyle}>{s.label}</label>
                  <input type="number" value={s.val} onChange={e => s.set(parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, fontWeight: 700, color: '#10b981', borderColor: '#10b981' }} />
                </div>
              ))}
            </div>
          </div>

          {/* TABLEAU MÉTRÉS */}
          <div style={carteStyle}>
            <div className="ds-section-label" style={{ marginTop: 0 }}>Métrés extraits — Vérifiez et corrigez</div>

            {metres.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '32px', color: 'var(--text-muted)' }}>⋯</div>
                <div>Aucun métré détecté automatiquement</div>
                <div style={{ fontSize: '13px', marginTop: '5px' }}>Ajoutez manuellement vos métrés avec le bouton "+ Ajouter"</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['✓', 'Description', 'Valeur', 'Unité', 'Confiance', 'Texte original', ''].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metres.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: m.actif === false ? 0.4 : 1 }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={m.actif !== false}
                          onChange={e => modifierMetre(m.id, 'actif', e.target.checked)} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input value={m.description} onChange={e => modifierMetre(m.id, 'description', e.target.value)}
                          style={{ ...inputStyle, width: '200px', padding: '4px 8px' }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={m.valeur} onChange={e => modifierMetre(m.id, 'valeur', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: '80px', padding: '4px 8px', fontWeight: 700 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <select value={m.unite} onChange={e => modifierMetre(m.id, 'unite', e.target.value)}
                          style={{ ...inputStyle, width: '80px', padding: '4px 8px' }}>
                          {['m²', 'ml', 'm', 'unité', 'pièce'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: couleurConfiance(m.confiance) + '22', color: couleurConfiance(m.confiance), fontWeight: 700, padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                          {m.confiance}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.texteOriginal}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => setMetres(metres.filter(x => x.id !== m.id))}
                          style={{ ...DS.btnDanger, padding: '4px 10px', fontSize: '12px' }}>Suppr</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* RÉSUMÉ MÉTRÉS */}
            {metres.filter(m => m.actif !== false).length > 0 && (
              <div style={{ display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Total m²', val: metres.filter(m => m.actif !== false && m.unite === 'm²').reduce((t, m) => t + m.valeur, 0).toFixed(1), unite: 'm²', couleur: '#10b981' },
                  { label: 'Total ml', val: metres.filter(m => m.actif !== false && m.unite === 'ml').reduce((t, m) => t + m.valeur, 0).toFixed(1), unite: 'ml', couleur: C.info },
                  { label: 'Total unités', val: metres.filter(m => m.actif !== false && (m.unite === 'unité' || m.unite === 'pièce')).reduce((t, m) => t + m.valeur, 0), unite: 'u', couleur: C.violet },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-hover)', border: `2px solid ${s.couleur}`, borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: s.couleur }}>{s.val} {s.unite}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {typePDF === 'les_deux' && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setEtape('montants')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px' }}>
                Continuer vers les montants →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== ÉTAPE 3 : MONTANTS ===== */}
      {etape === 'montants' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <button onClick={() => setEtape(typePDF === 'les_deux' ? 'metres' : 'upload')} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Retour</button>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#3b82f6' }}>{nomFichier}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '10px' }}>{montants.length} montants détectés</span>
            </div>
            <button onClick={ajouterMontant} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>+ Ajouter</button>
            <button onClick={calculerDepuisMontants} style={{ ...DS.btnPrimary }}>
              Calculer →
            </button>
          </div>

          {/* PARAMÈTRES */}
          <div style={carteStyle}>
            <div className="ds-section-label" style={{ marginTop: 0 }}>Paramètres</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><label style={labelStyle}>Marge cible (%)</label>
                <input type="number" value={margeCible} onChange={e => setMargeCible(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, fontWeight: 700, color: '#10b981', borderColor: '#10b981' }} /></div>
              <div><label style={labelStyle}>Frais généraux (%)</label>
                <input type="number" value={tauxFraisGen} onChange={e => setTauxFraisGen(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, fontWeight: 700, color: '#10b981', borderColor: '#10b981' }} /></div>
            </div>
          </div>

          {/* TABLEAU MONTANTS */}
          <div style={carteStyle}>
            <div className="ds-section-label" style={{ marginTop: 0 }}>Montants extraits — Vérifiez et corrigez</div>

            {montants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '32px', color: 'var(--text-muted)' }}>⋯</div>
                <div>Aucun montant détecté automatiquement</div>
                <div style={{ fontSize: '13px', marginTop: '5px' }}>Ajoutez manuellement vos montants avec le bouton "+ Ajouter"</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['✓', 'Description', 'Montant (CHF)', 'Type', 'Confiance', ''].map(h => (
                      <th key={h} style={DS.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {montants.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: !m.inclus ? 0.4 : 1 }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={m.inclus}
                          onChange={e => modifierMontant(m.id, 'inclus', e.target.checked)} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input value={m.description} onChange={e => modifierMontant(m.id, 'description', e.target.value)}
                          style={{ ...inputStyle, width: '250px', padding: '4px 8px' }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={m.valeur} onChange={e => modifierMontant(m.id, 'valeur', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: '120px', padding: '4px 8px', fontWeight: 700 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <select value={m.type} onChange={e => modifierMontant(m.id, 'type', e.target.value)}
                          style={{ ...inputStyle, width: '130px', padding: '4px 8px' }}>
                          {['total', 'sous-total', 'matériel', 'main d\'œuvre', 'forfait', 'tva', 'autre'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: couleurConfiance(m.confiance) + '22', color: couleurConfiance(m.confiance), fontWeight: 700, padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                          {m.confiance}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => setMontants(montants.filter(x => x.id !== m.id))}
                          style={{ ...DS.btnDanger, padding: '4px 10px', fontSize: '12px' }}>Suppr</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* RÉSUMÉ */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <div style={{ background: 'var(--bg-hover)', border: '2px solid #10b981', borderRadius: '10px', padding: '12px 20px', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total fournisseur sélectionné</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981' }}>
                  CHF {montants.filter(m => m.inclus).reduce((t, m) => t + m.valeur, 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg-hover)', border: `2px solid ${C.secondaire}`, borderRadius: '10px', padding: '12px 20px', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Prix de vente suggéré</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: C.secondaire }}>
                  CHF {Math.round(montants.filter(m => m.inclus).reduce((t, m) => t + m.valeur, 0) * (1 + tauxFraisGen / 100) / (1 - margeCible / 100)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ÉTAPE 4 : CALCULS ===== */}
      {etape === 'calculs' && calculs && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setEtape(typePDF === 'devis' ? 'montants' : 'metres')} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Retour</button>
            <button onClick={() => setEtape('upload')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Nouveau PDF</button>
          </div>

          {/* RÉSULTAT PRINCIPAL */}
          <div style={{ ...carteStyle, borderTop: '5px solid #3b82f6' }}>
            <div className="ds-card-title">Résultats de l'analyse</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Fichier : {nomFichier}</div>

            {/* RÉSUMÉ EXTRACTION + BADGE */}
            {analyse && (
              <div style={{ marginBottom: '20px', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: analyse.qualite === 'reussie' ? 'rgba(16,185,129,0.12)' : analyse.qualite === 'partielle' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{analyse.qualite === 'reussie' ? '✓' : analyse.qualite === 'partielle' ? '~' : '✗'}</span>
                  <span style={{ fontWeight: 700, color: analyse.qualite === 'reussie' ? '#10b981' : analyse.qualite === 'partielle' ? '#f59e0b' : '#ef4444' }}>
                    Analyse {analyse.qualite === 'reussie' ? 'réussie' : analyse.qualite === 'partielle' ? 'partielle' : 'incomplète'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{analyse.score}/4 données trouvées</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)' }}>
                  {[
                    { label: 'Client', val: analyse.client || '—', color: analyse.client ? 'var(--text-primary)' : 'var(--text-muted)' },
                    { label: 'Montant', val: analyse.montant > 0 ? `CHF ${analyse.montant.toLocaleString('fr-CH')}` : '—', color: analyse.montant > 0 ? '#10b981' : 'var(--text-muted)' },
                    { label: 'Surface', val: analyse.surface > 0 ? `${analyse.surface} m²` : '—', color: analyse.surface > 0 ? '#3b82f6' : 'var(--text-muted)' },
                    { label: 'Postes', val: analyse.lignes.length > 0 ? `${analyse.lignes.length} poste${analyse.lignes.length > 1 ? 's' : ''}` : '—', color: analyse.lignes.length > 0 ? '#8b5cf6' : 'var(--text-muted)' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--bg-card)', padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.val}</div>
                    </div>
                  ))}
                </div>
                {analyse.lignes.length > 0 && (
                  <div style={{ background: 'var(--bg-hover)', padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {analyse.lignes.map((l, i) => (
                      <span key={i} style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{l.description.split(' ').slice(0, 3).join(' ')}</span>
                    ))}
                  </div>
                )}
                {analyse.texteBrut && (
                  <div style={{ background: 'var(--bg-card)', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Extrait texte brut</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', lineHeight: 1.5 }}>
                      {analyse.texteBrut.substring(0, 300)}{analyse.texteBrut.length > 300 ? '…' : ''}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASCADE FINANCIÈRE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
              {calculs.surfaceTotal !== undefined && (
                <>
                  <div style={{ background: 'rgba(51,130,194,0.12)', borderRadius: '10px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                    <span>Surfaces totales</span>
                    <strong style={{ color: '#10b981' }}>{calculs.surfaceTotal.toFixed(1)} m² + {calculs.mlTotal.toFixed(1)} ml + {calculs.unitesTotal} unités</strong>
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.12)', borderRadius: '10px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                    <span>Jours de travail estimés</span>
                    <strong style={{ color: C.violet }}>{calculs.joursNecessaires} jours ouvrables</strong>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                    <span>Coût main d'œuvre</span>
                    <strong style={{ color: C.warning }}>CHF {Math.round(calculs.coutMO).toLocaleString()}</strong>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                    <span>Coût matériel estimé</span>
                    <strong style={{ color: C.warning }}>CHF {Math.round(calculs.coutMateriel).toLocaleString()}</strong>
                  </div>
                </>
              )}
              {calculs.totalFournisseur !== undefined && (
                <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                  <span>Total devis fournisseur ({calculs.nbMontants} postes)</span>
                  <strong style={{ color: C.warning }}>CHF {Math.round(calculs.totalFournisseur).toLocaleString()}</strong>
                </div>
              )}
              <div className="alert-banner alert-banner-warning" style={{ justifyContent: 'space-between' }}>
                <span>Frais généraux ({tauxFraisGen}%)</span>
                <strong style={{ color: C.danger }}>CHF {Math.round(calculs.fraisGen).toLocaleString()}</strong>
              </div>
              <div className="alert-banner alert-banner-danger" style={{ justifyContent: 'space-between' }}>
                <strong>Prix de revient total</strong>
                <strong style={{ color: C.danger, fontSize: '18px' }}>CHF {Math.round(calculs.coutRevient).toLocaleString()}</strong>
              </div>
            </div>

            {/* PRIX DE VENTE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '25px' }}>
              {[
                { label: 'Prix minimum', val: Math.round(calculs.coutRevient * 1.1), desc: 'Marge 10% — Risqué', couleur: C.danger, bg: 'rgba(239,68,68,0.09)' },
                { label: 'Prix conseillé', val: Math.round(calculs.prixVente), desc: `Marge ${calculs.margePct}% — Recommandé`, couleur: C.secondaire, bg: 'rgba(16,185,129,0.12)' },
                { label: 'Prix premium', val: Math.round(calculs.prixVente * 1.15), desc: 'Marge +15% — Haut de gamme', couleur: C.violet, bg: 'rgba(139,92,246,0.12)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `3px solid ${s.couleur}`, borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: s.couleur, marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: s.couleur }}>CHF {s.val.toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>{s.desc}</div>
                  {calculs.surfaceTotal > 0 && (
                    <div style={{ fontSize: '12px', color: s.couleur, marginTop: '5px', fontWeight: 700 }}>
                      CHF {(s.val / calculs.surfaceTotal).toFixed(0)}/m²
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* MARGE */}
            <div style={{ background: calculs.marge >= 0 ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.09)', border: `1px solid ${calculs.marge >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Marge estimée au prix conseillé</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: calculs.marge >= 0 ? C.secondaire : C.danger }}>
                CHF {Math.round(calculs.marge).toLocaleString()}
              </div>
              <div style={{ fontSize: '16px', color: calculs.marge >= 0 ? C.secondaire : C.danger }}>({calculs.margePct}%)</div>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={carteStyle}>
            <div className="ds-section-label" style={{ marginTop: 0 }}>Que voulez-vous faire avec ces résultats ?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <button onClick={() => {
                if (onCreerDevis) onCreerDevis({
                  montant: Math.round(calculs.prixVente),
                  surface: calculs.surfaceTotal || analyse?.surface || 0,
                  nombreJours: calculs.joursNecessaires || 0,
                  source: nomFichier,
                  client: analyse?.client || '',
                  lignes: analyse?.lignes || [],
                  notes: `Importé depuis PDF : ${nomFichier}`,
                });
              }} style={{ ...DS.btnPrimary, padding: '14px 24px', fontSize: '15px' }}>
                Créer un devis avec ces données
              </button>
              <button onClick={() => {
                const cb = onCreerMetrage || onCreerChantier;
                if (cb) cb({
                  surface: calculs.surfaceTotal || analyse?.surface || 0,
                  prixPropose: Math.round(calculs.prixVente),
                  notes: `Importé depuis PDF : ${nomFichier}`,
                  lignes: analyse?.lignes || [],
                });
              }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '20px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>
                Créer un métrage avec ces données
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
