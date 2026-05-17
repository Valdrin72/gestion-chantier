---
name: veille-auto
description: Veille technologique automatique CYNA — surveille les dépendances obsolètes, les vulnérabilités npm, les mises à jour React/Supabase, et les nouvelles pratiques BTP numériques. Garde l'app toujours à jour et sécurisée. Invoquer avec /veille-auto.
trigger: /veille-auto
---

# Skill : Veille Auto — Intelligence Technologique CYNA

## Rôle

Veille-auto est l'agent d'intelligence technologique de CYNA. Il surveille :
- L'état des dépendances npm (sécurité + obsolescence)
- Les nouvelles versions des frameworks utilisés (React, Supabase)
- Les pratiques BTP numériques émergentes à Genève
- Les changements légaux/fiscaux suisses impactant l'app

---

## Quand l'utilisateur tape `/veille-auto`

### Phase 1 — Audit des dépendances

```bash
# Vulnérabilités de sécurité
npm audit --audit-level=moderate 2>&1 | head -40

# Packages obsolètes
npm outdated 2>&1 | head -30

# Version actuelle de React et Supabase
grep -E '"react"|"@supabase"' package.json | head -10

# Taille du bundle (régression de performance ?)
ls -lh build/static/js/main.*.js 2>/dev/null | awk '{print $5, $9}'
```

### Phase 2 — Analyser les résultats

**Catégoriser chaque package obsolète :**

| Criticité | Critères | Action |
|-----------|----------|--------|
| 🔴 Critique | Vulnérabilité CVE, majeure breaking change | Mettre à jour immédiatement |
| 🟠 Important | Minor update disponible depuis > 3 mois | Planifier mise à jour |
| 🟡 Note | Patch update disponible | Peut attendre |
| ✅ OK | Version récente, pas de vulnérabilité | Rien à faire |

### Phase 3 — Veille framework

**React 18 → React 19 :**
Vérifier si des fonctionnalités de React 19 bénéficieraient à CYNA :
- Compiler React (auto-mémoïsation — remplacerait les `useMemo` manuels)
- Server Components (non applicable — app SPA)
- `useOptimistic` (utile pour les mises à jour Supabase optimistes)

```bash
# Version React actuelle
node -e "const r = require('./node_modules/react/package.json'); console.log('React:', r.version)"
```

**Supabase JS Client :**
```bash
# Version Supabase client
grep '"@supabase/supabase-js"' package.json
# Vérifier changelog si < dernière version
```

**Nouveautés importantes à surveiller :**
- Supabase Realtime (mises à jour temps réel des chantiers)
- Supabase Edge Functions (logique serveur sécurisée)
- React Compiler (performances automatiques)

### Phase 4 — Veille légale/fiscale suisse

Vérifier si des changements légaux nécessitent une mise à jour de l'app :

```
Éléments à surveiller :
☐ Taux TVA suisse (actuellement 8.1% — stable jusqu'à 2026)
☐ Taux AVS/AC/LPP (mise à jour annuelle au 1er janvier)
☐ CCT-SOR (Convention Collective Romande) — révision annuelle
☐ OASI/AVS — plafond annuel (148'200 CHF/an pour AC)
☐ Jours fériés genevois — mise à jour si nécessaire dans date-utils-cyna
```

Fichiers CYNA à vérifier si changement légal :
```bash
# Taux AVS/charges sociales
grep -n "5\.30\|1\.10\|2\.94\|1\.35\|148" src/donnees.js src/pages/EmployesPage.js

# TVA
grep -n "8\.1\|0\.081" src/ -r --include="*.js" | head -10

# Jours fériés GE
grep -n "jours.*feries\|ferie" src/ -r --include="*.js" | head -10
```

### Phase 5 — Veille BTP numérique Genève

Domaines à surveiller pour les prochaines fonctionnalités CYNA :

```
📱 Outils terrain :
  - Applications de relevé de métrés sur mobile
  - Intégration plans DWG/IFC dans devis
  - Signature électronique pour les devis (eIDAS/CO Suisse)

📊 Reporting BTP Genève :
  - Format SUVA pour déclaration accidents
  - Interface OCIRT (Office cantonal de l'inspection et des relations du travail)
  - e-Décompte LPP (prévoyance professionnelle)

🔗 Intégrations potentielles :
  - API e-Facture Swiss (QR-facture automatisée)
  - CREG (Registre cantonal genevois des entreprises)
  - OFAS (prévoyance vieillesse Suisse)
```

### Phase 6 — Rapport de veille

```
📡 CYNA VEILLE AUTO — [date]
════════════════════════════════════════════════

🔒 SÉCURITÉ npm :
  [CRITIQUE] X vulnérabilités → action immédiate
  [MODÉRÉ]   Y vulnérabilités → planifier
  ✅ Aucune vulnérabilité critique détectée

📦 DÉPENDANCES OBSOLÈTES :
  Package              Actuel    Dernier   Action
  react                18.2.0    19.0.0    Évaluer migration
  @supabase/supabase-js 2.x      2.y       Mettre à jour
  [...]

⚖️ VEILLE LÉGALE :
  ✅ TVA 8.1% — conforme
  ✅ Taux AVS 5.30% — conforme
  ⚠️ Nouveau taux LPP au 01.01.2026 → à vérifier

🚀 OPPORTUNITÉS TECHNOLOGIQUES :
  • React Compiler (19) — réduirait les useMemo de 40%
  • Supabase Realtime — chantiers en temps réel
  • QR-facture API Swiss — facturation automatisée

📋 ACTIONS RECOMMANDÉES :
  1. [Priorité HAUTE] Mettre à jour [package] (sécurité)
  2. [Priorité MOYENNE] Évaluer React 19
  3. [Priorité BASSE] Veiller taux LPP 2026
```

### Phase 7 — Mises à jour automatiques (si --update)

Pour les patches sûrs (patch version uniquement) :
```bash
# Mettre à jour les patches uniquement (sûr)
npm update --save

# Vérifier que le build passe
CI=true npm run build

# Si OK, committer
git add package.json package-lock.json
git commit -m "chore(deps): mise à jour patches sécurité [date] — veille-auto"
git push -u origin claude/debug-terminal-issue-uvSBY
```

---

## Options

- `/veille-auto` — rapport complet (lecture seule)
- `/veille-auto --npm` — uniquement les dépendances npm
- `/veille-auto --legal` — uniquement la veille légale/fiscale
- `/veille-auto --update` — met à jour les patches sûrs automatiquement
- `/veille-auto --breaking` — identifie les mises à jour avec breaking changes

---

## Fréquence recommandée

| Contexte | Fréquence |
|----------|-----------|
| Avant chaque release en production | Obligatoire |
| Routine développement | Mensuelle |
| Après incident sécurité | Immédiate |
| Début d'année | Obligatoire (taux légaux) |

---

## Intégration équipe

Veille-auto travaille avec :
- `security-auditor` — confirme les vulnérabilités npm détectées
- `security-hardening` — applique les corrections de sécurité
- `cct-compliance` — vérifie si la CCT-SOR a changé
- `charges-sociales-suisse` — met à jour les taux si changement légal
- `darwin` — les dépendances obsolètes sont des gènes fragiles à faire évoluer
