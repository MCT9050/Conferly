-- db/migrations/004_add_missing_indexes_and_constraints.sql
-- Adds missing performance indexes and CHECK constraints for data integrity.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).
-- =============================================================================
-- HOW TO RUN: Paste in Supabase SQL Editor and execute.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- =============================================================================
-- 2. CHECK CONSTRAINTS
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

COMMIT;