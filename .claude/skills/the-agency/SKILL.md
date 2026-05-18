---
name: the-agency
description: The Agency — orchestrateur d'installation et d'activation de skills CYNA. Scanne le registre des skills disponibles, installe ceux demandés, configure les triggers, et vérifie l'intégration dans team-manifest.md. Invoque avec /the-agency.
trigger: /the-agency
---

# Skill : The Agency — Gestionnaire de Skills CYNA

## Rôle

The Agency est le gestionnaire centralisé de l'équipe CYNA. Il permet d'installer, activer,
désactiver et configurer les skills disponibles. Il connaît tous les skills existants,
vérifie leur présence dans `.claude/skills/`, et maintient la cohérence avec `team-manifest.md`.

**Principe :** Aucun skill ne s'installe dans l'ombre. Chaque installation est vérifiée,
documentée et annoncée. The Agency garantit que l'équipe est toujours à jour et opérationnelle.

---

## Quand l'utilisateur tape `/the-agency [commande]`

### Commandes disponibles

```
/the-agency list          → lister tous les skills installés avec leur trigger
/the-agency install X     → installer le skill X (déléguer à skill-creator)
/the-agency status        → rapport complet : skills actifs, triggers, couverture
/the-agency audit         → vérifier que tous les skills du team-manifest sont installés
/the-agency upgrade X     → mettre à jour le skill X avec les nouvelles règles CYNA
/the-agency [nom-skill]   → afficher l'état d'un skill spécifique
```

---

### `/the-agency list` — Inventaire des skills

```bash
# Scanner tous les skills installés
ls /home/user/gestion-chantier/.claude/skills/
```

Pour chaque dossier trouvé, lire le frontmatter `SKILL.md` et extraire :
- `name` : identifiant du skill
- `trigger` : commande d'activation
- `description` : résumé en une ligne

Afficher le rapport :

```
╔═══════════════════════════════════════════════════════════╗
║              THE AGENCY — CYNA Skills Registry            ║
╠═══════════════════════════════════════════════════════════╣
║ ✅ darwin              /darwin                            ║
║ ✅ impeccable          /impeccable                        ║
║ ✅ taste-skill         /taste-skill                       ║
║ ✅ mempalace           /mempalace                         ║
║ ✅ playwright-cyna     /playwright-cyna                   ║
║ ✅ claude-task-master  /claude-task-master                ║
║ ✅ skill-creator       /skill-creator                     ║
║ ✅ caveman             /caveman                           ║
║ ✅ graph-skill         /graph-skill                       ║
║ ✅ ultra-plan          /ultra-plan                        ║
║ ✅ the-agency          /the-agency                        ║
║ ...                                                       ║
╚═══════════════════════════════════════════════════════════╝
Total : [N] skills installés
```

---

### `/the-agency [nom-skill]` — État d'un skill spécifique

1. Scanner `.claude/skills/` pour vérifier si le skill existe
2. **Si oui** : lire `SKILL.md` et afficher :
   ```
   SKILL : darwin
   ══════════════════════════════
   Statut    : ✅ Installé
   Trigger   : /darwin
   Dossier   : .claude/skills/darwin/
   Manifest  : ✅ Présent dans team-manifest.md
   Description : Évolution continue du code CYNA...
   ```
3. **Si non** : proposer l'installation
   ```
   SKILL : [nom] — Non trouvé
   ══════════════════════════════
   Ce skill n'est pas installé dans .claude/skills/
   Taper "/the-agency install [nom]" pour l'installer
   Skills disponibles dans le registre : [liste]
   ```

---

### `/the-agency install X` — Installation d'un skill

Déléguer la création au skill `skill-creator` avec les instructions exactes :

1. Vérifier que le skill n'est pas déjà installé :
   ```bash
   ls /home/user/gestion-chantier/.claude/skills/ | grep "^X$"
   ```
2. Si absent → invoquer `/skill-creator X` pour créer le skill
3. Vérifier la création :
   ```bash
   cat /home/user/gestion-chantier/.claude/skills/X/SKILL.md
   ```
4. Ajouter le skill dans `team-manifest.md` si absent
5. Confirmer l'installation :
   ```
   ✅ Skill [X] installé avec succès
   Trigger : /X
   Dossier : .claude/skills/X/
   Manifest : mis à jour
   ```

---

### `/the-agency status` — Rapport complet

Rapport détaillé sur l'état de l'équipe :

