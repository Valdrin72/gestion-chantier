# LE LÉZARD — Organigramme & Rôles

## Principe

Une équipe **humaine** (3 associés) + une équipe **IA** (Claude + agents `lz-*`).
Chaque humain a une zone de leadership claire. L'IA exécute, propose, alerte,
mais ne décide jamais à la place d'un humain sur les sujets stratégiques.

---

## Équipe humaine — 3 associés

> Les rôles ci-dessous sont une **proposition** à valider/ajuster par Valdrin
> en réunion fondateurs. Tant que Mathis et Fittime n'ont pas confirmé leurs
> rôles, Claude rapporte exclusivement à Valdrin.

### Valdrin — CEO / Operations / Tech (le user)

- **Décision finale** : stratégie, finances, partenariats
- **Quotidien** : pilotage agences/fournisseurs, Shopify ops, tech, IA
- **Délégation à Claude** : marketing, planning, contenu, exécution Shopify
- **À valider** : signature contrats, achats > 1000 CHF, prix retail

### Mathis — Direction Artistique (proposition)

- **Décision finale** : direction visuelle, design produits, identité graphique
- **Quotidien** : maquettes, prints, lookbooks, brief photographes
- **Sujets clés WC2026** : design des 3 maillots-hommage, palette par pays,
  packaging
- **Validation requise par lui** : tout visuel publié, logo, photoshoot

### Fittime — Communauté / Genève / Street (proposition)

- **Décision finale** : réseau local, événements physiques, ambassadeurs
- **Quotidien** : pop-ups, soirées, créateurs locaux, distribution physique
- **Sujets clés WC2026** : watch parties, partenariats bars Eaux-Vives /
  Pâquis, athlètes locaux
- **Validation requise par lui** : événements physiques, ambassadeurs payés

> ⚠️ **Action** : confirmer ces 3 rôles avec un fondateur meeting cette semaine.
> Si les rôles diffèrent, mettre à jour ce fichier immédiatement.

---

## Équipe IA — Pilotée par Claude

Claude (Opus) joue le **Head of Marketing**. Il pilote les agents spécialisés
(préfixés `lz-`) situés dans `.claude/agents/`. Voir la table ci-dessous.

### Hiérarchie IA

```
                          ┌──────────────┐
                          │   VALDRIN    │
                          │     CEO      │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │    CLAUDE    │
                          │ Head of MKT  │
                          └──────┬───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
  ┌─────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
  │  STRATÉGIE │          │   CONTENU   │          │  OPÉRATIONS │
  └─────┬──────┘          └──────┬──────┘          └──────┬──────┘
        │                        │                        │
  ┌─────┴─────────┐        ┌─────┴────────┐         ┌─────┴────────┐
  │ lz-brand-dir  │        │ lz-content   │         │ lz-shopify   │
  │ lz-mkt-strat  │        │ lz-art-dir   │         │ lz-planning  │
  │ lz-analytics  │        │ lz-copywrite │         │ lz-community │
  │ lz-influencer │        │ lz-photo-vid │         │ lz-fulfilmt  │
  └───────────────┘        └──────────────┘         └──────────────┘
```

### Catalogue agents `lz-*`

| Agent | Rôle | Quand l'invoquer |
|-------|------|------------------|
| `lz-brand-director` | Garant cohérence marque, voix, valeurs | Avant tout contenu public ou décision majeure |
| `lz-marketing-strategist` | Stratégie campagne, drops, calendrier | Planification d'un lancement |
| `lz-art-director` | Direction visuelle, palette, photo | Brief créatif, maquette, lookbook |
| `lz-content-creator` | Posts IG/TikTok, captions, scénarios reels | Création de contenu social |
| `lz-copywriter` | Descriptions produits, emails, ads | Écriture textes longs |
| `lz-community-manager` | DM, commentaires, comms communauté | Engagement quotidien |
| `lz-shopify-manager` | Produits, collections, prix, inventaire | Toute action Shopify Admin |
| `lz-planning-drops` | Calendrier drops, milestones, deadlines | Avant un drop, en suivi sprint |
| `lz-analytics` | KPIs ventes, conversion, ROAS, cohorts | Reporting hebdo / post-campagne |
| `lz-influencer-pr` | Partenariats créateurs, presse, ambassadeurs | Outreach, négociation, brief |
| `lz-photo-video-brief` | Brief shooting, scénarios vidéo | Avant un shoot photo/vidéo |
| `lz-fulfillment-ops` | Logistique, suivi commandes, retours | Anomalies expédition, post-commande |
| `lz-legal-watchdog` | Trademark, FIFA, droit suisse e-commerce | Avant tout drop "thématique" risqué |
| `lz-bug-hunter` | Bugs sur le site, checkout, intégrations | Issue technique remontée |

