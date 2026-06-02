import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthSignupUrl, requireSupabaseConfig } from '@/lib/supabase';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  // Rate limiting check (stricter for signup)
  const rateLimitResult = await rateLimitMiddleware(request, RATE_LIMITS.signup);
  if (!rateLimitResult.allowed) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'rate_limited',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: rateLimitResult.error }, { status: 429 });
  }

  requireSupabaseConfig();
  const body = await request.json();
  const { email, password, displayName } = body;

  if (!email || !password || !displayName) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'missing_fields',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: 'Email, password, and display name are required.' }, { status: 400 });
  }

  const response = await fetch(getSupabaseAuthSignupUrl(), {
    method: 'POST',
    headers: {
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      options: {
        data: { full_name: displayName, role: 'participant' },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'signup_failed',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: data?.error_description || data?.error || 'Unable to sign up.' }, { status: 400 });
  }

  trackEvent({ type: 'auth_success', stage: 'signup', timestamp: Date.now() });

  const needsConfirmation = Boolean(data?.confirmation_sent_at || data?.next_action?.type === 'email_verification');

  // If Supabase returned tokens, set cookies similarly to signin flow.
  if (data?.access_token) {
    const cookieOptions = {
      secure: process.env.NODE_ENV === 'production',
      maxAge: data.expires_in ?? 60 * 60,
    };

    const authTokenValue = JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

    const cookieDomain = process.env.COOKIE_DOMAIN ?? '.conferly.vercel.app';
    const cookieDomainAttr = `; Domain=${cookieDomain}`;

    const responseHeaders = new Headers();
    responseHeaders.append('Set-Cookie', `sb-access-token=${encodeURIComponent(data.access_token)}; HttpOnly; Path=/` + cookieDomainAttr + `; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? '; Secure' : ''}`);
    responseHeaders.append('Set-Cookie', `supabase-auth-token=${encodeURIComponent(authTokenValue)}; HttpOnly; Path=/` + cookieDomainAttr + `; SameSite=Lax; Max-Age=${cookieOptions.maxAge}${cookieOptions.secure ? '; Secure' : ''}`);

    return new NextResponse(JSON.stringify({ success: true, needsConfirmation }), { status: 200, headers: responseHeaders });
  }

  return NextResponse.json({ success: true, needsConfirmation });
}
