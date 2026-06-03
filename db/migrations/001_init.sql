-- db/migrations/001_init.sql
-- Initial database schema and Row Level Security (RLS) policies for Conferly
-- Designed for Supabase (Postgres) production usage. Apply with the Supabase
-- SQL editor, `supabase db push`, or `psql` using your production database URL.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Profiles (user metadata) - linked to Supabase Auth `auth.users`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  locale text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_owner_full_access ON profiles;
CREATE POLICY profiles_owner_full_access
  ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- Meetings - core meeting records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid REFERENCES auth.users ON DELETE SET NULL,
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_public boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS owner uuid REFERENCES auth.users ON DELETE SET NULL;

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_select_for_participants ON meetings;
CREATE POLICY meetings_select_for_participants
  ON meetings
  FOR SELECT
  USING (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM meeting_participants mp
      WHERE mp.meeting_id = meetings.id
        AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS meetings_insert_owner_only ON meetings;
CREATE POLICY meetings_insert_owner_only
  ON meetings
  FOR INSERT
  WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS meetings_modify_owner_only_update ON meetings;
CREATE POLICY meetings_modify_owner_only_update
  ON meetings
  FOR UPDATE
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

-- NOTE: no WITH CHECK allowed for FOR DELETE
DROP POLICY IF EXISTS meetings_modify_owner_only_delete ON meetings;
CREATE POLICY meetings_modify_owner_only_delete
  ON meetings
  FOR DELETE
  USING (owner = auth.uid());

-- -----------------------------------------------------------------------------
-- Meeting participants - membership and role assignment
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'attendee', -- host, presenter, attendee
  invited_by uuid REFERENCES auth.users,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS participants_insert_self_or_inviter ON meeting_participants;
CREATE POLICY participants_insert_self_or_inviter
  ON meeting_participants
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR invited_by = auth.uid()
  );

DROP POLICY IF EXISTS participants_select_for_member_or_owner ON meeting_participants;
CREATE POLICY participants_select_for_member_or_owner
  ON meeting_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.id = meeting_participants.meeting_id
        AND m.owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS participants_modify_own_update ON meeting_participants;
CREATE POLICY participants_modify_own_update
  ON meeting_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTE: no WITH CHECK allowed for FOR DELETE
DROP POLICY IF EXISTS participants_modify_own_delete ON meeting_participants;
CREATE POLICY participants_modify_own_delete
  ON meeting_participants
  FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Presentations and slides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  content jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presentations_select_for_members ON presentations;
CREATE POLICY presentations_select_for_members
  ON presentations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.id = presentations.meeting_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS presentations_insert_for_member ON presentations;
CREATE POLICY presentations_insert_for_member
  ON presentations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.id = presentations.meeting_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS slides_select_for_members ON slides;
CREATE POLICY slides_select_for_members
  ON slides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM presentations p
      JOIN meetings m ON p.meeting_id = m.id
      WHERE p.id = slides.presentation_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS slides_insert_for_members ON slides;
CREATE POLICY slides_insert_for_members
  ON slides
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM presentations p
      JOIN meetings m ON p.meeting_id = m.id
      WHERE p.id = slides.presentation_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Recordings and audit logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid REFERENCES auth.users,
  action text NOT NULL,
  object_type text,
  object_id uuid,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recordings_select_for_members ON recordings;
CREATE POLICY recordings_select_for_members
  ON recordings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.id = recordings.meeting_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS recordings_insert_for_members ON recordings;
CREATE POLICY recordings_insert_for_members
  ON recordings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.id = recordings.meeting_id
        AND (
          m.owner = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM meeting_participants mp
            WHERE mp.meeting_id = m.id
              AND mp.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS audit_logs_insert_by_actor ON audit_logs;
CREATE POLICY audit_logs_insert_by_actor
  ON audit_logs
  FOR INSERT
  WITH CHECK (actor = auth.uid());

DROP POLICY IF EXISTS audit_logs_select_none ON audit_logs;
CREATE POLICY audit_logs_select_none
  ON audit_logs
  FOR SELECT
  USING (false);

-- -----------------------------------------------------------------------------
-- Helpful indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meetings_owner ON meetings(owner);
CREATE INDEX IF NOT EXISTS idx_participants_meeting_user ON meeting_participants(meeting_id, user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_meeting ON presentations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_slides_presentation_pos ON slides(presentation_id, position);