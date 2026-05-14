import { createClient } from '@supabase/supabase-js';

// Vercel serverless API handler
// https://vercel.com/docs/serverless-functions

const JWT_SECRET = process.env.JWT_SECRET || 'conferly-dev-secret';

// Support multiple naming conventions
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

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  const path = req.url.split('?')[0];
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (path === '/api/health') {
    return res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: supabase ? 'supabase' : 'not configured'
    });
  }

  // Auth endpoints
  if (path === '/api/auth/verify-email') {
    return handleVerifyEmail(req, res);
  }

  // Meeting endpoints
  if (path.startsWith('/api/meetings')) {
    return handleMeetings(req, res);
  }

  // Profile endpoints
  if (path === '/api/profile') {
    return handleProfile(req, res);
  }

  // Subscription endpoints
  if (path === '/api/subscription') {
    return handleSubscription(req, res);
  }

  // Analytics
  if (path === '/api/analytics') {
    return handleAnalytics(req, res);
  }

  // Fallback - Not Found
  res.status(404).json({ error: 'Not found', path });
}

async function handleVerifyEmail(req, res) {
  const { email } = req.query;
  
  if (req.method === 'GET' && email) {
    // Check if email exists in Supabase
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('email, email_verified')
        .eq('email', email)
        .single();
      
      return res.status(200).json({ 
        exists: !!data,
        verified: data?.email_verified || false
      });
    }
    
    return res.status(200).json({ exists: true, verified: false });
  }
  
  res.status(400).json({ error: 'Email required' });
}

async function handleMeetings(req, res) {
  const path = req.url;
  
  // GET /api/meetings
  if (req.method === 'GET' && path === '/api/meetings') {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }
    
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json({ meetings: data || [] });
  }
  
  // POST /api/meetings - Create meeting
  if (req.method === 'POST') {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }
    
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([{
          title: 'New Meeting',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
    
      if (error) {
        console.log('Meeting insert error:', error);
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(201).json({ meeting: data });
    } catch (err) {
      console.log('Meeting error:', err);
      return res.status(500).json({ error: String(err) });
    }
  }
  
  res.status(404).json({ error: 'Endpoint not found' });
}

async function handleProfile(req, res) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  
  // GET /api/profile
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return res.status(200).json({ profile: profile || { id: user.id, email: user.email } });
  }
  
  res.status(404).json({ error: 'Endpoint not found' });
}

async function handleSubscription(req, res) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  
  // GET /api/subscription
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check for subscription in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .single();
    
    return res.status(200).json({ 
      tier: profile?.subscription_tier || 'free',
      status: profile?.subscription_status || 'active'
    });
  }
  
  res.status(404).json({ error: 'Endpoint not found' });
}

async function handleAnalytics(req, res) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }
  
  // GET /api/analytics
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type, count, last_occurred')
      .order('count', { ascending: false })
      .limit(20);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json({ events: data || [] });
  }
  
  // POST /api/analytics - Track event
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { eventType, metadata } = body;
    
    const { error } = await supabase
      .from('analytics_events')
      .insert([{
        event_type: eventType,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date().toISOString()
      }]);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(201).json({ tracked: true });
  }
  
  res.status(404).json({ error: 'Endpoint not found' });
}