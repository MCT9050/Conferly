"use server";

// app/actions/checkout-actions.ts
// Server action to generate Lemon Squeezy checkout URLs

import { getServerSession } from '../../lib/auth';
import { createCheckout, type SupportedPlanTier } from '../../lib/lemon-squeezy';

export type CheckoutActionResult = {
  url?: string;
  error?: string;
};

/**
 * Creates a Lemon Squeezy checkout session for the authenticated user.
 * Uses the per-tier actions below instead; this function is kept for backward compatibility.
 */
export async function createCheckoutSession(
  planTier: 'pro' | 'business',
  _cycle: 'monthly' | 'annual'
): Promise<CheckoutActionResult> {
  // Redirect to the proper per-tier action
  if (planTier === 'pro') {
    return createProCheckout();
  }
  return { error: 'Please use the plan-specific checkout actions.' };
}

/**
 * Generic checkout helper used by the per-tier wrapper actions below.
 * Authenticates the user, then mints a Lemon Squeezy checkout for the given plan.
 */
async function createPlanCheckoutInternal(plan: SupportedPlanTier): Promise<CheckoutActionResult> {
  try {
    const session = await getServerSession();
    if (!session?.userId) {
      return { error: 'You must be signed in to upgrade your plan.' };
    }

    const result = await createCheckout(session.userId, plan);
    return { url: result.url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Simplified checkout specifically for the Classroom tier (R89/month ZAR).
 * Uses the new createCheckout function that reads the variant ID from
 * NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID and passes userId as a custom attribute.
 */
export async function createClassroomCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('classroom');
}

/**
 * Checkout for the Classroom+ tier (R220/month ZAR, 30-learner cap).
 * Same tutor/whiteboard feature set as Classroom, but at 6x the capacity.
 */
export async function createClassroomPlusCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('classroom_plus');
}

/**
 * Checkout for the Individual tier (R110/month, 10 participants).
 */
export async function createIndividualCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('individual');
}

/**
 * Checkout for the Pro Business tier (R169/month, 50 participants).
 */
export async function createProCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('pro');
}

/**
 * Checkout for the Conferly Unlimited tier (R389/month, no cap).
 * Writes `participant_cap = 9999` in the DB, which the participantStore
 * treats as the bypass sentinel.
 */
export async function createUnlimitedCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('unlimited');
}

/**
 * Product-scoped checkout: Meet plans.
 * Validates that the plan ID is a Meet plan before creating checkout.
 */
export async function createMeetCheckout(planId: string): Promise<CheckoutActionResult> {
  const { MEET_PLANS } = await import('../../lib/pricing/meet');
  const plan = MEET_PLANS.find(p => p.id === planId);
  if (!plan) {
    return { error: 'Invalid Meet plan selected.' };
  }

  // Map meet plan IDs to legacy SupportedPlanTier for Lemon Squeezy
  const legacyPlanMap: Record<string, 'individual' | 'pro' | 'unlimited'> = {
    meet_individual: 'individual',
    meet_pro: 'pro',
    meet_unlimited: 'unlimited',
  };

  const legacyPlan = legacyPlanMap[planId];
  if (!legacyPlan) {
    return { error: 'This plan is not available for online checkout.' };
  }

  return createPlanCheckoutInternal(legacyPlan);
}

/**
 * Product-scoped checkout: Class plans.
 * Validates that the plan ID is a Class plan before creating checkout.
 */
export async function createClassCheckout(planId: string): Promise<CheckoutActionResult> {
  const { CLASS_PLANS } = await import('../../lib/pricing/class');
  const plan = CLASS_PLANS.find(p => p.id === planId);
  if (!plan) {
    return { error: 'Invalid Class plan selected.' };
  }

  // Map class plan IDs to legacy SupportedPlanTier for Lemon Squeezy
  const legacyPlanMap: Record<string, 'classroom' | 'classroom_plus'> = {
    class_room: 'classroom',
    class_room_plus: 'classroom_plus',
  };

  const legacyPlan = legacyPlanMap[planId];
  if (!legacyPlan) {
    return { error: 'This plan is not available for online checkout.' };
  }

  return createPlanCheckoutInternal(legacyPlan);
}

/**
 * Fetches the user's current subscription status from the database.
 */
export async function getUserSubscription() {
  try {
    const session = await getServerSession();
    if (!session?.userId) {
      return null;
    }

    // Import supabase dynamically to avoid server/client import issues
    const { getSupabaseServerClient } = await import('../../lib/supabaseServerClient');
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
