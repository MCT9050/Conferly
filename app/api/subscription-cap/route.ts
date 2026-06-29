// app/api/subscription-cap/route.ts
// API route to return the authenticated user's participant cap from their subscription

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabaseServerClient';
import { getServerSession } from '../../../lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(request);
    if (!session?.userId) {
      // Unauthenticated users get the trial cap
      return NextResponse.json({ participantCap: 2, plan: 'trial' });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, participant_cap, status')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error || !data) {
      // No subscription record yet — default to trial
      return NextResponse.json({ participantCap: 2, plan: 'trial' });
    }

    // If subscription is not active, fall back to trial cap
    if (data.status !== 'active') {
      return NextResponse.json({ participantCap: 2, plan: data.plan });
    }

    return NextResponse.json({
      participantCap: data.participant_cap,
      plan: data.plan,
    });
  } catch (error) {
    console.error('[SubscriptionCap] Error fetching cap:', error);
    // Fail safe — default to trial cap
    return NextResponse.json({ participantCap: 2, plan: 'trial' });
  }
}