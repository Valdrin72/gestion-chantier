# Roadmap

État au démarrage de la plateforme. Les sections « ✅ » sont implémentées dans
ce repo, les « 🚧 » sont scaffoldées (modèle + page basique) et les « ⏳ » restent
à faire.

## Foundation

- ✅ Next.js 15 + TypeScript + Tailwind + shadcn primitives
- ✅ Prisma + PostgreSQL — schéma complet (3 modules)
- ✅ Auth.js v5 (credentials + Google) avec adapter Prisma
- ✅ Multi-tenant : `Organization`, `OrganizationMember`
- ✅ RBAC projet : `ProjectMember`, capacités fines via `permissions.ts`
- ✅ Helpers `requireUser()` / `requireProjectAccess(capability)`
- ✅ Storage abstrait : driver `local` (URL HMAC signée) + `s3` (presigned)
- ✅ Email abstrait : driver `console` (dev) + `resend` (prod) + templates
- ✅ Seed : user demo + catalogue d'éléments paramétrables

## Module 1 — GED

- ✅ Upload de fichier (avec création de FileEntry + 1ère version)
- ✅ Versioning : nouvelle version sans perdre l'historique
- ✅ Liste des documents par projet
- ✅ Viewer : iframe PDF, image inline, fallback download
- ✅ Liens de partage : token, expiration, mot de passe, allowDownload
- ✅ Page publique `/share/[token]` avec déblocage par mot de passe
- ✅ Workflow de validation : modes `ALL` / `ANY` / `SEQUENTIAL`, étapes par valideur
- ✅ Commentaires (avec mentions `@[Nom](userId)`)
- ✅ Notifications en DB + email (nouveau fichier, validation demandée, validation décidée, mention)
- 🚧 Annotations PDF géo-localisées (`Comment.targetType=PDF_ANNOTATION`, `pdfRect`)
   — modèle prêt, **UI à faire** : couche de surlignage sur le PDF, capture de rectangle, ancrage
- ⏳ Arborescence de dossiers (modèle `Folder` prêt) — UI : breadcrumbs, drag-drop, déplacement
- ⏳ Recherche full-text sur fichiers (titre, description, contenu PDF — pgvector ou tsvector)
- ⏳ Préférences de notifications par utilisateur (modèle `NotificationPreference` prêt)
- ⏳ Centre de notifications dans l'UI (modèle prêt, pas de page)
- ⏳ Bibliothèque PDF.js / react-pdf intégrée (actuellement iframe natif)

## Module 2 — Chiffrage

- ✅ Modèles : `ElementType`, `ElementTypeField`, `Estimate`, `EstimateSheet`, `EstimateLine`
- ✅ Catalogue seedé : Fenêtre, Porte, Mur, Radiateur (avec champs typés)
- ✅ Création d'un chiffrage + lecture des feuilles avec totaux
- ⏳ **Éditeur de lignes** style tableur : ajout via picker d'élément, formulaire dynamique
   selon `ElementTypeField`, drag-drop entre feuilles, recopie, formules
- ⏳ Gestion du catalogue d'éléments (CRUD côté organisation) — UI à faire
- ⏳ Import/export Excel (xlsx)
- ⏳ Génération PDF du chiffrage
- ⏳ Versionnage des chiffrages (historique des modifications)
- ⏳ Lien chiffrage ↔ documents (rattacher un plan à une ligne)

## Module 3 — Cycle de vie

- ✅ Modèles : `AssetInventory`, `Asset`, `AssetEvent`, `LifecycleAlert`
- ✅ Action `handoverProject(projectId)` : transforme les `EstimateLine` trackables en `Asset`
- ✅ Calcul `endOfLifeDate` = `installDate + lifespan`
- ✅ Cron `/api/cron/lifecycle` (POST + secret) qui crée les alertes
- ✅ Email d'alerte aux owners
- ✅ Page liste d'assets avec statut + alertes actives
- ⏳ Page détail asset : historique d'événements, ajout d'un événement (inspection / maintenance)
- ⏳ Page alertes : acquit, résolution, escalade
- ⏳ Vue propriétaire dédiée (UX simplifiée pour le client final, sans vocabulaire technique)
- ⏳ Génération du dossier de remise (PDF avec fiche de chaque élément, garanties, etc.)

## Sécurité / DevOps

- ✅ URLs locales signées HMAC (storage local) avec expiration
- ✅ Cookie de session sur `/share/[token]` quand mot de passe
- ✅ Vérification des permissions sur **toutes** les server actions / API routes
- ⏳ Rate limiting (login, share access, register)
- ⏳ Verification email à l'inscription
- ⏳ Reset de mot de passe
- ⏳ Audit log (qui a fait quoi, sur quoi)
- ⏳ Tests : unit (lib/permissions, server/files), e2e (Playwright)
- ⏳ CI : typecheck + lint + tests
- ⏳ Migrations Prisma (actuellement on utilise `db push` pour le scaffolding)
- ⏳ Dockerfile + docker-compose (postgres + minio + app)

## Features annexes mentionnées dans le brief

- ✅ Email lorsqu'on demande une validation
- ✅ Email lorsqu'un nouvel ajout (au choix de celui qui ajoute, via `notifyMembers` flag)
- ✅ Email lorsqu'une mention nous concerne
- ✅ Gestion des rôles et accès par projet
- ✅ Visualisation des validations (panneau dédié sur la page fichier)
- ✅ Catalogue d'éléments paramétrables avec champs adaptés (fenêtre, etc.)
- ✅ Évaluation de l'état de l'existant (5 valeurs : NEW / TO_KEEP / TO_RENOVATE / TO_REPLACE / TO_REMOVE)
- ✅ Coûts détaillés (matériel / main-d'œuvre / autres) + quantité
- ✅ Suivi du cycle de vie post-remise + alertes fin de vie

## Décisions techniques notables

- **Pas de migrations versionnées au démarrage** : on utilise `prisma db push` pour itérer.
  Bascule vers `prisma migrate dev` dès que le schéma se stabilise.
- **Storage local par défaut** pour minimiser les dépendances en dev. Production : R2/S3.
- **iframe PDF** pour démarrer (rendu natif du navigateur). Migration vers PDF.js/react-pdf
  recommandée pour les annotations géolocalisées.
- **Mentions** stockées dans le texte avec syntaxe `@[Nom](userId)`. Permet de retrouver
  les mentions sans table d'index, et de re-rendre le commentaire avec liens cliquables.
- **JWT session** (Auth.js) pour scaler horizontalement sans coller la session à la DB.
