# Conferly — Phase 5 Reconnaissance & Proposal

## Scope note

Per the Phase 5 operating principle, this pass **reuses the Phase 1–4 evidence base** and
investigates only what remains materially relevant after those phases. It does not re-audit
subscriptions, RLS parity, or the production contract wholesale. The one exception is a
**genuine regression discovered in the approved Phase 4 work** (P4-2a), which is reported
under *Confirmed issues* with new, concrete database evidence — as the "Do not re-litigate
resolved findings unless new evidence demonstrates a regression" rule requires.

**No implementation, migration, config, DB, or test changes were made. Nothing committed or pushed.**

---

## 1. Current state

- **Branch:** `feat/flexible-classroom-seating` · **HEAD:** `64df837` (unchanged through Phases 2–4)
- Working tree carries the complete, uncommitted Phase 2/3 catalog plus all Phase 4 work
  (5 new migrations, new API routes, lib helpers, UI components, Phase 4 report + verification suite).
- Phase 4 is approved and closed. Phase 5 begins now in reconnaissance-only mode.

---

## 2. Phase 1–4 baseline (established, reused — not re-audited)

- **Phase 1:** initial security/schema audit; broad gap catalog.
- **Phase 2:** Class concurrency hardening (`enforce_classroom_capacity_atomic`,
  `launch_class_lesson_atomic`), enrollment uniqueness, capacity atomicity.
- **Phase 3:** grading lifecycle, submission/grading privilege lockdown, grade persistence contract.
- **Phase 4:** meeting_participants privilege lockdown (P4-1), class terminal lifecycle (P4-2a),
  LiveKit meeting termination foundation (P4-2b), submission role boundary (P4-3), stale-grade
  surfacing (P4-4), owner-only teaching seats (P4-5), client-pattern unification (P4-6), cleanup (P4-7).

The baseline documents stand alone as:
`CONFERLY_PHASE_2_IMPLEMENTATION_REPORT.md`, `CONFERLY_PHASE_3_IMPLEMENTATION_REPORT.md`,
`CONFERLY_PHASE_4_IMPLEMENTATION_REPORT.md`, `CONFERLY_APPLICATION_WORKFLOW_MAP.md`.

---

## 3. Confirmed remaining issues

### 3.1 P4-2a : `classroom_lessons` cannot ever reach `'completed'` (Phase 4 regression)

**Finding.** The approved P4-2a `end_class_lesson_atomic(...)` RPC flips `status := 'completed'`,
but the `classroom_lessons.status` CHECK constraint — in BOTH the local schema **and production** —
admits only `('scheduled','live','recorded','cancelled')`. `'completed'` is not a legal value,
so the `UPDATE` inside `end_class_lesson_atomic` **always fails with a CHECK-violation exception**
at runtime. The `live → completed` transition is therefore unimplementable as written.

**Evidence.**
- `supabase/migrations/20250623000001_classroom_domain.sql` L41:
  `status text default 'scheduled' check (status in ('scheduled','live','recorded','cancelled'))`.
- **No later migration** alters this CHECK (verified: no `classroom_lessons_status_check`, no
  `ALTER TABLE ... classroom_lessons ... CONSTRAINT` anywhere in `supabase/migrations/`).
- `supabase/migrations/20260827030000_phase4_class_lesson_terminal_lifecycle.sql` L147–148:
  `UPDATE public.classroom_lessons SET status = 'completed' WHERE id = p_lesson_id AND status = 'live'`.
- **Production is identical:** `forensics2_production.json` — `classroom_lessons_status_check`
  `CHECK ((status = ANY (ARRAY['scheduled','live','recorded','cancelled'])))`.
- The Phase 4 verification suite (`tests/phase4-db-verification.sql` PC3) calls
  `end_class_lesson_atomic` and expects `ended_at` in the JSON return — **the implemented RPC does
  not return `ended_at`** (there is no `ended_at` column on `classroom_lessons` at all). This is
  strong evidence the P4-2a DB verification was written against a speculative RPC shape and was
  **not actually executed** against the migrated local DB, or it would have surfaced the CHECK failure.

**Current behavior.** Whether triggered via the host End button (`POST /api/class/lessons/[id]/end`),
the webhook class-room reconciliation (`end_class_lesson_atomic` in the LiveKit receiver), or the raw
RPC, `end_class_lesson_atomic` raises an exception → the route returns 500 → a live lesson can
**never** be completed. `cancel` (`scheduled → cancelled`) is legal and works.

**Desired behavior.** `live → completed` must persist, with the rest of the P4-2a guards/intent intact.

