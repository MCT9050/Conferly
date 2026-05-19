import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });
  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id,plan_tier,billing_cycle,amount_zar,currency,status,peach_transaction_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return json(res, 400, { error: error.message });

  return json(res, 200, (data || []).map(p => ({
    id: p.id,
    planTier: p.plan_tier,
    billingCycle: p.billing_cycle,
    amountZar: p.amount_zar,
    currency: p.currency,
    status: p.status,
    peachTransactionId: p.peach_transaction_id,
    createdAt: p.created_at,
  })));
}
