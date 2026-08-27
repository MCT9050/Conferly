# Conferly — Phase 3 Completion Report (Updated)

**Branch:** `feat/flexible-classroom-seating` · **Baseline HEAD:** `64df837` (unchanged)
**Status:** All three remaining Phase 3 items were investigated first, then explicitly classified. Two were implemented and verified end-to-end; the third was root-caused to a tooling bug and fixed in the tool itself. **Nothing was deferred as disproportionate work. No production systems touched. Nothing committed or pushed.**

---

## Item 1 — Teacher grading flow → IMPLEMENTED & VERIFIED

### Investigation (before implementation)

1. **Schema (`20250623000001_classroom_domain.sql` + live `pg_catalog`):**
   - `classroom_submissions(id, assignment_id→CASCADE, student_id→auth.users CASCADE, content jsonb, score int, submitted_at, graded_at)`.
   - `score` already carries `CHECK (score IS NULL OR score BETWEEN 0 AND 10000)`; `UNIQUE(assignment_id, student_id)` exists; index on `assignment_id` exists.
   - **No `feedback` column existed** — confirmed live and against `production_columns_summary.txt` (production = identical 7 columns). So *score* was fully supported; *free-text feedback* required one additive column.
2. **RLS baseline (live `pg_policies`):**
   - `Students can manage their own submissions` — `FOR ALL USING (student_id = auth.uid())`
   - `Owners and TAs can view grade submissions` — `SELECT` only (teachers).
   - Application convention: every write goes through server routes on the **service-role client**, so RLS here is defense-in-depth, not the primary gate.
