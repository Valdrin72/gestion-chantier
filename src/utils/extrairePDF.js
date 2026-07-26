/**
 * Extraction de données depuis le texte d'un PDF (devis/soumission) : client,
 * montant total, surface, lignes de travaux, + un badge qualité.
 * Fonction PURE (aucune dépendance UI). Extraite de l'ancien écran ImportPDF —
 * réutilisée par la soumission assistée de devis.
 */
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
