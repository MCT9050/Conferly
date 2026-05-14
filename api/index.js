import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL 
  || process.env.SUPABASE_URL 
  || process.env.SUPABASE_PROJECT_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY 
  || process.env.SUPABASE_ANON_KEY 
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  const path = req.url.split('?')[0];
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (path === '/api/health') {
    return res.status(200).json({ 
      status: 'ok', timestamp: new Date().toISOString(),
      version: '1.0.0', database: supabase ? 'supabase' : 'not configured'
    });
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && req.method === 'POST') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ user: data.user, session: data.session });
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && req.method === 'POST') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    await supabase.auth.signOut();
    return res.status(200).json({ loggedOut: true });
  }

  // GET /api/auth/verify-email
  if (path === '/api/auth/verify-email' && req.method === 'GET') {
    const { email } = req.query;
    if (supabase && email) {
      const { data } = await supabase.from('profiles').select('email').eq('email', email).single();
      return res.status(200).json({ exists: !!data });
    }
    return res.status(200).json({ exists: true });
  }

  // GET /api/meetings
  if (path === '/api/meetings' && req.method === 'GET') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { data } = await supabase.from('meetings').select('*').order('created_at', { ascending: false }).limit(50);
    return res.status(200).json({ meetings: data || [] });
  }

  // POST /api/meetings
  if (path === '/api/meetings' && req.method === 'POST') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Authentication required' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { data, error } = await supabase.from('meetings').insert([{ title: body.title || 'New Meeting', host_id: user.id }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ meeting: data });
  }

  // GET /api/profile
  if (path === '/api/profile' && req.method === 'GET') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return res.status(200).json({ profile: profile || { id: user.id, email: user.email } });
  }

  // GET /api/subscription
  if (path === '/api/subscription' && req.method === 'GET') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    const { data: profile } = await supabase.from('profiles').select('subscription_tier, subscription_status').eq('id', user.id).single();
    return res.status(200).json({ tier: profile?.subscription_tier || 'free', status: profile?.subscription_status || 'active' });
  }

  // GET /api/analytics
  if (path === '/api/analytics' && req.method === 'GET') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { data } = await supabase.from('meetings').select('title, created_at').order('created_at', { ascending: false }).limit(20);
    return res.status(200).json({ events: data || [] });
  }

  res.status(404).json({ error: 'Not found', path });
}