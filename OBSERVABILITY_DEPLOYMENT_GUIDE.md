# Full-Stack Authentication Observability System
## Implementation Guide + Operational Deployment Steps

**Platform:** Conferly (React + Supabase + Cloudflare)  
**Version:** 1.0.0  
**Date:** 2025-05-07

---

# PART 1: SYSTEM IMPLEMENTATION (ENGINEERING DESIGN)

---

## 1.1 Runtime Interception Layer

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RUNTIME INTERCEPTION LAYER               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   UI Layer  │ →  │  Interceptor │ →  │   Network   │  │
│  │            │    │   Hook     │    │   Layer    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             ↓                              │
│                    ┌──────────────────────────┐        │
│                    │   Event Store          │        │
│                    │  (AUTH_EVENT_STORE)    │        │
│                    └──────────────────────────┘        │
│                             ↓                              │
│         ┌───────────────────────────────────────┐        │
│         │     Full-Stack Trace Buffer       │        │
│         │  (AUTH_TRACE_BUFFER)          │        │
│         └───────────────────────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Interception Components

| Component | File | Purpose |
|-----------|------|----------|
| Auth Tracing | `src/lib/authTracer.ts` | Core tracing utility (log, state, session, supabase events) |
| Event Sourcing | `src/lib/authEvents.ts` | Every auth action = immutable event |
| Full-Stack Truth | `src/lib/authTruth.ts` | Network/Supabase/Backend correlation |

### Implementation Files

```
src/
├── lib/
│   ├── authTracer.ts      # Basic event logging
│   ├── authEvents.ts   # Event sourcing model
│   ├── authTruth.ts   # Full-stack correlation
│   └── supabase.ts   # Supabase client
├── hooks/
│   └── useAuth.ts     # Instrumented auth hook
└── components/
    └── AuthPage.tsx  # Login/register UI
```

---

## 1.2 Full Stack Trace Model

### Event Schema

```typescript
// authTracer.ts - Basic event
{
  event: string,           // "login:start"
  timestamp: number,    // performance.now()
  time: string,       // "18:26:42.123"
  data?: object,      // Sanitized data
  category: 'auth' | 'supabase' | 'state' | 'session' | 'race' | 'error'
}

// authEvents.ts - Event sourced
{
  eventId: string,       // uuid
  type: string,       // "auth:login_attempt"
  timestamp: number,
  sessionId: string,
  userId?: string,
  email?: string,
  success: boolean,
  metadata: {
    source: 'login_form' | 'signup_form' | 'session_restore',
    attemptNumber: number,
    error?: string,
    provider?: 'supabase' | 'backend' | 'offline',
    duration?: number
  }
}

// authTruth.ts - Full stack
{
  eventId: string,
  requestId: string,      // Correlation ID
  correlationId: string,
  layer: 'UI' | 'NETWORK' | 'SUPABASE' | 'BACKEND' | 'STATE',
  type: string,
  timestamp: number,
  duration?: number,
  timing: {
    frontend: number,
    network: number,
    backend_inferred: number,
    total: number
  }
}
```

### Request Correlation System

Every auth request generates:
- `requestId`: `req_{timestamp}_{random}` - unique per request
- `correlationId`: Session ID - traces entire session
- `sessionId`: Browser session identifier

---

## 1.3 Observability Engine

### Event Store Structure

```typescript
// In-memory event stores
TRACE_BUFFER: AuthTraceEntry[]        // From authTracer.ts
EVENT_STORE: AuthEvent[]              // From authEvents.ts
AUTH_TRUTH_EVENTS: (Network | Supabase | Pipeline)[]  // From authTruth.ts
```

### Window Exports for Debugging

```javascript
// authTracer.ts exports
window.AUTH_TRACE_BUFFER    // Full trace array
window.getAuthTrace()   // Get trace sorted by time
window.exportAuthTrace()

// authEvents.ts exports  
window.AUTH_EVENT_STORE
window.generateAuthReport()
window.detectPatterns()

// authTruth.ts exports
window.generateFullStackTrace()
window.classifyFailureMode()
```

### Replay System

```javascript
// Get full session replay
window.generateAuthReport()

// Output format:
/*
=== AUTH SESSION REPLAY REPORT ===
SESSION: session_1746700000123_abc

EVENT SEQUENCE:
[0ms] auth:login_attempt (attempt 1)
[1200ms] auth:login_failure - Invalid credentials
[2500ms] auth:login_attempt (attempt 2)
[3100ms] auth:login_success
*/
```

---

## 1.4 Runtime Guarantees

### Race Condition Detection Rules

