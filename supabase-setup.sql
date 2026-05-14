-- ============================================
-- CONFERLY SUPABASE SETUP SQL
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. DISABLE RLS ON EXISTING TABLES
-- ============================================

ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  metadata JSONB,
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. MEETINGS TABLE (update to allow null host_id)
-- ============================================

-- Make host_id nullable for unauthenticated meeting creation
ALTER TABLE meetings ALTER COLUMN host_id DROP NOT NULL;

-- Or ensure these columns exist:
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS room_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 4. PROFILES TABLE
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 5. SUBSCRIPTIONS TABLE
-- ============================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- ============================================
-- 6. PAYMENTS TABLE
-- ============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- ============================================
-- 7. VERIFY
-- ============================================

SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('meetings', 'profiles', 'payments', 'subscriptions', 'analytics_events');