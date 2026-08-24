"use server";

// app/actions/checkout-actions.ts
// Server action to generate Lemon Squeezy checkout URLs (product-scoped)

import { createCheckout, type SupportedPlanTier } from '../../lib/lemon-squeezy';

export type CheckoutActionResult = {
  url?: string;
  error?: string;
};

/**
 * Generic checkout helper used by the per-tier wrapper actions below.
 * Authenticates the user, then mints a Lemon Squeezy checkout for the given plan.
 */
async function createPlanCheckoutInternal(plan: SupportedPlanTier): Promise<CheckoutActionResult> {
  try {
    const { getServerSession } = await import('../../lib/auth');
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
 * Checkout for Class 10 (R89/month ZAR, 10 student seats + up to 2 teachers).
 */
export async function createClass10Checkout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('class_10');
}

/**
 * Checkout for Class 20 (R120/month ZAR, 20 student seats + up to 2 teachers).
 */
export async function createClass20Checkout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('class_20');
}

/**
 * Checkout for Class 30 (R140/month ZAR, 30 student seats + up to 2 teachers).
 */
export async function createClass30Checkout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('class_30');
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
  const plan = MEET_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { error: 'Invalid Meet plan selected.' };
  }

  // Meet Enterprise is contact-sales only — no public checkout.
  if (planId === 'meet_enterprise') {
    return { error: 'Meet Enterprise requires contacting sales at info@conferly.site.' };
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
  const plan = CLASS_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { error: 'Invalid Class plan selected.' };
  }

  // Custom Class is contact-sales only — no public checkout.
  if (planId === 'class_custom') {
    return { error: 'Custom Class requires contacting sales at info@conferly.site.' };
  }

  // Map class plan IDs to SupportedPlanTier
  const planMap: Record<string, 'class_10' | 'class_20' | 'class_30'> = {
    class_10: 'class_10',
    class_20: 'class_20',
    class_30: 'class_30',
  };

  const mappedPlan = planMap[planId];
  if (!mappedPlan) {
    return { error: 'This plan is not available for online checkout.' };
  }

  return createPlanCheckoutInternal(mappedPlan);
}

/**
 * Legacy checkout for the Classroom tier (R89/month ZAR).
 * Maps to Class 10 in the new product-scoped model.
 * Kept for backward compatibility with existing callers.
 */
export async function createClassroomCheckout(): Promise<CheckoutActionResult> {
  return createPlanCheckoutInternal('class_10');
}

/**
 * Legacy Classroom+ is intentionally not available for new public checkout.
 * Existing subscribers must be handled by verified webhook/back-office evidence
 * only; do not mint new checkout URLs for the UNVERIFIED legacy variant.
 */
export async function createClassroomPlusCheckout(): Promise<CheckoutActionResult> {
  return { error: 'Classroom+ is a legacy plan. Please contact sales at info@conferly.site.' };
}

/**
 * Fetches the user's current subscription status from the database.
 * Returns both product lines independently.
 */
export async function getUserSubscription() {
  try {
    const { getServerSession } = await import('../../lib/auth');
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
      .eq('user_id', session.userId);

    if (error) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
