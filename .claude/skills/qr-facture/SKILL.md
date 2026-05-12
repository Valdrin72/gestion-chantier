---
name: qr-facture
description: Skill QR-facture suisse — structure et règles du format QR-facture SIX Group (remplaçant du BVR depuis 2022). Invoque avec /qr-facture pour tout ce qui concerne la facturation électronique suisse.
---

# QR-Facture Suisse — Skill CYNA

## Contexte
Le QR-facture a remplacé le BVR (bulletin de versement) en Suisse depuis le **30 septembre 2022**.
Standard géré par SIX Group.

## Structure QR-Facture

### Section paiement (bas de facture)
```
┌─────────────────────────────────────────────────────┐
│  [QR Code]  │  Récépissé                            │
│             │  Compte / Payable à :                  │
│             │  IBAN : CH44 3199 9123 0008 8901 2     │
│             │  CYNA SÀRL                             │
│             │  Rue [adresse]                         │
│             │  1201 Genève                           │
│             ├───────────────────────────────────────│
│             │  Référence : RF18 5390 0754 7034       │
│             │  Montant : CHF 48'645.00               │
│             │  Monnaie : CHF                         │
└─────────────────────────────────────────────────────┘
```

### Données obligatoires
| Champ | Description | Exemple |
|-------|-------------|---------|
| IBAN | IBAN suisse (26 chars, commence par CH) | `CH44 3199 9123 0008 8901 2` |
| Bénéficiaire | Nom + adresse complète | CYNA SÀRL, Genève |
| Montant | CHF avec 2 décimales | `48645.00` |
| Monnaie | Toujours CHF | `CHF` |
| Référence | QRR (27 chiffres) ou SCOR (RF + 23 chars) | `RF18 5390 0754 7034` |
| Débiteur | Nom + adresse client | Optionnel mais recommandé |

### Types de référence
- **QRR** : 27 chiffres, spécifique au QR-facture
- **SCOR** : Référence créancier structurée (RF + contrôle + ref)
- **NON** : Aucune référence (pour paiements libres)

## Règles CYNA
1. Toujours utiliser l'IBAN de CYNA SÀRL (configurable dans paramètres)
2. Référence = numéro de facture encodé (traçabilité)
3. Montant en CHF uniquement
4. Texte additionnel : N° de chantier, N° de devis

## Affichage dans l'app
Pour l'instant, l'app affiche les données textuelles de la facture.
La génération du QR code graphique nécessiterait une bibliothèque externe — ne pas installer sans validation.

## Ce que tu ne dois PAS faire
- Mettre un IBAN d'un autre pays (format différent)
- Oublier le code de contrôle IBAN
- Utiliser l'ancien format BVR (obsolète depuis 2022)
