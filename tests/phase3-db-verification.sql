-- =============================================================================
-- Phase 3 live verification (local Supabase DB only — never production).
-- Exercises: teacher grading flow database contract on classroom_submissions.
--   P0  feedback column + length CHECK exist; legacy constraints intact
--   P1  score range CHECK still enforced
--   P2  UNIQUE(assignment_id, student_id) still enforced
--   P3  feedback length CHECK enforced (5000 chars)
--   P4  client roles CANNOT write grading columns / delete / truncate;
--       authenticated may still write content only
--   P5  service-role-equivalent grading works; student content untouched
--   P6  RLS policies unchanged vs baseline
-- Self-contained: creates its own fixtures and removes them at the end.
-- =============================================================================

\set ON_ERROR_STOP on

-- ── Fixtures ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('13111111-1111-4111-8111-111111111111', 'p3-owner@test.local',   'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}'),
  ('13222222-2222-4222-8222-222222222222', 'p3-student@test.local', 'x', 'authenticated','authenticated', now(), '00000000-0000-0000-0000-000000000000', now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.classrooms (id, owner_id, slug, title, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '13111111-1111-4111-8111-111111111111', 'p3-grade-test', 'P3 Grading Test', 'scheduled')
on conflict (id) do nothing;

insert into public.classroom_lessons (id, classroom_id, title, status)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'P3 Lesson', 'scheduled')
on conflict (id) do nothing;

insert into public.classroom_assignments (id, lesson_id, title, max_score)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'P3 Assignment', 100)
on conflict (id) do nothing;

delete from public.classroom_submissions where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
insert into public.classroom_submissions (assignment_id, student_id, content)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '13222222-2222-4222-8222-222222222222', '{"text":"P3 answer"}'::jsonb);

select 'FIXTURE submission inserted' as test,
       (count(*) = 1) as pass
from public.classroom_submissions
where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

-- ── P0: structure — column + constraints present ─────────────────────────────
select 'P0 feedback-column'    as test,
       (count(*) = 1)          as pass
from pg_attribute
where attrelid = 'public.classroom_submissions'::regclass
  and attname = 'feedback' and not attisdropped;

select 'P0 constraints-intact' as test,
       (count(*) = 6)          as pass,
       string_agg(conname, ', ') as names
from pg_constraint
where conrelid = 'public.classroom_submissions'::regclass
  and conname in (
    'classroom_submissions_score_check',
    'classroom_submissions_assignment_id_student_id_key',
    'classroom_submissions_assignment_id_fkey',
    'classroom_submissions_student_id_fkey',
    'classroom_submissions_pkey',
    'classroom_submissions_feedback_len'
  );

-- ── P1: score CHECK still enforced ───────────────────────────────────────────
do $$
begin
  begin
    update public.classroom_submissions set score = 10001
      where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    raise exception 'P1 FAILED: out-of-range score accepted';
  exception when check_violation then
    raise notice 'P1 score-range-check: REJECTED by constraint (PASS)';
  end;
end $$;

-- ── P2: UNIQUE(assignment_id, student_id) still enforced ────────────────────
do $$
begin
  begin
    insert into public.classroom_submissions (assignment_id, student_id, content)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
            '13222222-2222-4222-8222-222222222222', '{}'::jsonb);
    raise exception 'P2 FAILED: duplicate submission accepted';
  exception when unique_violation then
    raise notice 'P2 unique-submission-per-student: REJECTED by constraint (PASS)';
  end;
end $$;

-- ── P3: feedback length CHECK enforced ──────────────────────────────────────
do $$
begin
  begin
    update public.classroom_submissions set feedback = repeat('x', 5001)
      where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    raise exception 'P3 FAILED: oversized feedback accepted';
  exception when check_violation then
    raise notice 'P3 feedback-length-check: REJECTED by constraint (PASS)';
  end;
end $$;

update public.classroom_submissions set feedback = repeat('x', 5000)
  where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
select 'P3b feedback-at-limit-ok' as test,
       (char_length(feedback) = 5000) as pass
