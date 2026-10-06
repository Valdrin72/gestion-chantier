# Restaurer une ancienne version des données CYNA

Ce guide s'applique à `public.devis_historique` (migration `20261006120000_historique_sauvegardes.sql`).

**Où lancer les requêtes** : dans l'éditeur SQL de Supabase. Vérifiez **en haut de l'écran** que vous êtes dans le bon projet (staging ou production).

**Ce que contient l'historique**
- Chaque ligne est une copie complète, à un instant donné, des données d'un compte : le blob `data`, qui contient `devis`, `chantiers`, `clients`, `factures`, `pointages` et `parametres`.
- On y trouve aussi la `version` de la ligne de stockage à ce moment-là, et la date `sauve_le`.

**Règle d'or** : chaque restauration se fait **dans une transaction** (`BEGIN … COMMIT`). On vérifie le résultat **avant** le `COMMIT`, et on fait `ROLLBACK` en cas de doute. Après une restauration, demandez aux utilisateurs de **recharger l'application**. Un appareil resté ouvert sur l'ancienne version verra un conflit, et rien ne sera écrasé.

Dans les requêtes, remplacez `<UUID_COMPTE>`, `<ID_VERSION>` et `<ID_DEVIS>`.

---

## (a) Lister les versions d'un compte

```sql
select h.id as id_version,
       h.version,
       h.sauve_le,
       jsonb_array_length(case when jsonb_typeof(h.data->'devis')     = 'array' then h.data->'devis'     else '[]'::jsonb end) as nb_devis,
       jsonb_array_length(case when jsonb_typeof(h.data->'chantiers') = 'array' then h.data->'chantiers' else '[]'::jsonb end) as nb_chantiers,
       jsonb_array_length(case when jsonb_typeof(h.data->'clients')   = 'array' then h.data->'clients'   else '[]'::jsonb end) as nb_clients,
       jsonb_array_length(case when jsonb_typeof(h.data->'factures')  = 'array' then h.data->'factures'  else '[]'::jsonb end) as nb_factures
  from public.devis_historique h
 where h.user_id = '<UUID_COMPTE>'
 order by h.sauve_le desc;
```

## (b) Retrouver un devis précis dans les anciennes versions

Par identifiant (`<ID_DEVIS>`) ou par numéro (`D-2026-001`) :

```sql
select h.id as id_version, h.version, h.sauve_le, d as devis
  from public.devis_historique h,
       jsonb_array_elements(case when jsonb_typeof(h.data->'devis') = 'array' then h.data->'devis' else '[]'::jsonb end) d
 where h.user_id = '<UUID_COMPTE>'
   and (d->>'id' = '<ID_DEVIS>' or d->>'numero' = 'D-2026-001')
 order by h.sauve_le desc;
```

Le même principe vaut pour un client, un chantier ou une facture : remplacez `'devis'` par `'clients'`, `'chantiers'` ou `'factures'`.

---

## Avant toute restauration : copier l'état actuel

On **ne compte pas** sur le trigger : la règle des 5 minutes pourrait sauter la copie. Chaque restauration ci-dessous commence donc par verrouiller la ligne actuelle et par la copier explicitement. Une restauration ratée peut ainsi toujours être annulée, à partir de cette copie.

## (c) Restaurer UN devis, sans toucher au reste

Cette procédure remplace le devis s'il existe encore, ou le rajoute s'il a disparu. Tout le reste du blob est conservé.

```sql
begin;

-- 1. Verrouiller la ligne actuelle et la copier dans l'historique
select id, version from public.devis
 where user_id = '<UUID_COMPTE>' and numero = '__cyna_storage__'
 for update;

insert into public.devis_historique (devis_id, user_id, version, data)
select id, user_id, version, data from public.devis
 where user_id = '<UUID_COMPTE>' and numero = '__cyna_storage__';

-- 2. Contrôle de compte : la version <ID_VERSION> doit appartenir à <UUID_COMPTE>.
--    Si cette requête ne renvoie PAS « true », faire rollback; (mauvaise version ou mauvais compte).
select exists (select 1 from public.devis_historique h
                where h.id = <ID_VERSION> and h.user_id = '<UUID_COMPTE>') as version_du_bon_compte;

-- 3. Remettre le devis tel qu'il était dans la version <ID_VERSION>
--    (la condition h.user_id empêche de copier un devis venant d'un AUTRE compte)
with ancien as (
  select d from public.devis_historique h,
       jsonb_array_elements(case when jsonb_typeof(h.data->'devis') = 'array' then h.data->'devis' else '[]'::jsonb end) d
   where h.id = <ID_VERSION> and h.user_id = '<UUID_COMPTE>' and d->>'id' = '<ID_DEVIS>'
)
update public.devis s
   set data = jsonb_set(
         s.data, '{devis}',
         (select coalesce(jsonb_agg(x), '[]'::jsonb)
            from jsonb_array_elements(case when jsonb_typeof(s.data->'devis') = 'array' then s.data->'devis' else '[]'::jsonb end) x
           where x->>'id' is distinct from '<ID_DEVIS>')
         || (select jsonb_agg(d) from ancien)),
       version = s.version + 1          -- OBLIGATOIRE (trigger devis_version_garde)
 where s.user_id = '<UUID_COMPTE>' and s.numero = '__cyna_storage__'
   and exists (select 1 from ancien);

-- 4. Vérifier : l'UPDATE a modifié 1 ligne (0 = mauvaise version / mauvais compte → rollback;)
--    et le devis est là, exactement une fois
select count(*) as nb
  from public.devis s,
       jsonb_array_elements(s.data->'devis') x
 where s.user_id = '<UUID_COMPTE>' and s.numero = '__cyna_storage__' and x->>'id' = '<ID_DEVIS>';

commit;   -- ou rollback; si le résultat n'est pas celui attendu
```

