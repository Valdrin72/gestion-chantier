---
name: playwright-cyna
description: Tests navigateur automatisés CYNA — utilise Playwright MCP pour ouvrir l'app dans un vrai navigateur, naviguer entre les pages, tester les formulaires, prendre des screenshots et valider visuellement chaque flow critique. Invoquer avec /playwright-cyna pour tester l'app comme un vrai utilisateur.
trigger: /playwright-cyna
---

# Skill : Playwright CYNA — Tests Navigateur Réels

## Rôle

Playwright ouvre l'app dans un vrai navigateur et la teste comme un utilisateur humain.
Pas de mocks, pas de simulation — le vrai HTML, le vrai CSS, la vraie interaction.

**Ce que Playwright fait que les autres outils ne font pas :**
- Voir l'app telle que l'utilisateur la voit (rendu CSS réel)
- Tester les formulaires avec de vraies frappes clavier
- Détecter les régressions visuelles (avant/après screenshots)
- Valider les flows complets (login → devis → chantier → facture)
- Tester sur mobile (viewport 375px)

---

## Prérequis

L'app doit tourner en local :
```bash
# Dans un terminal séparé
npm start
# App disponible sur http://localhost:3000
```

---

## Quand l'utilisateur tape `/playwright-cyna`

### Phase 1 — Démarrer le navigateur

```
Utiliser mcp__playwright__browser_navigate pour aller sur http://localhost:3000
Utiliser mcp__playwright__browser_take_screenshot pour capturer l'état initial
Utiliser mcp__playwright__browser_snapshot pour lire la structure DOM
```

### Phase 2 — Flow Login

```
1. Screenshot de la page login
2. Remplir email + mot de passe (champs test si disponibles)
3. Cliquer "Se connecter"
4. Vérifier redirection vers le dashboard
5. Screenshot du dashboard connecté
```

Vérifier :
- [ ] Le logo CYNA est visible
- [ ] La sidebar affiche les pages autorisées selon le rôle
- [ ] Les KPIs du dashboard se chargent sans NaN
- [ ] Pas de message d'erreur visible

### Phase 3 — Flow Devis (test complet)

```
1. Naviguer vers /devis
2. Screenshot page devis
3. Cliquer "Nouveau devis"
4. Remplir le formulaire :
   - Sélectionner un client
   - Saisir un montant HT (ex: 15000)
   - Sélectionner un type de travaux
   - Mettre statut "Accepté"
5. Sauvegarder
6. Vérifier que le devis apparaît dans la liste
7. Screenshot résultat
```

Vérifier :
- [ ] Le KPI "CA SIGNÉ" s'est mis à jour
- [ ] Le statut badge s'affiche correctement
- [ ] Le taux d'acceptation est recalculé

### Phase 4 — Flow Chantier (test complet)

```
1. Naviguer vers /chantiers
2. Screenshot page chantiers
3. Cliquer "Nouveau chantier"
4. Remplir le formulaire :
   - Sélectionner le devis créé précédemment
   - Vérifier que le CA est pré-rempli depuis le devis
   - Saisir les jours prévus (ex: 20)
5. Sauvegarder
6. Cliquer sur le chantier → vérifier le détail
7. Screenshot du détail chantier
```

Vérifier :
- [ ] Le CA affiché = montantHT du devis (source unique)
- [ ] La marge n'affiche pas NaN
- [ ] Les onglets du détail sont tous accessibles

### Phase 5 — Flow Facture

```
1. Naviguer vers /devis
2. Sur le devis accepté, cliquer "Créer la facture"
3. Vérifier que la facture est créée avec les bons montants
4. Naviguer vers /finances
5. Vérifier que la facture apparaît
6. Screenshot finances
```

Vérifier :
- [ ] montantTTC = montantHT × 1.081 (TVA 8.1%)
- [ ] La facture est liée au bon chantier et client
- [ ] Le statut est "brouillon"

