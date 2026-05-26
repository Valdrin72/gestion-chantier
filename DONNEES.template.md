# DONNEES.md — Cartographie de `src/donnees.js`

> Document généré par `/cartographier-donnees`. Reflète l'état du fichier au moment de la génération.
> **Date de génération :** `<date ISO>`
> **Branche :** `<nom>`
> **Taille du fichier :** `<N>` lignes

---

## Vue d'ensemble

- **Total exports** : `<N>`
- **Fonctions de calcul** : `<N>` (dont `<N>` avec doublon dans `src/calculs/`)
- **Fonctions de transformation** : `<N>`
- **Constantes BTP** : `<N>`
- **Données brutes** : `<N>`
- **Exports à risque élevé 🚨** : `<N>`

---

## 1. Imports du fichier (au sommet)

Liste des imports faits par `donnees.js` lui-même :

| Import | Source | Usage interne |
|---|---|---|
| `<nom>` | `<chemin>` | `<où c'est utilisé dans donnees.js>` |

---

## 2. Inventaire des exports par catégorie

### 2.1 🟢 Données brutes (fixtures, initiales)

| Nom | Ligne | Description courte | Importé par | Risque |
|---|---|---|---|---|
| `donneesInitiales` | `<L>` | `<description>` | `<N>` fichiers | 🟢 Faible |

### 2.2 🔵 Constantes BTP (TVA, taux, seuils)

| Nom | Ligne | Valeur | Importé par | Doublon ailleurs ? |
|---|---|---|---|---|
| `<nom>` | `<L>` | `<valeur>` | `<N>` fichiers | `<fichier>` ⚠️ ou Non |

### 2.3 🟡 Constantes techniques (statuts, labels, couleurs)

| Nom | Ligne | Type | Importé par |
|---|---|---|---|
| `<nom>` | `<L>` | `<array/object>` | `<N>` fichiers |

### 2.4 🔴 Fonctions de calcul

| Nom | Ligne | Ce qu'elle calcule | Importé par | Doublon dans `src/calculs/` ? | Tests Vitest ? | Risque |
|---|---|---|---|---|---|---|
| `<nom>` | `<L>` | `<description>` | `<N>` fichiers | `<fichier ou Non>` | `<Oui/Non>` | `<niveau>` |

### 2.5 🟣 Fonctions de transformation / migration

| Nom | Ligne | Ce qu'elle transforme | Importé par |
|---|---|---|---|
| `<nom>` | `<L>` | `<description>` | `<N>` fichiers |

### 2.6 ⚪ Fonctions utilitaires (formatage, parsing)

| Nom | Ligne | Description | Importé par |
|---|---|---|---|
| `<nom>` | `<L>` | `<description>` | `<N>` fichiers |

### 2.7 🔵 Générateurs / Validators

| Nom | Ligne | Description | Importé par |
|---|---|---|---|
| `<nom>` | `<L>` | `<description>` | `<N>` fichiers |

---

## 3. Drapeaux 🚨 — fonctions critiques à traiter

### Fonctions de calcul financier sans tests, avec doublon dans `src/calculs/`

| Fonction (donnees.js) | Équivalent testé | Importateurs à migrer |
|---|---|---|
| `<nom>` | `<src/calculs/...>` | `<liste fichiers>` |

### Fonctions de calcul très utilisées (>5 importateurs)

| Fonction | Nombre d'importateurs | Importateurs |
|---|---|---|
| `<nom>` | `<N>` | `<liste tronquée>` |

### Fonctions inutilisées (zéro importateur)

| Fonction | Ligne |
|---|---|
| `<nom>` | `<L>` |

---

## 4. Carte des usages internes

### Fonctions appelées par d'autres fonctions DANS `donnees.js`

| Fonction appelante | Appelle |
|---|---|
| `<nom>` | `<liste>` |

---

## 5. Recommandations de l'agent — RIEN

L'agent ne propose AUCUNE action. La phase de décision/migration viendra ensuite, fonction par fonction.

---

## 6. Comment relire ce document

1. Section **2.4 (Fonctions de calcul)** — c'est LE point critique. Tu y vois quelles fonctions sont dupliquées avec `src/calculs/`.
2. Section **3 (Drapeaux)** — la liste prioritaire des fonctions à migrer en premier.
3. Section **4** — pour comprendre les dépendances internes avant de toucher quoi que ce soit.

Quand tu auras lu, identifie **2-3 fonctions** que tu veux migrer en priorité. On commencera par celles-là.
