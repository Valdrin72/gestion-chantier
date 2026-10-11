/**
 * Migration E1 « anti-écrasement du coffre org_storage » — contrôle statique du fichier SQL.
 * Elle est exécutée sur staging puis vérifiée par supabase/tests/org_storage_version_staging.sql ;
 * ce test garantit que les protections exigées sont présentes et qu'aucune instruction
 * destructive n'y figure hors commentaires.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const brut = readFileSync('supabase/migrations/20261011120000_e1_org_storage_version.sql', 'utf8');
const code = brut.split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n').toLowerCase().replace(/\s+/g, ' ');
const entre = (debut, fin) => code.slice(code.indexOf(debut), code.indexOf(fin));
const garde = entre('create or replace function public.org_storage_verifier_version', 'drop trigger if exists org_storage_version_garde');
const historiser = entre('create or replace function public.org_storage_historiser', 'revoke all on function public.org_storage_historiser');

describe('migration E1 — structure', () => {
  it('une seule transaction, ROLLBACK seulement en commentaire', () => {
    expect(code.trim().startsWith('begin;')).toBe(true);
    expect(code.trim().endsWith('commit;')).toBe(true);
    expect(code.match(/\bbegin;/g)).toHaveLength(1);
    expect(code.match(/\bcommit;/g)).toHaveLength(1);
    expect(brut).toMatch(/^-- DROP TABLE IF EXISTS public\.org_storage_historique;/m);
  });
  it('rien de destructif : seules suppressions = politique INSERT retirée et rétention 90 jours de l\'historique', () => {
    expect(code).not.toMatch(/drop\s+(table|schema|function|column)/);
    expect(code.match(/drop policy if exists [a-z_]+/g)).toEqual([
      'drop policy if exists org_storage_insert_membre',
      'drop policy if exists org_storage_historique_select_membre',
    ]);
    expect(code).not.toMatch(/truncate|delete from public\.org_storage\b(?!_)/);
    expect(code.match(/delete from [a-z_.]+/g)).toEqual(['delete from public.org_storage_historique']);
    expect(code).toMatch(/delete from public\.org_storage_historique as h where h\.org_id = old\.org_id and h\.sauve_le < now\(\) - interval '90 days'/);
    expect(code).not.toMatch(/update public\.org_storage\b/);
  });
});

describe('migration E1 — anti-écrasement', () => {
  it('colonne version et trigger BEFORE UPDATE qui exige ancienne version + 1 (P0409)', () => {
    expect(code).toMatch(/alter table public\.org_storage add column if not exists version bigint not null default 0/);
    expect(code).toMatch(/create trigger org_storage_version_garde before update on public\.org_storage for each row execute function public\.org_storage_verifier_version\(\)/);
    expect(garde).toMatch(/if new\.version is distinct from old\.version \+ 1 then raise exception using errcode = 'p0409'/);
    expect(garde).toMatch(/if new\.org_id is distinct from old\.org_id then raise exception using errcode = 'p0409'/);
    expect(garde).toMatch(/security invoker set search_path = ''/);
  });
  it('auteur et date posés par le serveur, pas par le navigateur', () => {
    expect(garde).toMatch(/new\.updated_at := now\(\)/);
    expect(garde).toMatch(/new\.updated_by := coalesce\(auth\.uid\(\), new\.updated_by\)/);
  });
  it('l\'application ne peut plus créer le coffre (ni politique ni droit INSERT)', () => {
    expect(code).toMatch(/drop policy if exists org_storage_insert_membre on public\.org_storage/);
    expect(code).toMatch(/revoke insert on public\.org_storage from anon, authenticated/);
    expect(code).not.toMatch(/grant [^;]*insert[^;]* on public\.org_storage /);
    expect(code).not.toMatch(/create policy [a-z_]+ on public\.org_storage for (insert|delete|all)/);
  });
});

describe('migration E1 — historique du coffre', () => {
  it('table lisible par les membres seulement, aucune écriture utilisateur', () => {
    expect(code).toMatch(/create table if not exists public\.org_storage_historique/);
    expect(code).toMatch(/create index if not exists org_storage_historique_org_sauve_le on public\.org_storage_historique \(org_id, sauve_le\)/);
    expect(code).toMatch(/alter table public\.org_storage_historique enable row level security/);
    expect(code).toMatch(/create policy org_storage_historique_select_membre on public\.org_storage_historique for select to authenticated using \(public\.est_membre\(org_id\)\)/);
    expect(code).toMatch(/revoke all on public\.org_storage_historique from anon, authenticated/);
    expect(code).toMatch(/grant select on public\.org_storage_historique to authenticated/);
    expect(code).not.toMatch(/grant (insert|update|delete|all)[^;]*org_storage_historique/);
  });
  it('trigger AFTER UPDATE OR DELETE, même règle que devis_historique, jamais bloquant', () => {
    expect(code).toMatch(/create trigger org_storage_historique_apres_ecriture after update or delete on public\.org_storage for each row execute function public\.org_storage_historiser\(\)/);
    expect(historiser).toMatch(/security definer set search_path = '' set lock_timeout = '2s'/);
    expect(historiser).toMatch(/if tg_op = 'delete' then insert into public\.org_storage_historique/);
    expect(historiser).toMatch(/array\['devis', 'chantiers', 'clients', 'factures', 'pointages'\]/);
    expect(historiser).toMatch(/derniere < now\(\) - interval '5 minutes'/);
    expect(historiser).toMatch(/exception when query_canceled then raise warning .* when others then raise warning/);
    expect(code).toMatch(/revoke all on function public\.org_storage_historiser\(\) from public, anon, authenticated/);
  });
  it('temps réel ajouté seulement si absent', () => {
    expect(code).toMatch(/not exists \( select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'org_storage' \) then alter publication supabase_realtime add table public\.org_storage/);
  });
});
