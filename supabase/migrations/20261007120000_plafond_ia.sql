-- Plafond IA : à appliquer manuellement, jamais par le builder.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ia_limites (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  appels_par_utilisateur_jour integer NOT NULL DEFAULT 60 CHECK (appels_par_utilisateur_jour >= 0),
  appels_compte_mois integer NOT NULL DEFAULT 1500 CHECK (appels_compte_mois >= 0),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ia_limites (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.ia_limites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ia_limites FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ia_limites TO service_role;

-- Sans FK : conserver la consommation facturée des comptes supprimés.
CREATE TABLE IF NOT EXISTS public.ia_consommation (
  user_id uuid NOT NULL,
  jour date NOT NULL,
  appels integer NOT NULL DEFAULT 0 CHECK (appels >= 0),
  PRIMARY KEY (user_id, jour)
);
ALTER TABLE public.ia_consommation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ia_consommation_lecture_proprietaire ON public.ia_consommation;
CREATE POLICY ia_consommation_lecture_proprietaire ON public.ia_consommation
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.ia_consommation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ia_consommation TO authenticated;

CREATE OR REPLACE FUNCTION public.ia_reserver_appel() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_jour date := (pg_catalog.now() AT TIME ZONE 'Europe/Zurich')::date;
  v_debut_mois date := pg_catalog.date_trunc('month', v_jour::timestamp)::date;
  v_limites public.ia_limites%ROWTYPE;
  v_total bigint;
  v_appels integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('autorise', false, 'raison', 'non_authentifie');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(20261007120000::bigint);
  SELECT * INTO v_limites FROM public.ia_limites WHERE id = true;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('autorise', false, 'raison', 'configuration');
  END IF;
  SELECT COALESCE(pg_catalog.sum(appels), 0) INTO v_total
    FROM public.ia_consommation WHERE jour >= v_debut_mois;
  IF v_total >= v_limites.appels_compte_mois THEN
    RETURN pg_catalog.jsonb_build_object('autorise', false, 'raison', 'plafond_mois');
  END IF;
  SELECT appels INTO v_appels FROM public.ia_consommation WHERE user_id = v_user AND jour = v_jour;
  IF COALESCE(v_appels, 0) >= v_limites.appels_par_utilisateur_jour THEN
    RETURN pg_catalog.jsonb_build_object('autorise', false, 'raison', 'plafond_jour');
  END IF;
  INSERT INTO public.ia_consommation AS consommation (user_id, jour, appels)
    VALUES (v_user, v_jour, 1)
    ON CONFLICT (user_id, jour) DO UPDATE SET appels = consommation.appels + 1
    RETURNING appels INTO v_appels;
  RETURN pg_catalog.jsonb_build_object('autorise', true, 'raison', 'ok',
    'appels_jour', v_appels, 'plafond_jour', v_limites.appels_par_utilisateur_jour);
END;
$$;
REVOKE ALL ON FUNCTION public.ia_reserver_appel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ia_reserver_appel() TO authenticated;
COMMIT;

-- ROLLBACK manuel (destructif) :
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.ia_reserver_appel();
-- DROP TABLE IF EXISTS public.ia_consommation;
-- DROP TABLE IF EXISTS public.ia_limites;
-- COMMIT;
