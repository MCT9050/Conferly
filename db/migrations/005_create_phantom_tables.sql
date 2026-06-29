-- db/migrations/005_create_phantom_tables.sql
-- Creates tables that were referenced in RLS policies but never had DDL in version control:
-- analytics_events, transcripts, notes, chat_messages, payments.
-- =============================================================================
-- All statements are idempotent (IF NOT EXISTS).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. analytics_events
-- =============================================================================
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

-- =============================================================================
-- 2. transcripts
-- =============================================================================
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

-- =============================================================================
-- 3. notes
-- =============================================================================
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

-- =============================================================================
-- 4. chat_messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  message_type text DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. payments
-- =============================================================================
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

-- =============================================================================
-- Indexes for phantom tables
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_meeting_id ON notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

COMMIT;