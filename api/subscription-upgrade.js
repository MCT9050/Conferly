import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });
  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { tier, billingCycle, amountZar, peachTransactionId } = body || {};
  if (!tier || !billingCycle) return json(res, 400, { error: 'tier and billingCycle required' });

  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      plan_tier: tier,
      billing_cycle: billingCycle,
      plan_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) return json(res, 400, { error: updateError.message });

  if (amountZar) {
    await supabaseAdmin.from('payments').insert({
      user_id: user.id,
      plan_tier: tier,
      billing_cycle: billingCycle,
      amount_zar: amountZar,
      currency: 'ZAR',
      status: 'completed',
      peach_transaction_id: peachTransactionId || null,
    });
  }

  return json(res, 200, {
    tier,
    billingCycle,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
  });
}
