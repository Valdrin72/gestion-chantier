-- ════════════════════════════════════════════════════════════════════════════
-- TEST — historique des sauvegardes (STAGING UNIQUEMENT)
-- ────────────────────────────────────────────────────────────────────────────
-- À lancer dans l'éditeur SQL de Supabase STAGING, APRÈS la migration
-- 20261006120000_historique_sauvegardes.sql.
--
-- Tout se passe dans UNE transaction terminée par ROLLBACK : aucune trace ne reste.
-- 1. Remplacer les deux UUID ci-dessous par deux comptes de test de staging.
-- 2. Exécuter tout le script.
-- 3. Résultat attendu dans les messages : une série « OK … » puis « TOUS LES TESTS OK ».
--    Le moindre échec lève une exception « ÉCHEC … » et arrête le script.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _params ON COMMIT DROP AS
SELECT '00000000-0000-0000-0000-00000000000a'::uuid AS compte1,   -- ← UUID du compte de test 1
       '00000000-0000-0000-0000-00000000000b'::uuid AS compte2;   -- ← UUID du compte de test 2

DO $$
DECLARE
  c1 uuid; c2 uuid;
  rid text;              -- id de la ligne de stockage (type quelconque, lu en texte)
  n0 bigint; n bigint; nb bigint;
  id_version bigint;
  liste jsonb;
  ok boolean;
  base jsonb := jsonb_build_object(
    'devis',     '[{"id":"T1","numero":"T-001"},{"id":"T2","numero":"T-002"},{"id":"T3","numero":"T-003"},{"id":"T4","numero":"T-004"},{"id":"T5","numero":"T-005"}]'::jsonb,
    'chantiers', '[]'::jsonb, 'clients', '[{"id":"C1"},{"id":"C2"}]'::jsonb,
    'factures',  '[]'::jsonb, 'pointages', '[]'::jsonb, 'parametres', '{}'::jsonb);
