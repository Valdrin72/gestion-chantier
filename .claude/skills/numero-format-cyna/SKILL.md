---
name: numero-format-cyna
description: Skill numérotation CYNA — format exact des numéros de devis, factures, chantiers et clients. Invoque avec /numero-format-cyna pour générer ou valider un numéro d'entité.
---

# Numérotation CYNA SÀRL — Format officiel

## Formats par entité

| Entité | Format | Exemple |
|--------|--------|---------|
| Devis | `DEVIS-YYYY-NNN` | `DEVIS-2024-042` |
| Facture | `FACT-YYYY-NNN` | `FACT-2024-117` |
| Chantier | `CH-YYYY-NNN` | `CH-2024-028` |
| Client | `CLI-NNN` | `CLI-045` |
| Avenant | `AV-[N°devis]-NNN` | `AV-DEVIS-2024-042-001` |

- `YYYY` = année en cours (4 chiffres)
- `NNN` = séquence 3 chiffres avec zéro-remplissage (`001`, `042`, `117`)

## Génération en JavaScript

```js
// Générer le prochain numéro d'une série
const prochainNumero = (entites, prefixe, annee = new Date().getFullYear()) => {
  const regex = new RegExp(`^${prefixe}-${annee}-(\\d+)$`);
  const nums = entites
    .map(e => { const m = (e.numero || '').match(regex); return m ? parseInt(m[1]) : 0; })
    .filter(n => n > 0);
  const suivant = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefixe}-${annee}-${String(suivant).padStart(3, '0')}`;
};

// Usage
const numDevis   = prochainNumero(devis,    'DEVIS');   // → DEVIS-2024-043
const numFacture = prochainNumero(factures, 'FACT');    // → FACT-2024-118
const numChantier= prochainNumero(chantiers,'CH');      // → CH-2024-029
```

## Validation d'un numéro

```js
const isDevisValide    = /^DEVIS-\d{4}-\d{3}$/.test(numero);
const isFactureValide  = /^FACT-\d{4}-\d{3}$/.test(numero);
const isChantierValide = /^CH-\d{4}-\d{3}$/.test(numero);
```

## Règles
1. Jamais réutiliser un numéro (même après suppression)
2. Jamais changer l'année d'un numéro existant
3. Les numéros sont immutables une fois créés
4. En cas de conflit (deux entités même numéro) → ajouter un suffixe `-B`

## Ce que tu ne dois PAS faire
- Générer des numéros avec `Date.now()` ou `Math.random()` comme identifiant visible
- Permettre deux entités avec le même numéro
- Changer le format sans mise à jour de toutes les références
