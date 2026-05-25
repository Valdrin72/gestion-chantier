---
description: Vérification rapide d'un calcul de marge — détecte confusion marque/marge, recalcule, donne le bon coefficient
argument-hint: <coût> <prix_de_vente> OU <coût> <taux%>
---

Utilise l'agent `controleur-gestion` pour vérifier un calcul de marge : **$ARGUMENTS**

Tu reçois deux nombres. Selon le contexte :

**Cas 1 : coût + prix de vente fournis**
- Calcule le taux de MARQUE : (PV − Coût) / PV
- Calcule le taux de MARGE : (PV − Coût) / Coût
- Affiche LES DEUX clairement avec libellés explicites
- Calcule le coefficient de vente effectif (PV / Coût)

**Cas 2 : coût + taux fourni**
- Si c'est une marque (sur PV) : PV = Coût / (1 − taux)
- Si c'est une marge (sur coût) : PV = Coût × (1 + taux)
- Montre la différence chiffrée entre les deux interprétations

**Toujours conclure par :**
- Le piège à éviter (marque ≠ marge)
- Le bon coefficient pour la cible CYNA standard (28% marque → k = 1.389)
- Si l'utilisateur veut intégrer ça dans un devis : conseiller d'utiliser la page Calculs

Format de sortie ultra-concis : 8-10 lignes max.
