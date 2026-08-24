-- =============================================================================
-- Reconciliation migration: align a fresh local Supabase DB with the known
-- LIVE PRODUCTION DATABASE contract.
--
-- This migration is ADDITIVE and IDEMPOTENT only (ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE IF NOT EXISTS, DROP ... IF EXISTS). It never deletes data or
-- drops production objects. It is the smallest safe change required so that:
--
--   supabase db reset
--
-- reproduces the production contract the application depends on.
--
-- Source authority for each section:
--   * Meetings columns (P0): application writer contract in
--     lib/meetingPersistence.ts#buildMeetingInsert and the dashboard SELECT in
--     app/(platform)/dashboard/page.tsx (selects id, slug, room_code, title,
--     created_at). Production contract (task section 2) lists these columns.
--   * Infrastructure tables (P2): production infra tables (task section 11) that
--     exist in production but were never created by the canonical
--     supabase/migrations/ chain. Their DDL is reproduced verbatim from the
--     verified legacy artifact db/migrations/005_create_phantom_tables.sql, which
--     is structurally consistent with the RLS policy column references authored
--     in 20250601000002_hardening.sql.
--
-- NOTE: subscription_webhook_events_v2 is intentionally NOT created here. Its
-- schema is not present anywhere in this repository and cannot be reproduced
-- without inventing columns, which is explicitly disallowed. See report section
-- H / J for the documented gap.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P0 — MEETINGS COLUMNS missing from the canonical local chain
-- -----------------------------------------------------------------------------
-- Production contract (task section 2) requires:
--   meetings.user_id, meetings.room_code, meetings.started_at, meetings.ended_at
-- The application WRITES all four (lib/meetingPersistence.ts:buildMeetingInsert
-- sets owner = user_id = authenticated user, room_code = slug, started_at =
-- startsAt, ended_at = endsAt) and the dashboard SELECTS room_code.
-- A fresh local DB without these columns makes the meeting INSERT and the
-- dashboard SELECT fail at runtime even though production works.
--
-- user_id FK semantics are INFERRED (no live DB access): it mirrors `owner`
-- referencing auth.users. Made nullable so the ADD is safe on existing databases
-- that already contain rows; the application always supplies it on insert.
-- -----------------------------------------------------------------------------
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_code text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at   timestamptz;

-- -----------------------------------------------------------------------------
-- P2 — PRODUCTION INFRASTRUCTURE TABLES absent from the canonical migration chain
-- -----------------------------------------------------------------------------
-- These tables exist in production (task section 1 / section 11) but the
-- canonical chain only *references* them behind IF EXISTS guards in
-- 20250601000002_hardening.sql, so a fresh `supabase db reset` omits them.
-- Reproduced here with verified DDL + RLS so the fresh local DB matches the
-- production object set. None are consumed by current application code.
-- -----------------------------------------------------------------------------

-- === analytics_events ===
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  session_id text,
  page text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_events_insert_authenticated ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_select_none ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_update_none ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_delete_none ON public.analytics_events;
CREATE POLICY analytics_events_insert_authenticated
  ON public.analytics_events
  FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY analytics_events_select_none
  ON public.analytics_events
  FOR SELECT
  USING (false);
CREATE POLICY analytics_events_update_none
  ON public.analytics_events
  FOR UPDATE
  USING (false)
  WITH CHECK (false);
CREATE POLICY analytics_events_delete_none
  ON public.analytics_events
  FOR DELETE
  USING (false);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

-- === transcripts ===
CREATE TABLE IF NOT EXISTS public.transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  language text DEFAULT 'en',
  is_final boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transcripts_select_for_user ON public.transcripts;
DROP POLICY IF EXISTS transcripts_insert_for_user ON public.transcripts;
CREATE POLICY transcripts_select_for_user
  ON public.transcripts
  FOR SELECT
  USING (user_id = (select auth.uid()));
CREATE POLICY transcripts_insert_for_user
  ON public.transcripts
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON public.transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON public.transcripts(user_id);

-- === notes ===
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text,
  position int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_select_for_user ON public.notes;
DROP POLICY IF EXISTS notes_insert_for_user ON public.notes;
DROP POLICY IF EXISTS notes_update_for_user ON public.notes;
CREATE POLICY notes_select_for_user
  ON public.notes
  FOR SELECT
  USING (user_id = (select auth.uid()));
CREATE POLICY notes_insert_for_user
  ON public.notes
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY notes_update_for_user
  ON public.notes
  FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS idx_notes_meeting_id ON public.notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- === chat_messages ===
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  message_type text DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_messages_select_for_user ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_for_user ON public.chat_messages;
CREATE POLICY chat_messages_select_for_user
  ON public.chat_messages
  FOR SELECT
  USING (user_id = (select auth.uid()));
CREATE POLICY chat_messages_insert_for_user
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON public.chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

-- === payments ===
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents int NOT NULL DEFAULT 0,
  currency text DEFAULT 'usd',
  status text DEFAULT 'pending',
  lemon_squeezy_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_select_for_user ON public.payments;
DROP POLICY IF EXISTS payments_insert_for_user ON public.payments;
CREATE POLICY payments_select_for_user
  ON public.payments
  FOR SELECT
  USING (user_id = (select auth.uid()));
CREATE POLICY payments_insert_for_user
  ON public.payments
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- === recordings / audit_logs supporting indexes (legacy db/migrations/004) ===
-- These FK child-column indexes are present in production and referenced by
-- legacy db/migrations/004_add_missing_indexes_and_constraints.sql.
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- === meeting_participants role CHECK (legacy db/migrations/004) ===
-- Mirrors the canonical migration's documented role model: host, presenter,
-- attendee (see 20250601000001_init.sql comment and the role returned by
-- accept_meeting_invitation). Idempotent.
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
