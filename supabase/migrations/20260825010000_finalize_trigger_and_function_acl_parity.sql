-- =============================================================================
-- 20260825010000_finalize_trigger_and_function_acl_parity.sql
--
-- PRODUCTION-PARITY RECONCILIATION: event-trigger shape + function EXECUTE ACLs
--
-- Follow-up corrective migration after:
--   20260824000000_reconcile_live_production_schema.sql
--   20260825000000_finalize_production_parity_corrections.sql
--
-- Evidence base (FRESH READ-ONLY production forensic pass; SELECT-only catalog
-- queries against the linked production project -- production was NOT modified):
--
--   production_triggers_final.json
--     -> exactly ONE non-internal row trigger in public/auth:
--        on_auth_user_created AFTER INSERT ON auth.users
--        EXECUTE FUNCTION handle_new_user()
--        (already reproduced EXACTLY by 20260824000000 §6; untouched here)
--   production_relhastriggers_final.json
--     -> all other relhastriggers=true entries across the 22 audited public
--        tables are internal constraint/FK triggers only; NO additional
--        application row triggers exist in production
--   production_event_triggers_final.json
--     -> the application event trigger is named `ensure_rls` (NOT
--        `rls_auto_enable`), ON ddl_command_end, WITH
--        WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO'),
--        EXECUTE FUNCTION rls_auto_enable(), owner postgres, enabled 'O'.
--        The six supabase_admin-owned event triggers are platform-managed
--        and intentionally excluded from the app migration chain.
--   production_functions_final.json
--   production_functions_acl_final.json
--   production_function_owners_final.json
--     -> all 10 public functions owned by postgres with full proacl captured
--   trigger_acl_comparison_final.json
--     -> production-vs-local delta summary driving every correction below
--
-- CORRECTIONS IN THIS FILE (additive/corrective, idempotent where safe):
--   P1 #1  EVENT TRIGGER name + shape.
--          Local chain (20260824000000 §7, lines 349-352) created:
--            CREATE EVENT TRIGGER rls_auto_enable ON ddl_command_end ...
--          with NO WHEN TAG filter. Production has:
--            CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
--            WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
--          Two divergences: wrong event-trigger NAME and missing WHEN TAG
--          filter (local fires on every ddl_command_end). Pushing the old
--          shape would have left production's ensure_rls AND created a
--          duplicate rls_auto_enable trigger alongside it.
--          Fix: DROP-THEN-CREATE (deliberately NO CREATE IF NOT EXISTS for
--          this shape-critical object; the leading DROPs make re-runs safe).
--   P1 #2  accept_meeting_invitation(text,text) ACL.
--          Production proacl: postgres + service_role + authenticated.
--          Local (20260729223000:169, 20260824000000:386): authenticated only.
--          Fix: add service_role; authenticated is preserved.
--   P1 #3  Six is_* security helpers ACL.
--          Production proacl (all six): postgres + anon + authenticated +
--          service_role (PUBLIC revoked). Local (20260824000000:266-283):
--          postgres + authenticated with PUBLIC/anon revoked.
--          Fix: add anon + service_role to each; do NOT restore PUBLIC,
--          do NOT revoke authenticated.
--   P1 #4  handle_new_user() ACL -- STRICT PRODUCTION PARITY.
--          Production proacl: PUBLIC + postgres + anon + authenticated +
--          service_role. Local (20260824000000:305-307) revoked PUBLIC/anon/
--          authenticated and granted nothing back (postgres only).
--          This task is parity reconstruction, not hardening: all four
--          holders are restored exactly as production has them.
--   P1 #5  rls_auto_enable() function ACL -- CATALOG PARITY.
--          Production proacl has EXPLICIT entries for PUBLIC, postgres, anon,
--          authenticated, service_role. Local effectively had only
--          PUBLIC + postgres. Fix: explicit grants to PUBLIC, anon,
--          authenticated, service_role (owner postgres retains its entry).
--          Nothing is revoked from PUBLIC.


--
-- DELIBERATELY NOT TOUCHED (proven already correct or out of scope):
--   * Row trigger on_auth_user_created on auth.users
--     (EXACT_MATCH with production -- trigger_acl_comparison_final.json)
--   * process_lemon_squeezy_subscription_webhook(...) ACL
--     (EXACT_MATCH: postgres + service_role only; no change needed)
--   * Supabase platform-managed event triggers: issue_graphql_placeholder,
--     issue_pg_cron_access, issue_pg_graphql_access, issue_pg_net_access,
--     pgrst_ddl_watch, pgrst_drop_watch (owner supabase_admin; must NOT be
--     re-declared by the application migration chain)
--   * Every correction already delivered by 20260825000000_finalize_production
--     _parity_corrections.sql (subscriptions partial unique index, meetings
--     RLS policies, subscriptions SELECT-only RLS + write revokes, audit_logs
--     policies, V1 webhook subscription_id removal, V1 status/received_at
--     nullability/defaults, subscriptions.status nullability,
--     subscriptions(user_id, product_line) constraint, meetings.started_at
--     DEFAULT now()) -- none of those are duplicated here.
--   * All prior migrations remain unmodified.
--
-- NAMING NOTE (critical distinction):
--   function name      = public.rls_auto_enable()   [event_trigger handler]
--   event trigger name = ensure_rls                 [fires that function]
-- =============================================================================

