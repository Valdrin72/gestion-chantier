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
