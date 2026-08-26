-- =============================================================================
-- 20260827000000_phase2_class_concurrency_atomic.sql
--
-- PHASE 2 — class-domain concurrency hardening.
--
-- Two SECURITY DEFINER RPCs that give the application an authoritative,
-- database-enforced guarantee for the two class flows previously vulnerable
-- to concurrent requests:
--
--   1. enforce_classroom_capacity_atomic(p_classroom_id uuid, p_owner_id uuid,
--                                       p_requesting_role text)
--      Locks the classroom row (SELECT ... FOR UPDATE), counts verified
--      enrollments, and returns a JSON decision. The lock is what makes the
--      allow/deny race-safe; the function is otherwise a pure read.
--
--   2. launch_class_lesson_atomic(p_lesson_id uuid)
--      Performs a single guarded UPDATE on classroom_lessons that flips the
--      lesson from 'scheduled' to 'live' and assigns a stable livekit_room_id
--      if not already set. The WHERE status = 'scheduled' guard on the UPDATE
--      is the source of atomicity.
--
-- Both functions are restricted to service_role EXECUTE; they are NOT exposed
-- to PostgREST for anon/authenticated callers.
--
-- Live production is read-only; this file only runs on a fresh local DB
-- (supabase db reset). It is additive and idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. enforce_classroom_capacity_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_classroom_capacity_atomic(
  p_classroom_id    uuid,
  p_owner_id        uuid,
  p_requesting_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_limit     int  := 2;
  v_student_limit     int  := 10;
  v_plan              text := NULL;
  v_participant_cap   int  := NULL;
  v_teacher_count     int  := 0;
  v_student_count     int  := 0;
  v_requester_teacher boolean := false;
  v_requester_student boolean := false;
BEGIN
  -- Lock the classroom row so concurrent joiners serialize through this
  -- function and the counts below are authoritative.
  PERFORM 1
  FROM public.classrooms
  WHERE id = p_classroom_id
  FOR UPDATE;

  -- Resolve owner's active Class subscription. None means the classroom
  -- cannot host live sessions.
  SELECT plan, participant_cap
    INTO v_plan, v_participant_cap
  FROM public.subscriptions
  WHERE user_id = p_owner_id
    AND product_line = 'class'
    AND status = 'active'
  LIMIT 1;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No active Class subscription for this classroom owner.'
    );
  END IF;

  IF v_plan IN ('class_10', 'class_20', 'class_30') THEN
    v_student_limit := CASE v_plan
      WHEN 'class_10' THEN 10
      WHEN 'class_20' THEN 20
      WHEN 'class_30' THEN 30
    END;
    v_teacher_limit := 2;
  ELSIF v_plan = 'class_custom' THEN
    v_student_limit := COALESCE(v_participant_cap, 0);
    v_teacher_limit := 2;
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Plan %s is not supported for Class capacity.', v_plan)
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE role IN ('instructor','ta')     AND student_id <> p_owner_id),
    COUNT(*) FILTER (WHERE role IN ('student',  'auditor') AND student_id <> p_owner_id)
    INTO v_teacher_count, v_student_count
  FROM public.classroom_enrollments
  WHERE classroom_id = p_classroom_id
    AND enrollment_status = 'active';

  v_teacher_count := v_teacher_count + 1;

  v_requester_teacher := p_requesting_role IN ('owner','instructor','ta');
  v_requester_student := p_requesting_role IN ('student','auditor');

  IF v_requester_teacher AND v_teacher_count > v_teacher_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  format('Teacher limit reached (%s).', v_teacher_limit),
      'capacity', jsonb_build_object(
        'teacher_limit', v_teacher_limit,
        'student_limit', v_student_limit,
        'plan',          v_plan
      ),
      'counts', jsonb_build_object(
        'teacher_count', v_teacher_count,
        'student_count', v_student_count
      )
    );
  END IF;

  IF v_requester_student AND v_student_count > v_student_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  format('Student seat limit reached (%s).', v_student_limit),
      'capacity', jsonb_build_object(
        'teacher_limit', v_teacher_limit,
        'student_limit', v_student_limit,
        'plan',          v_plan
      ),
      'counts', jsonb_build_object(
        'teacher_count', v_teacher_count,
        'student_count', v_student_count
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'capacity', jsonb_build_object(
      'teacher_limit', v_teacher_limit,
      'student_limit', v_student_limit,
      'plan',          v_plan
    ),
    'counts', jsonb_build_object(
      'teacher_count', v_teacher_count,
      'student_count', v_student_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_classroom_capacity_atomic(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_classroom_capacity_atomic(uuid, uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. launch_class_lesson_atomic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.launch_class_lesson_atomic(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson record;
  v_new_room_id text;
  v_updated record;
BEGIN
  -- Lock the lesson row for the duration of the transition.
  SELECT id, classroom_id, status, livekit_room_id
    INTO v_lesson
  FROM public.classroom_lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_lesson.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelled');
  END IF;

  IF v_lesson.status = 'live' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'lesson_id',      v_lesson.id,
      'livekit_room_id', v_lesson.livekit_room_id,
      'status',         'live',
      'already_live',   true
    );
  END IF;

  IF v_lesson.status <> 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_scheduled');
  END IF;

  v_new_room_id := COALESCE(
    NULLIF(v_lesson.livekit_room_id, ''),
    'class-' || v_lesson.classroom_id::text || '-' || v_lesson.id::text
  );

  UPDATE public.classroom_lessons
     SET status = 'live',
         livekit_room_id = v_new_room_id
   WHERE id = p_lesson_id
     AND status = 'scheduled'
  RETURNING id, status, livekit_room_id, classroom_id
       INTO v_updated;

  IF NOT FOUND THEN
    -- Concurrent request won the race; re-read for the authoritative post-state.
    SELECT id, status, livekit_room_id, classroom_id
      INTO v_updated
    FROM public.classroom_lessons
    WHERE id = p_lesson_id;

    RETURN jsonb_build_object(
      'ok', true,
      'lesson_id',      v_updated.id,
      'livekit_room_id', v_updated.livekit_room_id,
      'status',         v_updated.status,
      'already_live',   (v_updated.status = 'live')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lesson_id',      v_updated.id,
    'livekit_room_id', v_updated.livekit_room_id,
    'status',         v_updated.status,
    'already_live',   false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.launch_class_lesson_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.launch_class_lesson_atomic(uuid) TO service_role;

