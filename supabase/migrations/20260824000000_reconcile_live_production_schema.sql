-- =============================================================================
-- 20260824000000_reconcile_live_production_schema.sql
--
-- CORRECTIVE reconciliation of the LOCAL canonical migration chain against the
-- ACTUAL LIVE PRODUCTION catalog (project neymqmyzmsberwlowlpw), as captured in
-- the forensic artifacts (forensics_production.json / forensics2 / forensics3 /
-- production_columns_report.json / openapi_production.json).
--
-- This is a NEW migration appended after 20260822000000_reconcile_local_with_production_contract.sql.
-- It does NOT edit historical migration files (audit trail preserved). It is the
-- smallest, SAFE, additive/corrective change required so that a fresh
-- `supabase db reset` reproduces the production column/FK/constraint/index/RPC/RLS
-- state the application depends on.
--
-- LIVE PRODUCTION IS READ-ONLY. This file only ever runs LOCALLY.
-- Every object definition below is taken verbatim from the production catalog;
-- nothing is invented. Remaining known P3 divergences (currently-unused infra
-- tables, timestamp NULLability, policy names) are documented in
-- FINAL_LIVE_TO_LOCAL_DATABASE_ALIGNMENT_REPORT.md, not silently changed here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. MEETINGS — reproduce the full production columns, exact user_id FK, and
--    production indexes.
-- ---------------------------------------------------------------------------
-- Production `meetings` (22 cols) requires, beyond what 20260822000000 added:
--   duration_seconds, participant_count, has_recording, language, host_id,
--   room_id, status. user_id is NOT NULL and REFERENCES profiles(id)
--   ON DELETE CASCADE (production meetings_user_id_fkey). room_code is NOT NULL.
-- ---------------------------------------------------------------------------

-- Ensure base live layout columns exist (no-op when already added by 2026082).
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS user_id  uuid,
  ADD COLUMN IF NOT EXISTS room_code text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at   timestamptz;

-- Remaining production columns missing from the local chain.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participant_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS has_recording boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS host_id text,
  ADD COLUMN IF NOT EXISTS room_id text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- CRITICAL FK CORRECTION: local 20260822000000 added user_id referencing
-- auth.users ON DELETE SET NULL. Production (authoritative) is
--   meetings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
--   ON DELETE CASCADE. Replace the constraint on the fresh DB.
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_user_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname='public' AND r.relname='meetings'
      AND c.conname='meetings_user_id_fkey' AND c.contype='f'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Exact nullability parity for the columns the app writes on every insert.
ALTER TABLE public.meetings ALTER COLUMN user_id   SET NOT NULL;
ALTER TABLE public.meetings ALTER COLUMN room_code SET NOT NULL;
-- Production `title` is NULL; initial local schema declared NOT NULL.
ALTER TABLE public.meetings ALTER COLUMN title DROP NOT NULL;

-- Production meetings indexes (recreate idx_meetings_room_code dropped by 002_hardening).
CREATE INDEX IF NOT EXISTS idx_meetings_user_id  ON public.meetings (user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_room_code ON public.meetings (room_code);
CREATE INDEX IF NOT EXISTS idx_meetings_slug     ON public.meetings (slug);

-- Production uses a partial UNIQUE index on slug (WHERE slug IS NOT NULL) named
-- `meetings_slug_unique_idx`. The local chain created a whole-table UNIQUE
-- constraint `meetings_slug_key` instead. Align on the production shape.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname='public' AND r.relname='meetings' AND c.conname='meetings_slug_key'
  ) THEN
    ALTER TABLE public.meetings DROP CONSTRAINT meetings_slug_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS meetings_slug_unique_idx
  ON public.meetings (slug) WHERE slug IS NOT NULL;
-- ---------------------------------------------------------------------------
-- 2. PROFILES — reproduce the production column set (19 cols) and the
--    user_type CHECK. display_name is NOT NULL DEFAULT 'User' in production.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS plan_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS meetings_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meetings_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS organization_size integer,
  ADD COLUMN IF NOT EXISTS organization_industry text,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';

