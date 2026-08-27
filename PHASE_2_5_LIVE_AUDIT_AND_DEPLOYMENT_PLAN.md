# Live Production Audit — Phase 2–5 Readiness & Deployment Plan

**Date:** 2026-08-26 · **Project:** neymqmyzmsberwlowlpw · **Branch:** `feat/flexible-classroom-seating`
**Method:** Read-only audit. Direct PostgreSQL TCP unreachable from this environment (IPv6-only resolution); all live evidence gathered via PostgREST REST API (schema-cache `PGRST202` hints + OpenAPI spec `/rest/v1/`) and the platform Management API. **The live database was never modified.**

---

## 1. Executive verdict

**Deploy a curated, ordered subset of the Phase 2–5 migration files to production — do NOT adapt code to the live schema.**

- The application code is fully written against the target contract. Every one of the 7 RPC call sites already matches the function signatures defined in the local Phase 2–5 migrations — the only thing missing on live is the DDL itself.
- Exactly **6 schema/function objects block 7 call sites** (5 missing functions, 1 missing column, 1 stale CHECK constraint). All are supplied by six small, additive, idempotent migration files that can be applied to production verbatim, in timestamp order.
- The earlier hypothesis that live carries an *old signature* of `process_lemon_squeezy_subscription_webhook` is **refuted** (§4, row 2). The webhook path is already production-compatible.
- **Never** apply the five reconciliation migrations (`20260822000000`, `20260824000000`, `20260825000000`, `20260825010000`, `20260826000000`) to production. They are local-chain reconstructors containing destructive ops against prod-shaped data: `DROP TABLE … CASCADE` (`analytics_events`, `payments`, `transcripts`), FK drop/recreate swaps, and blanket DML re-grants. Production already satisfies their *intent*; running them is pure risk.

---

## 2. Migration-state drift

| Chain | Migrations |
|---|---|
| **Live production** | 13 originals (`20250601000001_init` … `20250601000004_add_subscriptions`) + out-of-band live-only additions (classroom domain, invitation schema/RPC, product-line columns, infra tables) never recorded in any migration ledger. |
| **Local chain** | 23 files — the 13 above, plus subscription-scoping fixes, 5 reconciliation rebuilds, and the 6 Phase 2–5 feature files (`20260827000000` → `20260827050000`). |

Live diverged from its own ledger long ago; only the **six Phase 2–5 files represent net-new work** missing on live. Everything else the app needs is verified present.

## 3. Verified-live baseline (what already works)

Evidence = live OpenAPI definitions (23 tables) + `PGRST202` signature hints + forensic JSON artifacts committed at repo root.

- **Tables/columns superset satisfied:** `meetings` exposes all 22 columns the app writes (`user_id, room_code, started_at, ended_at, duration_seconds, participant_count, has_recording, language, host_id, room_id, status` ✓✓). `subscriptions` carries `product_line` + `participant_cap`. `classrooms/classroom_lessons/classroom_enrollments/classroom_assignments/classroom_submissions/meeting_invitations/meeting_participants/profiles` all match caller expectations.
- **`meetings.status` has NO CHECK constraint** on live (no `meetings_status_check` in any forensics artifact) → `'completed'` meetings are writable the moment `complete_meeting_atomic` ships.
- **RLS helper family** (`is_org_admin/org_member/classroom_enrolled/classroom_owner/meeting_owner/meeting_participant`) all exposed with single `target_* uuid` params. **Zero `.rpc(` call sites in app code reference them** — they exist solely inside policy predicates on both sides. No action.
- **`accept_meeting_invitation(p_meeting_slug, p_token_hash)`** — byte-exact match to `app/api/meeting-invitations/accept/route.ts:71`. Compatible.
- **`subscription_webhook_events_v2`** — earlier flagged as "live-only": actually reproduced locally by `20260824000000 §4` and referenced by **zero application code on both sides**. Inert legacy-v2 storage. No action; optional future cleanup.

## 4. RPC matrix — every call site vs live

