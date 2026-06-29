-- =============================================================================
-- Phase 2: Apply all remaining hardening changes to remote Supabase DB
-- =============================================================================
-- This script is SAFE to re-run (all statements are idempotent).
-- Handles phantom tables, indexes, constraints, and policy fixes.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A: Create phantom tables (tables referenced by policies but never in DDL)
-- =============================================================================

-- 1. analytics_events
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  page text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- 2. transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  language text DEFAULT 'en',
  is_final boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON transcripts(user_id);

-- 3. notes
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text,
  position int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notes_meeting_id ON notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- 4. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  message_type text DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- 5. payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents int NOT NULL DEFAULT 0,
  currency text DEFAULT 'usd',
  status text DEFAULT 'pending',
  lemon_squeezy_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- =============================================================================
-- PART B: Add missing performance indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- =============================================================================
-- PART C: Add CHECK constraints for data integrity
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
-- PART D: Fix subscriptions service_role policy (use current_setting instead of auth.role())
-- =============================================================================
DROP POLICY IF EXISTS subscriptions_service_role_all ON subscriptions;
CREATE POLICY subscriptions_service_role_all
  ON subscriptions
  FOR ALL
  USING ((select current_setting('role', true)) = 'service_role')
  WITH CHECK ((select current_setting('role', true)) = 'service_role');

-- =============================================================================
-- PART E: Verification
-- =============================================================================
DO $$
DECLARE
  total_tables int;
  total_policies int;
  bad_delete_policies int;
BEGIN
  SELECT count(*) INTO total_tables FROM information_schema.tables WHERE table_schema='public';
  SELECT count(*) INTO total_policies FROM pg_policies WHERE schemaname='public';
  SELECT count(*) INTO bad_delete_policies FROM pg_policies WHERE cmd = 'DELETE' AND with_check IS NOT NULL;

  RAISE NOTICE '=== PHASE 2 VERIFICATION ===';
  RAISE NOTICE 'Total tables: %', total_tables;
  RAISE NOTICE 'Total RLS policies: %', total_policies;
  RAISE NOTICE 'DELETE policies with WITH CHECK (should be 0): %', bad_delete_policies;

  IF bad_delete_policies > 0 THEN
    RAISE WARNING 'FOUND % DELETE POLICIES WITH INVALID WITH CHECK!', bad_delete_policies;
  ELSE
    RAISE NOTICE 'All DELETE policies are clean.';
  END IF;
END$$;

COMMIT;