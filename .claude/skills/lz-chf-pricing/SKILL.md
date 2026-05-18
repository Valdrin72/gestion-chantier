---
name: lz-chf-pricing
description: Skill pricing CHF Le Lézard — logique prix streetwear premium suisse, marges, psychologie, alignement marché. Invoque avec /lz-chf-pricing pour fixer ou auditer un prix produit.
---

# Pricing CHF — Skill Le Lézard

## Position prix Le Lézard

**Streetwear premium accessible** :
- Au-dessus des grandes chaînes (H&M, Zara, COS)
- Au niveau de Norse Projects, Drôle de Monsieur, Adsum
- En dessous de Acne Studios, Lemaire, The Frankie Shop entry

**Cible pricing** : sweet spot 39-89 CHF (l'essentiel du catalogue).

## Grille prix recommandée — CHF

| Catégorie | Min | Cible | Max | Premium |
|-----------|-----|-------|-----|---------|
| T-shirt basic | 25 | 29-39 | 45 | 49-59 |
| T-shirt imprimé | 29 | 39-49 | 55 | 59-69 |
| Polo | 39 | 49-59 | 65 | 69-79 |
| Sweatshirt | 39 | 49-69 | 79 | 89-99 |
| Hoodie | 59 | 69-89 | 99 | 109-129 |
| Pantalon | 39 | 49-69 | 79 | 89-129 |
| Short | 29 | 39-49 | 59 | 69-79 |
| Veste légère | 49 | 69-89 | 99 | 109-129 |
| Veste lourde | 89 | 109-149 | 179 | 189-249 |
| Maillot WC2026 | 89 | 119 | 139 | 149 |
| Casquette | 29 | 35-45 | 55 | 59-69 |
| Accessoire | 19 | 25-39 | 49 | 59-79 |
| Mystery Box | 79 | 89-119 | 149 | – |

## Règles de pricing

### Toujours

- **Prix en CHF affiché** sans décimales superflues si `.00` (89 CHF, pas 89.00 CHF)
- **TVA incluse** par défaut (B2C suisse standard)
- **Multiples de 9** ou 5 préférés (29, 39, 49, 59, 69, 79, 89, 99, 119, 129)
- **Justification prix** dans description (matière, provenance, fabrication)
- **Vérifier marge brute** > 50% (idéalement 60-70%)

### Jamais

- **Prix barré** sauf période soldes légales déclarée
- **Promo "Achetez 2 = 1 gratuit"** (incohérent avec premium)
- **Prix sous 25 CHF** (positionnement cassé)
- **Cents .99** (89.99 = drugstore feel)
- **Prix différent FR vs EN** (boutique unique CH)

## Calcul prix de vente

### Formule indicative

```
Prix de vente = COGS × 4 (multiplicateur catégorie premium)

COGS = matière + fabrication + transport + emballage + douane
```

### Exemple — T-shirt coton Portugal

```
COGS estimés :
  Tissu coton 220g/m² × 1.5m         ~5 CHF
  Fabrication (couture, lavage)       ~4 CHF
  Étiquetage, packaging                ~1 CHF
  Transport (groupé Portugal→CH)       ~1 CHF
  Total COGS                          ~11 CHF

Prix vente cible : 11 × 3.5 = ~38 CHF
Recommandé : 39 CHF (multiple de 9)
Marge brute : (39 - 11) / 39 = 72%
```

### Exemple — Maillot football WC2026

```
COGS estimés :
  Tissu mesh sport recyclé             ~12 CHF
  Fabrication maillot (couture, finitions) ~10 CHF
  Crest brodé + numéro                  ~6 CHF
  Étiquetage + packaging spécial         ~3 CHF
  Transport                              ~2 CHF
  Total COGS                            ~33 CHF

Prix vente cible : 33 × 3.5 = ~115 CHF
Recommandé : 119 CHF (multiple de 9 + au-dessus mystery box premium 119)
Marge brute : (119 - 33) / 119 = 72%
```

## Psychologie prix Le Lézard

### Effet d'ancrage
- Mystery Box premium à 119 CHF crée un ancrage haut
- Lancer maillot WC2026 à 119 CHF ne paraît pas cher en relatif

### Sweet spot psychologique
- 29 CHF — entrée gamme, achat impulsif acceptable
- 49 CHF — pièce du vendredi soir, sans réflexion lourde
- 89 CHF — pièce statement, considérée mais accessible
- 119 CHF — pièce premium, achat raisonné
- 149+ — exception (veste hiver, édition spéciale)

### Mensuel / panier moyen cible
- AOV cible Le Lézard : **90+ CHF**
- AOV actuel à vérifier (`lz-analytics`)
- Stratégie cross-sell : pousser à 2 pièces (ex: t-shirt + casquette = 64 CHF, ou polo + short = 78 CHF)

## Soldes & discounts — règles strictes

### Autorisé
- **Soldes d'hiver** (janvier — déclaration cantonale Genève)
- **Soldes d'été** (juillet — déclaration cantonale)
- **Code créateur 10%** via ambassadeur (max 10%, tracking UTM)
- **Discount fin de série** (-15% sur tailles dormantes après 90 jours)
- **Bundle offre** (acheter 2 = -10%) — modéré, pas plus de 2x/an

### Interdit
- **Discount permanent** sur catalogue principal
- **Black Friday agressif** (-30% etc. — image cassée, à débattre — recommandation Le Lézard : -10% max ou skip)
- **Coupon code multiplicatif** ("PROMO15" toujours valide)
- **Soldes hors période légale**
- **Prix barré "ex 99 CHF → 79 CHF"** sans baisse réelle vérifiable

## Pricing par marché (à terme)

### Suisse (marché principal)
- Prix CHF avec TVA 8.1% incluse
- Livraison Swiss Post 7-9 CHF (offerte > 100 CHF)

### France / UE (à activer)
- Prix EUR ~équivalent CHF (taux changeant — fixe ~1.08 CHF = 1 EUR)
- TVA UE selon pays (gérée par Shopify)
- DDP (Delivered Duty Paid) si exporting depuis Suisse → frais douane gérés

### UK (à activer)
- Prix GBP ~équivalent (taux ~1.15 CHF = 1 GBP)
- VAT UK 20%
- Important pour Angleterre WC2026 (diaspora UK Suisse + UK direct)

## Audit prix actuels Le Lézard (sample)

| Produit | Prix actuel | Catégorie | Recommandation |
|---------|-------------|-----------|-----------------|
| Lucky Mystery Box | 119 CHF | Mystery Box | ✅ Aligné |
| Regular Mystery Box | 89 CHF | Mystery Box | ✅ Aligné |
| KW-balaclava | 40 CHF | Accessoire | ⚠️ Refaire titre + 45 CHF |
| KW-Pants | 60 CHF | Pantalon | ✅ Aligné |
| KW-Jacket | 80 CHF | Veste légère | ✅ Aligné |
| made in jungle scarf | 35 CHF | Accessoire | ✅ Aligné |
| P-polo | 39 CHF | Polo | ⚠️ Peut monter à 49 CHF |
| elegant-pants | 39 CHF | Pantalon | ⚠️ Peut monter à 49-59 CHF |
| elegant-halfzip | 49 CHF | Sweatshirt | ✅ Aligné |
| R-teeshirt | 29 CHF | T-shirt | ✅ Aligné (entry) |
| Jet d'eau tee | 29 CHF | T-shirt imprimé | ⚠️ Peut monter à 39 CHF (imprimé local exclusif) |
| P-short | 29 CHF | Short | ⚠️ Peut monter à 39 CHF |
| P-sweatshirt | 39 CHF | Sweatshirt | ⚠️ Peut monter à 49-59 CHF |
| V-pant / B-pant | 39 CHF | Pantalon | ⚠️ Peut monter à 49 CHF |
| L-teeshirt | 60 CHF | T-shirt | ⚠️ Très haut pour t-shirt — vérifier matière unique justifie |
| V-Jacket / B-Jacket | 49 CHF | Veste légère | ✅ Aligné |
| Tree-teeshirt | 60 CHF | T-shirt | ⚠️ Idem L-teeshirt |

> ⚠️ **Recommandation Valdrin** : audit pricing complet en réunion équipe.
> Plusieurs produits sous-valorisés (sweatshirt à 39 CHF, polo à 39 CHF).
> Une remontée prudente de +5-10 CHF pourrait améliorer la marge sans
> casser le volume — à tester progressif.

## Anti-patterns pricing

- 🔴 Tous les produits au même prix → manque de hiérarchie perçue
- 🔴 Discount permanent affiché → casse le premium
- 🔴 Prix décimaux .99 → cheap feel
- 🔴 Prix très bas sur produit premium → confusion positionnement
- 🟠 Prix incohérent entre catégories (polo plus cher que sweatshirt)
- 🟠 Trop d'écart entre min et max collection (effet "tout et n'importe quoi")
