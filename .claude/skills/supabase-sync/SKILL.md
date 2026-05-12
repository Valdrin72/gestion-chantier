---
name: supabase-sync
description: Skill synchronisation Supabase ↔ localStorage CYNA — pattern exact de lecture/écriture des données dans l'app. Invoque avec /supabase-sync pour toute question sur le stockage ou la persistance des données.
---

# Supabase ↔ localStorage — Pattern CYNA

## Architecture de stockage

```
Supabase (source de vérité)
  └── table: devis (ou __cyna_storage__)
        └── colonne: data (JSON blob complet par user)
              ├── chantiers: []
              ├── devis: []
              ├── factures: []
              ├── clients: []
              ├── employes: []  (dans parametres)
              └── parametres: {}

localStorage (cache offline)
  └── clé: cyna_data_{userId}
        └── même structure JSON
```

## Fonctions d'accès canoniques

```js
// Écriture (Supabase + localStorage)
await ecrireRowUser(userId, donneesCompletes);
// → sauvegarde le JSON entier, pas de patch partiel

// Lecture initiale
const data = await lireRowUser(userId);
// → retourne le JSON complet ou null

// Cache local (fallback offline)
const cache = localStorage.getItem(`cyna_data_${userId}`);
const donnees = cache ? JSON.parse(cache) : null;
```

## Pattern de mise à jour

```js
// ✅ Pattern correct — toujours mettre à jour l'état complet
const nouvellesData = {
  ...donneesActuelles,
  chantiers: [...donneesActuelles.chantiers, nouveauChantier],
};
await ecrireRowUser(userId, nouvellesData);
setDonnees(nouvellesData); // état React

// ❌ Pattern incorrect — mutation directe
donneesActuelles.chantiers.push(nouveauChantier); // JAMAIS
```

## Gestion des conflits offline/online

```js
// Priorité : Supabase > localStorage
// Si Supabase échoue → garder localStorage comme fallback
// Si retour online → re-synchroniser Supabase depuis localStorage

const chargerDonnees = async (userId) => {
  try {
    const remote = await lireRowUser(userId);
    if (remote) {
      localStorage.setItem(`cyna_data_${userId}`, JSON.stringify(remote));
      return remote;
    }
  } catch (e) {
    console.warn('Supabase indisponible, utilisation du cache local');
  }
  const local = localStorage.getItem(`cyna_data_${userId}`);
  return local ? JSON.parse(local) : initialiserDonneesVides();
};
```

## Règles de sécurité

1. Jamais stocker de données sensibles en clair dans localStorage en prod
2. `userId` = `supabase.auth.getUser().data.user.id`
3. Toujours vérifier que l'userId correspond avant d'écrire
4. En cas d'erreur Supabase → informer l'utilisateur (pas silencieux)

## Structure initiale vide

```js
const initialiserDonneesVides = () => ({
  chantiers: [],
  devis: [],
  factures: [],
  clients: [],
  paiements: {},
  parametres: {
    employes: [],
    localites: [],
    parametres: { coefficientMainOeuvre: 1.35, tauxFG: 12, tvaDefaut: 8.1 }
  }
});
```

## Ce que tu ne dois PAS faire
- Stocker des données de façon partielle (toujours le JSON complet)
- Lire depuis localStorage sans fallback Supabase
- Écrire sans vérifier l'authentification de l'utilisateur
- Muter directement l'objet données (toujours `{ ...spread }`)
