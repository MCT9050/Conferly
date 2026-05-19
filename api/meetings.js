import { supabaseAdmin, getAuthenticatedUser, json } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (!supabaseAdmin) return json(res, 500, { error: 'Supabase admin not configured' });
  const user = await getAuthenticatedUser(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select('id,room_code,title,started_at,ended_at,duration_seconds,participant_count')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) return json(res, 400, { error: error.message });

    return json(res, 200, (data || []).map(m => ({
      id: m.id,
      roomCode: m.room_code,
      title: m.title,
      startedAt: m.started_at,
      endedAt: m.ended_at,
      durationSeconds: m.duration_seconds,
      participantCount: m.participant_count,
    })));
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { roomCode, title } = body || {};
    if (!roomCode) return json(res, 400, { error: 'roomCode required' });

    const { data, error } = await supabaseAdmin
      .from('meetings')
      .insert({ user_id: user.id, room_code: roomCode, title: title || null })
      .select('id,room_code,title')
      .single();

    if (error || !data) return json(res, 400, { error: error?.message || 'Create failed' });

    return json(res, 201, { id: data.id, roomCode: data.room_code, title: data.title });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
