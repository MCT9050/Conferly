-- =============================================================================
-- 20260827020000_phase4_meeting_participants_lockdown.sql
--
-- PHASE 4 — P4-1: close the meeting_participants direct-write hole.
--
-- VULNERABILITY (verified against this repository AND production forensics):
--   Production carries table-wide INSERT/UPDATE/DELETE/TRUNCATE grants for
--   anon/authenticated on meeting_participants, combined with:
--     participants_insert_self_or_inviter WITH CHECK
--       ((user_id = auth.uid()) OR (invited_by = auth.uid()))
--     participants_modify_own_update USING/WITH CHECK (user_id = auth.uid())
--   The self-insert branch requires NO relationship to the target meeting.
--   Any authenticated user can therefore fabricate a participant row for any
--   private meeting via PostgREST (the anon key is public), optionally
--   escalate their own row's role column, and then obtain a full LiveKit join
--   token from /api/lk-token, whose verifyRoomAccess() trusts participant rows.
--
-- PRODUCTION IMPACT:
--   functions_and_policies.txt (production forensic capture, 2026-08-25)
--   shows byte-equivalent policies on production. THE SAME STATEMENT BELOW
--   MUST EVENTUALLY BE APPLIED TO PRODUCTION by an operator. Production is
--   read-only for this repository; until then local intentionally diverges
--   from production here as documented security hardening.
--
-- FIX:
--   Revoke all write privileges on public.meeting_participants from anon and
--   authenticated. SELECT stays granted. RLS policies are left untouched and
--   remain defense-in-depth.
--
-- WHY THIS IS SAFE FOR THE APPLICATION:
--   - No application path writes meeting_participants with a user JWT
--     (grep-verified across app/, lib/, components/, hooks/).
--   - The sanctioned membership write is accept_meeting_invitation(...),
--     SECURITY DEFINER: it executes with the function owner's privileges,
--     which role-level revokes do not affect.
--   - All other writes go through server routes on the service-role client,
--     whose grants are untouched.
--
-- Idempotent. Additive only. No policy text changes.
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.meeting_participants FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.meeting_participants FROM authenticated;

-- Pin the read contract explicitly so SELECT survives future grant churn.
GRANT SELECT ON TABLE public.meeting_participants TO anon;
GRANT SELECT ON TABLE public.meeting_participants TO authenticated;
