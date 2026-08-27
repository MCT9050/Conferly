# Conferly — Phase 4 Reconnaissance & Proposal

**Branch:** `feat/flexible-classroom-seating` · **HEAD:** `64df837` (unchanged)
**Mode:** Reconnaissance only. **No application code, migrations, configuration, dependencies, or tests were modified. Nothing staged, committed, or pushed.** This document is the sole artifact produced.

---

## 1. Current state

### Git
- Branch `feat/flexible-classroom-seating`, **1 commit ahead of origin**, HEAD `64df837 chore: finalize production database parity` (identical to the Phase 1 recon baseline; Phases 2–3 added zero commits).
- Working tree (all unstaged, all Phase 2/3 work):
  - **Modified (11):** `app/(marketing)/pricing/page.tsx`, `app/actions/checkout-actions.ts`, `app/api/class/lessons/[id]/launch/route.ts`, `app/api/heartbeat/route.ts`, `app/api/lk-token/route.ts`, `app/api/meetings/route.ts`, `app/class/classrooms/[slug]/lessons/page.tsx`, `app/class/classrooms/[slug]/students/page.tsx`, `app/meet/dashboard/page.tsx`, `lib/classEntitlements.ts`, `scripts/static_sql_check.py`
  - **Deleted (2):** `components/Dashboard.tsx`, `components/PricingPage.tsx` (proven unreachable in Phase 3)
  - **Untracked (~20):** Phase 2/3 routes (`enrollments`, `assignments` tree), class components, migrations `20260827000000_phase2_class_concurrency_atomic.sql` + `20260827010000_phase3_submission_grading.sql`, `tests/phase2-db-verification.sql`, `tests/phase3-db-verification.sql`, and the three phase reports/workflow map.
- Phase 1/2/3 artifacts present: `CONFERLY_APPLICATION_WORKFLOW_MAP.md` (Phase 1), Phase 2 & 3 implementation reports, production forensic JSONs, `functions_and_policies.txt`, reconciliation reports, `LOCAL_VS_PRODUCTION_DIFF.json`. `.cline-phase1/` is empty (Phase 1 content lives in the workflow map).
- Production was never touched; the local DB carries the full parity chain plus the two phase migrations.

---

## 2. Phase 1–3 baseline (what we must NOT re-litigate)

| Phase | Established |
|---|---|
| 1 | Full workflow map; production forensic catalog (23 tables, policies, grants, functions); race/dead-code inventory; entitlement map. |
| 2 | Enrollment API/UI (idempotent upsert, teaching-role gated); assignments/submissions APIs/UI (UNIQUE(assignment_id, student_id)); `enforce_classroom_capacity_atomic` RPC (row-lock, service_role-only EXECUTE) wired into `lk-token`; `launch_class_lesson_atomic` RPC (guarded `scheduled→live`); `meetings.user_id` contract verified (profiles FK CASCADE); product-scoped subscription reads everywhere; `classroom_plus` refused on every path; live-DB verification T1–T11 green. |
| 3 | `feedback text` + CHECK(≤5000); privilege tightening on `classroom_submissions` (grading columns service-role-only) closing the self-grading hole; PATCH grading endpoint + `GradeSubmissionForm` + student feedback panel; `static_sql_check.py` tooling bug fixed; dead `Dashboard.tsx`/`PricingPage.tsx` removed with reachability proof; all Phase 2 tests re-run green. |

Entering Phase 4: class authorization core, capacity/launch concurrency, grading authorization, and billing product-scoping are **verified sound**. Remaining gaps concentrate in **lifecycle completeness** and **one database-level authorization hole on the Meet side** (C3).

## 3. Confirmed remaining issues

