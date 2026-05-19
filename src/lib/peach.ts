// Conferly Payments — frontend entry point
// Real checkout initiation is handled by Vercel backend at /api/payments-checkout

export const isPeachConfigured = true;

// ZAR pricing per user
export const PLAN_PRICES_ZAR: Record<string, { monthly: number; annual: number }> = {
  pro:        { monthly: 220,  annual: 165 },
  business:   { monthly: 460,  annual: 370 },
  enterprise: { monthly: 0,    annual: 0 },
};

export interface CheckoutParams {
  planTier: string;
  billingCycle: 'monthly' | 'annual';
  userEmail: string;
  userName: string;
  userId: string;
  userCount: number;
}

/**
 * Redirect to a same-origin Vercel function that securely signs and submits
 * the payment request to Peach Payments. No secrets remain in the browser.
 */
export async function redirectToCheckout(params: CheckoutParams): Promise<void> {
  const search = new URLSearchParams({
    planTier: params.planTier,
    billingCycle: params.billingCycle,
    userEmail: params.userEmail,
    userName: params.userName,
    userId: params.userId,
    userCount: String(params.userCount),
  });
  window.location.href = `/api/payments-checkout?${search.toString()}`;
}

// Detect return from Peach payment redirect
export function checkPaymentReturn(): { success: boolean; plan?: string; cycle?: string } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') !== 'complete') return null;
  const plan = params.get('plan') || undefined;
  const cycle = params.get('cycle') || undefined;
  window.history.replaceState({}, '', window.location.pathname);
  return { success: true, plan, cycle };
}
