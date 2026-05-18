# CYNA SÀRL — Manifeste Équipe Permanente

## Principe : toujours actif, toujours vigilant

Chaque modification de code déclenche automatiquement la vérification de l'agent
responsable du domaine touché. L'équipe ne dort jamais.

---

## Carte des responsabilités — Qui surveille quoi ?

### 🏗️ DOMAINE MÉTIER BTP

| Agent | Fichiers sous surveillance | Déclencheur |
|-------|---------------------------|-------------|
| `facturation-suisse` | `src/Factures.js`, `src/donnees.js` (creerFacture*), `src/pages/FinancesPage.js` | Toute modif facture/TVA |
| `devis-generator` | `src/pages/DevisPage.js`, `src/donnees.js` (creerDevis*) | Toute modif devis |
| `rentabilite-analyst` | `src/utils/calculs.js`, `src/donnees.js`, `src/pages/Dashboard.js` | Toute modif calcul marge/EAC/RAD |
| `cashflow-forecaster` | `src/pages/FinancesPage.js`, `src/Paiements.js` | Toute modif trésorerie/paiements |
| `alerts-engine` | `src/alertes.js`, `src/AgentEngine.js` | Toute modif alertes |
| `planning-chantier` | `src/pages/PlanningPage.js`, `src/Heures.js` | Toute modif planning/heures |
| `charges-sociales` | `src/donnees.js` (coût MO), `src/pages/EmployesPage.js` | Toute modif tarifs/coefficient |
| `dashboard-architect` | `src/pages/Dashboard.js`, `src/components/ui/KpiCard.js` | Toute modif KPIs |

### 🛡️ DOMAINE QUALITÉ CODE

| Agent | Fichiers sous surveillance | Déclencheur |
|-------|---------------------------|-------------|
| `bug-hunter` | **Tous** les fichiers `src/**/*.js` | Chaque Edit/Write |
| `code-reviewer` | **Tous** les fichiers `src/**/*.js` | Avant chaque commit |
| `security-auditor` | `src/supabase.js`, `src/hooks/useAuth.js`, `.env*`, `src/App.js` | Toute modif auth/config |
| `performance-optimizer` | `src/pages/Dashboard.js`, `src/donnees.js` | Calculs dans render |
| `test-engineer` | Tous les flows critiques | Après chaque bug fix |

### 📐 DOMAINE MÉTRÉS

| Agent | Quand l'invoquer |
|-------|-----------------|
| `metrage-calculator` | Nouveau devis avec surface à chiffrer |
| `faux-plancher-metrage` (skill) | Chantier faux-plancher |
| `faux-plafond-metrage` (skill) | Chantier faux-plafond |
| `productivite-cyna` (skill) | Estimation heures MO |

### 📋 DOMAINE LÉGAL / CONTRATS

| Agent | Quand l'invoquer |
|-------|-----------------|
| `cct-compliance` | Question sur heures/salaires/suppléments |
| `sia-118` (skill) | Question sur garanties/réception/avenants |
| `cct-sor` (skill) | Question sur conditions de travail |
| `charges-sociales-suisse` (skill) | Calcul coût réel employé |
| `architecte-broker` | Appel d'offres / CCTP / soumission |
| `client-communicator` | Emails clients, relances, avis travaux |

### 🧬 DOMAINE INNOVATION & ÉVOLUTION

> **Équipe Darwin** — s'active quand le code vieillit, quand un bug résiste, ou quand on veut voir la carte du projet.

| Skill | Déclencheur | Rôle |
|-------|-------------|------|
| `darwin` (skill) | `/darwin` | Évolution continue — élimine les patterns fragiles, propage les patterns robustes |
| `graph-skill` (skill) | `/graph-skill` | Cartographie Obsidian des entités — détecte orphelins et liens brisés |
| `caveman` (skill) | `/caveman [bug]` | Débogage primitif — logs bruts, isolation couche par couche |
| `skill-creator` (skill) | `/skill-creator [nom]` | Crée de nouveaux skills CYNA au bon format |
| `veille-auto` (skill) | `/veille-auto` | Surveillance dépendances, légal suisse, opportunités tech |
| `anticipator` | Sur demande | Prédiction des prochains bugs avant qu'ils arrivent |
| `pattern-learner` | Après série de bugs | Consolide les patterns dans la mémoire |

**Protocole d'activation Équipe Innovation :**
1. `/darwin` — avant chaque release pour éliminer les fragilités accumulées
2. `/graph-skill` — après un delete ou migration pour détecter les orphelins
3. `/caveman [bug]` — quand un bug résiste aux autres outils
4. `/veille-auto` — mensuel + avant chaque mise en production
5. `/skill-creator` — pour créer de nouveaux skills si besoin

### 💼 DOMAINE BUSINESS & FINANCE PME

> **Équipe Business** — s'active pour piloter l'entreprise, analyser la santé financière et simplifier la gestion administrative.

| Skill | Déclencheur | Rôle |
|-------|-------------|------|
| `claude-small-business` (skill) | `/claude-small-business` | Audit PME en 60 sec — état de santé, 3 actions prioritaires, checklist hebdo, rapport exécutif 1 page |
| `claude-financial-service` (skill) | `/claude-financial-service` | Analyse financière avancée — cashflow J+30/60/90, TVA AFC, EAC/RAD par chantier, benchmarks BTP GE, rapport fiduciaire |

