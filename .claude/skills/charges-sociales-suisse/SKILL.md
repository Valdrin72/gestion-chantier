---
name: charges-sociales-suisse
description: Skill charges sociales suisses — taux exacts des cotisations employeur et employé pour Genève 2024 (AVS, AC, LAA, LPP, AF, IJM). Invoque avec /charges-sociales-suisse pour calculer le coût total d'un employé.
---

# Charges Sociales Suisses — Genève 2024

## Cotisations employeur (% du salaire brut)

| Assurance | Taux employeur | Remarque |
|-----------|---------------|---------|
| AVS (retraite) | 4.35% | Parité avec employé |
| AI (invalidité) | 0.70% | Parité |
| APG (allocations) | 0.25% | Parité |
| **AVS/AI/APG total** | **5.30%** | Sur tout le salaire |
| AC (chômage) | 1.10% | Plafond CHF 148'200/an |
| AC solidarité | 0.50% | Sur salaire > 148'200 |
| LAA professionnel | ~1.50% | Secteur construction |
| LAA non-professionnel | 1.11% | Payé par employeur |
| LPP (retraite complémentaire) | 9–18% | Selon âge et caisse |
| AF Genève | **2.94%** | Spécifique GE ! |
| IJM (maladie) | 1.50–2.50% | Selon assurance |

## Cotisations employé (à titre informatif)

| Assurance | Taux employé |
|-----------|-------------|
| AVS/AI/APG | 5.30% |
| AC | 1.10% |
| LPP | 9–18% (parité) |
| LAA non-pro | 0% (employeur) |

## Calcul coefficient MO CYNA

```js
// Charges minimales légales
const avs_ai_apg = 0.0530;    // 5.30%
const ac = 0.0110;             // 1.10%
const laa_pro = 0.0150;        // 1.50%
const laa_non_pro = 0.0111;    // 1.11%
const lpp_moyen = 0.1200;      // 12% (âge moyen 35-45 ans)
const af_ge = 0.0294;          // 2.94% Genève
const ijm = 0.0200;            // 2.00%

const totalChargesEmployeur = avs_ai_apg + ac + laa_pro + laa_non_pro + lpp_moyen + af_ge + ijm;
// ≈ 27.95% + vacances 5 sem (9.62%) = ~37.5%

// Coefficient final avec vacances et 13e
const coefficient = 1 + totalChargesEmployeur + 0.0962 + 0.0833;
// ≈ 1.39–1.42 pour BTP GE

// Coefficient simplifié CYNA par défaut : 1.35 (minimum)
// Coefficient recommandé : 1.40
```

## Allocations familiales Genève
- AF GE = 2.94% sur tout le salaire brut
- Montant : CHF 311/mois par enfant (0–15 ans), CHF 393 (15–25 ans études)
- CYNA verse les charges à la caisse de compensation

## Ce que tu ne dois PAS faire
- Oublier les AF GE de 2.94% (spécifique Genève, non prélevé ailleurs)
- Utiliser un coefficient < 1.30 (insuffisant pour Genève)
- Confondre LAA professionnel (employeur) et LAA non-professionnel (employeur aussi)
- Oublier les vacances dans le coefficient (9.62% pour 5 semaines)
