import crypto from 'crypto';
import { json } from './_lib/supabase-admin.js';

const PEACH_ENTITY_ID = process.env.VITE_PEACH_ENTITY_ID || process.env.PEACH_ENTITY_ID || '';
const PEACH_SECRET = process.env.VITE_PEACH_SECRET || process.env.PEACH_SECRET || '';
const PEACH_MODE = process.env.VITE_PEACH_MODE || process.env.PEACH_MODE || 'sandbox';

const CHECKOUT_URLS = {
  sandbox: 'https://testsecure.peachpayments.com/checkout/initiate',
  live: 'https://secure.peachpayments.com/checkout/initiate',
};

const PLAN_PRICES_ZAR = {
  pro: { monthly: 220, annual: 165 },
  business: { monthly: 460, annual: 370 },
};

function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function computeSignature(params) {
  const sorted = Object.keys(params).sort();
  const message = sorted.map(k => `${k}${params[k]}`).join('') + PEACH_SECRET;
  return crypto.createHash('sha256').update(message).digest('hex');
}

export default async function handler(req, res) {
  if (!PEACH_ENTITY_ID || !PEACH_SECRET) return json(res, 500, { error: 'Peach not configured' });

  const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : req.query;
  const { planTier, billingCycle, userEmail, userName, userId, userCount = 1 } = body || {};
  if (!planTier || !billingCycle || !userEmail || !userName || !userId) {
    return json(res, 400, { error: 'Missing checkout parameters' });
  }

  const price = PLAN_PRICES_ZAR[planTier];
  if (!price) return json(res, 400, { error: 'Unsupported plan' });

  const unit = billingCycle === 'annual' ? price.annual : price.monthly;
  const totalAmount = (unit * Number(userCount)).toFixed(2);
  const txId = `CONFERLY-${String(planTier).toUpperCase()}-${Date.now()}`;
  const host = req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const resultUrl = `${proto}://${host}/?payment=complete&plan=${planTier}&cycle=${billingCycle}`;

  const formParams = {
    'authentication.entityId': PEACH_ENTITY_ID,
    merchantTransactionId: txId,
    amount: totalAmount,
    currency: 'ZAR',
    paymentType: 'DB',
    nonce: generateNonce(),
    shopperResultUrl: resultUrl,
    defaultPaymentMethod: 'CARD',
    'customer.email': userEmail,
    'customer.givenName': String(userName).split(' ')[0] || 'User',
    'customer.surname': String(userName).split(' ').slice(1).join(' ') || 'User',
    merchantInvoiceId: txId,
    'customParameters[planTier]': planTier,
    'customParameters[billingCycle]': billingCycle,
    'customParameters[userId]': userId,
  };

  formParams.signature = computeSignature(formParams);

  const action = CHECKOUT_URLS[PEACH_MODE] || CHECKOUT_URLS.sandbox;
  const inputs = Object.entries(formParams)
    .map(([k, v]) => `<input type="hidden" name="${String(k).replace(/"/g, '&quot;')}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to Conferly payment…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
      .box{max-width:420px;padding:40px;border-radius:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}
      .brand{font-size:28px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}
      .loader{width:36px;height:36px;border:3px solid rgba(255,255,255,.12);border-top-color:#f59e0b;border-radius:999px;animation:spin 1s linear infinite;margin:24px auto}
      @keyframes spin { to { transform: rotate(360deg) } }
      p{color:#94a3b8;line-height:1.6}
    </style>
  </head>
  <body>
    <div class="box">
      <div class="brand">Conferly</div>
      <p>Redirecting you securely to Peach Payments…</p>
      <div class="loader"></div>
      <form id="peach-form" method="POST" action="${action}">${inputs}</form>
    </div>
    <script>document.getElementById('peach-form').submit();</script>
  </body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}
