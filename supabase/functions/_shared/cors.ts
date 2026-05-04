export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
}

export function cors(req: Request) {
  const origin = req.headers.get('origin')
  const allowedOrigins = [
    'https://conferly.site',
    'https://www.conferly.site',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
  
  if (allowedOrigins.includes(origin || '')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
    }
  }
  
  return corsHeaders
}
