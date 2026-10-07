-- STAGING UNIQUEMENT : jamais exécuté par le builder. Tout est annulé.
BEGIN;
CREATE TEMP TABLE _params ON COMMIT DROP AS
SELECT '00000000-0000-0000-0000-00000000000a'::uuid AS compte1,
       '00000000-0000-0000-0000-00000000000b'::uuid AS compte2;
DO $$
DECLARE
  c1 uuid; c2 uuid;
  j date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  debut date := date_trunc('month', j::timestamp)::date;
  r jsonb; n bigint; total bigint; i integer; interdit boolean; requete text;
BEGIN
  IF to_regclass('public.ia_limites') IS NULL OR to_regclass('public.ia_consommation') IS NULL
     OR to_regprocedure('public.ia_reserver_appel()') IS NULL THEN
    RAISE EXCEPTION 'ÉCHEC : migration plafond IA non appliquée';
  END IF;
  SELECT compte1, compte2 INTO c1, c2 FROM _params;
  IF c1::text LIKE '00000000-0000-0000-0000-00000000000%' OR c2::text LIKE '00000000-0000-0000-0000-00000000000%' OR c1 = c2 THEN
    RAISE EXCEPTION 'ÉCHEC : renseigner deux UUID distincts de comptes de test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = c1) OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = c2) THEN
    RAISE EXCEPTION 'ÉCHEC : comptes de test inexistants';
  END IF;
  -- Même verrou que les réservations, pour stabiliser le total durant le script.
  PERFORM pg_advisory_xact_lock(20261007120000::bigint);
  DELETE FROM public.ia_consommation WHERE user_id IN (c1, c2) AND jour = j;
  SELECT COALESCE(sum(appels), 0) INTO total FROM public.ia_consommation WHERE jour >= debut;
  UPDATE public.ia_limites SET appels_par_utilisateur_jour = 3, appels_compte_mois = total + 4;
  IF NOT FOUND THEN RAISE EXCEPTION 'ÉCHEC : ligne de configuration absente'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR i IN 1..3 LOOP
    r := public.ia_reserver_appel();
    SELECT appels INTO n FROM public.ia_consommation WHERE user_id = c1 AND jour = j;
    IF r->>'autorise' IS DISTINCT FROM 'true' OR n IS DISTINCT FROM i::bigint THEN
      RAISE EXCEPTION 'ÉCHEC : incrément appel % : %, compteur %', i, r, n;
    END IF;
    RAISE NOTICE 'OK incrément appel %', i;
  END LOOP;
  r := public.ia_reserver_appel();
  SELECT appels INTO n FROM public.ia_consommation WHERE user_id = c1 AND jour = j;
  IF r->>'raison' IS DISTINCT FROM 'plafond_jour' OR r->>'autorise' IS DISTINCT FROM 'false' OR n <> 3 THEN
    RAISE EXCEPTION 'ÉCHEC : plafond jour ou compteur';
  END IF;
  RAISE NOTICE 'OK plafond jour sans incrément';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.ia_consommation WHERE user_id = c1;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC : compte 2 voit compte 1'; END IF;
  r := public.ia_reserver_appel();
  SELECT appels INTO n FROM public.ia_consommation WHERE user_id = c2 AND jour = j;
  IF r->>'autorise' IS DISTINCT FROM 'true' OR n IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION 'ÉCHEC : compteur propre compte 2';
  END IF;
  RAISE NOTICE 'OK isolation et compteur propre compte 2';
  r := public.ia_reserver_appel();
  SELECT appels INTO n FROM public.ia_consommation WHERE user_id = c2 AND jour = j;
  IF r->>'raison' IS DISTINCT FROM 'plafond_mois' OR r->>'autorise' IS DISTINCT FROM 'false' OR n <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : plafond mois ou compteur';
  END IF;
  EXECUTE 'RESET ROLE';
  SELECT COALESCE(sum(appels), 0) INTO n FROM public.ia_consommation WHERE jour >= debut;
  IF n <> total + 4 THEN RAISE EXCEPTION 'ÉCHEC : total mensuel global'; END IF;
  RAISE NOTICE 'OK plafond mensuel global sans incrément';
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOREACH requete IN ARRAY ARRAY[
    format('INSERT INTO public.ia_consommation VALUES (%L, %L, 1)', c2, j + 1),
    'UPDATE public.ia_consommation SET appels = appels + 1',
    'DELETE FROM public.ia_consommation',
    'TRUNCATE public.ia_consommation',
    'SELECT * FROM public.ia_limites',
    'UPDATE public.ia_limites SET appels_compte_mois = 99999'
  ] LOOP
    interdit := false;
    BEGIN EXECUTE requete;
    EXCEPTION WHEN insufficient_privilege THEN interdit := true; END;
    IF NOT interdit THEN RAISE EXCEPTION 'ÉCHEC : opération permise : %', requete; END IF;
    RAISE NOTICE 'OK opération interdite : %', requete;
  END LOOP;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  EXECUTE 'SET LOCAL ROLE anon';
  interdit := false;
  BEGIN PERFORM public.ia_reserver_appel();
  EXCEPTION WHEN insufficient_privilege THEN interdit := true; END;
  IF NOT interdit THEN RAISE EXCEPTION 'ÉCHEC : anon peut réserver'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'OK anon ne peut pas réserver';
  RAISE EXCEPTION 'TOUS LES TESTS OK (rollback volontaire)';
END;
$$;
ROLLBACK;
