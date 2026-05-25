---
description: Analyse complète de la rentabilité et du pilotage d'un chantier (EVM, marges, dérives, recommandations)
argument-hint: <id_ou_nom_chantier>
---

Utilise l'agent `controleur-gestion` pour analyser le chantier suivant : **$ARGUMENTS**

Procédure :

1. **Localiser les données** du chantier dans le projet (chercher dans `src/donnees.js`, fichiers de données JSON, ou demander où chercher si introuvable).

2. **Extraire** :
   - Données financières du devis initial : total HT, décomposition postes, marge prévue
   - Coûts engagés à ce jour (matières, main d'œuvre pointée, sous-traitance, locations)
   - Avancement réel (% travaux réalisés vs % temps écoulé)
   - Dates clés (démarrage, fin prévue, jalons)
   - Particularités (avenants, réserves, retards)

3. **Calculer** :
   - EVM → PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC
   - Marge brute actuelle vs marge brute prévue au devis
   - Dérive heures pointées / heures prévues
   - DSO sur les factures émises pour ce chantier

4. **Diagnostiquer** selon le format standardisé de l'agent :
   - Chiffres clés (au moins : CPI, SPI, EAC, marge actuelle, dérive)
   - Drapeaux (rouge/orange/vert pour chaque KPI)
   - Diagnostic en clair
   - Anticipation à 30 jours

5. **Recommander** 2-4 actions concrètes priorisées.

6. Terminer en proposant : « Veux-tu que je creuse sur [aspect spécifique] ? »

Si le chantier n'existe pas ou si les données sont incomplètes, signale-le clairement et liste ce qui manque.