3. **Data-integrity hole discovered during investigation:** live `role_table_grants` showed **anon AND authenticated held table-wide INSERT/UPDATE/DELETE/TRUNCATE** on `classroom_submissions`. Combined with the permissive FOR-ALL policy, any authenticated user could **grade themselves** (`PATCH` their row's `score`/`graded_at`) or delete a graded row **directly through PostgREST using the public anon key**, bypassing the application's teaching-role checks completely. "Authorization prevents students from grading" therefore could NOT be satisfied at the app layer alone.
4. **Reusable architecture:** `verifyClassroomTeachingAccess(userId, classroomId)` (owner/instructor/ta), the assignment→lesson→classroom resolution pattern from the existing `[assignmentId]` PATCH/DELETE, the idempotent-upsert precedent in the submissions POST route, and the client-component conventions of `SubmitAssignmentForm`/`AssignmentTeacherActions`. The Playwright contract spec asserts nothing about these files.
5. **Concurrency/idempotency analysis:** grading is a scoped `UPDATE … WHERE id AND assignment_id`; Postgres row locks serialize concurrent graders (last-write-wins, deterministic); a student resubmission touches only `content`, so it cannot clobber grading columns and vice-versa; a row deleted between the existence check and the UPDATE surfaces as 404 via the empty update result.

### Implementation

- **Migration `supabase/migrations/20260827010000_phase3_submission_grading.sql`** (additive, idempotent; no existing column/constraint/policy modified):
  - `ADD COLUMN IF NOT EXISTS feedback text` + `CHECK (char_length(feedback) <= 5000)` (drop-if-exists guard).
  - **Privilege tightening that closes the self-grading hole:** `REVOKE INSERT,UPDATE,DELETE,TRUNCATE FROM anon, authenticated`, then `GRANT INSERT (assignment_id, student_id, content)` and `GRANT UPDATE (content)` to authenticated. Grading columns become service-role-only — matching exactly how the application writes. SELECT stays granted; RLS policies untouched.
  - Deployment ordering note: apply before deploying app code that writes feedback.
- **API `PATCH /api/class/assignments/[assignmentId]/submissions/[submissionId]/route.ts`:** session → single-query resolution (submission ⨝ assignment ⨝ lesson ⨝ classroom) → `verifyClassroomTeachingAccess` → scoped update (`eq id` + `eq assignment_id`). Body `{ score?, feedback? }`; validation mirrors the DB contract exactly (integer 0..10000 or null; trimmed ≤5000 chars or null). Non-null score stamps `graded_at=now()`; `score:null` clears grade + timestamp; feedback-only updates leave timestamps alone. Students/non-teachers → 403; wrong assignment pairing → 404.
- **UI:** new `components/class/GradeSubmissionForm.tsx` (house style: pending guard, credentials fetch, error/success states, `router.refresh()`), rendered inline on every card of the teacher submissions list; saved feedback shown to teachers; students see a dedicated **Teacher feedback** panel plus existing score/graded-at display. GET selects in `[assignmentId]/route.ts` (both branches) and the detail page now include `feedback`.

---

## Item 2 — Dead/orphaned legacy functionality → CLASSIFIED; 2 files REMOVED

### Reachability evidence (gathered before any deletion)

For each candidate: import scan across `app/ components/ lib/ tests/ scripts/` (all specifier forms — `@/components/X`, relative `../X`, extensioned, plus dynamic string references), route inventory (Next.js auto-includes only `app/**`), navigation targets, Phase 1 production-path map, and test/integration references.

| Candidate | Imports anywhere | Dynamic refs | Route refs | Verdict |
|---|---|---|---|---|
| `components/Dashboard.tsx` | **0** | **0** | n/a (not a route) | definitely unreachable → **removed** |
| `components/PricingPage.tsx` | **0** | **0** | n/a | definitely unreachable → **removed** |

- The live `/dashboard` page (`app/(platform)/dashboard/page.tsx`) renders `ProductSelector`, not `Dashboard.tsx`; the live pricing pages (`app/(marketing)/pricing` and `app/(marketing)/class/pricing`) render their own markup and do not import `PricingPage.tsx`.
- Mechanical proof after removal: `tsc --noEmit` exits 0 — no module in the compilation references either file.
- Note: `components/Dashboard.tsx` also carried an uncommitted one-line Phase 2 edit (`.eq('product_line','meet')`). Deletion supersedes that edit; the file was unreachable so there is no behavioral change.
- Risk framing: both files contained obsolete `classroom_plus` / legacy-tier terminology that every audit pass kept re-flagging. Removal is reversible via git history and eliminates recurring false leads — risk reduction, not beautification.

**Additional finding (documented, NOT removed):** `components/ClientDashboard.tsx` also has zero importers by the same scans. It was not part of the flagged candidate set, so per scope discipline it is left in place and recorded here for a future maintenance pass.

---

## Item 3 — Pre-existing SQL-lint warnings → ROOT-CAUSED; checker FIXED

### What the warnings actually were

`scripts/static_sql_check.py` reported FAIL on **six** committed migrations (the earlier report said three; the accurate count is six) with one rule:
`last non-comment content is not a semicolon-terminated statement`
— `20250601000002_hardening`, `20250623000001_classroom_domain`, `20260806185601_phase2_product_scope_expansion_contract`, `20260824000000_reconcile_live_production_schema`, `20260825000000_finalize_production_parity_corrections`, `20260825010000_finalize_trigger_and_function_acl_parity`.

### Classification questions answered

- Introduced by Phase 2/3? **No** — all six predate this work (committed at/before baseline HEAD).
- Related to the new RPCs? **No.**
- Security-sensitive? **No.**
- Capable of affecting migrations or production behavior? **No** — purely static tooling; all six applied cleanly long ago (local DB schema is healthy and parity-checked).

### Root cause (verified empirically)

Instrumenting `scan()` showed the backward-scanning helper returns the **first non-whitespace char from EOF** unless that exact char is a recognized marker. Any file whose final line is a comment therefore always fails — e.g. hardening returns `'.'` (offset 15957, inside `(HaveIBeenPwned).`) and classroom_domain returns `'.'` (offset 6834). Banner lines (`=====`) return `'='`. The rule could never pass a file ending in a comment, regardless of SQL validity.

### Decision & fix (proportionate)

Editing six historical parity-audit migration files = churn for zero behavior change → rejected. Fixing the buggy lint rule in repo tooling ≈ 20 lines → done.
Rule 3 now tracks the last top-level code character during the existing forward tokenizer (comment/string/dollar-body aware); trailing comments are correctly ignored. **Zero migration files were modified.**

---

## Verification (all executed)

**Static:**
- `tsc --noEmit` → clean (exit 0).
- ESLint on all 4 touched TS/TSX files → 0 problems.
- `static_sql_check.py` full suite → **19/19 OK, exit 0** (includes new Phase 3 migration).
- Negative battery proving the fixed rule still bites: dangling token → FAIL; comment-only file → FAIL; unterminated `$$` → FAIL; valid+banner-comment → OK.

**Live local DB (`supabase_db_conferly`, fixtures self-created & removed):**
- New migration applied cleanly (7 statements; NOTICE on idempotent drop-guard only).
- `tests/phase3-db-verification.sql` — **ALL PASS:**
  - P0 feedback column exists; all six constraints present (incl. legacy score-check, UNIQUE, FKs + new length check)
  - P1 score=10001 REJECTED · P2 duplicate submission REJECTED · P3 feedback>5000 REJECTED, =5000 accepted
  - P4a–d authenticated UPDATE-score / INSERT-score / DELETE / TRUNCATE all **DENIED**; P4e content-only UPDATE allowed; P4f anon INSERT DENIED
  - P5a grade-write: score 95, graded_at stamped, student `content` untouched; P5b ungrade clears score+graded_at preserving feedback; P5c clears feedback
  - P6 RLS policies byte-equivalent to baseline (`Students can manage their own submissions(ALL)`, `Owners and TAs can view grade submissions(SELECT)`)
  - P7 grant snapshot: anon/authenticated = `REFERENCES,SELECT,TRIGGER` only; postgres/service_role = full (app path unaffected)
  - Cleanup residue = 0
- **Phase 2 regression rerun:** `tests/phase2-db-verification.sql` T1–T11 ALL PASS (capacity limits/expiry/custom-cap, launch atomicity/idempotency/cancel/not-found, enrollment UNIQUE).

**Not run (pre-existing environmental limitation, unchanged since Phase 2):** dev server / `next build` (offline sandbox cannot fetch the SWC binary); Playwright e2e suite intentionally untouched (targets production).

---

## Changes (working tree vs. previous Phase 2/3 state)

**Added**
- `supabase/migrations/20260827010000_phase3_submission_grading.sql`
- `app/api/class/assignments/[assignmentId]/submissions/[submissionId]/route.ts` (PATCH grading endpoint)
- `components/class/GradeSubmissionForm.tsx`
- `tests/phase3-db-verification.sql`
- This updated report.

**Modified**
- `app/api/class/assignments/[assignmentId]/route.ts` — `feedback` added to both submission selects (teacher list + own-submission).
- `app/class/classrooms/[slug]/lessons/[lessonId]/assignments/[assignmentId]/page.tsx` — import, both selects gain `feedback`, teacher cards embed the grading form + show saved feedback, student block shows the Teacher-feedback panel.
- `scripts/static_sql_check.py` — rule 3 rewritten as a forward-scan check (bug fix documented above).

**Deleted (proven unreachable)**
- `components/Dashboard.tsx`, `components/PricingPage.tsx`

## Deliberate semantics & scope notes (documented decisions)

- Scores above the assignment's `max_score` are accepted (0..10000 window mirrors the DB CHECK); this permits extra credit and keeps API and DB contracts identical.
- Re-saving an existing grade refreshes `graded_at` to the latest save; clearing the score clears it. Feedback-only saves never touch timestamps.
- Empty-string feedback normalizes to NULL; trimming applied server-side.
- `ClientDashboard.tsx` left in place (see Item 2) as documented future maintenance, not deferred work for Phase 3.

## Deferred items

**None.** Every remaining Phase 3 item was either implemented and verified (Items 1), classified as definitely-unreachable and removed with mechanical proof (Item 2), or root-caused to a tooling bug and fixed in place (Item 3). No item was closed on "non-blocking" grounds alone.

## Git state

- **HEAD:** `64df837 chore: finalize production database parity` — unchanged. Nothing staged, committed, or pushed.
- Working tree: Phase 1–3 modifications unstaged; new files untracked; two deletions recorded (`D components/Dashboard.tsx`, `D components/PricingPage.tsx`).
- **Production untouched** — no remote DB, webhook, or billing changes of any kind.

---

**STOP — Phase 3 is closed.** Teacher grading flow implemented and verified against live local DB including privilege-level self-grading prevention; legacy reachability resolved with evidence; SQL-lint warnings eliminated by fixing their true cause. All Phase 2 invariants re-verified green. **Phase 4 has not been started.**
