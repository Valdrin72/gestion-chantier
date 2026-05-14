---
name: security-scan
description: Scan de sécurité complet avec auto-fix pour l'app CYNA. Lance security-auditor + threat-monitor en parallèle, corrige automatiquement les problèmes trouvés, et produit un rapport.
trigger: /security-scan
---

# Skill : Security Scan + Auto-Fix CYNA

## Ce que fait cette skill

Quand l'utilisateur tape `/security-scan`, tu dois :

### 1. Lancer un double audit en parallèle

Lance ces deux agents simultanément (un seul message avec deux Agent tool calls) :

**Agent security-auditor** :
```
Audite toute l'app CYNA pour failles de sécurité. Vérifie :
1. XSS : tout document.write, innerHTML, dangerouslySetInnerHTML — cherche dans src/
2. Secrets exposés : clés API dans le code JS (pas dans .env)
3. Supabase : RLS, anon key utilisée côté client uniquement
4. Inputs non validés : formulaires sans sanitisation
5. Dépendances : npm audit --audit-level=moderate
Retourne une liste structurée : [CRITIQUE|IMPORTANT|INFO] fichier:ligne — description
```

**Agent threat-monitor** :
```
Surveille les surfaces d'attaque de l'app CYNA. Vérifie :
1. Headers HTTP dans vercel.json (CSP, X-Frame-Options, HSTS)
2. Authentification Supabase (session, token storage)
3. Comparaisons de rôles sans toLowerCase()
4. Données utilisateur affichées sans échappement
5. CORS et origines autorisées
Retourne une liste structurée : [CRITIQUE|IMPORTANT|INFO] fichier:ligne — description
```

### 2. Consolider les résultats

Fusionne les deux rapports, déduplique, trie par criticité.

### 3. Auto-fix (si --fix ou demandé)

Pour chaque problème CRITIQUE et IMPORTANT :
- Applique la correction directement dans le fichier
- Utilise les patterns CLAUDE.md (escHtml, Number.isFinite, toLowerCase, etc.)
- Ne casse pas la logique existante

Patterns de correction connus :
```js
// XSS fix
const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Comparaison statut
statut?.toLowerCase() === 'en cours'

// Guard NaN
Number.isFinite(val) ? Math.round(val * 10) / 10 : '—'
```

### 4. Rapport final

Affiche :
```
🔒 CYNA Security Scan — [date]
════════════════════════════
✅ X problèmes corrigés automatiquement
⚠️  Y problèmes à traiter manuellement
ℹ️  Z informations

[Liste des corrections appliquées]
[Liste des actions manuelles requises]
```

### 5. Commit automatique si des fixes ont été appliqués

```bash
git add [fichiers modifiés]
git commit -m "fix: security scan auto-fix — [résumé des corrections]"
```

## Exemples d'invocation

- `/security-scan` — scan + rapport sans modification
- `/security-scan --fix` — scan + corrections automatiques + commit
- `/security-scan --fix src/Factures.js` — scan ciblé sur un fichier
