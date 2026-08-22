-- ════════════════════════════════════════════════════════════════════════════
-- CYNA — Entreprise partagée · LOT 1 : schéma org + membres (DORMANT)
-- ────────────────────────────────────────────────────────────────────────────
-- Objectif : poser les fondations « organisation + membres » SANS que l'app les
-- utilise encore. Étape la plus sûre du chantier : purement ADDITIVE.
--
-- CE QUE FAIT CETTE MIGRATION :
--   1. Table  public.organisations
--   2. Table  public.membres (user_id ↔ org_id ↔ role)
--   3. Fonctions SECURITY DEFINER anti-récursion : est_membre() / est_admin()
--   4. RLS activé sur les DEUX nouvelles tables + policies « membre de l'org »
--
-- CE QU'ELLE NE FAIT PAS (volontairement) :
--   • Ne touche PAS la table `devis` ni son RLS actuel (auth.uid() = user_id).
--   • N'ajoute AUCUN org_id sur les données existantes (c'est le LOT 3).
--   • Ne modifie AUCUN code front (useSupabaseData / useAuth / App.js inchangés).
--   → DORMANT : l'app ignore totalement ces tables. Zéro changement de comportement.
--
-- SÉCURITÉ : isolation inter-org dès la conception (données Pictet à venir).
-- IDEMPOTENT : rejouable sans casse (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- RÉVERSIBLE : bloc de ROLLBACK commenté en bas de fichier.
--
-- ⚠ NE PAS APPLIQUER AUTOMATIQUEMENT. À exécuter par le patron sur STAGING d'abord,
--    puis en PROD après validation du test d'isolation (voir plan de test hors fichier).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. TABLE organisations
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.organisations (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  created_at timestamptz not null default now()
);

comment on table public.organisations is
  'CYNA — Lot 1 (dormant). Une organisation = une entreprise dont les membres partagent les données. Non encore référencée par le front.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. TABLE membres  (appartenance user ↔ org, avec rôle)
--    Rôles simples : 'admin' (gère l'org et ses membres) / 'membre' (accès données).
--    Unicité (org_id, user_id) : un utilisateur n'apparaît qu'une fois par org.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.membres (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations (id) on delete cascade,
  user_id    uuid not null references auth.users (id)          on delete cascade,
  role       text not null default 'membre' check (role in ('admin', 'membre')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

comment on table public.membres is
  'CYNA — Lot 1 (dormant). Lie un utilisateur auth à une organisation avec un rôle (admin/membre). Non encore référencée par le front.';

-- Index de lecture par utilisateur (les fonctions ci-dessous filtrent sur user_id).
create index if not exists membres_user_id_idx on public.membres (user_id);
create index if not exists membres_org_id_idx  on public.membres (org_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. FONCTIONS ANTI-RÉCURSION (SECURITY DEFINER)
-- ──────────────────────────────────────────────────────────────────────────
-- ⚠ PIÈGE CLASSIQUE SUPABASE : si une policy SUR `membres` interroge `membres`,
--    l'évaluation de la policy déclenche à nouveau la policy → RÉCURSION INFINIE.
--
-- SOLUTION : ces fonctions sont SECURITY DEFINER → elles s'exécutent avec les
--    privilèges de leur PROPRIÉTAIRE (postgres, propriétaire des tables), donc
--    leurs lectures de `membres` NE PASSENT PAS par le RLS de `membres`
--    (tant que la table n'est pas en FORCE ROW LEVEL SECURITY — voir plus bas).
--    → Les policies appellent est_membre()/est_admin() au lieu d'interroger
--      `membres` directement sous RLS → AUCUNE récursion possible.
--
-- Durcissement SECURITY DEFINER : search_path = '' (vide) + objets pleinement
--    qualifiés (public.membres, auth.uid()) → pas d'injection via search_path.
--    auth.uid() lit le claim JWT de la requête courante, valable même en DEFINER.

create or replace function public.est_membre(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membres m
    where m.org_id = p_org
      and m.user_id = auth.uid()
  );
$$;

comment on function public.est_membre(uuid) is
  'CYNA Lot 1 — TRUE si l''utilisateur courant (auth.uid()) est membre de l''org donnée. SECURITY DEFINER → évite la récursion RLS sur membres.';

create or replace function public.est_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membres m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

comment on function public.est_admin(uuid) is
  'CYNA Lot 1 — TRUE si l''utilisateur courant est admin de l''org donnée. SECURITY DEFINER → évite la récursion RLS sur membres.';

-- Exécution réservée aux utilisateurs authentifiés (pas d'anon).
revoke all on function public.est_membre(uuid) from public;
revoke all on function public.est_admin(uuid)  from public;
grant execute on function public.est_membre(uuid) to authenticated;
grant execute on function public.est_admin(uuid)  to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. RLS + POLICIES
-- ──────────────────────────────────────────────────────────────────────────
-- On ENABLE le RLS (défaut : le propriétaire postgres le contourne encore, ce qui
-- permet aux fonctions DEFINER de lire sans récursion). On n'utilise VOLONTAIREMENT
-- PAS `FORCE ROW LEVEL SECURITY` : le forcer réactiverait le RLS pour le
-- propriétaire et casserait le mécanisme anti-récursion des fonctions DEFINER.
alter table public.organisations enable row level security;
alter table public.membres       enable row level security;

-- Droits de base pour le rôle authenticated (le RLS filtre ensuite ligne par ligne).
-- Le rôle anon n'a AUCUN droit (dormant + sensible).
grant select, insert, update, delete on public.organisations to authenticated;
grant select, insert, update, delete on public.membres       to authenticated;

-- ── organisations ─────────────────────────────────────────────────────────
-- Lecture : un utilisateur ne voit que les orgs dont il est membre.
drop policy if exists organisations_select_membre on public.organisations;
create policy organisations_select_membre
  on public.organisations
  for select
  to authenticated
  using (public.est_membre(id));

-- Création : tout utilisateur authentifié peut créer une org (il devra ensuite
-- s'y ajouter comme membre admin — fait par l'admin/dashboard). Il ne la VERRA
-- toutefois que via la policy de lecture ci-dessus (donc après appartenance).
drop policy if exists organisations_insert_authenticated on public.organisations;
create policy organisations_insert_authenticated
  on public.organisations
  for insert
  to authenticated
  with check (true);

-- Modification / suppression : réservées aux ADMIN de l'org.
drop policy if exists organisations_update_admin on public.organisations;
create policy organisations_update_admin
  on public.organisations
  for update
  to authenticated
  using (public.est_admin(id))
  with check (public.est_admin(id));

drop policy if exists organisations_delete_admin on public.organisations;
create policy organisations_delete_admin
  on public.organisations
  for delete
  to authenticated
  using (public.est_admin(id));

-- ── membres ───────────────────────────────────────────────────────────────
-- Lecture : un utilisateur voit les membres des orgs dont il fait partie
--           (donc ses co-équipiers) — via est_membre() (DEFINER, pas de récursion).
drop policy if exists membres_select_membre on public.membres;
create policy membres_select_membre
  on public.membres
  for select
  to authenticated
  using (public.est_membre(org_id));

-- Insertion / modification / suppression : réservées aux ADMIN de l'org cible.
drop policy if exists membres_insert_admin on public.membres;
create policy membres_insert_admin
  on public.membres
  for insert
  to authenticated
  with check (public.est_admin(org_id));

drop policy if exists membres_update_admin on public.membres;
create policy membres_update_admin
  on public.membres
  for update
  to authenticated
  using (public.est_admin(org_id))
  with check (public.est_admin(org_id));

drop policy if exists membres_delete_admin on public.membres;
create policy membres_delete_admin
  on public.membres
  for delete
  to authenticated
  using (public.est_admin(org_id));

-- ════════════════════════════════════════════════════════════════════════════
-- NOTE D'AMORÇAGE (hors migration, à faire par l'admin via dashboard/service_role) :
--   La 1ʳᵉ organisation et son 1ᵉʳ membre admin doivent être créés avec le rôle
--   service_role (qui contourne le RLS), car aucune policy n'autorise un simple
--   utilisateur à s'auto-ajouter admin (protection anti-escalade). Exemple :
--     insert into public.organisations (nom) values ('CYNA') returning id;   -- → <ORG>
--     insert into public.membres (org_id, user_id, role)
--       values ('<ORG>', '<USER_UUID_PATRON>', 'admin');
--   Ensuite l'admin gère les autres membres via les policies ci-dessus.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (réversibilité) — décommenter et exécuter pour revenir en arrière.
-- Ordre inverse. Purement additif à l'origine → le DROP ne touche aucune donnée
-- existante (organisations/membres sont neuves et vides tant que le Lot 3 n'a pas eu lieu).
-- ────────────────────────────────────────────────────────────────────────────
-- drop policy if exists membres_delete_admin           on public.membres;
-- drop policy if exists membres_update_admin           on public.membres;
-- drop policy if exists membres_insert_admin           on public.membres;
-- drop policy if exists membres_select_membre          on public.membres;
-- drop policy if exists organisations_delete_admin     on public.organisations;
-- drop policy if exists organisations_update_admin     on public.organisations;
-- drop policy if exists organisations_insert_authenticated on public.organisations;
-- drop policy if exists organisations_select_membre    on public.organisations;
-- drop function if exists public.est_admin(uuid);
-- drop function if exists public.est_membre(uuid);
-- drop table if exists public.membres;        -- CASCADE implicite via FK sur organisations
-- drop table if exists public.organisations;
-- ════════════════════════════════════════════════════════════════════════════
