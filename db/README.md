DB migration and RLS guide
=========================

Canonical migration chain
-------------------------

The authoritative Supabase migration chain for this project is
`supabase/migrations/`. Use `supabase db push` / `supabase migration up` against
that directory for clean installations and forward-only upgrades.

The SQL files under `db/migrations/` and the top-level `db/remediation_phase1.sql`
are legacy/manual migration artifacts retained for audit history. Do not treat
them as the canonical migration chain for new environments, and do not apply them
in addition to `supabase/migrations/` unless a dated operational runbook
explicitly says to do so.

For product-scoped subscriptions, the canonical final uniqueness boundary is
`UNIQUE(user_id, product_line)`. Historical migrations created a legacy
user-only uniqueness constraint on `subscriptions.user_id`; the forward-only
Supabase migration chain removes that obsolete constraint so one user can hold a
Meet subscription and a Class subscription at the same time.


This folder contains SQL migrations and guidance for applying a production-grade
Postgres schema on Supabase. It is intentionally minimal and focuses on tables
and Row Level Security (RLS) policies for user profiles, meetings, participants,
presentations, slides, recordings, and audit logs.

Applying the migration
----------------------

Recommended options to apply the SQL:

- Using the Supabase SQL editor: open your project in the Supabase dashboard
  and paste the contents of `db/migrations/001_init.sql` into the SQL editor.

- Using the Supabase CLI (recommended for CI):

  1. Install and login: `npm install -g supabase` then `supabase login`
  2. Point the CLI at your project/database and run the SQL migration.
     For CI, prefer `supabase db push` when using migration tooling, or use:

  ```bash
  psql "$SUPABASE_DB_URL" -f db/migrations/001_init.sql
  ```

  Where `SUPABASE_DB_URL` is your full DATABASE_URL (use service role key when
  running server-side migrations that require elevated privileges).

Important notes for production
------------------------------

- The SQL uses `auth.uid()` to enforce user-scoped policies; the application must
  connect as authenticated users (client-side) or as the service role (server-side)
  depending on the operation.
- For writes that must bypass RLS (e.g., initial imports, audit seeds), use the
  Supabase service role key — treat that key as a secret and do not expose it to
  browsers or client apps.
- `audit_logs` is configured to block SELECT for regular users; read access to
  logs should be performed by server-side tooling using the service role.
- Add backups and regular migration testing in CI; test RLS policies with
  representative user accounts before enabling in production.

Next steps and optional improvements
-----------------------------------

- Add more fine-grained roles / enums (e.g., `participant_role` as a Postgres
  enum) and validate allowed transitions server-side.
- Add trigger functions to maintain `updated_at` timestamps and to emit events
  to a change stream (if you use replication or streaming).
- Create separate migration files per change and wire `supabase` or `sqitch` style
  tooling to manage them in CI (recommended for multi-developer teams).
