---
name: faux-plafond-metrage
description: Skill métrés faux-plafonds — calculs de surfaces, quantités de dalles et ossatures pour faux-plafonds modulaires et en plaques BA13. Invoque avec /faux-plafond-metrage pour chiffrer un faux-plafond.
---

# Faux-Plafond — Métrés CYNA

## Types de faux-plafonds
| Type | Description | Usage |
|------|-------------|-------|
| Modulaire dalles | Dalles 600×600 ou 600×1200 mm | Bureaux, open space |
| BA13 bande à joint | Plaques plâtre sur ossature | Appartements, couloirs |
| BA13 coupe-feu | EI30/EI60 | Cages d'escalier, parkings |
| Acoustique | Dalles minérales ou fibre | Salles de conf, resto |
| Décoratif | Plâtre projeté, lambris | Résidentiel |

## Formules de calcul

### Surface nette
```
Surface = L × l
Déductions obligatoires :
  - Poteaux > 0.10 m² : déduire
  - Gaines techniques fixes : déduire
  - Escaliers, vides : déduire
NB: Fenêtres et portes NE se déduisent PAS (plafond ≠ mur)
```

### Dalles modulaires 600×600
```
Dalles brutes = Surface / 0.36
Chutes = +10% (pièces standard), +15% (formes complexes), +20% (circulaire)
Dalles commandées = Dalles brutes × (1 + chutes%)
```

### Ossature suspendue (T47/T24)
```
Profils principaux (T15 ou T24) : tous les 120 cm → L/1.20 × l
Profils secondaires (T47 ou nonius) : tous les 60 cm → L × l / 0.60
Suspentes (fil ∅4mm) : tous les 90 cm² = Surface / 0.81
Profilés de rive : Périmètre × 1.05 (5% jonctions)
```

### BA13 plaques
```
Plaques 1200×2500 = 3.00 m²/plaque
Plaques brutes = Surface / 3.00
Chutes = +10% (coupe droite), +15% (découpes fenêtres, spots)
Vis : 20 vis/plaque (espacement 30 cm)
Bande à joint : 0.9 ml/m² de plaque
Enduit : 1.5 kg/m² (2 passes)
```

## Exemple calcul faux-plafond modulaire

```
Salle : 9.60 m × 6.00 m = 57.6 m²
Poteau central : 0.09 m² → 57.51 m² net
Dalles 600×600 : 57.51 / 0.36 = 160 → +10% = 176 dalles
Ossature T47 :
  - Profils 1200 : 57.51 / 1.20 × 1 = 49 profils
  - Profils 600 : 57.51 / 0.36 = 160 nonius
  - Suspentes : 57.51 / 0.81 = 72 pièces
  - Rive : (9.60+6.00)×2 × 1.05 = 33 ml
```

## Tarifs indicatifs Genève 2024
- Faux-plafond dalles minérales 600×600 : CHF 55–85/m² fourni posé
- BA13 simple : CHF 65–90/m² fourni posé
- BA13 coupe-feu EI60 : CHF 120–160/m² fourni posé
- Acoustique haute performance : CHF 95–160/m² fourni posé

## Postes de devis faux-plafond
1. Dépose plafond existant : X m²
2. Fourniture ossature suspendue : X m²
3. Fourniture dalles/plaques : X m²
4. Pose ossature et réglage : X m²
5. Pose dalles / bandes joints : X m²
6. Finitions, angles, découpes spots

## Ce que tu ne dois PAS faire
- Déduire les fenêtres et portes de la surface plafond (uniquement poteaux et vides)
- Oublier les chutes (varie selon la complexité du local)
- Confondre T47 (secondaires 600mm) et T15 (porteurs 1200mm)
- Ne pas inclure la rive périmétrique dans le bordereau