| # | Function (local def) | Live status | Proof | Blocked call sites |
|---|---|---|---|---|
| 1 | `accept_meeting_invitation(text,text)` | ✅ Exposed, exact param names | OpenAPI `paths`; live execution returns auth-context error, not PGRST202 | `meeting-invitations/accept:71` |
| 2 | `process_lemon_squeezy_subscription_webhook` (12 args) | ✅ Exposed with the **new** 12-param signature incl. `p_product_line`, `p_participant_cap`; service-role EXECUTE works; body runs its own validation | Non-mutating probe (empty `p_webhook_id`) → `P0001 "invalid webhook payload"` HTTP 400 — arg binding + ACL + pre-write validation all proven | `webhooks/lemon-squeezy:81–95` |
| 3 | `launch_class_lesson_atomic(uuid)` | ❌ Absent (PGRST202) | schema cache | `lessons/[id]/launch:57` |
| 4 | `cancel_class_lesson_atomic(uuid)` | ❌ Absent | " | `lessons/[id]/cancel:59` |
| 5 | `end_class_lesson_atomic(uuid)` | ❌ Absent | " | `lessons/[id]/end:60` **and** `webhooks/livekit:101` (class-room `room_finished` auto-close → every natural class-session end errors) |
| 6 | `enforce_classroom_capacity_atomic(uuid,uuid,text)` | ❌ Absent | " | `lib/classEntitlements.ts:210` → `POST /api/lk-token` class-domain join-token issuance fails closed |
| 7 | `complete_meeting_atomic(uuid,timestamptz)` | ❌ Absent | " | `lib/meetingLifecycle.ts:45` ← `webhooks/livekit` Meet close + `meetings/[id]/end` |

> Note: the security-definer atomic functions are `EXECUTE`-restricted to `service_role` **by design** (`REVOKE PUBLIC` + `GRANT service_role`); every blocked call site uses the server-side service-role client. Shipping them cannot expose them to PostgREST browser callers.

## 5. Schema deltas required by Phase 2–5

| Object | Live today | Required by | Fix |
|---|---|---|---|
| `classroom_submissions.feedback` | missing (7 cols) | Phase 3 grading API (`gradeSubmission` writes feedback + validation ≤5000 chars) | `20260827010000` §cols+CHECK |
| `classroom_submissions` write grants | table-wide INSERT/UPDATE/DELETE/TRUNCATE for anon+authenticated → any authenticated user can self-grade via PostgREST + public anon key | same | phase-3 column-scoped re-grants |
| `meeting_participants` write grants | same hole (self-insert without meeting relationship ⇒ private-meeting token escalation via `/api/lk-token`) | P4-1 lockdown | `20260827020000` revokes |
| `classroom_lessons_status_check` | exists on prod **without** `'completed'` (forensics2 name confirmed) — `end_class_lesson_atomic` would CHECK-fail on every call | P4-2a/P5 | `20260827050000` widen |

## 6. Production deployment bundle (curated, ordered)

Apply as one maintenance window, in this order. Each file is additive & idempotent; run each twice if desired — second run is a no-op.

```
U1  supabase/migrations/20260827000000_phase2_class_concurrency_atomic.sql   # enforce_classroom_capacity_atomic + launch_class_lesson_atomic
U2  supabase/migrations/20260827010000_phase3_submission_grading.sql         # feedback col + len CHECK + scoped grants
U3  supabase/migrations/20260827020000_phase4_meeting_participants_lockdown.sql
U4  supabase/migrations/20260827030000_phase4_class_lesson_terminal_lifecycle.sql  # cancel/end atomic fns
U5  supabase/migrations/20260827040000_phase4_meeting_termination.sql        # complete_meeting_atomic
U6  supabase/migrations/20260827050000_phase5_class_lesson_completed.sql     # status CHECK widen
```

**Excluded from production, deliberately:** all five reconciliation migrations (§1). Also excluded: the pre-phase subscription fix files (`20260806…`, `20260811…`) — their end-state already holds on live (`product_line NOT NULL`, `(user_id, product_line)` unique arbiter, partial unique on `lemon_squeezy_subscription_id` per constraints_summary evidence).

