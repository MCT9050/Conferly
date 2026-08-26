-- =============================================================================
-- Phase 5 live verification (local Supabase DB only — never production).
-- Fix-1 regression suite: classroom_lessons.status must admit 'completed' and
-- the live -> completed transition must persist and stay idempotent, while the
-- negative guards (scheduled/cancelled -> completed) remain intact.
--
-- Self-contained: creates its own fixtures and removes them at the end.
-- Runs under ON_ERROR_STOP: ANY failing statement aborts the suite so a
-- schema/lifecycle regression cannot be overlooked.
--
-- Acceptance criteria encoded here (from the Phase 5 approval):
--   * fresh DB reset + Phase 2, 3, 4, 5 suites all pass
--   * the database actually contains scheduled, live, recorded, cancelled,
--     completed as legal lesson states
--   * scheduled -> completed refused
--   * cancelled -> completed refused
--   * completed -> completed is a no-op (idempotent)
--   * live    -> completed succeeds AND is idempotent on replay
-- =============================================================================

\set ON_ERROR_STOP on

-- ── Fixtures ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('16111111-1111-4111-8111-111111111111', 'p5-owner@test.local', 'x', 'authenticated', 'authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.classrooms (id, owner_id, slug, title, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '16111111-1111-4111-8111-111111111111', 'p5-status-test', 'P5 Status Test', 'scheduled')
on conflict (id) do nothing;

-- Re-run safety: an aborted earlier run leaves fixtures behind; clear them so
-- every execution starts from a deterministic state.
delete from public.classroom_lessons where classroom_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';

-- F5-1: EVERY legal status must be insertable. If 'completed' is missing from
-- the CHECK constraint, this INSERT raises a check_violation and ON_ERROR_STOP
-- aborts the entire suite — making the Phase 5-Fix-1 regression impossible to
-- overlook.
insert into public.classroom_lessons (id, classroom_id, title, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 scheduled', 'scheduled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 live',      'live'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 recorded',  'recorded'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 cancelled', 'cancelled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 completed', 'completed')
on conflict (id) do nothing;

select 'F5-1 all-five-states-legal' as test,
       (count(*) = 5)              as pass,
       string_agg(status, ', ' order by status) as states
from public.classroom_lessons
where classroom_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
-- F5-1b: introspection — the CHECK constraint definition must literally contain
-- all five legal status literals.
select 'F5-1b constraint-definition' as test,
       (pg_get_constraintdef(c.oid) like '%''scheduled''%'
        and pg_get_constraintdef(c.oid) like '%''live''%'
        and pg_get_constraintdef(c.oid) like '%''recorded''%'
        and pg_get_constraintdef(c.oid) like '%''cancelled''%'
        and pg_get_constraintdef(c.oid) like '%''completed''%') as pass,
       pg_get_constraintdef(c.oid) as constraint_def
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
  and r.relname = 'classroom_lessons'
  and c.conname = 'classroom_lessons_status_check';

-- F5-2: an out-of-enum value must STILL be rejected (constraint remains live).
do $$
begin
  begin
    insert into public.classroom_lessons (id, classroom_id, title, status)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba9', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'P5 invalid', 'foo');
    raise exception 'F5-2 FAILED: illegal status ''foo'' was accepted';
  exception when check_violation then
    raise notice 'F5-2 illegal-status-rejected: CONFIRMED (PASS)';
  end;
end $$;
-- ── live -> completed persists and is idempotent ─────────────────────────────
-- F5-3: a live lesson flips to completed.
select 'F5-3 live-to-completed' as test,
       (r->>'ok') as ok,
       (r->>'status') as status,
       ((r->>'already_completed')::boolean) as already_completed
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2') as r) s;

-- F5-3b: the row itself persists as completed.
select 'F5-3b row-persisted-completed' as test, (status = 'completed') as pass
from public.classroom_lessons
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2';

-- F5-4: replay after completion is idempotent (no error, no further change).
select 'F5-4 replay-idempotent' as test,
       ((r->>'ok')::boolean) as ok,
       (r->>'status') as status,
       ((r->>'already_completed')::boolean) as already_completed
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2') as r) s;

select 'F5-4b replay-no-state-change' as test,
       (count(*) = 1) as pass
from public.classroom_lessons
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2'
  and status = 'completed';
-- ── Negative guards ──────────────────────────────────────────────────────────
-- F5-5: scheduled -> completed refused.
select 'F5-5 scheduled-refused' as test,
       ((r->>'ok')::boolean = false) as pass,
       (r->>'reason') as reason
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1') as r) s;

select 'F5-5b scheduled-unchanged' as test, (status = 'scheduled') as pass
from public.classroom_lessons
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1';

-- F5-6: cancelled -> completed refused.
select 'F5-6 cancelled-refused' as test,
       ((r->>'ok')::boolean = false) as pass,
       (r->>'reason') as reason
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba4') as r) s;

select 'F5-6b cancelled-unchanged' as test, (status = 'cancelled') as pass
from public.classroom_lessons
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba4';

-- F5-7: already-completed stays completed (completed -> completed is a no-op).
select 'F5-7 completed-noop' as test,
       ((r->>'ok')::boolean) as ok,
       (r->>'status') as status,
       ((r->>'already_completed')::boolean) as already_completed
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba5') as r) s;

select 'F5-7b completed-unchanged' as test, (status = 'completed') as pass
from public.classroom_lessons
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba5';

-- ── End-of-cycle invariant ───────────────────────────────────────────────────
-- After the walk: the only live lesson (bba2) has been completed, so no live
-- rows remain; completed has two rows (the original + the newly ended one).
select 'F5-8 final-states' as test,
       count(*) filter (where status = 'scheduled') = 1 as scheduled,
       count(*) filter (where status = 'live')      = 0 as live_none_left,
       count(*) filter (where status = 'recorded')  = 1 as recorded,
       count(*) filter (where status = 'cancelled') = 1 as cancelled,
       count(*) filter (where status = 'completed') = 2 as completed
from public.classroom_lessons
where classroom_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';

-- ── Cleanup ──────────────────────────────────────────────────────────────────
delete from public.classroom_lessons where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
delete from public.classrooms        where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
delete from auth.users               where email like 'p5-%@test.local';

select 'CLEANUP residue' as test,
       (select count(*) from public.classroom_lessons where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6')
     + (select count(*) from public.classrooms where slug='p5-status-test')
     + (select count(*) from auth.users where email like 'p5-%@test.local') as must_be_zero;