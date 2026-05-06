# Archi Platform

Plateforme tout-en-un pour architectes, ingénieurs et professionnels du bâtiment.
Couvre tout le cycle d'un projet : **conception → chantier → maintenance**.

## Modules

### 1. GED (Gestion Électronique de Documents)
- Arborescence de dossiers/fichiers (style Drive)
- **Versioning automatique** — historique complet des plans et documents
- **Partage externe** par lien : expiration, mot de passe, autorisation de téléchargement
- **Workflow de validation** : assigner des valideurs (mode `ALL`, `ANY`, `SEQUENTIAL`)
- **Commentaires** sur fichiers/PDF avec **mentions** `@membre` et suivi des réponses attendues
- **Notifications email** : nouveau fichier (au choix), demande de validation, mention, alerte cycle de vie
- **Permissions par projet** : Owner, Architect, Engineer, Contractor, Reviewer, Viewer

### 2. Chiffrage / Métré
- **Catalogue d'éléments paramétrables** par cabinet (Fenêtre, Mur, Porte, Radiateur…)
- Champs typés (TEXT, NUMBER, SELECT, DIMENSION, COLOR, DATE…)
- **État de l'existant** : neuf, à conserver, à rénover, à remplacer, à déposer
- Quantités, coûts (matériel / main-d'œuvre / autres), totaux
- Multi-feuilles par chiffrage

### 3. Cycle de vie & Maintenance
- À la livraison, les éléments du chiffrage deviennent des **assets** suivis
- Calcul automatique de fin de vie & fin de garantie
- **Alertes** lorsqu'un élément approche de sa fin de vie
- Historique des événements (inspection, maintenance, réparation, remplacement)
- Le propriétaire prend la main après remise du projet (`HANDED_OVER`)

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **PostgreSQL** + **Prisma**
- **Auth.js v5** (email/password + Google OAuth)
- **Tailwind CSS** + composants shadcn-style
- **Storage abstrait** — local (filesystem signé HMAC) ou S3-compatible (R2, MinIO, AWS S3)
- **Email** — driver `console` (dev) ou Resend (prod)
- **Zod** pour la validation, **TanStack Query** pour le state client

## Démarrage

```bash
cp .env.example .env
# éditer DATABASE_URL et AUTH_SECRET (openssl rand -base64 32)

npm install
npx prisma db push           # crée les tables (dev rapide, sans migration)
npm run db:seed              # crée user demo + catalogue d'éléments
npm run dev
```

Identifiants demo : `demo@archi.test` / `password123`

## Structure

```
src/
  app/                       # Next.js App Router
    (app)/                   # zone authentifiée
      dashboard/
      projects/[projectId]/
        page.tsx             # liste documents
        files/[fileId]/      # viewer + commentaires + validation + partage
        estimates/           # chiffrage
        assets/              # cycle de vie
        members/
    share/[token]/           # accès public via lien partagé
    api/                     # routes API
  components/                # UI (button, card, panneaux)
  lib/
    auth.ts                  # Auth.js config
    auth-helpers.ts          # requireUser, requireProjectAccess
    permissions.ts           # capacités par rôle
    storage/                 # local + s3
    email/                   # console + resend + templates
  server/                    # logique métier (server actions)
prisma/
  schema.prisma              # 3 modules
  seed.ts                    # données de démonstration
```

## Voir aussi

- [`ROADMAP.md`](./ROADMAP.md) — ce qui est fait, ce qui reste à faire
