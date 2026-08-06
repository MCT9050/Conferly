// lib/lemon-squeezy.ts
// Lightweight Lemon Squeezy API wrapper using native fetch
// No heavy SDK dependency — RAM-friendly for 6GB constraint

import crypto from 'crypto';

export type LemonSqueezyConfig = {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
};

/**
 * The commercial tiers exposed in Conferly's checkout.
 *
 * NEW product-scoped plan keys (Phase 2):
 *   class_10, class_20, class_30  — Class product line
 *
 * LEGACY tiers preserved for backward compatibility with existing
 * subscribers and checkouts. They map to the new product-scoped
 * plan keys on the webhook side (see mapPlanFromProduct).
 */
export type SupportedPlanTier =
  | 'class_10'
  | 'class_20'
  | 'class_30'
  | 'classroom' // legacy — maps to class_10
  | 'classroom_plus' // legacy — UNVERIFIED treatment (deployment decision required)
  | 'individual'
  | 'pro'
  | 'unlimited';

export type CheckoutOptions = {
  userId: string;
  roomType: 'meeting' | 'class';
  planTier: SupportedPlanTier;
  variantId: number;
  successUrl: string;
  cancelUrl: string;
  email?: string;
  currency?: string;
};

export type CheckoutResult = {
  url: string;
  id: string;
};

export type LemonSqueezyEvent =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'subscription_payment_failed'
  | 'order_created'
  | 'order_refunded';

