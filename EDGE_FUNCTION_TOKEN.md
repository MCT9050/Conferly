import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@1.0.0'

// ============================================================
// SUPABASE EDGE FUNCTION: generate-livekit-token
// ============================================================
// Purpose: Generate LiveKit access tokens for Conferly video meetings
// 
// Authentication: Supabase JWT required
// Input: user_id, room_name (optional)
// Output: LiveKit access token (JWT)
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// LiveKit configuration from environment
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || ''
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || ''
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') || 'wss://livekit.conferly.site'

interface TokenRequest {
  user_id: string
  room_name?: string
  user_name?: string
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Verify the JWT and get user info
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse request body
    const body: TokenRequest = await req.json()
    const { user_id, room_name, user_name } = body

    // 3. Validate user_id matches authenticated user
    if (user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Get user's display name from profile (if available)
    let displayName = user_name || user.email?.split('@')[0] || 'User'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      
      if (profile?.display_name) {
        displayName = profile.display_name
      }
    } catch {
      // Profile might not exist, use fallback
    }

    // 5. Generate LiveKit access token
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'LiveKit not configured on server' }),
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

    // Grant permissions
    token.addGrant({
      roomJoin: true,
      roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt = token.toJwt()

    // 6. Return success response
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
    console.error('LiveKit token generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================
// ENVIRONMENT VARIABLES REQUIRED
// ============================================================
// Set these in your Supabase Edge Function secrets:
// 
// LIVEKIT_API_KEY=your_livekit_api_key
// LIVEKIT_API_SECRET=your_livekit_api_secret  
// LIVEKIT_URL=wss://your-livekit-host.lky.dev (or your custom URL)
// ============================================================

// ============================================================
// EXAMPLE REQUEST
// ============================================================
// POST /functions/v1/generate-livekit-token
// Headers:
//   Authorization: Bearer <supabase_jwt_token>
//   Content-Type: application/json
// Body:
// {
//   "user_id": "user-uuid-from-auth",
//   "room_name": "my-meeting-room",  // optional
//   "user_name": "John"           // optional
// }
//
// Response (200):
// {
//   "success": true,
//   "token": "eyJhbGciOi...",
//   "room_name": "my-meeting-room",
//   "participant_name": "John",
//   "participant_identity": "user-uuid",
//   "livekit_url": "wss://livekit.conferly.site"
// }
//
// Response (401):
// {
//   "error": "Invalid authentication"
// }
// ============================================================