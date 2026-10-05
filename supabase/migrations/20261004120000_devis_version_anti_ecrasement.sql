-- NE PAS APPLIQUER AUTOMATIQUEMENT — staging d'abord par le patron.
-- Déploiement : migration AVANT le code, puis demander aux 3 utilisateurs
-- de recharger l'app (les anciens clients ne peuvent plus sauvegarder).
-- Sans colonne version, le nouveau client bloque sur l'écran de lecture en erreur.
-- Diagnostic des doublons (choisir manuellement la bonne ligne ; ne rien supprimer ici) :
-- SELECT user_id, array_agg(id), count(*) FROM public.devis
-- WHERE numero = '__cyna_storage__' GROUP BY user_id HAVING count(*) > 1;

BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.devis WHERE numero = '__cyna_storage__'
    GROUP BY user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Doublons cyna_storage : identifier les lignes par user_id et décider manuellement avant migration';
  END IF;
END;
$$;

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.devis_verifier_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.numero = '__cyna_storage__' THEN
    IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0409', MESSAGE = 'conflit de version cyna_storage';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devis_version_garde ON public.devis;
CREATE TRIGGER devis_version_garde BEFORE UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_verifier_version();

CREATE UNIQUE INDEX IF NOT EXISTS devis_storage_un_par_user
ON public.devis (user_id) WHERE numero = '__cyna_storage__';
COMMIT;

-- ROLLBACK (manuel uniquement, désactive la protection des anciens clients) :
-- BEGIN;
-- DROP TRIGGER IF EXISTS devis_version_garde ON public.devis;
-- DROP FUNCTION IF EXISTS public.devis_verifier_version();
-- DROP INDEX IF EXISTS public.devis_storage_un_par_user;
-- ALTER TABLE public.devis DROP COLUMN IF EXISTS version;
-- COMMIT;
