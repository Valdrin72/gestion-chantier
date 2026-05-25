---
description: Audit de rentabilité globale CYNA — portfolio chantiers, marges pondérées, concentration, anomalies
argument-hint: <periode ex. 2026-Q1, ytd, 12m>
---

Utilise l'agent `controleur-gestion` pour auditer la rentabilité sur la période : **$ARGUMENTS**

Procédure :

1. **Périmètre**
   - Lister tous les chantiers facturés ou en cours sur la période
   - Lister tous les devis émis (signés ou non)

2. **Vue d'ensemble**
   - CA total HT facturé
   - Marge brute totale pondérée (MB / CA sur l'ensemble, pas moyenne arithmétique !)
   - Marge nette estimée (MB − quote-part FG annualisée × jours_periode / 365)
   - Vs seuil rentabilité → on est au-dessus ou en dessous ?

3. **Distribution**
   - Top 5 chantiers en marge absolue
   - Top 5 chantiers en taux de marge
   - Bottom 5 (alerte si MB < 15%)
   - Distribution par type de prestation (faux-plancher, faux-plafond, cloisons, etc.)
   - Distribution par segment client (privé, architecte, entreprise)

4. **Concentration & risque**
   - Top 10 clients par CA
   - Si un client > 25% du CA : signaler la dépendance
   - Diversification recommandée si trop concentré

5. **Anomalies**
   - Chantiers avec marge anormalement haute (suspect, vérifier) ou basse
   - Écarts devis-réalisé : identifier les chantiers avec dépassement > 15%

6. **Pipeline & visibilité**
   - Carnet de commandes signé non facturé
   - Devis en attente → estimer probabilité de signature
   - Mois de visibilité (carnet / CA mensuel moyen)

7. **Diagnostic & priorités**
   - 3-5 enseignements majeurs
   - 3-5 actions prioritaires pour le trimestre suivant
   - Indicateurs à mettre sous surveillance renforcée

Output : rapport structuré exportable, sections numérotées.
