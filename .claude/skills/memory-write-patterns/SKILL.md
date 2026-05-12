---
name: memory-write-patterns
description: Skill écriture mémoire CYNA — comment structurer et écrire correctement dans le graphe de connaissances Memory MCP. Invoque avec /memory-write-patterns avant d'écrire dans la mémoire.
---

# Écriture Mémoire CYNA — Patterns

## Entités existantes (ne pas recréer)

| Nom | Type | Contenu |
|-----|------|---------|
| `CYNA SÀRL` | entreprise | Contexte métier |
| `App CYNA Gestion Chantier` | application | Stack technique |
| `Architecture source unique` | regle_architecture | Formules certifiées |
| `Bugs corrigés session YYYY-MM-DD` | session_bugs | Par session |
| `Patterns de bugs récurrents` | pattern_apprentissage | Lois du codebase |
| `Fichiers critiques haute priorité` | cartographie_risques | Niveaux risque |
| `Décisions techniques validées` | decisions | Choix architecturaux |
| `Anticipations futures` | previsions | Tâches futures |
| `Équipe agents CYNA` | equipe | État de l'équipe |

## Protocole écriture

### 1. Toujours chercher avant d'écrire
```js
// Vérifier l'existence
mcp__memory__search_nodes({ query: "nom entité" })
// → Si trouvé : add_observations
// → Si absent  : create_entities
```

### 2. Ajouter une observation à une entité existante
```js
mcp__memory__add_observations({
  observations: [{
    entityName: "Patterns de bugs récurrents",
    contents: ["PATTERN#9: nouvelle découverte — fichier — Nème occurrence"]
  }]
})
```

### 3. Créer une nouvelle entité session
```js
mcp__memory__create_entities({
  entities: [{
    name: "Bugs corrigés session 2024-12-01",
    entityType: "session_bugs",
    observations: [
      "BUG1 CRITIQUE Fichier.js:42 — description — Fix: correction appliquée",
      "BUG2 IMPORTANT Autre.js:88 — description — Fix: correction appliquée"
    ]
  }]
})
```

### 4. Lier les entités
```js
mcp__memory__create_relations({
  relations: [{
    from: "Bugs corrigés session 2024-12-01",
    relationType: "a_généré",
    to: "Patterns de bugs récurrents"
  }]
})
```

## Préfixes standardisés

| Préfixe | Usage |
|---------|-------|
| `BUG[N] CRITIQUE` | Bug critique corrigé |
| `BUG[N] IMPORTANT` | Bug important corrigé |
| `PATTERN#N` | Pattern récurrent identifié |
| `DÉCISION` | Choix technique validé |
| `RISQUE ÉLEVÉ/MOYEN/FAIBLE` | Niveau de risque fichier |
| `PRIORITÉ` | À faire prochaine session |
| `ATTENTION` | À surveiller |
| `FUTUR` | À faire plus tard |
| `FAIT` | Tâche terminée |
| `PRÉDICTION` | Bug probable non encore vérifié |
| `TENDANCE` | Observation répétée |

## Relations types

| Relation | Usage |
|----------|-------|
| `appartient_à` | App → Entreprise |
| `respecte` | App → Règle |
| `surveille` | Équipe → App |
| `a_généré` | Session bugs → Patterns |
| `alimente` | Patterns → Anticipations |
| `oriente` | Risques → Anticipations |
| `contraignent` | Décisions → App |
| `connaît` | Équipe → Patterns/Risques |
| `corrige` | Session → Bug précédent |
| `prédit` | Pattern → Bug futur |

## Ce que tu ne dois PAS faire
- Dupliquer une observation déjà présente mot pour mot
- Créer des entités sans les lier au graphe existant
- Écrire des observations vagues sans fichier ni ligne
- Stocker des données personnelles (noms clients, salaires individuels)
