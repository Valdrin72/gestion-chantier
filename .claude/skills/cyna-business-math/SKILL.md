---
name: cyna-business-math
description: Skill calculs métier CYNA SÀRL — toutes les formules BTP suisses vérifiées (marge, EAC, RAD, CA, TVA, coût MO, avancement, potentiel facturable). Invoque avec /cyna-business-math pour tout calcul de rentabilité ou vérification de formule.
---

# CYNA Business Math — Formules BTP Suisse Vérifiées

## 1. CHIFFRE D'AFFAIRES (CA)

```
CA chantier = devis.montantHT
            + avenants sur devis
            + avenants sur chantier
            + heures en régie (si applicable)
```

**Règle absolue** : Le CA ne se ressaisit JAMAIS sur le chantier.
Source unique = `devis.montantHT` du devis signé lié.

---

## 2. COÛT MAIN D'ŒUVRE RÉEL

```js
// Pour chaque employé sur le chantier :
heuresEmploye = journal.filter(e => e.employes[].id === empId)
                       .reduce((s, e) => s + heuresTravaillees, 0)

joursReels = heuresEmploye / 8   // 1 jour = 8 heures (CCT Romande)

// Si emp.tarifDejaCharge = true :
coutMO = joursReels × emp.tarifJour

// Si emp.tarifDejaCharge = false :
coutMO = joursReels × emp.tarifJour × coefficientMO
// coefficientMO défaut = 1.35 (minimum légal GE)
// coefficientMO recommandé = 1.40 (BTP Genève complet)
```

**Interdit** : utiliser `joursPlannifies` ou `joursRealises` des membres
d'équipe dans un calcul réel — seul le journal des heures fait foi.

---

## 3. TOTAL COÛTS RÉELS

```
totalCoutsReel = coutMOréel
               + materielReel       (alias: coutMaterielReel)
               + sousTraitanceReelle (alias: coutSousTraitanceReel)
               + transportReel
               + autresCoutsReels   (alias: autresCoutsReel)
```

Double-fallback obligatoire : `parseFloat(a) || parseFloat(b) || 0`

---

## 4. MARGE

```js
// Marge brute (valeur absolue)
margeBrute = CA - totalCoutsReel

// Marge brute % — TOUJOURS sur vente (pas sur coût !)
margeBrutePct = CA > 0 ? (margeBrute / CA) * 100 : null

// Marge nette (après frais généraux)
tauxFG = parametres.tauxFraisGeneraux || 12   // % défaut
margeNette = margeBrute - (CA × tauxFG / 100)
margeNettePct = CA > 0 ? (margeNette / CA) * 100 : null
```

### Seuils de rentabilité BTP Genève

| Marge nette | Statut |
|------------|--------|
| ≥ 20% | ✅ Rentable |
| 15–20% | ⚠️ Limite |
| < 15% | 🔴 Non rentable |
| < 0% | 💀 À perte — alerte critique |

---

## 5. AVANCEMENT

```js
// Source unique : jours réels du journal
joursUniques = new Set(journal.map(e => e.date).filter(Boolean)).size
avancement = nombreJours > 0
  ? Math.min(100, Math.max(0, (joursUniques / nombreJours) * 100))
  : parseFloat(chantier.avancement) || 0

// Protection obligatoire
const av = Math.min(100, Math.max(0, parseFloat(chantier.avancement) || 0))
```

**Interdit** : estimer l'avancement manuellement dans les calculs.

---

## 6. EAC — Estimated At Completion (Coût final prévu)

```js
// EAC = coût total prévu si on continue au rythme actuel
eac = avancement > 0
  ? (totalCoutsReel / (avancement / 100))
  : null

// Interprétation :
// eac < CA  → chantier sous contrôle
// eac > CA  → chantier va dépasser le budget
// eac = null → pas encore démarré, impossible à projeter
```

---

## 7. RAD — Reste À Dépenser

```js
// RAD = ce qu'il reste à dépenser pour finir le chantier
rad = avancement > 0 && avancement < 100
  ? eac - totalCoutsReel
  : null

// Ou directement :
rad = (totalCoutsReel / (avancement / 100)) * (1 - avancement / 100)

// Interprétation :
// rad > budget_restant → dépassement probable
// rad < 0             → bug (impossible), vérifier l'avancement
```

