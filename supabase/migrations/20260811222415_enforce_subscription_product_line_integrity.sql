-- Fix 3: enforce subscription product-line integrity at the database boundary.
--
-- Canonical subscription state is one row per (user_id, product_line), where
-- product_line is mandatory and limited to the only supported product lines:
--   - meet
--   - class
--
-- This migration is intentionally forward-only and fail-closed.  It validates
-- existing data before adding NOT NULL / CHECK constraints.  If any existing
-- row has NULL or an unknown product_line, the migration stops and reports the
-- problem instead of inventing a billing-data conversion.

do $$
declare
  null_product_line_count integer;
  invalid_product_line_count integer;
begin
  select count(*)
    into null_product_line_count
  from public.subscriptions
  where product_line is null;

  if null_product_line_count > 0 then
    raise exception 'Cannot enforce subscriptions.product_line NOT NULL: % rows have NULL product_line and require manual billing classification', null_product_line_count
      using errcode = 'P0001';
  end if;

  select count(*)
    into invalid_product_line_count
  from public.subscriptions
  where product_line not in ('meet', 'class');

  if invalid_product_line_count > 0 then
    raise exception 'Cannot enforce subscriptions.product_line CHECK: % rows have product_line outside meet/class and require manual billing classification', invalid_product_line_count
      using errcode = 'P0001';
  end if;
end $$;

alter table public.subscriptions
  alter column product_line set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'subscriptions'
      and con.conname = 'subscriptions_product_line_valid_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_product_line_valid_check
      check (product_line in ('meet', 'class'));
  end if;
end $$;
