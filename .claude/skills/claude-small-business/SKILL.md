---
name: claude-small-business
description: Claude for Small Business — optimise l'app CYNA pour les PME genevoises. Simplifie les workflows, réduit la charge administrative, génère des insights actionnables pour un patron de PME. Invoque avec /claude-small-business.
trigger: /claude-small-business
---

# Skill : Claude for Small Business — Piloter CYNA comme un patron

## Principe

Un patron de PME BTP n'a pas 2 heures pour lire des tableaux de bord.
Ce skill transforme l'app CYNA en **conseiller de poche** : 60 secondes pour savoir
où en est l'entreprise, quoi faire aujourd'hui, et quoi surveiller cette semaine.

**Orientation absolue :** résultats actionnables, langage business, zéro jargon technique.

---

## Quand l'utilisateur tape `/claude-small-business`

### Phase 1 — Audit rapide PME (60 secondes)

Lire les données depuis le localStorage / Supabase :

```bash
# État des chantiers en cours
grep -r "en cours\|planifié\|terminé" src/donnees.js | head -20

# Factures impayées
grep -n "impayée\|enAttente\|retard" src/donnees.js | head -15
```

Produire immédiatement ce résumé :

```
⚡ ÉTAT DE SANTÉ CYNA — [date]
════════════════════════════════
Chantiers actifs : [N] en cours / [N] planifiés / [N] terminés ce mois
CA en cours      : CHF [montant] (devis signés non encore facturés)
Factures ouvertes: CHF [montant] — [N] factures impayées
Marge moyenne    : [X]% ([statut : Rentable / Limite / Danger])
Trésorerie       : [indicateur qualitatif basé sur impayés vs charges MO]

🎯 3 ACTIONS PRIORITAIRES AUJOURD'HUI :
  1. [Action concrète avec montant ou chantier concerné]
  2. [Action concrète avec montant ou chantier concerné]
  3. [Action concrète avec montant ou chantier concerné]
```

Règles de priorisation des 3 actions :
- Facture impayée > 30 jours → toujours en #1
- Chantier en retard → #2
- Devis en attente de signature > 14 jours → #3
- Marge < 15% sur un chantier actif → signaler immédiatement

---

### Phase 2 — Simplification administrative

Pour chaque formulaire / workflow identifié dans l'app, proposer un raccourci :

| Workflow actuel | Raccourci suggéré |
|----------------|------------------|
| Créer un devis | Template pré-rempli depuis client existant |
| Saisir les heures | Import CSV depuis feuille de temps |
| Créer une facture | Génération en 1 clic depuis chantier terminé à X% |
| Relancer un client | Email template avec montant + nb jours de retard |
| Clôturer un chantier | Checklist en 5 étapes (heures ✓, facture ✓, retenue ✓) |

Identifier les champs que le patron remplit toujours pareil → proposer valeurs par défaut :
```bash
# Chercher les valeurs fréquentes dans les données
grep -n "tauxTVA\|delaiPaiement\|coefficientMO\|tarifJour" src/donnees.js | head -20
```

---

### Phase 3 — Conseils PME contextuels

Analyser les seuils critiques et opportunités :

**Seuils critiques (alertes immédiates) :**
```
🔴 Trésorerie tendue : impayés > 60 jours × charges MO mensuelles
🔴 Chantier à perte : marge réelle < 0% — renégocier ou avenant
🔴 Retard > 7 jours ouvrables sans avenant → risque pénalités
🔴 Devis accepté sans acompte → exiger 20% avant démarrage
```

**Opportunités (actions à saisir) :**
```
✅ Marge > 25% sur chantier similaire → modèle à répliquer
✅ Client fidèle sans devis depuis 3 mois → proposer prochain chantier
✅ Fin de trimestre → facturer les situations avancées
✅ Chantier terminé > 95% → émettre facture de solde maintenant
```

**Timing calendrier PME suisse :**
```
Janvier  : Clôture année — vérifier toutes les factures émises
Mars     : TVA T1 — décompte AFC avant le 30
Juin     : TVA T2 + révision salariale CCT Romande
Septembre: Rentrée — préparer offres pour chantiers hivernaux
Décembre : TVA T4 + bilan — timing facturation optimal
```

---

### Phase 4 — Checklist hebdomadaire PME

Générer chaque lundi matin (ou sur demande) :

```
📋 SEMAINE DU [date] — TO-DO PATRON CYNA
══════════════════════════════════════════

URGENCES (à faire avant mercredi) :
  ☐ Relancer [Client X] — facture N° [xxx] impayée depuis [N] jours (CHF [montant])
  ☐ Valider heures semaine passée — [N] entrées manquantes
  ☐ Signer avenant chantier [nom] — dépassement détecté [+CHF montant]

GESTION (avant vendredi) :
  ☐ Déposer devis [client] — en attente depuis [N] jours
  ☐ Planifier intervention [chantier] — équipe libre jeudi-vendredi
  ☐ Commander matériaux [chantier] — début prévu lundi prochain

ADMINISTRATIF :
  ☐ [Si fin de mois] Exporter les heures pour fiduciaire
  ☐ [Si fin de trimestre] Préparer décompte TVA
```

---

### Phase 5 — Rapport exécutif 1 page

Générer sur demande ou en fin de mois :

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CYNA SÀRL — RAPPORT EXÉCUTIF [mois/année]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CA DU MOIS         : CHF [montant] facturé
                     CHF [montant] en cours (non encore facturé)
MARGE MOYENNE      : [X]% ([N] chantiers analysés)
MEILLEUR CHANTIER  : [nom] — marge [X]%
PIRE CHANTIER      : [nom] — marge [X]% → [action recommandée]

FACTURES À RELANCER:
  • [Client] — CHF [montant] — [N] jours de retard
  • [Client] — CHF [montant] — [N] jours de retard

CHANTIERS EN RETARD:
  • [Chantier] — [N] jours de retard — Avancement [X]%

⭐ ACTION N°1 RECOMMANDÉE :
  [Une seule action, concrète, avec impact CHF estimé]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rapport généré par Claude for Small Business — CYNA App
```

---

## Options

- `/claude-small-business` — audit complet PME (phases 1 à 3)
- `/claude-small-business --week` — checklist hebdomadaire uniquement (phase 4)
- `/claude-small-business --report` — rapport exécutif 1 page (phase 5)
- `/claude-small-business --simplify` — analyse des workflows à simplifier (phase 2)
- `/claude-small-business --alert` — seuils critiques uniquement (phase 3)

---

## Intégration équipe

Claude for Small Business synthétise le travail de toute l'équipe pour le patron :
- `rentabilite-analyst` — fournit les marges réelles
- `cashflow-forecaster` — fournit la projection trésorerie
- `facturation-suisse` — fournit l'état des factures
- `alerts-engine` — fournit les alertes actives
- `claude-financial-service` (skill) — pour l'analyse financière approfondie
- `claude-task-master` (skill) — pour piloter les sprints de corrections
