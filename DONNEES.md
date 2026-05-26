# DONNEES.md — Cartographie de `src/donnees.js`

> Document généré par `/cartographier-donnees`. Reflète l'état du fichier au moment de la génération.
> **Date de génération :** `2026-05-26T15:19:55Z`
> **Branche :** `main`
> **Taille du fichier :** `1165` lignes

---

## Vue d'ensemble

- **Total exports** : 39
- **Fonctions de calcul** : 17 (dont 1 avec doublon dans `src/calculs/`)
- **Fonctions de transformation** : 3
- **Fonctions de validation** : 2
- **Constantes BTP** : 2
- **Données brutes** : 1
- **Exports à risque élevé 🚨** : 6

---

## 1. Imports du fichier (au sommet)

| Import | Source | Usage interne |
|---|---|---|
| `donneesDemo` | `./donnees-demo` | Assigné à `donneesInitiales` (L808) |

---

## 2. Inventaire des exports par catégorie

### 2.1 🟢 Données brutes (fixtures, initiales)

| Nom | Ligne | Description courte | Importé par | Risque |
|---|---|---|---|---|
| `donneesInitiales` | 808 | Alias de `donneesDemo` — 10 employés, 6 clients, 9 devis, 7 chantiers, 7 factures | 3 fichiers | 🟢 Faible |

### 2.2 🔵 Constantes BTP (TVA, taux, seuils)

| Nom | Ligne | Valeur | Importé par | Doublon ailleurs ? |
|---|---|---|---|---|
| `SEUILS` | 9 | `{ margeRentable: 20, margeLimite: 15 }` (% marge) | 7 fichiers | Non |
| `C` | 504 | Palette de couleurs métier (statuts, niveaux) | 15 fichiers | Non |

### 2.3 🟡 Constantes techniques (statuts, labels, couleurs)

_(aucune constante technique pure distincte — les couleurs sont regroupées dans `C`)_

### 2.4 🔴 Fonctions de calcul

| Nom | Ligne | Ce qu'elle calcule | Importé par | Doublon dans `src/calculs/` ? | Tests Vitest ? | Risque |
|---|---|---|---|---|---|---|
| `calculerDateFinOuvrables` | 33 | Date de fin en jours ouvrables depuis une date de début | 4 fichiers | Non | Non | 🟡 Moyen |
| `joursOuvrableRestants` | 55 | Nombre de jours ouvrables restants avant la date de fin | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `sommeAvenants` | 138 | Total CHF des avenants d'un chantier | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `sommeHeuresRegie` | 169 | Total heures en régie d'un devis | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `calculerCA` | 189 | **CA = devis.montantHT + avenants + régie** — source unique CA | 11 fichiers | Non | Non | 🚨 Critique |
| `calculerCoutsChantier` | 221 | Tous les coûts, marges, EAC, RAD (~200 lignes) | 12 fichiers | Non | Non | 🚨 Critique |
| `calculerDevis` | 432 | Estimatif devis (coût MO + matériaux + marges) | 0 fichiers | `src/calculs/pricing.js:calculerDevisGlobal` ⚠️ | Non | 🟡 Moyen |
| `calculerDevisClient` | 491 | Marge devis signé (montantHT - coûtMO) | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `calculerJoursRestants` | 525 | Jours ouvrables restants d'un chantier | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `calculerRentabiliteEquipe` | 535 | Rentabilité par membre d'équipe | 1 fichier | Non | Non | 🟡 Moyen |
| `calculerEcartChantier` | 579 | Écart budget vs réel (dérive en CHF et %) | 1 fichier | Non | Non | 🟡 Moyen |
| `calculerRentabiliteReelle` | 602 | Wrapper de `calculerEtatChantier` + projection | 0 fichiers | Non | Non | ⚪ Inutilisé |
| `getIntervallesPeriode` | 658 | Retourne `{debut, fin}` pour semaine/mois/année | 8 fichiers | Non | Non | 🟢 Faible |
| `chantiersInPeriode` | 701 | Filtre si chantier chevauche une période | 3 fichiers | Non | Non | 🟢 Faible |
| `facturesInPeriode` | 715 | Filtre si facture émise dans une période | 2 fichiers | Non | Non | 🟢 Faible |
| `genererNumeroFacture` | 725 | Génère le prochain numéro F-YYYY-NNN | 1 fichier | Non | Non | 🟡 Moyen |
| `calculerStatutFacture` | 736 | Calcule le statut réel (payée/partielle/retard) depuis paiementsHistorique | 2 fichiers | Non | Non | 🟡 Moyen |
| `calculerEtatChantier` | 883 | **Moteur principal** : avancement, coûts, projection, RAD, EAC | 3 fichiers directs + utilisé via `calculerCoutsChantier` | Non | Non | 🚨 Critique |
| `calculerVitesseChantier` | 1135 | Vitesse réelle + simulation +1 ouvrier | 1 fichier | Non | Non | 🟡 Moyen |

