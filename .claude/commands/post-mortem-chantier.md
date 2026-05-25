---
description: Post-mortem complet d'un chantier achevé — apprentissages, calibration baselines, leçons pour futurs devis
argument-hint: <id_ou_nom_chantier>
---

Utilise l'agent `controleur-gestion` pour faire le post-mortem du chantier : **$ARGUMENTS**

Procédure :

1. **Bilan financier final**
   - CA facturé total (avec avenants éventuels)
   - Coûts réels engagés (matières, MO, ST, locations, déplacements)
   - Marge brute finale (absolue + pourcentage)
   - Marge nette estimée (avec quote-part FG ≈ 18% du CA)

2. **Comparaison devis vs réalisé**
   - Écart CA : avenants justifiés ou rabais consentis ?
   - Écart coûts : par poste (matières / MO / ST)
   - Heures prévues vs heures pointées
   - Productivité réelle vs baseline prévue au devis

3. **Apprentissages**
   - Quelles hypothèses du devis étaient justes ?
   - Quelles hypothèses étaient fausses, et pourquoi ?
   - Y a-t-il des coefficients d'ajustement à ajouter pour ce type de chantier ?
   - La baseline de productivité utilisée était-elle adaptée ?

4. **Mise à jour baselines recommandée**
   - Faut-il ajuster la productivité pour ce type de chantier ?
   - Faut-il ajuster le coefficient achat matériaux pour ce fournisseur ?
   - Marges réelles vs cibles → revoir la cible pour ce type de client ?

5. **Anomalies à comprendre**
   - Si marge anormalement haute : pourquoi ? Reproductible ?
   - Si marge anormalement basse : cause racine ?
   - Liste des "surprises" pour mémoriser et anticiper

6. **Capitalisation**
   - Notes à archiver pour devis similaires futurs
   - Réviser le brief équipe si pattern récurrent
   - Mettre à jour les constantes CYNA_PARAMS si justifié

Output structuré, factuel, sans complaisance. Si le chantier était mauvais, le dire et expliquer pourquoi. Si excellent, comprendre comment reproduire.
