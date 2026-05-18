---
name: invoice-validator
description: Validateur de factures CYNA — vérifie toutes les mentions légales suisses, TVA 8.1%, QR-facture SIX, délai 30j, liens client/chantier/devis avant envoi. Invoque avec /invoice-validator.
trigger: /invoice-validator
---

# Skill : Invoice Validator — Validation complète avant envoi

## Principe

Invoice Validator est le garde-barrière légal de chaque facture CYNA avant envoi.
Il vérifie les **14 mentions obligatoires suisses** (CO + LTVA), les calculs TVA,
les liens entités, et la conformité QR-facture SIX Group.

**Zéro facture incorrecte ne sort de CYNA.**

---

## Quand l'utilisateur tape `/invoice-validator`

### Phase 1 — Validation technique (lecture code)

```bash
grep -n "montantTTC\|montantHT\|tva\|dateEcheance\|clientId\|chantierId\|devisId" src/Factures.js | head -20
```

Vérifier également la génération PDF :
```bash
grep -n "IBAN\|qr\|reference\|echeance\|tva\|montant" src/ExportPDF.js | head -30
```

### Phase 2 — Checklist légale Suisse (14 points)

Vérifier chaque point dans le code ET dans les données :

**Mentions obligatoires CH (CO art. 958 + LTVA) :**

1. ✅ Numéro de facture unique et séquentiel
2. ✅ Date d'émission (`dateEmission` — jamais `dateFacture`)
3. ✅ Date d'échéance = dateEmission + 30 jours (standard BTP)
4. ✅ Nom et adresse complète du fournisseur (CYNA SÀRL)
5. ✅ Numéro TVA du fournisseur (CHE-XXX.XXX.XXX MWST)
6. ✅ Nom et adresse du client
7. ✅ Description des travaux (objet de la facture)
8. ✅ Montant HT
9. ✅ Taux TVA (8.1% standard BTP) et montant TVA
10. ✅ Montant TTC = montantHT × 1.081
11. ✅ IBAN pour paiement
12. ✅ Référence chantier/devis
13. ✅ Conditions de paiement (30 jours net)
14. ✅ Retenue de garantie 5% si applicable (SIA 118)

**Validation calculs :**

```js
// Vérifier que montantTTC = montantHT × (1 + tva/100)
const delta = Math.abs(montantTTC - montantHT * (1 + tva / 100));
if (delta > 0.01) → ERREUR : "TVA incorrecte — écart de CHF X"
```

**Validation liens :**
- `facture.clientId` → client existe dans clients[]
- `facture.chantierId` → chantier existe dans chantiers[]
- `facture.devisId` → devis existe dans devis[] (optionnel mais recommandé)
- Montant facturé ≤ montant devis restant dû (sinon alerte dépassement)

### Phase 3 — Validation QR-facture SIX

Vérifier que le PDF généré (`ExportPDF.js`) inclut :
- IBAN valide format CH (21 caractères, commence par CH)
- Montant en CHF avec 2 décimales
- Adresse bénéficiaire complète
- Référence de paiement (si QR-référence : 27 chiffres)

```bash
# Vérifier la structure QR dans le PDF
grep -n "iban\|IBAN\|qrReference\|QRReference\|beneficiaire" src/ExportPDF.js
```

### Phase 4 — Rapport de validation

```
╔══════════════════════════════════════╗
║  INVOICE VALIDATOR — Facture #FA-XXX ║
╠══════════════════════════════════════╣
║ ✅ Mentions légales  : 14/14         ║
║ ✅ Calcul TVA        : correct        ║
║ ⚠️  Lien devis       : manquant       ║
║ ✅ Délai 30 jours    : correct        ║
║ ✅ Montant TTC       : CHF 12'450.00  ║
╠══════════════════════════════════════╣
║ STATUT : ⚠️  1 avertissement          ║
║ ACTION : Lier au devis avant envoi   ║
╚══════════════════════════════════════╝
```

---

## Options

- `/invoice-validator` — valider toutes les factures en statut "brouillon"
- `/invoice-validator FA-XXX` — valider une facture spécifique par numéro
- `/invoice-validator --strict` — mode strict : toute anomalie bloque l'envoi
- `/invoice-validator --fix` — tenter de corriger automatiquement les anomalies mineures

---

## Niveaux de sévérité

| Niveau | Exemple | Action |
|--------|---------|--------|
| 🔴 BLOQUANT | TVA incorrecte, lien client manquant | Ne pas envoyer |
| 🟠 IMPORTANT | Lien devis manquant | Avertir avant envoi |
| 🟡 NOTE | Référence chantier non renseignée | Enregistrer pour suivi |

---

## Intégration équipe

Invoice Validator travaille avec :
- `facturation-suisse` — règles TVA et délais paiement suisses
- `qr-facture` (skill) — conformité QR-facture SIX Group
- `sia-118` (skill) — retenue de garantie et conditions contractuelles
- `tva-suisse` (skill) — calculs TVA 8.1% BTP