-- =============================================================================
-- P1 #1: EVENT TRIGGER PARITY -- replace local `rls_auto_enable` event trigger
--        with production-shaped `ensure_rls`.
-- =============================================================================
-- DO NOT confuse the event trigger (ensure_rls) with its handler function
-- (public.rls_auto_enable()). The handler function itself is NOT dropped or
-- redefined here; 20260824000000 §7 already reproduced it verbatim and it is
-- definitionally EXACT with production.
--
-- DROP-THEN-CREATE is required: CREATE EVENT TRIGGER has no OR REPLACE form,
-- and IF NOT EXISTS cannot correct the name/WHEN TAG shape. The leading DROPs
-- make this migration idempotent on re-run and safe on production
-- (production's ensure_rls is dropped and recreated shape-equivalent;
-- the rls_auto_enable event trigger never existed in production, so that
-- DROP is a no-op there).
-- =============================================================================

DROP EVENT TRIGGER IF EXISTS rls_auto_enable;
DROP EVENT TRIGGER IF EXISTS ensure_rls;

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- =============================================================================
-- P1 #2: accept_meeting_invitation(text, text) -- add service_role.
-- =============================================================================
-- Production proacl (production_functions_acl_final.json):
--   {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
-- Local final holders before this migration: postgres, authenticated.
-- Additive GRANT is idempotent; authenticated stays, nothing revoked.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.accept_meeting_invitation(text, text)
  TO service_role;

-- =============================================================================
-- P1 #3: six is_* security helpers -- add anon + service_role.
-- =============================================================================
-- Production proacl for EACH of the six (identical shape):
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,
--    service_role=X/postgres}
-- PUBLIC has no production entry and stays revoked locally
-- (20260824000000:266-277 revoked PUBLIC and anon; authenticated was granted
-- at 20260824000000:278-283 and is preserved). Additive GRANTs, idempotent.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid)
  TO anon, service_role;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid)
  TO anon, service_role;

GRANT EXECUTE ON FUNCTION public.is_classroom_enrolled(uuid)
  TO anon, service_role;

GRANT EXECUTE ON FUNCTION public.is_classroom_owner(uuid)
  TO anon, service_role;

GRANT EXECUTE ON FUNCTION public.is_meeting_owner(uuid)
  TO anon, service_role;

GRANT EXECUTE ON FUNCTION public.is_meeting_participant(uuid)
  TO anon, service_role;

-- =============================================================================
-- P1 #4: handle_new_user() -- strict production ACL parity.
-- =============================================================================
-- Production proacl (production_functions_acl_final.json):
--   {=X/postgres,postgres=X/postgres,anon=X/postgres,
--    authenticated=X/postgres,service_role=X/postgres}
-- i.e. explicit PUBLIC plus all four named roles.
-- 20260824000000:305-307 revoked PUBLIC/anon/authenticated and granted
-- nothing back. This is NOT treated as intentional hardening: the task is
-- production/local parity reconstruction, so every production holder is
-- restored. GRANT is additive and idempotent.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- P1 #5: rls_auto_enable() FUNCTION ACL -- explicit catalog parity.
-- =============================================================================
-- Production proacl (production_functions_acl_final.json):
--   {=X/postgres,postgres=X/postgres,anon=X/postgres,
--    authenticated=X/postgres,service_role=X/postgres}
-- Local effectively had PUBLIC + postgres only. Explicit grants recreate the
-- missing explicit catalog entries (granting to PUBLIC alone does NOT create
-- per-role entries for anon/authenticated/service_role). Nothing is revoked
-- from PUBLIC. GRANT is additive and idempotent.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.rls_auto_enable()
  TO PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- ALREADY PARITY -- NO STATEMENTS REQUIRED (documented, not executed):
--
-- * process_lemon_squeezy_subscription_webhook(text,text,text,uuid,text,text,
--   integer,text,timestamptz,text,timestamptz,timestamptz)
--   Production proacl: {postgres=X/postgres,service_role=X/postgres}
--   Local final ACL (20260824000000 §8 lines 430-441): identical.
--   Classification in trigger_acl_comparison_final.json: EXACT_MATCH.
--
-- * on_auth_user_created row trigger on auth.users: EXACT_MATCH, reproduced
--   by 20260824000000 §6 (lines 309-313). No additional production row
--   triggers exist (production_triggers_final.json +
--   production_relhastriggers_final.json).
--
-- * Platform event triggers owned by supabase_admin are intentionally NOT
--   added to the application migration chain.
-- =============================================================================

-- =============================================================================
-- END OF 20260825010000_finalize_trigger_and_function_acl_parity.sql
-- =============================================================================
