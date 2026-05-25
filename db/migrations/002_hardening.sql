-- db/migrations/002_hardening.sql
-- Security and performance hardening for Supabase/Postgres.
-- Fix RLS scope, remove overly permissive meetings policies, enable safe auth policy evaluation,
-- add missing foreign-key indexes, drop advisor-flagged unused indexes, and lock down functions.

-- 1. Meetings RLS hardening and removal of permissive policies.
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meetings') THEN
    EXECUTE 'ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY';
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='meetings' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.meetings', r.polname);
    END LOOP;
    EXECUTE $pol$
      CREATE POLICY meetings_select_for_participants
        ON public.meetings
        FOR SELECT
        USING (
          owner = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = public.meetings.id AND mp.user_id = (select auth.uid())
          )
        );

      CREATE POLICY meetings_insert_owner_only
        ON public.meetings
        FOR INSERT
        WITH CHECK (owner = (select auth.uid()));

      CREATE POLICY meetings_modify_owner_only
        ON public.meetings
        FOR UPDATE, DELETE
        USING (owner = (select auth.uid()))
        WITH CHECK (owner = (select auth.uid()));
    $pol$;
  END IF;
END$$;

-- 2. Improve auth policy evaluation by using (select auth.uid()) in existing core tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS profiles_owner_full_access ON public.profiles;
    EXECUTE $pol$
      CREATE POLICY profiles_owner_full_access
        ON public.profiles
        FOR ALL
        USING ((select auth.uid()) = id)
        WITH CHECK ((select auth.uid()) = id);
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_participants') THEN
    ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS participants_insert_self_or_inviter ON public.meeting_participants;
    DROP POLICY IF EXISTS participants_select_for_member_or_owner ON public.meeting_participants;
    DROP POLICY IF EXISTS participants_modify_own ON public.meeting_participants;
    EXECUTE $pol$
      CREATE POLICY participants_insert_self_or_inviter
        ON public.meeting_participants
        FOR INSERT
        WITH CHECK (
          user_id = (select auth.uid()) OR invited_by = (select auth.uid())
        );

      CREATE POLICY participants_select_for_member_or_owner
        ON public.meeting_participants
        FOR SELECT
        USING (
          user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.meetings m
            WHERE m.id = public.meeting_participants.meeting_id
              AND m.owner = (select auth.uid())
          )
        );

      CREATE POLICY participants_modify_own
        ON public.meeting_participants
        FOR UPDATE, DELETE
        USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='presentations') THEN
    ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS presentations_select_for_members ON public.presentations;
    DROP POLICY IF EXISTS presentations_insert_for_member ON public.presentations;
    EXECUTE $pol$
      CREATE POLICY presentations_select_for_members
        ON public.presentations
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.presentations.meeting_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );

      CREATE POLICY presentations_insert_for_member
        ON public.presentations
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.presentations.meeting_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='slides') THEN
    ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS slides_select_for_members ON public.slides;
    DROP POLICY IF EXISTS slides_insert_for_members ON public.slides;
    EXECUTE $pol$
      CREATE POLICY slides_select_for_members
        ON public.slides
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.presentations p JOIN public.meetings m ON p.meeting_id = m.id
            WHERE p.id = public.slides.presentation_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );

      CREATE POLICY slides_insert_for_members
        ON public.slides
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.presentations p JOIN public.meetings m ON p.meeting_id = m.id
            WHERE p.id = public.slides.presentation_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recordings') THEN
    ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS recordings_select_for_members ON public.recordings;
    DROP POLICY IF EXISTS recordings_insert_for_members ON public.recordings;
    EXECUTE $pol$
      CREATE POLICY recordings_select_for_members
        ON public.recordings
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.recordings.meeting_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );

      CREATE POLICY recordings_insert_for_members
        ON public.recordings
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.recordings.meeting_id
              AND (
                m.owner = (select auth.uid())
                OR EXISTS (
                  SELECT 1 FROM public.meeting_participants mp
                  WHERE mp.meeting_id = m.id AND mp.user_id = (select auth.uid())
                )
              )
          )
        );
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS audit_logs_insert_by_actor ON public.audit_logs;
    DROP POLICY IF EXISTS audit_logs_select_none ON public.audit_logs;
    EXECUTE $pol$
      CREATE POLICY audit_logs_insert_by_actor
        ON public.audit_logs
        FOR INSERT
        WITH CHECK (actor = (select auth.uid()));

      CREATE POLICY audit_logs_select_none
        ON public.audit_logs
        FOR SELECT
        USING (false);
    $pol$;
  END IF;
END$$;

-- 3. Add missing policies for analytics_events and subscriptions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analytics_events') THEN
    ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_events', r.polname);
    END LOOP;
    EXECUTE $pol$
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
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscriptions', r.polname);
    END LOOP;
    EXECUTE $pol$
      CREATE POLICY subscriptions_owner_only
        ON public.subscriptions
        FOR SELECT, UPDATE, DELETE
        USING (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()));

      CREATE POLICY subscriptions_insert_owner_only
        ON public.subscriptions
        FOR INSERT
        WITH CHECK (user_id = (select auth.uid()));
    $pol$;
  END IF;
END$$;

-- 4. Add missing policies for transcripts, notes, chat_messages, and payments.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transcripts') THEN
    ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='transcripts' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.transcripts', r.polname);
    END LOOP;
    EXECUTE $pol$
      CREATE POLICY transcripts_select_for_user
        ON public.transcripts
        FOR SELECT
        USING (user_id = (select auth.uid()));

      CREATE POLICY transcripts_insert_for_user
        ON public.transcripts
        FOR INSERT
        WITH CHECK (user_id = (select auth.uid()));
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notes') THEN
    ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='notes' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.notes', r.polname);
    END LOOP;
    EXECUTE $pol$
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
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_messages') THEN
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', r.polname);
    END LOOP;
    EXECUTE $pol$
      CREATE POLICY chat_messages_select_for_user
        ON public.chat_messages
        FOR SELECT
        USING (user_id = (select auth.uid()));

      CREATE POLICY chat_messages_insert_for_user
        ON public.chat_messages
        FOR INSERT
        WITH CHECK (user_id = (select auth.uid()));
    $pol$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='payments' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', r.polname);
    END LOOP;
    EXECUTE $pol$
      CREATE POLICY payments_select_for_user
        ON public.payments
        FOR SELECT
        USING (user_id = (select auth.uid()));

      CREATE POLICY payments_insert_for_user
        ON public.payments
        FOR INSERT
        WITH CHECK (user_id = (select auth.uid()));
    $pol$;
  END IF;
END$$;

-- 5. Add missing indexes for child foreign-key columns.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON public.chat_messages(meeting_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notes') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transcripts') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON public.transcripts(user_id)';
  END IF;
END$$;

-- 6. Drop unused advisor-flagged indexes.
DROP INDEX IF EXISTS public.idx_meetings_room_code;
DROP INDEX IF EXISTS public.idx_transcripts_meeting;
DROP INDEX IF EXISTS public.idx_notes_meeting;
DROP INDEX IF EXISTS public.idx_payments_user;

-- 7. Lock down function search_path and execution privileges.
DO $$
DECLARE
  func regprocedure;
BEGIN
  FOR func IN
    SELECT oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND proname IN ('handle_new_user', 'rls_auto_enable')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', func);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', func);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', func);
  END LOOP;
END$$;

-- 8. Note: enable leaked password protection in Supabase Auth settings.
-- Supabase dashboard step: Auth -> Settings -> Password policies -> Enable "Leaked password protection" (HaveIBeenPwned).
