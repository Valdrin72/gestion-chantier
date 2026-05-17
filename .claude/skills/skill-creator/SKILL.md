---
name: skill-creator
description: Créateur de skills CYNA — génère automatiquement un nouveau skill parfaitement formaté dans .claude/skills/. Analyse le besoin, choisit le bon template, et crée le fichier SKILL.md prêt à l'emploi. Met aussi à jour le team-manifest.md.
trigger: /skill-creator
---

# Skill : Skill Creator — Fabrique de Skills CYNA

## Rôle

Ce skill crée de nouveaux skills pour l'équipe CYNA. Il garantit que chaque nouveau
skill respecte le format officiel, s'intègre dans le bon domaine d'équipe, et
est immédiatement opérationnel.

---

## Quand l'utilisateur tape `/skill-creator [nom] [description]`

### Phase 1 — Analyser le besoin

Poser ces questions si l'info manque :
1. Quel est le nom du skill ? (snake-case, ex: `mon-skill`)
2. Quel problème résout-il ?
3. Dans quelle équipe l'intégrer ? (Métier BTP / Qualité Code / Métrés / Légal / Innovation)
4. Est-ce un skill "action" (fait quelque chose) ou "référence" (donne de l'info) ?
5. Doit-il lancer des agents ? Si oui, lesquels ?

### Phase 2 — Choisir le bon template

**Template ACTION** (skill qui fait des choses) :
- Lance des agents, modifie du code, génère des fichiers
- Ex: `/security-scan`, `/darwin`, `/caveman`

**Template RÉFÉRENCE** (skill qui donne de l'info) :
- Répond à des questions avec des données métier
- Ex: `/tva-suisse`, `/cct-sor`, `/charges-sociales-suisse`

**Template HYBRIDE** (info + action) :
- Analyse puis corrige
- Ex: `/graph-skill`, `/backup-recovery`

### Phase 3 — Créer le fichier

Créer le dossier et le fichier SKILL.md :

```bash
mkdir -p /home/user/gestion-chantier/.claude/skills/[nom-skill]
```

Format obligatoire du SKILL.md :

```markdown
---
name: [nom-skill]
description: [Description courte — une phrase. Commence par ce que le skill fait, se termine par quand l'invoquer.]
trigger: /[nom-skill]
---

# Skill : [Nom Lisible] — [Sous-titre]

## [Section principale]

[Contenu du skill]

---

## Options

- `/[nom-skill]` — usage de base
- `/[nom-skill] --[option]` — usage avancé

---

## Intégration équipe

[Nom-skill] travaille avec :
- `[agent-1]` — [pourquoi]
- `[agent-2]` — [pourquoi]
```

### Phase 4 — Mettre à jour le team-manifest.md

Ajouter le nouveau skill dans la bonne section du manifeste :

```bash
# Vérifier la section cible
grep -n "DOMAINE\|Équipe" /home/user/gestion-chantier/.claude/team-manifest.md
```

Ajouter une ligne dans le tableau de la section appropriée :
```markdown
| `[nom-skill]` (skill) | [Description courte] | [Déclencheur] |
```

### Phase 5 — Valider

```bash
# Vérifier que le skill est détecté
ls /home/user/gestion-chantier/.claude/skills/[nom-skill]/

# Vérifier le format YAML frontmatter
head -6 /home/user/gestion-chantier/.claude/skills/[nom-skill]/SKILL.md
```

### Phase 6 — Commit

```bash
git add .claude/skills/[nom-skill]/ .claude/team-manifest.md
git commit -m "feat(skills): ajout skill [nom-skill] — [description courte]"
git push -u origin claude/debug-terminal-issue-uvSBY
```

### Phase 7 — Rapport

```
✅ SKILL CRÉÉ — [nom-skill]
═══════════════════════════════════
Fichier : .claude/skills/[nom-skill]/SKILL.md
Déclencheur : /[nom-skill]
Équipe : [nom équipe]
Type : [ACTION|RÉFÉRENCE|HYBRIDE]

Usage :
  /[nom-skill] — [description usage de base]

Prochaines étapes :
  1. Tester avec /[nom-skill] pour vérifier le comportement
  2. Ajuster le SKILL.md si besoin
  3. Partager avec l'équipe dans team-manifest.md
```

---

## Templates prêts à l'emploi

### Template ACTION minimal

```markdown
---
name: mon-skill
description: Ce que ça fait — invoquer avec /mon-skill pour [cas d'usage].
trigger: /mon-skill
---

# Skill : Mon Skill — Sous-titre

## Ce que fait ce skill

[Description du comportement quand /mon-skill est tapé]

### Étape 1 — [Nom]
[Instructions]

### Étape 2 — [Nom]
[Instructions]

---

## Options
- `/mon-skill` — usage de base
- `/mon-skill --option` — usage avancé

---

## Intégration équipe
Mon-skill travaille avec :
- `bug-hunter` — [raison]
```

---

## Options

- `/skill-creator [nom]` — crée un skill vide avec template
- `/skill-creator [nom] "[description]"` — crée avec description
- `/skill-creator [nom] --template action` — force le template ACTION
- `/skill-creator [nom] --template reference` — force le template RÉFÉRENCE
- `/skill-creator --list` — liste tous les skills existants avec leur statut
- `/skill-creator --audit` — vérifie que tous les skills ont le bon format

---

## Intégration équipe

Skill-creator travaille avec :
- `memory-keeper` — mémorise le nouveau skill dans le graphe de connaissances
- `code-reviewer` — vérifie le format du SKILL.md créé
- `darwin` — le nouveau skill peut cibler des patterns fragiles identifiés
