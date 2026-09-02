import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  validateOnboardingPayload,
  type OnboardingState,
} from '@/lib/onboarding';

/**
 * GET /api/onboarding
 * Returns the current user's onboarding intent state.
 */
export async function GET(request: Request) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient({ request });
  const { data, error } = await supabase
    .from('profiles')
    .select('meet_intent, class_intent, onboarding_completed_at')
    .eq('id', session.userId)
    .maybeSingle();

  if (error) {
    console.error('[ONBOARDING_GET] profile lookup failed:', error);
    return NextResponse.json({ error: 'Unable to retrieve onboarding state' }, { status: 500 });
  }

  const state: OnboardingState = {
    meetIntent: (data?.meet_intent as OnboardingState['meetIntent']) ?? null,
    classIntent: (data?.class_intent as OnboardingState['classIntent']) ?? null,
    onboardingCompletedAt: data?.onboarding_completed_at ?? null,
  };

  return NextResponse.json(state);
}

/**
 * PUT /api/onboarding
 * Updates the current user's onboarding intent and marks onboarding as completed.
 * Both fields are optional to support partial updates.
 */
export async function PUT(request: Request) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const validation = validateOnboardingPayload(payload);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = createSupabaseServerClient({ request });

  const updateData: Record<string, unknown> = {
    onboarding_completed_at: new Date().toISOString(),
  };

  if ('meetIntent' in validation.data) {
    updateData.meet_intent = validation.data.meetIntent;
  }

  if ('classIntent' in validation.data) {
    updateData.class_intent = validation.data.classIntent;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', session.userId)
    .select('meet_intent, class_intent, onboarding_completed_at')
    .maybeSingle();

  if (error) {
    console.error('[ONBOARDING_PUT] profile update failed:', error);
    return NextResponse.json({ error: 'Unable to update onboarding state' }, { status: 500 });
  }

  const state: OnboardingState = {
    meetIntent: (data?.meet_intent as OnboardingState['meetIntent']) ?? null,
    classIntent: (data?.class_intent as OnboardingState['classIntent']) ?? null,
    onboardingCompletedAt: data?.onboarding_completed_at ?? null,
  };

  return NextResponse.json(state);
}
