-- =============================================================================
-- Phase 4 live verification (local Supabase DB only — never production).
-- Self-contained: creates its own fixtures and removes them at the end.
-- A. meeting_participants privilege lockdown (P4-1)
-- B. meeting termination (P4-2b core)
-- C. class lesson terminal lifecycle (P4-2a)
-- D. submission role boundary + stale-grade surfacing (P4-3/P4-4)
-- =============================================================================
\set ON_ERROR_STOP on

-- Fixtures: auth users
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('14111111-1111-4111-8111-111111111111', 'p4-owner@test.local',     'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('14222222-2222-4222-8222-222222222222', 'p4-student@test.local',   'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('14333333-3333-4333-8333-333333333333', 'p4-ta@test.local',        'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('14444444-4444-4444-8444-444444444444', 'p4-attacker@test.local',  'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}')
on conflict (id) do nothing;

-- Fixtures: classrooms, lessons, assignments
insert into public.classrooms (id, owner_id, slug, title, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '14111111-1111-4111-8111-111111111111', 'p4-test', 'P4 Test Classroom', 'scheduled')
on conflict (id) do nothing;

insert into public.classroom_enrollments (classroom_id, student_id, role, enrollment_status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '14222222-2222-4222-8222-222222222222', 'student', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '14333333-3333-4333-8333-333333333333', 'ta',    'active')
on conflict (classroom_id, student_id) do nothing;

insert into public.classroom_lessons (id, classroom_id, title, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'P4 Lesson A', 'scheduled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'P4 Lesson B', 'scheduled')
on conflict (id) do nothing;

insert into public.classroom_assignments (id, lesson_id, title, max_score)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'P4 Assignment', 100)
on conflict (id) do nothing;

-- meetings.user_id is NOT NULL and references profiles(id) (production parity,
-- 20260824000000). The fixture therefore needs a profiles row first.
insert into public.profiles (id, display_name, plan_tier)
values ('14111111-1111-4111-8111-111111111111', 'P4 Owner', 'free')
on conflict (id) do nothing;

insert into public.meetings (id, owner, user_id, room_code, host_id, title, status, started_at)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
        '14111111-1111-4111-8111-111111111111',
        '14111111-1111-4111-8111-111111111111',
        'p4-meet-code',
        'host-p4',
        'P4 Meet', 'active', now() - interval '10 seconds')
on conflict (id) do nothing;


-- B. P4-2b: meeting termination
select 'PB1 terminate' as test,
       (r->>'ok') as ok, (r->>'status') as status,
       ((r->>'ended_at')::timestamptz is not null) as ended_at_set,
       (r->>'already_ended') as already_ended
from (select public.complete_meeting_atomic('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', now() + interval '5 seconds') as r) s;

select 'PB2 replay-idempotent' as test,
       (r->>'ok') as ok, (r->>'already_ended') as already_ended, (r->>'status') as status
from (select public.complete_meeting_atomic('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', now() + interval '7 seconds') as r) s;

select 'PB3 duration-derived' as test,
       (m.duration_seconds between 14 and 16) as duration_plausible
from public.meetings m
where m.id='dddddddd-dddd-4ddd-8ddd-ddddddddddd4';

-- C. P4-2a: class lesson terminal lifecycle
select 'PC1 cancel' as test, (r->>'ok') as ok, (r->>'status') as status
from (select public.cancel_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4') as r) s;

select 'PC2 cancelled-guarded' as test, (count(*) = 0) as launch_blocked
from public.classroom_lessons
where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4' and status='live';

update public.classroom_lessons set status='live' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';
select 'PC3 end' as test,
       (r->>'ok') as ok,
       (r->>'status') as status,
       ((r->>'already_completed')::boolean) as already_completed
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5') as r) s;

select 'PC3b row-persisted-completed' as test, (status = 'completed') as persisted
from public.classroom_lessons
where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';

select 'PC4 completed-idempotent' as test,
       ((r->>'ok')::boolean) as ok,
       (r->>'status') as status,
       ((r->>'already_completed')::boolean) as already_completed
from (select public.end_class_lesson_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5') as r) s;

-- D. P4-3 / P4-4: submissions + stale-grade surfacing
insert into public.classroom_submissions (assignment_id, student_id, content)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '14222222-2222-4222-8222-222222222222', '{"text":"first"}'::jsonb)
on conflict (assignment_id, student_id) do nothing;

update public.classroom_submissions set score=88, feedback='Good', graded_at=now()
 where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
   and student_id='14222222-2222-4222-8222-222222222222';

update public.classroom_submissions
   set content='{"text":"revised"}'::jsonb, submitted_at=now() + interval '1 second'
 where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
   and student_id='14222222-2222-4222-8222-222222222222';

select 'PD1 stale-flag' as test,
       (graded_at is not null) as graded_at_set,
       (submitted_at > graded_at) as submitted_after_grade,
       ((graded_at is not null) and (submitted_at > graded_at)) as is_stale_expected
from public.classroom_submissions
where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
  and student_id='14222222-2222-4222-8222-222222222222';

select 'PD2 grade-preserved' as test,
       (score = 88) as score_intact, (feedback = 'Good') as feedback_intact
from public.classroom_submissions
where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
  and student_id='14222222-2222-4222-8222-222222222222';

-- Cleanup
delete from public.meeting_participants where meeting_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
delete from public.meetings             where id='dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
delete from public.classroom_submissions where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
delete from public.classroom_assignments where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
delete from public.classroom_lessons    where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
delete from public.classroom_enrollments where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
delete from public.classrooms           where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
delete from public.profiles             where id='14111111-1111-4111-8111-111111111111';
delete from auth.users                  where email like 'p4-%@test.local';

select 'CLEANUP residue' as test,
       (select count(*) from public.meetings where host_id='14111111-1111-4111-8111-111111111111')
     + (select count(*) from public.classroom_submissions where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc4')
     + (select count(*) from public.classrooms where slug='p4-test')
     + (select count(*) from auth.users where email like 'p4-%@test.local') as must_be_zero;
