---
name: claude-financial-service
description: Claude for Financial Service — analyse financière avancée pour CYNA SÀRL. Cashflow J+30/60/90, optimisation TVA, rentabilité par chantier, benchmarks secteur BTP genevois. Invoque avec /claude-financial-service.
trigger: /claude-financial-service
---

# Skill : Claude for Financial Service — Analyse Financière BTP Suisse

## Principe

Ce skill fournit une analyse financière de niveau fiduciaire pour CYNA SÀRL.
Il traduit les données de l'app en **indicateurs financiers actionnables** :
cashflow prévisionnel, rentabilité réelle par chantier, conformité TVA,
et benchmarks secteur BTP genevois.

**Standard :** chiffres vérifiables, formules certifiées CLAUDE.md, prêts à partager avec le fiduciaire.

---

## Quand l'utilisateur tape `/claude-financial-service`

### Phase 1 — Analyse Cashflow J+30/60/90

Lire les données de facturation et de planning :

```bash
# Factures en cours + dates échéance
grep -n "dateEmission\|datePaiement\|montantHT\|montantTTC\|statut" src/donnees.js | head -30

# Chantiers planifiés avec coûts MO prévisionnels
grep -n "dateDebut\|dateFin\|tarifJour\|nombreJours" src/donnees.js | head -20
```

Calcul des projections :

```
CASHFLOW PRÉVISIONNEL CYNA — [date]
════════════════════════════════════

J+30 (au [date+30])
  Encaissements attendus   : CHF [montant]
    → Factures échues avant J+30 : CHF [montant]
    → Acomptes sur devis signés  : CHF [montant]
  Décaissements prévus     : CHF [montant]
    → Masse salariale estimée    : CHF [montant] ([N] employés × tarifJour × jours)
    → Matériaux commandés        : CHF [montant]
  SOLDE NET J+30           : CHF [montant] [🟢 Positif / 🔴 Négatif]

J+60 (au [date+60])
  Encaissements supplémentaires : CHF [montant]
  Décaissements supplémentaires : CHF [montant]
  SOLDE CUMULÉ J+60             : CHF [montant]

J+90 (au [date+90])
  SOLDE CUMULÉ J+90             : CHF [montant]
```

**Seuils d'alerte trésorerie :**
```
🔴 CRITIQUE  : Solde projeté < 1 mois de charges MO totales
🟠 ATTENTION : Solde projeté entre 1 et 2 mois de charges
🟢 SAIN      : Solde projeté > 2 mois de charges
```

---

### Phase 2 — Optimisation TVA Suisse (8.1%)

**Vérification conformité TVA :**

```bash
# Toutes les factures — vérifier le taux appliqué
grep -n "tva\|TVA\|tauxTVA\|montantTVA" src/donnees.js | head -30
grep -n "montantTTC\|montantHT" src/donnees.js | head -20
```

Calcul automatique du solde TVA :

```
BILAN TVA — Trimestre [T1/T2/T3/T4] [année]
════════════════════════════════════════════
TVA collectée (sur factures HT)   : CHF [montant]
  → Factures émises HT total      : CHF [montant]
  → TVA collectée (× 8.1%)        : CHF [montant]

TVA déductible (sur achats)       : CHF [montant]
  → Matériaux et sous-traitance   : CHF [montant]
  → TVA récupérable (× 8.1%)      : CHF [montant]

SOLDE TVA À VERSER À L'AFC        : CHF [montant]
```

**Vérifications de conformité :**
- [ ] Toutes les factures ont `tauxTVA = 8.1` (pas de valeur hardcodée sans paramètre)
- [ ] `montantTTC = montantHT × 1.081` pour chaque facture — tolérance 0 centime
- [ ] Factures avec TVA 0% justifiées (exportation, médical) — aucune dans BTP standard

**Rappels délais AFC (calendrier TVA 2024/2025) :**
```
Méthode des taux de la dette fiscale nette (TDFN) — décompte semestriel :
  Semestre 1 : échéance 30 août
  Semestre 2 : échéance 28 février (N+1)

Méthode effective — décompte trimestriel :
  T1 : échéance 30 avril
  T2 : échéance 31 juillet
  T3 : échéance 31 octobre
  T4 : échéance 28 février (N+1)
```

