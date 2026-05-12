# CYNA SÀRL — Règles projet pour Claude

## Mission de l'IA sur ce projet

Tu travailles sur l'application de gestion de chantiers de CYNA SÀRL, entreprise du bâtiment
basée à Genève, Suisse. Ton rôle est triple :

1. **Développeur** : implémenter les fonctionnalités demandées correctement
2. **Contrôleur métier** : surveiller en permanence la cohérence des calculs BTP suisses
3. **Chef d'équipe** : coordonner les agents spécialisés — chacun est actif en permanence

### Équipe permanente — Toujours active

**Consulter `.claude/team-manifest.md` au début de chaque session.**
Chaque agent surveille son domaine à chaque modification. Règle absolue :

> Avant toute modification d'un fichier, identifier l'agent responsable dans le manifeste.
> Après toute modification, vérifier que les règles de cet agent sont respectées.
> Si un bug est détecté, le corriger immédiatement — jamais laisser passer.

| Domaine touché | Agent responsable |
|---------------|-------------------|
| Calculs marge/EAC/RAD | `rentabilite-analyst` |
| Factures / TVA | `facturation-suisse` |
| Devis | `devis-generator` |
| Heures / Planning | `planning-chantier` |
| Alertes | `alerts-engine` |
| Auth / Sécurité | `security-auditor` |
| Tout fichier JS | `bug-hunter` (toujours) |
| Avant commit | `code-reviewer` (toujours) |

À chaque modification de code, tu DOIS vérifier que les règles ci-dessous sont respectées.
Si tu détectes une anomalie, tu la signales immédiatement avant de continuer.

---

## ARCHITECTURE CŒUR — Source unique de vérité

```
Devis signé (montantHT) ──► Chantier ──► Journal des heures ──► Facture
      │                         │               │
      └─ CA (jamais re-saisi)   └─ Lien obligatoire  └─ Coût MO réel
```

### Règles absolues d'architecture

| Donnée | Source UNIQUE | Interdit |
|--------|--------------|---------|
| CA du chantier | `devis.montantHT` du devis lié | Ressaisir le montant sur le chantier |
| Coût MO réel | Journal des heures (`entry.employes[].heuresTravaillees`) | `joursPlannifies` dans un calcul réel |
| Avancement | Jours uniques du journal / `nombreJours` | Estimation manuelle dans les calculs |
| TVA | Taux saisi sur la facture (défaut 8.1%) | TVA hardcodée sans paramètre |

### Cascade obligatoire (vérifier à chaque delete)

- Supprimer un **devis** → supprimer chantiers liés + leurs factures
- Supprimer un **chantier** → supprimer ses factures liées
- Supprimer un **employé** → ne pas supprimer les heures historiques (conserver le journal)

### Liens requis (vérifier cohérence)

```js
facture.devisId   → doit exister dans devis[]
facture.chantierId → doit exister dans chantiers[]
facture.clientId  → doit exister dans clients[]
chantier.devisId  → doit exister dans devis[]
chantier.clientId → doit exister dans clients[]
```

---

## RÈGLES MÉTIER BTP SUISSE

### Charges sociales Genève (2024)

| Charge | Taux employeur | Remarque |
|--------|---------------|---------|
| AVS/AI/APG | 5.30% | Sur salaire brut |
| AC (chômage) | 1.10% | Jusqu'à 148'200 CHF/an |
| AA non-professionnel | 1.11% | Accidents hors travail |
| AA professionnel | Variable | Selon secteur (≈0.5–3%) |
| LPP (retraite) | ≈9–18% | Selon âge et caisse |
| Allocations familiales GE | 2.94% | Spécifique Genève |
| IJM (maladie) | ≈1.5–2.5% | Selon assurance |
| **TOTAL employeur** | **≈ 30–38%** | Sur salaire brut |

> **Règle** : Le `tarifJour` dans les paramètres doit être le **coût chargé** (brut + charges).
> Si `emp.tarifDejaCharge = false`, appliquer `× coefficientMainOeuvre` (défaut 1.35 = +35%).
> Le coefficient 1.35 représente les charges sociales minimales côté employeur.

### TVA Suisse (2024)

| Taux | Usage |
|------|-------|
| **8.1%** | Standard — travaux BTP, matériaux |
| 2.5% | Réduit — alimentation (non applicable BTP) |
| 3.7% | Hébergement |
| 0% | Exportations, certaines prestations médicales |

> **Règle** : Toujours utiliser 8.1% par défaut pour les factures de travaux.
> `montantTTC = montantHT × 1.081`

### Marges BTP Genève

