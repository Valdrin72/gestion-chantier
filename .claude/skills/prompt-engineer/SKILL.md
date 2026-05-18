---
name: prompt-engineer
description: Prompt Engineer CYNA — optimise les prompts envoyés à Claude dans l'app (Centre IA, Edge Function, agents). Améliore la qualité des réponses IA pour le contexte BTP genevois. Invoque avec /prompt pour revoir et améliorer un prompt.
trigger: /prompt
---

# Skill : Prompt Engineer — Optimisation des prompts IA pour CYNA Gestion Chantier

## Quand l'utilisateur tape `/prompt`

---

## Prompts clés dans l'app

### 1. Edge Function (`supabase/functions/claude-ia/index.ts`)
- Contexte métier injecté : données chantiers, factures, KPIs
- Modèle : claude-sonnet (vérifier version dans le code)
- Limites : MAX_TEXT=50000, MAX_MESSAGES=40

### 2. Centre IA (`src/CentreIA.js` et `src/components/ia/ClaudeIAPanel.js`)
- Chat libre avec mémoire persistante
- Analyse PDF, génération emails, comparaison devis
- Insights auto-sauvegardés en localStorage

---

## Principes d'un bon prompt CYNA

**Structure optimale :**
```
[RÔLE] Tu es un expert BTP genevois pour CYNA SÀRL.
[CONTEXTE] Données actuelles : {chantiers_actifs} chantiers, CA {ca_total}.
[TÂCHE] Analyse la rentabilité et identifie les 3 actions prioritaires.
[FORMAT] Réponds en bullet points, en français suisse, maximum 200 mots.
[CONTRAINTES] Ne jamais inventer de données. Si information manquante, le dire.
```

**Anti-patterns à éviter :**
```
❌ "Analyse tout et dis-moi tout" → trop vague
❌ Envoyer 50000 chars de données brutes → utiliser un résumé structuré
❌ Pas de format de sortie → réponse non structurée
❌ Pas de contraintes → hallucinations possibles
```

**Optimisations spécifiques CYNA :**
```js
// Contexte structuré à envoyer (pas les données brutes) :
const contexteIA = {
  resume: `${nbChantiers} chantiers actifs, CA ${caTotal} CHF, marge moy. ${margeMoy}%`,
  alertes: alertes.slice(0, 5).map(a => a.message),
  topChantiers: chantiers.slice(0, 3).map(c => ({ nom: c.nom, marge: c.marge, statut: c.statut })),
};
// Max ~1000 chars de contexte structuré > 10000 chars de JSON brut
```

---

## Améliorer un prompt existant

Quand l'utilisateur donne un prompt à améliorer :
1. Identifier ce qui manque (rôle ? contexte ? format ? contraintes ?)
2. Ajouter les éléments BTP genevois pertinents
3. Tester avec un exemple concret
4. Mesurer : la réponse est-elle plus précise, plus courte, plus actionnable ?

---

## Templates prêts à l'emploi

**Analyse chantier :**
```
Tu es expert BTP Genève. Chantier "{nom}" : CA {ca} CHF, coûts {couts} CHF, avancement {av}%.
Identifie en 3 points : risques actifs, action immédiate, projection fin de chantier.
Sois direct et chiffré.
```

**Relance client :**
```
Rédige un email de relance professionnel en français suisse pour la facture #{num}
de CHF {montant} émise le {date}, échue depuis {jours} jours.
Ton : courtois mais ferme. Longueur : 5-7 lignes max.
```

**Résumé de devis :**
```
Tu es expert BTP Genève. Résume ce devis en 3 lignes pour un client non-technique :
montant HT {montant}, postes principaux {postes}.
Mets en valeur la qualité et le rapport qualité/prix.
```

**Alerte critique :**
```
Chantier "{nom}" dépasse le budget de {pct}%. Rédige en 2 phrases une alerte claire
pour le chef de chantier avec l'action corrective recommandée.
```

---

## Options

- `/prompt` — revue et amélioration d'un prompt fourni par l'utilisateur
- `/prompt --analyse` — analyse de tous les prompts de l'app et score qualité
- `/prompt --template [type]` — génère un template pour un cas d'usage donné
- `/prompt --test [prompt]` — teste un prompt avec des données fictives CYNA

---

## Intégration équipe

Prompt Engineer travaille avec :
- `claude-api` (skill) — optimise également la structure API (cache, tokens, modèles)
- `security-auditor` — vérifie qu'aucune donnée sensible n'est envoyée dans les prompts
- `mempalace` (skill) — mémorise les meilleurs templates validés pour les sessions futures
- `claude-financial-service` (skill) — optimise les prompts d'analyse financière
