-- =============================================================================
-- 20260827050000_phase5_class_lesson_completed.sql
--
-- PHASE 5 — Fix-1: admit 'completed' in classroom_lessons.status.
--
-- Root cause: the Phase 4 (P4-2a) end_class_lesson_atomic() RPC transitions a
-- lesson live -> completed, but the classroom_lessons.status CHECK constraint
-- created in 20250623000001_classroom_domain.sql only admits
--     ('scheduled','live','recorded','cancelled').
-- 'completed' was therefore never a legal value, so every
-- end_class_lesson_atomic() call raised a CHECK-violation exception and live
-- lessons could never reach their completed terminal state. Production carries
-- the SAME deficient constraint (forensics2_production.json:
-- classroom_lessons_status_check) and no later migration in either chain
-- changes it.
--
-- This migration widens the CHECK to admit 'completed' while preserving every
-- existing legal state. It is additive, idempotent, and touches no data and no
-- other object. It deliberately does NOT add speculative columns
-- (ended_at / completed_at / ...): the lesson id + status remain the only
-- terminal-lifecycle contract, matching the delivered RPC return shape.
--
-- Live production is read-only; this file runs only locally. The same DDL must
-- eventually be applied to production to close the equivalent lifecycle gap.
-- =============================================================================

ALTER TABLE public.classroom_lessons
  DROP CONSTRAINT IF EXISTS classroom_lessons_status_check;

ALTER TABLE public.classroom_lessons
  ADD CONSTRAINT classroom_lessons_status_check
  CHECK (status IN ('scheduled', 'live', 'recorded', 'cancelled', 'completed'));