| Pattern | Detection | Severity |
|---------|----------|---------|
| 5+ failures in 60s | `detectBruteForce()` | HIGH |
| <100ms between attempts | `detectRapidRetries()` | MEDIUM |
| Overlapping requests | `detectRaceConditions()` | MEDIUM |
| Stale session overwrite | Manual check | LOW |

### Consistency Assumptions

```
SYSTEM IS: EVENTUALLY CONSISTENT
  - Signup: auth.users + profiles (within seconds)
  - Profile update: Supabase (immediate when online)
  - Meeting create: IndexedDB + Supabase (dual-write)
  - Offline: localStorage only
```

### Trust Boundaries

| Layer | Trust Level | Can Spoof |
|-------|-----------|-----------|
| Browser/JS | UNTRUSTED | localStorage values, form input |
| Client Validation | UNTRUSTED | Form bypass attempts |
| Supabase Auth | TRUSTED | Nothing |
| PostgreSQL + RLS | TRUSTED | Nothing |

---

# PART 2: OPERATIONAL STEPS (USER ACTIONS)

---

## 2.1 SUPABASE CONFIGURATION

### Step 1: Access Supabase Dashboard

1. Navigate to: https://supabase.com/dashboard
2. Select project: `neymqmyzmsberwlowlpw`
3. Go to **Authentication** → **Settings**

### Step 2: Configure Auth Settings

**Settings to verify/enable:**

| Setting | Recommended Value | Action |
|---------|--------------|--------|
| Site URL | `https://www.conferly.site` | Verify |
| Redirect URLs | `https://www.conferly.site/*` | Add if missing |
| Enable email signup | ON | Verify ON |
| Enable anonymous sign-ins | OFF | Keep OFF |
| Confirm email | (your preference) | Configure |

### Step 3: Configure Session Settings

| Setting | Recommended Value |
|---------|--------------|
| Session timeout | 3600 (1 hour) |
| Refresh token rotation | ON |
| Enable persistent sessions | ON (user choice) |

### Step 4: Email Templates (Optional)

Navigate to **Authentication** → **Email Templates**:

- Verify **Confirm signup** template is configured
- Verify **Reset password** template is configured
- Verify **Change email** template is configured

### Step 5: Configure Rate Limiting

**IMPORTANT:** Cloudflare handles rate limiting, not Supabase.

1. Go to: https://dash.cloudflare.com
2. Navigate to your domain settings
3. Configure **WAF** rules for rate limiting:
   - Threshold: 10 requests per minute
   - Action: Challenge or Block

---

## 2.2 DATABASE CHANGES

### Step 1: Create Profiles Table

Run this SQL in **SQL Editor** in Supabase Dashboard:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  plan_tier TEXT DEFAULT 'free',
  user_type TEXT DEFAULT 'individual',
  organization_name TEXT,
  organization_size INTEGER,
  organization_industry TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Create policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
```

### Step 2: Create Auth Events Table (Optional - for production logging)

```sql
-- Create auth_events table for production logging
CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  success BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own events
CREATE POLICY "Users can view own auth events"
ON auth_events FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);
```

### Step 3: Verify RLS Policies

In Supabase Dashboard → **SQL Editor**:

```sql
-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'auth_events');
```

Expected results:
- `profiles`: 3 policies (SELECT, INSERT, UPDATE)
- `auth_events`: 1 policy (SELECT)

---

## 2.3 FRONTEND IMPLEMENTATION STEPS

### Step 1: Install Dependencies

No additional npm packages required. All tracing uses existing dependencies.

### Step 2: Verify Tracing Files Exist

Check these files are in your project:

```bash
ls -la src/lib/authTracer.ts
ls -la src/lib/authEvents.ts
ls -la src/lib/authTruth.ts
```

If files don't exist, they were already implemented and deployed.

### Step 3: Verify useAuth Hook is Instrumented

Check `src/hooks/useAuth.ts` contains tracing calls:

```bash
grep -n "emitLoginAttempt\|emitLoginSuccess\|emitLoginFailure" src/hooks/useAuth.ts
```

Expected output should show multiple occurrences of each function call.

### Step 4: Verify Supabase Client Configuration

Check `src/lib/supabase.ts`:

```typescript
// Should have these settings:
{
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'conferly_supabase_auth'
  }
}
```

---

## 2.4 ENVIRONMENT SETUP

### Required Environment Variables

Create `.env` file in project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://neymqmyzmsberwlowlpw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Production flags (optional)
VITE_PROD=false
VITE_MODE=development
```

**IMPORTANT:** Never commit `.env` to version control.