---

## 8. POTENTIEL FACTURABLE

```js
// Ce qu'on peut facturer maintenant selon l'avancement
potentielFacturable = Math.max(0, CA * (avancement / 100) - dejàFacturé)

// dejàFacturé = somme des factures existantes liées au chantier
dejàFacturé = factures
  .filter(f => String(f.chantierId) === String(chantier.id))
  .reduce((s, f) => s + (parseFloat(f.montantHT) || 0), 0)
```

---

## 9. TVA SUISSE 2024

```js
const TVA_STANDARD = 8.1   // BTP, matériaux, main d'œuvre
const TVA_REDUIT   = 2.5   // Alimentation (non BTP)
const TVA_HEBERGEMENT = 3.7

// Calcul TTC
montantTTC = montantHT * (1 + tva / 100)
montantTTC = montantHT * 1.081   // défaut BTP

// Calcul HT depuis TTC
montantHT = montantTTC / 1.081

// TVA pure
montantTVA = montantHT * 0.081
```

---

## 10. RETENUE DE GARANTIE

```js
// Standard BTP suisse
retenueGarantie = montantHT * 0.05   // 5% du marché
// Durée : 5 ans (garantie décennale)
// Libération : sur demande après réception sans réserve
```

---

## 11. ACOMPTE SIGNATURE

```js
// Fourchette standard BTP Genève
acompteMin = montantHT * 0.10   // 10%
acompteMax = montantHT * 0.30   // 30%
// Défaut CYNA : 30% à la signature
```

---

## 12. DÉLAIS ET JOURS

```js
// Convention CCT Romande
HEURES_PAR_JOUR = 8
JOURS_PAR_SEMAINE = 5   // lundi–vendredi
// Samedi possible si chantier.inclusSamedi = true

// Délai paiement factures
DELAI_PAIEMENT_JOURS = 30   // standard BTP suisse

// Heures supplémentaires
MAJORATION_SEMAINE = 1.25    // 125%
MAJORATION_DIMANCHE = 1.50   // 150% + jours fériés
```

---

## 13. PROTECTIONS OBLIGATOIRES (NaN / division zéro)

```js
// ✅ Division
const pct = total > 0 ? (val / total) * 100 : null

// ✅ Coûts
const cout = parseFloat(chantier.monChamp) || 0

// ✅ Avancement
const av = Math.min(100, Math.max(0, parseFloat(chantier.avancement) || 0))

// ✅ Retour de % = number (pas string !)
return Math.round(val * 1000) / 10   // ✅ number
// return (val * 100).toFixed(1)     // ❌ string !

// ✅ Comparaison statuts
['en cours', 'terminé'].includes(c.statut?.trim().toLowerCase())

// ✅ Liens inter-entités
String(facture.chantierId) === String(chantier.id)
```

---

## 14. COHÉRENCE DES DONNÉES — VÉRIFICATIONS

| Vérification | Formule |
|-------------|---------|
| Facture > CA | `facture.montantHT > chantier.CA` → alerte |
| Dépassement budget | `totalCoutsReel > CA * 1.20` → alerte rouge |
| Retard | `joursUniques > chantier.nombreJours + 7` → alerte |
| Marge négative | `margeBrutePct < 0` → alerte critique |
| Impayé | `facture.dateEmission` + 30j < aujourd'hui + statut ≠ payée |

---

## 15. CHAMPS — NOMMAGE SOURCE UNIQUE

| Donnée | Champ correct | Alias rétrocompat |
|--------|--------------|------------------|
| Matériel réel | `materielReel` | `coutMaterielReel` |
| Sous-traitance réelle | `sousTraitanceReelle` | `coutSousTraitanceReel` |
| Autres coûts réels | `autresCoutsReels` | `autresCoutsReel` |
| Date facture | `dateEmission` | ~~`dateFacture`~~ ~~`creeLe`~~ |
| Montant devis | `devis.montantHT` | jamais re-saisi |

---

## Utilisation

```
/cyna-business-math                    → toutes les formules
/cyna-business-math marge              → section marge uniquement
/cyna-business-math eac rad            → EAC + RAD
/cyna-business-math tva                → calculs TVA
/cyna-business-math verifier [formule] → vérifier une formule du code
```
