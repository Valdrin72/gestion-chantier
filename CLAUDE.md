# CYNA SÀRL — Manuel opérationnel Claude Code

Application de gestion de chantiers pour CYNA SÀRL (second œuvre, Genève). Suivi des chantiers, devis, factures, heures, rentabilité, alertes. Développée par Claude Code en collaboration avec Valdrin Salihu (fondateur). Toute décision technique doit se justifier par : **fait gagner de l'argent / du temps / aide à gagner ou garder des clients / réduit un risque**. Sinon, ne pas le faire.

---

## 1. Stack technique

| Couche | Technologie | Note |
|--------|------------|------|
| Frontend | React 18, plain JavaScript (`.js` avec JSX) | CRA convention : `.js` pas `.jsx` |
| Build prod | `react-scripts 5.0.1` | `CI=true npm run build` = check Vercel |
| Tests | Vitest 4.1.7 + RTL + jsdom | `npm run test:unit` |
| JSX en test | Plugin `babelJsxInJs` dans `vite.config.js` | OXC ne parse pas JSX dans `.js` |
| State global | React Context (`AppContext`) | Pas de Zustand sauf le module alertes |
| Persistance | Supabase — 1 blob JSON par user | Table `devis`, `numero='__cyna_storage__'` |
| Auth | Supabase Auth (`useAuth.js`) | Rôles : `cyna`, `cynatech` |
| Node | 24 | — |

**Blob Supabase** contient : `{chantiers, devis, factures, clients, parametres, pointages}`. Tout change dans l'app se sauvegarde via `useSupabaseData` (debounce 800 ms + localStorage fallback offline).

---

## 2. Architecture clé

### 2.1 Flux de données principal

```
Devis signé (montantHT)
    │
    └──► Chantier ──► pointages[] ──► journal dérivé ──► Calculs ──► Facture
              │                              │
              └─ CA (jamais re-saisi)        └─ strangler fig Phase 5a
                                               (régénéré à chaque load)
```

**Source de vérité** : `pointages[]` (depuis Phase 5a). `chantier.journal` est **dérivé** via `regenererJournalDepuisPointages()` à chaque chargement. Ne jamais écrire directement dans `chantier.journal`.

### 2.2 Les deux moteurs de calcul (invariant critique)

Les deux fonctions sont dans `src/donnees.js` et **doivent rester équivalentes à <0.01% près** :

| Moteur | Fonction | Répond à |
|--------|---------|---------|
| Situation actuelle | `calculerCoutsChantier(chantier, employes, localites, cfg, devisList, pointages)` | Coûts réels à ce jour |
| Projection fin | `calculerEtatChantier(chantier, employes, devisList, parametres, pointages)` | EAC, RAD, avancement |

Les deux partagent `_surcoutMajorations()` pour les majorations CCT. **Toute modification de l'un doit être répercutée sur l'autre.** Les assertions `assertEtatValide()` et `assertEtatCoherent()` dans `donnees.js` enforced les invariants (NaN interdit, avancement 0–100, coutMOReel ≤ coutTotalReel).

### 2.3 Pointages — modèle actuel (Phase 5c livrée)

```
Pointage {
  id, date, employeId,
  repartitions: [{ chantierId, categorie, heures }],  // multi-chantier
  deplacement: { duree_h, indemnite_chf } | null,     // champ séparé → FG
  majoration: [] | null,                               // dérivé, par canton
}
```

- **`upsertPointage(pointage, canton)`** : last-write-wins sur `(date, employeId)`. Dans `usePointages.js`.
- **Majorations** : calculées par canton du chantier via `calculerMajorationDate()` (`src/calculs/majorations.js` + `src/calculs/feries.js`). GE = Jeûne genevois, VD = Berchtoldstag. Samedi ×1.25, dimanche/fériés ×1.50.
- **Strangler fig** : `regenererJournalDepuisPointages()` dans `src/migration/`. Catégories incluses journal : `production`, `atelier`. Exclus : `deplacement`, absences.

### 2.4 Agents IA (état Phase 5c)

