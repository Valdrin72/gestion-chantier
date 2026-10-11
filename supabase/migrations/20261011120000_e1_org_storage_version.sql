-- ════════════════════════════════════════════════════════════════════════════
-- CYNA — Entreprise partagée · E1 : anti-écrasement du coffre org_storage
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠ NE PAS APPLIQUER AUTOMATIQUEMENT. STAGING d'abord, puis tests
--   (supabase/tests/org_storage_version_staging.sql + tests de l'app), puis la
--   PRODUCTION avec l'accord du patron. En production, org_storage est VIDE et le mode
--   org n'est utilisé par personne : cette migration ne change rien pour les comptes actuels.
--
-- CE QUE FAIT CETTE MIGRATION (une seule transaction) :
--   1. Colonne version sur org_storage + trigger org_storage_version_garde :
--      toute mise à jour doit porter version = ancienne version + 1, sinon refus P0409
--      (même règle que la ligne de stockage de devis). Deux associés qui enregistrent
--      en même temps : le second est refusé et recharge, il n'écrase plus le premier.
--      Le même trigger date l'écriture (updated_at) et note son auteur réel
--      (updated_by = auth.uid()) côté serveur : le navigateur ne peut plus le falsifier.
--      Le coffre ne peut pas changer d'organisation (org_id figé).
--   2. Plus de création du coffre par l'application : la politique INSERT et le droit
--      INSERT des utilisateurs sont retirés. Le coffre est créé par l'administrateur
--      (étape E2, copie des données). Un coffre absent n'est donc jamais « amorcé » vide.
--   3. public.org_storage_historique : copie de l'ANCIENNE version du coffre, même règle
--      que devis_historique (suppression → toujours ; mise à jour → si la dernière copie a
--      plus de 5 min OU si une liste perd des éléments / un identifiant). Les copies de plus de
--      90 jours sont purgées à chaque écriture du coffre (pas de pg_cron : une entreprise qui
--      n'écrit plus garde ses anciennes copies, ce qui ne fait perdre aucune donnée).
--      Lecture réservée aux membres de l'organisation ; aucune écriture par les utilisateurs.
--   4. Temps réel : org_storage ajoutée à la publication supabase_realtime (si absente),
--      pour que les associés voient les enregistrements des autres sans recharger.
--
-- CE QU'ELLE NE FAIT PAS : ne copie aucune donnée, ne touche ni devis ni ses règles,
--   ne crée aucune organisation ni aucun membre.
-- IDEMPOTENTE. ROLLBACK : bloc commenté en fin de fichier.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Version + garde ──────────────────────────────────────────────────────
ALTER TABLE public.org_storage ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.org_storage_verifier_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'le coffre ne peut pas changer d''organisation';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'conflit de version org_storage';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_storage_version_garde ON public.org_storage;
CREATE TRIGGER org_storage_version_garde BEFORE UPDATE ON public.org_storage
FOR EACH ROW EXECUTE FUNCTION public.org_storage_verifier_version();

-- ── 2. Pas de création du coffre depuis l'application ───────────────────────
DROP POLICY IF EXISTS org_storage_insert_membre ON public.org_storage;
REVOKE INSERT ON public.org_storage FROM anon, authenticated;

-- ── 3. Historique du coffre ─────────────────────────────────────────────────
-- Pas de clé étrangère vers organisations : l'historique doit survivre à tout.
CREATE TABLE IF NOT EXISTS public.org_storage_historique (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id     uuid        NOT NULL,
  version    bigint,
  data       jsonb       NOT NULL,
  updated_by uuid,
  sauve_le   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_storage_historique IS
  'CYNA — copies des anciennes versions du coffre org_storage. Écrites uniquement par le trigger org_storage_historique_apres_ecriture. Lecture par les membres de l''organisation. Copies de plus de 90 jours purgées à chaque écriture.';

CREATE INDEX IF NOT EXISTS org_storage_historique_org_sauve_le
  ON public.org_storage_historique (org_id, sauve_le);

ALTER TABLE public.org_storage_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_storage_historique_select_membre ON public.org_storage_historique;
CREATE POLICY org_storage_historique_select_membre
  ON public.org_storage_historique
  FOR SELECT
  TO authenticated
  USING (public.est_membre(org_id));

REVOKE ALL ON public.org_storage_historique FROM anon, authenticated;
GRANT SELECT ON public.org_storage_historique TO authenticated;

CREATE OR REPLACE FUNCTION public.org_storage_historiser()
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
      INSERT INTO public.org_storage_historique (org_id, version, data, updated_by)
      VALUES (OLD.org_id, OLD.version, COALESCE(OLD.data, '{}'::jsonb), OLD.updated_by);
    ELSIF NEW.data IS DISTINCT FROM OLD.data THEN
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
        FROM public.org_storage_historique AS h
       WHERE h.org_id = OLD.org_id;

      IF retrait OR derniere IS NULL OR derniere < now() - interval '5 minutes' THEN
        INSERT INTO public.org_storage_historique (org_id, version, data, updated_by)
        VALUES (OLD.org_id, OLD.version, COALESCE(OLD.data, '{}'::jsonb), OLD.updated_by);
      END IF;
    END IF;

    DELETE FROM public.org_storage_historique AS h
     WHERE h.org_id = OLD.org_id
       AND h.sauve_le < now() - interval '90 days';
  EXCEPTION
    WHEN query_canceled THEN
      RAISE WARNING 'org_storage_historiser annulé (%) — sauvegarde conservée', SQLERRM;
    WHEN OTHERS THEN
      RAISE WARNING 'org_storage_historiser a échoué (% : %) — sauvegarde conservée', SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.org_storage_historiser() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS org_storage_historique_apres_ecriture ON public.org_storage;
CREATE TRIGGER org_storage_historique_apres_ecriture
  AFTER UPDATE OR DELETE ON public.org_storage
  FOR EACH ROW
  EXECUTE FUNCTION public.org_storage_historiser();

-- ── 4. Temps réel ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'org_storage'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_storage;
  END IF;
END;
$$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manuel uniquement) — supprime l'historique du coffre ET son contenu.
-- ────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS org_storage_historique_apres_ecriture ON public.org_storage;
-- DROP FUNCTION IF EXISTS public.org_storage_historiser();
-- DROP TABLE IF EXISTS public.org_storage_historique;
-- DROP TRIGGER IF EXISTS org_storage_version_garde ON public.org_storage;
-- DROP FUNCTION IF EXISTS public.org_storage_verifier_version();
-- ALTER TABLE public.org_storage DROP COLUMN IF EXISTS version;
-- GRANT INSERT ON public.org_storage TO authenticated;
-- CREATE POLICY org_storage_insert_membre ON public.org_storage FOR INSERT TO authenticated
--   WITH CHECK (public.est_membre(org_id));
-- -- Seulement si on veut retirer le temps réel :
-- -- ALTER PUBLICATION supabase_realtime DROP TABLE public.org_storage;
-- COMMIT;
-- ════════════════════════════════════════════════════════════════════════════