### Phase 6 — Test Suppression (ConfirmModal)

```
1. Aller sur /chantiers
2. Cliquer l'icône supprimer sur un chantier
3. Screenshot : la ConfirmModal doit apparaître
4. Vérifier que le fond est assombri
5. Cliquer "Annuler" → vérifier que rien n'est supprimé
6. Recliquer supprimer → cliquer "Supprimer" → vérifier la suppression
```

### Phase 7 — Test Mobile (viewport 375px)

```
Utiliser mcp__playwright__browser_resize avec width: 375, height: 667
```

Vérifier :
- [ ] La navigation mobile (MobileNav) est visible en bas
- [ ] Les cards se stackent verticalement (1 colonne)
- [ ] Les KPIs sont lisibles (police > 14px)
- [ ] Les boutons sont assez grands (> 44px)
- [ ] Screenshot mobile dashboard

### Phase 8 — Test Dark Mode

```
1. Trouver le toggle dark mode (Topbar ou Sidebar)
2. L'activer
3. Screenshot dark mode dashboard
4. Vérifier :
   - Background foncé
   - Texte clair lisible
   - Pas de couleurs "cassées" (blanc sur blanc, etc.)
5. Désactiver dark mode
```

### Phase 9 — Rapport Playwright

```
🎭 PLAYWRIGHT CYNA — [date]
════════════════════════════════════════════
App testée : http://localhost:3000
Navigateur : Chrome (Playwright)

FLOWS TESTÉS :
  ✅ Login           → dashboard accessible
  ✅ Devis           → création + KPI mis à jour
  ✅ Chantier        → lien devis correct, marge = [X]%
  ✅ Facture         → TTC = HT × 1.081 ✅
  ✅ Suppression     → ConfirmModal fonctionne
  ✅ Mobile 375px    → navigation OK, cards stackées
  ✅ Dark mode       → rendu correct

ANOMALIES DÉTECTÉES :
  [si aucune] ✅ Zéro régression visuelle détectée
  [si problème] ⚠️ [description + screenshot]

SCREENSHOTS PRIS : [N]
BUILD VALIDÉ : [oui/non]

"Vu, cliqué, validé — le vrai test utilisateur."
```

---

## Tests rapides ciblés

### Test NaN dans l'UI

```
1. Ouvrir le dashboard
2. Prendre un screenshot
3. Analyser visuellement : chercher "NaN", "undefined", "Infinity"
4. Si trouvé → reporter fichier + composant
```

### Test formulaire invalide

```
1. Ouvrir "Nouveau chantier"
2. Soumettre sans remplir les champs obligatoires
3. Vérifier que les messages d'erreur inline apparaissent
4. Screenshot des erreurs
```

### Test navigation rôles

```
1. Se connecter en tant que "conducteur"
2. Vérifier que les pages "Paramètres" et "Finances" ne sont pas visibles
3. Essayer d'accéder manuellement à /#/parametres
4. Vérifier le comportement (redirect ou page blanche)
```

---

## Options

- `/playwright-cyna` — test complet tous les flows
- `/playwright-cyna --login` — test flow login uniquement
- `/playwright-cyna --devis` — test flow devis uniquement
- `/playwright-cyna --mobile` — test mobile 375px
- `/playwright-cyna --dark` — test dark mode
- `/playwright-cyna --screenshot` — prendre un screenshot de la page actuelle
- `/playwright-cyna --nan` — chercher visuellement les NaN dans l'UI

---

## Intégration équipe

Playwright CYNA travaille avec :
- `taste-skill` — screenshots pour valider les améliorations UI
- `huashu-design` — screenshots avant/après refonte design
- `bug-hunter` — confirmer visuellement que le bug est corrigé
- `test-engineer` — complémentaire (Playwright = visuel, test-engineer = fonctionnel)
- `impeccable` — validation visuelle finale avant release
