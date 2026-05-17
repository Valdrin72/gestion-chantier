---
name: taste-skill
description: Bon goût UI/UX CYNA — audite l'interface avec l'œil d'un designer exigeant. Vérifie la cohérence visuelle, la typographie, les espacements, les couleurs, la hiérarchie de l'information et le ressenti utilisateur. Invoquer avec /taste-skill pour améliorer l'esthétique et l'ergonomie de l'app.
trigger: /taste-skill
---

# Skill : Taste Skill — Le Bon Goût au Service du BTP

## Philosophie

Le bon goût, c'est ce qu'on ne voit pas quand tout va bien.
C'est l'espace juste entre deux éléments, la couleur qui ne fatigue pas l'œil,
le texte qu'on lit sans effort, le bouton qu'on trouve sans chercher.

Pour CYNA — une app utilisée sur chantier, parfois avec des gants, souvent sous
le soleil sur mobile — le bon goût n'est pas décoratif. Il est **fonctionnel**.

---

## Quand l'utilisateur tape `/taste-skill`

### Couche 1 — Cohérence du Design System

Vérifier que `ds.js` (design tokens) est correctement utilisé partout :

```bash
# Chercher les couleurs hardcodées hors ds.js
grep -rn "#[0-9a-fA-F]\{3,6\}" src/ --include="*.js" | grep -v "ds\.js\|index\.css\|//\|'#0d3d6e'\|'#10b981'\|'#ef4444'" | head -30

# Chercher les tailles de police hardcodées
grep -rn "fontSize: [0-9]" src/ --include="*.js" | grep -v "ds\.js\|//\|12\|13\|14\|15\|16\|18" | head -20

# Valider que DS.card, DS.input, DS.btnPrimary sont utilisés
grep -rn "border-radius\|padding.*px\|margin.*px" src/pages/ --include="*.js" | grep -v "DS\.\|ds\.\|style={DS\|var(--" | head -20
```

**Tokens CYNA (ds.js) à respecter :**
```
Couleur primaire : #0d3d6e (brand bleu nuit)
Couleur succès   : #10b981 (vert)
Couleur danger   : #ef4444 (rouge)
Couleur warning  : #f59e0b (amber)
Rayon standard   : 8-12px
Shadow card      : 0 2px 8px rgba(0,0,0,0.08)
```

### Couche 2 — Typographie

```bash
# Chercher les fontWeight non standard
grep -rn "fontWeight: [0-9]" src/ --include="*.js" | grep -v "400\|500\|600\|700\|800\|ds\.\|//\|DS\." | head -15

# Textes trop longs sans truncate
grep -rn "fontSize: 11\|fontSize: 10\|fontSize: 9" src/ --include="*.js" | head -10
```

**Règles typographiques CYNA :**
- Titre page : `font-size 24px, font-weight 700`
- Sous-titre : `font-size 13-14px, color var(--text-secondary)`
- Labels form : `font-size 12px, font-weight 600, uppercase` (optionnel)
- Valeurs KPI : `font-size 28-32px, font-weight 800`
- Corps texte : `font-size 14px, line-height 1.6`
- Micro-texte : minimum `font-size 11px` (accessibilité)

### Couche 3 — Espacement et Rythme

```bash
# Vérifier l'usage des gaps et paddings
grep -rn "gap: [0-9]\|padding: [0-9]\|margin: [0-9]" src/pages/ --include="*.js" | head -20
```

**Grille d'espacement CYNA (multiples de 4px) :**
```
4px  — micro-espacement (entre icône et texte)
8px  — espacement interne (padding bouton)
12px — espacement moyen (entre éléments d'une card)
16px — espacement standard (padding card)
24px — espacement large (entre sections)
32px — espacement XL (entre blocs)
```

Mauvais espacement : `gap: 7px` ou `padding: 11px` → arrondir au multiple de 4.

### Couche 4 — Hiérarchie Visuelle

