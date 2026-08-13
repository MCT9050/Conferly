-- Conferly canonical product-entitlement alignment.
-- Target application commit: 127697b043c3faf576d26d52e370a2a66a4ccfb8
-- This migration intentionally replaces the incompatible historical August
-- sequence with one final-state alignment from the observed production schema.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table public.subscriptions in access exclusive mode;

do $$
declare
  subscription_rows bigint;
  actual_columns text[];
  expected_columns constant text[] := array[
    'created_at','current_period_end','id','status','tier','user_id'
  ];
begin
  select count(*) into subscription_rows from public.subscriptions;
  if subscription_rows <> 0 then
    raise exception
      'Alignment stopped: public.subscriptions contains % rows; re-audit classification and conversion',
      subscription_rows using errcode = 'P0001';
  end if;

  select array_agg(column_name order by column_name)
    into actual_columns
  from information_schema.columns
  where table_schema='public' and table_name='subscriptions';

  if actual_columns is distinct from expected_columns then
    raise exception
      'Alignment stopped: subscriptions shape changed. Expected %, found %',
      expected_columns, actual_columns using errcode = 'P0001';
  end if;

  if to_regclass('public.subscription_webhook_events') is not null then
    raise exception
      'Alignment stopped: public.subscription_webhook_events already exists; re-audit partial deployment'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='process_lemon_squeezy_subscription_webhook'
  ) then
    raise exception
      'Alignment stopped: webhook processing function already exists; re-audit partial deployment'
      using errcode = 'P0001';
  end if;
end $$;

-- Remove policies that depend on the legacy text user_id before changing its
-- type. PostgreSQL correctly refuses a type conversion while policy expressions
-- reference the column. The final least-privilege policy is recreated below.
drop policy if exists subscriptions_owner_only on public.subscriptions;
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_service_role_all on public.subscriptions;

-- Empty-table conversion from legacy identity/type/name contract.
alter table public.subscriptions drop constraint subscriptions_pkey;
alter table public.subscriptions drop column id;
alter table public.subscriptions add column id uuid not null default gen_random_uuid();
alter table public.subscriptions add constraint subscriptions_pkey primary key (id);

alter table public.subscriptions
  alter column user_id type uuid using nullif(trim(user_id), '')::uuid,
  alter column user_id set not null;

alter table public.subscriptions rename column tier to plan;
alter table public.subscriptions
  alter column plan set default 'trial',
  alter column plan set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.subscriptions
  add column product_line text not null default 'meet',
  add column participant_cap integer not null default 2,
  add column lemon_squeezy_subscription_id text,
  add column lemon_squeezy_order_id text,
  add column current_period_start timestamptz,
  add column updated_at timestamptz not null default now(),
  add column last_external_event_at timestamptz,
  add column last_external_event_id text;

alter table public.subscriptions
  add constraint subscriptions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint subscriptions_product_line_valid_check
    check (product_line in ('meet','class')),
  add constraint subscriptions_participant_cap_positive_check
    check (participant_cap > 0),
  add constraint subscriptions_status_valid_check
    check (status in ('active','paused','cancelled','expired','past_due')),
  add constraint subscriptions_plan_product_cap_valid_check
    check (
      (product_line='class' and (
        (plan='class_10' and participant_cap=10) or
        (plan='class_20' and participant_cap=20) or
        (plan='class_30' and participant_cap=30) or
        (plan='class_custom' and participant_cap>0)
      )) or
      (product_line='meet' and (
        (plan in ('meet_free','trial') and participant_cap=2) or
        (plan='meet_individual' and participant_cap=10) or
        (plan='meet_pro' and participant_cap=50) or
        (plan='meet_unlimited' and participant_cap=9999) or
        (plan='meet_enterprise' and participant_cap>0)
      ))
    ),
  add constraint subscriptions_user_product_line_key
    unique (user_id, product_line),
  add constraint subscriptions_lemon_squeezy_subscription_id_key
    unique (lemon_squeezy_subscription_id);

create index idx_subscriptions_product_line
  on public.subscriptions(product_line);
create index idx_subscriptions_user_product_status
  on public.subscriptions(user_id, product_line, status);
create index idx_subscriptions_external_subscription_product
  on public.subscriptions(lemon_squeezy_subscription_id, product_line);

-- Replace legacy broad policies with the application contract.
alter table public.subscriptions enable row level security;

create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.subscriptions from authenticated;
grant select on table public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

-- Create the webhook ledger directly in its final shape.
create table public.subscription_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  event_name text not null,
  external_subscription_id text,
  user_id uuid references auth.users(id) on delete set null,
  product_line text,
  external_event_at timestamptz not null,
  status text not null default 'processing',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint subscription_webhook_events_product_line_check
    check (product_line is null or product_line in ('meet','class')),
  constraint subscription_webhook_events_status_check
    check (status in ('processing','processed','skipped_older','failed'))
);

