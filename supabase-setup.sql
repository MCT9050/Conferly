-- ============================================
-- CONFERLY SUPABASE SETUP SQL
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. DISABLE RLS ON EXISTING TABLES
-- ============================================

-- Disable RLS so the API can access tables
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE ANALYTICS TABLE (if needed)
-- ============================================

-- Create analytics_events table (may already exist)
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  metadata JSONB,
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public access
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. ENSURE MEETINGS HAS REQUIRED COLUMNS
-- ============================================

-- Add columns if they don't exist
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS room_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 4. ENSURE PROFILES HAS REQUIRED COLUMNS
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 5. FIX POLICIES (alternative to disabling RLS)
-- ============================================

-- If you want to keep RLS enabled, create policies:
/*
-- Allow anyone to read meetings
CREATE POLICY "Public read meetings" ON meetings
FOR SELECT USING (true);

-- Allow authenticated users to insert meetings  
CREATE POLICY "Auth insert meetings" ON meetings
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow anyone to read profiles
CREATE POLICY "Public read profiles" ON profiles
FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "User update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);
*/

-- ============================================
-- 6. VERIFY
-- ============================================

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('meetings', 'profiles', 'payments', 'subscriptions', 'analytics_events');