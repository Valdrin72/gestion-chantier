# LE LÉZARD — Dossier marketing

> Marque de vêtements indépendante basée à Genève.
> Domaine : `lelezard.shop`
> Fondateurs : Valdrin · Mathis · Fittime
> Fabrication : Portugal

## Lecture obligatoire

Quand tu commences à travailler sur Le Lézard, lis dans cet ordre :

1. [`CLAUDE.md`](./CLAUDE.md) — règles non négociables, source de vérité
2. [`brand/identity.md`](./brand/identity.md) — voix, valeurs, positionnement
3. [`operations/team.md`](./operations/team.md) — qui fait quoi (humains + IA)
4. [`marketing/calendar-2026.md`](./marketing/calendar-2026.md) — calendrier
5. [`collections/world-cup-2026/strategy.md`](./collections/world-cup-2026/strategy.md) — focus actuel

## Structure du dossier

```
lezard/
├── README.md                                       # Ce fichier (index)
├── CLAUDE.md                                       # Manifeste & règles
├── brand/
│   └── identity.md                                 # Identité de marque
├── operations/
│   └── team.md                                     # Équipe humaine + IA
├── marketing/
│   ├── calendar-2026.md                            # Calendrier annuel
│   ├── campaigns/                                  # 1 dossier par campagne
│   └── content-calendar/                           # Posts planifiés
├── collections/
│   └── world-cup-2026/
│       └── strategy.md                             # Plan stratégique WC2026
├── shopify/                                        # Playbook Shopify (à venir)
└── legal/
    └── wc2026-compliance.md                        # Checklist trademark WC2026
```

## Équipe IA Le Lézard

L'équipe est définie dans `.claude/agents/lz-*.md` (préfixe `lz-`).
Voir le manifeste : `.claude/agents/lz-team.md`.

### Agents principaux

| Agent | Rôle |
|-------|------|
| `lz-brand-director` | Cohérence marque, voix, anti-clichés |
| `lz-marketing-strategist` | Stratégie campagnes / drops |
| `lz-shopify-manager` | Catalogue, collections, inventaire |
| `lz-content-creator` | Posts IG/TikTok, captions |
| `lz-copywriter` | Descriptions produits, emails, ads |
| `lz-community-manager` | DM, comments, service client |
| `lz-art-director` | Direction visuelle, briefs photoshoot |
| `lz-planning-drops` | Calendrier drops, milestones |
| `lz-analytics` | KPIs ventes, ROAS, cohort |
| `lz-influencer-pr` | Créateurs, presse, partenariats |
| `lz-legal-watchdog` | Trademark, droit suisse, FIFA |

### Skills disponibles

Skills dans `.claude/skills/lz-*/SKILL.md` :

| Skill | Usage |
|-------|-------|
| `lz-brand-voice` | Référence voix + exemples copy |
| `lz-world-cup-2026` | Dates, équipes, règles WC2026 |
| `lz-drop-mechanics` | Comment structurer un drop |
| `lz-streetwear-codes` | Codes esthétiques, anti-clichés |
| `lz-shopify-products` | Structure produit Shopify standard |
| `lz-chf-pricing` | Logique prix CHF Le Lézard |

## Hiérarchie de décision

```
VALDRIN (CEO) → CLAUDE (Head of Marketing) → AGENTS lz-*
```

Validation **humaine obligatoire** pour :
- Publication réseaux officiels
- Passage produit en `ACTIVE` sur Shopify
- Engagement budget > 500 CHF
- Signature partenariat / ambassadeur payé
- Communication presse formelle

L'IA peut **drafter / proposer / exécuter en DRAFT** tout le reste.

## Focus actuel — Coupe du Monde 2026

**J-25** au 17 mai 2026.
3 maillots-hommage : Suisse · Angleterre · Brésil.
Voir [`collections/world-cup-2026/strategy.md`](./collections/world-cup-2026/strategy.md).

**Décisions critiques en attente** :
- Production Portugal (scénario A/B/C)
- Rôles formalisés Mathis + Fittime
- Budget validé
- Avocat trademark sélectionné

## Séparation totale avec CYNA SÀRL

⚠️ **Ce dossier n'a aucun rapport avec l'app gestion-chantier CYNA SÀRL**
qui occupe le reste du repo. Deux univers totalement distincts :
- `gestion-chantier/`, `src/`, `supabase/`, etc. → CYNA BTP
- `lezard/` → Le Lézard mode

Quand tu travailles sur Le Lézard, ignore `CLAUDE.md` racine et
applique `lezard/CLAUDE.md`.
