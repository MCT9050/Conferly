import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });
  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });
  if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { id, durationSeconds, participantCount } = body || {};
  if (!id) return json(res, 400, { error: 'meeting id required' });

  const { error } = await supabaseAdmin
    .from('meetings')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds || 0,
      participant_count: participantCount || 1,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { success: true });
}
