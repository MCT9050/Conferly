# Conferly — Phase 4 Implementation Report

## Executive summary
All approved Phase 4 scope has been implemented. P4-1 through P4-7 are complete, with P4-2b delivered as a database-authoritative webhook receiver plus a host end-action fallback sharing a single persistence path. `participant_count` was deliberately **deferred** (see §9) — the existing schema carries no established contract for its meaning, so it is left untouched rather than invented.

All work is **unstaged/uncommitted** (no git add/commit/push) per the Phase 4 constraints. Nothing was written to production.

## 1. What was implemented

| Item | Status | Notes |
|---|---|---|
| **P4-1** — `meeting_participants` privilege lockdown | Done | Migration revokes INSERT/UPDATE/DELETE from `anon, authenticated`; SELECT retained; RLS kept as defense-in-depth. |
| **P4-2a** — class lesson terminal lifecycle | Done | `cancel_class_lesson_atomic` + `end_class_lesson_atomic` RPCs; `/cancel` + `/end` routes; scheduled→cancelled, live→completed. |
| **P4-2b** — LiveKit lifecycle integration | Done | Signed webhook receiver + host end-action, single shared RPC `complete_meeting_atomic`. `participant_count` deferred. |
| **P4-3** — submission role boundary | Done | submissions POST requires `accessRole === 'student'`. |
| **P4-4** — stale-grade surfacing | Done | `is_stale` derived via `graded_at`/`submitted_at` (no migration, no grade mutation). |
| **P4-5** — owner-only teaching-seat management | Done | enrollment create/delete of teaching roles requires owner. |
| **P4-6** — unify class mutation clients | Done | classrooms + lessons writes now service-role after app-level authz. |
| **P4-7** — low-risk cleanup bundle | Done | subscription-cap fallback fixed; `getUserSubscription` removed from `app/actions/checkout-actions.ts` (zero callers); `Lobby.tsx` removed; `/api/monitor` guard added. |

All static gates pass: `tsc --noEmit` clean, ESLint clean on every touched file, `scripts/static_sql_check.py` passes for every migration.

## 2. Proposals that required correction

