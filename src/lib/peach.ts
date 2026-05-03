// Peach Payments Integration — Hosted Checkout via Form POST
// Uses form submission (no CORS issues) to redirect to Peach's hosted payment page.
// Credentials are provided via environment variables at build time.

const PEACH_ENTITY_ID = import.meta.env.VITE_PEACH_ENTITY_ID || '';
const PEACH_SECRET = import.meta.env.VITE_PEACH_SECRET || '';
const PEACH_MODE = import.meta.env.VITE_PEACH_MODE || 'sandbox';

const CHECKOUT_URLS: Record<string, string> = {
  sandbox: 'https://testsecure.peachpayments.com/checkout/initiate',
  live: 'https://secure.peachpayments.com/checkout/initiate',
};

export const isPeachConfigured = !!(PEACH_ENTITY_ID && PEACH_SECRET);

// ZAR pricing per user
export const PLAN_PRICES_ZAR: Record<string, { monthly: number; annual: number }> = {
  pro:        { monthly: 220,  annual: 165 },
  business:   { monthly: 460,  annual: 370 },
  enterprise: { monthly: 0,    annual: 0 },
};

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function computeSignature(params: Record<string, string>): Promise<string> {
  // Peach signature: SHA-256 of sorted param key+value pairs concatenated with the secret
  const sorted = Object.keys(params).sort();
  const message = sorted.map(k => `${k}${params[k]}`).join('') + PEACH_SECRET;
  const encoded = new TextEncoder().encode(message);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CheckoutParams {
  planTier: string;
  billingCycle: 'monthly' | 'annual';
  userEmail: string;
  userName: string;
  userId: string;
  userCount: number;
}

/**
 * Creates a hidden form and submits it to Peach Payments.
 * This avoids CORS entirely — form POSTs are not subject to same-origin policy.
 * The browser navigates to Peach's hosted payment page.
 * After payment, Peach redirects back to shopperResultUrl.
 */
export async function redirectToCheckout(params: CheckoutParams): Promise<void> {
  if (!isPeachConfigured) {
    throw new Error('Peach Payments not configured.');
  }

  const prices = PLAN_PRICES_ZAR[params.planTier];
  if (!prices || prices.monthly === 0) throw new Error(`No pricing for plan: ${params.planTier}`);

  const pricePerUser = params.billingCycle === 'annual' ? prices.annual : prices.monthly;
  const totalAmount = (pricePerUser * params.userCount).toFixed(2);
  const txId = `CONFERLY-${params.planTier.toUpperCase()}-${Date.now()}`;
  const resultUrl = `${window.location.origin}/?payment=complete&plan=${params.planTier}&cycle=${params.billingCycle}`;

  const formParams: Record<string, string> = {
    'authentication.entityId': PEACH_ENTITY_ID,
    'merchantTransactionId': txId,
    'amount': totalAmount,
    'currency': 'ZAR',
    'paymentType': 'DB',
    'nonce': generateNonce(),
    'shopperResultUrl': resultUrl,
    'defaultPaymentMethod': 'CARD',
    'customer.email': params.userEmail,
    'customer.givenName': params.userName.split(' ')[0] || 'User',
    'customer.surname': params.userName.split(' ').slice(1).join(' ') || 'User',
    'merchantInvoiceId': txId,
    'customParameters[planTier]': params.planTier,
    'customParameters[billingCycle]': params.billingCycle,
    'customParameters[userId]': params.userId,
  };

  // Compute and add signature
  const signature = await computeSignature(formParams);
  formParams['signature'] = signature;

  // Create a hidden form and submit it — bypasses CORS completely
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = CHECKOUT_URLS[PEACH_MODE] || CHECKOUT_URLS.sandbox;
  form.style.display = 'none';

  for (const [key, value] of Object.entries(formParams)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  // Browser navigates away — no code runs after this
}

// Detect return from Peach payment redirect
export function checkPaymentReturn(): { success: boolean; plan?: string; cycle?: string } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') !== 'complete') return null;

  const plan = params.get('plan') || undefined;
  const cycle = params.get('cycle') || undefined;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  return { success: true, plan, cycle };
}
