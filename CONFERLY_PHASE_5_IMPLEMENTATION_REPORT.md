# Conferly — Phase 5 Implementation Report

Scope: approved items **Fix-1** and **Fix-2** only, implemented in that order.
Everything in the explicit do-not-implement list was left untouched.

---

## 1. What was implemented

### Fix-1 — P0: `classroom_lessons` can now reach `'completed'`

- **New migration** `supabase/migrations/20260827050000_phase5_class_lesson_completed.sql`
  (additive; no migration history edited):
  - `DROP CONSTRAINT IF EXISTS classroom_lessons_status_check;`
  - re-`ADD CONSTRAINT classroom_lessons_status_check CHECK (status IN
    ('scheduled','live','recorded','cancelled','completed'));`
  - All four legacy states preserved verbatim. **No speculative columns added**
    (no `ended_at`, no `completed_at`). The P4-2a RPC semantics, row locking
    (`FOR UPDATE` + guarded UPDATE), service-role-only EXECUTE, and idempotency
    are untouched — the constraint was the sole defect.
  - Header documents that production carries the same deficient constraint and
    must eventually receive the same DDL. Production NOT modified.

### Fix-1 — corrected Phase 4 DB verification assertions

`tests/phase4-db-verification.sql` corrections (first honest execution of this
suite surfaced three latent fixture/assertion bugs, all fixed):

1. **PC3 asserted an `ended_at` key the RPC never returns** → now asserts the
   real contract (`ok`, `status='completed'`, `already_completed`) plus a new
   PC3b row-persistence check (`status = 'completed'` on the lesson row).
2. **PC4 relabelled/completed** to `completed-idempotent` asserting
   `already_completed=true` on replay.
3. **Invalid meeting fixture UUID** `…dddddddddddd4` (13-char final group) →
   valid `'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'`.
4. **Meeting fixture violated production-parity NOT NULLs** (`user_id`
   NOT NULL → `profiles(id)` FK, `room_code` NOT NULL) → fixture now inserts a
   matching `public.profiles` row and supplies `owner`, `user_id`, `room_code`;
   cleanup extended to delete the profile.
5. **PB3 duration expectation was arithmetically wrong**: fixture is
   `started_at = now()-10s`, terminated at `now()+5s` ⇒ ~15 s, so the plausible
   window is now `between 14 and 16` (was `between 4 and 6`).

### Fix-1 — new Phase 5 regression suite

`tests/phase5-db-verification.sql` encodes every acceptance criterion:
direct INSERT of each legal state (**a missing `'completed'` aborts the suite
via ON_ERROR_STOP — the regression cannot be overlooked**), constraint-definition
introspection requiring all five literals, illegal-status rejection (`'foo'`
must raise `check_violation`), `live→completed` via the real RPC + row
persistence, replay idempotency, negative guards
(`scheduled/cancelled → completed` refused with state unchanged,
`completed → completed` no-op), end-of-cycle state counts, self-cleanup with
residue check, and pre-clean for deterministic re-runs after aborted runs.

---

## 2. Proposals that required correction during implementation

1. **Fix-2's original "stop client containers" premise was insufficient.**
   Root-causing the reset hang showed `supabase db reset --local` *itself*
   starts stack services mid-flight; the analytics/logflare container then
   grabs a logical-replication connection to `_supabase`, stalling the recreate.
   The runner therefore **removes** those containers (`docker rm -f`) before
   resetting and restores the stack via `supabase start --ignore-health-check`
   afterwards.
2. **The CLI reset step is flaky under Docker Desktop/WSL** (hung at
   "Recreating database…" even with a healthy container). The runner wraps the
   reset in up to **3 bounded attempts** (`timeout -k 10 240`) and requires the
   CLI's own success marker ("Finished supabase db reset").
3. **A planned "flag bare `f` cells" output scan was removed before shipping:**
   suites legitimately print false-valued evidence columns (e.g.
   `already_completed=f` on a first transition). It was replaced by
   authoritative catalog invariants (below), which cannot false-positive.

---

## 3. Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260827050000_phase5_class_lesson_completed.sql` | NEW — Fix-1 DDL |
| `tests/phase5-db-verification.sql` | NEW — Fix-1 regression suite |
| `scripts/verify-db.sh` | NEW (+x) — Fix-2 fail-fast verification runner |
| `package.json` | adds `"verify:db": "bash scripts/verify-db.sh"` |
| `tests/phase4-db-verification.sql` | assertion/fixture corrections (§1) |

No application source, RLS, RPC logic, or configuration semantics changed.

---

## 4. Migrations added

- `20260827050000_phase5_class_lesson_completed.sql` — the only migration.
  Idempotent (`DROP CONSTRAINT IF EXISTS` → re-ADD); touches no data and no
  other object. Static SQL check: OK.

## 5. Security changes

None intended, none made. (Invariant #6 continuously re-proves the P4-1
lockdown: no INSERT/UPDATE/DELETE grants on `meeting_participants` for
anon/authenticated.)

## 6. Concurrency guarantees

Unchanged by design: `cancel/end_class_lesson_atomic` keep `SELECT … FOR UPDATE`
serialization plus guarded single-row UPDATEs; the widened CHECK only expands
the legal value set and cannot affect lock ordering or race outcomes.

