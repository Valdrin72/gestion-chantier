-- ════════════════════════════════════════════════════════════════════════════
-- CYNA — Historique des sauvegardes + règles d'accès « propriétaire » + TRUNCATE
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠ NE PAS APPLIQUER AUTOMATIQUEMENT. STAGING d'abord (par le propriétaire),
--   puis tests (supabase/tests/historique_staging.sql + e2e/historique.spec.mjs),
--   puis la PRODUCTION avec son accord.
--
-- CE QUE FAIT CETTE MIGRATION (une seule transaction) :
--   1. public.devis_historique : copie de l'ANCIENNE ligne de stockage
--      (numero = '__cyna_storage__') à chaque mise à jour ou suppression, selon la règle :
--        - suppression           → copie toujours ;
--        - mise à jour du blob   → copie si la dernière copie du compte a plus de 5 min,
--                                   OU si une liste (devis, chantiers, clients, factures,
--                                   pointages) perd des éléments ou un identifiant.
--      Les copies de plus de 90 jours du compte sont supprimées dans le même trigger
--      (pg_cron n'est pas activé). Le tout dans un bloc EXCEPTION : la sauvegarde ne doit
--      jamais échouer à cause de l'historique.
--      Lecture réservée au propriétaire (RLS) ; aucune écriture ni suppression possible
--      par les utilisateurs.
--   2. Règles d'accès « propriétaire » de devis, chantiers, clients, factures, de façon
--      IDEMPOTENTE : table absente → rien ; politique déjà présente → rien ; sinon
--      création de <table>_own (auth.uid() = user_id). La RLS n'est activée que si la table
--      a (ou reçoit) au moins une politique, pour ne jamais la rendre inaccessible.
--      AUCUN DROP / ALTER / renommage de politique existante.
--   3. REVOKE TRUNCATE sur toutes les tables du schéma public pour anon et authenticated.
--
-- RESTAURATION : voir supabase/RESTAURATION-HISTORIQUE.md.
-- ROLLBACK : bloc commenté en fin de fichier.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Table d'historique ───────────────────────────────────────────────────
-- Le type de devis_id est lu dans le catalogue (la table devis a été créée depuis le
-- dashboard : son type n'est pas dans le dépôt). user_id doit être un uuid, sinon arrêt.
DO $$
DECLARE
  type_id      text;
  type_user_id text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO type_id
    FROM pg_attribute a
   WHERE a.attrelid = 'public.devis'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO type_user_id
    FROM pg_attribute a
   WHERE a.attrelid = 'public.devis'::regclass AND a.attname = 'user_id' AND NOT a.attisdropped;
  IF type_id IS NULL THEN
    RAISE EXCEPTION 'public.devis.id introuvable : migration annulée';
  END IF;
  IF type_user_id IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'public.devis.user_id n''est pas un uuid (%) : migration annulée', type_user_id;
  END IF;
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.devis_historique (
       id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       devis_id  %s,
       user_id   uuid        NOT NULL,
       version   bigint,
       data      jsonb       NOT NULL,
       sauve_le  timestamptz NOT NULL DEFAULT now()
     )', type_id);
END;
$$;

COMMENT ON TABLE public.devis_historique IS
  'CYNA — copies des anciennes lignes de stockage (__cyna_storage__). Écrites uniquement par le trigger devis_historique_apres_ecriture. Lecture par le propriétaire. Rétention 90 jours.';

CREATE INDEX IF NOT EXISTS devis_historique_user_sauve_le
  ON public.devis_historique (user_id, sauve_le);

ALTER TABLE public.devis_historique ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour le propriétaire. Aucune politique INSERT / UPDATE / DELETE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'devis_historique'
       AND policyname = 'devis_historique_select_own'
  ) THEN
    CREATE POLICY devis_historique_select_own
      ON public.devis_historique
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

REVOKE ALL ON public.devis_historique FROM anon, authenticated;
GRANT SELECT ON public.devis_historique TO authenticated;

-- ── Fonction du trigger ─────────────────────────────────────────────────────
-- SECURITY DEFINER : l'utilisateur n'a aucun droit d'écriture sur l'historique.
-- search_path vide + noms entièrement qualifiés. lock_timeout court : si l'historique
-- est verrouillé, on y renonce vite au lieu de faire attendre la sauvegarde.
CREATE OR REPLACE FUNCTION public.devis_historiser()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '2s'
AS $$
DECLARE
  cles     constant text[] := ARRAY['devis', 'chantiers', 'clients', 'factures', 'pointages'];
  cle      text;
  ancienne jsonb;
  nouvelle jsonb;
  retrait  boolean := false;
  derniere timestamptz;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      -- Suppression de la ligne de stockage : copie TOUJOURS (pas de règle des 5 minutes).
      INSERT INTO public.devis_historique (devis_id, user_id, version, data)
      VALUES (OLD.id, OLD.user_id, OLD.version, COALESCE(OLD.data, '{}'::jsonb));
    ELSIF NEW.data IS DISTINCT FROM OLD.data THEN
      -- Retrait : une liste perd des éléments, ou un identifiant présent avant disparaît
      -- (couvre un import qui remplace les listes à longueur égale). Toute liste non
      -- tableau (absente, null, objet) est lue comme une liste vide.
      FOREACH cle IN ARRAY cles LOOP
        ancienne := CASE WHEN jsonb_typeof(OLD.data -> cle) = 'array' THEN OLD.data -> cle ELSE '[]'::jsonb END;
        nouvelle := CASE WHEN jsonb_typeof(NEW.data -> cle) = 'array' THEN NEW.data -> cle ELSE '[]'::jsonb END;
        IF jsonb_array_length(nouvelle) < jsonb_array_length(ancienne)
           OR EXISTS (
                SELECT o ->> 'id' FROM jsonb_array_elements(ancienne) AS o
                 WHERE jsonb_typeof(o) = 'object' AND o ? 'id'
                EXCEPT
                SELECT n ->> 'id' FROM jsonb_array_elements(nouvelle) AS n
                 WHERE jsonb_typeof(n) = 'object' AND n ? 'id'
              )
        THEN
          retrait := true;
          EXIT;
        END IF;
      END LOOP;

      SELECT max(h.sauve_le) INTO derniere
        FROM public.devis_historique AS h
       WHERE h.user_id = OLD.user_id;

      IF retrait OR derniere IS NULL OR derniere < now() - interval '5 minutes' THEN
        INSERT INTO public.devis_historique (devis_id, user_id, version, data)
        VALUES (OLD.id, OLD.user_id, OLD.version, COALESCE(OLD.data, '{}'::jsonb));
      END IF;
    END IF;

    -- Rétention : copies de plus de 90 jours de CE compte.
    DELETE FROM public.devis_historique AS h
     WHERE h.user_id = OLD.user_id
       AND h.sauve_le < now() - interval '90 days';
  EXCEPTION
    WHEN query_canceled THEN
      RAISE WARNING 'devis_historiser annulé (%) — sauvegarde conservée', SQLERRM;
    WHEN OTHERS THEN
      RAISE WARNING 'devis_historiser a échoué (% : %) — sauvegarde conservée', SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- Appelée uniquement par le trigger (un trigger ne vérifie pas le droit EXECUTE).
REVOKE ALL ON FUNCTION public.devis_historiser() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS devis_historique_apres_ecriture ON public.devis;
CREATE TRIGGER devis_historique_apres_ecriture
  AFTER UPDATE OR DELETE ON public.devis
  FOR EACH ROW
  WHEN (OLD.numero = '__cyna_storage__')
  EXECUTE FUNCTION public.devis_historiser();

-- ── 2. Règles d'accès « propriétaire » (idempotent, sans rien supprimer) ────
DO $$
DECLARE
  t          text;
  a_politique boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['devis', 'chantiers', 'clients', 'factures'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'public.% absente : rien à faire', t;
      CONTINUE;
    END IF;

    a_politique := EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t);

    IF a_politique THEN
      RAISE NOTICE 'public.% a déjà au moins une politique : inchangées', t;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t || '_own', t);
      a_politique := true;
      RAISE NOTICE 'public.% : politique %_own créée', t, t;
    ELSE
      RAISE WARNING 'public.% n''a ni politique ni colonne user_id : RLS non modifiée, à traiter à la main', t;
    END IF;

    -- RLS activée seulement si la table a au moins une politique (sinon elle deviendrait
    -- inaccessible à tous les utilisateurs).
    IF a_politique AND NOT (SELECT c.relrowsecurity FROM pg_class AS c WHERE c.oid = to_regclass('public.' || t)) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'public.% : RLS activée', t;
    END IF;
  END LOOP;
END;
$$;

-- ── 3. TRUNCATE interdit aux rôles applicatifs ──────────────────────────────
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- Tables créées plus tard par le rôle qui exécute cette migration. Limite : les privilèges
-- par défaut d'autres rôles (ex. supabase_admin) ne sont pas modifiés ici.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manuel uniquement) — supprime l'historique ET son contenu.
-- Les politiques <table>_own éventuellement créées et la RLS éventuellement activée
-- (voir les NOTICE de l'application) ne sont PAS annulées par ce bloc.
-- ────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS devis_historique_apres_ecriture ON public.devis;
-- DROP FUNCTION IF EXISTS public.devis_historiser();
-- DROP TABLE IF EXISTS public.devis_historique;
-- -- Seulement si l'on veut rendre TRUNCATE aux rôles applicatifs (déconseillé) :
-- -- GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- COMMIT;
-- ════════════════════════════════════════════════════════════════════════════