```
THE AGENCY — Rapport d'état CYNA [date]
══════════════════════════════════════════
Skills installés    : [N]
Skills en registre  : [M]
Couverture          : [N/M × 100]%
Manquants           : [liste ou "aucun"]

DOMAINES COUVERTS :
  ✅ Métier BTP       : facturation-suisse, rentabilite-analyst, planning-chantier
  ✅ Qualité code     : bug-hunter, code-reviewer, security-auditor, darwin
  ✅ Métrés           : faux-plancher-metrage, faux-plafond-metrage
  ✅ Design           : taste-skill, huashu-design, playwright-cyna, impeccable
  ✅ Mémoire          : mempalace, claude-task-master, ultra-plan
  ✅ Légal            : cct-sor, sia-118, tva-suisse, charges-sociales-suisse
  ✅ Orchestration    : the-agency, skill-creator, claude-task-master

RECOMMANDATIONS :
  [Liste des skills manquants ou à mettre à jour]
```

---

### `/the-agency audit` — Vérification cohérence

Vérifier que tous les skills mentionnés dans `team-manifest.md` sont bien installés :

```bash
# Lire les skills référencés dans le manifest
grep -o '`[a-z-]*` (skill)' /home/user/gestion-chantier/.claude/team-manifest.md | sed "s/\` (skill)//g" | sed "s/\`//g"

# Comparer avec les dossiers présents
ls /home/user/gestion-chantier/.claude/skills/
```

Rapport d'audit :
```
AUDIT — Cohérence team-manifest ↔ .claude/skills/
════════════════════════════════════════════════════
✅ darwin          → .claude/skills/darwin/ ✓
✅ mempalace       → .claude/skills/mempalace/ ✓
✅ caveman         → .claude/skills/caveman/ ✓
❌ [skill-manquant] → .claude/skills/[skill-manquant]/ ✗ ABSENT
════════════════════════════════════════════════════
Résultat : [N] OK, [M] manquants
Action   : Taper "/the-agency install [skill-manquant]" pour corriger
```

---

### `/the-agency upgrade X` — Mise à jour d'un skill

Mettre à jour le skill X avec les dernières règles CYNA :

1. Lire le `SKILL.md` actuel
2. Identifier ce qui est obsolète ou manquant par rapport à `CLAUDE.md`
3. Mettre à jour le skill en appliquant les nouvelles règles
4. Vérifier la cohérence avec `team-manifest.md`
5. Confirmer la mise à jour avec le diff des changements

---

## Registre The Agency — Skills connus pour CYNA

The Agency connaît ces skills disponibles pour l'installation :

### Skills Core (développement)
- `darwin` — Évolution continue du code, sélection naturelle des patterns
- `caveman` — Débogage primitif, isolation couche par couche
- `skill-creator` — Création de nouveaux skills au bon format
- `claude-task-master` — Orchestrateur de sprints multi-agents
- `ultra-plan` — Planification maximale de fonctionnalités complexes
- `the-agency` — Gestionnaire de skills (ce skill)

### Skills Design & UX
- `impeccable` — Perfection absolue avant release majeure
- `taste-skill` — Bon goût UI/UX, cohérence visuelle
- `huashu-design` — Design system vivant CYNA
- `playwright-cyna` — Tests navigateur automatisés

### Skills Mémoire & Intelligence
- `mempalace` — Palais de la mémoire, graphe de connaissances
- `graph-skill` — Cartographie Obsidian des entités
- `react-state-patterns` — Patterns React, hooks, état
- `memory-write-patterns` — Patterns d'écriture dans Memory MCP

### Skills Métier BTP Suisse
- `tva-suisse` — TVA suisse, calculs et règles
- `charges-sociales-suisse` — Charges sociales Genève 2024
- `cct-sor` — CCT Second Œuvre Romand, droits employés
- `sia-118` — Norme SIA 118, garanties et réception
- `qr-facture` — Format QR-facture SIX Group
- `chf-formatting` — Formatage montants CHF
- `numero-format-cyna` — Numérotation devis/factures/chantiers

### Skills Métrés
- `faux-plancher-metrage` — Métrés faux-planchers
- `faux-plafond-metrage` — Métrés faux-plafonds
- `productivite-cyna` — Ratios de production BTP

### Skills Sécurité & Architecture
- `security-scan` — Scan de sécurité avec auto-fix
- `security-hardening` — Durcissement sécurité
- `supabase-sync` — Synchronisation Supabase ↔ localStorage
- `rbac-patterns` — Contrôle d'accès par rôle
- `permissions-patterns` — Patterns de permissions

### Skills Utilitaires
- `date-utils-cyna` — Calculs de dates, jours ouvrables, fériés genevois
- `btp-risks-catalogue` — Catalogue des risques BTP Genève
- `veille-auto` — Surveillance dépendances et légal suisse
- `backup-recovery` — Procédures de backup et récupération
- `claude-small-business` — Fonctionnalités petite entreprise
- `claude-financial-service` — Services financiers Claude

---

## Intégration équipe

The Agency coordonne :
- `skill-creator` — pour créer les nouveaux skills
- `mempalace` — pour mémoriser les installations et upgrades
- `team-manifest.md` — maintenu à jour à chaque opération