BEGIN
  SELECT p.compte1, p.compte2 INTO c1, c2 FROM _params p;
  IF c1::text LIKE '00000000-0000-0000-0000-00000000000%' OR c2::text LIKE '00000000-0000-0000-0000-00000000000%' THEN
    RAISE EXCEPTION 'ÉCHEC : renseigner les deux UUID de comptes de test dans _params';
  END IF;
  IF to_regclass('public.devis_historique') IS NULL THEN
    RAISE EXCEPTION 'ÉCHEC : migration non appliquée (public.devis_historique absente)';
  END IF;

  -- Ligne de stockage du compte 1 (créée si absente) avec un blob de test connu.
  SELECT id::text INTO rid FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  IF rid IS NULL THEN
    INSERT INTO public.devis (user_id, numero, data) VALUES (c1, '__cyna_storage__', base) RETURNING id::text INTO rid;
  ELSE
    UPDATE public.devis SET data = base, version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  END IF;

  -- (i) 3 enregistrements qui retirent chacun un devis → 3 versions dans l'historique,
  --     même en moins de 5 minutes.
  SELECT count(*) INTO n0 FROM public.devis_historique WHERE user_id = c1;
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', (data->'devis') - 0), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', (data->'devis') - 0), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', (data->'devis') - 0), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  SELECT count(*) INTO n FROM public.devis_historique WHERE user_id = c1;
  IF n - n0 <> 3 THEN RAISE EXCEPTION 'ÉCHEC (i) : % nouvelle(s) version(s) au lieu de 3', n - n0; END IF;
  SELECT count(DISTINCT version) INTO nb FROM (SELECT version FROM public.devis_historique WHERE user_id = c1 ORDER BY id DESC LIMIT 3) v;
  IF nb <> 3 THEN RAISE EXCEPTION 'ÉCHEC (i) : les 3 copies n''ont pas 3 versions distinctes'; END IF;
  RAISE NOTICE 'OK (i) 3 enregistrements → 3 versions dans l''historique';

  -- (v) 2 enregistrements SANS retrait, juste après une copie → aucune nouvelle copie.
  SELECT count(*) INTO n0 FROM public.devis_historique WHERE user_id = c1;
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', (data->'devis') || '[{"id":"T6"}]'::jsonb), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', (data->'devis') || '[{"id":"T7"}]'::jsonb), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  SELECT count(*) INTO n FROM public.devis_historique WHERE user_id = c1;
  IF n <> n0 THEN RAISE EXCEPTION 'ÉCHEC (v) : règle des 5 minutes non respectée (% copie(s))', n - n0; END IF;
  RAISE NOTICE 'OK (v) pas de copie supplémentaire en moins de 5 minutes sans retrait';

  -- (vii) Remplacement à longueur égale (un client remplacé par un autre) → copie.
  SELECT count(*) INTO n0 FROM public.devis_historique WHERE user_id = c1;
  UPDATE public.devis SET data = jsonb_set(data, '{clients}', '[{"id":"C1"},{"id":"C9"}]'::jsonb), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  SELECT count(*) INTO n FROM public.devis_historique WHERE user_id = c1;
  IF n - n0 <> 1 THEN RAISE EXCEPTION 'ÉCHEC (vii) : remplacement à longueur égale non copié'; END IF;
  RAISE NOTICE 'OK (vii) remplacement à longueur égale copié';

  -- (ix) Listes mal formées : devis = null puis {} → historisé sans erreur.
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', 'null'::jsonb), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  UPDATE public.devis SET data = jsonb_set(data, '{devis}', '{}'::jsonb), version = version + 1 WHERE user_id = c1 AND numero = '__cyna_storage__';
  -- Requête (a) du guide sur toutes les versions (ne doit pas planter).
  PERFORM h.id, jsonb_array_length(CASE WHEN jsonb_typeof(h.data->'devis') = 'array' THEN h.data->'devis' ELSE '[]'::jsonb END)
     FROM public.devis_historique h WHERE h.user_id = c1;
  RAISE NOTICE 'OK (ix) listes mal formées sans erreur';

  -- (vi) Requête (b) du guide : retrouver le devis T1 (retiré en (i)) dans une ancienne version.
  SELECT h.id INTO id_version
    FROM public.devis_historique h,
         jsonb_array_elements(CASE WHEN jsonb_typeof(h.data->'devis') = 'array' THEN h.data->'devis' ELSE '[]'::jsonb END) d
   WHERE h.user_id = c1 AND d->>'id' = 'T1'
   ORDER BY h.sauve_le DESC, h.id DESC LIMIT 1;
  IF id_version IS NULL THEN RAISE EXCEPTION 'ÉCHEC (vi) : devis T1 introuvable dans l''historique'; END IF;
  RAISE NOTICE 'OK (vi) devis retiré retrouvé dans la version %', id_version;

  -- (viii) Restauration (c) avec copie explicite, alors qu'une copie a moins de 5 minutes.
  SELECT count(*) INTO n0 FROM public.devis_historique WHERE user_id = c1;
  PERFORM 1 FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__' FOR UPDATE;
  INSERT INTO public.devis_historique (devis_id, user_id, version, data)
  SELECT id, user_id, version, data FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  -- Frontière de compte : la même restauration en visant le compte 2 avec une version du
  -- compte 1 ne doit RIEN modifier.
  WITH ancien AS (
    SELECT d FROM public.devis_historique h,
         jsonb_array_elements(CASE WHEN jsonb_typeof(h.data->'devis') = 'array' THEN h.data->'devis' ELSE '[]'::jsonb END) d
     WHERE h.id = id_version AND h.user_id = c2 AND d->>'id' = 'T1'
  )
  UPDATE public.devis s SET data = s.data, version = s.version + 1
   WHERE s.user_id = c2 AND s.numero = '__cyna_storage__' AND EXISTS (SELECT 1 FROM ancien);
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb <> 0 THEN RAISE EXCEPTION 'ÉCHEC (viii) : une version du compte 1 a servi à restaurer le compte 2'; END IF;
  WITH ancien AS (
    SELECT d FROM public.devis_historique h,
         jsonb_array_elements(CASE WHEN jsonb_typeof(h.data->'devis') = 'array' THEN h.data->'devis' ELSE '[]'::jsonb END) d
     WHERE h.id = id_version AND h.user_id = c1 AND d->>'id' = 'T1'
  )
  UPDATE public.devis s
     SET data = jsonb_set(s.data, '{devis}',
           (SELECT coalesce(jsonb_agg(x), '[]'::jsonb)
              FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.data->'devis') = 'array' THEN s.data->'devis' ELSE '[]'::jsonb END) x
             WHERE x->>'id' IS DISTINCT FROM 'T1')
           || (SELECT jsonb_agg(d) FROM ancien)),
         version = s.version + 1
   WHERE s.user_id = c1 AND s.numero = '__cyna_storage__' AND EXISTS (SELECT 1 FROM ancien);
  SELECT count(*) INTO nb FROM public.devis s, jsonb_array_elements(s.data->'devis') x
   WHERE s.user_id = c1 AND s.numero = '__cyna_storage__' AND x->>'id' = 'T1';
  IF nb <> 1 THEN RAISE EXCEPTION 'ÉCHEC (viii) : devis T1 non restauré (% occurrence(s))', nb; END IF;
  SELECT count(*) INTO n FROM public.devis_historique WHERE user_id = c1;
  IF n - n0 < 1 THEN RAISE EXCEPTION 'ÉCHEC (viii) : état d''avant restauration non copié'; END IF;
  RAISE NOTICE 'OK (viii) restauration d''un devis avec copie de l''état d''avant';

  -- (iv) Historique cassé : contrainte qui refuse toute nouvelle copie → la sauvegarde passe.
  ALTER TABLE public.devis_historique ADD CONSTRAINT _test_casse CHECK (false) NOT VALID;
  UPDATE public.devis SET data = jsonb_set(data, '{clients}', '[]'::jsonb), version = version + 1   -- retrait → copie tentée
   WHERE user_id = c1 AND numero = '__cyna_storage__';
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb <> 1 THEN RAISE EXCEPTION 'ÉCHEC (iv) : la sauvegarde a échoué avec un historique cassé'; END IF;
  ALTER TABLE public.devis_historique DROP CONSTRAINT _test_casse;
  RAISE NOTICE 'OK (iv) sauvegarde réussie malgré un historique cassé';

  -- (ii) / (iii) Droits des utilisateurs (rôle authenticated simulé).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO nb FROM public.devis_historique WHERE user_id = c1;
  IF nb <> 0 THEN RAISE EXCEPTION 'ÉCHEC (ii) : le compte 2 voit % ligne(s) de l''historique du compte 1', nb; END IF;
  RAISE NOTICE 'OK (ii) le compte 2 ne voit pas l''historique du compte 1';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.devis_historique WHERE user_id = c1;
  IF nb = 0 THEN RAISE EXCEPTION 'ÉCHEC (ii) : le compte 1 ne voit pas son propre historique'; END IF;
  ok := false;
  BEGIN INSERT INTO public.devis_historique (devis_id, user_id, version, data) VALUES (NULL, c1, 0, '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'ÉCHEC (iii) : un utilisateur peut écrire dans l''historique'; END IF;
  ok := false;
  BEGIN UPDATE public.devis_historique SET data = '{}'::jsonb WHERE user_id = c1;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'ÉCHEC (iii) : un utilisateur peut modifier l''historique'; END IF;
  ok := false;
  BEGIN DELETE FROM public.devis_historique WHERE user_id = c1;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'ÉCHEC (iii) : un utilisateur peut supprimer l''historique'; END IF;
  ok := false;
  BEGIN EXECUTE 'TRUNCATE public.devis_historique';
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'ÉCHEC (iii) : TRUNCATE permis à un utilisateur'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'OK (iii) aucun droit d''écriture, de suppression ni de TRUNCATE pour un utilisateur';

  -- (x) Suppression : copie toujours, (a) juste après une copie récente, (b) sur une ligne
  --     fraîchement insérée et jamais mise à jour.
  SELECT count(*) INTO n0 FROM public.devis_historique WHERE user_id = c1;
  DELETE FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  SELECT count(*) INTO n FROM public.devis_historique WHERE user_id = c1;
  IF n - n0 <> 1 THEN RAISE EXCEPTION 'ÉCHEC (x-a) : suppression non copiée'; END IF;
  INSERT INTO public.devis (user_id, numero, data) VALUES (c1, '__cyna_storage__', base);
  DELETE FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  SELECT count(*) INTO nb FROM public.devis_historique WHERE user_id = c1;
  IF nb - n <> 1 THEN RAISE EXCEPTION 'ÉCHEC (x-b) : suppression d''une ligne jamais mise à jour non copiée'; END IF;
  RAISE NOTICE 'OK (x) toute suppression de la ligne de stockage est copiée';

  -- (xi) Restauration (e) après suppression, sans l'application.
  SELECT h.id INTO id_version FROM public.devis_historique h WHERE h.user_id = c1 ORDER BY h.id DESC LIMIT 1;
  -- Frontière de compte : viser le compte 2 avec une version du compte 1 n'insère rien.
  INSERT INTO public.devis (user_id, numero, data, version)
  SELECT h.user_id, '__cyna_storage__', h.data, 0 FROM public.devis_historique h WHERE h.id = id_version AND h.user_id = c2;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb <> 0 THEN RAISE EXCEPTION 'ÉCHEC (xi) : une version du compte 1 a été restaurée pour le compte 2'; END IF;
  INSERT INTO public.devis (user_id, numero, data, version)
  SELECT h.user_id, '__cyna_storage__', h.data, 0 FROM public.devis_historique h WHERE h.id = id_version AND h.user_id = c1;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb <> 1 THEN RAISE EXCEPTION 'ÉCHEC (xi) : % ligne(s) restaurée(s) au lieu de 1', nb; END IF;
  SELECT count(*) INTO nb FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  IF nb <> 1 THEN RAISE EXCEPTION 'ÉCHEC (xi) : % ligne(s) de stockage après restauration', nb; END IF;
  SELECT data->'devis' INTO liste FROM public.devis WHERE user_id = c1 AND numero = '__cyna_storage__';
  IF liste IS DISTINCT FROM base->'devis' THEN RAISE EXCEPTION 'ÉCHEC (xi) : blob restauré inattendu'; END IF;
  ok := false;
  BEGIN
    INSERT INTO public.devis (user_id, numero, data, version)
    SELECT h.user_id, '__cyna_storage__', h.data, 0 FROM public.devis_historique h WHERE h.id = id_version AND h.user_id = c1;
  EXCEPTION WHEN unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'ÉCHEC (xi) : un second rétablissement n''est pas refusé par l''index unique'; END IF;
  RAISE NOTICE 'OK (xi) ligne supprimée restaurée depuis l''historique, doublon refusé';

  RAISE NOTICE 'TOUS LES TESTS OK';
END;
$$;

ROLLBACK;
