-- ════════════════════════════════════════════════════════════════════════════
-- TEST — E1 anti-écrasement du coffre org_storage (STAGING UNIQUEMENT)
-- ────────────────────────────────────────────────────────────────────────────
-- À lancer dans l'éditeur SQL de Supabase STAGING, APRÈS la migration
-- 20261011120000_e1_org_storage_version.sql.
--
-- Tout se passe dans UNE transaction terminée par ROLLBACK : l'organisation, les membres
-- et le coffre de test disparaissent à la fin, aucune trace ne reste.
-- 1. Indiquer ci-dessous les e-mails de trois comptes de test de staging : deux associés
--    de la même entreprise de test, et un compte extérieur.
-- 2. Exécuter tout le script. Aucune erreur = tous les tests sont passés.
--    Le moindre échec lève une exception « ÉCHEC … » et arrête le script.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE _params ON COMMIT DROP AS
SELECT 'test1@cyna-test.ch'::text AS associe1,
       'test2@cyna-test.ch'::text AS associe2,
       'testb@cyna.test'::text    AS exterieur;
GRANT SELECT ON _params TO authenticated;

DO $$
DECLARE
  a1 uuid; a2 uuid; ext uuid;
  org uuid := gen_random_uuid();
  base jsonb := '{"devis":[{"id":"D1"},{"id":"D2"}],"clients":[{"id":"K1"}],"chantiers":[],"factures":[],"pointages":[],"parametres":{}}'::jsonb;
  n bigint; v bigint; auteur uuid; etat text;

BEGIN
  SELECT u.id INTO a1  FROM auth.users u, _params p WHERE u.email = p.associe1;
  SELECT u.id INTO a2  FROM auth.users u, _params p WHERE u.email = p.associe2;
  SELECT u.id INTO ext FROM auth.users u, _params p WHERE u.email = p.exterieur;
  IF a1 IS NULL OR a2 IS NULL OR ext IS NULL THEN RAISE EXCEPTION 'ÉCHEC : comptes de test introuvables (voir _params)'; END IF;
  IF to_regclass('public.org_storage_historique') IS NULL THEN RAISE EXCEPTION 'ÉCHEC : migration E1 non appliquée'; END IF;

  -- Mise en place (administrateur) : entreprise de test, deux associés, coffre version 0.
  INSERT INTO public.organisations (id, nom) VALUES (org, 'E1 test (rollback)');
  INSERT INTO public.membres (org_id, user_id, role) VALUES (org, a1, 'admin'), (org, a2, 'membre');
  INSERT INTO public.org_storage (org_id, data) VALUES (org, base);

  -- ── Associé 1 ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT version INTO v FROM public.org_storage WHERE org_id = org;
  IF v IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'ÉCHEC 1 : l''associé 1 ne lit pas le coffre en version 0 (%)', v; END IF;

  UPDATE public.org_storage SET data = base || '{"clients":[{"id":"K1"},{"id":"A1"}]}', version = 1, updated_by = ext
   WHERE org_id = org AND version = 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC 2 : écriture version 0 → 1 refusée'; END IF;
  SELECT updated_by INTO auteur FROM public.org_storage WHERE org_id = org;
  IF auteur IS DISTINCT FROM a1 THEN RAISE EXCEPTION 'ÉCHEC 3 : updated_by falsifiable (%)', auteur; END IF;

  -- Même version relue (associé 2 en retard) : refus P0409.
  BEGIN
    UPDATE public.org_storage SET data = base, version = 1 WHERE org_id = org;
    RAISE EXCEPTION 'ÉCHEC 4 : version non incrémentée acceptée';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
  BEGIN
    UPDATE public.org_storage SET data = base, version = 5 WHERE org_id = org;
    RAISE EXCEPTION 'ÉCHEC 5 : saut de version accepté';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
  BEGIN
    UPDATE public.org_storage SET org_id = gen_random_uuid(), version = 2 WHERE org_id = org;
    RAISE EXCEPTION 'ÉCHEC 6 : changement d''organisation accepté';
  EXCEPTION WHEN SQLSTATE 'P0409' OR insufficient_privilege OR check_violation OR foreign_key_violation THEN NULL; END;

  -- Création et suppression interdites à l'application.
  BEGIN
    INSERT INTO public.org_storage (org_id, data) VALUES (gen_random_uuid(), base);
    RAISE EXCEPTION 'ÉCHEC 7 : insert accepté';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.org_storage WHERE org_id = org;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC 8 : suppression du coffre acceptée'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Historique : la version 0 a été copiée ; lisible par l'associé, pas modifiable.
  SELECT count(*) INTO n FROM public.org_storage_historique WHERE org_id = org AND version = 0;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC 9 : version 0 absente de l''historique (%)', n; END IF;
  BEGIN
    DELETE FROM public.org_storage_historique WHERE org_id = org;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC 10 : historique supprimable'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.org_storage_historique (org_id, data) VALUES (org, '{}');
    RAISE EXCEPTION 'ÉCHEC 11 : historique modifiable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- ── Associé 2 : voit la version 1, écrit 1 → 2 ; un retrait déclenche une copie immédiate ──
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT version INTO v FROM public.org_storage WHERE org_id = org;
  IF v IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'ÉCHEC 12 : l''associé 2 ne voit pas la version 1'; END IF;
  UPDATE public.org_storage SET data = base - 'devis' || '{"devis":[{"id":"D1"}]}', version = 2 WHERE org_id = org AND version = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC 13 : écriture de l''associé 2 refusée'; END IF;
  SELECT count(*) INTO n FROM public.org_storage_historique WHERE org_id = org AND version = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC 14 : un devis retiré n''a pas déclenché de copie'; END IF;
  SELECT updated_by INTO auteur FROM public.org_storage WHERE org_id = org;
  IF auteur IS DISTINCT FROM a2 THEN RAISE EXCEPTION 'ÉCHEC 15 : auteur de l''écriture 2 incorrect'; END IF;

  -- ── Compte extérieur : ne voit ni le coffre ni son historique, ne peut rien écrire ──
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ext, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.org_storage WHERE org_id = org;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC 16 : un extérieur voit le coffre'; END IF;
  SELECT count(*) INTO n FROM public.org_storage_historique WHERE org_id = org;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC 17 : un extérieur voit l''historique'; END IF;
  UPDATE public.org_storage SET data = '{}', version = 3 WHERE org_id = org;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC 18 : un extérieur écrit dans le coffre'; END IF;

  PERFORM set_config('role', 'postgres', true);
  SELECT version, data -> 'devis' ->> 0 INTO v, etat FROM public.org_storage WHERE org_id = org;
  IF v <> 2 THEN RAISE EXCEPTION 'ÉCHEC 19 : version finale % au lieu de 2', v; END IF;

  RAISE NOTICE 'TOUS LES TESTS OK';
END;
$$;

ROLLBACK;