---


## 7. Verification results — the acceptance chain, actually executed

`bash scripts/verify-db.sh` (also `npm run verify:db`) was run end-to-end and
printed, verbatim:

```
==> [0/6] Removing stack client containers (prevents replication-lock race)
==> [1/6] Resetting local database (fresh, all migrations)
    reset attempt 1/3
Applying migration 20260827050000_phase5_class_lesson_completed.sql...
Finished supabase db reset on branch feat/flexible-classroom-seating.
==> [2/6] Post-migration invariants (authoritative DB facts)
    ok    phase5 migration applied
    ok    classroom_lessons CHECK admits completed
    ok    classroom_lessons CHECK keeps legacy states
    ok    lesson lifecycle RPCs present
    ok    meeting termination RPC present
    ok    P4-1 holds: no DML on meeting_participants for client roles
==> [3/6] Running tests/phase2-db-verification.sql   PASS
==> [4/6] Running tests/phase3-db-verification.sql   PASS
==> [5/6] Running tests/phase4-db-verification.sql   PASS
==> [6/6] Running tests/phase5-db-verification.sql   PASS
ALL DB SUITES PASSED (fresh reset -> phase2 -> phase3 -> phase4 -> phase5)
```

Live catalog after the run:

```
classroom_lessons_status_check:
CHECK ((status = ANY (ARRAY['scheduled','live','recorded','cancelled','completed'])))
```

Phase 5 suite detail (from the passing run): all five states insertable;
constraint definition contains all five literals; `'foo'` rejected;
**live → completed: `ok=true, status=completed`, row persisted as completed**;
replay idempotent (`already_completed=t`, state unchanged);
`scheduled → completed refused (not_live)`, row unchanged;
`cancelled → completed refused (cancelled)`, row unchanged;
`completed → completed` no-op; final counts 1/0/1/1/2
(scheduled/live/recorded/cancelled/completed); cleanup residue = 0.

Static gates: `static_sql_check.py` OK on all migrations incl. the new one;
`tsc --noEmit` clean; `package.json` parses. (No TS/ESLint-touched files — this
phase changed only SQL, bash, and package.json.)

## 8. Remaining known issues

- **Fix-1's production schema change remains pending by design.** The Phase 5
  CHECK-constraint DDL (`20260827050000_phase5_class_lesson_completed.sql`) —
  like the earlier Phase 2–4 migrations and the P4-1 privilege REVOKE — has
  been applied and verified on the local database only. Applying it to
  production remains an explicit, separate ops task; production was untouched.
- **Fix-2 is local verification tooling with no production deployment
  requirement.** `scripts/verify-db.sh` (and its `npm run verify:db` entry)
  operates exclusively against the local Supabase container
  (`127.0.0.1:54322`, `supabase db reset --local`); nothing about it ships to,
  or needs configuration in, production.
- The local stack's non-DB services (analytics/vector/auth/kong/inbucket) do
  not reliably start in this Docker Desktop environment; `supabase start`
  restores what it can. Verification only requires the DB container, which is
  healthy.

## 9. Deliberately deferred

Exactly the list in the authorization, untouched: `participant_count`;
recording/Egress pipeline; `has_recording`; recordings lifecycle; `is_public`
UX; `due_at` enforcement; classroom-creation entitlement gating;
assignment/grading plan gating; presentations/slides wiring;
`ROLE_PERMISSIONS` cleanup; `meetings.owner`/`user_id` consolidation;
production rollout of the P4-1 REVOKE. No speculative `ended_at`/
`completed_at` column was added either.

## 10. Exact Git state

- Branch `feat/flexible-classroom-seating`, HEAD `64df837` (unchanged).
- All work **unstaged and uncommitted**; nothing pushed. No production changes.
- New/untracked this phase:
  `supabase/migrations/20260827050000_phase5_class_lesson_completed.sql`,
  `tests/phase5-db-verification.sql`, `scripts/verify-db.sh`,
  `CONFERLY_PHASE_5_IMPLEMENTATION_REPORT.md`.
- Modified this phase: `tests/phase4-db-verification.sql`,
  `package.json`. (All other modified files predate Phase 5 — Phases 2–4.)

---

## Phase 5 closure statement

Phase 5 is **CLOSED** with completed scope **Fix-1 + Fix-2 only**:

- **P0 regression resolved:** `classroom_lessons.status` legally admits
  `'completed'`; the approved P4-2a `live → completed` transition now works.
- **Fresh local DB verification actually executed** via the new repeatable
  runner: reset → Phase 2 PASS → Phase 3 PASS → Phase 4 PASS → Phase 5 PASS.
- **`live → completed` proven against the real database**, idempotent on
  replay; **negative transition guards proven**
  (`scheduled/cancelled/completed → completed` refused/no-op, illegal values
  rejected).
- The verification runner is repeatable and fail-fast.
- **Production was untouched**; all deferred items remain deferred.
- Git state: everything unstaged/uncommitted, unpushed.

**STOP.** No further implementation work. The final Phase 1–5 integration
review is a separate, subsequent task and has not been started.