## (d) Restaurer un blob ENTIER (dernier recours)

Cette procédure remplace **toutes** les données du compte par la version choisie, ce qui efface tout ce qui a été saisi après.

```sql
begin;
select id, version from public.devis
 where user_id = '<UUID_COMPTE>' and numero = '__cyna_storage__' for update;
insert into public.devis_historique (devis_id, user_id, version, data)
select id, user_id, version, data from public.devis
 where user_id = '<UUID_COMPTE>' and numero = '__cyna_storage__';
update public.devis s
   set data = (select h.data from public.devis_historique h where h.id = <ID_VERSION> and h.user_id = s.user_id),
       version = s.version + 1
 where s.user_id = '<UUID_COMPTE>' and s.numero = '__cyna_storage__'
   and exists (select 1 from public.devis_historique h where h.id = <ID_VERSION> and h.user_id = s.user_id);
-- vérifier, puis :
commit;   -- ou rollback;
```

## (e) La ligne de stockage a été SUPPRIMÉE

La suppression a été copiée automatiquement. On recrée la ligne à partir d'une version, sans ouvrir l'application :

```sql
begin;
insert into public.devis (user_id, numero, data, version)
select h.user_id, '__cyna_storage__', h.data, 0
  from public.devis_historique h
 where h.id = <ID_VERSION>
   and h.user_id = '<UUID_COMPTE>'   -- la version doit appartenir au compte à restaurer
returning id;                      -- doit renvoyer EXACTEMENT 1 ligne (0 = mauvaise version / mauvais compte)
commit;   -- ou rollback;
```

Si l'insertion est refusée pour cause de **doublon** (code 23505), c'est qu'une ligne a été recréée entre-temps, par exemple parce que l'application a été ouverte. Utilisez alors (c) ou (d) sur la ligne existante. Ensuite, demandez aux utilisateurs de recharger l'application.

---

## Test manuel « historique verrouillé »

Ce test vérifie que la sauvegarde passe même si l'historique est bloqué. Il se fait sur **staging uniquement**, avec deux onglets de l'éditeur SQL.

1. **Onglet 1** : `begin; lock table public.devis_historique in access exclusive mode;` (ne pas terminer).
2. **Onglet 2** : une mise à jour du blob de test, `update public.devis set data = data || '{"test_verrou": true}', version = version + 1 where user_id = '<UUID_COMPTE_TEST>' and numero = '__cyna_storage__';`. Elle doit **réussir en environ 2 secondes**, avec un avertissement `devis_historiser a échoué`.
3. **Onglet 1** : `rollback;`
4. **Onglet 2**, pour nettoyer : `update public.devis set data = data - 'test_verrou', version = version + 1 where user_id = '<UUID_COMPTE_TEST>' and numero = '__cyna_storage__';`

## Limites connues

- **Nettoyage des 90 jours** : il n'a lieu qu'au moment d'une sauvegarde du compte. Un compte inactif garde ses anciennes copies jusqu'à sa prochaine sauvegarde.
- **Échec de l'historique** : il n'est signalé que par un avertissement (WARNING) dans les journaux Postgres, sans aucune alerte.
- **Annulation de toute la requête** : si toute la requête de sauvegarde est annulée (délai global, intervention d'un administrateur), ou en cas d'erreur fatale du serveur, la sauvegarde échoue, comme elle l'aurait fait sans historique. L'application la garde alors en « Non enregistré », avec sa copie de secours locale.