**20 agents** dans `src/AgentEngine.js` (2 193 lignes), orchestrés par `useAgents.js` + `src/Agents.js`.  
Architecture 3 tiers : Tier 1 (9 agents analyse pure) → Tier 2 (6 agents cross-data) → Tier 3 (5 agents synthèse).  
**Lisent encore `chantier.journal`** — compatible car le journal est dérivé des pointages (strangler fig). Migration directe vers `pointages[]` = Phase 6.

**Module alertes** séparé : `src/modules/alertes/` — moteur Zustand (`store.js`), 15 règles métier, scheduler. Indépendant d'AgentEngine.

---

## 3. Commandes

```bash
npm run test:unit             # Vitest — doit toujours passer AVANT push
CI=true npm run build         # Simule Vercel — les warnings ESLint = erreurs de build
node scripts/audit-btp.js     # Après toute modif de donnees.js
```

**Double gate obligatoire avant tout push** : les DEUX doivent être verts.

---

## 4. Règles de travail non négociables

### Workflow

1. **ARRÊT obligatoire avant commit/push** — attendre le GO explicite (`go`, `GO`, `valide` ou équivalent).
2. **Discipline phases** : audit/proposition → STOP → implémentation → STOP avant commit.
3. **Double gate** : `CI=true npm run build` ET `npm run test:unit` verts avant tout push.
4. **Branches** : jamais pousser sur `main` directement. Format : `claude/<sujet-court>`.
5. **Merge sur main** : côté Windows via commande `ship` de l'utilisateur — Claude Code pousse la branche uniquement. `api.github.com` est bloqué dans le container Claude Code.
6. **Tests non régressifs** : tout changement de calcul doit laisser les 414 tests verts. Ne jamais casser l'invariant des deux moteurs.
7. **TESTS RÉELS OBLIGATOIRES** — un test doit exercer le VRAI chemin de code :
   - UI/composants → tests RTL qui rendent le vrai composant et simulent l'interaction (`renderWithApp`).
   - Logique pure → importer et appeler les VRAIES fonctions exportées.
   - **INTERDIT** : les tests qui recopient/ré-implémentent la logique dans le fichier de test ("logic-mirror") = fausse confiance.
   - **BUT** : Valdrin ne doit JAMAIS avoir à tester un branchement à la main. Tester, c'est le job de Claude Code.
8. **RÉSUMÉ + PREUVE AUTOMATIQUES** — à la fin de CHAQUE tâche, AVANT tout commit et de façon AUTOMATIQUE (même si le brief ne le redemande pas), Claude Code doit fournir :
   1. Un résumé PRÉCIS, point par point, de ce qui a été fait face à chaque point du brief — preuve que l'intention a été comprise (pas un "c'est fait" vague).
   2. La PREUVE par de VRAIS tests (cf. règle 7) qui exercent le vrai chemin de code, + double gate vert (`CI=true npm run build` ET `npm run test:unit`), avec le total de tests.
   3. `git diff main --stat` pour montrer l'ampleur des changements.
   Puis ARRÊT et attente du GO explicite. Valdrin ne doit jamais avoir à tester un branchement à la main : prouver que ça marche fait partie du livrable.

### Code

```js
// ✅ Division par zéro
const marge = ca > 0 ? (val / ca) * 100 : null;
// ✅ Valeurs numériques
const cout = parseFloat(chantier.monChamp) || 0;
// ✅ Comparaison statuts — insensible casse
['en cours', 'planifié'].includes(c.statut?.trim().toLowerCase())
// ✅ IDs — toujours String coerce
String(facture.chantierId) === String(chantier.id)
// ✅ % retourne number (pas string)
Math.round(val * 1000) / 10   // ✅     (val * 100).toFixed(1) // ❌
```

Signaux d'alerte dans le code :
- `/ total` sans guard `total > 0`
- `.toFixed(` retourne une string
- `=== 'En cours'` comparaison casse-sensitive
- `joursPlannifies` dans un calcul réel (utiliser `heuresEmploye(journal, empId)`)
- `chantier.avancement` dans un calcul réel
- Écriture directe dans `chantier.journal` (source dérivée, ne pas toucher)