### Supabase Keys Usage

| Key | Usage |
|-----|-------|
| `SUPABASE_URL` | Frontend (safe to expose) |
| `SUPABASE_ANON_KEY` | Frontend (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend ONLY (NEVER expose) |

---

## 2.5 TESTING & VERIFICATION (USER ACTIONS)

### Test 1: Verify Login Flow Logging

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Navigate to Conferly login page
4. Enter test credentials:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
5. Click **Sign In**

**Expected Console Output:**
```
[AUTH:event] { time: "18:26:42.123", event: "login:start", data: {...} }
[AUTH:✅] { time: "18:26:43.345", event: "login:complete", data: {...} }
[SUPABASE:event] { time: "18:26:42.789", event: "signin:request", data: {...} }
```

### Test 2: Verify Failed Login Logging

1. Use wrong password intentionally
2. Observe failure event

**Expected Console Output:**
```
[AUTH:❌] { time: "18:26:43.345", event: "login_failure", error: "Invalid credentials" }
[ERROR:event] { time: "18:26:43.456", event: "login:error", data: {...} }
```

### Test 3: Verify Session Restore Logging

1. Log in successfully
2. Refresh the page (F5)
3. Observe session restore events

**Expected Console Output:**
```
[SESSION:event] { time: "18:27:00.001", event: "session:restore:start", data: {...} }
[SUPABASE:event] { time: "18:27:00.100", event: "getSession:request", data: {...} }
[SESSION:event] { time: "18:27:00.500", event: "session:hydrated", data: {...} }
```

### Test 4: Verify Window Exports

In browser DevTools Console:

```javascript
// Should return trace array
window.getAuthTrace()

// Should generate report
window.generateAuthReport()

// Should show summary
window.getSessionSummary()
```

### Test 5: Verify Supabase Auth Behavior

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Verify user appears after registration
3. Check email confirmation is sent (if enabled)

### Test 6: Verify RLS Enforcement

1. In Supabase Dashboard → **SQL Editor**
2. Run:
   ```sql
   -- This should succeed for your user
   SELECT * FROM profiles WHERE id = auth.uid();
   
   -- This should fail without auth context
   SELECT * FROM profiles;
   ```

### Test 7: Verify Session Persistence

1. Log in
2. Close browser tab
3. Reopen browser to Conferly
4. Should auto-restore session (no login required)

### Test 8: Verify Replay System

In browser console after login:

```javascript
// Generate full auth report
const report = window.generateAuthReport();
console.log(report);
```

**Expected Output Format:**
```
=== AUTH SESSION REPLAY REPORT ===
SESSION: session_1746700000123_abc

EVENT SEQUENCE:
[0ms] auth:login_attempt (attempt 1)
[1200ms] auth:login_failure
[2500ms] auth:login_attempt (attempt 2)
[3100ms] auth:login_success

SUMMARY:
Total Events: 4
Login Attempts: 2
Login Failures: 1
Login Successes: 1
Time to success: 3.1s
```

---

## 2.6 DEPLOYMENT VERIFICATION

After all changes, verify production:

```bash
# Check server responds
curl -sI https://www.conferly.site | head -3

# Expected: HTTP/2 200
```

---

# APPENDIX: TROUBLESHOOTING

## Common Issues

### Issue: Events not appearing in console

**Fix:** Check that DevTools Console filter is set to "Default" level (not filtered).

### Issue: Session not restoring

**Fix:** 
1. Clear browser localStorage
2. Re-login
3. Refresh page

### Issue: RLS blocking profile creation

**Fix:**
1. Verify policies exist in Supabase Dashboard
2. Check auth.uid() is being used correctly

### Issue: Multiple login attempts not counted

**Fix:** Check that ATTEMPT_COUNTERS Map is being incremented in authEvents.ts

---

## Event Interpretation Guide

| Event | Meaning | Action Needed |
|-------|---------|-------------|
| `login:start` | User clicked login | None |
| `email:normalized` | Email cleaned | None |
| `turnstile:verified:success` | CAPTCHA passed | None |
| `login_failure` | Wrong credentials | User error |
| `session:none` | No active session | Normal for new users |
| `session:expired` | Token expired | Normal re-auth |

---

## Emergency Rollback

If observability causes issues:

1. Disable in code:
   ```typescript
   // Set to false in authTracer.ts
   let TracingEnabled = false;
   ```

2. Re-build and deploy

3. Or simply remove tracing imports temporarily

---

*Document Version: 1.0.0*  
*For: Conferly Platform*  
*Created by: OpenHands AI Agent*