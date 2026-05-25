---
description: Audit complet d'un devis avant envoi client (cohérence, marges, conformité Suisse, recommandations de prix)
argument-hint: <id_devis_ou_nom_client>
---

Utilise l'agent `controleur-gestion` pour auditer le devis : **$ARGUMENTS**

Vérifications obligatoires :

1. **Cohérence des postes**
   - Pour chaque poste, recalcule (quantité × coût unitaire × coeff achat + temps × CHR) et compare
   - Productivité implicite (temps unitaire × coût horaire) est-elle alignée avec les baselines CYNA ?
   - Coût matériau cohérent avec fourchette CYNA pour ce type de prestation ?

2. **Marges**
   - Marge brute totale + décomposition matériaux / main d'œuvre / sous-traitance
   - Marge sur matériaux vs marge sur main d'œuvre vs marge sur sous-traitance
   - Comparer à cible client (privé ≥ 30%, architecte 25-28%, entreprise 25-30%)
   - **Vérifier explicitement** : on parle de marque (sur vente) ou de marge (sur coût) ?

3. **Conformité Suisse**
   - TVA 8.1% appliquée correctement
   - Total TTC = Total HT × 1.081 (tolérance 0.05 CHF)
   - Mentions obligatoires : IDE, IBAN, validité, conditions paiement
   - Acompte 30% si client non testé ou profil risque

4. **Sanity checks**
   - Aucun montant absurde (négatif, ordres de grandeur incohérents)
   - Si acompte demandé : montant calculé correctement
   - Si retenue garantie : 5% mentionné avec conditions de libération

5. **Avis final**
   - ✅ **ENVOI OK** : tout est cohérent, prix dans la cible
   - 🟡 **À RETRAVAILLER** : 1-3 ajustements recommandés avant envoi
   - 🔴 **REFUSER** : incohérences majeures, refaire le calcul

Pour chaque problème : localisation précise + correction proposée chiffrée.