### Ce que Claude ne doit pas faire

- Pousser sur `main` sans `ship` explicite de l'utilisateur
- Committer sans GO explicite
- Modifier `chantier.journal` directement (c'est une vue dérivée)
- Casser l'équivalence entre `calculerCoutsChantier` et `calculerEtatChantier`
- Afficher NaN ou `undefined` dans l'UI (`|| 0` ou `|| '—'`)
- Ressaisir le montant du devis sur le chantier (CA = `devis.montantHT` uniquement)
- **Supprimer en cascade ou directement une entité référencée** — voir principe ci-dessous

### Principe fondamental : Rien ne se détruit

**Une entité qui a un historique ne peut jamais être supprimée — elle est bloquée.**

| Entité | Bloquée si… | Action autorisée |
|--------|------------|-----------------|
| Chantier | a des pointages ou des factures | Passer en `Terminé` / `Annulé` |
| Client | a des chantiers, devis ou factures | Conserver l'historique |
| Devis | a des chantiers liés ou des factures | Conserver l'historique |
| Employé | a des pointages | Marquer `actif: false` |

**Règle d'implémentation** : tout chemin de suppression doit passer par `src/utils/referenceGuard.js` avant d'agir. Si la garde retourne un message → `afficherNotif(message, 'error')` + `return`. Jamais de cascade (supprimer A en supprimant B, C, D).

---

## 5. Règles métier BTP Suisse

### Tarifs MO et charges

- Chef d'équipe CHF 450/j, ouvrier qualifié CHF 350/j, MO CHF 280/j (tarifs bruts types)
- `coefficientMainOeuvre` défaut **1.35** (+35% charges sociales employeur)
- Si `emp.tarifDejaCharge = true` → tarif utilisé tel quel ; sinon `× coefficient`
- Convention : **8h = 1 jour ouvrable**

### TVA et facturation

- TVA standard BTP : **8.1%** — `montantTTC = montantHT × 1.081`
- Délai paiement : **30 jours net**
- Retenue de garantie : **5%** pendant 5 ans (optionnel)

### Marges cibles

| Marge nette | Statut |
|------------|--------|
| ≥ 20% | ✅ Rentable |
| 15–20% | ⚠️ Limite |
| < 15% | 🔴 Non rentable |
| < 0% | 💀 À perte — alerte critique |

### Formules vérifiées

```
CA chantier  = devis.montantHT + avenants + heuresRegie
Coût MO réel = Σ (heuresEmploye(journal, empId) / 8 × tarifJour × coeff)
EAC          = coutRéel / (avancement / 100)
RAD          = EAC − coutRéel
Marge brute% = (CA − coutTotal) / CA × 100   ← sur vente, pas sur coût
Marge nette  = marge brute − (CA × tauxFG%)  ← tauxFG défaut 12%
```

### Cascade de suppression

- Supprimer un **devis** → supprimer chantiers liés + leurs factures
- Supprimer un **chantier** → supprimer ses factures liées
- Supprimer un **employé** → conserver le journal/pointages historiques

---

## 6. Lentille de décision

Avant d'implémenter quoi que ce soit, se demander :

> Cette feature **fait gagner de l'argent**, **fait gagner du temps**, **aide à gagner ou garder des clients**, ou **réduit un risque** pour CYNA ?

Si la réponse est non ou floue, ne pas le faire. CYNA est une PME de 3 associés — la complexité accidentelle coûte cher.

---

## 7. Renvois

| Document | Contenu |
|----------|---------|
| `PROJET.md` | Contexte business, roadmap phases, décisions techniques verrouillées |
| `DONNEES.md` | Cartographie exhaustive de `src/donnees.js` (exports, usage, doublons) |
| `AUDIT_POINTAGE.md` | 9 décisions architecturales du système de pointage (Phases 3–5c) |
| `ARCHITECTURE.md` | Carte complète de `src/` (générée par `/cartographier`) |
