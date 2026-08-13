// app/api/webhooks/lemon-squeezy/route.ts
// Lemon Squeezy webhook handler — the "Truth Layer" for subscription state.
// Product-scoped and idempotent mutation is delegated to a single PostgreSQL
// RPC so webhook claim, ordering checks, subscription mutation, and ledger
// status commit together.

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

    if (!webhookId) {
      return NextResponse.json({ error: 'Missing webhook id' }, { status: 400 });
    }

    // Determine plan and participant cap based on event
    const attributes = payload?.data?.attributes ?? {};
    const status: string = attributes.status ?? 'unknown';
    const productName: string = attributes.product_name ?? '';
    const variantName: string = attributes.variant_name ?? '';

    // Map Lemon Squeezy product/variant to our internal product-scoped plan.
    // Unknown products/variants fail closed and remain retryable.
    const planData = mapPlanFromProduct(productName, variantName, customData?.plan_tier);

    const externalEventAt = resolveExternalEventTime(attributes);
    if (!externalEventAt) {
      console.error('[LemonSqueezyWebhook] Missing provider ordering timestamp', {
        eventName,
        webhookId,
        subscriptionId,
      });
      return NextResponse.json(
        { error: 'Webhook missing provider ordering timestamp' },
        { status: 422 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'process_lemon_squeezy_subscription_webhook',
      {
        p_webhook_id: webhookId,
        p_event_name: eventName,
        p_external_subscription_id: subscriptionId,
        p_user_id: userId,
        p_product_line: planData.productLine,
        p_plan: planData.plan,
        p_participant_cap: planData.participantCap,
        p_status: mapSubscriptionStatus(status),
        p_external_event_at: externalEventAt,
        p_external_order_id: attributes.order_id ? String(attributes.order_id) : null,
        p_current_period_start: parseNullableDate(attributes.renews_at),
        p_current_period_end: parseNullableDate(attributes.ends_at),
      }
    );

    if (rpcError) {
      throw new Error(`Atomic webhook processing failed: ${rpcError.message}`);
    }

    return NextResponse.json({ received: true, event: eventName, result: rpcResult });
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
): { plan: string; participantCap: number; productLine: 'meet' | 'class' } {
  // 1) Trust the custom_data plan_tier sent at checkout
  switch (planTier) {
    case 'class_10':
      return { plan: 'class_10', participantCap: 10, productLine: 'class' };
    case 'class_20':
      return { plan: 'class_20', participantCap: 20, productLine: 'class' };
    case 'class_30':
      return { plan: 'class_30', participantCap: 30, productLine: 'class' };
    case 'classroom':
      return { plan: 'class_10', participantCap: 10, productLine: 'class' };
    case 'classroom_plus':
      throw new Error('Legacy classroom_plus webhook mapping is UNVERIFIED; refusing to grant entitlement');
    case 'individual':
      return { plan: 'meet_individual', participantCap: 10, productLine: 'meet' };
    case 'pro':
      return { plan: 'meet_pro', participantCap: 50, productLine: 'meet' };
    case 'business':
      return { plan: 'meet_pro', participantCap: 50, productLine: 'meet' };
    case 'unlimited':
      return { plan: 'meet_unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP, productLine: 'meet' };
  }

  // 2) Fallback: parse the product / variant name (order matters — 'classroom plus'
  //    must be checked before plain 'classroom' so we don't false-match).
  const lp = productName.toLowerCase();
  const lv = variantName.toLowerCase();

  if (lp.includes('class 30') || lv.includes('class 30')) {
    return { plan: 'class_30', participantCap: 30, productLine: 'class' };
  }
  if (lp.includes('class 20') || lv.includes('class 20')) {
    return { plan: 'class_20', participantCap: 20, productLine: 'class' };
  }
  if (lp.includes('classroom plus') || lv.includes('classroom plus')) {
    throw new Error('Legacy classroom_plus webhook mapping is UNVERIFIED; refusing to grant entitlement');
  }
  if (lp.includes('unlimited') || lv.includes('unlimited')) {
    return { plan: 'meet_unlimited', participantCap: UNLIMITED_PARTICIPANT_CAP, productLine: 'meet' };
  }
  if (lp.includes('classroom') || lv.includes('classroom')) {
    return { plan: 'class_10', participantCap: 10, productLine: 'class' };
  }
  if (lp.includes('individual') || lv.includes('individual')) {
    return { plan: 'meet_individual', participantCap: 10, productLine: 'meet' };
  }
  if (lp.includes('business') || lv.includes('business')) {
    return { plan: 'meet_pro', participantCap: 50, productLine: 'meet' };
  }
  if (lp.includes('pro') || lv.includes('pro')) {
    return { plan: 'meet_pro', participantCap: 50, productLine: 'meet' };
  }
  if (lp.includes('enterprise') || lv.includes('enterprise')) {
    throw new Error('Enterprise is contact-sales only; refusing automatic entitlement grant');
  }

  throw new Error('Unknown Lemon Squeezy product or variant; refusing entitlement grant');
}

/**
 * Map Lemon Squeezy status to our internal status.
 * Event context is used so cancelled/expired events set the right lifecycle state.
 */
function mapSubscriptionStatus(lsStatus: string): string {
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
      throw new Error(`Unknown Lemon Squeezy subscription status: ${lsStatus}`);
  }
}

function parseNullableDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveExternalEventTime(attributes: Record<string, unknown>): string | null {
  return (
    parseNullableDate(attributes.updated_at) ??
    parseNullableDate(attributes.created_at) ??
    parseNullableDate(attributes.renews_at) ??
    parseNullableDate(attributes.ends_at)
  );
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