import { NextResponse } from 'next/server';

export async function POST() {
  // Clear auth cookies set during signin
  const responseHeaders = new Headers();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  responseHeaders.append('Set-Cookie', `sb-access-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  responseHeaders.append('Set-Cookie', `supabase-auth-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders });
}
