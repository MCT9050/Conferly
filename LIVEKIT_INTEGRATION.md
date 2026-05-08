# Conferly LiveKit Cloud + Supabase Integration
## Complete Implementation Guide

**Date:** 2025-05-07  
**Status:** Ready for Integration

---

# 1. SUPABASE EDGE FUNCTION (FULL CODE)

## File: `supabase/functions/generate-livekit-token/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@1.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || ''
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || ''
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') || 'wss://livekit.conferly.site'

interface TokenRequest {
  user_id: string
  room_name?: string
  user_name?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Verify Supabase JWT authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse request body
    const body: TokenRequest = await req.json()
    const { user_id, room_name, user_name } = body

    // 3. Validate user owns the request
    if (user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Get display name from profile
    let displayName = user_name || user.email?.split('@')[0] || 'User'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      if (profile?.display_name) displayName = profile.display_name
    } catch {}

    // 5. Generate LiveKit token
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'LiveKit not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roomName = room_name || `meeting-${user.id.slice(0, 8)}-${Date.now()}`
    const token = new AccessToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: displayName,
      participantIdentity: user.id,
    })

    token.addGrant({
      roomJoin: true,
      roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt = token.toJwt()

    return new Response(
      JSON.stringify({
        success: true,
        token: jwt,
        room_name: roomName,
        participant_name: displayName,
        participant_identity: user.id,
        livekit_url: LIVEKIT_URL,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

# 2. REACT LIVEKIT HOOK

## File: `src/hooks/useLiveKitRoom.ts`

Contains:
- `useLiveKitRoom()` - Main hook
- `fetchToken()` - Calls Edge Function
- `connectToRoom()` - Joins LiveKit room
- `toggleMute()`, `toggleVideo()`, `toggleScreenShare()` - Controls
- `sendChatMessage()`, `sendReaction()` - Real-time features

Key functions:
```typescript
// Connect to meeting
await connectToRoom('room-id', 'User Name')

// Controls
toggleMute()      // Toggle microphone
toggleVideo()     // Toggle camera
toggleScreenShare() // Toggle screen share
```

---

# 3. ROOM JOIN COMPONENT

## File: `src/components/RoomJoin.tsx`

Features:
- Create new meeting (generates ID)
- Join existing meeting (enter code)
- Loading/error states
- In-meeting UI with controls

---

# 4. LIVEKIT CLOUD INTEGRATION FLOW

## Step-by-Step Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                 USER FLOW                    │
├──────────────────────────────────────────────────────────────────────┤
│                                              │
│  1. USER LOGIN (Supabase)                     │
│     ↓                                       │
│  2. User visits meeting page                   │
│     ↓                                       │
│  3. RoomJoin component loads                 │
│     ↓                                       │
│  4. User enters name + clicks "Create"       │
│     ↓                                       │
│  5. useLiveKitRoom.connectToRoom()            │
│     ↓                                       │
│  6. fetchToken() calls Edge Function         │
│     ↓                                       │
│  7. Edge Function:                          │
│     - Verifies Supabase JWT                 │
│     - Generates LiveKit JWT                 │
│     - Returns token                       │
│     ↓                                       │
│  8. Frontend receives token                │
│     ↓                                       │
│  9. new Room().connect(LIVEKIT_URL, token)  │
│     ↓                                       │
│  10. WebRTC connection established          │
│     ↓                                       │
│  11. Video/audio streams flow               │
│     ↓                                       │
│  12. ✅ Meeting active                     │
│                                              │
└──────────────────────────────────────────────────────────────────────┘
```

## Configuration Required

### LiveKit Cloud

1. Create account at [livekit.io](https://livekit.io)
2. Create project
3. Get credentials:
   - API Key
   - API Secret  
   - Server URL (wss://...)

### Supabase Edge Function

Set environment secrets:
```bash
supabase secrets set LIVEKIT_API_KEY=your_key
supabase secrets set LIVEKIT_API_SECRET=your_secret
supabase secrets set LIVEKIT_URL=wss://your-project.lky.dev
```

### Frontend Environment

Add to `.env`:
```
VITE_LIVEKIT_URL=wss://your-project.lky.dev
```

---

# 5. OPTIONAL SUPABASE SCHEMA

## meetings table (optional)

For meeting history tracking only:

```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  title TEXT,
  host_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  participant_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security - users can see their own
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own meetings" ON meetings
  FOR ALL USING (host_id = auth.uid());
```

---

# 6. END-TO-END TEST FLOW

## Test Scenario: Two-User Video Call

### Setup
1. Open two browser tabs at conferly.site
2. Tab A: User A logs in
3. Tab B: User B logs in

### Test Steps

#### Tab A (Host)
1. Click "Join Meeting" or "Create"
2. Enter name "Alice"
3. Click "Create Meeting"
4. Gets room ID: `meeting-...`
5. Share room ID with Tab B

#### Tab B (Participant)
1. Enter name "Bob"  
2. Enter room ID from Tab A
3. Click "Join Meeting"

#### Verify
- ✅ Both see each other's video
- ✅ Audio works both ways
- ✅ Mute button works
- ✅ Video toggle works

### Manual Verification

Check browser console:
```
[LiveKit] Connected to room
[LiveKit] Participant joined: Bob
```

Check DevTools → Network → WebSocket:
- Connection to wss://...livekit...

---

# 7. FAILURE HANDLING STRATEGY

## Failure Scenarios + Solutions

### 1. Invalid LiveKit Token
```
Error: "Failed to connect - invalid token"
```
**Cause**: Token expired or malformed  
**Solution**: 
```typescript
try {
  await connectToRoom(roomName, userName)
} catch (err) {
  if (err.message.includes('invalid token')) {
    // Re-fetch token and retry
    const newToken = await fetchToken(roomName, userName)
    await connectToRoom(roomName, userName)
  }
}
```

### 2. Expired Session
```
Error: "Not authenticated"
```
**Cause**: Supabase JWT expired  
**Solution**:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  // Redirect to login
  window.location.href = '/auth'
}
```

### 3. Network Disconnect
```
Error: "WebSocket disconnected"
```
**Solution**:
```typescript
room.on(RoomEvent.Disconnected, () => {
  // Show reconnect UI
  showReconnectingUI()
  // Auto-reconnect after delay
  setTimeout(async () => {
    await connectToRoom(roomName, userName)
  }, 3000)
})
```

### 4. Room Not Found
```
Error: "Room not found"
```
**Cause**: Room doesn't exist or expired  
**Solution**:
```typescript
if (err.message.includes('room not found')) {
  // Prompt to create new room
  setJoinMode('create')
}
```

### 5. Participant Drop
```
Error: "Participant left"
```
**Solution**:
```typescript
room.on(RoomEvent.ParticipantLeft, (participant) => {
  console.log(`${participant.identity} left`)
  // Update UI
})
```

---

# 8. QUICK START CHECKLIST

## Pre-Flight Checklist

- [ ] LiveKit Cloud account created
- [ ] API Key + Secret obtained
- [ ] Edge Function deployed
- [ ] LIVEKIT_API_KEY secret set
- [ ] LIVEKIT_API_SECRET secret set
- [ ] LIVEKIT_URL secret set
- [ ] Frontend VITE_LIVEKIT_URL set
- [ ] useLiveKitRoom.ts imported in App
- [ ] RoomJoin component added to routes
- [ ] Test with two browser tabs

---

# 9. FILE SUMMARY

| File | Purpose |
|------|---------|
| `supabase/functions/generate-livekit-token/index.ts` | Token generation |
| `src/hooks/useLiveKitRoom.ts` | Room hook |
| `src/components/RoomJoin.tsx` | Join UI |

---

*Implementation ready for copy-paste deployment.*