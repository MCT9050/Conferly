import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthTokenUrl, requireSupabaseConfig } from '@/lib/supabase';

export async function POST(request: Request) {
  requireSupabaseConfig();
  const cookieHeader = request.headers.get('cookie') || '';
  // Parse supabase-auth-token cookie
  const match = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith('supabase-auth-token='));
  if (!match) {
    trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'no_refresh_token_cookie', timestamp: Date.now() });
    return NextResponse.json({ error: 'No refresh token available' }, { status: 401 });
  }
  const raw = decodeURIComponent(match.split('=')[1] || '');
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const refreshToken = parsed?.refresh_token;
  if (!refreshToken) {
    trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'no_refresh_token', timestamp: Date.now() });
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const resp = await fetch(`${getSupabaseAuthTokenUrl()}?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await resp.json();
  if (!resp.ok || !data?.access_token) {
    trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'refresh_api_error', timestamp: Date.now() });
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }

  trackEvent({ type: 'auth_success', stage: 'refresh', timestamp: Date.now() });

  const cookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    maxAge: data.expires_in ?? 60 * 60,
  };

  const cookieDomain = process.env.COOKIE_DOMAIN ?? '.conferly.vercel.app';
  const cookieDomainAttr = `; Domain=${cookieDomain}`;

  const authTokenValue = JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });

  const responseHeaders = new Headers();
  responseHeaders.append('Set-Cookie', `sb-access-token=${encodeURIComponent(data.access_token)}; HttpOnly; Path=/` + cookieDomainAttr + `; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? '; Secure' : ''}`);
  responseHeaders.append('Set-Cookie', `supabase-auth-token=${encodeURIComponent(authTokenValue)}; HttpOnly; Path=/` + cookieDomainAttr + `; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? '; Secure' : ''}`);

  return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders });
}
