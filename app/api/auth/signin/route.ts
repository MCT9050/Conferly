import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthTokenUrl, requireSupabaseConfig } from '@/lib/supabase';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  // Rate limiting check
  const rateLimitResult = await rateLimitMiddleware(request, RATE_LIMITS.auth);
  if (!rateLimitResult.allowed) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
      reason: 'rate_limited',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: rateLimitResult.error }, { status: 429 });
  }

  requireSupabaseConfig();
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
      reason: 'missing_credentials',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const response = await fetch(`${getSupabaseAuthTokenUrl()}?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
      reason: 'invalid_credentials',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: data?.error_description || data?.error || 'Invalid credentials.' }, { status: 401 });
  }

  trackEvent({ type: 'auth_success', stage: 'signin', timestamp: Date.now() });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
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

  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: responseHeaders,
  });
}
