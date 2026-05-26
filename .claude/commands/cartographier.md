---
description: Génère ou met à jour ARCHITECTURE.md à la racine du projet — carte complète du code de l'app
---

Utilise l'agent `code-cartographer` pour produire (ou mettre à jour si déjà existant) le fichier `ARCHITECTURE.md` à la racine du projet.

Procédure :

1. **Vérifier les pré-requis** : confirme que tu peux lire `ARCHITECTURE.template.md` à la racine. Si non, signale-le et arrête-toi.

2. **Inventaire complet de src/** : liste tous les fichiers `.js`, `.jsx`, `.ts`, `.tsx` dans `src/` récursivement. Ignore `node_modules/`, `build/`, `dist/`, `coverage/`.

3. **Pour chaque fichier source**, collecte :
   - Chemin complet relatif à la racine
   - Nombre de lignes
   - Liste des imports internes (relatifs : `./`, `../`)
   - Liste des fichiers qui l'importent (grep sur tout le repo)
   - Tentative de classification (Page, Composant, Hook, Utilitaire, etc.)

4. **Détecte les anomalies** :
   - Fichiers jamais importés (candidats code mort)
   - Groupes de noms suspects (Agents/AgentEngine/useAgents → suspect duplication)
   - Fichiers à la racine de src/ qui devraient être dans un sous-dossier
   - Fichiers > 500 lignes (candidats refactoring)
   - Fichiers importés par > 10 autres (couplages forts)

5. **Rédige ARCHITECTURE.md** en suivant strictement le format de `ARCHITECTURE.template.md`. Remplace tous les placeholders entre `<...>` par les vraies valeurs.

6. **Important** : ne propose AUCUN changement de code, AUCUNE suggestion de refactoring spécifique. Juste l'état des lieux factuel.

7. À la fin, affiche un résumé en 4 lignes maximum :
   - Nombre total de fichiers analysés
   - Nombre de candidats code mort
   - Nombre de groupes de duplications suspectes
   - Nombre de couplages forts détectés

Puis suggère : "Quand tu auras lu ARCHITECTURE.md, dis-moi par quel point on commence à consolider."
