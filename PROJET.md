# PROJET.md — Doc maître CYNA SÀRL

> Dernière mise à jour : 2026-05-28 (post-Phase 5c)
> Ce document est la référence business et technique du projet. CLAUDE.md est le manuel opérationnel.

---

## 1. Contexte business

**CYNA SÀRL**, Genève. Second œuvre du bâtiment :
- Faux-plafonds, faux-planchers techniques, chambres froides
- Construction métallique, portes, cloisons vitrées mobiles

**Équipe** : 3 associés
- Valdrin — commercial (gestion des devis, relation clients, stratégie)
- Sa sœur — bureau / administration (facturation, suivi, pointages)
- Son frère — chef d'équipe terrain (planification, encadrement ouvriers)

**Clients** : privés aisés, bureaux d'architectes, entreprises.
Référence : **Banque Pictet Genève**.

**Cantons d'activité** : Genève (défaut) et Vaud.

**Tarifs main d'œuvre** (bruts) :

| Profil | Tarif/jour | Coût chargé (×1.35) |
|--------|-----------|---------------------|
| Chef d'équipe | CHF 450 | CHF 608 |
| Ouvrier qualifié | CHF 350 | CHF 473 |
| Main d'œuvre | CHF 280 | CHF 378 |

Convention : 8h/jour. CCT Second Œuvre Romand (SOR).

---

## 2. Valeur cœur de l'app

Les heures saisies des employés pilotent **deux choses critiques** :

1. **L'avancement du chantier** — basé sur les dates distinctes travaillées vs jours prévus
2. **La rentabilité** — coût MO = heures → tarif journalier → marge vs devis

**La connexion `heures → calculs` doit être rigoureuse, sans perte.** C'est l'invariant fondamental de l'architecture.

---

## 3. Architecture — Décisions verrouillées

### 3.1 Source de vérité des données

| Donnée | Source | Interdit |
|--------|--------|---------|
| CA du chantier | `devis.montantHT` (devis lié) | Ressaisir sur le chantier |
| Coût MO réel | `pointages[]` via journal dérivé | `joursPlannifies` dans calcul réel |
| Avancement | Jours uniques du journal / `nombreJours` | Estimation manuelle |
| TVA | Taux sur la facture (défaut 8.1%) | TVA hardcodée |

### 3.2 Strangler fig — journal dérivé (Phase 5a)

`pointages[]` est la **source**, `chantier.journal` est la **vue dérivée** reconstruite à chaque chargement par `regenererJournalDepuisPointages()`.

```
pointages[] → regenererJournalDepuisPointages() → chantier.journal[]
                       ↑ Phase 5a                       ↑ lu par agents (Phases 6, 7)
```

Les 20 agents IA lisent encore `chantier.journal` — c'est intentionnel pendant la migration. Ne pas leur faire lire `pointages[]` avant la Phase 6.

### 3.3 Pointage — modèle Option B (Phase 3)

