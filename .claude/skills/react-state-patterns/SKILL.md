---
name: react-state-patterns
description: Skill patterns React CYNA — gestion d'état, hooks, props drilling, mémoïsation. Invoque avec /react-state-patterns pour implémenter correctement un état ou un hook dans l'app.
---

# Patterns React — CYNA SÀRL

## Architecture état de l'app

```
App.js (root)
  ├── état global : chantiers, devis, factures, clients, parametres
  ├── passe par props aux pages (pas de Redux, pas de Context complexe)
  └── sauvegarde via ecrireRowUser() après chaque mutation
```

## Patterns de mise à jour d'état

### Ajouter un élément
```js
// ✅ Immutable — crée un nouveau tableau
setChantiers(prev => [...prev, nouveauChantier]);

// ❌ Mutation directe — ne déclenche pas de re-render
chantiers.push(nouveauChantier);
```

### Modifier un élément
```js
// ✅ Map + spread
setChantiers(prev =>
  prev.map(c => String(c.id) === String(id) ? { ...c, ...modifications } : c)
);
```

### Supprimer un élément
```js
// ✅ Filter
setChantiers(prev => prev.filter(c => String(c.id) !== String(id)));
```

## useMemo — Quand l'utiliser

```js
// ✅ Calculs coûteux (Σ journal, marges, stats)
const stats = useMemo(() =>
  chantiers.map(c => calculerStatsChantier(c, devis, journal)),
  [chantiers, devis, journal]
);

// ✅ Filtres sur grandes listes
const chantiersActifs = useMemo(() =>
  chantiers.filter(c => c.statut?.toLowerCase() === 'en cours'),
  [chantiers]
);

// ❌ Pas nécessaire pour des opérations simples
const total = useMemo(() => a + b, [a, b]); // inutile
```

## useCallback — Quand l'utiliser

```js
// ✅ Handlers passés comme props à des composants enfants
const handleSave = useCallback(async (data) => {
  await ecrireRowUser(userId, data);
}, [userId]);

// ❌ Pas nécessaire si pas passé en prop
const handleClick = () => setOpen(true); // OK sans useCallback
```

## useEffect — Règles

```js
// ✅ Dépendances complètes
useEffect(() => {
  chargerDonnees(userId);
}, [userId]); // userId dans les deps

// ❌ Dépendances manquantes
useEffect(() => {
  chargerDonnees(userId);
}, []); // userId manquant → bug subtil

// ✅ Cleanup pour éviter les fuites mémoire
useEffect(() => {
  const sub = supabase.channel('changes').on(...).subscribe();
  return () => sub.unsubscribe(); // cleanup
}, []);
```

## Props drilling — Limites acceptables

```
App.js → Page.js → Composant.js → SousComposant.js
  ↑ 3 niveaux max avant de reconsidérer
  ↑ Si > 3 niveaux → créer un Context ou remonter l'état
```

## Patterns de formulaire

```js
const [form, setForm] = useState({ nom: '', montant: '' });

// Mise à jour d'un champ
const handleChange = (champ) => (e) =>
  setForm(prev => ({ ...prev, [champ]: e.target.value }));

// Usage
<input value={form.nom} onChange={handleChange('nom')} />
```

## Ce que tu ne dois PAS faire
- Muter l'état directement (toujours créer de nouveaux objets/tableaux)
- Mettre des calculs lourds dans le render sans useMemo
- Oublier les dépendances useEffect (risque de comportement périmé)
- Utiliser des indexes tableau comme `key` dans les listes dynamiques
