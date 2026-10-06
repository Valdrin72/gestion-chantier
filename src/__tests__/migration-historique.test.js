/**
 * Migration « historique des sauvegardes » — contrôle statique du fichier SQL.
 *
 * La migration ne peut pas être exécutée ici (pas de base locale) : elle est appliquée sur
 * staging par le propriétaire puis testée par supabase/tests/historique_staging.sql et
 * e2e/historique.spec.mjs. Ce test garantit que les protections exigées sont présentes dans
 * le fichier et qu'aucune instruction destructive n'y figure hors commentaires.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FICHIER = 'supabase/migrations/20261006120000_historique_sauvegardes.sql';
const brut = readFileSync(FICHIER, 'utf8');
// Code SQL sans les commentaires de ligne, en minuscules et espaces normalisés.
const code = brut.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n').toLowerCase().replace(/\s+/g, ' ');
const fonction = code.slice(code.indexOf('create or replace function public.devis_historiser'), code.indexOf('create trigger devis_historique_apres_ecriture'));
const blocPolitiques = code.slice(code.indexOf("foreach t in array array['devis', 'chantiers', 'clients', 'factures']"));

describe('migration historique — structure', () => {
  it('une seule transaction, ROLLBACK seulement en commentaire', () => {
    expect(code.trim().startsWith('begin;')).toBe(true);
    expect(code.trim().endsWith('commit;')).toBe(true);
    expect(code.match(/\bbegin;/g)).toHaveLength(1);
    expect(code.match(/\bcommit;/g)).toHaveLength(1);
    expect(brut).toMatch(/^-- DROP TABLE IF EXISTS public\.devis_historique;/m);
  });

  it('aucune instruction destructive hors commentaires (sauf la rétention de 90 jours de l’historique)', () => {
    expect(code).not.toMatch(/drop\s+(table|policy|schema|function)/);
    expect(code).not.toMatch(/alter\s+policy/);
    expect(code).not.toMatch(/\btruncate\s+(table\s+)?public\./);
    const suppressions = code.match(/delete from [a-z_.]+/g) || [];
    expect(suppressions).toEqual(['delete from public.devis_historique']);
    expect(code).toMatch(/delete from public\.devis_historique as h where h\.user_id = old\.user_id and h\.sauve_le < now\(\) - interval '90 days'/);
  });

  it('table d’historique : type de devis_id lu dans le catalogue, user_id uuid vérifié, index (user_id, sauve_le)', () => {
    expect(code).toMatch(/format_type\(a\.atttypid, a\.atttypmod\)/);
    expect(code).toMatch(/create table if not exists public\.devis_historique/);
    expect(code).toMatch(/type_user_id is distinct from 'uuid'/);
    expect(code).toMatch(/create index if not exists devis_historique_user_sauve_le on public\.devis_historique \(user_id, sauve_le\)/);
  });

  it('accès : RLS, lecture par le propriétaire seulement, aucune écriture pour les utilisateurs', () => {
    expect(code).toMatch(/alter table public\.devis_historique enable row level security/);
    expect(code).toMatch(/create policy devis_historique_select_own on public\.devis_historique for select to authenticated using \(auth\.uid\(\) = user_id\)/);
    expect(code).toMatch(/revoke all on public\.devis_historique from anon, authenticated/);
    expect(code).toMatch(/grant select on public\.devis_historique to authenticated/);
    expect(code).not.toMatch(/grant (insert|update|delete|all)[^;]*devis_historique/);
    expect(code).not.toMatch(/create policy [a-z_]+ on public\.devis_historique for (insert|update|delete|all)/);
  });
});

describe('migration historique — fonction et trigger', () => {
  it('SECURITY DEFINER, search_path vide, lock_timeout borné', () => {
    expect(fonction).toMatch(/security definer/);
    expect(fonction).toMatch(/set search_path = ''/);
    expect(fonction).toMatch(/set lock_timeout = '2s'/);
    expect(code).toMatch(/revoke all on function public\.devis_historiser\(\) from public, anon, authenticated/);
  });

  it('la sauvegarde ne peut pas échouer à cause de l’historique (query_canceled + others attrapés, return null)', () => {
    expect(fonction).toMatch(/exception when query_canceled then raise warning/);
    expect(fonction).toMatch(/when others then raise warning/);
    expect(fonction).toMatch(/return null; end;/);
  });

  it('règles de copie : suppression toujours, 5 minutes, retrait par longueur ou identifiant disparu', () => {
    expect(fonction).toMatch(/if tg_op = 'delete' then insert into public\.devis_historique/);
    expect(fonction).toMatch(/new\.data is distinct from old\.data/);
    expect(fonction).toMatch(/derniere < now\(\) - interval '5 minutes'/);
    expect(fonction).toMatch(/retrait or derniere is null or derniere < now\(\)/);
    expect(fonction).toMatch(/jsonb_array_length\(nouvelle\) < jsonb_array_length\(ancienne\)/);
    expect(fonction).toMatch(/except select n ->> 'id'/);
    expect(fonction).toMatch(/array\['devis', 'chantiers', 'clients', 'factures', 'pointages'\]/);
    expect(fonction).toMatch(/case when jsonb_typeof\(old\.data -> cle\) = 'array' then old\.data -> cle else '\[\]'::jsonb end/);
  });

  it('trigger AFTER UPDATE OR DELETE limité à la ligne de stockage', () => {
    expect(code).toMatch(/create trigger devis_historique_apres_ecriture after update or delete on public\.devis for each row when \(old\.numero = '__cyna_storage__'\) execute function public\.devis_historiser\(\)/);
  });
});

describe('migration historique — règles d’accès existantes et TRUNCATE', () => {
  it('politique « propriétaire » créée seulement si la table existe et n’a AUCUNE politique', () => {
    expect(blocPolitiques).toMatch(/if to_regclass\('public\.' \|\| t\) is null then/);
    expect(blocPolitiques).toMatch(/a_politique := exists \(select 1 from pg_policies where schemaname = 'public' and tablename = t\)/);
    // Enchaînement exact : politique existante → seulement un message ; sinon (et seulement
    // si user_id existe) → création de <table>_own.
    expect(blocPolitiques).toMatch(
      /if a_politique then raise notice '[^']*inchangées', t; elsif exists \( select 1 from information_schema\.columns where table_schema = 'public' and table_name = t and column_name = 'user_id' \) then execute format\( 'create policy %i on public\.%i for all to authenticated using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)'/
    );
    expect(blocPolitiques.match(/create policy/g)).toHaveLength(1);
  });

  it('RLS activée seulement si la table a au moins une politique (jamais de table rendue inaccessible)', () => {
    expect(blocPolitiques).toMatch(/if a_politique and not \(select c\.relrowsecurity from pg_class as c/);
  });

  it('TRUNCATE retiré à anon et authenticated, y compris pour les tables futures', () => {
    expect(code).toMatch(/revoke truncate on all tables in schema public from anon, authenticated/);
    expect(code).toMatch(/alter default privileges in schema public revoke truncate on tables from anon, authenticated/);
  });
});
