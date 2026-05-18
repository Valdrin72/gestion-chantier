---
name: ultra-plan
description: Ultra Plan — planification maximale d'une fonctionnalité CYNA. Décompose en sous-tâches atomiques, identifie les risques, assigne les agents, estime les efforts, génère un plan d'exécution complet prêt à lancer. Invoque avec /ultra-plan.
trigger: /ultra-plan
---

# Skill : Ultra Plan — Planificateur Maximal CYNA

## Rôle

Ultra Plan est le planificateur ultime. Quand une fonctionnalité est trop complexe pour être
attaquée directement, Ultra Plan la découpe en un plan parfait : tâches atomiques, risques
identifiés, agents assignés, efforts estimés, sprints ordonnés.

**Principe :** Aucune ambiguïté. Aucune dépendance cachée. Aucun agent sans critères de succès.
Le plan est si précis qu'il suffit de taper "Go" pour que l'exécution se lance sans friction.

---

## Quand l'utilisateur tape `/ultra-plan [description de la fonctionnalité]`

---

### Phase 1 — Analyse du contexte (2 minutes)

```bash
# Comprendre l'état actuel du projet
git log --oneline -10
find src/ -name "*.js" | wc -l
node scripts/audit-btp.js 2>&1 | tail -5
```

Identifier automatiquement :
- **Fichiers impactés** : quels composants/pages/hooks seront modifiés ?
- **Dépendances agents** : quels agents du `team-manifest.md` sont concernés ?
- **Risques** : breaking changes potentiels, performances, sécurité, cascade de données
- **Règles CLAUDE.md applicables** : quelles contraintes métier BTP s'appliquent ?

```bash
# Rechercher les fichiers potentiellement impactés
grep -rn "[mot-clé fonctionnalité]" src/ --include="*.js" | head -20
```

---

### Phase 2 — Décomposition atomique

Chaque sous-tâche DOIT être :
- **Atomique** : réalisable en une session sans dépendances bloquantes non résolues
- **Testable** : critère de succès clair et vérifiable
- **Dimensionnée** : XS / S / M / L (voir tableau ci-dessous)

| Taille | Durée estimée | Exemple |
|--------|--------------|---------|
| XS | < 30 min | Ajouter un guard NaN, renommer un champ |
| S | 1h | Créer un composant simple, corriger un calcul |
| M | 2–3h | Nouvelle page avec état et données |
| L | Demi-journée | Feature complète avec tests et validation |

Format de chaque tâche :

```
[ ] T1 [XS] Titre descriptif de la tâche
    → Agent    : bug-hunter + code-reviewer
    → Fichiers : src/App.js, src/context/AppContext.js
    → Dépend de : aucune
    → Risque   : aucun
    → Critère  : composant s'affiche sans erreur console, calcul = valeur attendue

[ ] T2 [S] Titre de la tâche suivante
    → Agent    : rentabilite-analyst
    → Fichiers : src/utils/calculs.js
    → Dépend de : T1
    → Risque   : division par zéro si CA = 0 — vérifier guard
    → Critère  : marge brute % = nombre (pas string), NaN absent
```

---

### Phase 3 — Assignation des agents

Pour chaque tâche, identifier l'agent optimal :

| Type de tâche | Agent assigné |
|--------------|---------------|
| Bug NaN, undefined, division | `bug-hunter` |
| Calculs marge, EAC, RAD | `rentabilite-analyst` |
| Factures, TVA, liens entités | `facturation-suisse` |
| Planning, heures, CCT-SOR | `planning-chantier` |
| Auth, RLS Supabase, XSS | `security-auditor` |
| Performance, pagination | `load-sentinel` |
| Revue avant commit | `code-reviewer` |
| Composant UI React | `general-purpose` (Designer) |
| État React, hooks | `react-state-patterns` |
| Tests visuels Playwright | `playwright-cyna` |
| Mémoire, décisions session | `mempalace` |
| Développement feature générale | `general-purpose` |

---

### Phase 4 — Plan d'exécution complet

Générer le plan structuré en sprints :

```
ULTRA PLAN — [Nom de la fonctionnalité]
═══════════════════════════════════════════════════════
Fonctionnalité  : [Description courte]
Effort total    : [durée estimée]
Risque global   : [faible / moyen / élevé]
Agents requis   : [liste des agents]
Fichiers impactés :
  - src/[fichier1.js]
  - src/[fichier2.js]
  - src/[fichier3.js]
Règles CLAUDE.md : [règles applicables]
═══════════════════════════════════════════════════════

SPRINT 1 — Fondations (parallélisable)
  → T1 [XS] [description] (bug-hunter)
  → T2 [S]  [description] (general-purpose)
  Ces 2 tâches tournent en parallèle — pas de dépendance entre elles

SPRINT 2 — Logique métier (séquentiel)
  → T3 [M] [description] (rentabilite-analyst) — dépend de T1+T2
  → T4 [S] [description] (facturation-suisse) — dépend de T3

SPRINT 3 — Validation et livraison
  → T5 [XS] audit-btp.js + vérification guards
  → T6 [XS] tests Playwright — flow complet
  → T7 [XS] commit + push

═══════════════════════════════════════════════════════
RISQUES IDENTIFIÉS :
  🟡 T3 : guard ca > 0 obligatoire (CLAUDE.md règle absolue)
  🟠 T4 : vérifier cascade si suppression devis lié
═══════════════════════════════════════════════════════
LANCER : Taper "Go" pour démarrer Sprint 1
```

