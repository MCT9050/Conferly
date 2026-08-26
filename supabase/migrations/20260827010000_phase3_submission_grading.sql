-- =============================================================================
-- 20260827010000_phase3_submission_grading.sql
--
-- PHASE 3 — teacher grading flow for classroom_submissions.
--
-- Three additive, idempotent changes. No existing column, constraint, or RLS
-- policy is modified or dropped.
--
--   1. ADD COLUMN feedback text
--      Teacher-written qualitative feedback stored beside score/graded_at.
--      Nullable; NULL means no feedback yet.
--
--   2. CHECK classroom_submissions_feedback_len (char_length(feedback) <= 5000)
--      NULL-safe by SQL semantics; keeps the DB contract aligned with the API
--      validation limit.
--
--   3. Write-privilege tightening on classroom_submissions.
--      Before this migration anon AND authenticated held table-wide
--      INSERT/UPDATE/DELETE/TRUNCATE grants. Combined with the permissive
--      "Students can manage their own submissions" FOR ALL policy, any
--      authenticated user could grade themselves (write score/graded_at) or
--      delete their graded row directly through PostgREST using the public
--      anon key — bypassing the application's teaching-role checks entirely.
--      After this migration client roles may only:
--          INSERT (assignment_id, student_id, content)
--          UPDATE (content)
--      The grading columns (score, graded_at, feedback) and DELETE/TRUNCATE
--      become service-role-only, which matches exactly how the application
--      writes (all submission mutations go through server routes on the
--      service-role client). SELECT remains granted; RLS policies continue to
--      govern which rows each role can see. No policy text changes.
--
-- Deployment ordering: apply BEFORE deploying the Phase 3 application code
-- that writes feedback. Local development DB only until promoted; production
-- is not touched by this repository state.
-- =============================================================================

ALTER TABLE public.classroom_submissions
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.classroom_submissions
  DROP CONSTRAINT IF EXISTS classroom_submissions_feedback_len;

ALTER TABLE public.classroom_submissions
  ADD CONSTRAINT classroom_submissions_feedback_len
  CHECK (char_length(feedback) <= 5000);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.classroom_submissions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.classroom_submissions FROM authenticated;

GRANT INSERT (assignment_id, student_id, content)
  ON TABLE public.classroom_submissions TO authenticated;
GRANT UPDATE (content)
  ON TABLE public.classroom_submissions TO authenticated;