**Protocole Équipe Business :**
- `/claude-small-business` → chaque lundi matin ou quand le patron veut un point rapide
- `/claude-small-business --week` → checklist hebdomadaire uniquement
- `/claude-small-business --report` → rapport exécutif mensuel
- `/claude-financial-service --cashflow` → avant une décision d'investissement ou d'embauche
- `/claude-financial-service --tva` → avant chaque décompte AFC
- `/claude-financial-service --eac` → dès qu'un chantier semble dériver
- `/claude-financial-service --report` → rapport mensuel complet pour le fiduciaire

**Ordre de lecture recommandé (revue mensuelle) :**
```
/claude-small-business --report → /claude-financial-service --report → /mempalace
```

---

### 🧠 DOMAINE MÉMOIRE & ORCHESTRATION

> **Équipe Cerveau** — s'active pour organiser, mémoriser et piloter les sprints complexes.

| Skill | Déclencheur | Rôle |
|-------|-------------|------|
| `mempalace` (skill) | `/mempalace` | Palais de la mémoire — ancre dans Memory MCP tous les bugs, patterns et décisions de la session |
| `claude-task-master` (skill) | `/claude-task-master [feature]` | Chef de projet IA — décompose, délègue et suit les sprints multi-agents |
| `the-agency` (skill) | `/the-agency` | Orchestrateur de skills — installe, active, audite et met à jour tous les skills CYNA |
| `ultra-plan` (skill) | `/ultra-plan [feature]` | Planificateur maximal — décomposition atomique XS/S/M/L, agents assignés, sprints parallèles |

**Protocole Équipe Cerveau :**
- `/mempalace` → fin de chaque session longue ou après un sprint majeur
- `/mempalace --read` → début de session pour le briefing complet
- `/claude-task-master` → dès qu'une feature nécessite plus de 3 tâches distinctes
- `/the-agency list` → vérifier l'état de tous les skills installés
- `/ultra-plan` → avant tout sprint complexe pour un plan d'exécution parfait

### 🎨 DOMAINE DESIGN & QUALITÉ VISUELLE

> **Équipe Design** — s'active pour tout ce qui touche à l'interface, l'esthétique et l'expérience utilisateur.

| Skill | Déclencheur | Rôle |
|-------|-------------|------|
| `taste-skill` (skill) | `/taste-skill` | Bon goût UI/UX — cohérence visuelle, typographie, espacement, mobile-first |
| `huashu-design` (skill) | `/huashu-design` | Design system vivant — palette, tokens, composants atomiques, dark mode |
| `playwright-cyna` (skill) | `/playwright-cyna` | Tests navigateur réels — flows complets, screenshots, validation visuelle |
| `impeccable` (skill) | `/impeccable` | Perfection absolue — excellence du code + UX avant chaque release majeure |

**Protocole Équipe Design :**
1. `/taste-skill` — après tout ajout de page ou composant
2. `/huashu-design` — pour étendre ou harmoniser le design system
3. `/playwright-cyna` — validation visuelle dans un vrai navigateur
4. `/impeccable` — dernier passage avant release (code + UX + calculs)

**Ordre release idéal :**
```
/darwin → /graph-skill → /taste-skill → /playwright-cyna → /impeccable → /mempalace
```

---

## Règles d'intervention automatique

### À chaque `Edit` ou `Write` dans `src/`
1. `bug-hunter` vérifie : NaN, divisions non protégées, `.toFixed()`, statuts casse-sensitive
2. L'agent du domaine touché vérifie ses règles spécifiques
3. Si bug critique trouvé → corriger avant de continuer

### À chaque modification de calcul financier
1. `rentabilite-analyst` vérifie : marge sur CA (pas coût), EAC, RAD
2. `facturation-suisse` vérifie : TVA paramétrable, liens entités
3. Vérifier : `ca > 0 ?` guard sur toutes les divisions

### À chaque modification de `alertes.js` ou `AgentEngine.js`
1. `alerts-engine` vérifie : tous les seuils BTP suisses
2. Vérifier : `.toLowerCase()` sur tous les statuts comparés

### À chaque modification d'authentification (`useAuth.js`, `supabase.js`)
1. `security-auditor` intervient immédiatement
2. Vérifier : pas de SERVICE_ROLE_KEY côté front

### Avant chaque commit
```bash
node scripts/audit-btp.js
```
0 critique = commit autorisé
> 0 critique = corriger avant commit

---

## Protocole de communication équipe

Quand un agent trouve un problème :
```
[NOM_AGENT][NIVEAU] Fichier:ligne — Description
AVANT : code problématique
APRÈS : code corrigé
```

Niveaux : 🔴 CRITIQUE | 🟠 IMPORTANT | 🟡 NOTE

---

## Stack technique CYNA (contexte partagé)

- **Framework** : React 18, JavaScript pur (pas TypeScript)
- **CSS** : Variables CSS custom, `index.css` ~2400 lignes, `ds.js` design tokens
- **Données** : Supabase (source) + localStorage (cache), JSON blob par user
- **Auth** : Supabase Auth, rôles : `direction`, `conducteur`, `administratif`
- **Déploiement** : Vercel (branche `main`)
- **Branche de travail** : `claude/debug-terminal-issue-uvSBY`
- **Règles métier** : voir `CLAUDE.md` (source de vérité absolue)

---

## Formules certifiées — Ne jamais modifier sans validation

```js
CA chantier    = devis.montantHT (source unique)
Coût MO réel   = Σ(heures/8 × tarifJour × coefficient)
Avancement     = joursUniquesJournal / nombreJours (max 100%)
Marge brute %  = (CA - coûts) / CA × 100           // SUR VENTE
EAC            = coutReel / (avancement / 100)
RAD            = (coutReel / avancement) × (100 - avancement)
TTC            = HT × (1 + tva/100)                 // défaut tva=8.1
```
