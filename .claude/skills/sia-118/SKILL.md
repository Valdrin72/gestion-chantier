---
name: sia-118
description: Skill norme SIA 118 — règles contractuelles suisses pour les travaux de construction (réception, garanties, délais, pénalités). Invoque avec /sia-118 pour tout ce qui concerne les contrats de travaux en Suisse.
---

# Norme SIA 118 — Conditions générales pour travaux de construction

## Contexte
La **SIA 118** est la norme de référence pour les contrats de construction en Suisse.
Elle définit les droits et obligations des entrepreneurs et maîtres d'ouvrage.

## Points clés pour CYNA SÀRL

### Réception des travaux
- La réception marque la fin de la période d'exécution
- Délai de réclamation : **2 ans** pour vices apparents (art. 370 CO)
- Délai de garantie étendu : 5 ans pour vices cachés structurels

### Garanties financières
| Garantie | Taux | Durée |
|---------|------|-------|
| Retenue de garantie | 5% du marché | 5 ans après réception |
| Garantie bancaire | 10% du marché | Pendant travaux |
| Acompte signature | 10–30% | Libéré à réception |

### Délais de paiement (SIA 118 + usages)
- Factures travaux : **30 jours net** après réception
- Acomptes : selon calendrier contractuel
- Intérêts moratoires : 5% par an après échéance

### Variations de travaux (avenants)
- Tout travail supplémentaire doit être commandé par écrit
- Prix des avenants : selon détail des prix du contrat ou accord préalable
- Délai de contestation : **10 jours** après réception de la facture d'avenant

### Prix et révision
- Marchés à prix ferme : pas de révision (CYNA standard)
- Marchés révisables : selon indices OFAS/BFS construction
- Travaux en régie : facturation heures + matériaux avec coefficients

## Implications pour l'app CYNA

```
Retenue garantie = 0.05 × montantHT (stocker dans la facture finale)
Date réception → déclenche délai garantie 5 ans
Avenant → champ séparé (pas modifier montantHT original du devis)
Facture travaux en régie → type 'regie' avec heures × tarif
```

## Ce que tu ne dois PAS faire
- Modifier le `montantHT` original du devis pour un avenant
- Libérer la retenue de garantie avant 5 ans sans accord explicite
- Facturer des suppléments sans commande écrite préalable
