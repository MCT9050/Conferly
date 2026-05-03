-- Conferly Database Schema for Supabase
-- Project ID: neymqmyzmsberwlowlpw
-- Run this in Supabase Dashboard → SQL Editor

-- ═══ USER PROFILES ═══
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text not null default 'User',
  avatar_url text,
  plan_tier text not null default 'free',
  billing_cycle text default 'monthly',
  plan_period_end timestamptz,
  meetings_this_month int not null default 0,
  meetings_month int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ═══ MEETINGS ═══
create table if not exists public.meetings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  room_code text not null,
  title text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int default 0,
  participant_count int default 1,
  has_recording boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_meetings_user_id on public.meetings(user_id);
create index if not exists idx_meetings_room_code on public.meetings(room_code);

-- ═══ TRANSCRIPTS ═══
create table if not exists public.transcripts (
  id uuid default gen_random_uuid() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_transcripts_meeting on public.transcripts(meeting_id);

-- ═══ MEETING NOTES ═══
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_meeting on public.notes(meeting_id);

-- ═══ CHAT HISTORY ═══
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ═══ PAYMENTS ═══
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_tier text not null,
  billing_cycle text not null,
  amount_zar numeric(10,2) not null,
  currency text default 'ZAR',
  status text default 'completed',
  peach_transaction_id text,
  created_at timestamptz default now()
);

create index if not exists idx_payments_user on public.payments(user_id);

-- ═══ ROW LEVEL SECURITY ═══
alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.transcripts enable row level security;
alter table public.notes enable row level security;
alter table public.chat_messages enable row level security;
alter table public.payments enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Meetings: users can CRUD their own meetings
create policy "Users can view own meetings" on public.meetings for select using (auth.uid() = user_id);
create policy "Users can create meetings" on public.meetings for insert with check (auth.uid() = user_id);
create policy "Users can update own meetings" on public.meetings for update using (auth.uid() = user_id);
create policy "Users can delete own meetings" on public.meetings for delete using (auth.uid() = user_id);

-- Transcripts: users can CRUD their own
create policy "Users can view own transcripts" on public.transcripts for select using (auth.uid() = user_id);
create policy "Users can create transcripts" on public.transcripts for insert with check (auth.uid() = user_id);

-- Notes: users can CRUD their own
create policy "Users can view own notes" on public.notes for select using (auth.uid() = user_id);
create policy "Users can create notes" on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes" on public.notes for update using (auth.uid() = user_id);

-- Chat: users can CRUD their own
create policy "Users can view own chat" on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can create chat" on public.chat_messages for insert with check (auth.uid() = user_id);

-- Payments: users can view their own payments
create policy "Users can view own payments" on public.payments for select using (auth.uid() = user_id);
create policy "Users can create payments" on public.payments for insert with check (auth.uid() = user_id);