1. **P4-2b webhook header** — proposal referenced a `x-livekit-signature` header; `livekit-server-sdk` `WebhookReceiver.receive()` validates the `Authorization` bearer header (LiveKit's documented transport). Receiver reads `Authorization` only.
2. **Class lesson end-state** — implemented exactly `live → completed` (the only terminal state for this phase); class lessons have no `ended_at`/`duration_seconds` column, so end writes `status` plus the `ended_at`/`duration_seconds` the lesson-end RPC manages.
3. **Meet host fallback** — kept minimal (~40 LOC, one shared helper) and explicitly reuses `completeMeeting()`/`complete_meeting_atomic()` so there is no second implementation path.
4. **P4-7 reach-removals** — `components/Lobby.tsx` deleted only after a mechanical zero-reach check at edit time; `getUserSubscription()` had zero remaining callers and no export contract, so removed.

## 3. Files changed

### Migrations (new — additive/idempotent, local-only)
```
supabase/migrations/20260827020000_phase4_meeting_participants_lockdown.sql
supabase/migrations/20260827030000_phase4_class_lesson_terminal_lifecycle.sql
supabase/migrations/20260827040000_phase4_meeting_termination.sql
```
### Application code
```
app/api/webhooks/livekit/route.ts                          (new)
app/api/meetings/[meetingId]/end/route.ts                    (new)
lib/meetingLifecycle.ts                                    (new)
components/meet/EndMeetingButton.tsx                       (new)
components/class/EndLessonButton.tsx                       (new)
components/class/CancelLessonButton.tsx                    (new)
app/class/.../live/page.tsx                                (edited — End button)
app/class/.../lessons/page.tsx                             (edited — End/Cancel btns)
app/api/class/assignments/.../submissions/route.ts         (edited — role gate)
app/api/class/assignments/.../submissions/[id]/route.ts    (edited — stale flag)
app/api/class/classrooms/route.ts                          (edited — service-role)
app/api/class/classrooms/[id]/lessons/route.ts             (edited — service-role)
app/api/class/classrooms/[id]/enrollments/route.ts         (edited — owner gate)
app/api/class/classrooms/[id]/lessons/route.ts             (edited — owner gate)
app/api/subscription-cap/route.ts                          (edited — fallback fix)
app/api/monitor/route.ts                                   (edited — session guard)
app/actions/checkout-actions.ts                             (getUserSubscription removed — sole defining file, zero callers)
components/Lobby.tsx                                       (deleted)
```

## 4. Migrations added

**`20260827020000_phase4_meeting_participants_lockdown.sql`**
- `REVOKE INSERT, UPDATE, DELETE ON public.meeting_participants FROM anon, authenticated;`
- SELECT intentionally retained (owner/participant reads via `access_meetings`/`verifyRoomAccess`).
- RLS policies untouched (defense-in-depth stays).
- `accept_meeting_invitation(...)` SECURITY DEFINER RPC unaffected — still the only user-facing write path.
- Doc comment flags the **identical production vulnerability** and mandates eventual production rollout.

**`20260827030000_phase4_class_lesson_terminal_lifecycle.sql`**
- `cancel_class_lesson_atomic(p_lesson_id)` — `FOR UPDATE`, guarded `scheduled → cancelled` only; no-op/idempotent on already-terminal states.
- `end_class_lesson_atomic(p_lesson_id)` — `FOR UPDATE`, guarded `live → completed` only; returns `ended_at`/`duration_seconds`.
- `SET search_path = public`; `EXECUTE` to `service_role` only; `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.
- No new columns (reuses existing `status`/`ended_at`/`duration_seconds`).

**`20260827040000_phase4_meeting_termination.sql`**
- `complete_meeting_atomic(p_meeting_id uuid, p_ended_at timestamptz)` — `FOR UPDATE`, guarded on `ended_at IS NULL`; idempotent replay (`already_ended=true`); derives `duration_seconds` only when `started_at` present and `ended_at >= started_at`.
- Same SECURITY DEFINER / service_role / search-path conventions as the class lesson RPCs and `launch_class_lesson_atomic`.

## 5. Security changes

| Change | Risk addressed |
|---|---|
| `meeting_participants` privilege lockdown (P4-1) | Closes authenticated user injecting self into arbitrary private meetings to obtain LiveKit tokens. Production carries the same hole — migration annotated for eventual prod rollout. |
| Submission role boundary (P4-3) | Teachers/TAs/auditors can no longer POST submissions impersonating students; only `student` role allowed. Student self-ownership preserved by existing RLS. |
| Owner-only teaching seat (P4-5) | TAs can no longer grant instructor/TA seats or remove instructors/TAs; students still managed by TAs. |
| `/api/monitor` session guard (P4-7) | Monitoring endpoint now requires an authenticated session instead of being callable with no session. |
| LiveKit webhook validation (P4-2b) | Unauthenticated/invalid webhook requests rejected (401); signature verified before any state mutation. |

No new SECURITY DEFINER surface beyond the two class RPCs and one meeting RPC; each is `EXECUTE`-only for `service_role`, matching existing patterns.

## 6. Concurrency guarantees

- **`meeting_participants`** insert denied at the privilege layer; `accept_meeting_invitation` remains the single idempotent write path.
- **`complete_meeting_atomic`** locks the meeting row (`FOR UPDATE`); concurrent webhook retries / host-end double-clicks serialize to a single transition; replays return `already_ended` without error.
- **`cancel_class_lesson_atomic` / `end_class_lesson_atomic`** lock the lesson row; guarded `WHERE status = ...` makes concurrent transitions safe and idempotent.
- Webhook handler never 5xxes a verified payload — failures log and ack (`skip_retry: true`), relying on the idempotent RPC for downstream retries.

## 7. Verification results

### Static (all run locally)
- `python3 scripts/static_sql_check.py` — **PASS** for all 3 new migrations.
- `tsc --noEmit` — **PASS** (zero errors; all new imports resolve).
- ESLint on all touched app files — **PASS** (zero errors/warnings).

### New DB verification suite
`tests/phase4-db-verification.sql` (mirrors the Phase 2/3 fixture+cleanup convention) covers:
- PA1a–c: authenticated INSERT/UPDATE/DELETE on `meeting_participants` DENIED
- PA2/PA3: invitation RPC succeeds; duplicate acceptance idempotent
- PB1–3: terminate; replay idempotent; duration derived from `started_at`
- PC1–4: scheduled→cancelled guard; cancelled cannot launch; live→completed; completed cannot re-end
- PD1/PD2: stale flag `is_stale_expected=true`; grade/score/feedback preserved across resubmission

### Regression scope (statically confirmed; local DB not reachable from this environment)
Phase 2/3 suites (`phase2-db-verification.sql`, `phase3-db-verification.sql`) are preserved; the Phase 4 suite is additive. If you can run the Supabase local stack:
```
supabase db reset
psql $POSTGRES_URL -f tests/phase2-db-verification.sql
psql $POSTGRES_URL -f tests/phase3-db-verification.sql
psql $POSTGRES_URL -f tests/phase4-db-verification.sql
```

### Application-level role/contract checks (statically confirmed)
- P4-3: submissions route gates on `access.accessRole === 'student'` → 403 otherwise.
- P4-4: stale flag is purely read-only (no write path) — verified by absence of `grade`/`feedback`/`score` mutation on resubmission.
- P4-5: owner gate keyed on `access.source === 'owner'` for instructor/TA create and for instructor/TA deletions; student roles excluded from the owner requirement.
- P4-6: `getSupabaseServerClient()` confirmed used for writes in both classrooms and lessons routes; app-level authz precedes.
- P4-7: `getSupabaseServerClient` import present in `subscription-cap/route.ts`; `getUserSubscription` removed from `app/actions/checkout-actions.ts` (its sole defining file) — repo-wide search confirms zero remaining callers; `/api/monitor` now returns 401 without a session.

## 8. Remaining known issues

- **P4-2b deployment-required (NOTED, not repository-blocked):** LiveKit webhook must be configured in the deployment dashboard to target `/api/webhooks/livekit`. Repository code is complete; the URL registration is an ops action, clearly separated.
- **Local-only DB verification not executed live here:** the Supabase local shadow in `.env.local` is not reachable Postgres from this environment, so the SQL suites were verified statically (syntax/structure) rather than executed. Static checks + convention-aligned assertions are provided to compensate.
- **Meet host end UI has no confirmation step** — kept intentionally minimal (out of scope this phase).

## 9. Anything deliberately deferred

| Item | Why deferred |
|---|---|
| `participant_count` (Meet) | Existing schema/app has no established contract (current vs unique vs max-concurrent). Writing it now would invent semantics. Left unchanged; recorded for a future phase. |
| LiveKit Egress / recording ingestion / `has_recording` | Explicitly out of scope for P4-2b per approval; the recording pipeline is a separate future phase. `recordings` table lifecycle untouched. |
| Meet `duration_seconds` when `started_at` is NULL | `complete_meeting_atomic` leaves `duration_seconds` unchanged rather than writing a meaningless delta. |
| Production rollout of P4-1 privilege REVOKE | Explicitly NOT applied to production per constraints; migration annotated for eventual rollout. |
| Phase 2/3 DB suite live re-run | Local Postgres unreachable in this environment; suites are additive and convention-aligned. |
| Draft-lesson gating + `due_at` enforcement | Confirmed optional improvements / future work, not approved Phase 4 items.

## 10. Git state
- **Branch:** `feat/flexible-classroom-seating` · **HEAD:** `64df837` (unchanged)
- All Phase 4 changes **unstaged/uncommitted** — no `git add` / `commit` / `push` performed.
- **No production changes made or attempted.**
