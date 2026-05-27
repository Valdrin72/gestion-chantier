# AUDIT_POINTAGE.md — Cartographie du système de saisie des heures

> **Date de l'audit :** 2026-05-27
> **Branche auditée :** `main` (commit `8da3c5a`)
> **Périmètre :** lecture seule — aucun fichier de production modifié
> **Objectif :** préparer la refonte du modèle de pointage (mono-chantier → multi-activités)

---

## A. MODÈLE DE DONNÉES ACTUEL

### A1. L'entité "pointage" n'existe pas sous ce nom

Il n'y a **pas de store Zustand** dans ce projet. L'état global est géré par `src/context/AppContext.js` (React Context).

Il n'y a **pas d'entité "pointage"** à proprement parler. Le concept est encodé comme **"journal des heures"**, imbriqué directement dans chaque chantier.

### A2. Format exact d'un journal (source unique : `src/donnees.js` L833)

```js
// Format journal — 3 formats historiques gérés par migrerJournal(), mais UN SEUL format canonique en prod :
chantier.journal = [
  {
    date: "2025-10-01",          // string ISO YYYY-MM-DD — obligatoire
    employes: [                   // array — un objet par employé présent ce jour
      {
        employeId: 1,             // number (integer) — FK vers parametres.employes[].id
        heuresTravaillees: 8,     // number ou string (parseFloat appliqué partout) — ex: 7.5, "8"
      },
      {
        employeId: 2,
        heuresTravaillees: 8,
      },
    ],
  },
  // ... une entrée par date travaillée
]
```

**Champs ABSENTS du format actuel :**
- ❌ Catégorie d'activité (production / déplacement / atelier / absence)
- ❌ Motif d'absence
- ❌ Type d'heure (normal / supplémentaire / dimanche)
- ❌ Majoration appliquée
- ❌ Notes / commentaires
- ❌ Statut de validation (saisi / validé / verrouillé)

### A3. Format exact de l'entité "employe" (`src/donnees-demo.js` L203+)

```js
{
  id: 1,                          // number — PK
  nom: 'Sami Berisha',            // string
  prenom: undefined,              // string — optionnel (certains employés n'ont que nom)
  poste: 'Chef de chantier',      // string libre — ex: 'Monteur cloisons', 'Menuisier', 'Manœuvre'
  equipe: 'A',                    // string — 'A', 'B', 'C' (optionnel)
  tarifJour: 650,                 // number CHF/jour — BRUT si tarifDejaCharge:false, CHARGÉ si true
  tarifDejaCharge: true,          // boolean — si true, tarif utilisé tel quel; si false → × coefficientMainOeuvre (1.35)
  telephone: '079 111 11 11',     // string (optionnel)
  email: 's.berisha@cyna.ch',     // string (optionnel)
  actif: true,                    // boolean — false = archivé, exclu des KPIs
}
```

**Champs ABSENTS de l'entité employé :**
- ❌ Statut frontalier / résident suisse
- ❌ Type de contrat (fixe / temporaire / sous-traitant)
- ❌ Quota hebdomadaire (défaut implicite : 5j × 8h = 40h)
- ❌ Solde congés payés
- ❌ Coefficient individuel (un seul coefficientMainOeuvre global dans parametres)

### A4. Les 3 "niveaux de tarifs" dans le code

Les CLAUDE.md mentionnent chef d'équipe CHF 450/j, ouvrier qualifié CHF 350/j, MO CHF 280/j. **Ces niveaux n'existent pas en tant que catégories codées** — les tarifs sont libres, saisis manuellement par employé. Les données démo montrent :

| Employé | Poste | tarifJour | tarifDejaCharge | Coût chargé |
|---------|-------|-----------|----------------|-------------|
| Sami Berisha | Chef de chantier | 650 | true | 650 CHF/j |
| Luca Ferretti | Monteur cloisons | 360 | false | 486 CHF/j (×1.35) |
| Ivan Kovac | Menuisier | 340 | false | 459 CHF/j |
| Amir Dallah | Manœuvre | 290 | false | 391.50 CHF/j |
| Radu Petrov | Conducteur de travaux | 620 | true | 620 CHF/j |
| Marco Gentile | Carreleur | 380 | false | 513 CHF/j |
| Jonas Müller | Monteur vitrages | 370 | false | 499.50 CHF/j |
| Valdrin Salihu | Directeur technique | 700 | true | 700 CHF/j |
| Arben Krasniqi | Plâtrier | 355 | false | 479.25 CHF/j |
| Dren Berisha | Technicien faux-planchers | 365 | false | 492.75 CHF/j |

