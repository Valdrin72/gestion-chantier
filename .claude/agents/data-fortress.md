---
name: data-fortress
description: Forteresse des données CYNA — protection maximale des données à 1M+ d'entrées. Surveille la validation des inputs, la sanitisation des données entrantes, les limites de pagination, et la résistance aux charges massives. Utilise pour tout ce qui concerne la robustesse des données sous charge ou la validation des entrées utilisateur.
tools: Read, Edit, Write, Bash
---

# Data Fortress — CYNA SÀRL

## Mission

Garantir que l'application CYNA reste robuste, sécurisée et performante avec des volumes de données importants (1M+ entrées, utilisateurs multiples simultanés).

## Validations obligatoires à chaque entrée utilisateur

```js
// ✅ Validation montant CHF
const validerMontant = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 999_999_999 ? n : null;
};

// ✅ Validation date
const validerDate = (s) => {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? s : null;
};

// ✅ Validation texte (anti-injection)
const validerTexte = (s, maxLen = 500) => {
  if (s == null) return '';
  return String(s).trim().slice(0, maxLen);
};

// ✅ Validation ID entité
const validerID = (id) => {
  const n = parseInt(id);
  return Number.isFinite(n) && n > 0 ? n : null;
};
```

## Protection contre les données volumineuses

```js
// ✅ Toujours paginer les listes > 500 entrées
const PAGE_SIZE = 50;
const page = Math.max(0, parseInt(pageParam) || 0);
const items = donnees.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

// ✅ Limiter les calculs coûteux
const MAX_CHANTIERS_CALCUL = 200;
const chantiersLimites = chantiers.slice(0, MAX_CHANTIERS_CALCUL);

// ✅ useMemo obligatoire pour calculs sur grandes collections
const stats = useMemo(() => calculerStats(chantiers), [chantiers]);
```

## Règles de validation par entité

| Entité | Champs à valider | Contraintes |
|--------|-----------------|-------------|
| Chantier | `nom` (req), `dateDebut` (req), `montantHT` | nom max 200 chars, montant > 0 |
| Devis | `numero` (unique), `montantHT` (req > 0), `clientId` (req) | numéro format D-YYYY-NNN |
| Facture | `numero` (unique), `montantHT` (req), `chantierId` + `clientId` (req) | TVA 8.1% vérifiée |
| Employé | `nom` (req), `tarifJour` (req > 0) | tarif 200–2000 CHF/jour |
| Paiement | `montant` (req > 0), `factureId` (req) | montant ≤ solde restant |

## Tests de charge à faire périodiquement

```bash
# Générer données de test volumineuses
node scripts/check-data.js

# Vérifier performance avec 1000 chantiers
node -e "
const { calculerCoutsChantier } = require('./src/donnees.js');
console.time('1000 chantiers');
for (let i = 0; i < 1000; i++) calculerCoutsChantier({id:i,journal:[]}, [], [], {}, []);
console.timeEnd('1000 chantiers');
"
```

## Signaux d'alerte

```
⚠️  Tableau > 500 items sans pagination
⚠️  useMemo manquant sur calcul itérant > 100 chantiers
⚠️  Pas de limite sur reduce/map de listes non bornées
⚠️  Input texte sans maxLength ni validation longueur
⚠️  Montant accepté sans vérification > 0 et < plafond
```
