---
name: huashu-design
description: Système de design vivant CYNA — maintient et fait évoluer le design system (ds.js, index.css, tokens) avec une vision cohérente et esthétique. Inspiré du Huashu (花書 — l'art de la composition visuelle). Invoquer avec /huashu-design pour refondre, étendre ou harmoniser le design system de l'app.
trigger: /huashu-design
---

# Skill : Huashu Design — L'Art de la Composition Visuelle CYNA

## Philosophie Huashu (花書)

Huashu signifie "écrire avec des fleurs" — composer avec soin, intention et harmonie.
Pour CYNA, c'est l'art d'assembler couleurs, formes et typographies en un tout cohérent
qui respire la **confiance**, la **précision** et la **robustesse** du BTP suisse.

Un design Huashu :
- Respire (espaces généreux, pas de surcharge)
- Hiérarchise (ce qui compte ressort immédiatement)
- Rassure (formes stables, couleurs solides)
- Dure (pas de tendances, des fondamentaux)

---

## Architecture du Design System CYNA

```
ds.js                    — tokens JS (couleurs, tailles, composants)
src/index.css            — variables CSS globales + classes utilitaires
src/components/ui/       — composants atomiques (KpiCard, Badge, Toggle...)
src/components/Layout.js — Sidebar, Topbar, MobileNav
```

### Palette CYNA actuelle

```
Primaire  : #0d3d6e  (bleu nuit — brand, confiance, solidité)
Secondaire: #10b981  (vert émeraude — succès, rentabilité)
Danger    : #ef4444  (rouge — alerte, perte, suppression)
Warning   : #f59e0b  (amber — attention, retard, limite)
Info      : #3b82f6  (bleu ciel — information neutre)
Neutre    : #64748b  (gris ardoise — texte secondaire)
```

---

## Quand l'utilisateur tape `/huashu-design [demande]`

### Phase 1 — Lire l'état du design system

```bash
# Lire ds.js — tokens actuels
cat /home/user/gestion-chantier/src/ds.js

# Voir les variables CSS
grep -n ":root\|--brand\|--bg\|--text\|--border\|--shadow" /home/user/gestion-chantier/src/index.css | head -40

# Lister les composants UI existants
ls /home/user/gestion-chantier/src/components/ui/
```

### Phase 2 — Analyser les incohérences

```bash
# Couleurs hors palette
grep -rn "#[0-9a-fA-F]\{3,6\}" src/ --include="*.js" | grep -v "ds\.js\|//\|node_modules" | head -30

# Border-radius incohérent
grep -rn "borderRadius: [0-9]" src/ --include="*.js" | grep -v "8\|10\|12\|14\|50\|'50%'" | head -15

# Box-shadow hors standard
grep -rn "boxShadow:" src/ --include="*.js" | head -20
```

### Phase 3 — Composer / Étendre le Design System

Selon la demande, créer ou modifier :

**Ajouter un nouveau token :**
```js
// Dans ds.js
export const DS = {
  // ... existant
  nouveauToken: {
    couleur: '#...',
    fond: 'rgba(...)',
    border: '1px solid rgba(...)',
  }
};
```

**Ajouter une variable CSS :**
```css
/* Dans index.css, section :root */
--nouveau-token: #...;
--nouveau-token-subtle: rgba(..., 0.1);
```

**Créer un nouveau composant atomique :**
Structure dans `src/components/ui/[NomComposant].js` :
```jsx
export default function NomComposant({ ... }) {
  return (
    <div style={{ /* tokens DS uniquement */ }}>
      {/* contenu */}
    </div>
  );
}
// Exporter dans src/components/ui/index.js
```

### Phase 4 — Thème sombre (dark mode)

CYNA supporte le dark mode via `data-theme="dark"`. Vérifier que les nouveaux
composants respectent les variables CSS dark :

```bash
grep -n "dark\|data-theme\|\[data-theme" src/index.css | head -30
```

Règle : toujours utiliser `var(--bg-card)`, `var(--text-main)`, `var(--border)`
jamais des couleurs hardcodées qui ne changent pas au dark mode.

### Phase 5 — Mobile & Responsive

Principes Huashu pour mobile :

```css
/* Grille responsive CYNA */
--g1: 1fr;                              /* mobile */
--g2: repeat(2, 1fr);                  /* tablette */
--g3: repeat(3, 1fr);                  /* desktop */
--g4: repeat(4, minmax(180px, 1fr));   /* large */
```

```bash
# Vérifier l'usage des grilles
grep -rn "gridTemplateColumns\|var(--g" src/ --include="*.js" | head -20
```

### Phase 6 — Animation et Micro-interactions

Huashu valorise les transitions subtiles — présentes mais discrètes :

```css
/* Standard CYNA */
transition: all 0.15s ease;     /* boutons, hover */
transition: opacity 0.2s ease;  /* apparitions */
animation: fadeIn 0.3s ease;    /* entrées de page */
```

```bash
grep -rn "transition:\|animation:" src/index.css | head -20
grep -rn "transition:\|animation:" src/ --include="*.js" | grep -v "ds\.js\|//\|0\.15s\|0\.2s\|0\.3s" | head -15
```

### Phase 7 — Rapport Huashu

```
🌸 HUASHU DESIGN — CYNA [date]
════════════════════════════════════════════
"Composer avec soin, bâtir avec solidité."

PALETTE
  Primaire   : #0d3d6e ✅ — 47 usages
  Secondaire : #10b981 ✅ — 23 usages
  Danger     : #ef4444 ✅ — 18 usages
  Hors palette : [N] couleurs orphelines → unifier

TOKENS
  DS.card       : utilisé dans [N] composants ✅
  DS.input      : utilisé dans [N] formulaires ✅
  DS.btnPrimary : utilisé dans [N] actions ✅

COMPOSANTS ATOMIQUES
  KpiCard    : [N] usages ✅
  Badge      : [N] usages ✅
  ConfirmModal : [N] usages ✅
  ProgressBar : [N] usages ✅

DARK MODE : [N] variables manquantes → corriger

Améliorations Huashu : [N] tokens harmonisés
Nouveau composant : [si créé]

"Un design réussi est celui qu'on ne remarque pas."
```

---

## Recettes Huashu pour cas courants CYNA

### Card chantier — équilibre parfait
```jsx
<div style={{
  background: 'var(--bg-card)',
  borderRadius: 12,
  padding: '16px 20px',
  border: '1px solid var(--border)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'box-shadow 0.15s ease',
}}>
```

### Badge statut — lisibilité maximale
```jsx
<span style={{
  background: `${couleur}1a`,    /* couleur + 10% opacité */
  color: couleur,
  border: `1px solid ${couleur}33`,  /* couleur + 20% opacité */
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
}}>
```

### KPI card — impact immédiat
```jsx
<div style={{ background: `linear-gradient(135deg, ${couleur}18, ${couleur}08)` }}>
  <div style={{ fontSize: 28, fontWeight: 800, color: couleur }}>{valeur}</div>
  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
</div>
```

---

## Options

- `/huashu-design` — audit complet + rapport
- `/huashu-design --palette` — harmoniser la palette uniquement
- `/huashu-design --dark` — corriger les variables dark mode manquantes
- `/huashu-design --composant [nom]` — créer un nouveau composant DS
- `/huashu-design --tokens` — auditer les tokens DS vs usage réel
- `/huashu-design --mobile` — optimiser pour mobile/chantier

---

## Intégration équipe

Huashu Design collabore avec :
- `taste-skill` — Taste audite, Huashu implémente
- `playwright-cyna` — screenshots avant/après pour valider visuellement
- `dashboard-architect` — disposition et proportion des KPIs
- `impeccable` — qualité du code CSS/JSX des composants
