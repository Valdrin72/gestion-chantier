---
name: faux-plancher-metrage
description: Skill métrés faux-planchers techniques — calculs de surfaces, hauteurs de vide, quantités de panneaux et structures pour planchers surélevés. Invoque avec /faux-plancher-metrage pour chiffrer un faux-plancher.
---

# Faux-Plancher Technique — Métrés CYNA

## Types de faux-planchers
| Type | Usage | Vide standard |
|------|-------|---------------|
| Accès câblage simple | Bureaux, salles techniques | 10–15 cm |
| Accès complet | Salles informatiques | 20–40 cm |
| Ventilation sous-sol | Data centers | 40–80 cm |
| Structurel | Grandes surfaces | > 80 cm |

## Formules de calcul

### Surface nette
```
Surface brute = L × l (dimensions extérieures de la pièce)
Déductions = poteaux structurels + gaines fixes
Surface nette = Surface brute − Déductions
```

### Périphérie (plinthes/joints)
```
Périmètre = 2 × (L + l) − largeur_ouvertures
```

### Quantité panneaux
```
Format standard : 600×600 mm (0.36 m²/panneau)
Format courant : 600×1200 mm (0.72 m²/panneau)
Panneaux bruts = Surface / format_panneau
Chutes + coupe = +8% (pose orthogonale), +12% (pose diagonale)
Panneaux commandés = Panneaux bruts × (1 + chutes)
```

### Structure support (piédestaux)
```
Densité standard : 1 piédestal par 0.36 m² (maille 600×600)
Nb piédestaux = Surface × (1 / 0.36) = Surface × 2.78
Arrondi au supérieur
```

### Lisses de renfort (si vide > 30 cm)
```
Lisses = Périmètre / 0.6 (une lisse tous les 60 cm en périphérie)
```

## Exemple de calcul

```
Salle : 12.00 m × 8.50 m = 102 m² brut
Poteaux : 4 × 0.25 m² = 1 m²
Surface nette : 101 m²
Panneaux 600×600 : 101 / 0.36 = 281 → + 8% = 303 panneaux
Piédestaux : 101 × 2.78 = 281 pièces
```

## Postes de devis faux-plancher
1. Dépose existant (si rénovation) : X m²
2. Fourniture panneaux : X m² à CHF/m²
3. Fourniture structure : X u à CHF/u
4. Pose structure et réglage : X m² à CHF/m²
5. Pose panneaux et découpe : X m² à CHF/m²
6. Finitions : dalles de remplissage, joints périmètre

## Tarifs indicatifs Genève 2024
- Faux-plancher accès câblage (h=15cm) : CHF 85–120/m² fourni posé
- Faux-plancher accès complet (h=30cm) : CHF 120–180/m² fourni posé
- Data center (h≥40cm) : CHF 180–280/m² fourni posé

## Ce que tu ne dois PAS faire
- Oublier les chutes dans les quantités commandées
- Sous-estimer le nombre de piédestaux (densité dépend du type de panneau)
- Ne pas déduire les poteaux de la surface
- Confondre surface brute et surface nette