export type LemonSqueezyWebhookPayload = {
  meta: {
    event_name: LemonSqueezyEvent;
    webhook_id: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
};

let cachedConfig: LemonSqueezyConfig | null = null;

/**
 * Resolve config from either LEMONSQUEEZY_* (preferred) or LEMON_SQUEEZY_* (legacy) env vars.
 */
export function getLemonSqueezyConfig(): LemonSqueezyConfig {
  if (cachedConfig) return cachedConfig;

  // Prefer new env var names (LEMONSQUEEZY_*), fall back to legacy (LEMON_SQUEEZY_*)
  const apiKey = process.env.LEMONSQUEEZY_API_KEY || process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID || process.env.LEMON_SQUEEZY_STORE_ID;
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

  if (!apiKey || !storeId || !webhookSecret) {
    throw new Error(
      'Missing Lemon Squeezy configuration. Set LEMONSQUEEZY_API_KEY, ' +
      'LEMONSQUEEZY_STORE_ID, and LEMONSQUEEZY_WEBHOOK_SECRET in your environment.'
    );
  }

  cachedConfig = { apiKey, storeId, webhookSecret };
  return cachedConfig;
}

const LEMON_SQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

/**
 * Generate a Lemon Squeezy Checkout URL.
 * Uses native fetch — no SDK dependency.
 * Passes userId, roomType, and planTier as custom_data for webhook identification.
 */
export async function generateCheckoutUrl(options: CheckoutOptions): Promise<CheckoutResult> {
  const config = getLemonSqueezyConfig();

  const body: {
    data: {
      type: string;
      attributes: Record<string, unknown>;
    };
  } = {
    data: {
      type: 'checkouts',
      attributes: {
        store_id: parseInt(config.storeId, 10),
        variant_id: options.variantId,
        custom_price: null,
        product_options: {
          enabled_variants: [options.variantId],
        },
        checkout_data: {
          email: options.email ?? '',
          custom: {
            user_id: options.userId,
            room_type: options.roomType,
            plan_tier: options.planTier,
          },
        },
        receipt_button_text: "Go to Dashboard",
        receipt_link_url: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`
          : 'https://conferly.site/dashboard',
        receipt_thank_you_note: "Thank you for choosing Conferly! Your subscription is now active, and your workspace has been successfully upgraded. You can start your first session right away from your dashboard.",
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
          desc: true,
          discount: false,
          dark: false,
          subscription_preview: true,
        },
        expires_at: null,
        preview: false,
        test_mode: process.env.NODE_ENV !== 'production',
      },
    },
  };

  // Set currency explicitly if provided (required for ZAR support)
  if (options.currency) {
    body.data.attributes.currency = options.currency;
  }

  const response = await fetch(`${LEMON_SQUEEZY_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Lemon Squeezy checkout failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const checkoutUrl = result?.data?.attributes?.url;
  const checkoutId = result?.data?.id;

  if (!checkoutUrl) {
    throw new Error('Lemon Squeezy returned a checkout response without a URL');
  }

  return { url: checkoutUrl, id: checkoutId };
}

/**
 * Map from each commercial plan to the env-var name holding its Lemon Squeezy variant ID.
 * Keeping this as the single source of truth avoids stringly-typed lookups elsewhere.
 *
 * Class 20 and Class 30 variant IDs are UNVERIFIED until the Lemon Squeezy
 * dashboard confirms the R120/R140 variants exist. The env vars are prepared
 * here so a deployment checklist item can fill them in once proven.
 */
const PLAN_TO_VARIANT_ENV: Record<SupportedPlanTier, string> = {
  class_10:         'NEXT_PUBLIC_VARIANT_ID_CLASSROOM',
  class_20:         'NEXT_PUBLIC_VARIANT_ID_CLASS_20',
  class_30:         'NEXT_PUBLIC_VARIANT_ID_CLASS_30',
  classroom:        'NEXT_PUBLIC_VARIANT_ID_CLASSROOM',
  classroom_plus:   'NEXT_PUBLIC_VARIANT_ID_CLASSROOM_PLUS',
  individual:       'NEXT_PUBLIC_VARIANT_ID_INDIVIDUAL',
  pro:              'NEXT_PUBLIC_VARIANT_ID_PRO',
  unlimited:        'NEXT_PUBLIC_VARIANT_ID_UNLIMITED',
};

/**
 * Resolve the Lemon Squeezy variant ID for a given plan.
 * Falls back to NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID (legacy R89 default) if a
 * tier-specific env var has not been set yet — useful during staged rollouts.
 */
function resolveVariantId(plan: SupportedPlanTier): number {
  const envName = PLAN_TO_VARIANT_ENV[plan];
  const raw = process.env[envName] || process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID;

  if (!raw) {
    throw new Error(
      `Missing Lemon Squeezy variant ID for plan "${plan}". ` +
      `Set ${envName} (or NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID as a legacy fallback).`
    );
  }

  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) {
    throw new Error(`Invalid ${envName}: "${raw}" must be a positive integer.`);
  }
  return id;
}

/**
 * Room type implied by a given plan. Class plans host on a class room
 * (whiteboard + tutor AI). All other plans host on a business meeting.
 */
function resolveRoomType(plan: SupportedPlanTier): 'meeting' | 'class' {
  if (
    plan === 'class_10' ||
    plan === 'class_20' ||
    plan === 'class_30' ||
    plan === 'classroom' ||
    plan === 'classroom_plus'
  ) {
    return 'class';
  }
  return 'meeting';
}

/**
 * Create a Lemon Squeezy checkout URL for a supported commercial tier.
 *
 * @param userId  - The authenticated user's ID (passed as custom_data for the webhook).
 * @param plan    - Which tier to mint a checkout for.
 * @returns A Lemon Squeezy checkout URL.
 */
export async function createCheckout(
  userId: string,
  plan: SupportedPlanTier
): Promise<CheckoutResult> {
  const variantId = resolveVariantId(plan);
  const roomType = resolveRoomType(plan);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return generateCheckoutUrl({
    userId,
    roomType,
    planTier: plan,
    variantId,
    currency: 'ZAR',
    successUrl: `${appUrl}/dashboard?checkout=success`,
    cancelUrl: `${appUrl}/dashboard?checkout=cancelled`,
  });
}

/**
 * Verify a Lemon Squeezy webhook signature.
 * Uses the signing secret to validate incoming webhooks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Fetch a subscription by ID from Lemon Squeezy API.
 */
export async function getLemonSqueezySubscription(subscriptionId: string): Promise<Record<string, unknown> | null> {
  const config = getLemonSqueezyConfig();

  const response = await fetch(`${LEMON_SQUEEZY_API_BASE}/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch subscription (${response.status})`);
  }

  const result = await response.json();
  return result?.data ?? null;
}