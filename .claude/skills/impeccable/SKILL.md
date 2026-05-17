---
name: impeccable
description: Perfection absolue CYNA — va au-delà du "ça marche" pour atteindre l'excellence. Analyse chaque détail du code et de l'UI pour éliminer tout ce qui est approximatif, incohérent ou incomplet. Zéro compromis. Invoquer avec /impeccable pour un audit de perfection avant une release majeure.
trigger: /impeccable
---

# Skill : Impeccable — Zéro Compromis, Zéro Approximation

## Manifeste

Impeccable ne cherche pas le "ça passe". Il cherche l'**excellence absolue**.
Chaque ligne de code doit avoir une raison d'être. Chaque pixel doit être à sa place.
Chaque message d'erreur doit être utile. Chaque calcul doit être exact.

**Standard Impeccable :** si tu devais montrer ce code à un expert suisse en génie logiciel
ET à un chef de chantier genevois exigeant, les deux seraient satisfaits.

---

## Quand l'utilisateur tape `/impeccable`

### Couche 1 — Code Excellence

**Variables et fonctions mal nommées :**
```bash
# Chercher les noms trop courts ou cryptiques
grep -rn "\b[a-z]\b\s*=\|function [a-z]\b\|const [a-z] =" src/ --include="*.js" | grep -v "//\|import\|for (" | head -20
```

**Dead code (variables déclarées jamais utilisées) :**
```bash
# Variables déclarées mais jamais utilisées
grep -rn "const \|let \|var " src/ --include="*.js" | grep -v "//\|export\|import" | head -30
```

**Commentaires inutiles ou trompeurs :**
```bash
grep -rn "// TODO\|// FIXME\|// HACK\|// XXX\|// temp\|// old\|// debug" src/ --include="*.js" | head -20
```

**Fonctions trop longues (> 80 lignes) :**
```bash
# Identifier les fichiers les plus volumineux par fonction
wc -l src/**/*.js 2>/dev/null | sort -rn | head -10
```

### Couche 2 — Calculs BTP Impeccables

Vérifier chaque formule métier contre les règles CLAUDE.md :

```bash
# Toutes les formules marge/EAC/RAD
grep -n "EAC\|RAD\|marge\|margeReel\|margeNette" src/donnees.js | head -30
grep -n "calculer\|Calcul" src/donnees.js | head -20
```

Checklist calculs :
- [ ] `marge brute % = (CA - coûts) / CA × 100` — sur vente, pas sur coût
- [ ] `EAC = coutReel / (avancement / 100)` — guard avancement > 0
- [ ] `RAD = (coutReel / avancement) × (100 - avancement)` — guard
- [ ] `TTC = HT × (1 + tva/100)` — tva paramétrable, pas hardcodée
- [ ] `coût MO = heures/8 × tarifJour × coefficient` — coefficient ≥ 1.35

### Couche 3 — UX Impeccable

**Messages d'erreur vagues :**
```bash
grep -rn "alert(\|console\.error\|Erreur\|error\|invalid" src/ --include="*.js" | grep -v "//\|NODE_ENV" | head -20
```

Messages à améliorer :
- ❌ `alert('Erreur')` → ✅ `'Le montant HT ne peut pas être vide'`
- ❌ `'Invalide'` → ✅ `'Le numéro de téléphone doit contenir 10 chiffres'`
- ❌ Silencieux (return sans feedback) → ✅ `afficherNotif('...')`

**États de chargement manquants :**
```bash
grep -rn "setLoading\|isLoading\|loading" src/ --include="*.js" | head -15
```

**Accessibilité de base :**
```bash
# Boutons sans title/aria-label
grep -rn "<button" src/ --include="*.js" | grep -v "title=\|aria-label=" | head -20

# Inputs sans label associé
grep -rn "<input" src/ --include="*.js" | grep -v "aria-label=\|id=" | head -20
```

### Couche 4 — Données Impeccables

**Valeurs par défaut incohérentes :**
```bash
grep -rn "|| ''\||| 0\||| null\||| \[\]\||| {}" src/ --include="*.js" | head -20
```

Vérifier la cohérence :
- Un montant CHF devrait toujours avoir `|| 0` (pas `|| null` si affiché)
- Une liste devrait toujours avoir `|| []` (pas `|| null`)
- Un ID devrait toujours être String ou number, jamais les deux

**Formats incohérents :**
```bash
# Dates — format CH (dd.mm.yyyy) ou ISO (yyyy-mm-dd) ?
grep -rn "toLocaleDateString\|split('-')\|format.*date" src/ --include="*.js" | head -15
```

Règle : affichage = `dd.mm.yyyy` (format CH), stockage = ISO `yyyy-mm-dd`

### Couche 5 — Architecture Impeccable

**Import circulaires potentiels :**
```bash
grep -rn "from '\.\." src/ --include="*.js" | grep -v node_modules | head -20
```

**Logique métier dans les composants (doit être dans donnees.js) :**
```bash
grep -rn "const marge\|const cout\|const ca\|const eac\|const rad" src/pages/ --include="*.js" | head -15
```

**Props drilling excessif (> 4 niveaux) :**
```bash
grep -rn "props\.\|{.*,.*,.*,.*,.*}" src/components/ --include="*.js" | head -10
```

### Phase finale — Rapport Impeccable

```
✨ RAPPORT IMPECCABLE — CYNA [date]
════════════════════════════════════════════

SCORE GÉNÉRAL : [A/B/C/D]

Couche 1 — Code Excellence
  ✅ Nommage : [N] variables renommées
  ✅ Dead code : [N] suppressions
  ⚠️ TODO restants : [N] → planifier

Couche 2 — Calculs BTP
  ✅ Formules : toutes conformes CLAUDE.md
  ✅ Guards : tous en place

Couche 3 — UX
  ✅ Messages erreur : [N] améliorés
  ⚠️ Accessibilité : [N] title manquants → backlog

Couche 4 — Données
  ✅ Valeurs par défaut : cohérentes
  ✅ Formats dates : uniformes

Couche 5 — Architecture
  ✅ Logique métier : dans donnees.js
  ⚠️ [N] cas de props drilling → refactorer

CORRECTIONS APPLIQUÉES : [N]
BACKLOG IMPECCABLE : [N] items

"Excellence is not a destination but a continuous journey."
```

### Commit Impeccable

```bash
CI=true npm run build 2>&1 | grep "Compiled"
git add [fichiers]
git commit -m "refactor(impeccable): excellence pass — [résumé]

https://claude.ai/code/session_015UF12ZaB73iH4YE9Y6f2Ly"
git push -u origin claude/debug-terminal-issue-uvSBY
```

---

## Options

- `/impeccable` — audit complet 5 couches
- `/impeccable --code` — couche code uniquement
- `/impeccable --ux` — couche UX uniquement
- `/impeccable --calculs` — couche calculs BTP uniquement
- `/impeccable --fix` — applique toutes les corrections non destructives

---

## Intégration équipe

Impeccable est le dernier à parler avant une release :
- `darwin` — élimine les fragilités avant qu'Impeccable passe
- `code-reviewer` — revue systématique avant qu'Impeccable finalise
- `test-engineer` — valide que les corrections n'ont rien cassé
- `mempalace` — mémorise les standards d'excellence atteints
