---
name: productivite-cyna
description: Skill productivité CYNA — ratios de production BTP pour estimer les heures nécessaires par type de travaux (faux-plafonds, faux-planchers, carrelage, peinture). Invoque avec /productivite-cyna pour chiffrer la main d'œuvre.
---

# Productivité BTP — Référentiel CYNA SÀRL

## Ratios de production (heures/m² ou heures/unité)

### Faux-plafond modulaire (dalles 600×600)
| Opération | H/m² | Conditions |
|-----------|------|------------|
| Pose ossature + réglage | 0.40 h/m² | Sol libre, hauteur normale |
| Pose dalles standard | 0.25 h/m² | Dalles standard |
| Pose dalles avec découpes | 0.40 h/m² | Nombreux spots/trappes |
| Dépose existant | 0.15 h/m² | Sans déchets dangereux |
| **Total pose complète** | **0.65 h/m²** | Conditions normales |

### Faux-plancher technique (h=15-30cm)
| Opération | H/m² | Conditions |
|-----------|------|------------|
| Pose piédestaux + réglage | 0.50 h/m² | Première pose |
| Pose panneaux | 0.20 h/m² | Sans découpes |
| Découpes et finitions | 0.10 h/m² | Standard |
| **Total pose complète** | **0.80 h/m²** | H=15-30cm |

### BA13 (plaques plâtre)
| Opération | H/m² | Conditions |
|-----------|------|------------|
| Ossature métal | 0.45 h/m² | Simple |
| Pose plaques | 0.30 h/m² | 1 couche |
| Bandes et enduits (2 passes) | 0.40 h/m² | Finition peinte |
| **Total complet** | **1.15 h/m²** | Prêt à peindre |

### Peinture intérieure
| Opération | H/m² | Conditions |
|-----------|------|------------|
| Préparation surface | 0.10 h/m² | Bon état |
| Application fond + finition | 0.15 h/m² | Rouleau |
| Application brosse (encadrements) | 0.30 h/ml | |

### Carrelage
| Opération | H/m² | Conditions |
|-----------|------|------------|
| Préparation / ragréage | 0.20 h/m² | Sol plan |
| Pose carrelage format ≤ 30×30 | 0.80 h/m² | Pose droite |
| Pose carrelage 60×60 | 0.70 h/m² | |
| Pose diagonale | +20% | Sur le ratio de pose |
| Jointoiement | 0.15 h/m² | |

## Calcul heures totales

```js
// Formule
const heuresTotales = surface * ratioHParM2;
const joursOuvriers = heuresTotales / 8;

// Exemple : 200 m² faux-plafond modulaire
// heures = 200 × 0.65 = 130h
// jours = 130 / 8 = 16.25 jours
// Avec 2 ouvriers : 8.1 jours chantier
```

## Facteurs de correction

| Facteur | Correction |
|---------|-----------|
| Hauteur > 3.5m (échafaudage) | +20% |
| Local exigu (couloir < 1.5m) | +30% |
| Découpes nombreuses (> 20% surface) | +15% |
| Rénovation (démontage avant) | +15 à 30% |
| Grand chantier répétitif (> 500m²) | −10% (gain habitude) |

## Ce que tu ne dois PAS faire
- Utiliser ces ratios sans les ajuster aux conditions réelles
- Oublier les facteurs de correction pour les travaux difficiles
- Négliger le temps de préparation et de nettoyage (≈ 10% du temps total)
- Sous-estimer les petits travaux et reprises (toujours plus long que prévu)
