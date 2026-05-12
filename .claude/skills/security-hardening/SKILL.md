---
name: security-hardening
description: Skill durcissement sécurité CYNA — checklist complète de protection de l'app (headers, CSP, Supabase, dépendances). Invoque avec /security-hardening pour un audit ou une mise à jour sécurité.
---

# Sécurité Durcie — CYNA SÀRL

## État actuel de la sécurité (2025-05-12)

| Mesure | Statut | Détail |
|--------|--------|--------|
| HTTPS (Vercel) | ✅ Actif | Automatique sur Vercel |
| HSTS | ✅ Actif | `vercel.json` — max-age 1 an |
| X-Frame-Options: DENY | ✅ Actif | Protection clickjacking |
| X-Content-Type-Options | ✅ Actif | Protection MIME sniffing |
| X-XSS-Protection | ✅ Actif | Protection legacy browsers |
| Content-Security-Policy | ✅ Ajouté | 2025-05-12 — bloque scripts externes |
| Permissions-Policy | ✅ Ajouté | 2025-05-12 — désactive cam/micro/géo |
| Supabase ANON key (front) | ✅ Correct | Seule clé dans le bundle |
| SERVICE_ROLE_KEY | ⚠️ À supprimer | Présente dans .env.local inutilement |
| lodash (vuln) | ✅ Non critique | Dev uniquement, pas dans le bundle prod |
| contenu.objet XSS | ✅ Corrigé | 2025-05-12 — escHtml() ajouté |
| MFA Supabase | ❓ Non vérifié | À activer sur le compte admin |
| RLS Supabase | ❓ Non vérifié | À confirmer dans le dashboard |
| Export données (backup) | ❌ Absent | À implémenter dans ParametresPage.js |

## Content-Security-Policy expliqué

```
default-src 'self'           → tout ressource depuis le même domaine uniquement
script-src 'self' 'unsafe-inline' → React a besoin de 'unsafe-inline' (inline events)
style-src 'self' 'unsafe-inline'  → CSS inline React autorisé
connect-src *.supabase.co    → appels API Supabase autorisés
img-src data: blob:          → images base64 et blob URLs (photos, logos)
frame-ancestors 'none'       → interdit l'embedding de l'app dans une iframe
```

## Actions sécurité — Priorité décroissante

### 🔴 Immédiat
```bash
# 1. Supprimer SERVICE_ROLE_KEY du .env.local
# Ouvrir .env.local et supprimer la ligne SUPABASE_SERVICE_ROLE_KEY=...

# 2. Activer MFA sur Supabase
# → https://app.supabase.com → Account → Security → Enable MFA
```

### 🟠 Prochaine semaine
```
3. Vérifier RLS sur la table de stockage Supabase
   → Dashboard Supabase → Table Editor → Policies
   → S'assurer que SELECT/INSERT/UPDATE/DELETE vérifient auth.uid()

4. Implémenter le bouton export JSON dans ParametresPage.js
   → Voir skill backup-recovery pour le code exact
```

### 🟡 Prochaine release
```
5. Migrer de react-scripts vers Vite
   → Élimine 20+ vulnérabilités npm dans les dev-deps
   → Attention : migration non triviale, prévoir 1 jour

6. Ajouter validation JSON schema avant ecrireRowUser()
   → Protection contre la corruption des données
```

## Règles de développement sécurisé CYNA

### Inputs utilisateur
```js
// Toujours sanitiser avant sauvegarde
const sanitiser = (obj) => JSON.parse(
  JSON.stringify(obj, (k, v) =>
    typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0, 2000) : v
  )
);

// Toujours escaper avant insertion dans HTML
const escHtml = (s) => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
```

### Variables d'environnement
```
✅ REACT_APP_SUPABASE_URL         → public, OK front
✅ REACT_APP_SUPABASE_ANON_KEY    → public, OK front
❌ SUPABASE_SERVICE_ROLE_KEY      → JAMAIS dans .env.local du front
❌ Tout var sans préfixe REACT_APP_ → non exposée dans le bundle, OK
```

### console.log en production
```js
// Acceptable : logs de migration, informations système
console.log('[CYNA] Migration appliquée'); // OK — pas de données sensibles

// Interdit en production :
console.log('Données utilisateur:', donnees); // INTERDIT
console.log('Token:', token);                 // INTERDIT
```

## Surveillance continue (mensuelle)

```bash
npm audit --audit-level=critical   # 0 critique obligatoire
git log -- .env* | head -5         # vérifier que .env n'est pas commité
grep -rn "SERVICE_ROLE" src/       # doit retourner 0 résultat
grep -rn "dangerouslySetInnerHTML" src/ # doit retourner 0 résultat
```

## Obligations légales suisses (LPD)

```
Données personnelles stockées : noms clients, emails, téléphones, adresses
Obligation : informer les personnes concernées si fuite de données
Délai de notification : "sans délai" (LPD art. 24) si risque élevé
Contact autorité : PFPDT (Préposé fédéral à la protection des données)
Recommandation : nommer un responsable protection données chez CYNA
```
