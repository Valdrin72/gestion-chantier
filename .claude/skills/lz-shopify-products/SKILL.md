---
name: lz-shopify-products
description: Skill structuration produits Shopify Le Lézard — naming, handles, variants, tags, SEO, conventions SKU. Invoque avec /lz-shopify-products avant de créer/modifier un produit sur lelezard.shop.
---

# Shopify Produits Le Lézard — conventions

## Nom de produit

### Format

```
[NOM DESCRIPTIF] · [DÉTAIL ÉDITION]
```

### Exemples bons

- `Polo Viscose · Bleu marine`
- `Jet d'eau Tee · Oversized`
- `Maillot Suisse · Édition Été 2026`
- `Three Lizards Jersey · Édition Été 2026`
- `Casquette Le Lézard FC · Suisse`

### Exemples mauvais (existants à corriger)

- `KW-Jacket` → `Veste Softshell · Kenzy X Le Lézard`
- `KW-Pants` → `Pantalon Softshell · Kenzy X Le Lézard`
- `KW-balaclava` → `Balaclava · Kenzy X Le Lézard`
- `P-polo` → `Polo Coton · Édition P-Collect`
- `R-teeshirt` → `T-shirt Coton · Coloris [Rose]`
- `B-pant` / `V-pant` → `Pantalon Viscose · Bleu` / `Pantalon Viscose · Vert`
- `made in jungle - scarf` → `Écharpe Jungle · Coton`

→ **Action recommandée** : audit + renommage homogène (action Valdrin requise).

## Handle (URL slug)

### Format

```
[nom-descriptif]-[detail]-[edition-si-pertinent]
```

### Règles

- lowercase, tirets, pas d'accents (transliteration)
- 3-5 mots max
- SEO friendly
- pas de préfixe interne ("kw-" → garder dans le naming externe, pas le slug)

### Exemples

- `polo-viscose-bleu-marine`
- `jet-eau-tee-oversized`
- `maillot-suisse-ete-2026`
- `three-lizards-jersey-ete-2026`
- `casquette-le-lezard-fc-suisse`

## Vendor

**Tous les produits doivent avoir `vendor: Le Lézard`.**

État actuel à corriger :
- `Mein Shop` (template Shopify par défaut) → **erreur** — corriger
- `K_Collect`, `V_Collect`, `B_Collect`, `P_Collect` → semble être des
  sous-collections mal placées en vendor — corriger en utilisant des **tags**
  pour la catégorisation interne (`tag: k-collect`, etc.)

## Type de produit

Toujours en français, parmi cette liste :

- Maillot
- T-shirt
- Polo
- Sweatshirt
- Hoodie
- Veste
- Pantalon
- Short
- Casquette
- Bonnet
- Balaclava
- Écharpe
- Chaussettes
- Accessoire
- Mystery Box
- Gift Card

## Tags

### Tags conventionnels

| Tag | Usage |
|-----|-------|
| `wc2026` | Tous produits WC2026 |
| `maillot` | Spécifique maillots de foot |
| `suisse` / `angleterre` / `bresil` / `france` | Pays |
| `edition-limitee` | Éditions limitées |
| `made-in-portugal` | Production Portugal |
| `viscose` / `coton` / `fleece` / `tricot` | Matières |
| `homme` / `femme` / `unisex` | Genre |
| `printemps-ete-2026` | Saison |
| `automne-hiver-2026` | Saison |
| `collab-kenzy` | Pour la collab actuelle |
| `mystery-box` | Catégorie box |
| `best-seller` | Manuel, à activer après confirmation analytics |
| `restock-imminent` | Pour smart collection "À venir" |

### Tags = source des smart collections

Toujours penser : "ce tag sera-t-il utile pour grouper automatiquement les produits ?"

## SKU — convention

```
LZ-[COLL]-[TYPE]-[COULEUR]-[TAILLE]
```

Exemples :
- `LZ-WC26-MAILLOT-SUI-M` (Le Lézard, WC2026, Maillot Suisse, taille M)
- `LZ-VISC-POLO-BLU-L` (Le Lézard, Viscose, Polo, Bleu, taille L)
- `LZ-FLEE-SWEAT-CRM-XL` (Le Lézard, Fleeco, Sweatshirt, Crème, XL)

Codes courts :
- Collection : WC26, VISC, FLEE, TRIC, KENZ, ACCE, MYST
- Pays/Couleur : SUI, ENG, BRE, FRA, BLU, VRT, RGE, CRM, ANTH, JAU, ORE
- Taille : XS, S, M, L, XL, XXL, ONE (one size), XSS / SM / ML / LXL (mystery box)

## Variants

### Pour les vêtements taillés

- XS, S, M, L, XL (5 tailles minimum)
- XXL ajouté si pertinent (sweats, vestes oversize)

### Pour Mystery Box

- XS-S / S-M / M-L / L-XL (4 ranges, comme existant)

### Pour accessoires

- One size (ONE) ou tailles spécifiques (casquettes ajustables ou tailles)

### Pour gift card

- 20 / 50 / 80 / 100 / 150 CHF

## Description produit — structure

```
[NOM PRODUIT · DÉTAIL ÉDITION]

[Phrase d'ouverture contextuelle — 1-2 lignes]

— Composition : [%]
— Fabriqué au [Portugal]
— Coupe : [oversized / regular / fitted]
— Lavage : [instructions]

[Optionnel — 2-3 lignes lifestyle si campagne]

Modèle porte une [taille], mesure [Xcm].
```

→ Confier la rédaction à `lz-copywriter` puis copier dans Shopify.

## SEO produit

### Title SEO (max 60 chars)
- Inclure nom produit + 1 mot clé
- Ex : "Polo viscose bleu marine · Le Lézard Genève"

### Meta description (max 160 chars)
- Phrase complète, naturelle
- Inclure : nom produit, matière, provenance, indice de prix
- Ex : "Polo en viscose 75%, fabriqué au Portugal, coupe oversize tombante. 39 CHF, livraison Suisse incluse."

### Image alt texts
- Description naturelle de ce qu'on voit
- Ex : "Modèle portant le polo bleu marine Le Lézard sur le quai Wilson à Genève"

## Inventory

### Niveaux à viser (drop standard)

- Stock initial : 50-100 unités par produit
- Stock par variant (taille) : 10-25
- Seuil de réapprovisionnement (notification Shopify) : 5 par variant
- Stock dormant à archiver : 0 vente sur 90 jours → archiver le produit, garder
  la page en SEO "Édition épuisée"

## Statut produit

- **DRAFT** : par défaut à la création, jamais publier sans Valdrin
- **ACTIVE** : seulement après validation Valdrin + assets complets
- **ARCHIVED** : pour les éditions épuisées (au lieu de DELETE — garder l'URL)

## Avant chaque création produit — checklist agent

- [ ] Naming conforme au format `[NOM] · [DÉTAIL]`
- [ ] Handle SEO friendly
- [ ] Vendor = "Le Lézard"
- [ ] Type de produit en français
- [ ] Tags appropriés (5-10 max)
- [ ] SKU formaté
- [ ] Variantes définies (tailles, couleurs)
- [ ] Stock par variante renseigné
- [ ] Prix conforme à `lz-chf-pricing`
- [ ] Description copywrited par `lz-copywriter`
- [ ] Images uploadées (4 minimum : face, dos, lifestyle, détail)
- [ ] SEO title + meta description
- [ ] Alt texts images
- [ ] Collection assignée
- [ ] Status = DRAFT
- [ ] Log dans `lezard/shopify/action-log.md`
