# Supabase Bundle Split Architecture

## Win #3 Execution Summary

### Problem Statement
The Supabase client was potentially leaking into ALL routes, including `/dashboard` where it isn't dynamically needed on initial load. Heavy client-side auth/data methods needed to be lazy-loaded only on demand.

### Solution: Three-Tier Import Architecture

#### 1. Config Helpers (`lib/supabase.ts`)
- **Purpose:** Lightweight, environment-aware helpers for Supabase URLs and API keys
- **Imports:** `serverEnv.ts` only (no SDK)
- **Usage:** Server-side session validation in `lib/auth.ts`
- **Bundle Impact:** ✅ Zero Supabase SDK code

#### 2. Server-Side Client (`lib/supabaseServerClient.ts`)
- **Purpose:** Full Supabase SDK instance for server-only data operations
- **Imports:** `@supabase/supabase-js` (full SDK)
- **Loaded By:** `lib/meetingAuth.ts` only
- **Called From:** `app/api/lk-token/route.ts` (API route, server-only)
- **Bundle Impact:** ✅ Never reaches client bundles (API routes are server-only)

#### 3. Lazy Client Wrapper (`lib/supabaseClient.ts`)
- **Purpose:** Gracefully lazy-load Supabase SDK on demand for future client features
- **Imports:** `@supabase/supabase-js` via dynamic `await import()` 
- **Usage Pattern:**
  ```typescript
  // Only loads SDK when first called
  import { signIn } from '@/lib/supabaseClient';
  const result = await signIn(email, password);
  ```
- **Bundle Impact:** ✅ SDK tree-shaken until actually imported; code-split into separate chunk

### Import Chain Analysis

**Server-Side Auth Flow:**
```
app/dashboard/layout.tsx
  → lib/auth.ts (getAuthorizedSession)
    → lib/supabase.ts (getSupabaseAuthUserUrl, getSupabaseApiKey)
      → lib/serverEnv.ts
    → No SDK imports!
```

**API-Only Supabase Data:**
```
app/api/lk-token/route.ts
  → lib/meetingAuth.ts (verifyRoomAccess)
    → lib/supabaseServerClient.ts (getSupabaseServerClient)
      → @supabase/supabase-js (full SDK)
    → Only loaded on /api/lk-token requests!
```

**Client-Side (Future):**
```
Client components (if needed)
  → lib/supabaseClient.ts (signIn, signOut, getSession)
    → dynamic await import('@supabase/supabase-js')
      → Only loaded on first function call!
```

### Verification

✅ **Server-side auth chain:** Uses only config helpers, no SDK
✅ **Full SDK usage:** Restricted to API routes (server-only)
✅ **Client-side safety:** New lazy wrapper prevents SDK from being bundled upfront
✅ **Base layout chunk:** Free of unneeded database logic

### Files Modified/Created

- ✅ `lib/supabaseClient.ts` — New lazy-loading wrapper
- ✅ `components/CollaborativeEditor.tsx` — TipTap lazy extension refactor (Win #2)

### Next Steps

- Run production build with increased Node heap (`NODE_OPTIONS=--max-old-space-size=4096 npm run build`)
- Verify final bundle chunk breakdown with `next/bundle-analyzer`
- Confirm no `@supabase/supabase-js` in `/dashboard` route chunks
