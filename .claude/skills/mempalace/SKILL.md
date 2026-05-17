---
name: mempalace
description: Palais de la mémoire CYNA — construit et maintient un graphe de connaissances structuré dans Memory MCP. Mémorise les bugs résolus, décisions techniques, patterns détectés, et entités critiques. Invoquer avec /mempalace pour ancrer les apprentissages de la session dans la mémoire permanente.
trigger: /mempalace
---

# Skill : MemPalace — Palais de la Mémoire CYNA

## Concept

Le Palais de la Mémoire est une technique mnémotechnique millénaire : ancrer chaque
information dans un lieu mental précis pour ne jamais l'oublier. Appliqué à CYNA,
MemPalace structure le graphe Memory MCP pour que chaque session construise
sur la précédente — zéro perte de contexte, accumulation permanente de savoir.

**Architecture du palais :**
```
🏛️ PALAIS CYNA
├── 🚪 Entrée      — état actuel (bugs actifs, décisions en cours)
├── 📚 Bibliothèque — patterns et lois du codebase
├── 🔬 Laboratoire — bugs résolus et leurs causes racines
├── 🗺️ Salle des cartes — architecture, fichiers critiques, liens entités
├── ⚖️ Tribunal    — décisions techniques et leurs raisons
└── 🔭 Observatoire — risques futurs et prédictions
```

---

## Quand l'utilisateur tape `/mempalace`

### Phase 1 — Lire le palais existant

```
Utiliser mcp__memory__read_graph pour voir ce qui est déjà mémorisé.
Utiliser mcp__memory__search_nodes pour chercher les entités CYNA existantes.
```

### Phase 2 — Inventaire de la session

Analyser la session courante pour identifier ce qui doit être mémorisé :

**Catégories à ancrer :**

| Catégorie | Exemples | Nœud Memory |
|-----------|----------|-------------|
| Bug résolu | NaN dans marge, ID type mixte | `Bug_[nom]` |
| Pattern détecté | String() pour IDs, guard ca > 0 | `Pattern_[nom]` |
| Décision technique | confirmer() au lieu de window.confirm | `Decision_[nom]` |
| Fichier critique | donnees.js, AppContext.js | `Fichier_[nom]` |
| Règle métier | TVA 8.1%, coefficient 1.35 | `RegleBTP_[nom]` |
| Risque identifié | ParametresPage JSON.parse dans render | `Risque_[nom]` |

### Phase 3 — Écrire dans le palais

Pour chaque élément identifié, créer/mettre à jour les nœuds et relations :

```
mcp__memory__create_entities — pour chaque nouveau nœud
mcp__memory__add_observations — pour enrichir les nœuds existants
mcp__memory__create_relations — pour relier les nœuds entre eux
```

**Structure d'un nœud Bug :**
```json
{
  "name": "Bug_ID_Type_Mixte",
  "entityType": "Bug",
  "observations": [
    "Fichier : useChantierFiltres.js:11",
    "Cause : parseInt(employeId) comparé à contexte.employeActif string",
    "Fix : String(m.employeId) === String(contexte.employeActif)",
    "Date : 2026-05-17",
    "Pattern : comparaisons ID sans String() coercion",
    "Impact : liste chantiers vide quand filtre par employé"
  ]
}
```

**Structure d'un nœud Pattern :**
```json
{
  "name": "Pattern_String_Coercion_IDs",
  "entityType": "Pattern",
  "observations": [
    "Règle : toujours String(a) === String(b) pour comparer des IDs",
    "Raison : Supabase retourne string, localStorage peut retourner number",
    "Fichiers à risque : tout fichier qui compare .id avec un autre .id",
    "Correction type : String(a) === String(b)",
    "Status : appliqué dans 14 fichiers en session 2026-05-17"
  ]
}
```

### Phase 4 — Tisser les relations

```
Bug_ID_Type_Mixte → CAUSE_PATTERN → Pattern_String_Coercion_IDs
Pattern_String_Coercion_IDs → APPLIQUE_DANS → Fichier_useChantierFiltres
Decision_ConfirmModal → REMPLACE → Bug_window_confirm
```

### Phase 5 — Vérification du palais

```
mcp__memory__search_nodes — rechercher "CYNA" pour voir le graphe complet
```

Afficher un résumé :
```
🏛️ PALAIS CYNA — État après session [date]
════════════════════════════════════════════
Nœuds créés : N
Nœuds enrichis : N
Relations tissées : N

📚 Bibliothèque (patterns) : N patterns
🔬 Laboratoire (bugs) : N bugs mémorisés
⚖️ Tribunal (décisions) : N décisions
🔭 Observatoire (risques) : N risques trackés

Prochaine session : [briefing automatique disponible via /session-briefer]
```

### Phase 6 — Rapport de session

À la fin, produire un briefing compact pour la prochaine session :
```
SESSION [date] — Ce qu'il faut savoir pour continuer :
- Branche : claude/debug-terminal-issue-uvSBY
- Dernier commit : [hash] — [message]
- Bug majeur corrigé : String() coercion sur tous les IDs (14 fichiers)
- Pattern à surveiller : ParametresPage.js:81 JSON.parse dans render
- Prochain sprint : migration react-scripts → Vite
```

---

## Options

- `/mempalace` — inventaire + écriture complète
- `/mempalace --read` — lecture seule du palais (briefing session)
- `/mempalace --bug [description]` — mémoriser un bug spécifique
- `/mempalace --pattern [nom]` — mémoriser un pattern
- `/mempalace --clean` — supprimer les nœuds obsolètes/résolus

---

## Intégration équipe

MemPalace travaille avec :
- `memory-keeper` — agent Memory qui mémorise en fin de session
- `session-briefer` — lit le palais au début de chaque session
- `pattern-learner` — consolide les patterns dans le graphe
- `anticipator` — utilise le palais pour prédire les prochains risques