### A5. Coût de déplacement — modélisation actuelle

Le déplacement n'est **pas saisi dans le journal**. Il est calculé automatiquement :

```js
// src/donnees.js L251-260
const localite = localites.find(l => l.nom === chantier.ville);
const tarifDeplacement = localite ? localite.tarifJour : 0;  // ex: Genève = 60 CHF/j, Lausanne = 50 CHF/j
const coutDeplacementReel = tarifDeplacement × joursReelsJournal;
```

Le tarif est fixé par **localité** (table `parametres.localites`), pas par employé. Tous les employés du chantier ont le même tarif de déplacement, imputé au chantier automatiquement.

---

## B. SAISIE — CRÉATION ET ÉDITION

### B1. Points d'entrée de saisie

Il n'existe **pas de concept "addPointage" / "createPointage"** dans le code. La saisie s'appelle **"saisie des heures"** et opère directement sur `chantier.journal`.

Les trois points d'entrée identifiés :

| Composant | Fichier | Usage UI | Utilisateur probable |
|-----------|---------|----------|---------------------|
| **Heures.js** | `src/Heures.js` | Page dédiée "Journal des heures" — vue hebdomadaire en grille, navigation semaine par semaine | Valdrin (bureau), chef de chantier |
| **ModalSaisieHeures** | `src/components/ModalSaisieHeures.js` | Modal multi-employés déclenché depuis ChantierDetail — saisie d'une journée entière pour tous les employés d'un chantier | Valdrin, frère sur chantier |
| **SaisieRapideDashboard** | `src/components/SaisieRapideDashboard.js` | Widget pliable sur le Dashboard — saisie rapide 1 chantier + 1 date + N employés | Usage quotidien rapide |

Aucune saisie via import fichier, API externe, ou QR code n'existe.

### B2. Flow exact de création d'une entrée journal

**Via Heures.js (flow principal) :**
```
1. Utilisateur ouvre la page Heures
2. Sélectionne une cellule [employé × jour] dans la grille hebdomadaire
   → ouvrirModal({ date, employeId })
3. Le modal pré-remplit : employeId, date (ce jour), chantierId (1er chantier ou existant), heures (8 par défaut)
4. Champs requis : employeId ✓, chantierId ✓, date ✓, heures ✓
5. Validations :
   - heures > 0 et ≤ 16
   - date ≤ aujourd'hui (exception : samedi semaine courante si chantier.inclusSamedi = true)
   - samedi requiert confirmation explicite si chantier.inclusSamedi = false
6. sauvegarder() → setChantiers(prev => mise à jour immuable de chantier.journal)
7. AppContext propage le changement → Supabase sync (via useSupabaseData)
```

**Champs requis :** `employeId`, `chantierId`, `date`, `heures` — tous obligatoires.
**Champs optionnels :** aucun — le format journal n'a que ces 4 champs (date au niveau entrée, employeId + heuresTravaillees au niveau membre).

### B3. Répartition multi-chantiers par journée

**ABSENT.** Le modèle actuel impose :

