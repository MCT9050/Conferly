# Conferly

Premium video conferencing with real-time AI translation.

## Architecture

Built on **Next.js App Router** + **Vercel** for production deployment.

### Stack

- **Framework**: Next.js 16.2.6 with Turbopack
- **Deployment**: Vercel (auto-deploys from GitHub)
- **Auth**: Supabase SSR
- **Realtime**: LiveKit

### Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage (redirects to landing) |
| `/landing` | Landing page |
| `/auth` | Authentication |
| `/dashboard` | User dashboard (protected) |
| `/room/[id]` | Meeting room |
| `/api/health` | Health check |
| `/api/livekit/token` | LiveKit token generation |

## Development

```bash
npm install
npm run dev
```

## Environment Variables

Required for production:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
LIVEKIT_URL=wss://xxx.livekit.io
LIVEKIT_API_KEY=xxx
LIVEKIT_API_SECRET=xxx
```

Note: Prefix client-side variables with `NEXT_PUBLIC_`.

## Build

```bash
npm run build
```

## Deployment

Vercel automatically deploys on push to `main`. No custom workflow required.

## License

© 2024 Conferly