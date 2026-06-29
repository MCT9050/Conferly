-- =============================================================================
-- Phase 1 Remediation: Fix RLS policies with invalid WITH CHECK on DELETE
-- Removal of wildcard DROP POLICY loops that cause duplicate policy errors
-- Adds missing indexes and CHECK constraints
-- =============================================================================
-- HOW TO RUN: Paste this entire file into Supabase SQL Editor and execute.
-- All statements are idempotent (IF EXISTS / IF NOT EXISTS).
-- NOTE: All UUID/text comparisons use explicit ::uuid casts for type safety.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. FIX: Remove invalid WITH CHECK from DELETE policies
-- =============================================================================
-- Postgres does not allow WITH CHECK on FOR DELETE policies.
-- The original 002_hardening.sql and 003_add_org_support.sql created these.

-- 1a. meetings_modify_owner_only_delete (from 002_hardening)
DROP POLICY IF EXISTS meetings_modify_owner_only_delete ON public.meetings;
CREATE POLICY meetings_modify_owner_only_delete
  ON public.meetings
  FOR DELETE
  USING (owner::uuid = auth.uid());

-- 1b. meetings_modify_owner_or_org_admin_delete (from 003_add_org_support)
DROP POLICY IF EXISTS meetings_modify_owner_or_org_admin_delete ON public.meetings;
CREATE POLICY meetings_modify_owner_or_org_admin_delete
  ON public.meetings
  FOR DELETE
  USING (
    owner::uuid = auth.uid()
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id::uuid = public.meetings.org_id::uuid
          AND om.user_id::uuid = auth.uid()
          AND om.role = 'admin'
      )
    )
  );

-- 1c. participants_modify_own_delete (from 002_hardening)
DROP POLICY IF EXISTS participants_modify_own_delete ON public.meeting_participants;
CREATE POLICY participants_modify_own_delete
  ON public.meeting_participants
  FOR DELETE
  USING (user_id::uuid = auth.uid());

-- 1d. org_members_delete_for_org_admin (from 003_add_org_support)
DROP POLICY IF EXISTS org_members_delete_for_org_admin ON public.org_members;
CREATE POLICY org_members_delete_for_org_admin
  ON public.org_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id::uuid = org_members.org_id::uuid
        AND om.user_id::uuid = auth.uid()
        AND om.role = 'admin'
    )
  );

-- =============================================================================
-- 2. FIX: subscriptions_owner_only - remove invalid WITH CHECK (DELETE compat)
-- =============================================================================
DROP POLICY IF EXISTS subscriptions_owner_only ON public.subscriptions;
CREATE POLICY subscriptions_owner_only
  ON public.subscriptions
  FOR ALL
  USING (user_id::uuid = auth.uid());

-- =============================================================================
-- 3. ADD: Missing indexes for query performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- =============================================================================
-- 4. ADD: CHECK constraints for data integrity
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'meeting_participants_role_check'
  ) THEN
    ALTER TABLE public.meeting_participants
      ADD CONSTRAINT meeting_participants_role_check
      CHECK (role IN ('attendee', 'host', 'presenter'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'slides_position_check'
  ) THEN
    ALTER TABLE public.slides
      ADD CONSTRAINT slides_position_check
      CHECK (position >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'org_members_role_check'
  ) THEN
    ALTER TABLE public.org_members
      ADD CONSTRAINT org_members_role_check
      CHECK (role IN ('admin', 'member'));
  END IF;
END$$;

-- =============================================================================
-- 5. FIX: subscriptions - add service_role policy as final authority
-- =============================================================================
DROP POLICY IF EXISTS subscriptions_service_role_all ON public.subscriptions;
CREATE POLICY subscriptions_service_role_all
  ON public.subscriptions
  FOR ALL
  USING (
    (select current_setting('role', true)) = 'service_role'
  )
  WITH CHECK (
    (select current_setting('role', true)) = 'service_role'
  );

-- =============================================================================
-- 6. VERIFICATION: Report current state of all DELETE policies
-- =============================================================================
DO $$
DECLARE
  rec record;
  has_error boolean := false;
BEGIN
  RAISE NOTICE '=== VERIFICATION: Policies that still have WITH CHECK on DELETE ===';
  FOR rec IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE cmd = 'DELETE' AND with_check IS NOT NULL
  LOOP
    RAISE WARNING 'ISSUE: % ON % (%), with_check=%', rec.policyname, rec.tablename, rec.schemaname, rec.with_check;
    has_error := true;
  END LOOP;

  IF NOT has_error THEN
    RAISE NOTICE 'All DELETE policies are clean (no WITH CHECK)';
  END IF;

  RAISE NOTICE '=== Total DELETE policies: %', (SELECT count(*) FROM pg_policies WHERE cmd = 'DELETE');
END$$;

COMMIT;