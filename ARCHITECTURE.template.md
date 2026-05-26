# Architecture CYNA Gestion-Chantier — Cartographie

> Document généré automatiquement par `/cartographier`. Reflète l'état du code au moment de la génération.
> **Dernière mise à jour :** `<date ISO de génération>`
> **Branche analysée :** `<nom de la branche>`

---

## Vue d'ensemble

- **Total fichiers source** (src/) : `<N>` fichiers
- **Total lignes de code** : `<N>` lignes
- **Fichiers > 500 lignes** : `<N>` (à surveiller — voir section Couplages forts)
- **Fichiers candidats code mort** : `<N>` (jamais importés)
- **Groupes de duplications suspectes** : `<N>`

---

## 1. Structure de src/

### Dossiers
| Dossier | Nb fichiers | Total lignes | Rôle principal |
|---|---|---|---|
| `src/pages/` | `<N>` | `<N>` | `<rôle>` |
| `src/components/` | `<N>` | `<N>` | `<rôle>` |
| `src/hooks/` | `<N>` | `<N>` | `<rôle>` |
| `src/utils/` | `<N>` | `<N>` | `<rôle>` |
| `<...>` | | | |

### Fichiers à la racine de src/
Liste des fichiers `.js` directement dans `src/` (hors dossiers) :

| Fichier | Lignes | Catégorie déduite | Devrait être dans |
|---|---|---|---|
| `App.js` | `<N>` | Entrée | racine (OK) |
| `index.js` | `<N>` | Entrée | racine (OK) |
| `Agents.js` | `<N>` | `<catégorie>` | `<dossier suggéré ou "OK">` |
| `<...>` | | | |

---

## 2. Inventaire par catégorie

### 2.1 Pages (`src/pages/` + racine)
| Fichier | Lignes | Rôle métier | Importé par |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description courte>` | `<App.js, ...>` |

### 2.2 Composants UI réutilisables
| Fichier | Lignes | Rôle | Utilisé dans |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description>` | `<liste>` |

### 2.3 Hooks custom
| Fichier | Lignes | Ce qu'il fait | Utilisé par |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description>` | `<liste>` |

### 2.4 Utilitaires métier (calculs, logique)
| Fichier | Lignes | Domaine | Utilisé par |
|---|---|---|---|
| `<chemin>` | `<N>` | `<TVA, marges, dates, etc.>` | `<liste>` |

### 2.5 Système IA / Agents
| Fichier | Lignes | Rôle | Dépendances |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description>` | `<imports clés>` |

### 2.6 Données et configuration
| Fichier | Lignes | Contenu | Utilisé par |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description>` | `<liste>` |

### 2.7 Module Supabase / Data
| Fichier | Lignes | Rôle | Tables impactées |
|---|---|---|---|
| `<chemin>` | `<N>` | `<description>` | `<tables>` |

### 2.8 Context / State global
| Fichier | Lignes | Ce qu'il expose | Consommé par |
|---|---|---|---|
| `<chemin>` | `<N>` | `<liste valeurs>` | `<liste>` |

---

## 3. Drapeaux et alertes

### 🔴 Candidats code mort (jamais importés)

> Fichiers présents dans le repo mais qu'aucun autre fichier n'importe. **À vérifier manuellement** avant suppression — certains peuvent être chargés dynamiquement.

| Fichier | Lignes | Dernière modification (date commit si dispo) | Note |
|---|---|---|---|
| `<chemin>` | `<N>` | `<date>` | `<note éventuelle>` |

### 🟡 Duplications potentielles

> Groupes de fichiers dont les noms suggèrent la même fonction. Lis-les manuellement pour confirmer.

#### Groupe 1 : `<nom thématique, ex: Système d'agents>`
- `<fichier 1>` — `<résumé des premières lignes>`
- `<fichier 2>` — `<résumé>`
- `<fichier 3>` — `<résumé>`
- **Verdict préliminaire** : `<duplication / évolution successive / fonctions différentes / à clarifier>`

#### Groupe 2 : `<...>`
`<...>`

### 🟠 Couplages forts

> Fichiers importés par plus de 10 autres. Modifier ces fichiers présente un risque de régression élevé.

| Fichier | Nombre d'importateurs | Risque |
|---|---|---|
| `<chemin>` | `<N>` | `<élevé/modéré>` |

### 🟣 Fichiers très volumineux

> Plus de 500 lignes. Pas un problème en soi, mais candidat à refactorisation si la complexité interne le justifie.

| Fichier | Lignes | Catégorie |
|---|---|---|
| `<chemin>` | `<N>` | `<...>` |

### 🔵 Mauvais emplacement potentiel

> Fichiers à la racine de `src/` alors qu'un dossier équivalent existe (ex: `Heures.js` à la racine + dossier `pages/`).

| Fichier | Emplacement actuel | Emplacement suggéré |
|---|---|---|
| `<chemin>` | `<racine de src/>` | `<dossier suggéré>` |

---

## 4. Carte des dépendances clés

### Fichiers les plus dépendants (qu'on ne peut pas modifier sans casser plein de choses)

| Fichier | Importé par |
|---|---|
| `<chemin>` | `<liste tronquée à 5, ... +N autres>` |

### Fichiers les plus dépendants vers l'extérieur (qui touchent à beaucoup de choses)

| Fichier | Nombre d'imports internes | Principales dépendances |
|---|---|---|
| `<chemin>` | `<N>` | `<liste>` |

---

## 5. Recommandations de l'agent — RIEN

L'agent `code-cartographer` ne fait AUCUNE recommandation de refactoring. Sa mission est purement descriptive. La phase de consolidation viendra dans une étape suivante, sur la base de ce document.

---

## 6. Comment relire ce document

1. **Section 1** te donne la vue d'ensemble — combien de fichiers, où ils sont
2. **Section 2** te dit ce que fait chaque fichier — tu peux te repérer
3. **Section 3 (drapeaux)** est la section CRITIQUE — c'est là qu'on va prendre les décisions
4. **Section 4** t'aide à savoir quels fichiers sont "intouchables" sans précaution

Quand tu auras lu, signale à Claude ce qui te surprend ou ce qui te paraît prioritaire. **On commencera la consolidation par là.**
