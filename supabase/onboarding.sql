-- Conferly Onboarding Schema Extension
-- Run in Supabase Dashboard → SQL Editor
-- Project: neymqmyzmsberwlowlpw

alter table public.profiles
  add column if not exists user_type text check (user_type in ('individual','organization')) default 'individual';

alter table public.profiles
  add column if not exists organization_name text;

alter table public.profiles
  add column if not exists organization_size int;

alter table public.profiles
  add column if not exists organization_industry text;

alter table public.profiles
  add column if not exists onboarding_complete boolean default false;
