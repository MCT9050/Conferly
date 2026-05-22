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

  return NextResponse.json({ success: true, needsConfirmation });
}