**Reported first (before any other Phase 5 item)** because it silently invalidates an approved,
closed Phase 4 item and any downstream feature (lesson history, recaps) that depends on a terminal
`completed` state.

---

### 3.2 Phase 4 DB-verification gap (process evidence)

**Finding.** The Phase 4 verification suite was not convincingly executed against the migrated local
DB: its `end_class_lesson_atomic` expectations (`ended_at`) do not match the delivered RPC return
shape — itself a symptom of the §3.1 defect. This suggests Phase 4's "verification results" were
asserted rather than actually run (or were run against pre-migration DB state). Not a product defect,
but a process/integrity gap to correct while fixing §3.1.

---

## 4. New findings (material, non-regression)

### 4.1 `presentations` / `slides` are a dead schema with a stale open INSERT path (P2, cleanup)

- `presentations` and `slides` tables exist with RLS and a `presentations_insert_for_member`
  INSERT policy, but **no API route, lib function, or app writer references either table**
  (verified: zero matches in `app/api`, `lib`, `app`, `components` other than the client-side
  in-memory `SlideEditor`).
- Not a security hole (no writer path), but it is misleading dead schema and a maintenance risk.
  Recommend documenting as reserved/deferred rather than wiring.

### 4.2 `ROLE_PERMISSIONS` / `Role`/`Permission` model in `lib/auth.ts` is dead code (P3)

- `lib/auth.ts` exports an elaborate `Role`/`Permission`/`ROLE_PERMISSIONS` model, but nothing in
  the active `app/`, `components/`, or `lib/` imports or calls it (verified grep). Real auth is
  `getServerSession` + per-route `verifyAccess`/`verifyClassroomAccess`/`verifyClassroomTeachingAccess`.
- Harmless, but a possible source of future-maintainer confusion. Low-value cleanup.

### 4.3 `meetings` dual ownership columns (`owner` vs `user_id`) — harmless drift (P3)

- `meetingAuth` authorizes on `meetings.owner`; the app writes both `owner` and `user_id` equal to the
  creator (`lib/meetingPersistence.ts`). Production reconciles `user_id NOT NULL REFERENCES profiles(id)`.
- Not a runtime/security risk today (both are set identically on create), but the redundancy is a
  latent integrity-drift risk if a future write path sets them differently.

### 4.4 No automated DB-verification runner (P2, tooling)

- `package.json` has only `type-check`, `lint`, `test:e2e`. The phase2/3/4 `.sql` suites are manual;
  there is no script wrapping `supabase db reset` + running them. This is why §3.1 went unnoticed.
  Recommend a repeatable runner for the current and future phases.

---

## 5. Already-resolved items (verified, not re-opening)

- **P4-1 meeting_participants lockdown:** `REVOKE INSERT, UPDATE, DELETE ... FROM anon, authenticated`
  present in `20260827020000_phase4_meeting_participants_lockdown.sql`; SELECT retained; RLS intact;
  production gap flagged in header.
- **P4-3 submission role boundary:** `access.accessRole !== 'student' → 403` in submissions route.
- **P4-4 stale-grade surfacing:** `is_stale = graded_at IS NOT NULL AND submitted_at > graded_at`
  exposed read-only in assignment/submission responses.
- **P4-5 owner-only teaching seats:** enrollment create/delete paths gate instructor/TA on owner.
- **P4-6 client unification:** class write routes use `getSupabaseServerClient()`.
- **P4-7 cleanup:** subscription-cap fallback corrected to `'trial'` (not `class_10`); `getUserSubscription`
  removed (zero callers); `/api/monitor` session-guarded; `Lobby.tsx` removed (mechanically zero-reach).
---

## 6. Proposed fixes

### Fix-1 (P0) — Repair P4-2a `completed` persistence

- **Finding:** §3.1 REGRESSION — `end_class_lesson_atomic` cannot persist `'completed'`.
- **Proposed fix (additive, new Phase 5 migration — NOT an edit to history):**
  `supabase/migrations/2026082x0000_phase5_class_lesson_completed.sql` rebuilding the CHECK to admit
  `'completed'`:
  ```sql
  ALTER TABLE public.classroom_lessons
    DROP CONSTRAINT IF EXISTS classroom_lessons_status_check;
  ALTER TABLE public.classroom_lessons
    ADD CONSTRAINT classroom_lessons_status_check
      CHECK (status IN ('scheduled','live','recorded','cancelled','completed'));
  ```
  Then re-run the P4-2a DB verification, corrected to match the delivered RPC return
  (`lesson_id, status, already_cancelled/already_completed`) — **without adding a speculative
  `ended_at`/`completed_at` column** unless product desire is explicit.
