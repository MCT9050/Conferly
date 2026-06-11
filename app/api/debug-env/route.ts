import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ? 'SET (len=' + process.env.LIVEKIT_API_KEY.trim().length + ')' : 'MISSING',
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ? 'SET (len=' + process.env.LIVEKIT_API_SECRET.trim().length + ')' : 'MISSING',
    LIVEKIT_URL: process.env.LIVEKIT_URL || 'MISSING',
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'SET (len=' + process.env.HUGGINGFACE_API_KEY.trim().length + ')' : 'MISSING',
    NEXT_PUBLIC_VARIANT_ID_CLASSROOM: process.env.NEXT_PUBLIC_VARIANT_ID_CLASSROOM || 'MISSING',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    SUPABASE_URL: process.env.SUPABASE_URL || 'MISSING',
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY ? 'SET' : 'MISSING',
  };
  return NextResponse.json(checks);
}
