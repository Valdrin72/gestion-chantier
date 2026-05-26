---
description: Génère DONNEES.md — cartographie exhaustive du fichier src/donnees.js (exports, catégories, usage, doublons avec src/calculs/)
---

Utilise l'agent `donnees-cartographer` pour produire (ou mettre à jour si déjà existant) le fichier `DONNEES.md` à la racine du projet.

Procédure stricte :

1. **Vérifier les pré-requis** : confirme que `src/donnees.js` existe et que `DONNEES.template.md` est lisible à la racine. Sinon, signale et arrête-toi.

2. **Lecture intégrale de `src/donnees.js`** — du début à la fin, sans sauter.

3. **Inventaire de tous les exports** :
   - `export const X = ...`
   - `export function X(...)`
   - `export default ...`
   - Note la ligne de chaque export

4. **Classification** de chaque export selon les catégories définies dans l'agent.

5. **Détection des doublons** :
   - Pour chaque fonction de calcul, cherche un équivalent dans `src/calculs/*.js`
   - Note les correspondances par similarité de nom OU de signature

6. **Recherche de l'usage réel** :
   - Pour chaque export, grep dans `src/` (récursif)
   - Liste les fichiers qui l'importent
   - Compte le total

7. **Drapeaux 🚨** :
   - Fonctions financières utilisées par >5 fichiers
   - Fonctions ayant un doublon dans `src/calculs/`
   - Fonctions sans tests Vitest (chercher dans `src/calculs/__tests__/` et fichiers `*.test.js`)

8. **Rédige `DONNEES.md`** strictement selon le format du template.

9. **À la fin**, affiche en 5 lignes maximum :
   - Nombre total d'exports
   - Nombre de fonctions de calcul (avec/sans doublon dans src/calculs/)
   - Nombre de constantes
   - Nombre de données brutes
   - Nombre d'exports à risque élevé 🚨

Termine par : "Lis DONNEES.md tranquillement. Dis-moi quelles fonctions tu veux migrer vers src/calculs/ en premier."

**Tu ne modifies RIEN dans le code. Pure cartographie.**
