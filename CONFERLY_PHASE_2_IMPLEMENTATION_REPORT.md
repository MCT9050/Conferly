# Conferly — Phase 2 Implementation Report

**Branch:** `feat/flexible-classroom-seating` · **Baseline:** `64df837` (Phase 1 recon)
**Scope rule applied throughout:** minimal changes, existing architecture preserved, database-backed invariants.

---

## Implemented

### P0-1 · Student enrollment
- `POST /api/class/classrooms/[classroomId]/enrollments` — owner/teaching-role only; validates student exists in `profiles`; idempotent upsert on `UNIQUE(classroom_id, student_id)`; duplicate returns `200 {already_enrolled:true}`, new row `201`.
- `DELETE …/enrollments` — same authorization, idempotent `204`.
- UI: roster page now hosts `EnrollStudentForm` (UUID + role picker) and `RosterActions` (remove). No new dashboard architecture.
- Self-enrollment impossible: route requires teaching authority; RLS remains defense in depth.

### P0-2 · Assignments & submissions
- `GET/POST /api/class/lessons/[lessonId]/assignments` — read requires classroom access; create requires teaching role.
- `GET /api/class/assignments/[assignmentId]` — teachers see all submissions; students see the assignment plus only their own submission.
- `POST /api/class/assignments/[assignmentId]/submissions` — enrolled students only; upsert keyed on `UNIQUE(assignment_id, student_id)` → resubmission updates the same row; concurrent duplicates collapse to one row. A student can never touch another's submission (writes always scoped to `session.userId`).
- UI: "Assignments" button on every lesson row, assignment list page with `CreateAssignmentForm` (teachers), assignment detail page with `SubmitAssignmentForm` (students) and a teacher-facing submissions list.

