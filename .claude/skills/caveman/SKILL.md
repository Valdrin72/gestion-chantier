---
name: caveman
description: Débogage primitif CYNA — quand les outils modernes échouent, revenir aux origines. Ajoute des logs bruts, simplifie le code à l'extrême, isole le problème couche par couche comme un homme des cavernes. Efficace sur les bugs impossibles à reproduire.
trigger: /caveman
---

# Skill : Caveman — Débogage Primitif

## Philosophie

Quand un bug résiste à tous les outils modernes, le Caveman entre en scène.
Pas de DevTools sophistiqués, pas de traces abstraites. Juste du code brut,
des logs partout, et une élimination méthodique couche par couche.

**Principe** : si tu ne peux pas l'expliquer avec des `console.log`, tu ne le comprends pas encore.

---

## Quand l'utilisateur tape `/caveman [description du bug]`

### Phase 1 — Écouter le symptôme

L'utilisateur décrit le bug. Poser ces questions si pas assez d'info :
1. Sur quelle page / quelle action ça arrive ?
2. C'est constant ou intermittent ?
3. Ça marchait avant ? Depuis quand ?
4. Avec quel rôle utilisateur ?

### Phase 2 — Localiser la caverne (le fichier suspect)

```bash
# Chercher où la valeur problématique est définie/utilisée
grep -rn "[symptôme]" src/ --include="*.js" | head -20

# Trouver les commits récents qui touchent cette zone
git log --oneline --since="7 days ago" -- src/[fichier_suspect]

# Voir le diff de la dernière semaine
git diff HEAD~5 -- src/[fichier_suspect] | head -60
```

### Phase 3 — Instrumentation Caveman

Ajouter des logs TEMPORAIRES et MARQUÉS pour tracer le flux :

```js
// CAVEMAN LOG — à retirer après le bug
console.log('🦴 CAVEMAN | [Fichier:Ligne] | valeur:', JSON.stringify(valeur, null, 2));
console.log('🦴 CAVEMAN | [Fonction] | entrée:', { param1, param2 });
console.log('🦴 CAVEMAN | [Condition] | résultat:', condition, '| attendu:', attendu);
```

Règles des logs Caveman :
- Toujours préfixer avec `🦴 CAVEMAN |` pour faciliter la recherche
- Toujours `JSON.stringify()` les objets (pas `console.log(obj)` qui peut mentir)
- Logger AVANT et APRÈS chaque transformation suspecte
- Logger les IDs pour vérifier les liens inter-entités

### Phase 4 — Isolation par dichotomie

Identifier la ligne exacte du bug :

```
Méthode : bisection
├── Bug dans le composant entier ?
│   ├── OUI → Bug dans la première moitié du code ?
│   │   ├── OUI → Bug dans le premier quart ?
│   │   └── NON → Bug dans le deuxième quart ?
│   └── NON → Bug dans les props reçues ?
└── → Continuer jusqu'à la ligne exacte
```

Technique de commentaire progressif :
```js
// Commenter la moitié du code, tester
// Si le bug disparaît → bug dans la partie commentée
// Sinon → bug dans la partie active
// Répéter jusqu'à la ligne coupable
```

### Phase 5 — Test primitif des valeurs

Vérifier chaque valeur suspecte :

```js
// Type check caveman
console.log('🦴 TYPE:', typeof maValeur, '| VALEUR:', maValeur);

// NaN check
console.log('🦴 isNaN:', isNaN(maValeur), '| isFinite:', Number.isFinite(maValeur));

// Undefined check
console.log('🦴 undefined?', maValeur === undefined, '| null?', maValeur === null);

// ID comparison caveman
console.log('🦴 IDs:', { aComparer: String(a), avec: String(b), egaux: String(a) === String(b) });

// Array check
console.log('🦴 ARRAY:', Array.isArray(maValeur), '| longueur:', (maValeur || []).length);
```

### Phase 6 — Nettoyer la caverne

Une fois le bug trouvé et corrigé :

```bash
# Retirer TOUS les logs caveman
grep -rn "CAVEMAN" src/ --include="*.js"
# Pour chaque fichier trouvé, retirer les lignes console.log

# Vérifier qu'il n'en reste aucun
grep -rn "🦴 CAVEMAN" src/ --include="*.js"
# → doit retourner 0 résultats

# Build propre
CI=true npm run build
```

### Phase 7 — Rapport

```
🦴 CAVEMAN RAPPORT — [date]
══════════════════════════════════
Bug : [description]
Fichier : [chemin:ligne]
Cause racine : [explication simple]
Correction : [ce qui a changé]
Temps de chasse : [durée]

Leçon apprise : [pattern à éviter]
```

---

## Cas classiques CYNA

### Bug "NaN affiché dans l'UI"
```js
// Tracer d'où vient le NaN
console.log('🦴 CA:', ca, '| COUT:', cout, '| MARGE:', ca - cout);
// → trouver la source du NaN (division par 0 ? undefined ?)
```

### Bug "chantier n'apparaît pas dans la liste"
```js
// Vérifier le filtre
console.log('🦴 FILTRE | chantier.statut:', chantier.statut, '| filtre actif:', filtre);
console.log('🦴 FILTRE | toLowerCase:', chantier.statut?.toLowerCase(), '| match:', filtre?.toLowerCase());
```

### Bug "facture liée au mauvais chantier"
```js
// Vérifier les IDs
console.log('🦴 LIEN | facture.chantierId:', String(facture.chantierId));
console.log('🦴 LIEN | chantier.id:', String(chantier.id));
console.log('🦴 LIEN | match:', String(facture.chantierId) === String(chantier.id));
```

---

## Options

- `/caveman [description]` — démarrage guidé, questions + instrumentation
- `/caveman --logs [fichier]` — ajoute les logs caveman dans un fichier cible
- `/caveman --clean` — supprime tous les `🦴 CAVEMAN` logs du projet
- `/caveman --bisect` — utilise git bisect pour trouver le commit coupable

---

## Intégration équipe

Caveman travaille avec :
- `bug-hunter` — valide la correction après que Caveman a trouvé le coupable
- `darwin` — le pattern causant le bug devient un gène fragile à éliminer
- `code-reviewer` — vérifie que les logs Caveman sont bien retirés avant commit