Entité indépendante. **9 décisions verrouillées** dans `AUDIT_POINTAGE.md` :
- Identifiant : `ptg_${timestamp}_${random}` (pas d'UUID)
- Last-write-wins sur `(date, employeId)` — 1 pointage max par (jour, employé)
- Multi-chantier : N répartitions par pointage
- Déplacement : champ séparé `deplacement: {duree_h, indemnite_chf}` → frais généraux
- Majoration : dérivée au calcul par canton du chantier (`calculerMajorationDate`)
- Absences : répartition avec `chantierId: null`
- Saisie batch (ModalSaisieHeures) : conservée pour les journées de routine
- L'onglet "Pointages" n'existe plus dans le menu — accès via "+" dans la grille Heures

### 3.4 Les deux moteurs (invariant critique)

`calculerCoutsChantier` ↔ `calculerEtatChantier` : équivalents à <0.01%. Partagent `_surcoutMajorations()`. Toute modif de l'un impacte l'autre. Assertions runtime : `assertEtatValide()` + `assertEtatCoherent()`.

---

## 4. Roadmap

### Phases livrées

| Phase | Branche | Contenu |
|-------|---------|---------|
| Phase 3 | `claude/phase3-pointage-model` | Modèle Pointage, `usePointages`, migration journal→pointages |
| Phase 4 | `claude/phase4-calculs-majoration` | Calculs CCT multi-canton GE/VD dans les 2 moteurs |
| Phase 5a | `claude/phase5a-strangler-fig` | pointages = source, journal = vue dérivée |
| Phase 5b-calc | `claude/phase5b-calc-majoration-canton` | Fix bug : majoration par canton de chantier (pas du premier) |
| Phase 5b-ui | `claude/phase5b-ui-page-pointages` | Page saisie riche (multi-chantier, absences, déplacement, badges majorations) |
| Phase 5c | `claude/phase5c-plus-ouvre-pointage` | Le "+" de la grille Heures ouvre PointageFormulaire (−193 lignes inline) |

**Tests** : 414 verts sur `main` (post-Phase 5c).

### Prochaines phases

#### Phase 6 — Adapter les agents IA vers pointages

**Objectif** : les 20 agents dans `AgentEngine.js` lisent encore `chantier.journal`. Migrer progressivement vers `pointages[]` directs (meilleure précision des majorations, catégories d'activité).

**Périmètre** : `src/AgentEngine.js`, `src/Agents.js`, `src/modules/alertes/contextAdapter.js`.

**Risque** : Tier 2 et Tier 3 dépendent des résultats du Tier 1. Migrer Tier 1 en premier, valider, puis Tier 2.

#### Phase 7 — Nouveaux agents + bascule source moteurs

**Objectif** : enrichir les agents avec les nouvelles données pointage (absences, déplacements, majorations par canton) + basculer les deux moteurs pour lire `pointages[]` directement au lieu de `chantier.journal`.

**Nouveaux agents possibles** : agent détection absences répétées, agent analyse déplacements / indemnités, agent performance par canton.

#### Phase 8 — Cleanup final

**Objectif** : une fois Phases 6 + 7 validées :
- Supprimer `chantier.journal` de la structure de données (et le code mort associé)
- Supprimer les fonctions de migration `migrerJournal()`, `migrerJournalVersPointages()`
- Mettre à jour `DONNEES.md`, `ARCHITECTURE.md`, `AUDIT_POINTAGE.md`
- Tag git `v2-pointages`

#### Vision long terme (à enrichir avec l'utilisateur)

- Portail client : accès lecture des chantiers / factures
- Application mobile offline pour les chefs de chantier (saisie terrain)
- Interface export comptabilité (CSV → logiciel CH)
- Soumission assistée d'appels d'offres (SoumissionAssistee.js existe déjà)

---

## 5. Conventions de travail

### Workflow ship

```
Claude Code                          Utilisateur (Windows)
    │                                       │
    ├─ Implémente sur claude/<branche>       │
    ├─ ARRÊT — "En attente du GO"           │
    │                      ←──── "go" / "GO" / "valide"
    ├─ Double gate :                        │
    │   CI=true npm run build ✅            │
    │   npm run test:unit ✅               │
    ├─ git push origin claude/<branche>     │
    │                      ←──── commande "ship"
    │                       Merge sur main (Windows)
```

**Règle ferme** : Claude Code ne merge jamais sur `main`. `api.github.com` est bloqué dans le container.

### Double gate (obligatoire avant push)

```bash
CI=true npm run build    # warnings ESLint = erreurs Vercel
npm run test:unit        # 414 tests doivent rester verts
```

Si l'un échoue : corriger avant de demander le GO.

### Format des branches

```
claude/<phase>-<sujet>          # ex: claude/phase6-agents-pointages
claude/<feature>-<sujet>        # ex: claude/docs-claude-projet
claude/fix-<bug>                # ex: claude/fix-majoration-canton
```

### Format des commits

Anglais ou français, conventionnel (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).  
Toujours inclure dans le body : gates verts + nombre de tests.

---

## 6. Renvois techniques

| Document | Contenu |
|----------|---------|
| `CLAUDE.md` | Manuel opérationnel Claude Code (stack, commandes, règles de code, BTP) |
| `DONNEES.md` | Cartographie exhaustive de `src/donnees.js` |
| `AUDIT_POINTAGE.md` | 9 décisions architecturales du système de pointage |
| `ARCHITECTURE.md` | Carte complète de `src/` (générée par `/cartographier`) |