### C1 — Meet lifecycle has no terminal events (schema capability ≠ product behavior)
`meetings.status` (default `'active'`), `ended_at`, `duration_seconds`, `participant_count`, `has_recording`, `host_id`, `room_id` exist via production parity (`20260824000000` L41–47) but the **application never reads or writes any of them**. There is no end-meeting action; participant rows are created only by invitation acceptance (`joined_at` set only inside the RPC); recording is a client-side Blob download (`useMeetingRecording` has zero DB/network writes — grep-confirmed); the `recordings` table has no writers; the dashboard lists by `created_at` and cannot distinguish active vs ended meetings. **Authoritative events exist upstream**: the LiveKit server emits room/participant/egress webhooks and `livekit-server-sdk@^2.15.3` ships `WebhookReceiver` — none of it is wired. **P1 product gap.**

### C2 — Class lifecycle stops at `'live'`; half the state machine is unreachable
- `classroom_lessons`: only `scheduled→live` exists (launch RPC). **No writer anywhere** for `'cancelled'` or `'recorded'` (grep: zero hits in app/lib/components; `recording_url` never written). The launch route's cancelled-refusal branch is therefore dead code today.
- `classrooms.status` (`draft/scheduled/live/completed/archived`) is frozen at `'draft'` forever — no writer.
- Commercial mismatch: `lib/pricing/class.ts` advertises **"Recordings"** for Class 20/30, yet no recording capability exists; assignments/grading are advertised as Class 30 features but are un-gated (all plans have them). **P1 product gap.**

### C3 — SECURITY: any authenticated user can insert themselves into any private meeting and obtain a join token
The most important finding; full proposal in §6 (P4-1). Verified chain:
1. **RLS permits self-insertion into arbitrary meetings**: `participants_insert_self_or_inviter` WITH CHECK `(user_id = auth.uid() OR invited_by = auth.uid())` (`init.sql` L101–107; recreated identically by `hardening.sql` L68–76). The self branch requires *no relationship to the meeting*.
2. **Own-row UPDATE is column-unrestricted** (`init.sql` L123–128) → users can also set their own `role` to anything.
3. **Table privileges were deliberately re-opened** to production defaults: `20260826000000_final_production_parity.sql` blanket-grants SELECT/INSERT/UPDATE/DELETE on all public tables to anon/authenticated/service_role (L9–21).
4. **Production has the identical hole** — shared debt, not local drift: `functions_and_policies.txt` L304–312 shows production policies byte-equivalent.
5. **The active token path trusts those rows**: `/api/lk-token` → `verifyRoomAccess()` treats any `meeting_participants` row as membership (`lib/meetingAuth.ts` L43–64) and issues a LiveKit JWT with publish+subscribe grants (`lib/livekit.ts` L47–54).
6. **No legitimate app path needs direct DML here**: grep shows zero user-JWT writes to `meeting_participants`; the sanctioned write is the SECURITY DEFINER RPC `accept_meeting_invitation(text,text)` plus service-role clients.

**Exploit:** any signed-in user → `POST /rest/v1/meeting_participants {meeting_id, user_id:self}` → `POST /api/lk-token {roomId:<victim slug>}` → full A/V join of a private meeting. Requires only an account + room identifier (slugs are shareable links; custom slugs guessable). Rated **P1 security** (not P0: needs an authenticated account and a room id; blast radius is meeting-room access) — but it defeats the private-meeting model and should be fixed first.

### C4 — Submission endpoint accepts submissions from teachers and auditors
`POST /api/class/assignments/[assignmentId]/submissions` authorizes via `verifyClassroomAccess().granted` — true for owner, instructors, TAs, students **and auditors**. Any of these can create/update their own submission row. Writes are correctly scoped to `session.userId` (no cross-user risk), so this is product/integrity noise, not a bypass: teachers appear in their own assignment's submissions list; read-only auditors can submit work. **P2.**

### C5 — Resubmission after grading silently supersedes the grade
Resubmission upserts `content` only (grading columns preserved — verified in Phase 3), but nothing tells the teacher that `submitted_at > graded_at`. The grade refers to superseded work with no staleness signal in API or UI. (Auto-clearing on resubmission would be worse: students could erase grades.) Visibility gap. **P2.**