### 2.5 🟣 Fonctions de transformation / migration

| Nom | Ligne | Ce qu'elle transforme | Importé par |
|---|---|---|---|
| `getHeuresParEmployeParDate` | 147 | Pivot chantiers/employés → matrice `[empId][date]` | 1 fichier |
| `migrerDevisId` | 205 | Corrige `chantier.devisId` si manquant (migration données) | 1 fichier |
| `migrerJournal` | 833 | Migre 3 formats de journal vers le format groupé `{date, employes[]}` | 2 fichiers |

### 2.6 ⚪ Fonctions utilitaires (formatage, parsing)

| Nom | Ligne | Description | Importé par |
|---|---|---|---|
| `couleurMarge` | 16 | Retourne hex couleur selon seuil marge % | 2 fichiers |
| `fmtN` | 25 | Formattage CHF avec apostrophes suisses | 21 fichiers |
| `getAlerte` | 87 | Retourne objet `{texte, couleur, niveau}` selon retard jours | 2 fichiers |
| `getAlerteChantier` | 96 | Calcule l'alerte planning d'un chantier (wrapper) | 0 fichiers |
| `estRetardJustifie` | 106 | Stub — retourne toujours `false` | 0 fichiers |
| `getChantierStatus` | 122 | Retourne badge planning (`{label, couleur, niveau}`) | 0 fichiers |
| `isChantierActif` | 175 | Bool : statut `'en cours'` | 3 fichiers |
| `isChantierComptable` | 178 | Bool : statut actif pour comptabilité | 0 fichiers |
| `statutRentabilite` | 423 | Retourne `{label, color}` selon marge % | 1 fichier |
| `getPeriodeLabel` | 682 | Label texte de la période (ex: "Semaine du 20.05") | 4 fichiers |
| `heuresEmploye` | 862 | Total heures d'un employé dans un journal | 4 fichiers |
| `heuresJour` | 875 | Map `{empId: heures}` pour une date donnée | 2 fichiers |

### 2.7 🔵 Validateurs

| Nom | Ligne | Description | Importé par |
|---|---|---|---|
| `assertEtatValide` | 1035 | Vérifie cohérence numérique du résultat du moteur (NaN interdit) | 0 fichiers |
| `assertEtatCoherent` | 1095 | Vérifie cohérence métier (critiques + warnings) | 0 fichiers |

---

## 3. Drapeaux 🚨 — fonctions critiques à traiter

### Fonctions de calcul financier sans tests, avec doublon dans `src/calculs/`

| Fonction (donnees.js) | Équivalent testé | Importateurs à migrer |
|---|---|---|
| `fmtN` (L25) | `src/calculs/format.js:fmtNombre` — testé dans `format.test.js` | 21 fichiers dont `Dashboard.js`, `ChantierDetail.js`, `DevisPage.js` |
| `calculerDevis` (L432) | `src/calculs/pricing.js:calculerDevisGlobal` — non testé | 0 fichiers (inutilisé) |

### Fonctions de calcul très utilisées (>5 importateurs)