### P0-3 · `meetings.user_id` production contract
**Verified — no change.** Migration `20260824000000` already reproduces production exactly: `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, re-affirmed by `20260826000000`. App writer `buildMeetingInsert` sets `user_id = owner = auth.uid()`. Local chain matches production contract.

### P2-1 · Classroom capacity race (fixed)
New migration adds `enforce_classroom_capacity_atomic(classroom_id, owner_id, requesting_role)` — a `SECURITY DEFINER` RPC that takes `SELECT … FOR UPDATE` on the classroom row, then resolves the owner's active Class subscription, maps plan → limits (incl. `class_custom` via `participant_cap`), counts verified active enrollments (owner = first teacher), and returns a JSON verdict. `lk-token` now calls this via `enforceClassCapacityAtomic()`. Semantics preserved exactly (counts include the requester's own row; teacher cap 2; Meet behavior untouched).

### P2-2 · Meeting public access (verified intentional)
`is_public` has an enforceable meaning today: DB default `false`; app explicitly sets `true` at creation; `verifyRoomAccess` grants anonymous-spectator **only** when `is_public` — otherwise 403. Non-public meetings have no unintended anonymous path. No change made.

### P2-3 · Atomic lesson launch (fixed)
Migration adds `launch_class_lesson_atomic(lesson_id)` — locks the lesson row, refuses `cancelled`/unknown, treats already-live as idempotent success with stable room id, and performs the guarded transition equivalent to `UPDATE … WHERE status='scheduled'`. Launch route authorizes first, then delegates to this RPC; response includes `alreadyLive`. `livekit_room_id` derivation unchanged (`class-<classroomId>-<lessonId>` when unset).

### P2-4 · Legacy `classroom_plus` (verified consistent)
No path grants it: webhook RPC explicitly refuses; `createClassroomPlusCheckout()` errors out to sales; pricing config has no such plan. Preferred policy ("do not auto-grant legacy entitlements") already holds. No change.

### P2-5 · Product-scoped subscription reads
- `getUserSubscription(productLine: 'meet'|'class' = 'meet')` now filters `.eq('product_line', productLine)` with `.maybeSingle()` (was an unfiltered multi-row read).
- Legacy `components/Dashboard.tsx` conversion tracker reads with `.eq('product_line', 'meet')`.
Canonical identity `(user_id, product_line)` used everywhere reachable. No new abstraction introduced.

### P3 · Low-cost fixes
- Pricing Enterprise CTA: `sales@conferly.app` → `info@conferly.site`.
- Invalid meeting slug (`POST /api/meetings`): Phase 1 suspected a 500; verification showed the outer try/catch does return 400, but generic. Tightened so slug-validation failures return their specific 400 message without touching other paths.
- No speculative dead-code removal performed (rule 11.3).

---

## Database Changes

**One new migration:** `supabase/migrations/20260827000000_phase2_class_concurrency_atomic.sql`
- Creates `public.enforce_classroom_capacity_atomic(uuid, uuid, text) returns jsonb`
- Creates `public.launch_class_lesson_atomic(uuid) returns jsonb`
- Both `SECURITY DEFINER`, `search_path=public`; EXECUTE revoked from PUBLIC, granted to `service_role` only.
- Additive/idempotent; no historical migration edited; nothing dropped; RLS untouched. Registered locally in `supabase_migrations.schema_migrations`.

---

## Security / Concurrency Invariants

| Invariant | Enforcement |
|---|---|
| Only teaching roles enroll/remove members | Server check `verifyClassroomTeachingAccess` + RLS `Owners can manage enrollments` |
| Duplicate enrollment impossible | `UNIQUE(classroom_id, student_id)` + idempotent upsert handling |
| Students see only own submissions | Server scopes reads/writes to `auth.uid()`; RLS on submissions |
| Cross-classroom access blocked | Every route resolves parent classroom + runs access checks |
| Capacity cannot be raced | Row-level lock on classroom serializes decisions; count+verdict inside one locked transaction |
| Lesson launches cannot double-transition | `FOR UPDATE` + guarded `UPDATE … WHERE status='scheduled'` |
| RPCs unreachable from clients | EXECUTE granted solely to `service_role` |


---

## Verification (all executed)

**Static:** `tsc --noEmit` → clean (baseline verified clean before changes). `eslint` on every touched file → zero findings. `scripts/static_sql_check.py` on new migration → OK.

**Live database tests** (local Supabase container, Postgres 17.6; fixtures auto-created and fully removed): `tests/phase2-db-verification.sql`

| Test | Result |
|---|---|
| T1 under-limit join | allowed=true, count=1 ✓ |
| T2 at-limit holder (10/10) | allowed=true ✓ |
| T3 over-limit (11th) | rejected, "Student seat limit reached (10)" ✓ |
| T4a second teacher | allowed=true ✓ |
| T4b third teacher | rejected, "Teacher limit reached (2)" ✓ |
| T5 expired subscription | rejected ✓ |
| T6 custom plan over participant_cap | rejected ✓ |
| T7 scheduled → live | ok, room `class-<cid>-<lid>` ✓ |
| T8 relaunch live lesson | ok, `already_live=true`, room stable ✓ |
| T9 cancelled lesson | refused (`cancelled`) ✓ |
| T10 unknown lesson | refused (`not_found`) ✓ |
| T11 duplicate enrollment | rejected by UNIQUE constraint ✓ |
| Race: two parallel launches on one lesson | exactly one flip; other idempotent; single `live` row, identical room id ✓ |

Post-run residue check: 0 test users/classrooms/enrollments/lessons remain.

**Not run:** Playwright e2e suite targets production and was intentionally left alone; `next build` could not complete in this sandbox because Next could not download its SWC binary (offline environment) — pre-existing build logs show the build passing previously, and TypeScript compilation of all changed code succeeds.

---

## Remaining Phase 3 Candidates
- Student lookup by email/name in the enrollment form (currently UUID paste).
- Teacher grading flow (score/feedback writes) — schema supports it; out of MVP scope.
- Assignment edit/delete endpoints for teachers.
- Optional: capacity feedback at enrollment time (currently enforced at join time by design).

---

## Git State

- **Branch:** `feat/flexible-classroom-seating` (1 commit ahead of origin, unchanged from baseline)
- **HEAD:** `64df837 chore: finalize production database parity`
- **Working tree:** modified files unstaged; new files untracked; **no commits or pushes created**

**Modified (9):** `app/(marketing)/pricing/page.tsx` · `app/actions/checkout-actions.ts` · `app/api/class/lessons/[id]/launch/route.ts` · `app/api/lk-token/route.ts` · `app/api/meetings/route.ts` · `app/class/classrooms/[slug]/lessons/page.tsx` · `app/class/classrooms/[slug]/students/page.tsx` · `components/Dashboard.tsx` · `lib/classEntitlements.ts`

**Added:** migration + verification SQL above, plus the 10 new route/component files listed in Implemented (enrollment API, assignment APIs ×3, two assignment pages, four class components). Phase 1's untracked `CONFERLY_APPLICATION_WORKFLOW_MAP.md` untouched.

---

**STOP — Phase 2 objectives met.** Enrollment functional; assignments/submissions functional; `meetings.user_id` contract verified; capacity authoritative under concurrency; public-meeting access intentional and enforced; lesson launch atomic; subscription reads product-scoped; P3 fixes done; verification green.
