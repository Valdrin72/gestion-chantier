import { CYNA_PARAMS } from './constants.js';
import { coeffVente } from './marges.js';

export function pricingPoste({ designation, unite, quantite, coutMatUnit, tempsH, coutHMO, coeffMat, marqueMatPct, marqueMOPct }) {
  const kMat = coeffMat ?? CYNA_PARAMS.COEFF_ACHAT_MAT;
  const marqueMatCible = (marqueMatPct ?? 22) / 100;
  const marqueMOCible = (marqueMOPct ?? 5) / 100;

  const coutMat = quantite * coutMatUnit * kMat;
  const coutMO = quantite * tempsH * coutHMO;
  const coutTotal = coutMat + coutMO;

  const pvMat = coutMat * coeffVente(marqueMatCible);
  const pvMO = coutMO * coeffVente(marqueMOCible);
  const pvHT = pvMat + pvMO;

  const margeAbsolue = pvHT - coutTotal;
  const margeBrute = pvHT > 0 ? margeAbsolue / pvHT : 0;

  return { designation, unite, quantite, coutMat, coutMO, coutTotal, pvMat, pvMO, pvHT, margeAbsolue, margeBrute };
}

export function calculerDevisGlobal(postes, tauxTVA) {
  const tva = tauxTVA ?? CYNA_PARAMS.TVA;
  const totalHT = postes.reduce((s, p) => s + p.pvHT, 0);
  const coutTotal = postes.reduce((s, p) => s + p.coutTotal, 0);
  const margeBrute = totalHT - coutTotal;
  const margeBrutePourcent = totalHT > 0 ? margeBrute / totalHT : 0;
  const montantTVA = totalHT * tva;
  const totalTTC = totalHT + montantTVA;
  return { postes, totalHT, tva: montantTVA, totalTTC, coutTotal, margeBrute, margeBrutePourcent };
}