-- Exact production nullability for columns that are NOT NULL with defaults.
ALTER TABLE public.profiles ALTER COLUMN display_name SET DEFAULT 'User';
ALTER TABLE public.profiles ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN plan_tier SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN meetings_this_month SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN meetings_month SET NOT NULL;

-- Production CHECK constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname='public' AND r.relname='profiles' AND c.conname='profiles_user_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_type_check CHECK (user_type IN ('individual','organization'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS — exact parity.
--    * tier TEXT DEFAULT 'free'  (missing locally; the Dashboard/UI reads .tier)
--    * user_id is NULL in production (local chain declared NOT NULL)
--    * lemon_squeezy_subscription_id uniqueness is a PARTIAL unique index in
--      production (WHERE IS NOT NULL) — align on that shape.
--    UNIQUE(user_id, product_line) and product_line CHECK already present.
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free';

-- Match production nullability (production user_id is nullable).
ALTER TABLE public.subscriptions ALTER COLUMN user_id DROP NOT NULL;

-- Replace the whole-table UNIQUE constraint with the production partial index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname='public' AND r.relname='subscriptions'
      AND c.conname='subscriptions_lemon_squeezy_subscription_id_key'
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_lemon_squeezy_subscription_id_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_lemon_squeezy_subscription_id
  ON public.subscriptions (lemon_squeezy_subscription_id)
  WHERE lemon_squeezy_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. subscription_webhook_events_v2 — full reproduction (production V2).
--    Distinct table, NOT merged with V1, schema taken verbatim from catalog.
--    RLS enabled; anon/authenticated locked out; service_role only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_webhook_events_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  external_subscription_id text,
  user_id uuid,
  product_line text,
  external_event_at timestamptz,
  status text NOT NULL DEFAULT 'processing',
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_subscription_webhook_events_v2_webhook_id
  ON public.subscription_webhook_events_v2 (webhook_id);
CREATE INDEX IF NOT EXISTS idx_subscription_webhook_events_v2_subscription_product
  ON public.subscription_webhook_events_v2 (external_subscription_id, product_line);

ALTER TABLE public.subscription_webhook_events_v2 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.subscription_webhook_events_v2 FROM PUBLIC;
REVOKE ALL ON TABLE public.subscription_webhook_events_v2 FROM anon;
REVOKE ALL ON TABLE public.subscription_webhook_events_v2 FROM authenticated;
GRANT ALL ON TABLE public.subscription_webhook_events_v2 TO service_role;