- **Why this approach:** the CHECK is the root cause; this is the only legal, additive fix. The
  `DROP/ADD CONSTRAINT` is idempotent and touches no data.
- **DB changes:** yes (constraint DDL). **Security:** none. **Concurrency:** none (constraint is
  external to the RPC's row-locking design). **Regression risk:** low (only widens legal values).
  **Effort:** small.
- **Recommendation: IMPLEMENT** (corrects closed Phase 4 work; unblocks downstream lifecycle).

### Fix-2 (P2): Add a repeatable DB-verification runner

- Add `scripts/verify-db.*` (or npm script) that runs `supabase db reset` then executes the
  phase2/3/4 (+new phase5) `.sql` suites serially under `ON_ERROR_STOP`, including a
  `live → completed` assertion.
- **Why:** the suites already exist and encode each phase's contract; only orchestration + a
  `package.json` hook are missing. Lowest-effort safeguard against recurrence of §3.1.
- **DB changes:** none (tooling). **Recommendation: IMPLEMENT** (small, high value).

### Fix-3 (optional, P3): dead-code hygiene

- Delete or mark the `lib/auth.ts` permission model; document `presentations`/`slides` as reserved
  rather than active. Low impact; **recommend DEFER** unless Fix-1/2 land cheaply first (avoid
  parallelizing against verification re-runs).

### Fix-4 (optional, P3): `meetings.owner`/`user_id` duplication

- Document-only (both set identically today). **Recommend DEFER**; revisit only if a future feature
  introduces a divergent writer.
---

## 7. Alternatives considered

- **Rename terminal state to `'recorded'` instead of `'completed'`:** rejected — `'recorded'` is a
  *distinct* reserved state for the future recording pipeline (P4-2a rationale). Collapsing them
  corrupts the intended state machine.
- **Relax/strip the CHECK entirely:** rejected — the constraint is a valuable integrity guard; the
  right change is to add the one legal value the state machine actually needs.
- **Add `completed_at` and thread it through RPC + UI:** rejected as out-of-scope/assumption —
  no product contract currently requires the timestamp; adding it would be speculative scope.
  Revisit only if product confirms the need.

---

## 8. Severity / effort summary

| # | Finding | Severity | Effort | DB change | Recommendation |
|---|---|---|---|---|---|
| Fix-1 | P4-2a `completed` never persists (CHECK regression) | **P0** (blocks approved Phase 4 feature) | Small | Yes (constraint) | **Implement first** |
| Fix-2 | No repeatable DB verification runner | P2 | Small | No | Implement |
| Fix-3 | Dead `ROLE_PERMISSIONS` + dead `presentations/slides` schema | P3 | Small | No | Defer |
| Fix-4 | `meetings.owner` vs `user_id` duplication | P3 | Trivial | No | Defer (document) |

---

## 9. Recommended implementation order

```text
1. Fix-1   repair classroom_lessons CHECK → completed     (P0, unblocks approved P4-2a)
2. Fix-2   DB verification runner + corrected P4-2a asserts (P2, prevents recurrence)
3. Fix-3/4 P3 cleanups, only if cheap and non-parallel     (defer by default)
```

**Why this order:** Fix-1 is a genuine regression in *closed, approved* Phase 4 work — it must be
corrected first, with its verification made honest. Fix-2 is the process safeguard that makes Fix-1
provable and prevents the same silent-failure class in Phase 5+. The P3 items are optional and last,
so they cannot delay or obscure the correctness fix.

---

## 10. Items explicitly recommended for deferral / future

| Item | Why deferred |
|---|---|
| Recording pipeline / Egress / `has_recording` / `recordings` lifecycle / `recorded` + `recording_url` | Requires storage + LiveKit Egress architecture decisions (unchanged from Phase 4). |
| `meetings.participant_count` semantics | No established app contract for current-vs-unique-vs-max; writing it invents meaning (Phase 4 deferral stands). |
| `meetings.is_public` opt-in toggle UI | Product decision on link-sharing UX; current behavior intentional. |
| Assignment `due_at` enforcement | Pure product policy; no integrity/security impact today. |
| Entitlement gate at classroom creation ("draft graveyard") | Documented frictionless-by-design trade-off (Phase 1 §7.3). |
| Plan-feature gating of assignments/grading | Commercial decision, not engineering. |
| `presentations`/`slides` wiring | Dead schema; wiring is a product feature, not a defect. |
| Production application of P4-1 statement | Ops task outside repo; migration header documents it. |

---

## STOP

Reconnaissance complete. **No implementation, migrations, DB, config, or tests were modified;
nothing committed or pushed.** Awaiting review/approval of Fix-1 (and optionally Fix-2) before any
Phase 5 implementation begins.
