# Conferly — Live Production Forensic Reconciliation Report

**Generated:** 2026-08-24 (from a live `supabase db query --linked` connection to project `neymqmyzmsberwlowlpw`)
**Project:** Conferly · Region: `eu-west-1` · Database: PostgreSQL 17.6.1.111

This report is based on **live, read-only forensics** executed via the Supabase Management API SQL
endpoint (`supabase db query --linked`). All findings below are verified against the actual
production object catalog (`pg_catalog`, `pg_policies`, `information_schema`, `pg_constraint`,
`pg_indexes`, `pg_proc`, `pg_stat_user_tables`).

---

## 1. Production object inventory (public schema)

### 1.1 Tables (23 public tables)

```
analytics_events, audit_logs, chat_messages,
classroom_assignments, classroom_enrollments, classroom_lessons, classroom_submissions, classrooms,
meeting_invitations, meeting_participants, meetings,
notes, org_members, organizations, payments,
presentations, profiles, recordings, slides,
subscription_webhook_events, subscription_webhook_events_v2, subscriptions, transcripts
```

### 1.2 RLS is enabled on **23/23** public tables (verified rowsecurity = true on all).

### 1.3 Fresh row counts (live `pg_stat_user_tables`)
| table | rows |
|---|---|
| meetings | 27 |
| meeting_invitations | 7 |
| profiles | 5 |
| meeting_participants | 3 |
| classrooms | 2 |
| classroom_lessons | 2 |
| subscriptions | 0 |
| notes, chat_messages, payments, analytics, transcripts, recordings, audit_logs, org tables | 0 |

> Insights: `subscriptions`, both webhook-ledger tables, `analytics_events`, `transcripts`,
> `notes`, `chat_messages`, `payments`, `recordings`, `audit_logs`, and the org tables are
> **empty**. The subscription/webhook path is therefore unproven with real billing volume.
---

## 2. Live migration history (registration order applied to production)

| version | name |
|---|---|
| 20250601000001 | init |
| 20250601000002 | hardening |
| 20250601000003 | add_org_support |
| 20250601000004 | add_subscriptions |
| 20250623000001 | classroom_domain |
| 20260728194123 | repair_recursive_org_meeting_classroom_rls |
| 20260729202851 | add_meeting_invitation_schema |
| 20260729231008 | add_accept_meeting_invitation_rpc |
| 20260816183743 | 20260626000001_add_product_line |
| 20260816184009 | 20260816190000_reconcile_legacy_subscription_schema |
| 20260816184016 | 20260806000001_product_scoped_entitlements |
| 20260816184021 | 20260806185601_phase2_product_scope_expansion_contract |
| 20260819202727 | confer_database_contract_reconciliation_v2 |

---

## 3. Local migration files (this repo, `supabase/migrations/`)

```
20250601000001_init.sql
20250601000002_hardening.sql
20250601000003_add_org_support.sql
20250601000004_add_subscriptions.sql
20250623000001_classroom_domain.sql
20260626000001_add_product_line.sql
20260729202851_add_meeting_invitation_schema.sql
20260729223000_add_accept_meeting_invitation_rpc.sql
20260806000001_product_scoped_entitlements.sql
20260806185601_phase2_product_scope_expansion_contract.sql
20260811221103_finalize_product_scoped_subscription_migration.sql
20260811222415_enforce_subscription_product_line_integrity.sql
20260822000000_reconcile_local_with_production_contract.sql
```

---

## 4. Live → Local migration matrix

| # | Local file (version) | Live version (applied) | Status |
|---|---|---|---|
| 1 | 20250601000001_init | 20250601000001 | match |
| 2 | 20250601000002_hardening | 20250601000002 | match |
| 3 | 20250601000003_add_org_support | 20250601000003 | match |
| 4 | 20250601000004_add_subscriptions | 20250601000004 | match |
| 5 | 20250623000001_classroom_domain | 20250623000001 | match |
| 6 | 20260729202851_add_meeting… | 20260729202851 | match |
| 7 | 20260626000001_add_product_line | 20260816183743 (renamed) | renamed |
| 8 | 20260729223000_add_accept_meeting... | 20260729231008 (renamed) | renamed |
| 9 | 20260806185601_phase2… | 20260816184021 (renamed) | renamed |
| 10 | 20260806000001_product_scoped… | 20260816184016 (renamed) | renamed |
| 11 | 20260811221103_finalize… | — | absent from live |
| 12 | 20260811222415_enforce… | — | absent from live |
| 13 | 20260822000000_reconcile… | 20260819202727 (v2) | superseded |

### Live-only history (not present as local files)
- `20260728194123` repair_recursive_org_meeting_classroom_rls
- `20260816184009` reconcile_legacy_subscription_schema
- `20260819202727` confer_database_contract_reconciliation_v2

---

## 5. Constraint & FK forensics (critical divergences)