alter table public.subscription_webhook_events enable row level security;
revoke all on table public.subscription_webhook_events from public, anon, authenticated;
grant all on table public.subscription_webhook_events to service_role;

create index idx_subscription_webhook_events_subscription_product
  on public.subscription_webhook_events(external_subscription_id, product_line);
create index idx_subscription_webhook_events_user_id
  on public.subscription_webhook_events(user_id);

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
set search_path = ''
as $$
declare
  inserted_event_id uuid;
  existing_last_event_at timestamptz;
  existing_last_event_id text;
begin
  if p_webhook_id is null or btrim(p_webhook_id) = '' then
    raise exception 'Missing webhook id';
  end if;
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'Missing event name';
  end if;
  if p_external_subscription_id is null or btrim(p_external_subscription_id) = '' then
    raise exception 'Missing external subscription id';
  end if;
  if p_product_line not in ('meet','class') then
    raise exception 'Unknown product line: %', p_product_line;
  end if;
  if p_plan is null or btrim(p_plan) = '' then
    raise exception 'Missing plan';
  end if;
  if p_participant_cap is null or p_participant_cap <= 0 then
    raise exception 'Invalid participant cap: %', p_participant_cap;
  end if;
  if p_status not in ('active','paused','cancelled','expired','past_due') then
    raise exception 'Unknown subscription status: %', p_status;
  end if;
  if not (
    (p_product_line='class' and (
      (p_plan='class_10' and p_participant_cap=10) or
      (p_plan='class_20' and p_participant_cap=20) or
      (p_plan='class_30' and p_participant_cap=30)
    )) or
    (p_product_line='meet' and (
      (p_plan='meet_individual' and p_participant_cap=10) or
      (p_plan='meet_pro' and p_participant_cap=50) or
      (p_plan='meet_unlimited' and p_participant_cap=9999)
    ))
  ) then
    raise exception 'Invalid automatic entitlement contract: product=%, plan=%, cap=%',
      p_product_line,p_plan,p_participant_cap;
  end if;
  if p_external_event_at is null then
    raise exception 'Missing provider external event timestamp';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Unknown subscription user: %', p_user_id;
  end if;

  -- Serialize every event for this user/product pair, including the first one
  -- for which no subscription row exists yet. This closes the concurrent-first-
  -- webhook race that SELECT FOR UPDATE alone cannot close.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_product_line, 0)
  );

  insert into public.subscription_webhook_events (
    webhook_id,event_name,external_subscription_id,user_id,product_line,
    external_event_at,status
  ) values (
    p_webhook_id,p_event_name,p_external_subscription_id,p_user_id,p_product_line,
    p_external_event_at,'processing'
  ) on conflict (webhook_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('processed',false,'duplicate',true);
  end if;

  select s.last_external_event_at,s.last_external_event_id
    into existing_last_event_at,existing_last_event_id
  from public.subscriptions s
  where s.user_id=p_user_id and s.product_line=p_product_line
  for update;

  if existing_last_event_at is not null and
     (p_external_event_at < existing_last_event_at or
      (p_external_event_at = existing_last_event_at and
       p_webhook_id <= coalesce(existing_last_event_id,''))) then
    update public.subscription_webhook_events
       set status='skipped_older',processed_at=now()
     where id=inserted_event_id;
    return jsonb_build_object('processed',false,'duplicate',false,'skippedOlder',true);
  end if;

  insert into public.subscriptions (
    user_id,product_line,plan,participant_cap,status,
    lemon_squeezy_subscription_id,lemon_squeezy_order_id,
    current_period_start,current_period_end,
    last_external_event_at,last_external_event_id,updated_at
  ) values (
    p_user_id,p_product_line,p_plan,p_participant_cap,p_status,
    p_external_subscription_id,p_external_order_id,
    p_current_period_start,p_current_period_end,
    p_external_event_at,p_webhook_id,now()
  ) on conflict (user_id,product_line) do update set
    plan=excluded.plan,
    participant_cap=excluded.participant_cap,
    status=excluded.status,
    lemon_squeezy_subscription_id=excluded.lemon_squeezy_subscription_id,
    lemon_squeezy_order_id=excluded.lemon_squeezy_order_id,
    current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,
    last_external_event_at=excluded.last_external_event_at,
    last_external_event_id=excluded.last_external_event_id,
    updated_at=now();

  update public.subscription_webhook_events
     set status='processed',processed_at=now()
   where id=inserted_event_id;

  return jsonb_build_object('processed',true,'duplicate',false);
end;
$$;

revoke all on function public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz
) to service_role;

commit;
