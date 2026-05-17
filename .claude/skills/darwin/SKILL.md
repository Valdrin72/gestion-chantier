---
name: darwin
description: Évolution continue du code CYNA — analyse les patterns de bugs passés, applique la sélection naturelle sur le code (supprime le fragile, renforce le robuste), et propose des mutations intelligentes. Le code le plus adapté survit.
trigger: /darwin
---

# Skill : Darwin — Évolution intelligente du code CYNA

## Principe

Darwin ne corrige pas un bug à la fois. Il identifie les **patterns récurrents de fragilité**
dans le code, et applique une évolution systématique : les structures qui ont causé des bugs
sont remplacées par des structures plus robustes, partout dans le codebase.

**Sélection naturelle du code** : les patterns fragiles disparaissent, les patterns robustes se propagent.

---

## Quand l'utilisateur tape `/darwin`

### Phase 1 — Analyse génétique (lire l'historique)

```bash
# Identifier les zones de code les plus modifiées (les moins stables = les moins adaptées)
git log --oneline --since="30 days ago" src/ | head -30

# Trouver les bugs récurrents (commits avec "fix:")
git log --oneline --grep="fix:" --since="90 days ago" | head -20

# Zones les plus touchées
git log --since="90 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -15
```

### Phase 2 — Identifier les gènes fragiles

Patterns à éliminer (ADN défectueux) :

```
⚠️ Divisions sans guard          → / total    sans vérifier total > 0
⚠️ .toFixed() qui retourne string → utiliser Math.round()
⚠️ Comparaisons casse-sensitive   → statut === 'En cours' sans .toLowerCase()
⚠️ parseInt() sur des IDs        → String() est plus sûr
⚠️ window.confirm()              → déjà remplacé — confirmer que c'est fait
⚠️ console.log en production     → process.env.NODE_ENV guard
⚠️ useEffect sans cleanup        → risque de fuite mémoire
⚠️ Calculs dans le render        → déplacer dans useMemo
```

Lancer le scan :
```bash
grep -rn "/ total\|\.toFixed(\|=== 'En cours'\|=== 'Planifié'\|parseInt(.*[Ii]d\|window\.confirm\|console\.log" src/ --include="*.js" | grep -v node_modules
```

### Phase 3 — Mutations évolutives

Pour chaque pattern fragile trouvé :

1. **Évaluer l'impact** : combien de fichiers affectés ?
2. **Appliquer la mutation** dans tous les fichiers concernés
3. **Vérifier que le code compile** : `CI=true npm run build`
4. **Documenter la mutation** dans le rapport

Mutations prioritaires (par ordre darwinien) :

| Gène fragile | Mutation robuste | Priorité |
|-------------|-----------------|----------|
| `/ total` | `total > 0 ? val / total : null` | 🔴 Critique |
| `.toFixed(1)` | `Math.round(val * 10) / 10` | 🟠 Important |
| `statut === 'X'` | `statut?.toLowerCase() === 'x'` | 🟠 Important |
| `parseInt(id)` | `String(id)` | 🟡 Note |
| `console.log(` | Guard `NODE_ENV` | 🟡 Note |

### Phase 4 — Rapport d'évolution

```
🧬 CYNA Darwin — Rapport d'évolution [date]
═══════════════════════════════════════════
Génération analysée : 90 derniers jours
Mutations appliquées : X
Gènes fragiles éliminés : Y
Fichiers renforcés : Z

🔬 Mutations appliquées :
  ✅ [fichier:ligne] Pattern X → Pattern Y
  ...

🧫 Gènes fragiles restants (backlog) :
  ⚠️ [fichier:ligne] Description
  ...

📈 Indicateur de robustesse : [score avant] → [score après]
```

### Phase 5 — Commit évolutif

```bash
git add [fichiers mutés]
git commit -m "refactor(darwin): évolution génération [N] — [résumé mutations]"
git push -u origin claude/debug-terminal-issue-uvSBY
```

---

## Options

- `/darwin` — analyse + rapport sans modification
- `/darwin --evolve` — analyse + applique toutes les mutations sûres
- `/darwin --evolve src/donnees.js` — évolution ciblée sur un fichier
- `/darwin --generations 3` — analyse les 3 dernières "générations" (mois)

---

## Intégration équipe

Darwin travaille avec :
- `pattern-learner` — partage les patterns détectés dans la mémoire
- `bug-hunter` — valide que les mutations ne créent pas de nouveaux bugs
- `code-reviewer` — vérifie la qualité des mutations avant commit