---

### Phase 3 — Rentabilité par Chantier (EAC / RAD)

Pour chaque chantier actif, calculer :

```js
// Formules certifiées CLAUDE.md — ne jamais modifier
EAC = avancement > 0 ? coutReel / (avancement / 100) : null
RAD = avancement > 0 ? (coutReel / avancement) * (100 - avancement) : null
margeBrute% = ca > 0 ? ((ca - coutReel) / ca) * 100 : null
depassement = EAC > ca ? EAC - ca : 0
```

Tableau de rentabilité :

```
RENTABILITÉ PAR CHANTIER — [date]
══════════════════════════════════════════════════════════════════
Chantier         | CA HT  | Coût réel | Avanc. | EAC    | RAD    | Marge | Statut
─────────────────|--------|-----------|--------|--------|--------|-------|────────
[nom chantier 1] | [CHF]  | [CHF]     | [X]%   | [CHF]  | [CHF]  | [X]%  | 🟢/🟠/🔴
[nom chantier 2] | [CHF]  | [CHF]     | [X]%   | [CHF]  | [CHF]  | [X]%  | 🟢/🟠/🔴
──────────────────────────────────────────────────────────────────────────────────
TOTAL PORTEFEUILLE | [CHF]| [CHF]     | [X]%   | [CHF]  | [CHF]  | [X]%  |
```

**Codes statut :**
- 🟢 EAC ≤ CA et marge ≥ 20% — rentable, dans les clous
- 🟠 EAC ≤ CA mais marge 15–20% — surveiller
- 🔴 EAC > CA ou marge < 15% — dépassement probable → avenant ou alerte

**Actions automatiques sur dépassement :**
```
🔴 [Chantier X] : EAC CHF [montant] > CA CHF [montant] (+CHF [dépassement], +[X]%)
   → Options : 1. Émettre avenant  2. Optimiser les coûts restants  3. Accepter la perte
```

---

### Phase 4 — Benchmarks BTP Genève

Comparer les indicateurs CYNA aux standards du secteur :

```
BENCHMARKS SECTEUR BTP GENÈVE — CYNA vs. Marché
══════════════════════════════════════════════════════════════
Indicateur              | CYNA      | Benchmark | Statut
────────────────────────|-----------|-----------|────────
Marge nette moyenne     | [X]%      | ≥ 20%     | 🟢/🟠/🔴
DSO (délai encaissement)| [N] jours | < 45 j    | 🟢/🟠/🔴
Coefficient MO appliqué | [X.XX]    | ≥ 1.40 GE | 🟢/🟠/🔴
Taux de devis signés    | [X]%      | > 60%     | 🟢/🟠/🔴
Chantiers à perte       | [N]       | 0         | 🟢/🔴
```

**Référentiels utilisés :**
- Marge nette ≥ 20% : standard BTP Genève (CLAUDE.md)
- Délai paiement 30 jours : SIA 118, art. 153
- Coefficient MO 1.40 : charges sociales complètes GE 2024 (AVS + AC + LPP + AF + IJM + AAP)
- DSO < 45 jours : pratique marché BTP romand
- Retenue de garantie 5% pendant 5 ans : SIA 118 standard

**Calcul DSO :**
```js
// Days Sales Outstanding = (Encours clients / CA annuel) × 365
DSO = encours > 0 && caAnnuel > 0 ? (encours / caAnnuel) * 365 : null
```

---

### Phase 5 — Recommandations Fiscales PME Suisse

**Dates fiscales importantes pour CYNA SÀRL :**
```
CALENDRIER FISCAL 2024-2025
════════════════════════════
TVA         : Trimestriel ou semestriel (choix AFC)
AVS/AC      : Versements mensuels à la Caisse de compensation GE
LPP         : Versements selon institution de prévoyance
Salaires    : Déclaration annuelle LPP + certificats de salaire (31 janvier)
Impôts GE   : Acomptes trimestriels, déclaration annuelle (31 mars N+1)
Allocations : Décompte trimestriel ALPHAPREVANCE ou caisse GE
```