### 5.1 `subscriptions`
Local finalize expects **`UNIQUE(user_id, product_line)`**; live has **`subscriptions_user_product_line_key` UNIQUE (user_id, product_line)** ✅.
**Live `subscriptions` has an extra `tier` column** (`text NOT NULL DEFAULT 'free'`) that the local
chain does not create — added by the live `confer_database_contract_reconciliation_v2`.

### 5.2 `meetings`
Live `meetings` exposes columns missing from local canonical `20250601000001_init.sql`:
`user_id`, `room_code`, `started_at`, `ended_at`, `duration_seconds`, `participant_count`,
`has_recording`, `language`, `host_id`, `room_id`, `status`. The local
`20260822000000_reconcile_local_with_production_contract.sql` adds only `user_id`, `room_code`,
`started_at`, `ended_at` — and even the FK on `user_id` diverges from live
(`meetings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`).

### 5.3 Column-level grants (meeting_invitations)
Live `meeting_invitations` grants match the local `20260729202851` migration: `authenticated`
gets `SELECT` on metadata columns + `INSERT` on `token_hash/meeting_id/role/created_by/expires_at/max_uses`
and `UPDATE(revoked_at)` only — aligned. No table-level anon/authenticated, and `token_hash` is
never SELECT/UPDATE-able by `authenticated`.

### 5.4 Webhook ledger (V1 & V2)
Live **`subscription_webhook_events` AND `subscription_webhook_events_v2`** both exist. The local
`20260822000000` migration **explicitly does NOT create `_v2`** (documented gap). Column grants show
only `postgres` + `service_role` have access to both tables — anon/authenticated are correctly
locked out. ✅ (but a local reset cannot reproduce v2).

---

## 6. Function / RPC forensics (live)
```
accept_meeting_invitation(text,text)              SECURITY DEFINER  ✓ (granted to authenticated)
handle_new_user() trigger                         SECURITY DEFINER
is_classroom_enrolled(uuid), is_classroom_owner    SECURITY DEFINER
is_meeting_owner(uuid), is_meeting_participant     SECURITY DEFINER
is_org_admin(uuid), is_org_member(uuid)            SECURITY DEFINER
process_lemon_squeezy_subscription_webhook(...)    SECURITY DEFINER  ✓ (granted to service_role)
rls_auto_enable()                                  SECURITY DEFINER (event trigger)
```
All 9 visible RPCs are present and granted correctly (authenticated / service_role).

---

## 7. Grants / Default privileges (live)

Live default ACLs on namespace `public`:
- tables: anon/authenticated/service_role `arwdDxtm` (standard Supabase)
- schemas: `rwU`
- postgres/service_role full.

Additional findings are cosmetic; grant semantics match Supabase defaults.

---

## 8. Reconciliation strategy (recommended)

The local chain is **12 canonical files + 1 reconcile**; the live DB already carries the same
object set and a **contract v2 already applied**. The clean line is:

1. **Do NOT** re-run local migrations against live. Live is ahead of local.
   - `2025060100000x`, `room_code/started_at/ended_at/user_id` already exist on live.
   - `subscriptions.tier` and `subscription_webhook_events_v2` already exist on live.
   - Re-running `20260822000000` against live would be additive but a no-op (IF NOT EXISTS guards).

2. **Local reset / branch** — a fresh `supabase db reset` would NOT reproduce the live contract:
   - Missing `subscription_webhook_events_v2`
   - Missing `meetings.duration_seconds/participant_count/has_recording/language/host_id/room_id/status`
   - Missing `profiles.email/plan_tier/billing_cycle/...` (live `profiles` has 19 columns vs local ~9)
   - `subscriptions` missing `tier`
   Fix the local reconcile migration to include the documented live gaps.

3. **Do NOT** push local reconcile blindly to live; instead **reset local** from a live-compatible seed
   once Docker is running, OR author a corrective migration `20260824000000` that adds the missing
   columns.

---

## 9. Security / operational recommendations (post-forensic)

1. `subscriptions` exposes only `authenticated SELECT own`; webhook service writes flow through
   SECURITY DEFINER RPC — verify `service_role` can still insert directly for the V2 table (grants OK).
2. Lock `anon` off the subscription tables entirely (only `service_role` + `authenticated SELECT own`).
3. `meetings` — revisit owner/participant SELECT semantics for `room_id`/`host_id` paths.
4. Vault is enabled; confirm `supabase_vault` doesn't leak.

---

## 10. Forensic deliverables produced (files in workspace root)
- `forensics_production.json` — complete live object catalog (tables, columns, RLS, policies, grants, indexes, functions, extensions, migrations, FKs, comments, row counts)
- `forensics2_production.json` — constraint/fk-resolution + full policy listing
- `forensics3_production.json` — column-level grants (3,045 rows), column comments
- `production_columns_report.json` — clean column inventory for key tables
- `openapi_production.json` — live OpenAPI spec (114 KB, 9 RPCs)
- This report: `PRODUCTION_RECONCILIATION_REPORT.md`