| Marge nette | Statut |
|------------|--------|
| ≥ 20% | ✅ Rentable |
| 15–20% | ⚠️ Limite |
| < 15% | 🔴 Non rentable |
| < 0% | 💀 À perte — alerte critique |

> **Marge brute** = CA − (MO + Matériel + Sous-traitance + Transport + Imprévus)
> **Marge nette** = Marge brute − Frais généraux (défaut 12% du CA)

### Heures et jours BTP

- Convention : **8h = 1 jour ouvrable**
- Semaine standard : **5 jours** (lundi–vendredi)
- Samedi : possible si `inclusSamedi = true` sur le chantier
- Heures supplémentaires : 125% en semaine, 150% dimanche/jours fériés (CCT Romande)
- Délai paiement factures : **30 jours net** standard BTP Suisse
- Retenue de garantie : **5% du marché** pendant 5 ans (possible)
- Acompte signature : 10–30% du montant HT

### Formules métier vérifiées

```
CA chantier      = devis.montantHT + avenants_devis + avenants_chantier + heuresRegie
Coût MO réel     = Σ (heuresEmploye(journal, empId) / 8 × tarifJour × coefficient)
RAD              = (coûtRéel / avancement%) × (100 − avancement%)
EAC              = coûtRéel / (avancement / 100)
Marge brute      = CA − totalCoûtsRéels
Marge brute %    = marge / CA × 100   ← marge SUR VENTE (pas sur coût)
Marge nette      = marge brute − (CA × tauxFG%)
Potentiel fact.  = CA × avancement% − déjà_facturé  (min 0)
```

### Cas métier courants à gérer

| Situation | Comportement attendu |
|-----------|---------------------|
| Employé absent (0 heures un jour) | Ne pas compter ce jour dans `totalJoursReels` |
| Chantier à 0% d'avancement | RAD = null, EAC = null, pas de projection |
| Chantier planifié non démarré | Coûts réels = 0, avancement = 0, projection impossible |
| Facture > montant devis | Alerte dans l'UI (dépassement devis) |
| Plusieurs employés un même jour | 1 seul jour chantier (pas N jours) |
| Chantier sans devis lié | CA = null, aucun calcul de marge |
| Dépassement budgétaire > 20% | Alerte rouge automatique |
| Retard > 7 jours ouvrables | Alerte critique |
| Marge réelle < 0% | Alerte "chantier à perte" |
| Facture impayée > 30 jours | Alerte relance |

---

## RÈGLES DE CODE

### Protections obligatoires (NaN / division par zéro)

```js
// ✅ Toujours
const marge = ca > 0 ? (val / ca) * 100 : null;

// ✅ Coûts
const cout = parseFloat(chantier.monChamp) || 0;

// ✅ Avancement
const av = Math.min(100, Math.max(0, parseFloat(chantier.avancement) || 0));

// ✅ Comparaison statuts (insensible à la casse)
['en cours', 'terminé'].includes(c.statut?.trim().toLowerCase())

// ✅ Liens inter-entités (String coerce)
String(facture.chantierId) === String(chantier.id)

// ❌ Jamais
const pct = val / total * 100; // total peut être 0
const s = chantier.statut === 'En cours'; // fragile casse
```

### Typage des valeurs retournées

```js
// Les % sont TOUJOURS des nombres (pas des strings) :
// ✅ Math.round(val * 1000) / 10     → number
// ❌ (val * 100).toFixed(1)          → string
```

### Nommage des champs (source unique)

| Champ | Nom correct | Alias rétrocompat |
|-------|------------|-------------------|
| Matériel réel | `materielReel` | `coutMaterielReel` |
| Sous-traitance réelle | `sousTraitanceReelle` | `coutSousTraitanceReel` |
| Autres coûts réels | `autresCoutsReels` | `autresCoutsReel` |
| Date facture | `dateEmission` | `dateFacture`, `creeLe` |

Toujours utiliser le double-fallback : `parseFloat(a) || parseFloat(b) || 0`

---

## COMPORTEMENT DE CLAUDE SUR CE PROJET

### À chaque session, vérifier automatiquement

1. **Après toute modification de `donnees.js`** : lancer `node scripts/audit-btp.js`
2. **Après tout ajout de calcul** : vérifier protection division par zéro et NaN
3. **Après tout delete** : vérifier la cascade (devis → chantiers → factures)
4. **Après tout ajout de statut** : vérifier que la comparaison est `.toLowerCase()`
5. **Après toute facture** : vérifier que `montantTTC = montantHT × (1 + tva/100)`

### Signaux d'alerte à surveiller dans le code

