---
name: date-utils-cyna
description: Skill utilitaires dates CYNA — fonctions de calcul de jours ouvrables, jours fériés genevois, durées chantiers. Invoque avec /date-utils-cyna pour tout calcul de dates ou délais dans l'app.
---

# Utilitaires Dates — CYNA SÀRL

## Fichier source : `src/dateUtils.js`

## Jours fériés officiels Genève (fixes chaque année)

```js
const feriesGE = (annee) => [
  `${annee}-01-01`, // Nouvel An
  `${annee}-08-01`, // Fête nationale
  `${annee}-12-25`, // Noël
  `${annee}-12-31`, // Restauration République GE
];
// + Ascension, Pentecôte, Jeûne genevois = variables (calcul astronomique)
```

## Calcul de jours ouvrables

```js
// Compter les jours ouvrables entre deux dates
const joursOuvrables = (dateDebut, dateFin, inclusSamedi = false) => {
  let count = 0;
  const current = new Date(dateDebut);
  const fin = new Date(dateFin);
  const feries = feriesGE(dateDebut.getFullYear());

  while (current <= fin) {
    const jour = current.getDay(); // 0=dim, 6=sam
    const dateStr = current.toISOString().slice(0, 10);
    const estFerie = feries.includes(dateStr);
    const estWeekend = jour === 0 || (jour === 6 && !inclusSamedi);

    if (!estWeekend && !estFerie) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};
```

## Calculer la date de fin d'un chantier

```js
// depuis dateDebut + nombreJours ouvrables
const calculerDateFin = (dateDebut, nombreJours, inclusSamedi = false) => {
  const debut = new Date(dateDebut);
  let joursComptes = 0;
  const current = new Date(debut);

  while (joursComptes < nombreJours) {
    const jour = current.getDay();
    const dateStr = current.toISOString().slice(0, 10);
    const estFerie = feriesGE(current.getFullYear()).includes(dateStr);
    const estWeekend = jour === 0 || (jour === 6 && !inclusSamedi);
    if (!estWeekend && !estFerie) joursComptes++;
    if (joursComptes < nombreJours) current.setDate(current.getDate() + 1);
  }
  return current.toISOString().slice(0, 10);
};
```

## Format d'affichage des dates

```js
// Format suisse : DD.MM.YYYY
const formatDateCH = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// '2024-07-15' → '15.07.2024'

// Durée lisible
const formatDuree = (jours) => {
  if (!jours || jours <= 0) return '—';
  if (jours === 1) return '1 jour';
  if (jours < 5) return `${jours} jours`;
  const semaines = Math.floor(jours / 5);
  const reste = jours % 5;
  return reste > 0 ? `${semaines} sem. ${reste}j` : `${semaines} sem.`;
};
```

## Calcul du retard

```js
const calculerRetard = (dateFin, inclusSamedi = false) => {
  const fin = new Date(dateFin);
  const now = new Date();
  if (fin >= now) return 0; // pas de retard
  return joursOuvrables(fin, now, inclusSamedi);
};
```

## Ce que tu ne dois PAS faire
- Ignorer les jours fériés genevois dans les calculs de délais
- Utiliser `Date.now()` pour comparer des dates (risque timezone)
- Oublier que `inclusSamedi` change le calcul de durée
- Afficher des dates invalides (toujours vérifier `!isNaN(d.getTime())`)