**Optimisation timing facturation (fin d'exercice) :**
```
À faire en décembre pour optimiser l'exercice :
  ✅ Émettre toutes les situations possibles — augmente le CA de l'exercice
  ✅ Décaler les gros achats matériaux en janvier — réduit les charges N
  ✅ Provisionner les retenues de garantie — réduction base imposable
  ✅ Vérifier les notes de frais — déductibles si justificatifs OK

Retenue de garantie 5% (SIA 118) :
  → Comptabiliser en produit différé, pas en CA immédiat
  → Libération après délai de garantie (généralement 2 ans)
  → Base de calcul : montant HT du marché
```

**Optimisation coefficient MO :**
```
Coefficient actuel recommandé GE (2024) :
  Salaire brut            : 100%
  AVS/AI/APG employeur    : 5.30%
  AC employeur            : 1.10%
  AAP                     : 0.50% (variable secteur)
  AANP                    : 1.11%
  LPP employeur           : ≈ 9-12% (selon âge moyen équipe)
  AF Genève               : 2.94%
  IJM                     : ≈ 1.50%
  ──────────────────────────────
  TOTAL charges           : ≈ 21-24% → coefficient ≈ 1.40
```

---

### Phase 6 — Rapport Financier Mensuel

Générer un rapport complet prêt pour le fiduciaire :

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CYNA SÀRL — RAPPORT FINANCIER [mois] [année]
  Établi le [date] — Confidentiel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ACTIVITÉ DU MOIS
   CA facturé HT          : CHF [montant]
   CA en cours (non fact.): CHF [montant]
   Nouvelles commandes    : CHF [montant] ([N] devis signés)
   Taux de conversion     : [X]% ([N] devis signés / [N] envoyés)

2. RENTABILITÉ
   Marge brute            : CHF [montant] ([X]%)
   Marge nette (fg 12%)   : CHF [montant] ([X]%)
   Meilleure marge        : [Chantier] [X]%
   Marge en alerte        : [Chantier] [X]% — action requise

3. TRÉSORERIE
   Encours clients        : CHF [montant]
   Dont > 30 jours        : CHF [montant] ([N] factures)
   Dont > 60 jours        : CHF [montant] — RELANCES URGENTES
   Cashflow J+30 estimé   : CHF [montant]

4. TVA
   Période               : [T] [année]
   TVA collectée         : CHF [montant]
   TVA déductible        : CHF [montant]
   Solde à verser AFC    : CHF [montant]
   Échéance              : [date]

5. KPIs CLÉS
   DSO                   : [N] jours (cible < 45)
   Chantiers actifs      : [N]
   EAC > budget          : [N] chantiers — voir détail phase 3
   Coefficient MO moyen  : [X.XX] (cible ≥ 1.40)

6. ACTIONS REQUISES AVANT FIN DE MOIS
   □ [Action 1 avec responsable et montant]
   □ [Action 2 avec responsable et montant]
   □ [Action 3 avec responsable et montant]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rapport généré automatiquement — Données source : CYNA App
Vérification fiduciaire recommandée avant dépôt fiscal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Options

- `/claude-financial-service` — analyse complète (toutes phases)
- `/claude-financial-service --cashflow` — projection J+30/60/90 uniquement (phase 1)
- `/claude-financial-service --tva` — bilan TVA + dates AFC (phase 2)
- `/claude-financial-service --eac` — rentabilité par chantier EAC/RAD (phase 3)
- `/claude-financial-service --benchmark` — benchmarks BTP Genève (phase 4)
- `/claude-financial-service --report` — rapport mensuel complet fiduciaire (phase 6)
- `/claude-financial-service --fiscal` — recommandations et calendrier fiscal (phase 5)

---

## Intégration équipe

Claude for Financial Service s'appuie sur les agents spécialisés :
- `rentabilite-analyst` — calculs EAC/RAD/marges certifiés
- `cashflow-forecaster` — projection trésorerie J+30/60/90
- `facturation-suisse` — conformité TVA et montants TTC
- `charges-sociales-suisse` (skill) — coefficient MO exact GE 2024
- `tva-suisse` (skill) — règles TVA et décomptes AFC
- `sia-118` (skill) — retenues de garantie et délais SIA
- `claude-small-business` (skill) — synthèse exécutive pour le patron
