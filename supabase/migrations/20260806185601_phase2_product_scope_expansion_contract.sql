-- Phase 2 release remediation: forward-only expand/deploy/contract support.
-- Application status of 20260806000001_product_scoped_entitlements.sql is
-- UNVERIFIED in this workspace; do not assume it was or was not applied.

-- EXPAND: preserve legacy UNIQUE(user_id) compatibility while adding product
-- scoped lookup, webhook ledger security, and provider ordering evidence.
alter table public.subscriptions
  add column if not exists product_line text;

alter table public.subscriptions
  add column if not exists last_external_event_at timestamptz;

alter table public.subscriptions
  add column if not exists last_external_event_id text;

do $$
declare
  ambiguous_count integer;
begin
  update public.subscriptions
  set product_line = 'class'
  where product_line is null
    and (
      plan in ('class_10', 'class_20', 'class_30', 'class_custom', 'classroom')
      or plan like 'class\_%' escape '\'
    );

  update public.subscriptions
  set product_line = 'meet'
  where product_line is null
    and plan in ('trial', 'individual', 'pro', 'business', 'enterprise', 'unlimited',
                 'meet_free', 'meet_individual', 'meet_pro', 'meet_unlimited', 'meet_enterprise');

  select count(*) into ambiguous_count
  from public.subscriptions
  where product_line is null;

  if ambiguous_count > 0 then
    raise exception 'Ambiguous subscriptions.product_line backfill: % rows require manual classification before Phase 2 expansion can continue', ambiguous_count
      using errcode = 'P0001';
  end if;
end $$;

create unique index if not exists idx_subscriptions_user_product_line_unique
  on public.subscriptions (user_id, product_line);

create index if not exists idx_subscriptions_external_subscription_product
  on public.subscriptions (lemon_squeezy_subscription_id, product_line);

create index if not exists idx_subscriptions_user_product_status
  on public.subscriptions (user_id, product_line, status);

create table if not exists public.subscription_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  event_name text not null,
  external_subscription_id text,
  user_id uuid,
  product_line text,
  external_event_at timestamptz,
  status text not null default 'processing',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ----------------------------------------------------------------------------
-- Reconciliation fix (P0): ensure the full webhook ledger schema exists.
-- An earlier migration (20260806000001_product_scoped_entitlements.sql) may have
-- already created subscription_webhook_events as a SLIM table (lacking
-- external_subscription_id, external_event_at, status, error, received_at,
-- processed_at). `CREATE TABLE IF NOT EXISTS` above is a no-op when the slim
-- table already exists, so without these idempotent ADD COLUMN statements the
-- index below on (external_subscription_id, product_line) and the webhook RPC
-- would reference non-existent columns and ERROR, rolling the whole migration
-- back on a fresh `supabase db reset`. This must be non-destructive and
-- idempotent so it is safe on both slim-schema and full-schema databases.
-- ----------------------------------------------------------------------------
alter table public.subscription_webhook_events
  add column if not exists external_subscription_id text,
  add column if not exists external_event_at timestamptz,
  add column if not exists status text not null default 'processing',
  add column if not exists error text,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz;

alter table public.subscription_webhook_events enable row level security;

revoke all on table public.subscription_webhook_events from anon, authenticated, public;
revoke all on table public.subscription_webhook_events from PUBLIC;

create index if not exists idx_subscription_webhook_events_webhook_id
  on public.subscription_webhook_events (webhook_id);

create index if not exists idx_subscription_webhook_events_subscription_product
  on public.subscription_webhook_events (external_subscription_id, product_line);

create or replace function public.process_lemon_squeezy_subscription_webhook(
  p_webhook_id text,
  p_event_name text,
  p_external_subscription_id text,
  p_user_id uuid,
  p_product_line text,
  p_plan text,
  p_participant_cap integer,
  p_status text,
  p_external_event_at timestamptz,
  p_external_order_id text default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_event_id uuid;
  existing_last_event_at timestamptz;
begin
  if p_webhook_id is null or length(trim(p_webhook_id)) = 0 then
    raise exception 'Missing webhook id';
  end if;

  if p_product_line not in ('meet', 'class') then
    raise exception 'Unknown product line: %', p_product_line;
  end if;

  if p_external_event_at is null then
    raise exception 'Missing provider external event timestamp';
  end if;

  insert into public.subscription_webhook_events (
    webhook_id, event_name, external_subscription_id, user_id, product_line, external_event_at, status
  ) values (
    p_webhook_id, p_event_name, p_external_subscription_id, p_user_id, p_product_line, p_external_event_at, 'processing'
  )
  on conflict (webhook_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('processed', false, 'duplicate', true);
  end if;

  select s.last_external_event_at
    into existing_last_event_at
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.product_line = p_product_line
  for update;

  if existing_last_event_at is not null and p_external_event_at < existing_last_event_at then
    update public.subscription_webhook_events
      set status = 'skipped_older', processed_at = now()
    where id = inserted_event_id;
    return jsonb_build_object('processed', false, 'duplicate', false, 'skippedOlder', true);
  end if;

  insert into public.subscriptions (
    user_id, product_line, plan, participant_cap, status,
    lemon_squeezy_subscription_id, lemon_squeezy_order_id,
    current_period_start, current_period_end,
    last_external_event_at, last_external_event_id, updated_at
  ) values (
    p_user_id, p_product_line, p_plan, p_participant_cap, p_status,
    p_external_subscription_id, p_external_order_id,
    p_current_period_start, p_current_period_end,
    p_external_event_at, p_webhook_id, now()
  )
  on conflict (user_id, product_line) do update set
    plan = excluded.plan,
    participant_cap = excluded.participant_cap,
    status = excluded.status,
    lemon_squeezy_subscription_id = excluded.lemon_squeezy_subscription_id,
    lemon_squeezy_order_id = excluded.lemon_squeezy_order_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    last_external_event_at = excluded.last_external_event_at,
    last_external_event_id = excluded.last_external_event_id,
    updated_at = now();

  update public.subscription_webhook_events
    set status = 'processed', processed_at = now()
  where id = inserted_event_id;

  return jsonb_build_object('processed', true, 'duplicate', false);
exception
  when others then
    if inserted_event_id is not null then
      update public.subscription_webhook_events
        set status = 'failed', error = left(sqlerrm, 500), processed_at = now()
      where id = inserted_event_id;
    end if;
    raise;
end;
$$;

revoke all on function public.process_lemon_squeezy_subscription_webhook(
  text, text, text, uuid, text, text, integer, text, timestamptz, text, timestamptz, timestamptz
) from PUBLIC, anon, authenticated;

grant execute on function public.process_lemon_squeezy_subscription_webhook(
  text, text, text, uuid, text, text, integer, text, timestamptz, text, timestamptz, timestamptz
) to service_role;

-- CONTRACT (later, after compatible code and data verification only):
-- 1. Verify no ambiguous product_line rows remain:
--      select id, user_id, plan from public.subscriptions where product_line is null;
-- 2. Verify no user/product duplicates exist.
-- 3. Only then drop obsolete user-only uniqueness if present.
-- 4. Only then set product_line not null and add validated CHECK(product_line in ('meet','class')).
-- Recovery must preserve product_line and provider ordering columns; do not drop
-- populated business data. Correct misclassified rows with audited UPDATEs.