> Les agents ci-dessus sont créés au fur et à mesure dans `.claude/agents/`.
> Voir `.claude/agents/lz-team.md` pour le manifeste d'équipe à jour.

### Catalogue skills `lz-*`

Skills = compétences réutilisables, invocables par `/<skill>`.

| Skill | Usage |
|-------|-------|
| `lz-brand-voice` | Référence rapide ton, exemples copy par contexte |
| `lz-world-cup-2026` | Dates, équipes, calendrier matchs, légal FIFA |
| `lz-drop-mechanics` | Comment structurer un drop (teaser, preorder, push) |
| `lz-streetwear-codes` | Codes esthétiques, références, anti-clichés |
| `lz-instagram-playbook` | Formats IG (post, reel, story, broadcast) |
| `lz-tiktok-playbook` | Algo TikTok, formats viraux, sons tendance |
| `lz-shopify-products` | Comment structurer un produit Shopify (variants, SEO, tags) |
| `lz-chf-pricing` | Logique prix CHF streetwear premium |
| `lz-geneva-locations` | Lieux de shoot, partenariats bars/cafés, événements |

> Les skills sont créés dans `.claude/skills/<nom>/SKILL.md`.

---

## Rituels d'équipe

### Hebdo — Lundi 9h (proposition)

1. **Review chiffres** : ventes semaine, traffic, top produits → `lz-analytics`
2. **Calendrier semaine** : posts, drops, comms → `lz-planning-drops`
3. **Décisions à prendre** : remontées des agents la semaine précédente
4. **Sprint kickoff** : nouvelles tâches assignées humains + IA

### Pre-drop — J-7

1. **Brief créatif final** validé par Mathis
2. **Stock confirmé** sur Shopify
3. **Visuels prêts** + landing page
4. **Plan de teaser** activé (J-5, J-3, J-1, J-0)
5. **Press / créateurs** prévenus J-3

### Post-drop — J+3

1. **Debrief chiffres** ROAS, conversion, top variants
2. **Feedback clients** synthétisé
3. **Décision restock** ou non
4. **Mémoire** : write-up dans `marketing/campaigns/<nom>/debrief.md`

---

## Communication équipe

### Outils

- **GitHub** : tout document validé, versionné dans le repo `lezard/`
- **Shopify Admin** : source unique catalogue/orders/clients
- **Gmail (`lelezardgeneve@gmail.com`)** : comms externes formelles
- **WhatsApp groupe (proposition)** : décisions rapides entre fondateurs
- **Notion / Linear (à décider)** : si on dépasse le repo pour le planning

### Protocole quand un agent IA trouve un problème

```
[NOM_AGENT][NIVEAU] Contexte — Description
PROPOSITION : action concrète
VALIDATION REQUISE : oui / non
```

Niveaux : 🔴 CRITIQUE | 🟠 IMPORTANT | 🟡 NOTE

### Ce qui requiert validation humaine systématique

- Création d'un produit Shopify
- Changement de prix > 5%
- Suppression ou archivage produit
- Publication d'un post sur les réseaux officiels
- Email à la base clients
- Engagement budgétaire > 500 CHF
- Signature partenariat / ambassadeur
- Communication "officielle" presse / influenceur

### Ce que l'IA peut faire en autonomie

- Drafts de copy, posts, emails (proposition à valider)
- Brouillons de produits Shopify (status DRAFT, jamais ACTIVE sans validation)
- Recherche concurrence, veille tendances
- Génération de rapports analytics
- Brief créatif, recommandations stratégiques
- Documentation interne du repo

---

## Prochaines actions équipe

1. ✅ Manifeste créé (ce fichier)
2. 🔜 **Confirmer les rôles Mathis et Fittime** (réunion fondateurs)
3. 🔜 **Créer les agents `lz-*` essentiels** (cette session)
4. 🔜 **Créer les skills `lz-*` essentiels** (cette session)
5. 🔜 **Briefing fondateurs sur la stratégie WC2026** (proposer la stratégie)