from public.classroom_submissions where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

-- ── P4: client-role privileges are tightened ────────────────────────────────
do $$
begin
  set role authenticated;
  begin
    begin
      update public.classroom_submissions set score = 95 where false;
      raise exception 'P4a FAILED: authenticated could UPDATE score';
    exception when insufficient_privilege then
      raise notice 'P4a authenticated-update-score: DENIED (PASS)';
    end;

    begin
      insert into public.classroom_submissions (assignment_id, student_id, score)
      values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
              gen_random_uuid(), 50);
      raise exception 'P4b FAILED: authenticated could INSERT score';
    exception when insufficient_privilege then
      raise notice 'P4b authenticated-insert-score: DENIED (PASS)';
    end;

    begin
      delete from public.classroom_submissions where false;
      raise exception 'P4c FAILED: authenticated could DELETE submissions';
    exception when insufficient_privilege then
      raise notice 'P4c authenticated-delete-submission: DENIED (PASS)';
    end;

    begin
      truncate public.classroom_submissions;
      raise exception 'P4d FAILED: authenticated could TRUNCATE submissions';
    exception when insufficient_privilege then
      raise notice 'P4d authenticated-truncate: DENIED (PASS)';
    end;

    -- content-only writes remain possible for the student's own rows (RLS
    -- governs which rows); no privilege error expected here.
    begin
      update public.classroom_submissions set content = '{"text":"rev"}'::jsonb
        where false;
      raise notice 'P4e authenticated-update-content: ALLOWED (PASS)';
    exception when insufficient_privilege then
      raise exception 'P4e FAILED: authenticated denied content UPDATE';
    end;
  end;
  reset role;
end $$;

do $$
begin
  set role anon;
  begin
    insert into public.classroom_submissions (assignment_id, student_id, content)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', gen_random_uuid(), '{}'::jsonb);
    raise exception 'P4f FAILED: anon could INSERT submissions';
  exception when insufficient_privilege then
    raise notice 'P4f anon-insert-submission: DENIED (PASS)';
  end;
  reset role;
end $$;

-- ── P5: service-role-equivalent grading round-trip ──────────────────────────
update public.classroom_submissions
   set score = 95, feedback = 'Nice work', graded_at = now()
 where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
returning 'P5a grade-write' as test, score, char_length(feedback) as feedback_len,
          (graded_at is not null) as graded_stamped,
          (content->>'text' = 'P3 answer') as content_untouched;

update public.classroom_submissions
   set score = null, graded_at = null
 where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
returning 'P5b ungrade' as test, (score is null) as score_cleared,
          (graded_at is null) as graded_cleared,
          (feedback = 'Nice work') as feedback_preserved;

update public.classroom_submissions set feedback = null
 where assignment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
returning 'P5c clear-feedback' as test, (feedback is null) as feedback_cleared;

-- ── P6: RLS policies unchanged vs baseline ──────────────────────────────────
select 'P6 rls-policies' as test,
       (count(*) = 2) as pass,
       string_agg(policyname || '(' || cmd || ')', ' | ') as policies
from pg_policies
where schemaname = 'public' and tablename = 'classroom_submissions';

-- ── P7: effective grant inventory snapshot (evidence) ───────────────────────
select grantee, string_agg(privilege_type, ',' order by privilege_type) as table_grants
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'classroom_submissions'
group by grantee order by grantee;

-- ── Cleanup ──────────────────────────────────────────────────────────────────
delete from public.classroom_submissions where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
delete from public.classroom_assignments where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
delete from public.classroom_lessons   where classroom_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
delete from public.classrooms          where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
delete from auth.users                 where email like 'p3-%@test.local';

select 'CLEANUP residue' as test,
       (select count(*) from public.classroom_submissions where assignment_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3')
     + (select count(*) from public.classroom_assignments where id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3')
     + (select count(*) from public.classrooms where slug='p3-grade-test')
     + (select count(*) from auth.users where email like 'p3-%@test.local') as must_be_zero;
