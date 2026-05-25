---
description: Diagnostic complet de la trésorerie CYNA — DSO, BFR, projection 90j, recommandations
---

Utilise l'agent `controleur-gestion` pour produire un diagnostic trésorerie complet.

Procédure :

1. **État actuel**
   - Solde banque + caisse à aujourd'hui
   - Encours clients (créances) par tranche d'âge : 0-30j, 30-60j, 60-90j, 90j+
   - Dettes fournisseurs courantes par échéance
   - Acomptes reçus non encore produits
   - Travaux en cours non encore facturés

2. **Indicateurs clés**
   - DSO sur 90 jours glissants → comparer à cible 45j
   - BFR → besoin réel de fonds de roulement
   - Coût caché des retards : intérêts moratoires 5%/an (CO art. 104) sur encours en retard

3. **Projection 90 jours**
   - Encaissements prévus (factures émises × probabilité selon historique client)
   - Décaissements obligatoires (salaires, charges sociales, TVA, loyer, fournisseurs)
   - Identifier le jour de tension minimale (solde le plus bas projeté)

4. **Scénarios**
   - Optimiste (tous les clients paient à échéance)
   - Probable (probabilités historiques)
   - Pessimiste (deux gros paiements ratés + DSO +30j)

5. **Drapeaux**
   - 🔴 Rouge : solde projeté < CHF 50'000 à J+30
   - 🔴 Rouge : DSO > 75j
   - 🔴 Rouge : un client > 30% de l'encours total
   - 🟡 Orange : DSO 60-75j, ou encours > 60j > 20% du total

6. **Recommandations chiffrées**
   - Relances spécifiques à lancer (client + montant + délai)
   - Étalement décaissements possibles
   - Ligne de crédit à anticiper ?
   - Acomptes futurs à renforcer ?

Format de sortie : tableau de bord trésorerie, sections classées par urgence décroissante.
