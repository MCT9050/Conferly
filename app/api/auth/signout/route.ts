import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const response = new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  // Use @supabase/ssr client to sign out, which clears the auth cookies
  // with proper naming conventions (sb-* prefix) and handles chunking.
  const supabase = createSupabaseServerClient({ request, response });
  await supabase.auth.signOut();

  return response;
}