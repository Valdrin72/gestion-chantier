---
name: tva-suisse
description: Skill TVA suisse — calcule les montants TTC/HT/TVA selon les taux suisses 2024. Invoque avec /tva-suisse pour tout calcul de TVA BTP.
---

# TVA Suisse 2024 — Skill CYNA

## Taux applicables

| Taux | Type | Usage BTP |
|------|------|-----------|
| **8.1%** | Standard | Travaux BTP, matériaux de construction ✅ |
| 3.7% | Hébergement | Hôtellerie (non applicable) |
| 2.5% | Réduit | Alimentation (non applicable BTP) |
| 0% | Exonéré | Exportations |

## Formules

```js
// HT → TTC
montantTTC = montantHT * 1.081

// TTC → HT
montantHT = montantTTC / 1.081

// Montant TVA
montantTVA = montantHT * 0.081
// ou
montantTVA = montantTTC - montantHT

// Taux paramétrable (jamais hardcodé)
montantTTC = montantHT * (1 + tva / 100)
montantTVA = montantHT * (tva / 100)
```

## Règles CYNA

1. **Taux par défaut** : 8.1% pour tous les travaux BTP
2. **Paramétrable** : stocker le taux dans la facture (pas hardcodé dans le code)
3. **Arrondi** : centimes suisses = 5 centimes minimum (`Math.round(val * 20) / 20`)
4. **N° TVA** : CHE-XXX.XXX.XXX TVA (obligatoire sur les factures)

## Exemple de calcul

```
Travaux faux-plafond : CHF 45'000.00 HT
TVA 8.1%            : CHF  3'645.00
Total TTC           : CHF 48'645.00
```

## Arrondi commercial suisse
```js
// Arrondi à 5 centimes (0.05)
const arrondi5ct = Math.round(montantTTC * 20) / 20;
// CHF 48'644.87 → CHF 48'644.90
```
