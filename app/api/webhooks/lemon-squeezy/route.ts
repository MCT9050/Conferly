// app/api/webhooks/lemon-squeezy/route.ts
// Lemon Squeezy webhook handler — the "Truth Layer" for subscription state
// Listens for subscription_created and subscription_updated events

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabaseServerClient';
import { getLemonSqueezyConfig } from '../../../../lib/lemon-squeezy';
import { UNLIMITED_PARTICIPANT_CAP } from '../../../../types';
import crypto from 'crypto';

// Lemon Squeezy sends webhook signature in X-Signature header
const WEBHOOK_SIGNATURE_HEADER = 'x-signature';

export async function POST(request: NextRequest) {
  try {
    // Read raw body as text for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER);

    // Get config — will throw if env vars are missing
    const config = getLemonSqueezyConfig();

    // Verify webhook signature
    if (!signature || !verifySignature(rawBody, signature, config.webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const eventName: string = payload?.meta?.event_name ?? '';
    const customData: Record<string, string> | undefined = payload?.meta?.custom_data;

    // Only process subscription events
    if (!eventName.startsWith('subscription_')) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const subscriptionId = payload?.data?.id as string | undefined;
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 });
    }

    // Extract userId from custom_data (passed during checkout)
    const userId = customData?.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id in custom_data' }, { status: 400 });
    }

    // Determine plan and participant cap based on event
    const attributes = payload?.data?.attributes ?? {};
    const status: string = attributes.status ?? 'unknown';
    const productName: string = attributes.product_name ?? '';
    const variantName: string = attributes.variant_name ?? '';

    // Determine product line from plan_tier prefix (or custom_data)
    const rawPlanTier = customData?.plan_tier ?? '';
    const productLine: 'meet' | 'class' = rawPlanTier.startsWith('class_') ? 'class' : 'meet';

    // Map Lemon Squeezy product/variant to our plan using custom_data plan_tier if available
    const planData = mapPlanFromProduct(productName, variantName, customData?.plan_tier);

    // Update the user's subscription in the database
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      await upsertSubscription(userId, {
        plan: planData.plan,
        participantCap: planData.participantCap,
        productLine,
        status: mapSubscriptionStatus(status),
        lemonSqueezySubscriptionId: subscriptionId,
        lemonSqueezyOrderId: (payload?.data?.attributes?.order_id as string) ?? null,
        currentPeriodStart: attributes.renews_at as string ?? null,
        currentPeriodEnd: attributes.ends_at as string ?? null,
      });
    } else if (eventName === 'subscription_cancelled') {
      // On cancellation, downgrade to trial
      await upsertSubscription(userId, {
        plan: 'trial',
        participantCap: 2,
        status: 'cancelled',
        lemonSqueezySubscriptionId: subscriptionId,
        lemonSqueezyOrderId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });
    }

    return NextResponse.json({ received: true, event: eventName });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ─── Helpers ───

type SubscriptionUpdate = {
  plan: string;
  participantCap: number;
  productLine?: 'meet' | 'class';
  status: string;
  lemonSqueezySubscriptionId: string | null;
  lemonSqueezyOrderId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

/**
 * Upsert a user's subscription record in the database.
 * Uses service_role client to bypass RLS.
 */
async function upsertSubscription(userId: string, data: SubscriptionUpdate) {
  const supabase = getSupabaseServerClient();

  const record: Record<string, unknown> = {
    user_id: userId,
    plan: data.plan,
    participant_cap: data.participantCap,
    status: data.status,
    lemon_squeezy_subscription_id: data.lemonSqueezySubscriptionId,
    lemon_squeezy_order_id: data.lemonSqueezyOrderId,
    current_period_start: data.currentPeriodStart ? new Date(data.currentPeriodStart).toISOString() : null,
    current_period_end: data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (data.productLine) {
    record.product_line = data.productLine;
  }

  const { error } = await supabase.from('subscriptions').upsert(
    record,
    {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    }
  );

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }
}

/**
 * Map a Lemon Squeezy product / variant name (or the custom_data plan_tier
 * we sent at checkout) to our internal plan + participant cap.
 *
 * The custom_data path is the most reliable because it round-trips the exact
 * plan key our checkout put in. The name-based fallback exists in case a
 * future variant is added before we update this switch.
 *
 * Tier matrix:
 *   classroom      — R89  / 5   learners
 *   classroom_plus — R220 / 30  learners
 *   individual     — R110 / 10  participants
 *   pro            — R169 / 50  participants
 *   business       — R169 / 50  participants (same variant family as Pro)
 *   enterprise     — custom    (legacy)
 *   unlimited      — R389 / UNLIMITED_PARTICIPANT_CAP (9999) — cap bypass in participantStore
 */
function mapPlanFromProduct(
  productName: string,
  variantName: string,
  planTier?: string
): { plan: string; participantCap: number } {
  // 1) Trust the custom_data plan_tier sent at checkout
  switch (planTier) {
    case 'classroom':
      return { plan: 'classroom', participantCap: 5 };
    case 'classroom_plus':
      return { plan: 'classroom_plus', participantCap: 30 };
    case 'individual':
      return { plan: 'individual', participantCap: 10 };
    case 'pro':
      return { plan: 'pro', participantCap: 50 };
    case 'business':
      return { plan: 'business', participantCap: 50 };
    case 'unlimited':
      return { plan: 'unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }

  // 2) Fallback: parse the product / variant name (order matters — 'classroom plus'
  //    must be checked before plain 'classroom' so we don't false-match).
  const lp = productName.toLowerCase();
  const lv = variantName.toLowerCase();

  if (lp.includes('classroom plus') || lv.includes('classroom plus')) {
    return { plan: 'classroom_plus', participantCap: 30 };
  }
  if (lp.includes('unlimited') || lv.includes('unlimited')) {
    return { plan: 'unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }
  if (lp.includes('classroom') || lv.includes('classroom')) {
    return { plan: 'classroom', participantCap: 5 };
  }
  if (lp.includes('individual') || lv.includes('individual')) {
    return { plan: 'individual', participantCap: 10 };
  }
  if (lp.includes('business') || lv.includes('business')) {
    return { plan: 'business', participantCap: 50 };
  }
  if (lp.includes('pro') || lv.includes('pro')) {
    return { plan: 'pro', participantCap: 50 };
  }
  if (lp.includes('enterprise') || lv.includes('enterprise')) {
    return { plan: 'enterprise', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }

  // 3) Hard fallback — should never be hit in production
  return { plan: 'classroom', participantCap: 5 };
}

/**
 * Map Lemon Squeezy status to our internal status.
 */
function mapSubscriptionStatus(lsStatus: string): string {
  switch (lsStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'past_due':
      return 'past_due';
    default:
      return lsStatus;
  }
}

/**
 * Verify Lemon Squeezy webhook signature using HMAC-SHA256.
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