-- ---------------------------------------------------------------------------
-- 5. SECURITY / RLS HELPER FUNCTIONS — production has these SECURITY DEFINER
--    helpers (created by production-only migration 20260728194123) which the
--    local chain never created. Reproduced verbatim (SQL, STABLE, DEFINER,
--    write-protected search_path, RLS bypass via row_security=off).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.org_members om
    where om.org_id = target_org_id and om.user_id = auth.uid() and om.role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.org_members om
    where om.org_id = target_org_id and om.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_classroom_enrolled(target_classroom_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.classroom_enrollments ce
    where ce.classroom_id = target_classroom_id
      and ce.student_id = auth.uid() and ce.enrollment_status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_classroom_owner(target_classroom_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.classrooms c
    where c.id = target_classroom_id and c.owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_meeting_owner(target_meeting_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.meetings m
    where m.id = target_meeting_id and m.owner = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(target_meeting_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO off
AS $function$
  select exists (
    select 1 from public.meeting_participants mp
    where mp.meeting_id = target_meeting_id and mp.user_id = auth.uid()
  );
$function$;

-- Grant the RLS helpers to the authenticated API role (production grant model).
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_classroom_enrolled(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_classroom_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_meeting_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_meeting_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_classroom_enrolled(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_classroom_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_meeting_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_meeting_participant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_classroom_enrolled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_classroom_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_meeting_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_meeting_participant(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. handle_new_user trigger (production, SECURITY DEFINER) that seeds
--    profiles on signup — requires profiles.email, added in section 2.
--    Local chain never created it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 7. rls_auto_enable (production, SECURITY DEFINER) event trigger that
--    auto-enables RLS on new public tables. Body verbatim from the catalog.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
      END IF;
  END LOOP;
END;
$function$;

DROP EVENT TRIGGER IF EXISTS rls_auto_enable;
CREATE EVENT TRIGGER rls_auto_enable
  ON ddl_command_end
  EXECUTE FUNCTION public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- 8. accept_meeting_invitation — EXACT-match the live production body.
--    The production code grants the invitation ROLE (i.role) instead of always
--    'attendee'; the local 20260729223000 version diverged from that contract.
--    Reproduce the production definition verbatim (text,text) -> table, SECURITY
--    DEFINER, search_path ''.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_meeting_invitation(p_meeting_slug text, p_token_hash text)
 RETURNS TABLE(meeting_id uuid, slug text, database_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=auth.uid(); i public.meeting_invitations%ROWTYPE; m public.meetings%ROWTYPE; participant_role text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='authentication required'; END IF;
 IF p_meeting_slug IS NULL OR p_meeting_slug='' OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='invalid invitation'; END IF;
 SELECT i.* INTO i FROM public.meeting_invitations i JOIN public.meetings m ON m.id=i.meeting_id WHERE m.slug=p_meeting_slug AND i.token_hash=p_token_hash FOR UPDATE OF i;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='invalid invitation'; END IF;
 SELECT * INTO m FROM public.meetings WHERE id=i.meeting_id;
 IF m.owner=uid THEN RETURN QUERY SELECT m.id,m.slug,'host'::text; RETURN; END IF;
 SELECT mp.role INTO participant_role FROM public.meeting_participants mp WHERE mp.meeting_id=m.id AND mp.user_id=uid;
 IF FOUND THEN UPDATE public.meeting_participants SET joined_at=COALESCE(joined_at,statement_timestamp()) WHERE meeting_id=m.id AND user_id=uid; RETURN QUERY SELECT m.id,m.slug,participant_role; RETURN; END IF;
 IF i.revoked_at IS NOT NULL OR(i.expires_at IS NOT NULL AND i.expires_at<=statement_timestamp()) OR(i.max_uses IS NOT NULL AND i.use_count>=i.max_uses) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='invalid invitation'; END IF;
 INSERT INTO public.meeting_participants(meeting_id,user_id,role,invited_by,joined_at) VALUES(m.id,uid,i.role,i.created_by,statement_timestamp()) ON CONFLICT(meeting_id,user_id) DO NOTHING RETURNING role INTO participant_role;
 IF participant_role IS NOT NULL THEN UPDATE public.meeting_invitations SET use_count=use_count+1,last_used_at=statement_timestamp() WHERE id=i.id; ELSE SELECT mp.role INTO participant_role FROM public.meeting_participants mp WHERE mp.meeting_id=m.id AND mp.user_id=uid; END IF;
 RETURN QUERY SELECT m.id,m.slug,participant_role;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_meeting_invitation(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_meeting_invitation(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_meeting_invitation(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. process_lemon_squeezy_subscription_webhook — EXACT-match the live
--    production body. 12-arg function, returns jsonb, SECURITY DEFINER,
--    granted to service_role only. The local 20260806185601 version diverged
--    in status labels ('processing'/'skipped_older'/'failed' vs live's
--    'received'/'stale'/'processed') and in SET-then-conflict vs FOR-UPDATE
--    semantics; reproduce production verbatim.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_lemon_squeezy_subscription_webhook(
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE ev public.subscription_webhook_events%ROWTYPE; s public.subscriptions%ROWTYPE; inserted_count integer; event_at timestamptz:=COALESCE(p_external_event_at,statement_timestamp());
BEGIN
 IF p_webhook_id IS NULL OR p_webhook_id='' OR p_external_subscription_id IS NULL OR p_user_id IS NULL OR p_product_line NOT IN('meet','class') THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='invalid webhook payload'; END IF;
 INSERT INTO public.subscription_webhook_events(webhook_id,event_name,external_subscription_id,user_id,product_line,external_event_at,status,received_at) VALUES(p_webhook_id,p_event_name,p_external_subscription_id,p_user_id,p_product_line,event_at,'received',statement_timestamp()) ON CONFLICT(webhook_id) DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 IF inserted_count=0 THEN SELECT * INTO ev FROM public.subscription_webhook_events WHERE webhook_id=p_webhook_id; RETURN jsonb_build_object('duplicate',true,'webhook_id',p_webhook_id,'status',ev.status); END IF;
 SELECT * INTO s FROM public.subscriptions WHERE user_id=p_user_id AND product_line=p_product_line FOR UPDATE;
 IF FOUND AND s.last_external_event_at IS NOT NULL AND event_at<s.last_external_event_at THEN UPDATE public.subscription_webhook_events SET status='stale',processed_at=statement_timestamp() WHERE webhook_id=p_webhook_id; RETURN jsonb_build_object('duplicate',false,'stale',true,'webhook_id',p_webhook_id); END IF;
 IF FOUND THEN UPDATE public.subscriptions SET plan=p_plan,participant_cap=p_participant_cap,status=p_status,lemon_squeezy_subscription_id=p_external_subscription_id,lemon_squeezy_order_id=p_external_order_id,current_period_start=p_current_period_start,current_period_end=p_current_period_end,last_external_event_at=event_at,last_external_event_id=p_webhook_id,updated_at=statement_timestamp() WHERE id=s.id;
 ELSE INSERT INTO public.subscriptions(user_id,product_line,plan,participant_cap,status,lemon_squeezy_subscription_id,lemon_squeezy_order_id,current_period_start,current_period_end,last_external_event_at,last_external_event_id,created_at,updated_at) VALUES(p_user_id,p_product_line,p_plan,p_participant_cap,p_status,p_external_subscription_id,p_external_order_id,p_current_period_start,p_current_period_end,event_at,p_webhook_id,statement_timestamp(),statement_timestamp()); END IF;
 UPDATE public.subscription_webhook_events SET status='processed',processed_at=statement_timestamp() WHERE webhook_id=p_webhook_id;
 RETURN jsonb_build_object('duplicate',false,'stale',false,'processed',true,'webhook_id',p_webhook_id,'product_line',p_product_line);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz)
  FROM anon;
REVOKE ALL ON FUNCTION public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_lemon_squeezy_subscription_webhook(
  text,text,text,uuid,text,text,integer,text,timestamptz,text,timestamptz,timestamptz)
  TO service_role;

-- =============================================================================
-- END OF 20260824000000_reconcile_live_production_schema.sql
--
-- INTENTIONALLY OUT OF SCOPE (documented P3 gaps — see final report):
--   * Rebuilding currently-unused infra tables to the exact production shapes
--     (analytics_events uses integer serial id + event_type + metadata jsonb;
--      chat_messages uses messages jsonb; transcripts uses entries jsonb;
--      payments uses ZAR pricing columns; notes.content NOT NULL DEFAULT '').
--     These tables hold no rows and are not referenced by application code;
--     their user_id FKs remain auth.users references until an application-
--     owned follow-up migration retargets them to profiles as on live.
--   * Timestamp NULLability drift on meetings/profiles/organizations (production
--     is NULL-able with DEFAULT now(); local chain carries NOT NULL). Both
--     produce identical values on insert; changing NOT NULL is intentionally
--     deferred to avoid needless churn.
--   * Policy NAME differences where the USING/WITH CHECK bodies are identical
--     to production (e.g. meetings_* in 002/003, classroom_* renamed helpers).
--     The row-level predicate graph matches; only the pg_policy.polname string
--     differs. Captured in the report difference matrix.
-- =============================================================================
-- END OF 20260824000000_reconcile_live_production_schema.sql