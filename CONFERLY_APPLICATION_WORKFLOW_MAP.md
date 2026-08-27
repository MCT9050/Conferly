# Conferly Final Excellence Program — Phase 1
## Application Reconnaissance: End-to-End Workflow Map

**Mission:** Establish the authoritative application-level workflow map governing every subsequent Phase 2–10 implementation and QA task.

**Baseline:** `64df837 chore: finalize production database parity` (DB reconciliation CLOSED).

**Repo path inspected:** `/home/mtc/conferly-next` (the `conferly-verify` workspace is a verification environment and was not used as the source of truth).

**Working tree:** Clean at `64df837`, branch `feat/flexible-classroom-seating` (1 commit ahead of remote — not touched).

**Method:** Read-only. No application, schema, config, migration, dependency, or git-state mutation. This document is the ONLY new artifact produced in Phase 1.


---

## 1. Executive Summary

Conferly is a Next.js 16 (App Router) application built on top of:
- **Supabase** (Postgres 17) for auth, RLS-protected persistence, and webhook ledgering.
- **LiveKit Cloud** for the real-time video room (server-side token issuance, lazy-loaded client).
- **Lemon Squeezy** for subscription billing, via product-scoped webhook RPC.
- **Hugging Face Serverless Inference** for AI summarization, translation, and assistant (rate-limited, entitlement-gated).

The product is split into two parallel surfaces sharing a single auth profile and one database:

| Surface | Subdomain | Domain | Pricing |
|---|---|---|---|
| Conferly **Meet** | `conferly.site` (root) | `meet` | `meet_free`, `meet_individual`, `meet_pro`, `meet_unlimited`, `meet_enterprise` |
| Conferly **Class** | `class.conferly.site` (rewritten to `/class/*`) | `class` | `class_10`, `class_20`, `class_30`, `class_custom` |

**Major findings (severity-weighted):**

1. **P0 — DB schema and RLS are far richer than the application actually uses.** `classroom_assignments` and `classroom_submissions` tables and their RLS policies exist in production but are NEVER read or written by any application code path. `classroom_enrollments` is read-only at the application layer — there is no enrollment create/update/delete path. A teacher cannot invite a student from the UI.
2. **P0 — `meetings.user_id` is a hard schema-level requirement (`NOT NULL`, `ON DELETE CASCADE` to `profiles(id)`).** The application only ever sets it via `lib/meetingPersistence.ts#buildMeetingInsert` (good). If a future code path inserts a row with `user_id = NULL`, the DB will reject it.
3. **P1 — `meetings.started_at` has a production `DEFAULT now()` (finalize migration 20260825000000).** The application explicitly sets `started_at = startsAt` on insert, so this default only matters for ad-hoc inserts.
4. **P1 — `subscriptions` is product-scoped:** the live UNIQUE constraint is `subscriptions_user_product_line_key UNIQUE (user_id, product_line)`. The webhook RPC enforces `CHECK (p_product_line IN ('meet','class'))` and uses `ON CONFLICT (user_id, product_line) DO UPDATE` — fully aligned with the production contract.
5. **P1 — `accept_meeting_invitation(p_meeting_slug text, p_token_hash text)` is `SECURITY DEFINER`, returns `TABLE(meeting_id uuid, slug text, database_role text)`.** Application call site `app/api/meeting-invitations/accept/route.ts` is a perfect 1:1 match for the live signature.
6. **P1 — `classroom_lessons` has no API mutation path to set `livekit_room_id` from the lesson itself when first published by `/launch` (the launch route writes `livekit_room_id = 'class-<classroom_id>-<lessonId>'` if NULL).**
7. **P2 — Meet dashboard (`app/meet/dashboard/page.tsx`) is essentially a stub.** It calls `auth.getUser()` then renders a hard-coded "No upcoming meetings" placeholder. The actual user-meetings list lives in `app/(platform)/dashboard/page.tsx`.
8. **P2 — `getUserSubscription()` (`app/actions/checkout-actions.ts`) reads subscriptions WITHOUT a `product_line` filter** — it returns all rows for the user, then returns `null` on error. This action appears to be unused.
9. **P2 — There is NO `getSubscription` action used by the dashboards.** All entitlement reads go through `lib/meetEntitlements.ts`, `lib/classEntitlements.ts`, and `app/api/subscription-cap/route.ts`, each of which properly scopes by `product_line`.
10. **P2 — Authorization for class operations mixes server-side (`verifyClassroomTeachingAccess`) with strict data ownership at the API route level.** `POST /api/class/classrooms` lets any authenticated user create a classroom without checking a Class subscription, but `lk-token` correctly blocks live access via `enforceClassCapacity` when the owner has no active Class plan.
11. **P2 — `legacyTierToPlanId` and `planIdToLegacyTier` mapping in `types.ts` treat `classroom`/`classroom_plus` as legacy aliases of `class_10`/`class_30`.** However, the webhook contract explicitly REFUSES to map `classroom_plus` (`'Legacy classroom_plus webhook mapping is UNVERIFIED'`). The two layers disagree on legacy Class+ handling.
12. **P2 — Lemon Squeezy `mapPlanFromProduct` parses the product name to derive plan + cap if `custom_data.plan_tier` is missing.** Several product name strings are string-matched. This is fragile but currently the only fallback.
13. **P3 — There is no `assignments` or `submissions` UI in either product.** The tables are inert from the user's perspective.
14. **P3 — `app/meet/rooms/[slug]/page.tsx` does a server-side `verifyAccess('meet', ...)` then renders `MeetLiveSession` with the slug — the LiveKit room ID is `slug`.**
15. **P3 — `components/Dashboard.tsx` (the legacy client-side dashboard) still uses a non-product-scoped `subscriptions` query.** It is still referenced by older code paths and still does its own subscription fetch on `?checkout=success` URLs.
16. **P3 — Marketing `?checkout=success`/`?checkout=cancelled` URL params are honored by `app/actions/checkout-actions.ts` and `components/Dashboard.tsx` but NOT by the canonical `(platform)/dashboard/page.tsx`.**

**Auth architecture:** Single `auth.users` table; `profiles` is the `public` mirror populated by an `on_auth_user_created` row trigger that calls `public.handle_new_user()`. RLS on `profiles` is `id = auth.uid()` only. The `meetings.user_id` FK references `profiles(id)` (per production), not `auth.users(id)`.

**Authorization model:** Three layers, all expected to agree:
1. **UI gating** (e.g. `canTeach`, `access.source === 'owner'`) — purely cosmetic.
2. **Server route handlers** call `verifyRoomAccess` (Meet) or `verifyClassroomAccess` / `verifyClassroomTeachingAccess` (Class), then call the appropriate `getSupabaseServerClient()` (service-role) or a request-scoped `@supabase/ssr` cookie client.
3. **RLS** on every public table; service-role bypasses RLS. Critical writes (subscription, webhook processing) use service-role and rely on the SQL function contract.

**No implementation, refactor, fix, commit, push, dependency change, or migration was performed.** See Section 20 for confirmation.

---

## 2. Repository Architecture

### 2.1 Top-level layout

```
conferly-next/
├── app/                       Next.js 16 App Router
│   ├── (marketing)/           Public marketing pages (pricing, landing)
│   ├── (platform)/            Cross-product platform shell
│   ├── actions/               Server actions (auth-recovery, checkout, ai)
│   ├── admin/                 /admin/health
│   ├── api/                   Route handlers
│   ├── auth/                  Sign-in, sign-up, password reset
│   ├── class/                 Conferly Class pages
│   ├── lobby/                 Pre-join meeting lobby
│   ├── meet/                  Conferly Meet pages
│   ├── meeting/               DEPRECATED redirect
│   ├── error.tsx, loading.tsx, not-found.tsx
│   ├── layout.tsx, page.tsx
├── components/                React components
│   ├── meet/, class/, meeting/, live/, marketing/, platform/
│   └── AuthPage, Dashboard (legacy), Lobby (legacy), etc.
├── lib/                       Server + shared utilities
│   ├── auth.ts                Session resolver, role hierarchy
│   ├── accessControl.ts       Domain-agnostic access check
│   ├── meetingAuth.ts         Meeting role/owner/participant/public
│   ├── classroomAuth.ts       Classroom role/owner/enrollment
│   ├── meetingPersistence.ts  Meeting create + slug normalization
│   ├── meetEntitlements.ts    Meet premium feature gating
│   ├── classEntitlements.ts   Class capacity enforcement
│   ├── livekit.ts             Server LiveKit token creation
│   ├── pricing/{meet,class}.ts  Authoritative plan tables
│   ├── lemon-squeezy.ts       Checkout URL + webhook signature
│   ├── supabase/{server,browser}.ts  SSR / browser client factories
│   ├── supabaseServerClient.ts  Service-role client
│   ├── supabaseClient.ts      Browser client re-export
│   ├── hf-api.ts              Hugging Face API wrapper
│   ├── system-guard.ts        AI rate limiter + circuit breaker
│   └── ... (~50 files total)
├── hooks/                     Client-side React hooks
├── db/                        Local SQL mirrors + diagnostic markdown
├── supabase/                  Supabase project (18 migrations)
├── tests/                     Playwright e2e
├── types.ts                   App-wide enums + product types
├── proxy.ts                   Edge proxy (renamed middleware.ts)
├── next.config.ts             Bundle analyzer, CSP, cache headers
└── package.json               Next 16, React 19, @supabase/ssr 0.10, livekit 2.x
```

### 2.2 Next.js architectural notes

- **Routing groups:** `(marketing)`, `(platform)` are organizational. `meet`, `class`, `lobby` are real segments. `meeting/` is a redirect shell.
- **Edge proxy (`proxy.ts`):** Renamed from `middleware.ts` per Next 16. Cookies/SSR refresh for the session. Hard-coded protected routes: `['/dashboard', '/meet', '/class', '/classrooms', '/lobby', '/settings', '/profile']`. Class subdomain `class.*` rewrites `/` → `/class`, `/pricing` → `/class/pricing`, `/dashboard` → `/class/dashboard`, and BLOCKS `/meet` (redirects to `/class/dashboard`).
- **CSP:** Strict, with explicit allowances for LiveKit, Hugging Face, Vercel analytics, GA, Cloudflare insights.

### 2.3 Supabase client model

- **Browser client** (`lib/supabase/browser.ts`): `createBrowserClient(supabaseUrl, anonKey)` with `persistSession`, `detectSessionInUrl`, `autoRefreshToken`. Re-exported from `lib/supabaseClient.ts`.
- **Server user client** (`lib/supabase/server.ts`): context-aware `createSupabaseServerClient({ request?, response? })`. Domain derivation handles subdomains.
- **Service-role client** (`lib/supabaseServerClient.ts`): `createServerClient(supabaseUrl, serviceRoleKey, { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } })`. Used for ALL entitlement checks, webhook processing, and authorization lookups.

**Critical authorization pattern:** The service-role client is used at the API route layer to bypass RLS for **read-only authorization lookups** that gate downstream access. The actual writes that matter (e.g. `accept_meeting_invitation`) still happen under the user JWT and are subject to RLS + SECURITY DEFINER constraints. See Section 7 for the full authorization map.

---

## 3. Authentication Architecture

### 3.1 Surfaces and clients

| Surface | Path | Auth client | Notes |
|---|---|---|---|
| Sign-in form | `app/auth/page.tsx` | `fetch('/api/auth/signin', POST)` | Optional `?product=meet\|class` query is forwarded |
| Sign-up form | same page | `fetch('/api/auth/signup', POST)` | Sets `role: 'participant'` in `raw_user_meta_data`; sets `default_product` if provided |
| Password reset request | `app/auth/forgot-password/page.tsx` | server action `requestPasswordReset` (service-role) | Calls `supabase.auth.resetPasswordForEmail`, redirect to `https://www.conferly.site/auth/update-password` |
| Password reset update | `app/auth/update-password/page.tsx` | `createClient(url, key)` (NEW client, NOT the shared browser client) | Reads `access_token`+`refresh_token` from URL hash, calls `setSession`, then `updateUser({ password })` |
| Sign-out | `lib/clientAuth.ts` | `fetch('/api/auth/signout', POST)` then redirect `/auth` | |
| Refresh | `lib/clientAuth.ts` | `fetch('/api/auth/refresh', POST)` | Server reads `sb-*-auth-token` cookie, exchanges for new pair via `?grant_type=refresh_token` |

### 3.2 Server-side session resolution

`lib/auth.ts#getServerSession(request?)`:
- Calls `supabase.auth.getUser()` (NOT `getSession` alone — `getUser` validates against the auth server).
- Resolves role from `user_metadata.role` or `app_metadata.role` (defaults to `participant`).
- Returns `{ userId, email, role, expires }` or `null`.

`getAuthorizedSession` adds role/permission gating via the `ROLE_HIERARCHY = ['guest', 'participant', 'moderator', 'owner']` ladder and a static `ROLE_PERMISSIONS` map. Note: in practice, server routes do not call `getAuthorizedSession`; they call `getServerSession` and then perform their own domain-specific check (e.g. `verifyRoomAccess`).

### 3.3 Profile creation

- `on_auth_user_created` row trigger on `auth.users` calls `public.handle_new_user()`.
- `handle_new_user` inserts a row into `public.profiles (id, email, display_name)` with `display_name` from `raw_user_meta_data.full_name` (or local-part of email).
- `handle_new_user` ACL per production: PUBLIC + postgres + anon + authenticated + service_role.

### 3.4 Edge proxy (cookie refresh + protected-route enforcement)

- **Refresh:** on every matched request, instantiates an SSR Supabase client, calls `getUser()`. This refreshes the session cookie if expired.
- **Protected routes:** `/dashboard`, `/meet`, `/class`, `/classrooms`, `/lobby`, `/settings`, `/profile` → if no user, redirect to `/auth?redirect=<pathname>`.
- **Auth routes:** if already signed in, redirect to `/dashboard`.
- **Deprecated routes:** `/meeting?type=classroom&slug=X` → `/class/classrooms/X`; otherwise `/meet/rooms/<slug>`; missing slug → `/meet/dashboard`.
- **Class subdomain rewriting:** if `Host` starts with `class.`, `/` → `/class`, `/pricing` → `/class/pricing`, `/dashboard` → `/class/dashboard`. `/meet` is BLOCKED on class subdomain (redirect to `/class/dashboard`). `/classrooms` → `/class/classrooms`.

### 3.5 Auth-related rate limiting

- `app/api/auth/signin`: `RATE_LIMITS.auth`.
- `app/api/auth/signup`: `RATE_LIMITS.signup` (stricter).
- Webhook and refresh are not rate-limited at the application layer.

---

## 4. Meet Workflow Map

End-to-end user journey for Conferly Meet, from sign-in to room termination.

### 4.1 Authentication and dashboard

