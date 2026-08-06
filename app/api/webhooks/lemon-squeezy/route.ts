// app/api/webhooks/lemon-squeezy/route.ts
// Lemon Squeezy webhook handler — the "Truth Layer" for subscription state
// Product-scoped: Meet and Class subscriptions coexist without overwriting.
// Idempotent: duplicate deliveries are safe via webhook_id tracking.

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
    const webhookId: string | undefined = payload?.meta?.webhook_id;

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

    // ── Idempotency guard ────────────────────────────────────────────────────
    // Skip events we have already processed successfully.
    if (webhookId) {
      const supabase = getSupabaseServerClient();
      const { data: existing } = await supabase
        .from('subscription_webhook_events')
        .select('id')
        .eq('webhook_id', webhookId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ received: true, idempotent: true });
      }
    }

    // Determine plan and participant cap based on event
    const attributes = payload?.data?.attributes ?? {};
    const status: string = attributes.status ?? 'unknown';
    const productName: string = attributes.product_name ?? '';
    const variantName: string = attributes.variant_name ?? '';

    // Determine product line from plan_tier prefix (or custom_data)
    const rawPlanTier = customData?.plan_tier ?? '';
    const productLine: 'meet' | 'class' = rawPlanTier.startsWith('class') ? 'class' : 'meet';

    // Map Lemon Squeezy product/variant to our internal plan using custom_data plan_tier if available
    const planData = mapPlanFromProduct(productName, variantName, customData?.plan_tier);

    const supabase = getSupabaseServerClient();

    // Upsert the subscription record — product-scoped so Meet and Class coexist.
    const record: Record<string, unknown> = {
      user_id: userId,
      product_line: productLine,
      plan: planData.plan,
      participant_cap: planData.participantCap,
      status: mapSubscriptionStatus(status, eventName),
      lemon_squeezy_subscription_id: subscriptionId,
      lemon_squeezy_order_id: (attributes.order_id as string) ?? null,
      current_period_start: attributes.renews_at ? new Date(attributes.renews_at as string).toISOString() : null,
      current_period_end: attributes.ends_at ? new Date(attributes.ends_at as string).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    // Handle lifecycle events:
    //  - created / updated: upsert with the mapped plan
    //  - cancelled / expired / paused: keep the plan but mark lifecycle state
    //  - resumed: set back to active
    //  - payment_failed: mark past_due
    const lifecycleStatus = mapSubscriptionStatus(status, eventName);

    if (
      eventName === 'subscription_created' ||
      eventName === 'subscription_updated' ||
      eventName === 'subscription_resumed'
    ) {
      const { error } = await supabase.from('subscriptions').upsert(
        { ...record, status: mapSubscriptionStatus(status, eventName) },
        { onConflict: 'user_id,product_line', ignoreDuplicates: false }
      );
      if (error) {
        throw new Error(`Failed to upsert subscription: ${error.message}`);
      }
    } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      // On cancellation/expiry, retain the plan but mark the lifecycle state.
      // Do not downgrade the plan — the subscriber keeps their plan identity.
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: lifecycleStatus,
          lemon_squeezy_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('product_line', productLine);
      if (error) {
        throw new Error(`Failed to update subscription on ${eventName}: ${error.message}`);
      }
    } else if (eventName === 'subscription_paused') {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('product_line', productLine);
      if (error) {
        throw new Error(`Failed to pause subscription: ${error.message}`);
      }
    } else if (eventName === 'subscription_payment_failed') {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('product_line', productLine);
      if (error) {
        throw new Error(`Failed to mark subscription past_due: ${error.message}`);
      }
    }

    // Record the processed webhook event for idempotency.
    if (webhookId) {
      await supabase.from('subscription_webhook_events').insert({
        webhook_id: webhookId,
        event_name: eventName,
        subscription_id: subscriptionId,
        user_id: userId,
        product_line: productLine,
      });
    }

    return NextResponse.json({ received: true, event: eventName });
  } catch (err) {
    console.error('[LemonSqueezyWebhook] Error:', err);
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

/**
 * Map a Lemon Squeezy product / variant name (or the custom_data plan_tier
 * we sent at checkout) to our internal plan + participant cap.
 *
 * Phase 2 authoritative Class contract:
 *   class_10 — R89  — 10 student seats (up to 2 teachers)
 *   class_20 — R120 — 20 student seats (up to 2 teachers)
 *   class_30 — R140 — 30 student seats (up to 2 teachers)
 *
 * Legacy mappings:
 *   classroom      → class_10 (R89, 10 seats)
 *   classroom_plus → UNVERIFIED — do NOT silently map to a new contract.
 *                     Existing subscribers keep their records; new purchases
 *                     should use one of the proven Class variants.
 */
function mapPlanFromProduct(
  productName: string,
  variantName: string,
  planTier?: string
): { plan: string; participantCap: number } {
  // 1) Trust the custom_data plan_tier sent at checkout
  switch (planTier) {
    case 'class_10':
      return { plan: 'class_10', participantCap: 10 };
    case 'class_20':
      return { plan: 'class_20', participantCap: 20 };
    case 'class_30':
      return { plan: 'class_30', participantCap: 30 };
    case 'classroom':
      return { plan: 'class_10', participantCap: 10 };
    case 'classroom_plus':
      return { plan: 'classroom_plus', participantCap: 30 }; // legacy UNVERIFIED
    case 'individual':
      return { plan: 'meet_individual', participantCap: 10 };
    case 'pro':
      return { plan: 'meet_pro', participantCap: 50 };
    case 'business':
      return { plan: 'meet_pro', participantCap: 50 };
    case 'unlimited':
      return { plan: 'meet_unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }

  // 2) Fallback: parse the product / variant name (order matters — 'classroom plus'
  //    must be checked before plain 'classroom' so we don't false-match).
  const lp = productName.toLowerCase();
  const lv = variantName.toLowerCase();

  if (lp.includes('class 30') || lv.includes('class 30')) {
    return { plan: 'class_30', participantCap: 30 };
  }
  if (lp.includes('class 20') || lv.includes('class 20')) {
    return { plan: 'class_20', participantCap: 20 };
  }
  if (lp.includes('classroom plus') || lv.includes('classroom plus')) {
    return { plan: 'classroom_plus', participantCap: 30 }; // legacy UNVERIFIED
  }
  if (lp.includes('unlimited') || lv.includes('unlimited')) {
    return { plan: 'meet_unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }
  if (lp.includes('classroom') || lv.includes('classroom')) {
    return { plan: 'class_10', participantCap: 10 };
  }
  if (lp.includes('individual') || lv.includes('individual')) {
    return { plan: 'meet_individual', participantCap: 10 };
  }
  if (lp.includes('business') || lv.includes('business')) {
    return { plan: 'meet_pro', participantCap: 50 };
  }
  if (lp.includes('pro') || lv.includes('pro')) {
    return { plan: 'meet_pro', participantCap: 50 };
  }
  if (lp.includes('enterprise') || lv.includes('enterprise')) {
    return { plan: 'meet_enterprise', participantCap: UNLIMITED_PARTICIPANT_CAP };
  }

  // 3) Hard fallback — should never be hit in production.
  //    Default to Class 10 to avoid granting unintended unlimited access.
  return { plan: 'class_10', participantCap: 10 };
}

/**
 * Map Lemon Squeezy status to our internal status.
 * Event context is used so cancelled/expired events set the right lifecycle state.
 */
function mapSubscriptionStatus(lsStatus: string, _eventName?: string): string {
  switch (lsStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'paused':
      return 'paused';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
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