import { AccessToken } from "livekit-server-sdk";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Use Node.js runtime for LiveKit server SDK
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, participantName } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    // Initialize Supabase server client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let userId = "anonymous";
    let userName = participantName || "Guest";

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
          },
          setAll() {},
        },
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        userId = session.user.id;
        userName = session.user.user_metadata?.display_name || session.user.email?.split("@")[0] || "User";
      }
    }

    // Get LiveKit credentials from environment
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      console.warn("LiveKit not configured - using mock token");
      return NextResponse.json({
        token: "mock-token",
        url: livekitUrl || "wss://mock.livekit.io",
        participantName: userName,
      });
    }

    // Generate LiveKit token
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: userId,
      name: userName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      url: livekitUrl,
      participantName: userName,
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}