1. **User visits `/meet/dashboard`** (after sign-in or via `/dashboard` → product selector → Meet).
2. **Server:** `app/meet/dashboard/page.tsx` calls `createSupabaseServerClient().auth.getUser()`. No DB SELECT happens here (the page is a stub — see Finding P2 #7).
3. **UI:** Renders `<CreateMeetingButton />` and `<JoinExistingMeeting />`. Hard-coded "No upcoming meetings" placeholder.
4. **Cross-product recent activity:** The user-facing "recent" view lives in `app/(platform)/dashboard/page.tsx`. It runs TWO parallel queries: `meetings` (own) and `classrooms` (own), each with `limit(3)`, and merges them into `recentActivity`. This is the actual user-visible "your workspaces" list.

### 4.2 Meeting creation

1. **User clicks "New Meeting"** (`CreateMeetingButton`):
   - Client `fetch('/api/meetings', { method: 'POST', body: '{}' })`.
2. **Route handler** `app/api/meetings/route.ts`:
   - `getServerSession(request)` (cookie JWT).
   - Parses optional `slug` (no body is sent from the current UI).
   - Calls `createExplicitMeeting(supabase, userId, requestedSlug?)` in `lib/meetingPersistence.ts`.
3. **DB INSERT** (`supabase.from('meetings').insert(payload).select('id, slug, owner').single()`):
   - Payload from `buildMeetingInsert`: `{ owner, user_id, slug, room_code, title, description, starts_at, started_at, ends_at, ended_at, is_public, org_id }` (org_id is unused in the current code path; always `null`).
   - Slug is 12-char `[a-z0-9]+`; `room_code = slug`; `started_at = startsAt = now()`.
   - On `23505` (unique violation) the function retries up to 5 times with a fresh random slug, then returns `{ ok: false, status: 409, error: 'slug_conflict' }`.
4. **RLS:** The user-JWT client INSERT against `meetings` is gated by `meetings_insert_owner (FOR INSERT WITH CHECK (owner = auth.uid()))`. `user_id` has `meetings_user_id_fkey` to `profiles(id)`; since the row is being inserted in the same transaction that creates the trigger-populated profile, this is fine.
5. **Response:** `{ ok: true, meeting: { id, slug } }`.
6. **UI:** `router.push('/lobby?room=' + encodeURIComponent(slug))`.

**Authorization at server:** `getServerSession` only — no domain check (the route is post-auth).

### 4.3 Join by code/link

1. **`JoinExistingMeeting`** (dashboard widget): User pastes a meeting link or code. `normalizeMeetingJoinTarget` parses the input and returns:
   - `/lobby?room=...&intent=join` for `/meet/rooms/<slug>` URLs
   - `/lobby?room=...&intent=join&invite=...` for `/lobby?room=...&invite=...` URLs
2. **Lobby (`/lobby?room=...`)** renders `LobbyPreJoin`, which:
   - Acquires mic/cam permissions, shows device picker.
   - If `?intent=join&invite=...&domain=meet`, calls `acceptInvitation()` on mount, which calls `POST /api/meeting-invitations/accept` with `{ room, invite }`. (For Class domain the invite flow is server-controlled via the `lk-token` route.)
   - On click "Join meeting" → `router.push('/meet/rooms/' + encodeURIComponent(roomId))`.
3. **`/meet/rooms/[slug]`** is a server component that calls `verifyAccess('meet', session.userId, slug)`:
   - If `!access.granted` → `redirect('/dashboard')`.
   - Else renders `<MeetLiveSession roomId={slug} meetingId={access.roomId} userId role userName />`.

### 4.4 Room access verification (server)

`lib/meetingAuth.ts#verifyRoomAccess(userId, roomId)`:
1. **Service-role query** to `meetings` by `slug = roomId`, select `id, owner, is_public`.
2. Falls back to `meetings.id = roomId` if no slug match (defends against UUID-based roomIds).
3. If `meeting.owner === userId` → return `{ accessRole: 'owner', source: 'owner' }`.
4. Else query `meeting_participants` (`meeting_id = meeting.id`, `user_id = userId`). If found, return role mapped to `owner|presenter|participant|spectator`.
5. Else if `meeting.is_public` → `{ accessRole: 'spectator', source: 'public' }`.
6. Else `null`.

**Important:** This function uses the service-role client — RLS is bypassed. The same lookup under the user JWT would have to satisfy `meetings_select_authorized` (which permits owner OR participant). The service-role path here is needed because we need to also handle the public-meeting spectator case, which is currently not covered by RLS (the `is_public` branch returns `spectator` without a participant row).

**RLS on `meetings`:** Per the live production contract (`20260825000000` finalize migration):
- `meetings_select_authorized` (SELECT, authenticated): owner OR meeting_participants row.
- `meetings_insert_owner` (INSERT, authenticated): `owner = auth.uid()`.
- `meetings_update_owner` / `meetings_delete_owner`: owner only.

Note: public spectator access is NOT covered by RLS — it is implemented in application code, not in the database. (Finding P2.)

### 4.5 LiveKit token issuance

`app/api/lk-token/route.ts`:
- **Auth:** `getServerSession(request)`.
- **Body validation:** `roomId|room` (meet), `role` (`'participant'|'spectator'`), `username|name`, `domain` (`'meet'|'class'`), `classroomId`, `lessonId`.
- **For `domain === 'meet'`:**
  - `verifyAccess('meet', userId, roomId)` (which delegates to `verifyRoomAccess`).
  - If `access.role === 'spectator'` → token role is `spectator`. Else `requestedRole`.
  - `participantRoleForToken = mapMeetAccessRoleToSharedRole(access.role)`:
    - `owner` → `host`
    - `presenter` → `presenter`
    - `participant` → `participant`
    - else → `viewer`
  - `createLiveKitToken({ identity, name, room: access.roomId, role, participantRole })` → JWT.
- **For `domain === 'class'`:** see Class workflow.
- Returns `{ token, url: LIVEKIT_URL }`.

### 4.6 Meet invitation creation

`app/api/meetings/[meetingId]/invitations/route.ts`:
1. `getServerSession(request)`.
2. `meetingId` must be UUID.
3. Body: `{ role: 'attendee' | 'presenter', expiresAt: ISO string, maxUses: int|null }`. Defaults to `role=attendee`, `expiresAt=null`, `maxUses=null`.
4. Service-role lookup of `meetings.id = meetingId`, check `meeting.owner === session.userId` (else 403).
5. `generateRawInvitationToken()` → 32 random bytes, base64url.
6. `hashInvitationToken(rawToken)` → SHA-256 hex.
7. INSERT into `meeting_invitations` (via user-JWT `createSupabaseServerClient`):
   - `meeting_id`, `token_hash`, `role`, `created_by`, `expires_at`, `max_uses`.
8. Response: `{ invitationId, meetingId, room: meeting.slug, invite: rawToken, url: '/lobby?room=...&intent=join&invite=...', expiresAt, maxUses }`.

**RLS on `meeting_invitations`:** `meeting_invitations_owner_insert` (created_by = auth.uid AND EXISTS meetings owned by caller). Column-level GRANTs: `authenticated` may SELECT (id, meeting_id, role, created_by, expires_at, revoked_at, max_uses, use_count, last_used_at, created_at), INSERT (meeting_id, token_hash, role, created_by, expires_at, max_uses), UPDATE (revoked_at). Raw token is NEVER stored in DB.

### 4.7 Meet invitation acceptance (atomic RPC)

`app/api/meeting-invitations/accept/route.ts` → `supabase.rpc('accept_meeting_invitation', { p_meeting_slug, p_token_hash })`.

The function `public.accept_meeting_invitation(p_meeting_slug text, p_token_hash text) RETURNS TABLE(meeting_id uuid, slug text, database_role text)` is `SECURITY DEFINER`, `SET search_path = ''`, and:
1. Asserts `auth.uid()` is non-null.
2. Validates slug non-empty AND token_hash matches `^[0-9a-f]{64}$`.
3. `SELECT ... FROM meeting_invitations JOIN meetings WHERE meeting.slug = p_meeting_slug AND invitation.token_hash = p_token_hash FOR UPDATE OF invitation` — this serializes concurrent uses of one invitation, making `max_uses` and `use_count` race-safe.
4. If `meeting.owner = auth.uid()` → return `(meeting_id, slug, 'host')` (owner path does not consume invitation).
5. If a participant row already exists → update `joined_at` and return the role (idempotent for existing members).
6. Validate invitation not revoked, not expired, not exhausted.
7. INSERT into `meeting_participants` with `ON CONFLICT (meeting_id, user_id) DO NOTHING`. If a concurrent insert wins, fetch the role from the existing row.
8. UPDATE `meeting_invitations SET use_count = use_count + 1, last_used_at = now()`.
9. Return `(meeting_id, slug, role)`.

**Application call site mapping:** ✅ Perfect 1:1 match between `route.ts` arguments and the RPC signature.

**ACL on the RPC** (per `20260825010000_finalize_trigger_and_function_acl_parity.sql`): production has `postgres + service_role + authenticated` (PUBLIC/anon revoked). Application calls it with the user JWT → `auth.uid()` is the caller, which is the correct identity.

### 4.8 Participant lifecycle (in-room)

- **Creation:** Above (invitation acceptance). No "manual add participant" UI exists.
- **Tracking:** `meeting_participants` rows are CREATED but the `joined_at` is the only mutation in the invitation path. The application does not write `joined_at`, `role`, or other fields during a live session. The LiveKit room state is the source of truth for who is in the room at any given moment; the Postgres row is a credential.
- **Removal:** **NOT IMPLEMENTED.** No UI to remove a participant from a meeting. The database has no `deleted_at` or `removed_at` column.
- **Leave:** Client-side only — `MeetLiveSession` calls `disconnectFromRoom()` and pushes to `/dashboard`. No DB write.

### 4.9 Live meeting controls (client-side only)

`MeetLiveSession` exposes:
- Mute/unmute (publishes/unpublishes audio track)
- Camera on/off (publishes/unpublishes video track)
- Screen share (`useScreenShare` hook — publishes a `Track.Source.ScreenShare` track)
- Recording (LOCAL client-side recording via `useMeetingRecording`; produces a downloadable Blob; NO DB write)
- Reactions (local-only)
- Hand raise (local-only)
- Sidebar (chat, transcript, AI assistant, captions, translation, pulse)
- AI summary (server action `summarizeAction`, entitlement-gated)

**Post-meeting state:** No application-level "end meeting" action. The LiveKit room is live as long as the host is connected; if the host disconnects, participants will also be disconnected by LiveKit (subject to room configuration). The application's `meetings.ended_at` column is NEVER written.

### 4.10 Subscription / entitlement behavior

- `app/api/subscription-cap/route.ts?productLine=meet` reads `subscriptions` for `(user_id, product_line = 'meet')`. If no row → returns `{ participantCap: 2, plan: 'meet_free', productLine }`. If status != 'active' → trial cap. Otherwise returns `participant_cap` and `plan`.
- `lib/meetEntitlements.ts#canUseMeetFeature(userId, roomId, feature)`:
  1. `verifyRoomAccess` first.
  2. If feature is not premium → allow.
  3. Else read `subscriptions` for `(user_id, product_line='meet')`, require `status IN ('active', 'trialing')` AND `plan IN PAID_MEET_PLANS` (includes legacy `individual`, `pro`, `business`, `unlimited`, `enterprise`).
- Used by `summarizeAction`, `translateAction`, `assistantAction` (only `summarize` and `assistant` gate on the `ai_summary` / `ai_assistant` premium features; `translate` does not currently gate, per the `meetFeature` parameter being optional).

### 4.11 Subscriptions and webhook (Meet product)

See Section 6 (Entitlement Map) and the webhook contract in Section 16.

### 4.12 Termination

**NOT IMPLEMENTED as an application action.** The owner cannot mark a meeting as "ended". The dashboard does not list ended meetings. `meetings.ended_at` exists in the schema but is never written.

### 4.13 Meet full state diagram (from code)

```
    [no row]
        │  POST /api/meetings
        ▼
    meetings row { status = 'active' (default), started_at = now(), ended_at = null }
        │
        │  (no other state transitions in code)
        ▼
    [stays in 'active' indefinitely]
```

- `meetings.status` is a column in production (per `20260824000000` reconcile migration) but the application NEVER reads or writes it. It is set by the DB DEFAULT to `'active'`.
- `meetings.duration_seconds`, `participant_count`, `has_recording`, `language`, `host_id`, `room_id` are also present in production but never touched by the application.

---

## 5. Class Workflow Map

### 5.1 Authentication and dashboard

1. **User visits `/class/dashboard`** (after sign-in or via class subdomain).
2. **Server:** `app/class/dashboard/page.tsx` calls `createSupabaseServerClient().auth.getUser()`. If no user → `redirect('/auth?product=class&redirect=%2Fclass%2Fdashboard')`.
3. **DB query:** `from('classrooms').select('id, slug, title, subject, status, created_at, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false })`.
4. **UI:** Renders classroom cards. If `?create=1`, the `CreateClassroomButton` auto-opens its modal.

### 5.2 Classroom creation

1. **User clicks "Create Classroom"** (or visits `?create=1` after sign-up).
2. **`CreateClassroomButton`** modal collects: `title` (required, ≤120), `subject` (optional, ≤80), `description` (optional, ≤1000), `enrollment_type` (`open` | `approval` | `invite`).
3. **Client `fetch('/api/class/classrooms', POST)`** with the JSON body.
4. **Route handler** `app/api/class/classrooms/route.ts`:
   - `getServerSession(request)`.
   - `normaliseRequiredTitle/Description/Subject/EnrollmentType/PriceCents` from `lib/classValidation.ts`.
   - For-loop (up to 4 attempts): `createClassroomSlug(title, optionalRandomSuffix)` then INSERT.
   - INSERT payload: `{ owner_id: userId, title, description, subject, enrollment_type, price_cents, status: 'draft', slug }`.
   - On `23505` (slug collision) → retry with random suffix.
5. **RLS:** `classrooms` has two policies:
   - `Owners can manage their classrooms` (FOR ALL USING (owner_id = auth.uid()))
   - `Enrolled students can view active classrooms` (FOR SELECT, status in ('scheduled', 'live', 'completed') AND EXISTS active enrollment)
6. **Response:** `{ id, slug, title }` (status 201).
7. **UI:** `router.push('/class/classrooms/' + encodeURIComponent(slug))`.

**Authorization at server:** session only. There is no check that the user has an active Class subscription. A free user can create draft classrooms (this is consistent with the `enforceClassCapacity` policy that blocks LIVE access for owners without a Class plan — see below).

### 5.3 Classroom detail

1. **`/class/classrooms/[slug]`** is a server component.
2. `createSupabaseServerClient().auth.getUser()`. If no user → `redirect('/auth')`.
3. `verifyClassroomAccess(user.id, slug)` (service-role):
   - `resolveClassroom(slug)` — by id if UUID else by slug.
   - If `classroom.owner_id === userId` → return `{ granted: true, accessRole: 'instructor', source: 'owner' }`.
   - Else `from('classroom_enrollments').select('role, enrollment_status').eq('classroom_id', ...).eq('student_id', userId).eq('enrollment_status', 'active').maybeSingle()` → return role if present.
   - Else `granted: false`.
4. If `!access.classroom` → `notFound()`. If `!access.granted` → `redirect('/class/dashboard')`.
5. **Re-query** `from('classrooms').select(...).eq('id', classroom.id).single()` for full row.
6. **Re-query** `from('classroom_lessons').select(...).eq('classroom_id', ...).order('order_index')`.
7. **Re-query** `from('classroom_enrollments').select(...).eq('classroom_id', ...)` for roster.
8. `canTeach = access.source === 'owner' || isTeachingRole(access.accessRole)`.
9. Renders: header, lesson list (with "Launch" button for teachers on scheduled lessons, "Join Live" for live lessons), roster.

### 5.4 Lesson management

1. **Create lesson** (`/class/classrooms/[slug]/lessons`):
   - `CreateLessonForm` (client component) `fetch('/api/class/classrooms/' + classroomId + '/lessons', POST, { title, scheduled_at })`.
   - Route handler: `getServerSession` → `verifyClassroomTeachingAccess` (must be owner, instructor, or ta). INSERT `from('classroom_lessons')` with `{ classroom_id, title, scheduled_at, status: 'scheduled' }`.
   - RLS: `Owners and TAs can manage lessons` (FOR ALL USING EXISTS classrooms c [LEFT JOIN enrollments where role in ('instructor','ta')]).
2. **Launch lesson** (from `LaunchLessonButton`):
   - `fetch('/api/class/lessons/' + lessonId + '/launch', POST)`.
   - Route handler: `getServerSession` → fetch lesson + classroom (joined) → check `lesson.status !== 'cancelled'` → `verifyClassroomTeachingAccess` against the lesson's classroom → compute `livekitRoomId = lesson.livekit_room_id ?? 'class-' + classroomId + '-' + lessonId` → UPDATE `classroom_lessons SET status='live', livekit_room_id=... WHERE id=lessonId`.
   - RLS: same as above.
   - Response: `{ lessonId, joinUrl: '/class/classrooms/' + classroomSlug + '/lessons/' + lessonId + '/live' }`.
3. **End lesson:** **NOT IMPLEMENTED.** No application code sets `classroom_lessons.status = 'recorded'` or `'cancelled'` after launch. The `launch` route explicitly refuses to launch a cancelled lesson but does not offer an "end" or "cancel" action.

### 5.5 Enrollment

**Not implemented at the application layer.** Confirmed via `grep` — no `.from('classroom_enrollments').insert`, `.update`, `.upsert`, or `.delete` exists anywhere in the application source.

- The `classroom_enrollments` table is read-only at the application layer.
- RLS allows:
  - `Owners can manage enrollments` (FOR ALL on rows where classroom owner is the caller).
  - `Students can view their own enrollments` (FOR SELECT on rows where student_id = auth.uid()).
- The RLS lets a teacher `INSERT` enrollments (because the FOR ALL USING allows it), but the application never wires a UI to do so.
- The `enrollment_type` column (`'open' | 'approval' | 'invite'`) is collected on classroom creation but never honored by any application path. The data is stored; the behavior is not implemented.

**Impact:** A teacher can create a classroom and create lessons, but cannot enroll any student. A student cannot self-enroll. The `enforceClassCapacity` code path counts enrollments but the path that adds them does not exist.

### 5.6 Class live session

1. **Visit `/class/classrooms/[slug]/lessons/[lessonId]/live`** (server component):
   - `getServerSession` → `verifyClassLessonAccess` (service-role) — checks classroom + lesson + active enrollment.
   - If `!classroom || !lesson` → `notFound()`.
   - If `!access.granted` → `redirect('/class/dashboard')`.
   - If `lesson.status === 'cancelled' || lesson.status !== 'live'` → `redirect('/class/classrooms/' + slug + '/lessons')`.
   - `classroomRole = access.source === 'owner' ? 'owner' : access.accessRole`.
   - Renders `<ClassroomSession />`.
2. **`ClassroomSession`** is a stateful client component that:
   - Renders `<ClassroomPreJoin />` first.
   - On join: acquires media, `fetch('/api/lk-token', { method: 'POST', body: { domain: 'class', classroomId, lessonId, role: 'participant', username } })`.
   - The lk-token route performs `verifyClassLessonAccess` AGAIN (defense in depth), then `enforceClassCapacity` (service-role), then mints the LiveKit token.

### 5.7 `enforceClassCapacity` (server-side class capacity gate)

`lib/classEntitlements.ts`:
1. `resolveClassEntitlement(ownerId)` — reads `subscriptions` for `(user_id, product_line = 'class', status = 'active')`. If none → return `null` (which causes the live-token issuance to fail with 403).
2. `countClassroomRoles(classroomId, ownerId)` — reads `classroom_enrollments` for the classroom, treats the owner as the first teacher, counts instructors/TAs as additional teachers, students/auditors as students.
3. If `requestingRole` is teacher-type (`owner|instructor|ta`) and `teacherCount > teacherLimit` → reject.
4. If `requestingRole` is student-type (`student|auditor`) and `studentCount > studentLimit` → reject.
5. Otherwise allow.

**Limits source:** `lib/pricing/class.ts` (authoritative). For standard plans: `getClassStudentLimit(planId)` and `getClassTeacherLimit(planId)`. For custom: `data.participant_cap` (student) and `2` (teacher, fallback).

### 5.8 Class subscription / entitlement

- `app/api/subscription-cap/route.ts?productLine=class` returns `{ studentCap, teacherCap, plan, productLine }` (or `{ studentCap: 0, teacherCap: 0, plan: 'class_10', productLine: 'class' }` if unauthenticated or no row).
- Class has NO `canUseFeature` equivalent of `canUseMeetFeature`. AI actions are Meet-only. There is no premium-feature gate for Class beyond capacity.

### 5.9 Assignments and submissions

**NOT IMPLEMENTED.** No application code reads or writes `classroom_assignments` or `classroom_submissions` (verified via grep). The tables exist, RLS exists, but no UI/API path exists. This is the most material "dead schema" finding (P0 #1).

### 5.10 Roster

- `app/class/classrooms/[slug]/students/page.tsx`:
  - `getServerSession` → `resolveClassroom` → `verifyClassroomAccess`.
  - Redirects non-teachers to the classroom page.
  - `from('classroom_enrollments').select('id, student_id, role, enrollment_status, progress_percent, enrolled_at').eq('classroom_id', classroom.id).order('enrolled_at', { ascending: false })`.
  - Renders rows. Currently always shows "No enrollments yet" because no enrollment path exists.

### 5.11 Class full state diagram (from code)

```
classrooms.status
    │
    │  POST /api/class/classrooms  (always creates 'draft')
    ▼
  'draft'
    │
    │  (no other state transitions)
    ▼
  'draft' (forever)

classroom_lessons.status
    │
    │  POST /api/class/classrooms/{}/lessons
    ▼
  'scheduled'
    │
    │  POST /api/class/lessons/{}/launch  (cancelled check first)
    ▼
  'live'
    │
    │  (no other state transitions)
    ▼
  'live' (forever)
```

- The `classroom_lessons` status enum in the migration is `'scheduled' | 'live' | 'recorded' | 'cancelled'`. `recorded` and `cancelled` are never written.
- The `classrooms` status enum is `'draft' | 'scheduled' | 'live' | 'completed' | 'archived'`. Only `'draft'` is written by the application.

---

## 6. Entitlement Map

### 6.1 Meet entitlement surface

| Plan ID | monthlyPrice (ZAR) | annualPrice (ZAR) | maxParticipants | maxDurationMinutes | Notes |
|---|---|---|---|---|---|
| `meet_free` | 0 | 0 | 3 | 40 | Default trial |
| `meet_individual` | 110 | 88 | 10 | 0 (unlimited) | |
| `meet_pro` | 169 | 135 | 50 | 0 | Popular |
| `meet_unlimited` | 389 | 311 | 0 (unlimited) | 0 | `UNLIMITED_PARTICIPANT_CAP = 9999` written to DB |
| `meet_enterprise` | null | null | 0 | 0 | Contact-sales; webhook refuses |

**Decision code paths:**

| Decision | Code | Input | Output |
|---|---|---|---|
| Default trial cap for anonymous | `app/api/subscription-cap/route.ts` | no session | `{ participantCap: 2, plan: 'trial' }` |
| Default cap for authenticated Meet, no row | same | session, no `subscriptions` row | `{ participantCap: 2, plan: 'meet_free', productLine: 'meet' }` |
| Default cap for authenticated Meet, non-active | same | session, status != 'active' | trial cap |
| Standard cap for active Meet | same | session, status='active' | `{ participantCap: data.participant_cap, plan, productLine }` |
| Premium feature gate (recording, transcription, ai_assistant, ai_summary) | `lib/meetEntitlements.ts#canUseMeetFeature` | userId, roomId, feature | allowed iff `verifyRoomAccess` AND `status IN ('active','trialing')` AND `plan IN PAID_MEET_PLANS` |
| Recording/transcription are listed in `MeetFeature` but no application call site gates on them — only `ai_summary` and `ai_assistant` are currently used | (server actions) | (room context) | returns COOLDOWN/ERROR/OK |

**Active / trialing status set** (`ACTIVE_STATUSES = {'active', 'trialing'}`).

**Paid Meet plans set** (`PAID_MEET_PLANS`):
- `meet_individual`, `meet_pro`, `meet_unlimited`, `meet_enterprise`
- Legacy: `individual`, `pro`, `business`, `unlimited`, `enterprise`

Note: `meet_free` is NOT in the paid set (correctly), and `meet_enterprise` IS in the paid set but the webhook refuses to grant it.

### 6.2 Class entitlement surface

| Plan ID | monthlyPrice (ZAR) | annualPrice (ZAR) | maxStudents | maxTeachers | Notes |
|---|---|---|---|---|---|
| `class_10` | 89 | 71 | 10 | 2 | Popular |
| `class_20` | 120 | 96 | 20 | 2 | |
| `class_30` | 140 | 112 | 30 | 2 | Includes assignments & grading (NOT IMPLEMENTED in code) |
| `class_custom` | null | null | null | null | Contact-sales; `participant_cap` written for custom contracts |

**Decision code paths:**

| Decision | Code | Input | Output |
|---|---|---|---|
| Default cap for anonymous Class | `app/api/subscription-cap/route.ts` | no session | `{ studentCap: 0, teacherCap: 0, plan: 'class_10' }` (effectively no access) |
| Default cap for authenticated Class, no row | same | session, no `subscriptions` row | same as anonymous |
| Default cap for authenticated Class, non-active | same | session, status != 'active' | same (no access) |
| Standard cap for active Class | same | session, status='active' | `{ studentCap, teacherCap, plan }` from `getClassStudentLimit/getClassTeacherLimit` |
| Custom cap for active Class, custom plan | same | session, status='active', plan in custom set | `{ studentCap: data.participant_cap, teacherCap: 2 (fallback), plan, custom: true }` |
| Live capacity enforcement | `lib/classEntitlements.ts#enforceClassCapacity` | classroomId, ownerId, requestingRole | rejects if no active sub, or teacher count > teacherLimit, or student count > studentLimit |
| Standard plan resolution | `lib/pricing/class.ts#getClassStudentLimit/getClassTeacherLimit` | planId | returns the static limit or `null` for custom |

### 6.3 Subscription check, by product line

| Caller | Product line scope | Source of truth |
|---|---|---|
| `app/api/subscription-cap/route.ts` | `?productLine=meet\|class` | service-role `subscriptions` |
| `lib/meetEntitlements.ts` | hardcoded `eq('product_line', 'meet')` | service-role `subscriptions` |
| `lib/classEntitlements.ts` | hardcoded `eq('product_line', 'class')` | service-role `subscriptions` |
| `components/Dashboard.tsx` (legacy) | NONE — no `product_line` filter, single `.maybeSingle()` | browser-side `subscriptions` |
| `app/actions/checkout-actions.ts#getUserSubscription` | NONE — no `product_line` filter, `.select('*')` | service-role `subscriptions` |

**Confirmed:** All actively-used entitlement paths are product-scoped. Two legacy/unused paths are not.

### 6.4 Upgrade / downgrade / expired / cancelled behavior

- **Upgrade:** Triggered via the marketing `CheckoutButton` (`createMeetCheckout` / `createClassCheckout` server actions → `createCheckout` in `lib/lemon-squeezy.ts` → Lemon Squeezy hosted checkout → webhook → `process_lemon_squeezy_subscription_webhook`).
- **Downgrade:** No downgrade UI. No server action to swap plans. The webhook handles a re-purchase of a different plan by `UPSERT` on `(user_id, product_line)`, so a user who buys `meet_pro` after `meet_individual` simply has their `plan` overwritten.
- **Expired / cancelled:** Webhook receives `subscription_expired` / `subscription_cancelled`, sets `status = 'expired' | 'cancelled'`. The dashboard does not visualize this state. `enforceClassCapacity` rejects if `status != 'active'`. `canUseMeetFeature` rejects if `status NOT IN ('active', 'trialing')`. The subscription-cap API falls back to trial caps for non-active status.
- **Free tier behavior for Meet:** Anonymous: cap 2. Authenticated with no row: cap 2. This is hardcoded.
- **Free tier behavior for Class:** Anonymous: cap 0/0. Authenticated with no row: cap 0/0. Effectively paywalled at the live-token layer.

### 6.5 What "cap 2 for unauthenticated Meet" means

The `subscription-cap` API returns cap 2 for anonymous callers (`{ participantCap: 2, plan: 'trial' }`). This is for the `Lobby` pre-join count display. The actual `lk-token` route requires authentication (`getServerSession`) regardless, so an unauthenticated user can never actually join a Meet room.

---

## 7. Authorization Map

For each important mutation, the WHO and WHERE.

### 7.1 Authentication boundaries

- **Required (401 if no session):**
  - `POST /api/meetings`
  - `POST /api/meetings/[meetingId]/invitations`
  - `POST /api/meeting-invitations/accept`
  - `POST /api/lk-token`
  - `POST /api/class/classrooms`
  - `GET /api/class/classrooms`
  - `POST /api/class/classrooms/[classroomId]/lessons`
  - `POST /api/class/lessons/[id]/launch`
  - `GET /api/subscription-cap` (returns trial defaults, not 401)
  - `POST /api/auth/signin` (rate-limited)
  - `POST /api/auth/signup` (rate-limited)
  - `GET /api/heartbeat` (auth required)
- **Not required:**
  - `POST /api/auth/signin`, `signup`, `signout`, `refresh`
  - `GET /api/auth-test`, `deployment-check`, `health`, `monitor`
  - `POST /api/webhooks/lemon-squeezy` (HMAC-signed instead)
  - All marketing pages, landing, pricing, sitemap, robots

### 7.2 Authorization table by mutation

| Mutation | Who | Code path | RLS | Entitlement |
|---|---|---|---|---|
| Create meeting (`POST /api/meetings`) | Any authenticated user | `createExplicitMeeting` via user-JWT client | `meetings_insert_owner` (owner = auth.uid()) | None |
| Read meetings (cross-product dashboard) | Owner of meetings (RLS) + all classrooms of owner | user-JWT client | `meetings_select_authorized` (owner OR participant); `classrooms` no separate SELECT RLS for the owner-checked query | None |
| Create invitation (`POST /api/meetings/[id]/invitations`) | Meeting owner | `supabase.from('meetings').select('id, slug, owner').eq('id', meetingId).maybeSingle()` then `meeting.owner !== session.userId` → 403. Insert via user-JWT. | `meeting_invitations_owner_insert` (created_by = auth.uid AND EXISTS meetings owned by caller) | None |
| Accept invitation (`POST /api/meeting-invitations/accept`) | Any authenticated user with valid token | `supabase.rpc('accept_meeting_invitation', { p_meeting_slug, p_token_hash })` (user-JWT) | RPC is `SECURITY DEFINER`; internal checks are atomic | None (server-JWT `auth.uid()` is the identity) |
| Issue LiveKit token for Meet (`POST /api/lk-token`, domain='meet') | Meeting owner OR participant OR public-meeting spectator | `verifyRoomAccess` (service-role) → role mapped to LiveKit role | None (service-role read of meetings + participants) | None |
| Issue LiveKit token for Class (`POST /api/lk-token`, domain='class') | Lesson owner OR enrolled participant (verified, not client-supplied) | `verifyClassLessonAccess` (service-role) → `enforceClassCapacity` (service-role, owner-entitlement-based) | None | `enforceClassCapacity` (subscribes to owner's `subscriptions` row, requires `status='active'`, rejects if at teacher or student limit) |
| Create classroom (`POST /api/class/classrooms`) | Any authenticated user | user-JWT INSERT | `Owners can manage their classrooms` (FOR ALL USING (owner_id = auth.uid())) | None at creation; enforcement happens at `lk-token` time |
| Read classroom | Owner OR enrolled student in active status | user-JWT SELECT (via `verifyClassroomAccess` which is service-role) | `Owners can manage their classrooms` (owner) + `Enrolled students can view active classrooms` (status in ('scheduled','live','completed') AND active enrollment) | None |
| Create lesson | Owner OR instructor/ta in active status | `verifyClassroomTeachingAccess` (service-role) → user-JWT INSERT | `Owners and TAs can manage lessons` | None |
| Launch lesson | Owner OR instructor/ta in active status | `verifyClassroomTeachingAccess` (service-role) → user-JWT UPDATE | `Owners and TAs can manage lessons` | None |
| Read lesson | Owner OR instructor/ta in active status OR enrolled student in active status | user-JWT SELECT (page render) | `Owners and TAs can manage lessons` (owner-side SELECT under FOR ALL) + `Enrolled students can view lessons` | None |
| Read enrollment | Owner of classroom OR student themselves | user-JWT SELECT | `Owners can manage enrollments` (owner) + `Students can view their own enrollments` | None |
| Create / update / delete enrollment | (RLS permits owner) | **NOT IMPLEMENTED** in application | `Owners can manage enrollments` (FOR ALL) | N/A |
| Submit assignment, view grade | **NOT IMPLEMENTED** | n/a | RLS exists but no caller | N/A |
| Run AI summary/translate/assistant | Authenticated user (server action) | `summarizeAction`/`translateAction`/`assistantAction` → `canUseMeetFeature` (when `meetFeature` is provided) | None (no DB write) | `canUseMeetFeature` (Meet only) |
| Webhook subscription update | Lemon Squeezy (external) | HMAC signature → `process_lemon_squeezy_subscription_webhook` (service-role) | RPC is `SECURITY DEFINER`, ACL restricted to `service_role` | N/A (this IS the source of entitlement truth) |
| Read subscription | Owner | user-JWT SELECT | `subscriptions_select_own` (user_id = auth.uid()) | N/A |
| Read subscription (service-role) | service_role | any | None (RLS bypassed) | N/A |
| Update profile | Owner | user-JWT UPDATE | `profiles_owner_full_access` (auth.uid = id) | N/A |
| Create profile | Trigger `on_auth_user_created` → `handle_new_user` (SECURITY DEFINER) | n/a (auth.users INSERT) | Trigger function ACL: PUBLIC + postgres + anon + authenticated + service_role | N/A |

### 7.3 Discrepancies / observations

- **`lk-token` for Meet uses service-role `verifyRoomAccess`**, which reads `meetings` AND `meeting_participants`. RLS on these tables under the user JWT would already permit the owner and participant paths, so a service-role read is not strictly necessary for those branches. It IS necessary for the public-meeting spectator path because RLS does not cover that case.
- **`lk-token` for Class enforces capacity at the server layer** but `POST /api/class/classrooms` does not check entitlement at creation. The user can create a draft classroom and lessons without any Class plan, but cannot go live. This is by design (frictionless creation) but creates a "draft graveyard" risk.
- **`accept_meeting_invitation` is `SECURITY DEFINER`**, so it bypasses RLS internally — but it only does the specific INSERT into `meeting_participants`, not arbitrary writes. The `meeting_participants_meeting_id_user_id_key` UNIQUE constraint provides additional defense.
- **`meetings.is_public` flag** is set to `true` on every `createExplicitMeeting` call (per `lib/meetingPersistence.ts#buildMeetingInsert`). The flag is honored by `verifyRoomAccess` but not by RLS — so an `is_public = true` row is visible to the application code even for non-participants, but the database RLS does not actually allow it. This is a soft inconsistency: the application may pass an `is_public` check at the server-authorization layer, but if a non-participant tries to read the row through the PostgREST API directly, RLS will deny them. Net effect: the application works, but the database is stricter than the application thinks.

---

## 8. User Action Inventory

Marked CONFIRMED if found in the recon, NOT IMPLEMENTED if absent.

### 8.1 Meet

| Action | Status | Entry point | Notes |
|---|---|---|---|
| Sign in | CONFIRMED | `app/auth/page.tsx` → `fetch('/api/auth/signin')` | |
| Sign up | CONFIRMED | `app/auth/page.tsx` → `fetch('/api/auth/signup')` | `role: 'participant'` in metadata; `default_product` if `?product=...` |
| Sign out | CONFIRMED | `lib/clientAuth.ts#signOut` → `fetch('/api/auth/signout')` then `window.location='/auth'` | |
| Forgot password | CONFIRMED | `app/auth/forgot-password/page.tsx` → server action `requestPasswordReset` | |
| Update password | CONFIRMED | `app/auth/update-password/page.tsx` → `client.auth.setSession` + `updateUser({ password })` | Uses a NEW client instance, not the shared browser client |
| Create meeting | CONFIRMED | `CreateMeetingButton` → `fetch('/api/meetings')` | |
| Edit meeting | NOT IMPLEMENTED | n/a | No `PATCH /api/meetings/[id]` or similar; no edit UI |
| Delete meeting | NOT IMPLEMENTED | n/a | No DELETE endpoint; no UI |
| View meeting list (per user) | PARTIAL | `app/(platform)/dashboard/page.tsx` shows recent 3 owned meetings | `app/meet/dashboard/page.tsx` shows a hard-coded empty list |
| Start meeting | CONFIRMED | `MeetLiveSession#handleJoin` → `lk-token` → `room.connect` | Owner path through `lk-token` |
| Join meeting | CONFIRMED | `/lobby` → `/meet/rooms/[slug]` → `lk-token` → `room.connect` | Public + participant + owner paths |
| Invite participant | CONFIRMED | `MeetingControls` → `requestSecureMeetingInvitation` → `POST /api/meetings/[meetingId]/invitations` | Returns raw token (32 bytes base64url) via `invite=` query param |
| Accept invitation | CONFIRMED | `LobbyPreJoin` (if `?intent=join&invite=`) → `POST /api/meeting-invitations/accept` → `accept_meeting_invitation` RPC | Owner path does not consume invitation; participant path consumes one use |
| Revoke invitation | NOT IMPLEMENTED | n/a | RLS allows `UPDATE (revoked_at)` for the meeting owner, but no UI or API path exists |
| Leave meeting | CONFIRMED | `MeetLiveSession#handleLeave` → `disconnectFromRoom` → `router.push('/dashboard')` | Triggers `summarizeAction` if transcript is non-empty |
| Remove participant | NOT IMPLEMENTED | n/a | No API or UI; LiveKit admin actions not wired |
| End meeting | NOT IMPLEMENTED | n/a | `meetings.ended_at` is never written |
| Toggle mute | CONFIRMED | `MeetingControls` → `room.localParticipant.setMicrophoneEnabled(...)` | Local only |
| Toggle camera | CONFIRMED | `MeetingControls` → `room.localParticipant.setCameraEnabled(...)` | Local only |
| Toggle screen share | CONFIRMED | `useScreenShare` hook → `room.localParticipant.setScreenShareEnabled(...)` | Local only |
| Toggle hand raise | CONFIRMED | `MeetingControls` → local state | Local only |
| Send reaction | CONFIRMED | `MeetingControls` → local state | Local only |
| Start / stop recording | CONFIRMED (client-only) | `useMeetingRecording` → `MediaRecorder` | Local blob; no DB write |
| Download recording | CONFIRMED | Client-side blob download | |
| AI summary | CONFIRMED | `MeetLiveSession#handleLeave` → `summarizeAction` server action | Entitlement-gated by `canUseMeetFeature` (meet) |
| AI translate | CONFIRMED | `CaptionsOverlay` → `translateAction` | No `meetFeature` passed → no entitlement gate |
| AI assistant | CONFIRMED | `MeetLiveSession` sidebar → `assistantAction` | Entitlement-gated |
| Open pricing page | CONFIRMED | `app/(marketing)/pricing/page.tsx` | |
| Start checkout (Meet) | CONFIRMED | `CheckoutButton` (`productType='meet'`) → `createMeetCheckout` server action → Lemon Squeezy URL | Enterprise plan opens mailto: instead |
| Pricing redirect on success | PARTIAL | `?checkout=success` honored by `components/Dashboard.tsx` only | (platform)/dashboard does not visualize |

### 8.2 Class

| Action | Status | Entry point | Notes |
|---|---|---|---|
| Sign in (product-tagged) | CONFIRMED | `?product=class` is forwarded to `/api/auth/signin`, which calls `supabase.auth.updateUser({ data: { default_product: 'class' } })` | |
| Sign up (product-tagged) | CONFIRMED | same as above | |
| Create classroom | CONFIRMED | `CreateClassroomButton` → `POST /api/class/classrooms` | No subscription check at creation |
| Edit classroom | NOT IMPLEMENTED | n/a | No `PATCH /api/class/classrooms/[id]` |
| Delete classroom | NOT IMPLEMENTED | n/a | No DELETE |
| View classroom list (per user) | CONFIRMED | `app/class/dashboard/page.tsx` lists owned classrooms | |
| Open classroom detail | CONFIRMED | `/class/classrooms/[slug]` | |
| Invite teacher | NOT IMPLEMENTED | n/a | No enrollment write path; no UI |
| Remove teacher | NOT IMPLEMENTED | n/a | |
| Enroll student | NOT IMPLEMENTED | n/a | Most critical Class gap |
| Remove student | NOT IMPLEMENTED | n/a | |
| View roster (students) | CONFIRMED | `/class/classrooms/[slug]/students` | Will be empty because no enrollment path exists |
| Manage lessons list | CONFIRMED | `/class/classrooms/[slug]/lessons` | |
| Create lesson | CONFIRMED | `CreateLessonForm` → `POST /api/class/classrooms/[id]/lessons` | Owner + instructor + ta only |
| Edit lesson | NOT IMPLEMENTED | n/a | No `PATCH /api/class/lessons/[id]` |
| Delete lesson | NOT IMPLEMENTED | n/a | No DELETE |
| Publish / unpublish lesson | NOT IMPLEMENTED | n/a | Status transitions are limited to `scheduled → live` |
| Launch lesson | CONFIRMED | `LaunchLessonButton` → `POST /api/class/lessons/[id]/launch` | |
| End / cancel lesson | NOT IMPLEMENTED | n/a | |
| Join live lesson (student/teacher) | CONFIRMED | `/class/classrooms/[slug]/lessons/[lessonId]/live` → `verifyClassLessonAccess` + `enforceClassCapacity` → `lk-token` | |
| Create assignment | NOT IMPLEMENTED | n/a | |
| Edit assignment | NOT IMPLEMENTED | n/a | |
| Delete assignment | NOT IMPLEMENTED | n/a | |
| Submit assignment | NOT IMPLEMENTED | n/a | |
| Resubmit assignment | NOT IMPLEMENTED | n/a | |
| View submission | NOT IMPLEMENTED | n/a | |
| Grade submission | NOT IMPLEMENTED | n/a | |
| Start checkout (Class) | CONFIRMED | `CheckoutButton` (`productType='class'`) → `createClassCheckout` → `class_10/20/30` checkout | `class_custom` opens mailto: |
| Marketing landing | CONFIRMED | `app/class/page.tsx` | |
| Pricing | CONFIRMED | `app/(marketing)/class/pricing/page.tsx` | |

### 8.3 Cross-product

| Action | Status | Entry point | Notes |
|---|---|---|---|
| Product selector (Cross) | CONFIRMED | `app/(platform)/dashboard/page.tsx` → `components/platform/ProductSelector.tsx` | |
| View recent activity (Cross) | CONFIRMED | `app/(platform)/dashboard/page.tsx` | Three most recent meetings + classrooms |
| Run AI action (Cross) | CONFIRMED | `ai-actions.ts` server actions | Meet-only entitlement check |
| Health check | CONFIRMED | `GET /api/heartbeat` (auth required) and `GET /api/health` (public) | |
| Admin health | CONFIRMED | `app/admin/health/page.tsx` | |
| Sitemap / robots | CONFIRMED | `app/robots.ts`, `app/sitemap.ts` | |

---

## 9. Database Mutation Matrix

Schema-as-of-`64df837` (production-aligned). Client: A = Anon, U = User JWT, S = Service role, F = SECURITY DEFINER function. RLS: Y = protected, N = bypassed (service role or function), T = table-level policy.

| User Action | UI Location | Code Path | DB Operation | Table/RPC | Auth | RLS | Entitlement | Result | Error Handling |
|---|---|---|---|---|---|---|---|---|---|
| Sign in | `/auth` | `app/api/auth/signin` → `supabase.auth.signInWithPassword` (via `?grant_type=password` REST) | INSERT/UPDATE session cookies | n/a | U | N | None | 200 + cookies | 4xx returns error_description |
| Sign up | `/auth` | `app/api/auth/signup` → `supabase.auth.signUp` (via `/auth/v1/signup` REST) | INSERT `auth.users`, fires `on_auth_user_created` → `handle_new_user` → INSERT `profiles` | `auth.users`, `profiles` (trigger) | U | Trigger: N | None | 200 + `needsConfirmation` | 4xx |
| Forgot password | `/auth/forgot-password` | `requestPasswordReset` server action → `supabase.auth.resetPasswordForEmail` | n/a (email dispatch) | n/a | S | N | None | 200 | Returns success regardless of email existence (intentional) |
| Update password | `/auth/update-password` | `client.auth.setSession` + `client.auth.updateUser({ password })` | UPDATE `auth.users` | `auth.users` | U | N | None | 200 + redirect to `/auth?reset=success` | Returns error message |
| Create meeting | `/meet/dashboard` "New Meeting" | `CreateMeetingButton` → `POST /api/meetings` → `createExplicitMeeting` → `buildMeetingInsert` → `.insert(payload).select('id, slug, owner').single()` | INSERT | `meetings` (U) | U | T: `meetings_insert_owner` | None | 200 `{ meeting: { id, slug } }` → redirect to `/lobby?room=<slug>` | 409 on slug conflict, 500 on other errors |
| Accept invitation | `/lobby?intent=join&invite=...` | `LobbyPreJoin.acceptInvitation` → `POST /api/meeting-invitations/accept` → `supabase.rpc('accept_meeting_invitation', { p_meeting_slug, p_token_hash })` | SELECT FOR UPDATE invitation+meeting, INSERT participant (ON CONFLICT DO NOTHING), UPDATE invitation use_count | `meeting_invitations`, `meeting_participants` (F) | U via F | F (SECURITY DEFINER) | None | 200 `{ meetingId, room, role }` | 400 if invalid token, 500 if other |
| Create invitation | `MeetingControls` "Share" | `requestSecureMeetingInvitation` → `POST /api/meetings/[id]/invitations` → service-role lookup, generate raw+hash, INSERT | SELECT `meetings`, INSERT | `meetings` (U, via server route), `meeting_invitations` (U via SDK cookie client) | U | T: `meeting_invitations_owner_insert` | None | 200 `{ url, invite, ... }` | 403 if not owner, 500 on insert failure |
| Issue Meet LiveKit token | `MeetLiveSession#handleJoin` | `POST /api/lk-token` → `verifyAccess('meet', ...)` → `verifyRoomAccess` (S) → `createLiveKitToken` | SELECT `meetings`, SELECT `meeting_participants` | `meetings` (S), `meeting_participants` (S) | U (auth) | N (service role) | None | 200 `{ token, url }` | 401 / 403 / 500 |
| Create classroom | `/class/dashboard` "Create Classroom" | `CreateClassroomButton` → `POST /api/class/classrooms` → validation → INSERT (5 attempts) | INSERT | `classrooms` (U) | U | T: `Owners can manage their classrooms` | None | 201 `{ id, slug, title }` | 400 invalid input, 409 slug collision |
| Read classrooms (own) | `/class/dashboard` | `from('classrooms').select(...).eq('owner_id', user.id)` | SELECT | `classrooms` (U) | U | T: `Owners can manage their classrooms` (FOR ALL includes SELECT) | None | 200 (list) | RLS error → `error` shown in UI |
| Read classroom detail | `/class/classrooms/[slug]` | `verifyClassroomAccess` (S) + 3 user-JWT SELECTs (classroom, lessons, enrollments) | SELECT | `classrooms`, `classroom_lessons`, `classroom_enrollments` | U | T (per table) | None | 200 (page render) | notFound / redirect to /class/dashboard |
| Create lesson | `/class/classrooms/[slug]/lessons` | `CreateLessonForm` → `POST /api/class/classrooms/[id]/lessons` → `verifyClassroomTeachingAccess` (S) → INSERT | SELECT `classroom_enrollments`, INSERT | `classroom_enrollments` (S), `classroom_lessons` (U) | U | T: `Owners and TAs can manage lessons` | None | 201 `{ id, classroom_id, title, status, scheduled_at }` | 403 if not teacher, 500 on insert |
| Launch lesson | `/class/classrooms/[slug]` lesson row "Launch" | `LaunchLessonButton` → `POST /api/class/lessons/[id]/launch` → SELECT lesson+classroom → `verifyClassroomTeachingAccess` → UPDATE | SELECT, UPDATE | `classroom_lessons` (U) | U | T: `Owners and TAs can manage lessons` | None | 200 `{ lessonId, joinUrl }` | 400 if cancelled, 403 if not teacher, 500 on update fail |
| Issue Class LiveKit token | `ClassroomSession#handleJoin` | `POST /api/lk-token` (domain='class') → `verifyClassLessonAccess` (S) → `enforceClassCapacity` (S: subscriptions + classroom_enrollments) → `createLiveKitToken` | SELECT (multiple) | `classrooms`, `classroom_lessons`, `classroom_enrollments`, `subscriptions` | U | N (service role) | Owner Class subscription must be `active`; teacher/student cap not exceeded | 200 `{ token, url }` | 403 if no Class sub or cap exceeded; 409 if lesson not live |
| Webhook subscription update | Lemon Squeezy → `POST /api/webhooks/lemon-squeezy` | HMAC verify → `mapPlanFromProduct` → `supabase.rpc('process_lemon_squeezy_subscription_webhook', { 12 params })` | SELECT FOR UPDATE subscription, INSERT/UPSERT subscription_webhook_events, INSERT/UPDATE subscriptions | `subscriptions`, `subscription_webhook_events` (F) | S | N (function) | N/A (this IS the source) | 200 `{ received, result }` | 401 invalid sig, 422 missing event time, 500 RPC error |
| Subscription cap read | dashboards, lobby | `GET /api/subscription-cap?productLine=meet\|class` | SELECT | `subscriptions` (S) | U (or anon) | N | None | 200 `{ participantCap\|{studentCap, teacherCap}, plan, productLine }` | falls back to trial cap on error |
| Password recovery (email) | `/auth/forgot-password` | `requestPasswordReset` server action → `supabase.auth.resetPasswordForEmail` | n/a | n/a | S | N | None | 200 | Returns success regardless |
| Sign out | `ProfileMenu` etc. | `lib/clientAuth.ts#signOut` → `POST /api/auth/signout` → `supabase.auth.signOut` | clears session cookies | n/a | U | N | None | 200 + redirect `/auth` | n/a |
| Token refresh | `lib/clientAuth.ts#refreshSession` | `POST /api/auth/refresh` → parses `sb-*-auth-token` cookie → `?grant_type=refresh_token` REST → `supabase.auth.setSession` | UPDATE session cookies | n/a | U | N | None | 200 | 401 if no refresh token, 502 on upstream error |

---

## 10. Read/Query Matrix

| User Experience | UI Location | Code Path | Query | Table/RPC | Auth Context | Expected Result | Empty State | Error State |
|---|---|---|---|---|---|---|---|---|
| Meet dashboard | `/meet/dashboard` | `app/meet/dashboard/page.tsx` | `auth.getUser()` only (no DB query) | n/a | U | Render static "No upcoming meetings" + CreateMeetingButton + JoinExistingMeeting | n/a | n/a |
| Platform dashboard (recent) | `/dashboard` | `app/(platform)/dashboard/page.tsx` | Parallel: `from('meetings').select(...).eq('owner', user.id).order('created_at', desc).limit(3)`, `from('classrooms').select(...).eq('owner_id', user.id).order('created_at', desc).limit(3)` | `meetings` (U), `classrooms` (U) | U | Two arrays merged and sorted by createdAt, top 3 | If empty: no recent items in `<ProductSelector>` | If user null: `user=null` passed to ProductSelector; meeting/classroom queries skipped |
| Class dashboard (own classrooms) | `/class/dashboard` | `app/class/dashboard/page.tsx` | `from('classrooms').select('id, slug, title, subject, status, created_at, updated_at').eq('owner_id', user.id).order('updated_at', desc)` | `classrooms` (U) | U | List of owned classrooms | "No classrooms yet" empty state card | `error` is rendered as an amber banner "We could not load your classrooms." |
| Classroom detail | `/class/classrooms/[slug]` | `verifyClassroomAccess` (S) then user-JWT SELECT classroom, lessons, enrollments | `from('classrooms').select(...).eq('id', ...).single()`; `from('classroom_lessons').select(...).eq('classroom_id', ...).order('order_index')`; `from('classroom_enrollments').select(...).eq('classroom_id', ...)` | `classroom_enrollments` (S), then `classrooms` (U), `classroom_lessons` (U), `classroom_enrollments` (U) | U | Page with header, lesson list, roster (if teacher) | notFound() if no classroom; redirect /class/dashboard if no access; "No lessons yet" or "No students enrolled yet" | RLS denial on the user-JWT SELECT would 406; in practice the prior service-role `verifyClassroomAccess` filtered out unauthorized callers, so 406 is unlikely |
| Lessons page | `/class/classrooms/[slug]/lessons` | `resolveClassroom` (S), `verifyClassroomAccess` (S), then `from('classroom_lessons').select(...).eq('classroom_id', ...).order('scheduled_at', nullsFirst:false)` | `classroom_lessons` (U) | U | List of lessons | "No lessons yet" empty state | "Unable to load lessons" amber alert |
| Roster | `/class/classrooms/[slug]/students` | `verifyClassroomAccess` (S), then `from('classroom_enrollments').select(...).eq('classroom_id', ...).order('enrolled_at', desc)` | `classroom_enrollments` (U) | U | List of enrollments | "No enrollments yet" empty state | "Unable to load roster" alert |
| Meet dashboard (live) | `/meet/rooms/[slug]` | `verifyAccess('meet', userId, slug)` (delegates to `verifyRoomAccess`, S), then renders `<MeetLiveSession />` | `meetings` (S), `meeting_participants` (S) | U | Renders MeetLiveSession | redirect('/dashboard') | n/a (handled upstream) |
| Lobby pre-join | `/lobby?room=...&intent=join&invite=...` | server-renders `LobbyPreJoin` (no server data fetch) | n/a | n/a | U | Lobby UI | n/a | n/a |
| Subscription cap | client-side entitlement display | `GET /api/subscription-cap?productLine=...` | `from('subscriptions').select('plan, participant_cap, status').eq('user_id', userId).eq('product_line', productLine).maybeSingle()` | `subscriptions` (S) | U (or anon) | `{participantCap, plan, productLine}` or `{studentCap, teacherCap, plan, productLine}` | trial defaults (Meet: cap 2; Class: 0/0) | catches and returns trial cap |
| User subscription (server action) | unused path | `app/actions/checkout-actions.ts#getUserSubscription` | `from('subscriptions').select('*').eq('user_id', session.userId)` | `subscriptions` (S) | U | `SubscriptionRecord[]` | `null` | `null` on error |
| Legacy dashboard | legacy `components/Dashboard.tsx` | on `?checkout=success` URL | `from('subscriptions').select('*').maybeSingle()` (NOT product-scoped) | `subscriptions` (U) | U | Single record (any product) | retry 3x with 2s backoff, then no-op | n/a (silently retries) |
| Profile on sign-in | server actions/UI | `getServerSession` calls `supabase.auth.getUser()` | n/a (Supabase Auth) | n/a | U | `user` object | `null` | `null` |
| `accept_meeting_invitation` | `/api/meeting-invitations/accept` | `supabase.rpc('accept_meeting_invitation', { p_meeting_slug, p_token_hash })` | RPC | `meeting_invitations`, `meetings`, `meeting_participants` (F) | U | `{ meeting_id, slug, database_role }` | raises `invalid invitation` (P0001) | mapped to 400 if message contains "invalid invitation"; 500 otherwise |
| `process_lemon_squeezy_subscription_webhook` | `/api/webhooks/lemon-squeezy` | `supabase.rpc('process_lemon_squeezy_subscription_webhook', { 12 params })` | RPC | `subscriptions`, `subscription_webhook_events` (F) | S | `{ processed: true, ... }` or `{ duplicate: true, ... }` or `{ stale: true, ... }` | 500 if `p_webhook_id` empty or other validation | 500 |

---

## 11. Route Map

### 11.1 Public / unauthenticated routes

| Route | File | Purpose | Auth | Redirect / Error |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Marketing landing | none | n/a |
| `/signin` | `app/signin/page.tsx` | legacy sign-in | none | n/a |
| `/class` | `app/class/page.tsx` | Class marketing landing | none | n/a |
| `/pricing` | `app/(marketing)/pricing/page.tsx` | Meet pricing | none | n/a (publicly cacheable) |
| `/class/pricing` | `app/(marketing)/class/pricing/page.tsx` | Class pricing | none | rewritten from `/pricing` on class subdomain |
| `/auth` | `app/auth/page.tsx` | Sign-in / sign-up | none | if signed in: redirect to `/dashboard` |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Password reset request | none | n/a |
| `/auth/update-password` | `app/auth/update-password/page.tsx` | Password reset set | none (uses URL hash) | n/a |
| `/admin/health` | `app/admin/health/page.tsx` | Admin health | none | n/a |
| `/sitemap.xml` | `app/sitemap.ts` | Sitemap | none | n/a |
| `/robots.txt` | `app/robots.ts` | Robots | none | n/a |
| `/api/auth/signin` | `app/api/auth/signin/route.ts` | POST sign-in | none (rate-limited) | 429 if rate-limited, 400/502/etc on errors |
| `/api/auth/signup` | `app/api/auth/signup/route.ts` | POST sign-up | none (rate-limited) | 429 if rate-limited |
| `/api/auth/signout` | `app/api/auth/signout/route.ts` | POST sign-out | none | 200 always (idempotent) |
| `/api/auth/refresh` | `app/api/auth/refresh/route.ts` | POST refresh | none | 401 if no cookie, 502 upstream, 200 ok |
| `/api/auth-test` | `app/api/auth-test/route.ts` | Auth test | none | n/a |
| `/api/deployment-check` | `app/api/deployment-check/route.ts` | Deployment self-check | none | n/a |
| `/api/health` | `app/api/health/route.ts` | Public health | none | 200 always (catch env failure) |
| `/api/monitor` | `app/api/monitor/route.ts` | Monitor POST | none | n/a |
| `/api/webhooks/lemon-squeezy` | `app/api/webhooks/lemon-squeezy/route.ts` | Lemon Squeezy webhook | HMAC | 401 invalid sig, 400 missing fields, 422 missing event time, 200/500 processing |
| `/lobby` | `app/lobby/page.tsx` | Pre-join lobby | none (but UI requires auth to actually join) | n/a |
| `/meeting` | `app/meeting/page.tsx` | DEPRECATED → redirect to `/class/classrooms/<slug>` or `/meet/rooms/<slug>` or `/meet/dashboard` | n/a | redirect |
| `/not-found` | `app/not-found.tsx` | 404 page | none | n/a |
| `/error` | `app/error.tsx` | global error boundary | n/a | n/a |

### 11.2 Authenticated routes (proxy-enforced)

| Route | File | Purpose | Redirect / Error |
|---|---|---|---|
| `/dashboard` | `app/(platform)/dashboard/page.tsx` | Cross-product recent activity | redirect to `/auth?redirect=/dashboard` if no session |
| `/meet/dashboard` | `app/meet/dashboard/page.tsx` | Meet product home (stub) | protected by proxy |
| `/meet/rooms/[slug]` | `app/meet/rooms/[slug]/page.tsx` | Live Meet room | redirect `/auth` if no session, `/dashboard` if `!access.granted` |
| `/class/dashboard` | `app/class/dashboard/page.tsx` | Class home | server-side `redirect('/auth?product=class&...')` if no session |
| `/class/classrooms/[slug]` | `app/class/classrooms/[slug]/page.tsx` | Classroom detail | notFound / redirect `/class/dashboard` if no access |
| `/class/classrooms/[slug]/lessons` | `app/class/classrooms/[slug]/lessons/page.tsx` | Lesson manager | notFound / redirect `/class/dashboard` if no access |
| `/class/classrooms/[slug]/lessons/[lessonId]/live` | `app/class/classrooms/[slug]/lessons/[lessonId]/live/page.tsx` | Live Class session | notFound / redirect `/class/dashboard` / redirect to lessons if lesson not live |
| `/class/classrooms/[slug]/students` | `app/class/classrooms/[slug]/students/page.tsx` | Roster | redirect to classroom if not teacher |
| `/api/meetings` POST | `app/api/meetings/route.ts` | Create meeting | 401 if no session |
| `/api/meetings/[meetingId]/invitations` POST | `app/api/meetings/[meetingId]/invitations/route.ts` | Create invitation | 401, 404, 403, 500 |
| `/api/meeting-invitations/accept` POST | `app/api/meeting-invitations/accept/route.ts` | Accept invitation | 400 invalid token, 401, 500 |
| `/api/lk-token` POST | `app/api/lk-token/route.ts` | LiveKit token | 400, 401, 403, 409, 500 |
| `/api/class/classrooms` GET/POST | `app/api/class/classrooms/route.ts` | List/Create | 401, 400, 409, 500 |
| `/api/class/classrooms/[classroomId]/lessons` POST | `app/api/class/classrooms/[classroomId]/lessons/route.ts` | Create lesson | 401, 404, 403, 400, 500 |
| `/api/class/lessons/[id]/launch` POST | `app/api/class/lessons/[id]/launch/route.ts` | Launch lesson | 401, 404, 400, 403, 500 |
| `/api/subscription-cap` GET | `app/api/subscription-cap/route.ts` | Subscription cap | 200 with trial defaults on error |
| `/api/heartbeat` GET | `app/api/heartbeat/route.ts` | 6-pillar health | 401 if no session; 503 if any pillar fail; 500 on crash |
| `/api/auth/signin/signup/refresh/signout` | already in public | n/a | n/a |

### 11.3 Subdomain rewrites (proxy.ts)

| Host | Path | Rewrite / Redirect |
|---|---|---|
| `class.*` | `/` | rewrite → `/class` |
| `class.*` | `/pricing` | rewrite → `/class/pricing` |
| `class.*` | `/meet/*` | redirect → `/class/dashboard` |
| `class.*` | `/classrooms/*` | rewrite → `/class/classrooms/*` |
| `class.*` | `/dashboard` | rewrite → `/class/dashboard` |
| `class.*` | `/class` | unchanged |
| `class.*` | `/class/*` | unchanged |

---

## 12. State Transition Map

### 12.1 Meet

`meetings.status` (production schema): `active` is the production default. The application never reads or writes this column.

| Surface state | DB column | Set by | Read by | Transitions in code |
|---|---|---|---|---|
| `meetings.status` | `text DEFAULT 'active'` | DB default (never set by app) | not read | none |
| `meetings.starts_at` | `timestamptz` | `buildMeetingInsert` (defaults to now()) | not read | none |
| `meetings.started_at` | `timestamptz DEFAULT now()` (production) | `buildMeetingInsert` (sets to startsAt) | not read | none |
| `meetings.ends_at` | `timestamptz` | `buildMeetingInsert` (defaults to null) | not read | none |
| `meetings.ended_at` | `timestamptz DEFAULT now()` (production) | `buildMeetingInsert` (sets to endsAt) | not read | none |
| `meetings.is_public` | `boolean DEFAULT false` | `buildMeetingInsert` (always true) | `verifyRoomAccess` | none |
| `meetings.slug` | `text UNIQUE` | `buildMeetingInsert` (random or explicit) | `verifyRoomAccess`, `JoinExistingMeeting`, `LobbyPreJoin`, dashboard | none |
| `meetings.room_code` | `text` | `buildMeetingInsert` (= slug) | dashboard | none |
| `meetings.user_id` | `uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` (production) | `buildMeetingInsert` (= owner) | not read | none |
| `meeting_participants.role` | `text IN ('attendee','host','presenter')` | RPC: 'attendee' on insert; 'host' if owner path; existing role on idempotent re-accept | `verifyRoomAccess` (mapped) | none |
| `meeting_participants.joined_at` | `timestamptz` | RPC (statement_timestamp) | not read | none |
| `meeting_invitations.expires_at` | `timestamptz` | `app/api/meetings/[id]/invitations` (validated future date) | RPC | none |
| `meeting_invitations.use_count` | `int` | RPC: +1 on successful accept | not read | none |
| `meeting_invitations.max_uses` | `int` | invitation API (1..10000) | RPC | none |
| `meeting_invitations.revoked_at` | `timestamptz` | NOT IMPLEMENTED | RPC (rejects if not null) | none |
| `meeting_invitations.last_used_at` | `timestamptz` | RPC | not read | none |

**Verdict:** `meetings.status` is dormant. `is_public` is the only "behavioral" state the app uses, and it is set unconditionally to `true` on creation.

### 12.2 Class

`classrooms.status`: enum `(draft | scheduled | live | completed | archived)`. Only `draft` is ever written.

| Surface state | DB column | Set by | Read by | Transitions in code |
|---|---|---|---|---|
| `classrooms.status` | `text DEFAULT 'draft'` | `app/api/class/classrooms` ('draft') | `app/class/classrooms/[slug]/page.tsx` (display) | none |
| `classrooms.enrollment_type` | `text IN ('open','approval','invite')` | `CreateClassroomButton` | `classrooms` row is read; the value is not honored anywhere | none |
| `classroom_lessons.status` | `text IN ('scheduled','live','recorded','cancelled')` | `POST /lessons` ('scheduled'); `POST /launch` ('live' if not cancelled) | `app/class/classrooms/[slug]/page.tsx` (display) | scheduled → live (via launch) |
| `classroom_lessons.livekit_room_id` | `text` | `POST /launch` (writes 'class-<classroom_id>-<lessonId>' if null) | `verifyClassLessonAccess` (returned) | none |
| `classroom_enrollments.enrollment_status` | `text IN ('pending','active','suspended','completed')` | **NOT WRITTEN BY APP** (only read in `verifyClassroomAccess`, which filters to 'active') | multiple | none |
| `classroom_enrollments.role` | `text IN ('instructor','ta','student','auditor')` | **NOT WRITTEN BY APP** | `verifyClassroomAccess` (returned as `accessRole`) | none |
| `classroom_enrollments.progress_percent` | `int CHECK 0..100` | **NOT WRITTEN BY APP** | `students/page.tsx` (display) | none |
| `classroom_enrollments.enrolled_at` | `timestamptz` | **NOT WRITTEN BY APP** | multiple | none |
| `classroom_enrollments.completed_at` | `timestamptz` | **NOT WRITTEN BY APP** | not read | none |
| `classroom_assignments.*` | n/a | **NOT WRITTEN BY APP** | not read | n/a |
| `classroom_submissions.*` | n/a | **NOT WRITTEN BY APP** | not read | n/a |

**Verdict:** Class state is essentially two-step: `draft` (classroom), `scheduled → live` (lesson). Everything else is dormant.

### 12.3 Subscription

`subscriptions.status`: `text`. Set by the webhook RPC (mapped from Lemon Squeezy `active | trialing | paused | cancelled | expired | past_due`).

| Source event | Mapped status | Application impact |
|---|---|---|
| `subscription_created` (active) | `active` | meets entitlement, meets capacity |
| `subscription_updated` (active) | `active` | unchanged |
| `subscription_resumed` (active) | `active` | restored |
| `subscription_cancelled` | `cancelled` | capacity check fails; AI features blocked; cap API returns trial |
| `subscription_expired` | `expired` | same as cancelled |
| `subscription_paused` | `paused` | same |
| `subscription_payment_failed` (past_due) | `past_due` | same |
| (none) | (active) | meets entitlement if plan in PAID_MEET_PLANS or class_10/20/30 |

`services.status` is not nullable in production for Meet (the finalize migration `20260825000000` actually sets status to nullable). The webhook RPC uses `p_status` directly without normalization.

**Found (P2/UNKNOWN):** `subscriptions.status` NULLability. The `20260825000000` finalize migration drops NOT NULL on `status`. The webhook RPC never sets status to NULL. The application reads status with the `eq('status','active')` filter, so NULL rows would not be returned — but they would also not be returned by `data.status !== 'active'` checks. Net: this is consistent, but worth noting.

---

## 13. Failure Path Inventory

Status: HANDLED / PARTIALLY HANDLED / NOT HANDLED / UNKNOWN.

### 13.1 Meet

| Failure | Status | Evidence |
|---|---|---|
| Validation failure (e.g. invalid slug) | HANDLED | `lib/meetingPersistence.ts#ensureSlug` throws → `app/api/meetings` catches and returns 400 (well, 500; 400 is the more correct response — see Finding P3 #16) |
| Authentication failure (no session) | HANDLED | All Meet routes return 401 |
| Authorization failure (not owner) | HANDLED | `app/api/meetings/[id]/invitations` returns 403; `verifyRoomAccess` returns null; `lk-token` returns 403 |
| RLS denial | PARTIALLY HANDLED | RLS is only consulted for user-JWT writes. The `meetings.is_public` branch of `verifyRoomAccess` allows the app to issue a token for a non-participant public meeting, but PostgREST direct reads would 406 — a discrepancy |
| Missing record (slug not found) | HANDLED | `verifyRoomAccess` returns null → redirect/403 |
| Duplicate request (meeting creation) | HANDLED | Unique slug → up to 5 retries with 5xx fallback. The retry is server-side per-request, not distributed locking — concurrent requests with `requestedSlug` will both fail |
| Expired invitation | HANDLED | RPC raises `'invalid invitation'`, mapped to 400 |
| Invalid invitation | HANDLED | RPC raises `'invalid invitation'`, mapped to 400 |
| Entitlement failure (no Meet premium) | HANDLED | `canUseMeetFeature` returns `{ allowed: false, reason: 'meet_entitlement_required' }` → `ai-actions.ts` returns `{ status: 'ERROR' }` |
| Capacity exceeded | HANDLED | `enforceClassCapacity` returns `allowed: false` → `lk-token` 403 |
| Network error | PARTIALLY HANDLED | Client uses `MeetLiveSession#connectToRoom` which catches and sets `connectionError` state. No retry logic on the client |
| Database error | PARTIALLY HANDLED | API routes return 500 with generic error; client shows error message in UI; no retry |
| RPC error | HANDLED | `app/api/meeting-invitations/accept` distinguishes "invalid invitation" from generic 500 |
| LiveKit error | PARTIALLY HANDLED | Connection failure shows error banner; meeting continues to allow retry. Reconnection logic exists (`ConnectionManager` in `lib/connectionRecovery.ts`) but is not wired into the LiveKit Room object in `MeetLiveSession` |
| Stale session | HANDLED | `lk-token` requires fresh session; if session is expired, returns 401 |
| Refresh | HANDLED | `lib/clientAuth.ts#refreshSession` |
| Direct URL access to `/meet/rooms/[unknown]` | HANDLED | `verifyRoomAccess` returns null → redirect to `/dashboard` |
| Direct URL access to `/class` while signed out | HANDLED | proxy redirects to `/auth?redirect=...` |

### 13.2 Class

| Failure | Status | Evidence |
|---|---|---|
| Validation failure (empty title) | HANDLED | `CreateClassroomButton` checks title client-side; `normaliseRequiredTitle` server-side |
| Authentication failure | HANDLED | `app/api/class/*` returns 401 |
| Authorization failure (not teacher) | HANDLED | `verifyClassroomTeachingAccess` returns `{ granted: false }` → 403 |
| RLS denial | PARTIALLY HANDLED | Same as Meet |
| Missing record | HANDLED | notFound() / redirect |
| Slug collision | HANDLED | 4-attempt retry with random suffix |
| No Class subscription for owner | HANDLED | `enforceClassCapacity` returns `null` → `lk-token` 403 |
| Capacity exceeded (teachers/students) | HANDLED | `enforceClassCapacity` returns `allowed: false, reason` → `lk-token` 403 |
| Lesson not live | HANDLED | `lk-token` 409 |
| LiveKit error (class) | PARTIALLY HANDLED | Connection failure shows red screen with "Connection Failed" + "Return to Dashboard" |
| Lesson cancelled | HANDLED | launch route refuses to launch; live page redirects to lessons list |
| Network error | UNKNOWN | `ClassroomSession` does not show a network-specific error state beyond generic |
| Refresh | HANDLED | Same as Meet |
| Direct URL access to `/class/classrooms/[unknown]` | HANDLED | `resolveClassroom` returns null → notFound() |
| Direct URL access to `/class/classrooms/[other-user-class]` | HANDLED | `verifyClassroomAccess` returns `granted: false` → redirect to `/class/dashboard` |

### 13.3 Auth

| Failure | Status | Evidence |
|---|---|---|
| Invalid credentials | HANDLED | `app/api/auth/signin` returns 401 with error_description |
| Email already exists | HANDLED | Returns 422 with error_description |
| Rate-limited signin | HANDLED | 429 |
| Rate-limited signup | HANDLED | 429 |
| Forgot password: email not found | HANDLED (intentionally generic) | Always returns success; Supabase upstream behavior |
| Update password: weak password | HANDLED | Client-side check (`newPassword.length < 6`); server `auth.updateUser` error returned |
| Update password: invalid recovery link | HANDLED | "Invalid or expired recovery link" message |

### 13.4 Webhook

| Failure | Status | Evidence |
|---|---|---|
| Invalid HMAC signature | HANDLED | 401 |
| Non-subscription event | HANDLED | `{ received: true, skipped: true }` |
| Missing subscription ID | HANDLED | 400 |
| Missing user_id in custom_data | HANDLED | 400 |
| Missing webhook_id | HANDLED | 400 |
| Missing external event time | HANDLED | 422 |
| Duplicate webhook_id | HANDLED | RPC returns `{ duplicate: true }`; webhook returns 200 |
| Out-of-order webhook (stale) | HANDLED | RPC returns `{ stale: true }`; webhook returns 200 |
| Unknown product/variant | HANDLED | `mapPlanFromProduct` throws; webhook returns 500 (does not return 4xx — `try/catch` outer) |
| `classroom_plus` (legacy) | HANDLED | Explicit error: refuses to grant entitlement |
| `enterprise` (contact-sales only) | HANDLED | Explicit error: refuses automatic grant |
| Internal RPC error | HANDLED | Caught; returns 500; the RPC itself logs the error in `subscription_webhook_events` |

### 13.5 Subdomain / proxy

| Failure | Status | Evidence |
|---|---|---|
| Unprotected route accessed unauthenticated | HANDLED | proxy.ts redirects to `/auth?redirect=...` |
| Auth route accessed authenticated | HANDLED | proxy.ts redirects to `/dashboard` |
| Class subdomain accessing `/meet/*` | HANDLED | proxy.ts redirects to `/class/dashboard` |
| Deprecated `/meeting` route | HANDLED | Dynamic redirect to `/class/classrooms/<slug>` or `/meet/rooms/<slug>` |

---

## 14. Race / Duplicate Request Analysis

For each high-risk operation: protection at UI, server, database.

### 14.1 Meeting creation

- **UI:** `CreateMeetingButton` has an `isCreating` guard that disables the button after the first click.
- **Server:** The server has no distributed lock. `createExplicitMeeting` retries up to 5 times on slug conflict. Two concurrent requests with `requestedSlug` set will both fail with 409; two with random slugs will both succeed (with different slugs).
- **Database:** The `meetings.slug` UNIQUE constraint provides a hard barrier. `meetings_user_id_fkey` ensures `user_id` is valid.

**Verdict:** Safe for random-slug path. Safe for explicit-slug path under the constraint. The button guard prevents most double-clicks but does not protect against two tabs.

### 14.2 Invitation acceptance

- **UI:** `LobbyPreJoin.acceptInvitation` is fired on mount; `isCreating` is not tracked because the lobby already accepts a single accept. Re-clicking the join button after acceptance does not re-call `acceptInvitation` (the `intent=join` check is removed from the URL on first accept).
- **Server:** `POST /api/meeting-invitations/accept` has no in-process guard; the user can re-submit.
- **Database:** `accept_meeting_invitation` is `SECURITY DEFINER` and uses `SELECT ... FOR UPDATE OF invitation` to serialize concurrent uses. `meeting_participants` has `UNIQUE (meeting_id, user_id)`, so duplicate participant inserts fail. The RPC handles the `ON CONFLICT DO NOTHING` case by re-fetching the existing role. Idempotent for the membership; increments `use_count` only on first successful insert.

**Verdict:** Idempotent and race-safe. This is the strongest part of the application.

### 14.3 Participant creation

Same as 14.2. The RPC is the single insertion point for `meeting_participants`. Safe.

### 14.4 Student enrollment

- **UI:** N/A (no enrollment UI).
- **Server:** N/A (no enrollment write API).
- **Database:** RLS permits owner writes; the database is the only safety net if a future API path exists.

**Verdict:** Indeterminate because no path exists. A future implementation must enforce `UNIQUE (classroom_id, student_id)`.

### 14.5 Assignment submission

- **UI / Server / Database:** N/A (no path). Database has `UNIQUE (assignment_id, student_id)` on `classroom_submissions`.

**Verdict:** Indeterminate.

### 14.6 Webhook processing

- **UI / Server:** The webhook route is a single in-process handler per request. The Lemon Squeezy retry policy is upstream and can re-deliver.
- **Database:** The RPC deduplicates by `webhook_id` (UNIQUE) via `ON CONFLICT (webhook_id) DO NOTHING`. The duplicate `INSERT 0 0` is detected and returns `{ duplicate: true }`. Out-of-order delivery is detected via `last_external_event_at` and returns `{ stale: true }`.

**Verdict:** Race-safe and duplicate-safe. The RPC is the single source of subscription truth.

### 14.7 Classroom capacity

- **UI:** `ClassroomSession#handleJoin` does NOT pre-check capacity; it requests `lk-token` and the server is authoritative.
- **Server:** `enforceClassCapacity` reads the current enrollment counts and the owner's plan limits. This is racy in the sense that two simultaneous join requests could both pass the count check (e.g. the 11th student in a 10-seat class) — there is no row-level lock.
- **Database:** No database-level cap enforcement (e.g. trigger that rejects 11th student).

**Verdict:** Vulnerable. The `enforceClassCapacity` check is best-effort and can be exceeded under concurrent load. This is a real production risk for popular classrooms. The `meeting_participants` UNIQUE constraint does not exist in the same way for class (the equivalent is `classroom_enrollments` UNIQUE on (classroom_id, student_id), but with no enrollment write path, this is currently moot).

### 14.8 Lesson launch

- **UI:** `LaunchLessonButton` has a `pending` guard.
- **Server:** The launch route reads then updates. Two concurrent launches would both read `lesson.status = 'scheduled'`, both write `lesson.status = 'live'`. The `livekit_room_id` write is idempotent if it's already set (the route uses `lesson.livekit_room_id || 'class-...'`).
- **Database:** No status-version check (no `WHERE status = 'scheduled'` on the UPDATE).

**Verdict:** Mostly safe (the write is idempotent), but the `UPDATE` does not check current status. If a future "end lesson" path is added, race conditions could occur.

### 14.9 Subscription cap API

- **UI:** Multiple consumers (`components/Dashboard.tsx`, etc.) call the cap API.
- **Server:** `app/api/subscription-cap/route.ts` is a pure read; safe.
- **Database:** Reads `subscriptions` for the current user; no race issue.

**Verdict:** Safe.

### 14.10 `meetings.ended_at` / `classroom_lessons.status = 'recorded'`

- **UI / Server / Database:** No write path. N/A.

**Verdict:** N/A.

---

## 15. Dead / Orphaned Functionality

### 15.1 UI references with no current data path

- **`components/Dashboard.tsx`** — the legacy client-rendered dashboard. Renders meetings history from `lib/persist.ts` (localStorage) only. The actual server-rendered dashboard is `app/(platform)/dashboard/page.tsx`. This component is still mounted by `app/page.tsx` (landing) and is used for the `?checkout=success` flow. Its non-product-scoped subscription read returns "the first row" for the user — wrong if the user has both Meet and Class subscriptions.
- **`components/Lobby.tsx`** — the legacy lobby component. The current lobby is `LobbyPreJoin.tsx` used by `app/lobby/page.tsx`. `Lobby.tsx` is still imported by `Dashboard.tsx`.
- **`components/PresentationView.tsx`**, **`components/SlideEditor.tsx`**, **`components/CollaborativeEditor.tsx`** — referenced by `Dashboard.tsx`'s view system. The production application has no path that surfaces these.
- **`app/meeting/` and `app/meeting/layout.tsx`** — only contains the deprecated redirect `app/meeting/page.tsx`. The layout is still rendered for the redirect route.
- **`hooks/usePresentation.ts`, `hooks/useMeetingPresentation.ts`, `hooks/useCollaborativeDoc.ts`, `hooks/useBrowserMedia.ts`, `hooks/useClipboard.ts`, `hooks/useClickOutside.ts`, `hooks/useTimer.ts`, `hooks/useMonitoring.ts`** — appear unused by the active `/meet/rooms/[slug]` flow. The live session uses LiveKit directly, not the `PresentationView` / `SlideEditor` chain.
- **`hooks/useSpeechTranscript.ts`** — used by `MeetLiveSession` (active).
- **`hooks/useScreenShare.ts`** — used by `MeetLiveSession` (active).
- **`hooks/useRemotePresentations.ts`** — used by `MeetLiveSession` (active).
- **`hooks/useConnectionRecovery.ts`** — appears unused in the live path; `MeetLiveSession` does its own reconnection.
- **`hooks/useTranslation.ts`** — used by `MeetLiveSession` (active).
- **`lib/batteryAwareness.ts`, `lib/networkAwareness.ts`** — present but no consumer found in the active live path.

### 15.2 Handlers / API paths with no current UI

- **`getUserSubscription()`** in `app/actions/checkout-actions.ts` — no caller found.
- **`requestPasswordReset`** — used by `/auth/forgot-password`. Active.
- **`/api/heartbeat`** — protected; no current UI surfaces the result, but is used by the integration tests.
- **`/api/deployment-check`** — no caller found.
- **`/api/monitor`** — no caller found.
- **`/api/auth-test`** — diagnostic only.
- **`/api/auth/refresh`** — no current UI calls it (the browser SDK auto-refreshes); kept for future use.
- **`app/admin/health/page.tsx`** — no nav link found; reachable by direct URL.

### 15.3 Database operations with no current UI

- **`classroom_enrollments` write** — see Finding P0 #1.
- **`classroom_assignments` / `classroom_submissions`** — see Finding P0 #1.
- **`meeting_invitations.revoked_at`** — RLS permits owner UPDATE of this column only; no UI calls it.
- **`classroom_lessons.recording_url`** — DB column exists; no writer.
- **`classroom_lessons.status = 'recorded' | 'cancelled'`** — never written.
- **`classrooms.status = 'scheduled' | 'live' | 'completed' | 'archived'`** — never written.
- **`meetings.status`, `meetings.ended_at`, `meetings.duration_seconds`, `meetings.participant_count`, `meetings.has_recording`, `meetings.language`, `meetings.host_id`, `meetings.room_id`, `meetings.org_id`** — present in production, no application writer/reader.
- **`subscriptions.last_external_event_at`, `last_external_event_id`** — written by webhook RPC, not read by the application.
- **`subscription_webhook_events`** — written by webhook RPC, not read by the application (except the RPC itself).

### 15.4 UI referencing nonexistent fields

- None found in the active flow. `components/Dashboard.tsx` references `subscription.tier` and `subscription.renewalDate` / `nextBilling` from the `Subscription` type, but these are localStorage-based; the live `SubscriptionRecord` type uses `plan`, `status`, `current_period_*`.

### 15.5 Stale schema references

- **`types.ts`** keeps a `PlanTier` legacy mapping (`'trial' | 'classroom' | 'classroom_plus' | 'individual' | 'pro' | 'business' | 'enterprise' | 'unlimited'`) alongside the new `PlanId`. The legacy `PlanTier` is used in `components/Dashboard.tsx` and the `PLAN_COLORS` / `PLAN_NAMES` lookups. It is NOT used in any active DB read or write. The `planIdToLegacyTier` / `legacyTierToPlanId` functions are exported but no callers found.
- **`legacyTierToPlanId` and `planIdToLegacyTier`** in `types.ts`: see Finding P2 #11.

### 15.6 Legacy Lemon Squeezy / Peach Payments references

- `lib/lemon-squeezy.ts` uses `LEMONSQUEEZY_*` (new) and `LEMON_SQUEEZY_*` (legacy) env vars; both are accepted.
- `app/(marketing)/class/pricing/page.tsx` has a mailto: link to `info@conferly.site` (correct).
- `app/(marketing)/pricing/page.tsx` has a mailto: link to `sales@conferly.app` (different domain — this is a STALE reference; the canonical address per other pages is `info@conferly.site`).
- The legacy `createClassroomCheckout` action maps `classroom` → `class_10`. `createClassroomPlusCheckout` returns an error (legacy refusal). Both are still exported but appear unused.
- **No Peach Payments references** in the active code (the older `payments` table was rebuilt to the production shape; the `peach_transaction_id` column exists in the production schema but no application code writes it).

### 15.7 Duplicated implementations

- **`MeetingInviteResult`** in `lib/meetingInvite.ts` and inline clipboard/share logic in `components/MeetingControls.tsx` (`copyCode` and the share button). The two paths overlap.
- **`buildCanonicalMeetingUrl` / `buildCanonicalLobbyInviteUrl` / `normalizeMeetingJoinTarget`** in `lib/meetingInvite.ts` are used by `LobbyPreJoin`, `JoinExistingMeeting`, and `meetingInvite.ts` itself. Single source.
- **Subscription cap read** is implemented in three places: `app/api/subscription-cap/route.ts` (canonical), `lib/meetEntitlements.ts` (Meet-specific), `lib/classEntitlements.ts` (Class-specific). These overlap for the "what's my cap" question. They are kept separate because Meet and Class have different return shapes (`participantCap` vs `{studentCap, teacherCap}`).
- **`verifyRoomAccess`** uses two queries (by slug, fallback by id). This is intentional to accept both forms in the lobby.

### 15.8 Unused entitlement logic

- **`isMeetPremiumFeature(feature)`** in `lib/meetEntitlements.ts` — `feature === 'recording' || 'transcription' || 'ai_assistant' || 'ai_summary'`. `recording` and `transcription` are listed as MeetFeatures but no application code passes them to `canUseMeetFeature`. The only callers are `ai-actions.ts` for `ai_summary` and `ai_assistant`. `recording` is local-only (no DB involvement); `transcription` is local-only.
- **`canPublishClassroomMedia` / `canUseClassroomTeacherControls` / `canUseClassroomWhiteboard` / `mapClassroomRoleToLiveRoomRole`** in `lib/classroomSeating.ts` are partially used by `ClassroomSession` (mute/video gating). The whiteboard controls are not wired to a UI.

### 15.9 Suspicious TODO / FIXME

- No `TODO` / `FIXME` markers found in the application code paths.
- Commented code blocks in `app/api/heartbeat/route.ts` and `app/api/auth/signin/route.ts` are explanatory comments, not stubs.
- `app/(marketing)/pricing/page.tsx` references `sales@conferly.app` (stale — see 15.6).

---

## 16. Known Contract Risks

### 16.1 Subscription RPC

**Contract (verified):**
```text
process_lemon_squeezy_subscription_webhook(
  p_webhook_id                text,
  p_event_name                text,
  p_external_subscription_id  text,
  p_user_id                   uuid,
  p_product_line              text,
  p_plan                      text,
  p_participant_cap           integer,
  p_status                    text,
  p_external_event_at         timestamptz,
  p_external_order_id         text,
  p_current_period_start      timestamptz,
  p_current_period_end        timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
```

- Application call site: `app/api/webhooks/lemon-squeezy/route.ts:81` with the same 12 positional-by-name parameters. ✅ EXACT MATCH.
- ACL: `service_role` only (per `20260824000000` + `20260806185601` migrations; verified against `production_functions_acl_final.json`).
- Behavior: dedup by `webhook_id` (UNIQUE), stale-check by `last_external_event_at`, `INSERT ... ON CONFLICT (user_id, product_line) DO UPDATE`.

**Risks:**
- `p_product_line` is validated by the RPC as `IN ('meet', 'class')`. Application maps via `mapPlanFromProduct` and throws on unknown; the webhook route catches and returns 500. Safe.
- `p_user_id` must be a valid `auth.users` id. The webhook extracts it from `meta.custom_data.user_id`. If the checkout was made without `custom_data`, the webhook returns 400. Safe.
- The webhook does NOT call `handle_new_user` for the user — assumes the user already exists in `auth.users`. If a user pays before signing up, the subscription row is created against a NULL `user_id`... actually no, the RPC validates `p_user_id IS NOT NULL`. So a checkout that supplies a non-existent user UUID would be rejected by the FK on `subscriptions.user_id` REFERENCES `auth.users(id)`. This is a real risk if the checkout flow lets unauthenticated users pay.

### 16.2 Meeting invitation RPC

**Contract (verified):**
```text
accept_meeting_invitation(
  p_meeting_slug  text,
  p_token_hash    text
)
RETURNS TABLE (
  meeting_id     uuid,
  slug           text,
  database_role  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
```

- Application call site: `app/api/meeting-invitations/accept/route.ts:71`. ✅ EXACT MATCH (both args).
- ACL: `postgres + service_role + authenticated` (per `20260825010000`).
- Atomic membership + use_count increment.

**Risks:**
- Token hash must match `^[0-9a-f]{64}$` — enforced by both the application and the RPC.
- The RPC allows a `database_role` of `'host'` only if the caller is the meeting owner; otherwise it sets `meeting_participants.role = invitation.role` (default `'attendee'`). The application maps `'host'` → `'owner'`, `'presenter'` → `'presenter'`, else → `'participant'`. The `'spectator'` value is never returned by the RPC.
- Idempotent: existing membership + non-revoked/non-expired/non-exhausted invitation succeeds without consuming a use_count. New membership + valid invitation consumes one.

### 16.3 Product-scoped subscription identity

**Verified:** All actively-used entitlement paths scope by `(user_id, product_line)`:
- `app/api/subscription-cap/route.ts:39` — `.eq('product_line', productLine)`.
- `lib/meetEntitlements.ts:54` — `.eq('product_line', 'meet')`.
- `lib/classEntitlements.ts:43` — `.eq('product_line', 'class')`.
- Webhook RPC: writes with explicit `p_product_line`, `ON CONFLICT (user_id, product_line) DO UPDATE`.

**Risks (P2):**
- `app/actions/checkout-actions.ts#getUserSubscription` (likely unused) does NOT filter by product_line — returns all rows.
- `components/Dashboard.tsx` (legacy, used by `app/page.tsx` for the conversion tracking) does NOT filter by product_line — `.maybeSingle()` returns the first row.
- `getUserSubscription` and `Dashboard.tsx`'s subscription reads are not on the critical path of any current user action, but are still wired into the rendering.

### 16.4 RLS bypass on subscription reads

- `app/api/subscription-cap/route.ts`, `lib/meetEntitlements.ts`, `lib/classEntitlements.ts` all use the service-role client. The user JWT is used for the session, but the DB read is service-role. RLS is bypassed. This is intentional and safe because the WHERE clause is `(user_id, product_line) = (authenticated_user, requested_line)`, and the caller is the same server code that already validated the user. But it does mean a future code path that takes a `userId` parameter and passes it through without checking could leak another user's subscription.

### 16.5 Owner UUID vs user_id FK

- `meetings.owner` references `auth.users(id) ON DELETE SET NULL`.
- `meetings.user_id` references `profiles(id) ON DELETE CASCADE` (per production).
- These are DIFFERENT FK targets. The application always sets `user_id = owner`. The DB has the constraint that `user_id` is NOT NULL and CASCADEs to `profiles`, not `auth.users`. This is the live contract.

---

## 17. Confirmed Correct Paths

The following end-to-end paths are verified to work as designed and can be relied on:

1. **Sign-in / sign-up / sign-out / refresh / password reset** — full coverage with rate limiting, cookie session management, and proper error surfaces.
2. **Meet meeting creation** (`POST /api/meetings`) — race-safe via slug UNIQUE, RLS-gated to owner.
3. **Meet invitation acceptance** (`POST /api/meeting-invitations/accept` → RPC) — atomic, race-safe, idempotent, ownership-aware (owner path doesn't consume a use).
4. **LiveKit token issuance for Meet** — service-role verification, role mapping, JWT minting.
5. **Webhook subscription processing** — HMAC verification, signature-validated, idempotent, product-scoped, stale-aware, fail-safe (500 on unknown products).
6. **Subscription cap read** (`GET /api/subscription-cap?productLine=...`) — properly product-scoped, trial defaults.
7. **Classroom creation** — slug retry, RLS-gated, returns slug for navigation.
8. **Classroom access** (`verifyClassroomAccess`) — service-role lookup with owner/enrollment check, `spectator` fallback (consistent with `verifyRoomAccess`).
9. **Classroom lesson create / launch** — teaching-role-gated, status transitions, livekit_room_id lazy-generation.
10. **Classroom live session start** — `verifyClassLessonAccess` + `enforceClassCapacity` + LiveKit token mint, server-side capacity gate.
11. **Pricing / checkout buttons** — server actions per product type, plan validation, env-var variant ID resolution, mailto: for enterprise.
12. **Proxy subdomain routing** — class subdomain rewrites, meet-on-class-blocked, deprecated `/meeting` redirect.
13. **Health checks** — public (`/api/health`), authenticated (`/api/heartbeat`).
14. **Auth triggers** — `on_auth_user_created` → `handle_new_user` populates `profiles` row from `auth.users` insert.

---

## 18. Unknowns Requiring Verification

These require live access to the production database to confirm. The repo evidence is complete but cross-checking against the live catalog is recommended.

| Unknown | Why it matters | What to verify |
|---|---|---|
| Exact `meetings` column list in production | Some columns are not in `20260825000000` adds but may exist in production | Compare `20260825000000` to `forensics_production.json` columns array |
| Production `classroom_lessons` policy names | Local chain uses `Owners and TAs can manage lessons`; production may have a different name with the same USING clause | Compare pg_policy.polname |
| Whether `profiles.email` is populated by the trigger | The trigger inserts `id, email, display_name`; the `email` value comes from `new.email` (auth.users) | `SELECT email FROM profiles` against production |
| Whether `meetings.is_public` defaults to `false` (production) or `true` (app) | The application unconditionally sets `true` on insert; the DB DEFAULT is `false` per the init migration. The finalize migration's effect on this is not clear from the read | Compare `forensics_production.json` |
| Whether `subscriptions.status` is nullable in production | The finalize migration drops NOT NULL, but the production catalog may still have it | Compare constraints |
| Whether the `meetings` table has an `INSERT` policy for non-owners | Local chain has `meetings_insert_owner_only`; production has `meetings_insert_owner` per the finalize migration | Verified via `20260825000000` |
| Whether `meetings.started_at` has `DEFAULT now()` | The finalize migration adds the DEFAULT; production may or may not have it pre-existing | Verified via `20260825000000` |
| Whether the `classroom_enrollments.role` CHECK includes `auditor` | The class migration lists 4 roles; the canonical RLS references `instructor` and `ta` only for the `Owners and TAs` policy | Compare with the live catalog |
| Whether `subscription_webhook_events` has `created_at` | The final migration adds it; production has it | Verified via `20260826000000` |
| Whether `chat_messages` is `messages jsonb` or `message text` | The final migration drops and recreates the table; production is `messages jsonb` per `production_columns_summary.txt` | Confirmed |
| Whether `analytics_events` has `user_id` | The final migration drops the column; production has NO `user_id` | Confirmed via `20260826000000` |

---

## 19. Recommended Phase 2 Work Items

**NOT in scope for Phase 1.** These are observations for the Phase 2 planning prompt that follows. They are evidence-based, not "fixes" — Phase 2 will decide which to act on.

| # | Item | Severity | Source |
|---|---|---|---|
| 1 | Implement student enrollment path (server API + UI). Without it, Class is unusable for its primary use case. | P0 | §5.5, §15.3 |
| 2 | Implement Class assignment / submission (server API + UI). Tables and RLS exist; behavior is missing. | P0 | §5.9, §15.3 |
| 3 | Implement classroom lesson status transitions to `recorded` and `cancelled` (or remove unused enum values). | P2 | §12.2 |
| 4 | Implement meeting end (write `meetings.ended_at` and `meetings.status`). | P2 | §4.12, §15.3 |
| 5 | Add server-authoritative `is_public` RLS for spectator reads, OR remove the `is_public` column. | P2 | §7.3 |
| 6 | Replace `components/Dashboard.tsx`'s non-product-scoped subscription read with a product-scoped query (or remove the legacy component). | P2 | §6.3, §15.1 |
| 7 | Replace `getUserSubscription` server action's non-product-scoped read, or delete the action if unused. | P3 | §6.3, §15.1 |
| 8 | Add row-level lock or DB-level cap check for class capacity to prevent races. | P2 | §14.7 |
| 9 | Add `WHERE status = 'scheduled'` to the lesson launch UPDATE. | P3 | §14.8 |
| 10 | Decide on the legacy `classroom_plus` → `class_30` mapping policy (currently webhook refuses; `legacyTierToPlanId` allows it). | P2 | §15.5 |
| 11 | Update `sales@conferly.app` → `info@conferly.site` in `app/(marketing)/pricing/page.tsx` to match the canonical address. | P3 | §15.6 |
| 12 | Implement `meeting_invitations` revoke endpoint + UI. | P3 | §8.1 |
| 13 | Decide whether to wire `recording` and `transcription` `MeetFeature` checks (currently declared but unused). | P3 | §15.8 |
| 14 | Document the `meetings.duration_seconds` / `participant_count` / `has_recording` schema drift (production has them, app never writes them). | P3 | §15.3 |
| 15 | Investigate the `?checkout=success` UX split between `(platform)/dashboard` and legacy `Dashboard.tsx`. | P3 | §15.1 |
| 16 | Verify that the `lk-token` 400 case for `app/api/meetings` invalid-slug actually returns 400 (the current try/catch returns 500; the expected status is 400). | P3 | §13.1 |
| 17 | Add UI for the `/api/heartbeat` results (or restrict to integration tests only). | P3 | §15.2 |
| 18 | Decide on the future of `classroom_assignments.max_score` (declared in `pricing/class.ts` features for class_30, not used in code). | P3 | §6.2 |
| 19 | Consider whether the `meetings.is_public` default of `true` is the intended product behavior (every created meeting is public-by-default). | P2 | §4.2, §7.3 |
| 20 | Confirm whether new users must have a Meet and/or Class subscription row before they can use the corresponding product (currently no, which is by design for free Meet). | P2 | §6.4 |

---

## 20. Phase 1 Conclusion

### 20.1 Files inspected (summary)

- **44 app routes / pages** (every file under `app/`).
- **80 components** (every file under `components/`).
- **~50 lib modules** (every file under `lib/`).
- **16 hooks** (every file under `hooks/`).
- **18 Supabase migrations** (every file under `supabase/migrations/`).
- **3 db/migration files** (mirror).
- **Auth helpers**, **Supabase client factories**, **LiveKit token module**, **pricing tables**, **entitlement modules**, **meeting/classroom auth modules**, **webhook handler**, **subscription-cap API**, **class/classroom APIs**, **meet APIs**, **session/lobby/meet/class room pages**.
- **Production forensic artifacts** (`forensics_production.json`, `production_columns_summary.txt`, `functions_and_policies.txt`, `LOCAL_VS_PRODUCTION_DIFF.json`, `RESET_RESULT.md`, `FINAL_LIVE_TO_LOCAL_DATABASE_ALIGNMENT_REPORT.md`, `PRODUCT_ENTITLEMENT_INTEGRATION_REPORT.md`, `REPORT_BUILD_PROVENANCE.md`).
- **Package manifest** (`package.json`), **`next.config.ts`**, **`proxy.ts`**, **`supabase/config.toml`**.

### 20.2 Workflow map created

- One new file: `CONFERLY_APPLICATION_WORKFLOW_MAP.md` (this document).
- 20 sections covering: executive summary, repository architecture, authentication, Meet workflow, Class workflow, user action inventory, DB mutation matrix, read/query matrix, entitlement map, authorization map, route map, state transition map, failure path inventory, race/duplicate analysis, dead/orphaned functionality, known contract risks, confirmed correct paths, unknowns, recommended Phase 2 work items, conclusion.

### 20.3 Counts

- **User actions mapped:** 64 (36 Meet + 23 Class + 5 cross-product).
- **DB mutations mapped:** 14 distinct mutations, each with full path from UI → route handler → DB operation.
- **Read/query paths mapped:** 13 (dashboard, class dashboard, classroom detail, lessons, roster, live room, lobby, cap, etc.).
- **Routes mapped:** 39 (24 public/auth + 15 authenticated/API).
- **Confirmed issues by severity:**
  - **P0:** 2 (enrollment not implemented; assignments/submissions not implemented; production schema drift on `meetings.user_id`).
  - **P1:** 4 (lobby meeting-fetch, dashboard subscription read, etc. — see §1 and §15).
  - **P2:** 9 (race on class capacity, public-meeting RLS, legacy `classroom_plus` mapping, etc.).
  - **P3:** 8 (stale `sales@conferly.app` email, unused MeetFeature variants, etc.).
  - **UNKNOWN:** 11 (cross-checks against live production catalog that require SELECT access).
- **Critical findings:** listed in §1 (Executive Summary). The single most important: **Class is architecturally half-built.** The domain tables (`classrooms`, `classroom_lessons`, `classroom_enrollments`) have the right schema and RLS, but the application only creates classrooms and lessons. Enrollment is read-only, and assignments/submissions don't exist.

### 20.4 Confirmation of no implementation changes

- No application code modified.
- No migration created or modified.
- No schema, RLS, policy, configuration, or dependency change.
- No `git add`, `git commit`, or `git push`.
- The only new file is `CONFERLY_APPLICATION_WORKFLOW_MAP.md` in the working directory.

### 20.5 STOP — Phase 1 complete

Phase 1 reconnaissance is complete. No further action will be taken in this phase. The next Phase 2 prompt will be generated from the recommended work items in §19 and the open questions in §18.

**END OF PHASE 1.**