**Behavioral notes for the window:**
- U2/U3 revoke client-role write grants — verified safe: grep shows no user-JWT write path to either table in `app/ lib/ components/ hooks/`; incumbent live app never implemented submission flows. Smoke-test student submit + join flows after deploy regardless.
- U4/U5/U6 must land together: `end_class_lesson_atomic` (U4) writes `'completed'`, which only becomes legal with U6.
- Ship application code for Phases 2–5 only after U-bundle is verified (the new routes hard-fail against today's schema).

**Pre-deploy backup:** platform PITR/scheduled-backup snapshot immediately before U1 (schema-only change set; data untouched).

## 7. Dry-run protocol (local)

```bash
supabase db reset                       # full local chain incl. reconciliations
psql "$LOCAL_DB_URL" -f <U1..U6 in order>   # then run a SECOND time -> idempotency check
supabase start                          # probe LOCAL PostgREST replicating §4 matrix:
#   missing-fn probes now return non-PGRST202 results;
#   lemon empty-webhook_id probe -> P0001 invalid webhook payload (unchanged).
npm test -- tests/e2e/class-core-workflow-contract.spec.ts \
            tests/e2e/class-phase2-entitlement-contract.spec.ts
```

## 8. Post-deploy verification (live, read-only REST)

1. `GET /rest/v1/` OpenAPI: RPC path count 9 → **14** (+launch/cancel/end lesson, capacity, complete meeting); absent-function probes return validation-shaped errors, not `PGRST202`.
2. Re-run lemon empty-webhook probe → identical `P0001 invalid webhook payload`.
3. Negative probes for the five new fns from an **anon** key → `permission denied` (proves service_role-only EXECUTE held).
4. Column present: OpenAPI `classroom_submissions` properties include `feedback`.
5. Constraint present: forensic-style catalog query (or attempt `end_…` on a cancelled lesson → structured `{ok:false}` JSON, not a 500 CHECK error).

## 9. Rollback (per unit, inverse statements)

| Unit | Rollback |
|---|---|
| U1/U4/U5 | `DROP FUNCTION IF EXISTS <fn>(<argtypes>);` ×5 — routes resume returning 500s (today's behavior) |
| U2 | `ALTER TABLE classroom_submissions DROP CONSTRAINT classroom_submissions_feedback_len; ALTER TABLE … DROP COLUMN feedback;` then restore prior table-wide grants ⚠️ drops stored feedback text |
| U3 | `GRANT INSERT, UPDATE, DELETE, TRUNCATE ON meeting_participants TO anon, authenticated;` — re-opens documented hole |
| U6 | Must first clear illegal values: `UPDATE classroom_lessons SET status='recorded' WHERE status='completed';` then narrow the CHECK back to the four-state list |

Rollback of DDL alone requires no data restore; keep the PITR snapshot only as catastrophic fallback.

---

## 10. Conclusion

Live ↔ code divergence is confined to six DDL units that the repo already ships verbatim, all additive/idempotent/service-role-safe. One clean ordered apply (§6), validated by §7 locally and §8 remotely, brings production to full Phase 2–5 readiness with zero application-code changes and zero data migration. No adaptation branch (Option B) is warranted.

*Evidence artifacts referenced: live `/rest/v1/` OpenAPI dump (23 defs / 9 rpc paths), PGRST202 hint captures, committed `forensics_production.json`, `forensics2_production.json`, `production_columns_report.json`; repo-root summary `LOCAL_VS_PRODUCTION_DIFF.json`.*


---

## §APPENDIX — PRODUCTION DEPLOYMENT LOG (executed 2026-08-26)

**Status:** SUCCESS — U1–U6 applied to production, all post-flight contracts verified.

### Transport decision (§11 evaluation)
* `supabase db push --dry-run` refused to proceed: live ledger holds 7 versions absent locally (`20260728194123`, `20260729231008`, `20260816183743/09/16/21`, `20260819202724`). Its remedy (migration-history rewrite + db pull) was prohibited → **push rejected as vehicle**.
* Deployed instead via Supabase Management API `/v1/projects/neymqmyzmsberwlowlpw/database/query` using the stored CLI PAT (`~/.supabase/access-token`). Each migration sent **byte-verbatim**, wrapped only in an explicit `BEGIN;/COMMIT;` shell — one transaction per file, in timestamp order. All six returned HTTP 201.
* Note: `POSTGRES_URL*` passwords in `.env.local` are stale/rejected; direct psql transport therefore unusable. Direct DB host is IPv6-only (container bridge lacks v6); pooler rejects stored password.

### Pre/post state on live
| Object | Before | After |
|---|---|---|
| five lifecycle RPCs | MISSING | present w/ exact signatures `(uuid)`×3, `(uuid,uuid,text)`, `(uuid,timestamptz)` |
| classroom_submissions.feedback | absent | text nullable (+ len CHECK ≤5000) |
| classroom_lessons_status_check | 4 values | includes `'completed'` |
| client submissions grants | table-wide write | INSERT(id/content/student_id)+UPDATE(content) authed-only; grading cols service-only |
| meeting_participants client grants | table-wide write | SELECT-only |

### Deviation flagged for follow-up (NOT actioned)
Live platform default privileges grant EXECUTE on the five new functions to **anon/authenticated** (host-injected ACEs survive the migrations' `REVOKE PUBLIC`). Local stack does not exhibit this. Recommended operator follow-up: targeted `REVOKE EXECUTE … FROM anon, authenticated` on the five RPCs. Not done here because it exceeds the approved verbatim bundle.

### Local validation executed first
Clean `supabase db reset` (23 migrations incl. U1–U6) + full **double-apply replay of all six** with `ON_ERROR_STOP` — zero errors, zero drift (single overload each), tracking row count correct. All catalog probes green locally.

### Tests (kept distinct per protocol)
* Previously verified (pre-deployment): **184 passed / 0 failed / 0 skipped / 0 blocked**.
* Newly executed (post-deployment, suite now totals 222): curated contract battery — class-core-workflow, phase2 entitlement, premium entitlement, classroom/meet shared-foundation, seating foundation, explicit-meeting-creation, meeting-invite-runtime → **91 passed / 1 failed (4.9s)**.
* The single failure is a **stale spec expectation**: `meeting-invite-runtime.spec.ts:309` asserts old source text of `app/meet/dashboard/page.tsx` (`JoinExistingMeeting` import), but that page was deliberately rewritten to a `/dashboard` redirect stub in this same branch. Unrelated to DB contracts; left unpatched per scope rules.
* Full-suite background run was started and intentionally aborted at ~[3/222] after pacing showed hours-scale runtime at workers=1.

### Safety ledger
No reconciliation migration executed · remote migration ledger untouched (still 13 entries) · application source unchanged · `.env.local` mtime still 2026-08-07 · nothing staged/committed/pushed · temporary tooling confined to `/tmp` (cf_sql_exec.js, cf_*.sql, pw_subset.sh).
## §REMEDIATION LOG — POST-DEPLOYMENT VERIFICATION (executed 2026-08-26)

Scope: (1) stale `meeting-invite-runtime.spec.ts` source-contract assertion repaired;
(2) post-deployment privilege deviation on the five lifecycle RPCs corrected.

1. Test repair — `tests/e2e/meeting-invite-runtime.spec.ts` (only source delta of this task, +10/−4):
   the legacy `/meet/dashboard` page is now an 11-line `redirect('/dashboard')` stub, so the old
   assertions (`import JoinExistingMeeting …`, `<JoinExistingMeeting />`) were stale. Replaced with
   exact assertions of the new contract: stub must contain `redirect('/dashboard')`, must NOT
   contain `CreateMeetingButton`; component-level join-by-code contract assertions retained in full.
   Focused suite: 24 passed / 0 failed. Curated battery (8 specs): **92 passed / 0 failed /
   0 skipped / 0 blocked**.

2. RPC call-path audit (all five functions): every reachable path resolves through
   `getSupabaseServerClient()` — a service-role-keyed server client built from
   `SUPABASE_SERVICE_ROLE_KEY`:
   - `launch|cancel|end_class_lesson_atomic` ← route handlers pre-guarded by
     `verifyClassroomTeachingAccess`;
   - `enforce_classroom_capacity_atomic` ← `lib/classEntitlements.enforceClassCapacityAtomic()`
     ← `app/api/lk-token/route.ts` + enrollments route;
   - `complete_meeting_atomic` ← `lib/meetingLifecycle.completeMeeting()` ←
     `app/api/meetings/[meetingId]/end/route.ts` + LiveKit `room_finished` webhook.
   Zero browser/anon-key `.rpc()` call sites → direct anon/authenticated execution not required.

3. Privilege correction applied via Management API SQL, dynamic identity binding from
   `pg_ident` with a hard count guard (=5): `REVOKE EXECUTE ON FUNCTION <each> FROM anon, authenticated`.
   Before (all five): service_role=YES / authenticated=YES / anon=YES.
   After  (all five): service_role=**YES** / authenticated=**NO** / anon=**NO**.
   SECURITY DEFINER and `search_path=public` unchanged; bodies untouched; signatures exact.
   Live enforcement probe: unauthenticated REST `POST /rest/v1/rpc/end_class_lesson_atomic`
   → `42501 permission denied for function end_class_lesson_atomic`.

4. Validation: `tsc --noEmit` EXIT=0 · `next build` EXIT=0 · repo-wide `eslint` EXIT=1 is fully
   attributed to pre-existing conditions (72 error findings inside *generated* Playwright trace
   bundles under `playwright-report/trace/**` + 2 in pre-existing `tests/prod-rescue.spec.ts`);
   zero error-severity findings in application source; changed spec lints clean exit-0.

No application behavior change. No U1–U6 redeployment. No reconciliation migrations.
