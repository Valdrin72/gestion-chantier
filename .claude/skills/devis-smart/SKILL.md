---
name: devis-smart
description: Devis Smart CYNA — génère des postes de devis BTP structurés avec ratios heures/m², marges cibles, TVA 8.1%, adapted aux chantiers genevois (faux-planchers, faux-plafonds, second œuvre). Invoque avec /devis-smart.
trigger: /devis-smart
---

# Skill : Devis Smart — Générateur intelligent de devis BTP CYNA SÀRL Genève

## Quand l'utilisateur tape `/devis-smart [type de travaux] [surface m²]`

---

## Phase 1 — Ratios de production CYNA (données terrain)

**Faux-planchers techniques :**
- Pose : 0.8–1.2h/m² (ouvrier qualifié)
- Matériau : CHF 45–85/m² selon gamme
- Marge cible : 22–28%

**Faux-plafonds :**
- Pose placo BA13 : 0.6–0.9h/m²
- Pose dalle 60×60 : 0.4–0.6h/m²
- Matériau : CHF 25–55/m²
- Marge cible : 20–25%

**Peinture intérieure :**
- Préparation : 0.15h/m²
- 2 couches : 0.25h/m²
- Matériau : CHF 8–15/m²

**Carrelage :**
- Pose standard : 1.0–1.5h/m²
- Pose complexe (opus) : 2.0–3.0h/m²
- Matériau : CHF 35–120/m²

**Cloisons / distribution :**
- Cloison placo simple : 0.8–1.1h/m²
- Cloison phonique : 1.2–1.6h/m²

---

## Phase 2 — Calcul automatique d'un devis

```js
// Pour un chantier type donné :
const devis = {
  postes: [
    {
      description: 'Fourniture et pose faux-plancher technique',
      unite: 'm²',
      quantite: surface,
      prixUnitaireHT: (heures_par_m2 * tarifHoraire + materiau_m2) * (1 + marge),
      tva: 8.1,
    },
    // ...
  ],
  // Coefficient MO : 1.40 recommandé GE (charges sociales complètes)
  // tarifHoraire = tarifJour / 8
};
```

---

## Phase 3 — Template de devis structuré CYNA

```
DEVIS N° DV-2026-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENT     : [Nom client]
CHANTIER   : [Adresse]
DATE       : [Aujourd'hui]
VALIDITÉ   : 30 jours
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POS. DESCRIPTION              QTÉ  U    PU HT    TOTAL HT
 01  Faux-plancher technique  120  m²   CHF 95   CHF 11'400
 02  Faux-plafond dalles      120  m²   CHF 62   CHF  7'440
 03  Peinture 2 couches       240  m²   CHF 28   CHF  6'720
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL HT                              CHF 25'560
TVA 8.1%                              CHF  2'070
TOTAL TTC                             CHF 27'630
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Acompte 30% à la signature : CHF 8'289
Solde à réception : CHF 19'341
Retenue garantie 5% (SIA 118) : CHF 1'382
```

---

## Phase 4 — Vérification marges

```
Marge brute estimée : 23.4% ✅ (cible ≥ 20%)
Marge nette (FG 12%) : 11.4% ⚠️  (à surveiller)
Durée estimée : 18 jours ouvr.
Effectif suggéré : 2–3 ouvriers
```

---

## Options

- `/devis-smart faux-plancher 150` — génère un devis faux-plancher pour 150 m²
- `/devis-smart faux-plafond 80` — génère un devis faux-plafond pour 80 m²
- `/devis-smart peinture 200` — génère un devis peinture pour 200 m²
- `/devis-smart complet 120` — génère un devis multi-postes pour 120 m²

---

## Intégration équipe

Devis Smart travaille avec :
- `devis-generator` — valide les postes générés selon les règles métier CYNA
- `tva-suisse` (skill) — vérifie les calculs TVA 8.1%
- `productivite-cyna` (skill) — affine les ratios heures/m²
- `numero-format-cyna` (skill) — génère le bon numéro de devis (DV-AAAA-NNN)
- `rentabilite-analyst` — vérifie que la marge cible est atteinte avant envoi
