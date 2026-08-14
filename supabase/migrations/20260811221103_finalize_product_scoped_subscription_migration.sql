-- Fix 2: finalize product-scoped subscription coexistence.
--
-- Canonical state for public.subscriptions is one subscription row per
-- (user_id, product_line).  The original 20250601000004 migration created a
-- user-only UNIQUE(user_id) constraint, which blocks a user from holding Meet
-- and Class subscriptions simultaneously even after the product-scoped unique
-- index exists.
--
-- This migration is intentionally forward-only and idempotent for existing
-- databases that may have applied either:
--   - 20260806000001_product_scoped_entitlements.sql, which attempted to drop
--     the conventional subscriptions_user_id_key constraint name, or
--   - 20260806185601_phase2_product_scope_expansion_contract.sql, which added
--     product-scoped uniqueness but explicitly preserved legacy UNIQUE(user_id).
--
-- Product-line NOT NULL / CHECK enforcement is deliberately left for the later
-- product-line contract step.  Fix 2 only removes obsolete user-only uniqueness
-- and guarantees the webhook RPC's ON CONFLICT (user_id, product_line) target.

-- Ensure the webhook RPC conflict target has a matching unique arbiter on clean
-- installs and on existing databases that skipped the earlier remediation.
-- Avoid adding a duplicate composite unique index if an earlier migration already
-- created the same key under a different name.
do $$
declare
  has_user_product_unique boolean;
begin
  select exists (
    select 1
    from pg_index idx
    join pg_class tbl on tbl.oid = idx.indrelid
    join pg_namespace nsp on nsp.oid = tbl.relnamespace
    where nsp.nspname = 'public'
      and tbl.relname = 'subscriptions'
      and idx.indisunique
      and idx.indpred is null
      and idx.indexprs is null
      and array(
        select att.attname
        from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = idx.indrelid
         and att.attnum = key.attnum
        where key.attnum <> 0
        order by key.ordinality
      ) = array['user_id', 'product_line']::name[]
  ) into has_user_product_unique;

  if not has_user_product_unique then
    create unique index idx_subscriptions_user_product_line_unique
      on public.subscriptions (user_id, product_line);
  end if;
end $$;

-- Drop every user_id-only UNIQUE constraint on public.subscriptions, regardless
-- of the generated name.  This handles historical/manual applications where the
-- constraint name might not be subscriptions_user_id_key.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'subscriptions'
      and con.contype = 'u'
      and array(
        select att.attname
        from unnest(con.conkey) with ordinality as key(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = con.conrelid
         and att.attnum = key.attnum
        order by key.ordinality
      ) = array['user_id']::name[]
  loop
    execute format(
      'alter table public.subscriptions drop constraint %I',
      constraint_record.conname
    );
  end loop;
end $$;

-- Drop every standalone unique index that still enforces only user_id.  Unique
-- constraints are already removed above; this covers any hand-written legacy
-- unique indexes that would otherwise continue to block Meet + Class rows.
do $$
declare
  index_record record;
begin
  for index_record in
    select idx.indexrelid::regclass as index_name
    from pg_index idx
    join pg_class tbl on tbl.oid = idx.indrelid
    join pg_namespace nsp on nsp.oid = tbl.relnamespace
    left join pg_constraint con on con.conindid = idx.indexrelid
    where nsp.nspname = 'public'
      and tbl.relname = 'subscriptions'
      and idx.indisunique
      and con.oid is null
      and idx.indpred is null
      and idx.indexprs is null
      and array(
        select att.attname
        from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = idx.indrelid
         and att.attnum = key.attnum
        where key.attnum <> 0
        order by key.ordinality
      ) = array['user_id']::name[]
  loop
    execute format('drop index if exists %s', index_record.index_name);
  end loop;
end $$;