---

### Phase 5 — Exécution sur "Go"

Quand l'utilisateur tape "Go" (ou "Go Sprint 1", "Go Sprint 2"...) :

Lancer les agents du sprint en parallèle avec les prompts exacts :

```js
// Exemple Sprint 1 : T1 et T2 en parallèle
Agent({
  subagent_type: "general-purpose",
  description: "T1 [XS] — [description]",
  prompt: `Tu es bug-hunter sur le projet CYNA.
    Tâche : [description détaillée]
    Fichiers à modifier : [liste]
    Critère de succès : [critère]
    Règles CLAUDE.md à respecter : [règles applicables]
    À la fin : confirmer avec "T1 terminé — [résumé]"`
})

Agent({
  subagent_type: "general-purpose",
  description: "T2 [S] — [description]",
  prompt: `Tu es un développeur React sur le projet CYNA.
    Tâche : [description détaillée]
    Fichiers à modifier : [liste]
    Critère de succès : [critère]
    À la fin : confirmer avec "T2 terminé — [résumé]"`
})
```

Après retour des agents, mettre à jour le board :

```
BOARD Ultra Plan — [Fonctionnalité]
══════════════════════════════════════

✅ TERMINÉ
  T1 [XS] · bug-hunter · guard NaN ajouté calculs.js:45 · ✓ build OK
  T2 [S]  · general    · composant MonFeature créé · ✓ s'affiche correctement

🔄 EN COURS
  T3 [M]  · rentabilite-analyst · connexion au contexte...

⏳ À FAIRE
  T4 [S]  · facturation-suisse · attend T3
  T5 [XS] · audit + tests · Sprint 3
```

---

### Phase 6 — Validation finale automatique

À la fin de chaque sprint, lancer systématiquement :

```bash
# Vérification build
CI=true npm run build 2>&1 | grep -E "Compiled|warning|error"

# Audit BTP — 0 critique requis
node scripts/audit-btp.js

# Vérification guards (signal d'alerte CLAUDE.md)
grep -rn "/ total\|\.toFixed(\|=== 'En cours'\|=== 'Planifié'" src/ --include="*.js" | grep -v node_modules
```

Critères de validation :
- Build : `Compiled successfully`
- Audit : `0 critique`
- Guards : aucun pattern fragile non protégé
- NaN/undefined : absents de l'UI

---

### Phase 7 — Commit de livraison

```bash
git add [fichiers modifiés]
git commit -m "feat(ultra-plan): [fonctionnalité] — [N] tâches / Sprint [X]

Tâches livrées :
- T1 [XS] : [description] (bug-hunter)
- T2 [S]  : [description] (general-purpose)
- T3 [M]  : [description] (rentabilite-analyst)

Build : Compiled successfully
Audit BTP : 0 critique

https://claude.ai/code/session_015UF12ZaB73iH4YE9Y6f2Ly"
git push -u origin claude/debug-terminal-issue-uvSBY
```

---

## Options

- `/ultra-plan [fonctionnalité]` — plan complet avec décomposition et sprints
- `/ultra-plan --quick [fonctionnalité]` — plan simplifié (XS/S uniquement, pas de phases)
- `/ultra-plan --risks [fonctionnalité]` — focus sur l'analyse des risques uniquement
- `/ultra-plan --board` — afficher le board du plan en cours
- `/ultra-plan --sprint N` — exécuter uniquement le Sprint N

---

## Règles Ultra Plan — Non négociables

1. **Jamais une tâche > L** : si une tâche est trop grande, la redécoupe
2. **Toujours un critère de succès** : sans critère, la tâche n'existe pas
3. **Guards BTP obligatoires** : chaque tâche avec calcul doit mentionner `ca > 0 ?` si pertinent
4. **Ordre release en fin de plan** :
   ```
   audit-btp.js → build → playwright-cyna → impeccable → mempalace
   ```
5. **Dépendances explicites** : "dépend de T1" ou "parallélisable" — jamais ambigu

---

## Intégration équipe

Ultra Plan travaille avec :
- `claude-task-master` — pour le suivi en temps réel des sprints
- `bug-hunter` — vérifie chaque tâche de correction
- `code-reviewer` — valide avant chaque commit de sprint
- `mempalace` — mémorise le plan et les décisions en fin de session
- `the-agency` — vérifie que les skills requis sont installés avant de lancer
