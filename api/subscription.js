import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });
  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier,billing_cycle,plan_period_end')
    .eq('id', user.id)
    .single();

  if (error || !data) return json(res, 404, { error: 'Subscription not found' });

  return json(res, 200, {
    tier: data.plan_tier || 'trial',
    billingCycle: data.billing_cycle || 'monthly',
    currentPeriodEnd: data.plan_period_end,
    cancelAtPeriodEnd: false,
  });
}
