-- 1. CLASSROOMS: Persistent teaching environments
create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  slug text unique not null,
  title text not null,
  description text,
  subject text,
  schedule jsonb default '{}',
  settings jsonb default '{}',
  enrollment_type text default 'open' check (enrollment_type in ('open', 'approval', 'invite')),
  price_cents int default 0,
  status text default 'draft' check (status in ('draft', 'scheduled', 'live', 'completed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. CLASSROOM_ENROLLMENTS: Student roster
create table if not exists classroom_enrollments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  student_id uuid references auth.users(id) on delete cascade not null,
  role text default 'student' check (role in ('instructor', 'ta', 'student', 'auditor')),
  enrollment_status text default 'pending' check (enrollment_status in ('pending', 'active', 'suspended', 'completed')),
  progress_percent int default 0 check (progress_percent between 0 and 100),
  enrolled_at timestamptz default now(),
  completed_at timestamptz,
  unique(classroom_id, student_id)
);

-- 3. CLASSROOM_LESSONS: Scheduled/live sessions within a classroom
create table if not exists classroom_lessons (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  title text not null,
  content jsonb default '{}',
  order_index int default 0,
  scheduled_at timestamptz,
  livekit_room_id text,
  recording_url text,
  status text default 'scheduled' check (status in ('scheduled', 'live', 'recorded', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. CLASSROOM_ASSIGNMENTS
create table if not exists classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references classroom_lessons(id) on delete cascade not null,
  title text not null,
  instructions text,
  due_at timestamptz,
  max_score int default 100,
  created_at timestamptz default now()
);

-- 5. CLASSROOM_SUBMISSIONS
create table if not exists classroom_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references classroom_assignments(id) on delete cascade not null,
  student_id uuid references auth.users(id) on delete cascade not null,
  content jsonb default '{}',
  score int check (score is null or score between 0 and 10000),
  submitted_at timestamptz default now(),
  graded_at timestamptz,
  unique(assignment_id, student_id)
);

-- INDEXES
create index idx_classrooms_slug on classrooms(slug);
create index idx_classrooms_owner on classrooms(owner_id);
create index idx_classrooms_status on classrooms(status);
create index idx_enrollments_classroom on classroom_enrollments(classroom_id);
create index idx_enrollments_student on classroom_enrollments(student_id);
create index idx_lessons_classroom on classroom_lessons(classroom_id);
create index idx_lessons_livekit on classroom_lessons(livekit_room_id);
create index idx_assignments_lesson on classroom_assignments(lesson_id);
create index idx_submissions_assignment on classroom_submissions(assignment_id);

-- RLS ENABLE
alter table classrooms enable row level security;
alter table classroom_enrollments enable row level security;
alter table classroom_lessons enable row level security;
alter table classroom_assignments enable row level security;
alter table classroom_submissions enable row level security;

-- RLS POLICIES: Classrooms
create policy "Owners can manage their classrooms"
  on classrooms for all
  using (owner_id = auth.uid());

create policy "Enrolled students can view active classrooms"
  on classrooms for select
  using (
    status in ('scheduled', 'live', 'completed') 
    and exists (
      select 1 from classroom_enrollments 
      where classroom_id = classrooms.id 
      and student_id = auth.uid() 
      and enrollment_status = 'active'
    )
  );

-- RLS POLICIES: Enrollments
create policy "Owners can manage enrollments"
  on classroom_enrollments for all
  using (
    exists (
      select 1 from classrooms 
      where id = classroom_enrollments.classroom_id 
      and owner_id = auth.uid()
    )
  );

create policy "Students can view their own enrollments"
  on classroom_enrollments for select
  using (student_id = auth.uid());

-- RLS POLICIES: Lessons
create policy "Owners and TAs can manage lessons"
  on classroom_lessons for all
  using (
    exists (
      select 1 from classrooms c
      left join classroom_enrollments ce on ce.classroom_id = c.id
      where c.id = classroom_lessons.classroom_id
      and (c.owner_id = auth.uid() or (ce.student_id = auth.uid() and ce.role in ('instructor', 'ta')))
    )
  );

create policy "Enrolled students can view lessons"
  on classroom_lessons for select
  using (
    exists (
      select 1 from classroom_enrollments
      where classroom_id = classroom_lessons.classroom_id
      and student_id = auth.uid()
      and enrollment_status = 'active'
    )
  );

-- RLS POLICIES: Assignments
create policy "Owners and TAs can manage assignments"
  on classroom_assignments for all
  using (
    exists (
      select 1 from classroom_lessons cl
      join classrooms c on c.id = cl.classroom_id
      left join classroom_enrollments ce on ce.classroom_id = c.id
      where cl.id = classroom_assignments.lesson_id
      and (c.owner_id = auth.uid() or (ce.student_id = auth.uid() and ce.role in ('instructor', 'ta')))
    )
  );

create policy "Enrolled students can view assignments"
  on classroom_assignments for select
  using (
    exists (
      select 1 from classroom_lessons cl
      join classroom_enrollments ce on ce.classroom_id = cl.classroom_id
      where cl.id = classroom_assignments.lesson_id
      and ce.student_id = auth.uid()
      and ce.enrollment_status = 'active'
    )
  );

-- RLS POLICIES: Submissions
create policy "Students can manage their own submissions"
  on classroom_submissions for all
  using (student_id = auth.uid());

create policy "Owners and TAs can view grade submissions"
  on classroom_submissions for select
  using (
    exists (
      select 1 from classroom_assignments ca
      join classroom_lessons cl on cl.id = ca.lesson_id
      join classrooms c on c.id = cl.classroom_id
      left join classroom_enrollments ce on ce.classroom_id = c.id
      where ca.id = classroom_submissions.assignment_id
      and (c.owner_id = auth.uid() or (ce.student_id = auth.uid() and ce.role in ('instructor', 'ta')))
    )
  );

-- No legacy classroom data to migrate. Greenfield classroom domain.