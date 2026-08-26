-- =============================================================================
-- 20260827040000_phase4_meeting_termination.sql
--
-- PHASE 4 — P4-2b: authoritative Meet termination persistence.
--
-- complete_meeting_atomic(p_meeting_id uuid, p_ended_at timestamptz)
--
--   Single authority for marking a meeting completed. Called by BOTH:
--     - /api/webhooks/livekit          (room_finished event, primary, server-to-server)
--     - POST /api/meetings/[id]/end    (host end-action fallback)
--
--   Sets status = 'completed', ended_at = p_ended_at, and duration_seconds
--   = epoch(p_ended_at - started_at) ONLY when started_at is present and
--   p_ended_at >= started_at (the only unambiguous derivation). Otherwise
--   duration_seconds is left unchanged so we never record a misleading number.
--
--   Idempotent: a second call (webhook retry/replay or double-click) finds
--   ended_at already set and returns already_ended=true. Guarded on ended_at
--   IS NULL so concurrent callers serialize under the row lock.
--
--   SECURITY DEFINER, SET search_path = public, EXECUTE to service_role only
--   (mirrors launch_class_lesson_atomic / enforce_classroom_capacity_atomic).
--
--   Live production is read-only; this file only runs locally. Additive and
--   idempotent. No existing column/constraint/policy modified.
--   The same statement must eventually be applied to production to close the
--   equivalent authorization/lifecycle gap surfaced in the Phase 4 recon
--   (production carries the same meeting participants hole documented there).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_meeting_atomic(
  p_meeting_id uuid,
  p_ended_at   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v  record;
BEGIN
  -- Lock the meeting row so concurrent terminators serialize here.
  SELECT id, status, started_at, ended_at, duration_seconds
    INTO v
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Already terminated (replay / retry / double-click): return existing state.
  IF v.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok',               true,
      'meeting_id',       v.id,
      'status',           v.status,
      'already_ended',    true,
      'ended_at',         v.ended_at,
      'duration_seconds', v.duration_seconds
    );
  END IF;

  -- Single guarded termination. The WHERE ended_at IS NULL guard makes the
  -- UPDATE a no-op for any concurrent caller that wins the lock first.
  UPDATE public.meetings
     SET status = 'completed',
         ended_at = p_ended_at,
         duration_seconds = CASE
           WHEN v.started_at IS NOT NULL
            AND p_ended_at >= v.started_at
           THEN COALESCE(EXTRACT(EPOCH FROM (p_ended_at - v.started_at))::int,
                         v.duration_seconds)
           ELSE v.duration_seconds
         END
   WHERE id = p_meeting_id
     AND ended_at IS NULL
  RETURNING id, status, ended_at, duration_seconds
       INTO v;

  IF NOT FOUND THEN
    -- Concurrent terminator won the race; re-read authoritative state.
    SELECT id, status, ended_at, duration_seconds
      INTO v
    FROM public.meetings
    WHERE id = p_meeting_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',               true,
    'meeting_id',       v.id,
    'status',           'completed',
    'already_ended',    false,
    'ended_at',         v.ended_at,
    'duration_seconds', v.duration_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_meeting_atomic(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_meeting_atomic(uuid, timestamptz) TO service_role;
