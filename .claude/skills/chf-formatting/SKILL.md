---
name: chf-formatting
description: Skill formatage CHF — formate correctement les montants en francs suisses selon les conventions suisses. Invoque avec /chf-formatting pour tout formatage de montants dans le code.
---

# Formatage CHF Suisse — Skill CYNA

## Conventions suisses

### Séparateur de milliers : apostrophe (')
```
✅ CHF 1'234'567.90
❌ CHF 1,234,567.90  (américain)
❌ CHF 1.234.567,90  (européen)
```

### Décimales : point (.)
```
✅ CHF 1'234.50
❌ CHF 1'234,50
```

### Placement de "CHF"
```
✅ CHF 1'234.50   (avant le montant)
✅ 1'234.50 CHF   (après le montant, selon contexte)
```

## Formatage en JavaScript

### Méthode recommandée (Intl.NumberFormat)
```js
const formatCHF = (montant) =>
  new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(montant || 0);

// Résultat : "CHF 1'234.50"
```

### Formatage compact (grands montants)
```js
const formatCHFCompact = (montant) => {
  if (montant >= 1000000) return `CHF ${(montant/1000000).toFixed(1)}M`;
  if (montant >= 1000) return `CHF ${(montant/1000).toFixed(0)}K`;
  return formatCHF(montant);
};
// CHF 122K, CHF 1.2M
```

### Pour les % (pas de CHF)
```js
// ✅ Retourne un number (pas une string)
const formatPct = (val) => Math.round(val * 1000) / 10; // → 12.3

// ✅ Affichage
`${formatPct(marge)}%`  // → "12.3%"

// ❌ Jamais
(val * 100).toFixed(1)  // → "12.3" (string !)
```

## Règles CYNA
1. Toujours utiliser `fr-CH` comme locale (apostrophe milliers)
2. Toujours 2 décimales pour les montants CHF
3. Valeurs nulles → `'—'` (tiret cadratin), pas `'0'` ni `'NaN'`
4. % toujours en number (Math.round, pas .toFixed)

## Protections
```js
// Guard pour valeurs manquantes
const afficher = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return formatCHF(val);
};
```