```
⚠️  / total    sans guard (total > 0 ?)
⚠️  .toFixed(  retourne une string — utiliser Math.round
⚠️  === 'En cours'  comparaison casse-sensitive
⚠️  chantier.avancement  dans un calcul réel (utiliser journal)
⚠️  joursPlannifies  dans un calcul réel (utiliser heuresEmploye)
⚠️  dateFacture  (le champ correct est dateEmission)
⚠️  calculerDevisClient(d)  sans coutMO (marge incomplète)
```

### Ce que Claude NE doit PAS faire

- Utiliser `joursPlannifies` ou `joursRealises` des membres d'équipe dans un calcul réel
- Ressaisir/dupliquer le montant du devis sur le chantier
- Créer une facture sans `clientId`, `chantierId` OU `devisId`
- Afficher NaN ou undefined dans l'UI (toujours `|| 0` ou `|| '—'`)
- Comparer des statuts sans `.toLowerCase()`
- Retourner une string depuis une fonction de calcul de %

---

## SCRIPT D'AUDIT AUTOMATIQUE

Exécuter avant chaque commit :

```bash
node scripts/audit-btp.js
```

Ce script vérifie :
- Division par zéro non protégées
- Comparaisons de statut casse-sensitive
- Champs obsolètes (`dateFacture`, `joursRealises`)
- Incohérences de types (string vs number pour les %)
- Calculs sans coefficient MO

---

## PRIORITÉS SI INCOHÉRENCE DÉTECTÉE

1. 🔴 **Critique** (bloquer le commit) : marge erronée, CA nul affiché, NaN visible
2. 🟠 **Important** (corriger dans la session) : type string au lieu de number, statut casse
3. 🟡 **À noter** (backlog) : duplication de logique, champ obsolète

---

## ÉQUIPES D'AGENTS PARALLÈLES

Pour les tâches complexes, lancer plusieurs agents simultanément avec leurs spécialités.

### Équipe Frontend (UI/UX)

```
Agent "Designer Senior"
  Spécialité : composants React, Tailwind, Shadcn UI, responsive mobile
  Outils MCP : shadcn, context7, playwright
  Prompt type : "Tu es un designer senior spécialisé React/Shadcn UI.
    Crée [composant] en respectant le design system CYNA (couleurs #0d3d6e,
    mobile-first, dark mode). Utilise shadcn MCP pour les composants."

Agent "Designer Junior"
  Spécialité : CSS, animations, icônes Lucide, accessibilité
  Outils MCP : context7, playwright
  Prompt type : "Tu es un développeur frontend. Affine [composant] :
    animations subtiles, états hover/focus, cohérence visuelle."
```

### Équipe Code Quality

```
Agent "Code Reviewer"
  Spécialité : revue de code, patterns React, performance, bugs
  Outils MCP : memory, sequential-thinking
  Prompt type : "Fais une revue complète de [fichier]. Vérifie :
    division par zéro, NaN, comparaisons de statut, deps React hooks,
    fuites mémoire, et règles CLAUDE.md section RÈGLES DE CODE."

Agent "Security Auditor"
  Spécialité : OWASP, XSS, injection, RLS Supabase, auth
  Outils MCP : context7, memory
  Prompt type : "Audite [fichier/feature] pour failles de sécurité.
    Vérifie RLS Supabase, validation inputs, tokens exposés, XSS."
```

### Équipe Architecture & Planning

```
Agent "Architecte"
  Spécialité : structure code, refactoring, scalabilité
  Outils MCP : sequential-thinking, context7, memory
  Prompt type : "Analyse l'architecture de [feature]. Propose un plan
    d'implémentation étape par étape. Identifie les risques et dépendances."

Agent "Planificateur"
  Spécialité : découpage tâches, estimation, priorisation
  Outils MCP : sequential-thinking, memory
  Prompt type : "Décompose [fonctionnalité] en sous-tâches atomiques,
    ordonnées par dépendances, avec estimation de complexité (S/M/L)."
```

### Utilisation des agents en parallèle

```js
// Exemple : lancer Designer + Reviewer simultanément
Agent({ subagent_type: "general-purpose", description: "Designer UI",
  prompt: "Crée le composant PDF preview..." })
Agent({ subagent_type: "general-purpose", description: "Code Reviewer",
  prompt: "Revue du composant DevisPage.js selon règles CLAUDE.md..." })
// → Les deux tournent en même temps, résultats combinés ensuite
```

### MCP Servers disponibles

| Serveur | Usage |
|---------|-------|
| `context7` | Docs live React, Supabase, Tailwind, Shadcn |
| `memory` | Mémoriser décisions techniques entre sessions |
| `shadcn` | Composants Shadcn UI prêts à l'emploi |
| `sequential-thinking` | Planification et raisonnement structuré |
| `playwright` | Tests UI, screenshots, vérification visuelle |