| Fonction | Nombre d'importateurs | Importateurs principaux |
|---|---|---|
| `fmtN` | 21 | Quasiment tous les fichiers UI |
| `C` | 15 | Tous les composants affichant des statuts colorés |
| `calculerCoutsChantier` | 12 | `ChantierDetail.js`, `Dashboard.js`, `Analyse.js`, `RapportsPage.js`, ... |
| `calculerCA` | 11 | `ChantierDetail.js`, `Dashboard.js`, `Factures.js`, ... |
| `getIntervallesPeriode` | 8 | Pages avec filtres temporels |
| `SEUILS` | 7 | Toutes les pages de rentabilité |

### Fonctions inutilisées (zéro importateur direct)

| Fonction | Ligne | Note |
|---|---|---|
| `joursOuvrableRestants` | 55 | Remplacée par `calculerJoursRestants` (L525) ? |
| `getAlerteChantier` | 96 | Wrapper sur `getAlerte` — peut-être obsolète |
| `estRetardJustifie` | 106 | Stub — toujours `false` — logique non implémentée |
| `getChantierStatus` | 122 | Remplacée par le moteur alertes module ? |
| `sommeAvenants` | 138 | Intégrée dans `calculerCA` directement |
| `sommeHeuresRegie` | 169 | Intégrée dans `calculerCA` directement |
| `isChantierComptable` | 178 | Doublon partiel de `isChantierActif` |
| `calculerDevis` | 432 | Jamais appelée — `calculerDevisGlobal` dans pricing.js |
| `calculerDevisClient` | 491 | Jamais appelée — logique dans les pages ? |
| `calculerJoursRestants` | 525 | Jamais appelée malgré le nom générique |
| `calculerRentabiliteReelle` | 602 | Wrapper de `calculerEtatChantier` jamais appelé directement |
| `assertEtatValide` | 1035 | Outil de debug non intégré dans les flows |
| `assertEtatCoherent` | 1095 | Outil de debug non intégré dans les flows |

---

## 4. Carte des usages internes

### Fonctions appelées par d'autres fonctions DANS `donnees.js`

| Fonction appelante | Appelle |
|---|---|
| `calculerCoutsChantier` (L221) | `calculerCA`, `heuresEmploye`, `joursOuvrableRestants` |
| `calculerRentabiliteReelle` (L602) | `calculerEtatChantier`, `joursOuvrableRestants` |
| `calculerEtatChantier` (L883) | `calculerCA`, `heuresEmploye` |
| `chantiersInPeriode` (L701) | `calculerDateFinOuvrables` |
| `getAlerteChantier` (L96) | `getAlerte` |
| `donneesInitiales` (L808) | `donneesDemo` (import externe) |
| `creerFactureDepuisDevis` (L753) | `genererNumeroFacture` |

### Remarque importante : deux moteurs de calcul coexistent

Il existe **deux implémentations** du calcul chantier dans `donnees.js` :
- `calculerCoutsChantier` (L221) — ancien moteur, ~200 lignes, imbriqué
- `calculerEtatChantier` (L883) — nouveau moteur "source unique de vérité", ~140 lignes, propre

`calculerCoutsChantier` appelle `calculerCA` et `heuresEmploye` de façon similaire à `calculerEtatChantier`, mais produit un format de retour différent. Les 12 importateurs de `calculerCoutsChantier` n'ont pas encore migré vers le nouveau moteur.

---

## 5. Recommandations de l'agent — RIEN

L'agent ne propose AUCUNE action. La phase de décision/migration viendra ensuite, fonction par fonction.

---

## 6. Comment relire ce document

1. Section **2.4 (Fonctions de calcul)** — c'est LE point critique. Tu y vois quelles fonctions sont dupliquées avec `src/calculs/`.
2. Section **3 (Drapeaux)** — la liste prioritaire des fonctions à migrer en premier.
3. Section **4** — pour comprendre les dépendances internes avant de toucher quoi que ce soit.

Quand tu auras lu, identifie **2-3 fonctions** que tu veux migrer en priorité. On commencera par celles-là.
