---
name: permissions-patterns
description: Skill patterns de permissions CYNA — comment vérifier les rôles, filtrer la navigation, et protéger les actions selon le profil connecté. Invoque avec /permissions-patterns pour implémenter ou vérifier un contrôle d'accès.
---

# Patterns Permissions — CYNA SÀRL

## Fichier source : `src/permissions.js`

## Rôles disponibles

```js
const ROLES = {
  DIRECTION:      'direction',
  CONDUCTEUR:     'conducteur',
  ADMINISTRATIF:  'administratif',
};

// Ordre de privilège (du plus au moins)
const ORDRE_PRIVILEGES = ['direction', 'conducteur', 'administratif'];
```

## Patterns de vérification

### Guard de page (en haut de composant)
```js
const { profil } = useAuth();
const peutAcceder = profil?.role?.toLowerCase() === 'direction' ||
                    profil?.role?.toLowerCase() === 'administratif';

if (!peutAcceder) return <div className="acces-refuse">Accès non autorisé</div>;
```

### Guard d'action (sur un bouton/fonction)
```js
// Vérification inline
const peutSupprimer = ['direction'].includes(profil?.role?.toLowerCase());

// Rendu conditionnel
{peutSupprimer && (
  <button onClick={supprimer}>Supprimer</button>
)}
```

### Navigation filtrée
```js
// Dans App.js ou Layout
const navAutorisees = NAV_ITEMS.filter(item =>
  item.roles.includes(profil?.role?.toLowerCase()) ||
  profil?.role?.toLowerCase() === 'direction' // direction voit tout
);
```

### Vérification multi-rôles
```js
const ROLES_FINANCES = ['direction', 'administratif'];

const peutVoirFinances = ROLES_FINANCES.includes(
  profil?.role?.trim().toLowerCase()
);
```

## Accès par module (référence rapide)

```js
const PERMISSIONS = {
  dashboard:   ['direction', 'conducteur', 'administratif'],
  chantiers:   ['direction', 'conducteur', 'administratif'],
  devis:       ['direction', 'administratif'],
  factures:    ['direction', 'administratif'],
  finances:    ['direction', 'administratif'],
  clients:     ['direction', 'administratif'],
  employes:    ['direction'],
  parametres:  ['direction'],
  planning:    ['direction', 'conducteur'],
  heures:      ['direction', 'conducteur'],
  rapports:    ['direction', 'conducteur', 'administratif'],
  centreIA:    ['direction', 'conducteur', 'administratif'],
};

const peutAccederModule = (module, role) =>
  (PERMISSIONS[module] || []).includes(role?.trim().toLowerCase());
```

## Règles absolues
1. Toujours `.toLowerCase()` avant comparaison de rôle
2. Fallback rôle inconnu → `'conducteur'` (pas `'direction'`)
3. `direction` peut tout faire — les autres sont restreints
4. Validation côté front = UX, pas sécurité (Supabase RLS = vraie sécurité)
5. Jamais `if (!role)` → accorder l'accès (fail-closed)

## Ce que tu ne dois PAS faire
- Comparer les rôles sans `.toLowerCase()`
- Accorder l'accès si le rôle est undefined ou null
- Oublier que direction > conducteur > administratif en termes de visibilité
- Mettre des vérifications de permissions directement dans les données (mettre dans les composants)
