---
name: backup-recovery
description: Skill sauvegarde et récupération CYNA — procédures de backup des données, récupération après incident, prévention de la perte de données. Invoque avec /backup-recovery pour tout incident de données ou mise en place d'une stratégie de sauvegarde.
---

# Sauvegarde & Récupération — CYNA SÀRL

## Architecture actuelle des données

```
[Supabase cloud] ←→ [localStorage navigateur] ←→ [App React]
      ↓
  Sauvegarde Supabase automatique (selon plan)
      ↓
  Point-in-time recovery (plans payants uniquement)
```

## Risques de perte — Par probabilité

| Scénario | Prob. | Données perdues | Récupération |
|----------|-------|----------------|--------------|
| Navigation privée / cache effacé | Haute | localStorage uniquement | Sync depuis Supabase au login |
| Panne navigateur pendant save | Moyenne | 0 si save atomique | Relire depuis Supabase |
| Suppression accidentelle cascade | Haute | Entités liées | Aucune (pas de corbeille) |
| Corruption JSON Supabase | Très faible | Tout | Export périodique |
| Compte Supabase supprimé | Très faible | Tout | Export périodique |

## Stratégie de sauvegarde recommandée

### Niveau 1 — Export manuel (à implémenter)
```js
// Bouton "Exporter mes données" dans ParametresPage.js
const exporterDonnees = (donnees) => {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob(
    [JSON.stringify(donnees, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cyna-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
// Fréquence recommandée : 1x/semaine minimum
```

### Niveau 2 — Import restauration (à implémenter)
```js
// Bouton "Restaurer depuis fichier" dans ParametresPage.js
const importerDonnees = async (fichier) => {
  const texte = await fichier.text();
  const data = JSON.parse(texte);
  // Valider la structure avant d'écraser
  validerStructure(data);
  const ok = window.confirm(
    `Restaurer depuis le backup du ${data.meta?.date || 'date inconnue'} ?\n` +
    `Cette action remplacera TOUTES les données actuelles.`
  );
  if (ok) await ecrireRowUser(userId, data);
};
```

### Niveau 3 — Supabase Point-in-Time Recovery
```
Disponible sur : plan Pro Supabase (CHF ~25/mois)
Rétention : 7 jours (Pro), 30 jours (Team)
Comment : Dashboard Supabase → Database → Backups
```

## Procédure de récupération par scénario

### Scénario A — Suppression accidentelle d'un chantier
```
1. Vérifier localStorage : peut-être encore présent si refresh récent
   → DevTools → Application → localStorage → cyna_chantiers
2. Si absent : contacter support Supabase pour point-in-time recovery
3. Sinon : reconstituer manuellement depuis les devis et factures liées
```

### Scénario B — App inaccessible (Vercel en panne)
```
1. Les données restent dans Supabase et localStorage
2. Accéder directement via Supabase Studio : https://app.supabase.com
3. Exporter le JSON depuis la table de stockage manuellement
4. Patience : Vercel SLA 99.99% — pannes < 1h en général
```

### Scénario C — Corruption du JSON blob
```
1. NE PAS sauvegarder par-dessus (ne pas faire d'action dans l'app)
2. Aller dans Supabase → Table Editor → lire le JSON brut
3. Corriger manuellement dans un éditeur JSON (valider avec jsonlint.com)
4. Réécrire via Supabase Studio ou API
```

### Scénario D — Compte Supabase piraté
```
1. Aller sur https://app.supabase.com → changer le mot de passe immédiatement
2. Activer MFA
3. Dashboard → Settings → API → Régénérer les clés JWT
4. Mettre à jour les clés dans Vercel : Settings → Environment Variables
5. Redéployer l'app sur Vercel
6. Vérifier les logs d'accès Supabase des 30 derniers jours
7. Obligation légale LPD : notifier les utilisateurs si données exposées
```

## Recommandations immédiates

1. **Ajouter bouton export JSON** dans ParametresPage.js → 30 min de dev
2. **Activer MFA** sur le compte Supabase de CYNA → 5 min
3. **Supprimer `SUPABASE_SERVICE_ROLE_KEY`** de `.env.local` → 2 min
4. **Passer au plan Pro Supabase** pour point-in-time recovery → CHF 25/mois

## Ce que tu ne dois PAS faire
- Écraser Supabase avec des données corrompues
- Supprimer des chantiers sans confirmation cascade
- Stocker la SERVICE_ROLE_KEY côté front
- Ignorer les erreurs de sauvegarde silencieusement
