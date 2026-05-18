---
name: debug-prod
description: Debug production CYNA — diagnostique les erreurs en live sur Vercel + Supabase. Analyse les logs, identifie les erreurs React runtime, inspecte les requêtes Supabase échouées. Invoque avec /debug-prod.
trigger: /debug-prod
---

# Skill : Debug Prod — Diagnostic production CYNA

## Principe

Debug Prod est le médecin urgentiste de l'app CYNA en production.
Il suit un protocole de triage structuré : identifier la source de l'erreur
(Vercel front, Supabase back, Edge Function, React runtime), isoler la cause,
et proposer un fix immédiat.

**Pas de panique, protocole de triage systématique.**

---

## Quand l'utilisateur tape `/debug-prod`

### Sources de logs disponibles

**1. Vercel (frontend)**
- Dashboard Vercel → Functions → Logs
- Variables d'environnement : `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`
- Build logs : chercher les warnings ESLint et erreurs de compilation

**2. Supabase (backend)**
- Dashboard Supabase → Logs → API / Auth / Database
- Edge Function logs : `supabase/functions/claude-ia/`
- RLS errors : apparaissent dans Postgres logs

**3. React runtime (browser)**

```js
// Les erreurs sont silencées en prod par guard NODE_ENV
// Pour débugger : ouvrir DevTools → Console → filtrer "error"
// Chercher : "Cannot read properties of undefined", "NaN", "TypeError"
```

### Diagnostic par symptôme

**Symptôme : Page blanche après login**
1. Vérifier Supabase Auth logs → token valide ?
2. Vérifier `useSupabaseData.js` → erreur de lecture JSON ?
3. Vérifier `App.js` → erreur dans `appValue` useMemo ?

**Symptôme : Données ne se sauvegardent pas**
1. Vérifier Supabase → Table `user_data` → RLS policies actives ?
2. Vérifier `ecrireRowUser()` dans `useSupabaseData.js`
3. Vérifier que `REACT_APP_SUPABASE_ANON_KEY` est bien dans Vercel env vars

**Symptôme : Edge Function Claude IA échoue**
1. Vérifier Supabase → Functions → `claude-ia` → Logs
2. Vérifier header `Authorization: Bearer [token]`
3. Vérifier `ANTHROPIC_API_KEY` dans les secrets Supabase Edge Functions
4. Vérifier `ALLOWED_ORIGIN` = URL Vercel exacte

**Symptôme : NaN dans l'UI**
```bash
grep -rn "/ total\|/ ca\|/ nb" src/ --include="*.js" | grep -v "|| 0\|> 0 ?"
```
→ Division sans guard → ajouter `total > 0 ? ... : null`

**Symptôme : Chantiers/factures ne s'affichent plus**
1. Vérifier `useSupabaseData.js` → `lireRowUser()` → données JSON corrompues ?
2. Vérifier localStorage → `cyna_data_cache_*` → clé obsolète ?
3. Vérifier Supabase → Table `user_data` → colonne `data` non nulle ?

**Symptôme : Erreur 401 / 403 Supabase**
1. Token expiré ? → vérifier `supabase.auth.getSession()`
2. RLS bloque ? → vérifier policies sur la table `user_data`
3. ANON_KEY incorrecte ? → vérifier dans Vercel env vars

### Commandes de diagnostic local

```bash
# Build complet avec warnings
npm run build 2>&1 | grep -E "WARNING|ERROR"

# Audit BTP métier
node scripts/audit-btp.js

# Vulnérabilités npm
npm audit --audit-level=high

# Vérifier les divisions sans guard
grep -rn "/ total\|/ ca\|/ montant" src/ --include="*.js" | grep -v "|| 0\|> 0 ?\|null"

# Vérifier les NaN potentiels
grep -rn "\.toFixed\|parseInt(" src/ --include="*.js" | grep -v "parseFloat\|Math.round"
```

### Checklist avant de contacter le support

- [ ] Reproduit en local ? (`npm start`)
- [ ] Même erreur en mode incognito ? (élimine le cache)
- [ ] Erreur dans Supabase logs ?
- [ ] Erreur dans Vercel Function logs ?
- [ ] Variables d'environnement correctes sur Vercel ?
- [ ] `node scripts/audit-btp.js` → 0 critique ?

### Rapport de diagnostic

```
╔══════════════════════════════════════╗
║  DEBUG PROD — Diagnostic [horodatage]║
╠══════════════════════════════════════╣
║ Source identifiée : Supabase RLS     ║
║ Symptôme          : Données vides    ║
║ Root cause        : Policy manquante ║
╠══════════════════════════════════════╣
║ FIX IMMÉDIAT :                       ║
║  ALTER POLICY user_data_select ...   ║
╠══════════════════════════════════════╣
║ STATUT : 🔴 Critique — app down      ║
╚══════════════════════════════════════╝
```

---

## Options

- `/debug-prod` — diagnostic complet de l'app en production
- `/debug-prod --vercel` — focus sur les logs Vercel uniquement
- `/debug-prod --supabase` — focus sur les logs Supabase uniquement
- `/debug-prod --nan` — scan NaN/undefined dans le code source
- `/debug-prod --build` — analyser les erreurs de build

---

## Escalade si non résolu

1. Vérifier `git log --oneline -10` → dernier commit cassant ?
2. `git bisect` pour identifier le commit problématique
3. Rollback Vercel si nécessaire (Dashboard → Deployments → Rollback)

---

## Intégration équipe

Debug Prod travaille avec :
- `caveman` (skill) — quand l'erreur résiste au diagnostic classique
- `security-auditor` — si l'erreur semble liée à l'auth/RLS
- `bug-hunter` — pour scanner le code source après correction
- `darwin` (skill) — après le fix, pour éviter la récidive
