import { json } from './_lib/supabase-admin.js';

export default async function handler(_req, res) {
  return json(res, 200, {
    status: 'ok',
    service: 'Conferly API',
    timestamp: new Date().toISOString(),
    runtime: 'vercel',
  });
}
