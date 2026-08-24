-- ════════════════════════════════════════════════════════════════════════════
-- CYNA — Entreprise partagée · LOT 2 : table org_storage + RLS (DORMANT)
-- ────────────────────────────────────────────────────────────────────────────
-- Objectif : créer le coffre de données AU NIVEAU DE L'ORGANISATION (un blob jsonb
-- partagé par tous les membres de l'org), protégé par le RLS « est membre de l'org ».
-- Étape PUREMENT ADDITIVE : personne ne l'utilise encore.
--
-- CE QUE FAIT CETTE MIGRATION :
--   1. Table  public.org_storage  (UNE ligne par org : PRIMARY KEY (org_id))
--   2. RLS activé + policies SELECT / INSERT / UPDATE basées sur est_membre(org_id)
--      → tout membre de l'org lit ET écrit le blob de SON org. Accès identiques.
--   3. PAS de policy DELETE (choix prudent, voir note plus bas).
--
-- CE QU'ELLE NE FAIT PAS (volontairement) :
--   • Ne COPIE AUCUNE donnée depuis `devis` (la copie du blob = LOT 3, séparé).
--   • Ne touche NI la table `devis` NI son RLS actuel (auth.uid() = user_id).
--   • Ne modifie AUCUN code front (useSupabaseData / useAuth inchangés → LOT 4).
--   • Ne REDÉFINIT PAS est_membre()/est_admin() : réutilise celles du LOT 1.
--   → DORMANT : l'app ignore totalement cette table. Zéro changement de comportement.
--
-- DÉCISIONS ACTÉES (patron) :
--   • Option B : table dédiée org_storage, coexiste avec l'ancien stockage `devis`.
--   • Accès identiques via est_membre(org_id). est_admin N'EST PAS utilisé pour
--     restreindre l'accès aux données (les 3 associés voient/écrivent tout, pareil).
--
-- SÉCURITÉ : isolation inter-org dès la conception (est_membre = SECURITY DEFINER,
--   search_path vide, anti-récursion — définie au LOT 1).
-- IDEMPOTENT : rejouable sans casse (IF NOT EXISTS / DROP POLICY IF EXISTS / OR REPLACE).
-- RÉVERSIBLE : bloc de ROLLBACK commenté en bas de fichier.
--
-- ⚠ NE PAS APPLIQUER AUTOMATIQUEMENT. À exécuter par le patron sur STAGING d'abord
--    (npx supabase db push, projet lié = staging), puis test d'isolation (SQL Editor).
--    NE PAS toucher la PROD tant que le test d'étanchéité n'est pas validé.
-- ⚠ PRÉREQUIS : le LOT 1 (organisations + membres + est_membre/est_admin) doit être
--    appliqué sur le même environnement AVANT ce Lot 2 (dépendance FK + fonctions).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. TABLE org_storage  (UN blob jsonb par organisation)
--    PRIMARY KEY (org_id) → au plus UNE ligne de stockage par org (unicité native).
--    ON DELETE CASCADE : si l'org disparaît, son coffre disparaît avec (cohérent).
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.org_storage (
  org_id     uuid        not null references public.organisations (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Traçabilité « qui a écrit » : rempli à l'INSERT via auth.uid(). Le front (Lot 4)
  -- pourra le repositionner explicitement à chaque écriture. Sans effet sur les droits.
  updated_by uuid        null     default auth.uid(),
  primary key (org_id)
);

comment on table public.org_storage is
  'CYNA — Lot 2 (dormant). UN blob jsonb {chantiers, devis, factures, clients, parametres, pointages} partagé par tous les membres d''une organisation. RLS est_membre(org_id). Non encore utilisée par le front (Lot 4).';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. RLS + POLICIES  (le cœur du Lot 2)
-- ──────────────────────────────────────────────────────────────────────────
-- On réutilise public.est_membre(uuid) du LOT 1 (SECURITY DEFINER, search_path vide) :
-- elle lit `membres` sans passer par le RLS de `membres` → aucune récursion possible.
-- On N'active PAS FORCE ROW LEVEL SECURITY (mêmes raisons qu'au Lot 1 : ne pas casser
-- le mécanisme anti-récursion des fonctions DEFINER).
alter table public.org_storage enable row level security;

-- Droits de base pour authenticated (le RLS filtre ensuite ligne par ligne).
-- anon : AUCUN droit (dormant + données sensibles de l'entreprise).
grant select, insert, update on public.org_storage to authenticated;
-- NB : pas de grant DELETE (voir policy DELETE ci-dessous).

-- ── SELECT : tout membre de l'org lit le blob de son org ────────────────────
drop policy if exists org_storage_select_membre on public.org_storage;
create policy org_storage_select_membre
  on public.org_storage
  for select
  to authenticated
  using (public.est_membre(org_id));

-- ── INSERT : un membre peut créer la ligne de stockage de SON org ───────────
--   (WITH CHECK garantit qu'on ne peut insérer que pour une org dont on est membre.)
drop policy if exists org_storage_insert_membre on public.org_storage;
create policy org_storage_insert_membre
  on public.org_storage
  for insert
  to authenticated
  with check (public.est_membre(org_id));

-- ── UPDATE : un membre met à jour le blob de SON org ────────────────────────
--   USING (ligne visible) + WITH CHECK (nouvelle valeur reste dans son org) →
--   empêche de « déplacer » une ligne vers une autre org.
drop policy if exists org_storage_update_membre on public.org_storage;
create policy org_storage_update_membre
  on public.org_storage
  for update
  to authenticated
  using (public.est_membre(org_id))
  with check (public.est_membre(org_id));

-- ── DELETE : AUCUNE policy (choix prudent) ──────────────────────────────────
--   Pourquoi pas de DELETE du tout : cette ligne EST tout le coffre de l'entreprise.
--   Aucun utilisateur de l'app (même admin) ne doit pouvoir l'effacer d'un clic —
--   ce serait la perte totale des données CYNA. Sans policy DELETE + sans grant
--   DELETE, toute tentative de suppression par un compte `authenticated` est refusée
--   par le RLS. La maintenance exceptionnelle (purge/rollback) reste possible via le
--   rôle `service_role` (dashboard Supabase), qui contourne le RLS.
--   → « Rien ne se détruit » appliqué au coffre lui-même.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (réversibilité) — décommenter et exécuter pour revenir en arrière.
-- Purement additif → le DROP ne touche AUCUNE donnée existante (org_storage est
-- neuve et vide tant que le Lot 3 « copie du blob » n'a pas eu lieu).
-- ────────────────────────────────────────────────────────────────────────────
-- drop policy if exists org_storage_update_membre on public.org_storage;
-- drop policy if exists org_storage_insert_membre on public.org_storage;
-- drop policy if exists org_storage_select_membre on public.org_storage;
-- drop table if exists public.org_storage;
-- ════════════════════════════════════════════════════════════════════════════
