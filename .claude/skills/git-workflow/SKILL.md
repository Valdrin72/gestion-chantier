---
name: git-workflow
description: Git workflow CYNA — gestion propre des branches, commits conventionnels, PR templates, versioning semver. Invoque avec /git-workflow pour toute opération git complexe.
trigger: /git-workflow
---

# Skill : Git Workflow — Standards git CYNA

## Principe

Git Workflow garantit que toutes les opérations git sur CYNA suivent
les standards convenus : branches nommées, commits conventionnels,
audit BTP obligatoire avant chaque commit, et versioning semver cohérent.

**Un historique git propre = une équipe qui se comprend.**

---

## Quand l'utilisateur tape `/git-workflow`

### Structure des branches

```
main          → production (Vercel déploie depuis main)
  └── claude/feature-name    → branches de travail Claude
  └── hotfix/bug-description → corrections urgentes prod
```

**Branche de travail active** : `claude/debug-terminal-issue-uvSBY`

### Commits conventionnels (obligatoires)

```
feat(scope):      nouvelle fonctionnalité
fix(scope):       correction de bug
perf(scope):      amélioration performance
refactor(scope):  refactoring sans nouvelle feature
chore(scope):     maintenance, deps, config
docs(scope):      documentation uniquement
```

**Exemples CYNA :**
```
feat(factures): ajouter pagination PAGE_SIZE=50
fix(dashboard): supprimer pills période en doublon
perf(chantiers): wrapper calculerEtatChantier dans useMemo
chore(deps): npm audit fix - patches sécurité
refactor(calculs): extraire logique EAC dans utils/calculs.js
```

### Versioning semver CYNA

```
MAJOR.MINOR.PATCH
  2.1.0
  │ │ └── fix: bug corrigé, aucune breaking change
  │ └──── feat: nouvelle fonctionnalité ajoutée
  └────── MAJOR: refonte architecture ou breaking change
```

Consulter le CHANGELOG avant de bumper la version :
```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

### Workflow standard Claude Code

```bash
# 1. Créer une branche de travail
git checkout -b claude/nom-feature

# 2. Travailler, commiter souvent
git add src/MonFichier.js
git commit -m "feat(module): description"

# 3. Avant de pusher : audit obligatoire
node scripts/audit-btp.js

# 4. Pusher
git push -u origin claude/nom-feature

# 5. Merger dans main quand validé
git checkout main
git merge --no-ff claude/nom-feature
git push origin main
```

### Audit obligatoire avant commit

```bash
# 0 critique = commit autorisé
node scripts/audit-btp.js

# Vérifier le build
CI=true npm run build 2>&1 | grep -E "ERROR|error"
```

### PR Template CYNA

```markdown
## Résumé
- [ ] Fonctionnalité implémentée
- [ ] Tests Playwright passent
- [ ] audit-btp.js : 0 critique
- [ ] Pas de NaN/undefined dans l'UI

## Fichiers modifiés
- `src/...`

## Tests effectués
- [ ] Login/logout
- [ ] Flow principal testé
- [ ] Mobile vérifié (responsive)

## Screenshots
(avant / après si modification UI)
```

### Règles absolues

- **JAMAIS** `git push --force` sur `main`
- **TOUJOURS** `node scripts/audit-btp.js` avant commit
- **TOUJOURS** commiter depuis la branche `claude/...` en session
- **JAMAIS** commiter `.env.local` ou des clés API
- **TOUJOURS** `--no-ff` pour les merges (préserver l'historique)

---

## Options

- `/git-workflow` — afficher ce guide et vérifier l'état de la branche courante
- `/git-workflow --status` — git status + log des 5 derniers commits
- `/git-workflow --audit` — lancer l'audit BTP + build check avant commit
- `/git-workflow --pr` — générer un template de PR pour la branche courante
- `/git-workflow --release` — créer un tag de release semver

---

## Commandes de diagnostic

```bash
# État de la branche
git status
git log --oneline -10

# Diff complet
git diff HEAD

# Vérifier que tout est propre avant merge
git stash list
git log origin/main..HEAD --oneline
```

---

## Intégration équipe

Git Workflow travaille avec :
- `code-reviewer` — revue de code avant PR
- `bug-hunter` — scan automatique avant commit
- `darwin` (skill) — évolution du code par génération
- `security-auditor` — vérification sécurité des fichiers modifiés
