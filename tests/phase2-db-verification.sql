-- =============================================================================
-- Phase 2 live verification (local Supabase DB only — never production).
-- Exercises: capacity RPC, lesson-launch atomicity, enrollment uniqueness.
-- Self-contained: creates its own fixtures and removes them at the end.
-- =============================================================================

\set ON_ERROR_STOP on

-- ── Fixtures ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'p2-owner@test.local',  'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'p2-s1@test.local',     'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'p2-s2@test.local',     'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'p2-extra@test.local',  'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('55555555-5555-4555-8555-555555555555', 'p2-ta@test.local',     'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.classrooms (id, owner_id, slug, title, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'p2-cap-test', 'P2 Capacity Test', 'scheduled')
on conflict (id) do nothing;

insert into public.subscriptions (user_id, product_line, plan, participant_cap, status)
values ('11111111-1111-4111-8111-111111111111', 'class', 'class_10', 10, 'active')
on conflict (user_id, product_line) do update set status='active', plan='class_10', participant_cap=10;

insert into public.classroom_lessons (id, classroom_id, title, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'P2 Launch Scheduled', 'scheduled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'P2 Launch Cancelled', 'cancelled')
on conflict (id) do nothing;

-- ── TEST 1: capacity — under limit allowed ──────────────────────────────────
delete from public.classroom_enrollments where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222','student','active');
select 'T1 under-limit'   as test,
       result->>'allowed' as allowed,
       result->'counts'->>'student_count' as students
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','student') as result) s;

-- ── TEST 2: at limit (10 of class_10) still allows the 10th holder ──────────
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select ('c0000000-0000-4000-8000-00000000000'||n::text)::uuid,
       'p2-fill'||n||'@test.local','x','authenticated','authenticated',now(),
       '00000000-0000-0000-0000-000000000000',now(),now(),'{}','{}'
from generate_series(1,9) n
on conflict (id) do nothing;
insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       ('c0000000-0000-4000-8000-00000000000'||n::text)::uuid,
       'student','active'
from generate_series(1,9) n
on conflict do nothing;
select 'T2 at-limit-holder' as test,
       result->>'allowed' as allowed,
       result->'counts'->>'student_count' as students
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','student') as result) s;

-- ── TEST 3: over limit rejects ──────────────────────────────────────────────
insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','44444444-4444-4444-8444-444444444444','student','active')
on conflict do nothing;
select 'T3 over-limit'    as test,
       result->>'allowed' as allowed,
       result->>'reason'  as reason
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','student') as result) s;

-- ── TEST 4: teacher cap (owner + ta ok; + instructor rejected) ──────────────
insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','55555555-5555-4555-8555-555555555555','ta','active')
on conflict do nothing;
select 'T4a second-teacher-ok' as test, result->>'allowed' as allowed
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','ta') as result) s;

-- T4b mirrors the real flow: the third teacher HAS an enrollment row (granted
-- by the teacher), then is rejected at token time by the cap.
insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','44444444-4444-4444-8444-444444444444','instructor','active')
on conflict (classroom_id, student_id) do update set role='instructor';
select 'T4b third-teacher-rejected' as test, result->>'allowed' as allowed, result->>'reason' as reason
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','instructor') as result) s;

-- ── TEST 5: no subscription rejects ─────────────────────────────────────────
update public.subscriptions set status='expired'
 where user_id='11111111-1111-4111-8111-111111111111' and product_line='class';
select 'T5 no-subscription' as test, result->>'allowed' as allowed
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','student') as result) s;
update public.subscriptions set status='active'
 where user_id='11111111-1111-4111-8111-111111111111' and product_line='class';

-- ── TEST 6: custom plan uses participant_cap ────────────────────────────────
update public.subscriptions set plan='class_custom', participant_cap=3
 where user_id='11111111-1111-4111-8111-111111111111' and product_line='class';
select 'T6 custom-over-cap' as test, result->>'allowed' as allowed
from (select public.enforce_classroom_capacity_atomic(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111','student') as result) s;
update public.subscriptions set plan='class_10', participant_cap=10
 where user_id='11111111-1111-4111-8111-111111111111' and product_line='class';

-- ── TEST 7: launch scheduled → live ─────────────────────────────────────────
select 'T7 launch-scheduled' as test,
       result->>'ok' as ok,
       result->>'status' as status,
       result->>'livekit_room_id' as room
from (select public.launch_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') as result) s;

-- ── TEST 8: already-live is idempotent, same room id ────────────────────────
select 'T8 already-live' as test,
       result->>'ok' as ok,
       result->>'already_live' as already_live,
       result->>'livekit_room_id' = 'class-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' as room_stable
from (select public.launch_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') as result) s;

-- ── TEST 9: cancelled lesson refuses to launch ──────────────────────────────
select 'T9 cancelled' as test, result->>'ok' as ok, result->>'reason' as reason
from (select public.launch_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') as result) s;

-- ── TEST 10: unknown lesson id ───────────────────────────────────────────────
select 'T10 not-found' as test, result->>'ok' as ok, result->>'reason' as reason
from (select public.launch_class_lesson_atomic('dddddddd-dddd-4ddd-8ddd-dddddddddddd') as result) s;

-- ── TEST 11: enrollment UNIQUE constraint ───────────────────────────────────
do $$
begin
  begin
    insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222','student','active');
    raise exception 'T11 FAILED: duplicate enrollment was accepted';
  exception when unique_violation then
    raise notice 'T11 duplicate-enrollment: REJECTED by unique constraint (PASS)';
  end;
end $$;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
delete from public.classroom_lessons where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
delete from public.classroom_enrollments where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
delete from public.classrooms where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
delete from public.subscriptions where user_id='11111111-1111-4111-8111-111111111111';
delete from auth.users where email like 'p2-%@test.local';
delete from auth.users where id in (
  select ('c0000000-0000-4000-8000-00000000000'||n::text)::uuid from generate_series(1,9) n);