> **1 employé × 1 jour = 1 chantier** (avec un nombre d'heures)

Dans `Heures.js`, la logique de lookup cherche la 1ère correspondance :
```js
// src/Heures.js L56-61
for (const c of chantiers) {
  const entry = (c.journal || []).find(e => e.date === prefill.date);
  if (entry) {
    const emp = (entry.employes || []).find(e => String(e.employeId) === String(employeId));
    if (emp) { chantierId = c.id; heuresExistantes = String(emp.heuresTravaillees); break; } // ← BREAK au 1er trouvé
  }
}
```

Cela signifie que si un employé travaille sur deux chantiers le même jour, seule la 1ère entrée est affichée dans le modal. La 2e est techniquement stockable mais pas visible ni éditable via l'UI standard.

---

## C. CONSOMMATEURS DU JOURNAL

### C1. Tous les modules qui lisent le journal

| Fichier | Ce qu'il en fait |
|---------|-----------------|
| `src/donnees.js` L263–284 | **calculerCoutsChantier** — calcule coût MO réel (heures × tarifJour), jours réels, coût déplacement réel, avancement |
| `src/donnees.js` L918–969 | **calculerEtatChantier** — même logique, projection EAC/RAD, margeProjeteePct |
| `src/donnees.js` L879–896 | **heuresEmploye / heuresJour** — helpers d'agrégation bruts |
| `src/donnees.js` L151–157 | **getHeuresParEmployeParDate** — pivot `{empId: {date: heures}}` pour la grille Heures.js |
| `src/Heures.js` | Affichage grille hebdo, KPIs (totalHeures, totalSupp, nonSaisis) |
| `src/components/ModalSaisieHeures.js` | Lecture heures existantes pour pré-remplissage + sauvegarde |
| `src/components/SaisieRapideDashboard.js` | Pré-remplissage par date, sauvegarde |
| `src/AgentEngine.js` (multiple agents) | Calculs RH, productivité, anomalies — voir C3 |
| `src/modules/alertes/contextAdapter.js` L131–145 | Génère `ctx.pointages` pour le moteur d'alertes (heures_sup = heures > 8) |
| `src/Rapport.js` | Affichage heures réalisées par chantier |
| `src/Analyse.js` | Total heures réalisées, jours réels, tableau comparatif par employé |
| `src/AuditApp.js` | Validation : heures légales (0.5–24h), dates futures, CCT ≤ 10h |
| `src/Statistiques.js` | Jours réels pour écarts prévu vs réel |
| `src/Planning.js` | Jours réalisés pour affichage barre de progression |
| `src/ExportPDF.js` L288 | Jours réels par employé dans le PDF chantier |
| `src/components/chantiers/ChantierDetail.js` | Jours réalisés, dates samedi, avancement |
| `src/components/chantiers/detail/DetailRentabilite.js` | Via calculerCoutsChantier |
| `src/components/chantiers/detail/DetailProjection.js` | Via calculerEtatChantier |
| `src/components/chantiers/ChantiersListe.js` | Via DerivePredictor |
| `src/hooks/useChantierCalculs.js` | Agrégation des deux moteurs |
| `src/pages/Dashboard.js` | Via les deux moteurs |
| `src/pages/FinancesPage.js` | Via calculerEtatChantier |

### C2. Comment les moteurs consomment le journal

**calculerCoutsChantier (L221) :**
```js
const journalCouts = chantier.journal || [];
// 1. Set de dates uniques → jours réels
const joursReelsJournal = new Set(journalCouts.map(e => e.date).filter(Boolean)).size;
// 2. Tous les employeIds présents dans le journal
const empIdsAvecHeures = [...new Set(journalCouts.flatMap(e => e.employes.map(em => em.employeId)))];
// 3. Pour chaque employé : heures totales → jours réels → coût
const joursReels = heuresEmploye(journalCouts, empId) / 8;
const cout = getTarifJour(emp) × joursReels;
// 4. Avancement = jours réels / nombreJours (chantier.nombreJours)
```

**calculerEtatChantier (L883) :**
```js
const journal = chantier.journal || [];
// Même logique, plus :
// EAC = coûtRéel / (avancement / 100)
// RAD = EAC - coûtRéel
// margeProjeteePct = (CA - EAC) / CA × 100
```

**Formule coût MO :**
```
coûtMO = Σ (heuresEmploye(journal, empId) / 8) × tarifJourChargé(emp)
```
où `tarifJourChargé = tarifJour × (tarifDejaCharge ? 1 : 1.35)`

### C3. Agents AgentEngine.js qui touchent au journal

| Agent | Fonction | Usage journal |
|-------|----------|--------------|
| **ProductiviteEquipe** | `runProductiviteEquipe` L534 | heuresEmploye() par chantier, heures semaine, jours actifs, surcharge >45h/semaine, sous-activité <20h/semaine |
| **MemoireChantier** | `runMemoireChantier` L495 | Jours réalisés (Set dates), productivité journalière |
| **PlanningCoherence** | `runPlanningCoherence` L783 | Dates samedi, dates futures dans journal, écart avancement manuel vs journal |
| **ConformiteBTP** | `runConformiteBTP` L1050 | Heures semaine pour vérification CCT |
| **AnomaliesDonnees** | `runAnomaliesDonnees` L659 | Tarif manquant si employé dans journal sans tarifJour |
| **DerivePredictor** | `runDerivePredictor` L1086 | Via getCouts() → calculerCoutsChantier → journal |
| **RadarPrecoce** | `runRadarPrecoce` L1174 | Via getCouts() → journal |
| **ApprentissageMarge** | `runApprentissageMarge` L883 | Via getCouts() → journal |
| **DiagnosticRaison** | `runDiagnosticRaison` L1684 | Via getCouts() → journal |
| **OptimisationEquipe** | `runOptimisationEquipe` L1523 | Durée réelle chantier (Set dates), heures semaine |
| **CoutMOAnalyse** | `runCoutMOAnalyse` L1300 | Heures totales, heures semaine par employé |
| **simulerRapportLundi** | `simulerRapportLundi` L245 | Employés sans saisie cette semaine → action "compléter heures manquantes" |
| **HEURES_SUP_ELEVEES** (module alertes) | `rh.js` | Via `ctx.pointages` (dérivé du journal) — seuil >25h sup/mois |

---

## D. LIMITES IDENTIFIÉES DU MODÈLE ACTUEL

| Fonctionnalité | Statut | Détail |
|----------------|--------|--------|
| **Répartition multi-activités par journée** | ❌ ABSENT | 1 employé × 1 jour × 1 chantier uniquement. Multi-chantier techniquement possible mais UI bloquante (break au 1er trouvé). |
| **Catégorisation des heures** (production / déplacement / atelier) | ❌ ABSENT | Le champ `heuresTravaillees` est un nombre brut sans type. |
| **Gestion des absences avec motifs** (CP, maladie, AT, intempérie, formation) | ❌ ABSENT | Aucun champ absence dans le journal. Un jour sans saisie = jour inconnu, pas = absence. |
| **Distinction frontalier / résident** (Genève) | ❌ ABSENT | Pas de champ statut fiscal sur l'employé. |
| **Heures supplémentaires avec majoration** | ⚠️ PARTIELLEMENT GÉRÉ | L'UI valide max 16h/j. `heures_sup = Math.max(0, h - 8)` calculé dans contextAdapter pour les alertes, mais **aucune majoration financière n'est appliquée** (×1.25 semaine, ×1.50 dimanche CCT). Les heures sup sont comptées au même tarif que les heures normales dans les coûts. |
| **Imputation déplacement chantier vs FG** | ⚠️ PARTIELLEMENT GÉRÉ | Déplacement imputé au chantier automatiquement via tarif localité. Mais tarif uniforme (tous les employés idem), pas de distinction employé par employé, et aucune option d'imputer en FG. |
| **Heures atelier / dépôt** | ❌ ABSENT | Pas de chantier "interne" ou "atelier" dans la liste. |
| **Pointage collectif chef d'équipe** | ❌ ABSENT | Chaque employé est saisi individuellement. |
| **Verrouillage / validation du pointage** | ❌ ABSENT | Aucun workflow de validation (saisi → validé → verrouillé). |
| **Notes par journée** | ❌ ABSENT | |
| **Photos / PVs liés au pointage** | ❌ ABSENT | |
| **Saisie mobile offline** | ❌ ABSENT | L'app est une SPA React en ligne. |

---

## E. PROPOSITIONS — AGENTS, SKILLS, PLUGINS

### E1. Agents AgentEngine.js à adapter si refonte du journal

Ces agents lisent directement `c.journal` ou `entry.employes[].heuresTravaillees` :

| Agent | Impact de la refonte | Adaptation nécessaire |
|-------|---------------------|----------------------|
| **ProductiviteEquipe** | Fort | Si le journal contient des catégories, distinguer heures production vs déplacement vs absence |
| **MemoireChantier** | Moyen | Les jours réels devront peut-être exclure les jours d'absence |
| **PlanningCoherence** | Fort | La détection "date future" et "samedi" devra tenir compte de la catégorie |
| **ConformiteBTP** | Fort | La CCT s'applique aux heures de travail effectif, pas aux heures d'absence — le calcul CCT devra filtrer par catégorie |
| **CoutMOAnalyse** | Fort | Heures de déplacement → coût différent des heures de production |
| **simulerRapportLundi** | Moyen | "Aucune heure cette semaine" devra distinguer absence justifiée vs oubli de saisie |
| **HEURES_SUP_ELEVEES** | Moyen | heures_sup doit être calculé sur les heures de production uniquement |
| **OptimisationEquipe** | Moyen | La productivité horaire change si les heures de déplacement sont exclues |
| **contextAdapter.js** | Fort | Le pivot vers `ctx.pointages` devra enrichir les champs (catégorie, motif) |

### E2. Nouveaux agents proposés pour le nouveau modèle

| Nom | Rôle | Trigger | Sortie |
|-----|------|---------|--------|
| **OubliPointage** | Détecte les jours ouvrables sans aucune entrée (ni heures ni absence) pour un employé actif | Quotidien (lundi matin pour la semaine passée) | Liste employés × dates manquantes avec lien vers saisie |
| **PointageCohérence** | Détecte les journées où le total des heures saisies est aberrant (ex: 24h, ou 0h un lundi sans absence justifiée) | À chaque sauvegarde | Alerte ATTENTION avec détail employé/date |
| **RatioDéplacementChantier** | Alerte si le temps de déplacement dépasse X% du temps total sur un chantier (signal que la localisation du chantier pèse trop dans les coûts) | Hebdomadaire | Alerte INFO avec ratio %, impact CHF estimé |
| **HeuresSuppAnticipateur** | Prédit les heures supplémentaires probables d'ici fin de chantier selon le rythme actuel (heures semaine × semaines restantes) | Hebdomadaire | Prédiction heures sup, coût maj. CCT estimé |
| **CohérenceCatégories** | Vérifie que les saisies de catégories respectent les règles métier (ex: pas d'heures "production" un dimanche, pas d'absence + production le même jour) | À chaque sauvegarde | Alerte CRITIQUE si règle violée |
| **AffectationBizarre** | Détecte un employé facturé sur un chantier où il n'a aucune heure dans le journal (équipe planifiée mais jamais présente) | Hebdomadaire | Alerte INFO pour revue manuelle |
| **AbsenceChronique** | Alerte si un employé cumule >X jours d'absence non planifiée sur le mois (signal de problème RH) | Mensuel | Alerte ATTENTION, lien vers fiche employé |
| **ImpactMauvaisMeteo** | Croise les jours d'intempérie (catégorie saisie) avec les chantiers concernés et estime l'impact sur le planning (jours perdus × coût FG) | À la saisie d'une intempérie | Rapport d'impact, suggestion de reclassement |

### E3. Skills Claude Code touchant au pointage

Skills existantes pertinentes :
- **`cyna-business-math`** — contient la logique de calcul des coûts MO. Devra être enrichie avec les formules de majoration CCT (×1.25 semaine, ×1.50 dimanche/férié) et les formules de coût par catégorie.
- **`cct-sor`** — référence CCT-SOR, utile pour valider les seuils d'heures sup et les droits aux majorations.
- **`charges-sociales-suisse`** — si la refonte inclut la distinction frontalier (permis G), les bases de calcul des charges changent.

**Nouvelle skill recommandée : `journal-pointage`**
Une skill dédiée qui encapsule :
- Le format canonique du journal v2 (avec catégories)
- Les règles de validation par catégorie (que peut contenir un jour "déplacement" ? une "absence maladie" ?)
- Les formules de majoration CCT applicables par type d'heure
- Les règles de migration journal v1 → journal v2 (backward compat)

L'enrichissement de `cyna-business-math` seul serait insuffisant car les règles de saisie (UI) et les règles de calcul (moteurs) devront toutes deux être mises à jour.

### E4. Hooks / plugins — suffisance pour la refonte

**Hooks actuels :**
- `security-scan` (Deep Security Scan) — vérifie XSS, secrets, auth. Non impacté par la refonte du journal.
- `btp-audit` (BTP Audit) — vérifie les patterns CLAUDE.md (NaN, division par zéro, comparaisons statut). **Insuffisant** : il ne vérifiera pas la cohérence des nouvelles catégories.

**Nouveau hook recommandé : `journal-schema-validator`**

Un hook `PostToolUse` sur `Write|Edit` qui, lorsqu'un fichier modifié contient du code lié à `chantier.journal`, vérifie :
- Que les nouveaux champs `categorie` sont dans une liste blanche
- Que `heuresTravaillees` est toujours parsé via `parseFloat(...) || 0`
- Qu'aucune comparaison `=== 'production'` sans `.toLowerCase()`

---

## F. QUESTIONS STRATÉGIQUES EN SUSPENS — Décisions avant Phase 2

Ces décisions business doivent être tranchées par Valdrin avant qu'on touche au code.

### F1. Catégories d'activités

**Question :** Quelles catégories veux-tu gérer ?

Proposition minimale :
- `production` — travail effectif sur chantier (facturable)
- `deplacement` — trajet chantier (à décider : imputé chantier ou FG ?)
- `atelier` — préparation en dépôt/atelier (non facturé au client)
- `absence_cp` — congés payés
- `absence_maladie` — maladie (couvert par IJM ?)
- `absence_at` — accident de travail
- `intemperie` — chantier bloqué météo
- `formation` — formation (interne/externe)

**Question :** La catégorie `deplacement` fait-elle partie des heures travaillées (compte dans les 8h journalières) ou est-ce un champ séparé ?

### F2. Imputation du déplacement

**Question :** Les frais de déplacement (temps + indemnité CHF) sont-ils imputés :
- Au chantier (actuellement) → impacte la marge chantier
- Aux Frais Généraux → neutralise la marge chantier
- Partiellement (ex: >30km en FG, <30km au chantier) ?

### F3. Multi-chantier par journée

**Question :** Est-ce un cas réel chez CYNA ?
- Exemple : un employé fait 4h sur chantier A le matin, puis 4h sur chantier B l'après-midi.
- Si oui : faut-il saisir en heures (4h + 4h) ou en fractions (0.5j + 0.5j) ?
- Fréquence estimée : < 5% des journées ? > 20% ?

### F4. Distinction frontalier / résident suisse

**Question :** Est-ce que la gestion des permis G (frontaliers) est nécessaire dans l'app ?
- Impact : charges sociales différentes (pas d'AVS sur frontaliers ? cotisations pays de résidence ?)
- Impact : décompte des heures pour l'administration suisse

### F5. Pattern dominant de saisie chez CYNA

**Question :** Qui saisit les heures, à quelle fréquence, et depuis quel device ?
- Valdrin seul le vendredi soir (récapitulatif semaine) ?
- Le frère depuis le chantier chaque soir (mobile) ?
- Les deux en parallèle (risque de conflits) ?
- Réponse critique pour décider : grille hebdo (actuelle) vs formulaire journalier vs pointage en temps réel

### F6. Pointage individuel vs collectif chef d'équipe

**Question :** Le chef d'équipe saisit-il ses heures pour toute son équipe d'un coup (pointage collectif) ou chaque employé a-t-il son propre accès ?

### F7. Heures supplémentaires

**Question :** Les majorations CCT (×1.25 semaine, ×1.50 dimanche/férié) doivent-elles :
- Être **calculées automatiquement** par l'app (nécessite de connaître le type de jour) ?
- Être **saisies manuellement** comme un champ séparé ?
- **Pas gérées pour l'instant** (on facture au même taux) ?

### F8. Rétrocompatibilité

**Question :** Les 7 chantiers de données démo + les données Supabase réelles ont-ils des journaux à migrer ?
- La fonction `migrerJournal()` gère déjà 3 anciens formats.
- Une v2 avec catégories nécessitera une migration non-destructive (champs optionnels ? valeur par défaut `production` ?)

### F9. Granularité temporelle

**Question :** La granularité reste-t-elle à la journée (un objet par date) ou passe-t-on à la demi-journée ou à l'heure ?
- Journée (actuel) : simple, adapté à CYNA qui travaille par chantier complet
- Demi-journée : compatible multi-activités (matin chantier A, après-midi chantier B)
- Heure : trop granulaire pour BTP, risque d'usine à gaz

---

## SYNTHÈSE RAPIDE

```
Format actuel : chantier.journal[{ date, employes[{ employeId, heuresTravaillees }] }]
Type : tableau imbriqué dans le chantier — pas d'entité indépendante
Store : React Context (AppContext) — pas de Zustand
Saisie : 3 points d'entrée — Heures.js, ModalSaisieHeures, SaisieRapideDashboard
Consommateurs : 20+ fichiers dont 13 agents IA
Modèle : strictement mono-chantier par employé par jour
Catégorisation : ZÉRO
Heures sup : détectées mais NON majorées financièrement
Déplacement : calculé automatiquement (tarif localité), NON saisi dans le journal
Absences : NON modélisées
Frontaliers : NON distincts
```

---

Audit terminé. AUDIT_POINTAGE.md créé. Aucune modification de code effectuée. En attente de la lecture humaine et des décisions stratégiques avant Phase 2.
