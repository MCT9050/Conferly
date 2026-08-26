#!/usr/bin/env bash
# =============================================================================
# scripts/verify-db.sh — Phase 2..5 database verification runner.
#
# LOCAL Supabase ONLY — never touches production.
#
# Chain (fail-fast at every step):
#   1. supabase db reset --local --no-seed     (fresh DB, all migrations)
#   2. tests/phase2-db-verification.sql        (capacity/launch/uniqueness)
#   3. tests/phase3-db-verification.sql        (grading contract + privileges)
#   4. tests/phase4-db-verification.sql        (P4-1 lockdown, termination,
#                                               lesson terminal lifecycle)
#   5. tests/phase5-db-verification.sql        ('completed' legal state,
#                                               live->completed, negative
#                                               guards) — this is the suite
#       that makes the classroom_lessons CHECK-constraint regression impossible
#       to overlook: it inserts status='completed' directly (aborts under
#       ON_ERROR_STOP if the constraint regresses), introspects the constraint
#       definition, and walks live -> completed through the real RPC.
#
# Every suite itself sets \set ON_ERROR_STOP on; psql also gets -v
# ON_ERROR_STOP=1 so a failure aborts that suite and non-zero exit aborts the
# whole chain.
#
# Environment note: `supabase db reset` recreates the local database container
# AND starts some stack services itself. Any running analytics/logflare client
# then grabs a logical-replication connection to the `_supabase` database and
# the recreate step stalls forever. Merely stopping the containers is not
# enough because the reset restarts them mid-flight, so this runner REMOVES
# them (docker rm -f) before resetting and restores the stack with
# `supabase start --ignore-health-check` afterwards. Production is never
# involved: only --local and the 127.0.0.1:54322 docker container.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_CONTAINER="supabase_db_conferly"
CLIENT_CONTAINERS=(
  supabase_analytics_conferly
  supabase_vector_conferly
  supabase_auth_conferly
  supabase_kong_conferly
  supabase_inbucket_conferly
)

SUITES=(
  tests/phase2-db-verification.sql
  tests/phase3-db-verification.sql
  tests/phase4-db-verification.sql
  tests/phase5-db-verification.sql
)

psql_db() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "==> [0/6] Removing stack client containers (prevents replication-lock race)"
for c in "${CLIENT_CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
    docker rm -f "$c" >/dev/null 2>&1 && echo "    removed $c"
  fi
done

echo "==> [1/6] Resetting local database (fresh, all migrations)"
# The CLI's recreate/probe step is flaky under Docker Desktop/WSL: it can hang
# at "Recreating database..." even with the container healthy. Retry up to 3
# times, each bounded by `timeout`, and require the CLI's own success marker.
RESET_OK=0
for ATTEMPT in 1 2 3; do
  echo "    reset attempt ${ATTEMPT}/3"
  RESET_LOG="$(mktemp)"
  timeout -k 10 240 supabase db reset --local --no-seed >"$RESET_LOG" 2>&1
  RC=$?
  if [ "$RC" -eq 0 ] && grep -q 'Finished supabase db reset' "$RESET_LOG"; then
    RESET_OK=1
    tail -3 "$RESET_LOG"
    rm -f "$RESET_LOG"
    break
  fi
  echo "    reset attempt $ATTEMPT failed or hung (rc=$RC) — cleaning up and retrying" >&2
  tail -5 "$RESET_LOG" >&2 || true
  rm -f "$RESET_LOG"
  pkill -9 -f 'supabase db reset' 2>/dev/null || true
  # The reset may have re-created client containers mid-attempt; remove them again.
  for c in "${CLIENT_CONTAINERS[@]}"; do
    docker ps -a --format '{{.Names}}' | grep -qx "$c" && docker rm -f "$c" >/dev/null 2>&1
  done
  sleep 5
done
if [ "$RESET_OK" -ne 1 ]; then
  echo "FAIL: supabase db reset --local did not complete after retries" >&2
  exit 1
fi

echo "==> [2/6] Post-migration invariants (authoritative DB facts)"
# These are checked directly against the catalog so a schema/privilege
# regression cannot hide behind suite output formatting.
inv() { # inv <label> <sql-returning-t/f>
  local v; v="$(psql_db -Atc "$2" 2>&1)"
  if [ "$v" = "t" ]; then echo "    ok    $1"; else echo "    FAIL  $1 (got: $v)" >&2; FAIL_INV=1; fi
}
FAIL_INV=0
inv "phase5 migration applied" \
  "select exists(select 1 from supabase_migrations.schema_migrations where name='phase5_class_lesson_completed');"
inv "classroom_lessons CHECK admits completed" \
  "select pg_get_constraintdef(c.oid) like '%''completed''%' from pg_constraint c where c.conrelid='public.classroom_lessons'::regclass and c.conname='classroom_lessons_status_check';"
inv "classroom_lessons CHECK keeps legacy states" \
  "select pg_get_constraintdef(c.oid) like '%''scheduled''%' and pg_get_constraintdef(c.oid) like '%''live''%' and pg_get_constraintdef(c.oid) like '%''recorded''%' and pg_get_constraintdef(c.oid) like '%''cancelled''%' from pg_constraint c where c.conrelid='public.classroom_lessons'::regclass and c.conname='classroom_lessons_status_check';"
inv "lesson lifecycle RPCs present" \
  "select count(*)=3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('launch_class_lesson_atomic','cancel_class_lesson_atomic','end_class_lesson_atomic');"
inv "meeting termination RPC present" \
  "select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='complete_meeting_atomic';"
inv "P4-1 holds: no DML on meeting_participants for client roles" \
  "select not exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name='meeting_participants' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE'));"
if [ "$FAIL_INV" -ne 0 ]; then
  echo "FAIL: post-migration invariants" >&2
  exit 1
fi

FAIL=0
STEP=2
TOTAL=6   # reset + sanity + 4 suites
for suite in "${SUITES[@]}"; do
  STEP=$((STEP + 1))
  echo "==> [$STEP/$TOTAL] Running $suite"
  OUT="$(mktemp)"
  if psql_db < "$suite" >"$OUT" 2>&1; then
    echo "PASS  $suite"
  else
    echo "FAIL  $suite (psql exited non-zero)" >&2
    tail -40 "$OUT" >&2
    rm -f "$OUT"
    FAIL=1
    break
  fi
  # NOTE: suites print evidence columns that may legitimately be 'f' (e.g.
  # already_completed on a FIRST end call, or refusal reasons), so raw output
  # is not scanned for bare 'f' cells. Semantic failure modes are covered by:
  #   * ON_ERROR_STOP (structural/SQL failures abort the suite),
  #   * DO-block negative tests that RAISE on violation (T11, P1-P4f, F5-2),
  #   * the authoritative post-reset invariants in step [2/6],
  #   * each suite's trailing CLEANUP-residue must-be-zero row.
  rm -f "$OUT"
done

echo "==> Restoring local stack (supabase start recreates removed containers)"
if ! supabase start --ignore-health-check > /tmp/verify-db_start.log 2>&1; then
  echo "WARN: supabase start reported an error (non-fatal for verification); see /tmp/verify-db_start.log" >&2
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "DB VERIFICATION FAILED" >&2
  exit 1
fi

echo ""
echo "ALL DB SUITES PASSED (fresh reset -> phase2 -> phase3 -> phase4 -> phase5)"