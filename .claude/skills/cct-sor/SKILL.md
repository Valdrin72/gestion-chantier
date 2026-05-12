---
name: cct-sor
description: Skill CCT-SOR — référence rapide pour les conditions de travail du Second Œuvre Romand (heures, salaires minima, vacances, suppléments). Invoque avec /cct-sor pour toute question sur les droits des employés.
---

# CCT Second Œuvre Romand (SOR) — Skill CYNA

## Durée du travail
- **40h/semaine** (selon CCT-SOR en vigueur)
- 8h/jour — 1 heure = 0.125 jour
- Samedi : possible avec accord ou CCT sectorielle

## Heures supplémentaires
| Situation | Majoration |
|-----------|------------|
| Semaine (jusqu'à 2h/j sup.) | +25% |
| Samedi (selon accord) | +25% à +50% |
| Dimanche / jours fériés légaux | +50% |
| Travail de nuit (22h–6h) | +50% |
| Travail continu (3×8) | Selon accord |

## Salaires minima indicatifs 2024 (CHF/h)
| Catégorie | Min CHF/h |
|-----------|-----------|
| Manœuvre non qualifié | ≥ 22.70 |
| Ouvrier qualifié (CFC) | ≥ 25.80 |
| Chef d'équipe | ≥ 28.50 |
| Contremaître | ≥ 32.00 |

> Ces montants sont indicatifs — consulter la CCT en vigueur pour les valeurs exactes.

## Vacances
- **5 semaines/an** pour tous les employés
- **5 semaines** pour < 20 ans et ≥ 50 ans
- Report limité : maximum 1 an

## Indemnités et frais
| Frais | Règle |
|-------|-------|
| Déplacement | CHF/km ou abonnement selon distance |
| Repas hors siège | Indemnité journalière (≈ CHF 15–25) |
| Découchage | Indemnité nuit (≈ CHF 60–80) |
| EPI (équipements) | À la charge de l'employeur |

## Implications calcul coût MO dans CYNA

```js
// Taux de base (heures normales)
const coutHeure = tarifJour / 8;

// Heures supplémentaires semaine
const coutHeureSup = coutHeure * 1.25;

// Heures dimanche/férié
const coutHeureFerie = coutHeure * 1.50;

// Vérifier : tarifJour doit être au moins 8 × tarifMin
const tarifMinJour = 22.70 * 8; // CHF 181.60 pour non qualifié
```

## Ce que tu ne dois PAS faire
- Fixer un tarif journalier sous les minima CCT
- Oublier les majorations pour les dimanches et jours fériés GE
- Calculer les vacances à 4 semaines (minimum légal dépassé par CCT = 5 semaines)
