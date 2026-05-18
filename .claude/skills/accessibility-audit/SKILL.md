---
name: accessibility-audit
description: Audit accessibilité WCAG 2.1 pour l'app CYNA — contraste couleurs, aria-labels, navigation clavier, focus visible, tailles touch mobile. Invoque avec /a11y pour un audit complet avant release.
trigger: /a11y
---

# Skill : Accessibility Audit — WCAG 2.1 niveau AA pour CYNA Gestion Chantier

## Quand l'utilisateur tape `/a11y`

---

## Critères prioritaires pour une app BTP

### 1. Contraste (WCAG 1.4.3)
- Ratio minimum : 4.5:1 pour texte normal, 3:1 pour grands textes
- Vérifier dans `src/index.css` : variables `--text-primary`, `--text-secondary`, `--text-muted`
- Tester en dark mode ET light mode

```bash
grep -n "color:\|background:" src/index.css | head -40
```

### 2. Navigation clavier (WCAG 2.1.1)
- Tous les boutons accessibles via Tab
- Pas de pièges clavier (modals doivent avoir Escape)
- Focus visible sur tous les éléments interactifs

```bash
grep -n "onKeyDown\|tabIndex\|aria-" src/ -r --include="*.js" | wc -l
```

### 3. Labels formulaires (WCAG 1.3.1)
- Chaque input doit avoir un `<label>` ou `aria-label`
- Vérifier tous les formulaires : devis, chantier, facture, client

```bash
grep -rn "<input\|<select\|<textarea" src/ --include="*.js" | grep -v "aria-label\|htmlFor\|id=" | wc -l
```

### 4. Images et icônes (WCAG 1.1.1)
- Toutes les `<img>` ont un `alt`
- Les icônes décoratives (Lucide) ont `aria-hidden="true"` ou `title`
- Logo CYNA : `alt="CYNA Tech"`

### 5. Tailles touch mobile (WCAG 2.5.5)
- Minimum 44×44px pour les éléments tactiles
- Vérifier les boutons pills, icônes action dans les tableaux

### 6. Annonces dynamiques (WCAG 4.1.3)
- Les notifications `afficherNotif()` devraient avoir `role="alert"` ou `aria-live="polite"`
- Les modals devraient avoir `role="dialog"` et `aria-labelledby`

---

## Rapport d'audit

```
╔══════════════════════════════════════╗
║  A11Y AUDIT — CYNA App               ║
╠══════════════════════════════════════╣
║ Contraste         : ✅ / ⚠️  / ❌     ║
║ Navigation clavier: ✅ / ⚠️  / ❌     ║
║ Labels forms      : ✅ / ⚠️  / ❌     ║
║ Alt images        : ✅ / ⚠️  / ❌     ║
║ Touch targets     : ✅ / ⚠️  / ❌     ║
╠══════════════════════════════════════╣
║ Score WCAG 2.1 AA : XX/100           ║
╚══════════════════════════════════════╝
```

---

## Corrections automatiques appliquées

- Ajouter `aria-label` sur les boutons icônes sans texte
- Ajouter `role="alert"` sur le composant de notification
- Ajouter `alt` manquants sur les `<img>`
- Ajouter `title` sur les icônes Lucide dans les tableaux

---

## Options

- `/a11y` — audit complet avec rapport
- `/a11y --fix` — audit + corrections automatiques
- `/a11y --contraste` — focus sur les ratios de contraste uniquement
- `/a11y --forms` — focus sur les labels de formulaires
- `/a11y --mobile` — focus sur les touch targets mobile

---

## Intégration équipe

Accessibility Audit travaille avec :
- `taste-skill` (skill) — complète l'audit visuel (design) avec l'audit accessibilité
- `playwright-cyna` (skill) — teste la navigation clavier dans un vrai navigateur
- `impeccable` (skill) — inclut l'a11y dans le passage de perfection avant release
- `security-auditor` — partage la revue des formulaires (validation + labels)