### C6 — Any teaching role (incl. TA) can grant/remove teaching seats
Enrollments POST/DELETE gate on `verifyClassroomTeachingAccess` (owner/instructor/**ta**). A TA may enroll additional `instructor`/`ta` members (bounded by the teacher cap of 2 incl. the owner → at most one extra seat) and remove other teachers' rows. Owner-consent model violated within the cap. **P3.**

### C7 — Two class mutation routes use the user-JWT SSR client while siblings use service-role-after-authorization
`app/api/class/classrooms/route.ts` (L37, L88) and `app/api/class/classrooms/[classroomId]/lessons/route.ts` (L38) use `createSupabaseServerClient({request})` (anon key + cookies, RLS-gated); enrollments/assignments/submissions/launch use `getSupabaseServerClient()` (service-role) after explicit checks. Both work today, but correctness silently depends on RLS policy bodies doubling as WITH CHECK, and the mixed pattern is fragile maintenance surface. **P3.**

### C8 — Minor cosmetic/diagnostic items
- `GET /api/subscription-cap?productLine=class` returns `plan:'class_10'` with `studentCap:0, teacherCap:0` for no/inactive subscription — misleading label surfaced to UI. **P3.**
- `components/Lobby.tsx` is fully orphaned (last importer deleted in Phase 3); `getUserSubscription()` is caller-less; `/api/monitor` forwards arbitrary JSON with only a weak same-origin check (no session; low-risk spam relay, exposes nothing). **P3 cleanup bundle.**
- `meetings.is_public` force-`true` on creation → every Meet room spectator-joinable by link, incl. guessable custom slugs. Phase 2 classified this intentional; restated because fixing C3 makes it the next-largest exposure decision. **P2, recommend defer/opt-in (§10).**

---

## 4. New findings vs known candidates

| # | Origin | Note |
|---|---|---|
| C3 | **New** (found under §E active-path security) | Highest-priority item of Phase 4. |
| C4, C5 | **New** (adjacent to Phase 3 scope) | Phase 3 verified grading authorization but not submission-role scope or post-grade staleness. |
| C1, C2 | Known candidates (§A/§B) | Confirmed exactly as suspected; quantified writers/readers. |
| C6, C7 | New minor | Found while tracing authorization/client patterns. |
| §7 F-items | Known candidate (§F) | Residual drift re-classified; see below. |

---

## 5. Already-resolved items (verified this pass — do not reopen)

- `subscription_webhook_events_v2` local parity — **created** by `20260824000000` (the `LOCAL_VS_PRODUCTION_DIFF.json` note claiming absence predates that migration and is stale).
- `analytics_events.id` integer-serial drift — **resolved**: `20260826000000` drops/recreates it aligned to production (`int serial`, no user_id).
- Self-grading via PostgREST — closed by Phase 3 privilege tightening (re-verified: authenticated DELETE/score-UPDATE denied; content-only UPDATE allowed).
- `meetings.user_id` FK contract (profiles, CASCADE) — matches production since `20260824000000`.
- Capacity races, double-launch races, duplicate enrollment/submission races — covered by Phase 2 RPCs + UNIQUE constraints.
- Wrong-product/wrong-plan entitlement paths — none found: checkout mints product-scoped `custom_data {user_id, room_type, plan_tier}`; webhook maps product/variant → plan product-scoped, refuses `classroom_plus`/enterprise, fails closed on unknown; subscriptions UNIQUE(user_id, product_line) makes `.maybeSingle()` reads sound; legacy plan ids (`individual/pro/business/unlimited/enterprise`) accepted only inside the Meet product-line filter (continuity for existing production rows, no cross-product leakage).
- Heartbeat/deployment-check/auth-test — all session-gated.

## 6. Proposed fixes

### P4-1 · Close the `meeting_participants` direct-write hole (fixes C3)
| Field | Value |
|---|---|
| Finding | Any authenticated user can INSERT themselves (any role) into any meeting and UPDATE their own row via PostgREST; `/api/lk-token` then issues a full join token. Production carries identical policies. |
| Evidence | §3 C3 chain: `init.sql` L101–128; `hardening.sql` L68–99; `20260826000000` L9–21; `functions_and_policies.txt` L304–312; `lib/meetingAuth.ts` L43–64; `lib/livekit.ts` L47–54; grep: zero user-JWT writers. |
| Severity | **P1 (security)** |
| Current behavior | Self-insert → participant row → LiveKit token for any private room. |
| Desired behavior | Only the invitation RPC (SECURITY DEFINER) and service-role server code can write participant rows. |
| Proposed fix | Migration `20260827020000_phase4_meeting_participants_lockdown.sql`: `REVOKE INSERT, UPDATE, DELETE ON public.meeting_participants FROM anon, authenticated;` (SELECT retained). RLS policies stay as defense-in-depth. Add `tests/phase4-db-verification.sql` proving: (a) authenticated INSERT/UPDATE/DELETE denied at privilege level, (b) `accept_meeting_invitation` still works end-to-end (definer path unaffected by role revokes), (c) owner/participant/spectator lk-token decisions unchanged. |
| Why this over alternatives | **(1) Rewriting policy bodies** (e.g., require an accepted-invitation predicate) still permits invited-but-unaccepted inserts, adds EXISTS cost to every write, is harder to audit — and no app path relies on user-context writes anyway. **(2) A `joined_at IS NOT NULL` heuristic in `verifyRoomAccess`** keeps trusting client-writable rows and breaks silently if a future writer forgets to stamp it. **(3) REVOKE** matches the proven Phase 3 precedent (grading columns), is provable via two catalog queries, touches zero app code, and cannot regress RPC/service-role paths because definer functions run as the function owner. |
| Files likely affected | New migration; new `tests/phase4-db-verification.sql`; no app code changes required. |
| DB changes | Required (privileges only; additive, idempotent). |
| Security impact | High — closes unauthorized private-room join and self-role escalation. |
| Concurrency impact | None. |
| Regression risk | Low locally; medium operationally only in that production must apply the same statement for parity (production read-only for us — flag to ops; local divergence until then is intentional hardening, documented in the migration header per repo convention). |
| Effort | Small |
| Recommendation | **Implement first.** |

### P4-2a · Class lesson terminal transitions: teacher End / Cancel (fixes C2 core)
| Field | Value |
|---|---|
| Finding | `'cancelled'`/`'recorded'` have no writers; a launched lesson stays `live` forever. |
| Evidence | CHECK constraint (`classroom_domain.sql` L41); grep: no writers for cancelled/recorded/recording_url; launch RPC handles only scheduled/live. |
| Severity | P1 product gap |
| Current behavior | Only `scheduled→live`; teachers cannot cancel or end lessons. |
| Desired behavior | Owner/instructor cancels scheduled or ends live lessons; race-safe, idempotent; webhook reconciliation later reuses the same guarded RPCs. |
| Proposed fix | Migration adding two SECURITY DEFINER RPCs in Phase 2 style (`SET search_path=public`, `FOR UPDATE`, guarded WHERE, service_role-only EXECUTE): `cancel_class_lesson_atomic(p_lesson_id)` (`scheduled→cancelled`; refuses live) and `end_class_lesson_atomic(p_lesson_id)` (`live→completed`; idempotent). Routes `POST /api/class/lessons/[id]/cancel` and `/end`: authorize via `verifyClassroomTeachingAccess` first (same shape as launch), then delegate to RPC. UI: Cancel on scheduled rows, End on live page. Vocabulary decision: terminal state is `'completed'` now; `'recorded'`+`recording_url` stay reserved for the future recording pipeline so schema semantics remain honest. |
| Why this over alternatives | The RPC pattern carries the atomicity/idempotency guarantees already verified for launch (T7/T8 test templates exist); inline route UPDATEs would reintroduce exactly the race Phase 2 eliminated; one parameterized end/cancel RPC saves little and muddies guard conditions. Manual-first needs no external infra; webhooks become reconciliation rather than a blocker. |
| Files likely affected | New migration; `app/api/class/lessons/[id]/cancel/route.ts`; `app/api/class/lessons/[id]/end/route.ts`; `app/class/classrooms/[slug]/lessons/page.tsx`; `.../[lessonId]/live/page.tsx` (+ small UI); `tests/phase4-db-verification.sql`. |
| DB changes | Required (two functions; additive). |
| Security impact | Positive — teaching-role-gated state control. |
| Concurrency impact | Guarded UPDATEs serialize concurrent end/cancel deterministically. |
| Regression risk | Low (new endpoints; launch path untouched). |
| Effort | Medium |
| Recommendation | Implement second. |

### P4-2b · Meet lifecycle events via LiveKit webhooks (+ host-end fallback) (fixes C1)
| Field | Value |
|---|---|
| Finding | `ended_at/status/duration_seconds/participant_count` never written; no authoritative event source wired. |
| Evidence | §3 C1; production columns exist unused; `WebhookReceiver` ships in the already-present `livekit-server-sdk@^2.15.3`. |
| Severity | P1 product gap |
| Current behavior | Meetings stay `active` forever; metrics columns keep defaults. |
| Desired behavior | Termination + occupancy recorded from the authoritative runtime; dashboards distinguish ended meetings with duration/participants. |
| Proposed fix | New `POST /api/webhooks/livekit` using `WebhookReceiver` (signature-verified via API key/secret; reject-all otherwise). Service-role idempotent writes: `room_finished` → guarded `UPDATE meetings SET status='completed', ended_at=now() WHERE … AND ended_at IS NULL`, `duration_seconds = ended_at − started_at`; occupancy from `participant_joined/left` into `meeting_participants.joined_at` upserts → `participant_count = COUNT(DISTINCT …)`. Class rooms recognized by deterministic `class-<classroomId>-<lessonId>` names and reconciled through `end_class_lesson_atomic`. Optional host "End meeting" server action writes the same fields as fallback for webhook misconfig (webhooks stay primary). Ops note: requires configuring the LiveKit webhook target URL — deployment-checklist item only. `has_recording` remains false until Egress exists (deferred). |
| Why this over alternatives | Client beacons die with the tab and are client-trusted; cron sweepers produce wrong durations and need new infra; DB triggers cannot see LiveKit state. LiveKit is already the room-lifecycle source of truth and its webhooks are signature-verifiable server-to-server; host-fallback covers missed events without trusting clients. |
| Files likely affected | New `app/api/webhooks/livekit/route.ts`; new `lib/livekitWebhooks.ts`; small helpers in `lib/meetingPersistence.ts`; optional host-end action/button; webhook fixtures in `tests/phase4-db-verification.sql`. |
| DB changes | None beyond P4-2a RPCs (uses existing columns). |
| Security impact | Positive; signature verification mandatory before any write. |
| Concurrency impact | Idempotent monotonic guards make duplicate/replayed/out-of-order deliveries safe. |
| Regression risk | Low-medium (new surface; class reconciliation must no-op when lesson not live). |
| Effort | Medium-Large |
| Recommendation | Implement third; can be approved/staged separately if you want to sequence infra config. |

### P4-3 · Restrict submissions to enrolled students (fixes C4)
- **Fix:** in `app/api/class/assignments/[assignmentId]/submissions/route.ts`, after `verifyClassroomAccess`, require `access.accessRole === 'student'` (owner/instructors/TAs/auditors → 403 "Only enrolled students can submit").
- **Why:** the route's own error copy already promises this; auditors are read-only by definition; teachers have no grading reason to hold submission rows. Cheapest correct scope — no schema change, no new authorization helper.
- **Alternative rejected:** adding a `submissions_allowed` flag per assignment — new product surface nobody asked for.
- **Severity** P2 · **DB changes** none · **Regression risk** low · **Effort** small · **Recommendation:** implement.

### P4-4 · Surface post-grade resubmission staleness (fixes C5)
- **Fix:** compute `is_stale = graded_at IS NOT NULL AND submitted_at > graded_at` in `GET /api/class/assignments/[assignmentId]` for teacher list items and the student's own submission; render a badge in the assignment page (teacher cards + student block).
- **Why display-level over write-level:** auto-clearing score/graded_at on resubmission would let students destroy grades by resubmitting; a stale marker preserves grading history while restoring teacher awareness. No migration; pure read-shape + UI.
- **Severity** P2 · **DB changes** none · **Concurrency impact** none (derived at read time) · **Regression risk** low · **Effort** small · **Recommendation:** implement.

### P4-5 · Owner-only teaching-seat management (fixes C6)
- **Fix:** in the enrollments route: POST with `role ∈ {instructor, ta}` requires owner; DELETE must first read the target row and require owner if its role is instructor/ta. TAs keep full student-seat management.
- **Why:** restores owner consent over who holds authority while keeping TA delegation useful; one extra SELECT on DELETE; mirrors how `verifyClassroomTeachingAccess` already distinguishes roles.
- **Alternative rejected:** DB-level trigger/policy distinguishing roles — RLS can't see payload role cleanly and policies shouldn't encode product nuance the app already owns.
- **Severity** P3 · **DB changes** none · **Regression risk** low · **Effort** small · **Recommendation:** implement (cheap policy tightening); drop if you consider current behavior acceptable.

### P4-6 · Unify class mutation clients on service-role-after-auth (fixes C7)
- **Fix:** switch `classrooms/route.ts` and `lessons/route.ts` inserts to `getSupabaseServerClient()` after their existing checks (pattern used by every sibling route).
- **Why:** removes silent dependence on RLS WITH CHECK details for correctness and makes all mutations follow one reviewable pattern. (RLS remains as defense-in-depth either way.)
- **Severity** P3 · **DB changes** none · **Regression risk** low · **Effort** trivial · **Recommendation:** implement as part of the small batch.

### P4-7 · Cosmetic/diagnostic cleanup bundle (C8)
- `subscription-cap`: return `plan:'trial'` (not `'class_10'`) when class caps fall back to zero.
- Delete orphaned `components/Lobby.tsx`; remove caller-less `getUserSubscription` export (or keep if you prefer API stability — zero behavioral difference).
- Optionally add a session guard to `/api/monitor` (parity with heartbeat) — tiny, closes a spam-relay nuisance.
- **Severity** P3 · **Effort** small · **Recommendation:** implement only if you want the tidy-up; otherwise defer harmlessly.

---

## 7. Production/local contract — residual classification (area F)

After Phase 1's catalog and the three parity migrations, the **only remaining differences** are:

| Item | Classification | Note |
|---|---|---|
| Timestamp NULLability drift (meetings/profiles/organizations) | Harmless/documentational | Insert behavior identical; documented in reconcile headers. |
| Policy *names* differ from production (bodies semantically equal) | Harmless/documentational | Names not operationally referenced. |
| `meeting_participants` permissive DML | **Security risk (shared)** | Not drift — production matches local (§3 C3). P4-1 fixes both locally and provides the statement ops must apply upstream. |
| Everything else (v2 ledger table, FK shapes, analytics_events serial id, function/trigger ACLs, grants defaults) | Resolved | Verified against `LOCAL_VS_PRODUCTION_DIFF.json`, `20260824000000/25000000/26000000` contents, and `functions_and_policies.txt`. |

No active application path depends on any remaining harmless-drift item.

## 8. Severity / effort summary

| Item | Finding | Severity | Effort | DB changes | Regression risk |
|---|---|---|---|---|---|
| P4-1 | meeting_participants direct-write hole | **P1 security** | Small | Yes (privileges) | Low |
| P4-2a | Class lesson end/cancel missing | P1 product | Medium | Yes (2 RPCs) | Low |
| P4-2b | Meet lifecycle webhooks (+host fallback) | P1 product | Medium-Large | No (beyond 2a) | Low-Medium |
| P4-3 | Submission role scope | P2 | Small | No | Low |
| P4-4 | Stale-grade visibility | P2 | Small | No | Low |
| P4-5 | Owner-only teaching seats | P3 | Small | No | Low |
| P4-6 | Client-pattern unification | P3 | Trivial | No | Low |
| P4-7 | Cosmetic/diag cleanup | P3 | Small | No | Low |

---

## 9. Recommended implementation order

```text
1. P4-1   security lockdown of meeting_participants        (small, highest risk-reduction, independent)
2. P4-2a  class lesson end/cancel RPCs + routes + UI       (medium, completes class lifecycle; no infra dependency)
3. P4-2b  LiveKit webhook foundation for Meet (+reconcile) (medium-large; may be its own approval/stage)
4. P4-3   submission role scope                            (small)
5. P4-4   stale-grade visibility                           (small)
6. P4-5   owner-only teaching-seat management              (small, optional)
7. P4-6   client-pattern unification                       (trivial)
8. P4-7   cosmetic/diagnostic bundle                       (small, optional)
```

**Rationale:** security first because P4-1 is small, provable, and closes an active unauthorized-access path. Lifecycle next because it is the largest *product* value and everything in it is additive — manual transitions (P4-2a) deliberately precede the webhook foundation (P4-2b) so no external infra config blocks user-visible completeness, and the webhook work then lands as reconciliation on top of stable guarded RPCs. The assignment-integrity pair (P4-3/P4-4) rides the same subsystem Phase 3 just verified. The tail items are cheap consistency wins batched last so they can be approved or dropped as a group without re-reviewing subsystems.

**Verification plan at implementation time:** `tsc --noEmit`, eslint on touched files, `scripts/static_sql_check.py` on new migrations, live local-DB `tests/phase4-db-verification.sql` (privilege denials, RPC semantics incl. race re-runs, invitation-RPC compatibility, signed-webhook fixtures), plus a Phase 2/3 regression rerun. Playwright suite stays untouched (targets production). Per AGENTS.md, relevant `node_modules/next/dist/docs/` guides will be read before writing any Next-facing code.

---

## 10. Explicitly recommended for deferral / future

| Item | Why deferred |
|---|---|
| Recording pipeline (`has_recording`, `recordings` table, lesson `'recorded'`+`recording_url`) | Requires object storage + LiveKit Egress cost/architecture decisions; a larger product initiative. P4-2a deliberately reserves (not fakes) these states. Pricing copy claiming "Recordings" should be reconciled by marketing when this ships. |
| `meetings.is_public` opt-in toggle UI | Product decision on link-sharing UX; Phase 2 verified current behavior intentional. Revisit after P4-1 removes the bigger exposure. |
| Entitlement gate at classroom creation ("draft graveyard") | Documented frictionless-by-design trade-off (Phase 1 §7.3); gating would change onboarding behavior. |
| Assignment `due_at` enforcement / lock | Pure product policy choice; no integrity or security impact today. |
| Applying P4-1's statement to production | Ops task outside repo scope; statement provided via migration header documentation. |
| Plan-feature gating of assignments/grading to Class 30 | Current all-plans behavior is generous but coherent; gating is a commercial decision, not an engineering fix. |
| Legacy/dead sweep beyond P4-7 | Remaining legacy (`Lobby.tsx` etc.) is unreachable and inert once P4-7 lands; further pruning is general cleanup, out of Phase 4 scope. |

---

## STOP

This reconnaissance is complete. Per instructions: **no implementation has been performed**, nothing was committed or pushed, and the working tree beyond the pre-existing Phase 1–3 state contains only this report file.

Awaiting your review: approve/correct/reject individual proposals (P4-1 … P4-7), after which implementation begins against the agreed order.
