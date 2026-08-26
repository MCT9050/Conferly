-- =============================================================================
-- 20260827030000_phase4_class_lesson_terminal_lifecycle.sql
--
-- PHASE 4 — P4-2a: class lesson terminal transitions.
--
-- Two SECURITY DEFINER RPCs completing the classroom_lessons state machine
-- using the exact pattern established by launch_class_lesson_atomic()
-- (Phase 2): SELECT ... FOR UPDATE on the lesson row plus a guarded
-- UPDATE ... WHERE status = '<from>' so concurrent callers serialize into one
-- winner and every loser observes an authoritative post-state.
--
--   cancel_class_lesson_atomic(p_lesson_id uuid)
--       scheduled -> cancelled      (refuses live/completed/recorded)
--       idempotent when already cancelled.
--
--   end_class_lesson_atomic(p_lesson_id uuid)
--       live -> completed           (refuses scheduled/cancelled)
--       idempotent when already completed.
--
-- Vocabulary note: this phase deliberately uses ONLY
--   scheduled -> cancelled  and  live -> completed.
-- 'recorded' and recording_url stay RESERVED for the future recording
-- pipeline; no recording semantics are introduced here.
--
-- Both functions are restricted to service_role EXECUTE; they are NOT exposed
-- to anon/authenticated PostgREST callers. Application routes authorize the
-- caller (verifyClassroomTeachingAccess) BEFORE invoking these RPCs.
--
-- Live production is read-only; this file only runs locally. Additive and
-- idempotent. No existing column/constraint/policy modified.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. cancel_class_lesson_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_class_lesson_atomic(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson   record;
  v_updated  record;
BEGIN
  -- Lock the lesson row so concurrent cancels/launches serialize here.
  SELECT id, status
    INTO v_lesson
  FROM public.classroom_lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_lesson.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'lesson_id',        v_lesson.id,
      'status',           'cancelled',
      'already_cancelled', true
    );
  END IF;

  -- Only a scheduled lesson can be cancelled. Live lessons must be ended;
  -- terminal states (completed/recorded) are immutable.
  IF v_lesson.status <> 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_scheduled');
  END IF;

  UPDATE public.classroom_lessons
     SET status = 'cancelled'
   WHERE id = p_lesson_id
     AND status = 'scheduled'
  RETURNING id, status
       INTO v_updated;

  IF NOT FOUND THEN
    -- Concurrent request won the race; report the authoritative post-state.
    SELECT id, status
      INTO v_updated
    FROM public.classroom_lessons
    WHERE id = p_lesson_id;

    RETURN jsonb_build_object(
      'ok', false,
      'reason',
      CASE WHEN v_updated.status = 'live' THEN 'live' ELSE 'conflict' END
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lesson_id',         v_updated.id,
    'status',            'cancelled',
    'already_cancelled', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_class_lesson_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_class_lesson_atomic(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. end_class_lesson_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_class_lesson_atomic(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson   record;
  v_updated  record;
BEGIN
  -- Lock the lesson row so concurrent ends serialize here.
  SELECT id, status
    INTO v_lesson
  FROM public.classroom_lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_lesson.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'lesson_id',         v_lesson.id,
      'status',            'completed',
      'already_completed', true
    );
  END IF;

  IF v_lesson.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelled');
  END IF;

  -- Only a live lesson can be ended.
  IF v_lesson.status <> 'live' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_live');
  END IF;

  UPDATE public.classroom_lessons
     SET status = 'completed'
   WHERE id = p_lesson_id
     AND status = 'live'
  RETURNING id, status
       INTO v_updated;

  IF NOT FOUND THEN
    -- Concurrent request won the race; re-read for the authoritative state.
    SELECT id, status
      INTO v_updated
    FROM public.classroom_lessons
    WHERE id = p_lesson_id;

    RETURN jsonb_build_object(
      'ok', true,
      'lesson_id',         v_updated.id,
      'status',            v_updated.status,
      'already_completed', (v_updated.status = 'completed')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lesson_id',         v_updated.id,
    'status',            'completed',
    'already_completed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.end_class_lesson_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_class_lesson_atomic(uuid) TO service_role;