Vérifier que l'information la plus importante est la plus visible :

**Checklist par page :**
- [ ] Le titre de la page est-il immédiatement identifiable ?
- [ ] Les KPIs sont-ils en évidence (grands, colorés) ?
- [ ] Les actions primaires (bouton principal) sont-elles en bleu `#0d3d6e` ?
- [ ] Les actions destructives (supprimer) sont-elles en rouge `#ef4444` ?
- [ ] Les alertes critiques sont-elles visuellement distinctes ?
- [ ] La navigation mobile est-elle utilisable avec le pouce ?

```bash
# Chercher les boutons danger qui ne sont pas en rouge
grep -rn "Supprimer\|Effacer\|Annuler" src/ --include="*.js" | grep "button" | grep -v "ef4444\|danger\|btnDanger\|DS\.btn" | head -10
```

### Couche 5 — Mobile First (Chantier)

L'app est utilisée sur chantier, souvent sur mobile/tablette avec des gants :

```bash
# Zones cliquables trop petites (< 44px recommandé iOS)
grep -rn "padding: '4px\|padding: '5px\|padding: '6px" src/ --include="*.js" | head -15

# Tables sans scroll horizontal sur mobile
grep -rn "<table\|overflow.*auto\|overflowX" src/ --include="*.js" | head -10
```

**Standards mobile CYNA :**
- Zone cliquable minimum : `44×44px` (Apple HIG)
- Texte minimum : `14px` (lisible en plein soleil)
- Contraste minimum : ratio 4.5:1 (WCAG AA)
- Navigation mobile : 4 items max visibles
- Formulaires : champs assez larges pour input tactile

### Couche 6 — États et Feedback

```bash
# Boutons sans état hover/focus visible
grep -rn "cursor: 'pointer'" src/ --include="*.js" | grep -v "transition\|hover\|:hover" | head -15

# Actions sans feedback (return silencieux)
grep -rn "return;\|return$" src/pages/ --include="*.js" | grep -v "null\|false\|true\|//" | head -15
```

**Règle** : chaque action utilisateur doit avoir un feedback visible sous 200ms :
- Sauvegarde → toast vert `afficherNotif('Sauvegardé')`
- Suppression → toast avec compte rendu
- Erreur → message inline rouge sous le champ
- Chargement → spinner ou barre de progression

### Phase finale — Rapport Taste

```
🎨 TASTE SKILL — CYNA [date]
════════════════════════════════════════════
Score design : [★★★★☆]

Couche 1 — Design System
  ✅ Couleurs DS : [N] hardcoded → corrigées
  ⚠️ [N] spacing non multiple de 4 → backlog

Couche 2 — Typographie
  ✅ Hiérarchie : cohérente
  ⚠️ [N] textes < 12px → augmenter

Couche 3 — Mobile
  ✅ Navigation mobile : 4 items
  ⚠️ [N] zones cliquables < 44px → augmenter padding

Couche 4 — Feedback
  ✅ Notifications : toasts en place
  ⚠️ [N] actions silencieuses → ajouter afficherNotif

Améliorations appliquées : [N]
Backlog design : [N] items

"Le bon goût, c'est quand l'utilisateur ne pense pas à l'interface."
```

---

## Options

- `/taste-skill` — audit complet 6 couches
- `/taste-skill --mobile` — focus mobile/chantier
- `/taste-skill --tokens` — vérifier uniquement la cohérence DS
- `/taste-skill --fix` — corriger les incohérences visuelles non destructives
- `/taste-skill --page [nom]` — auditer une page spécifique

---

## Intégration équipe

Taste Skill travaille avec :
- `huashu-design` — pour les décisions de design system plus profondes
- `impeccable` — Taste audite l'UX, Impeccable audite le code
- `playwright-cyna` — pour prendre des screenshots et valider visuellement
- `dashboard-architect` — pour la disposition des KPIs
