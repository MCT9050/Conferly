# Conferly

Premium real-time video conferencing platform with AI-powered collaboration.

## Architecture

Conferly is built on a modern, Vercel-native architecture:

- **Framework**: Next.js 16 with App Router
- **Deployment**: Vercel (auto-deploys from GitHub main branch)
- **Auth**: Supabase SSR for session management
- **Realtime**: LiveKit for video conferencing
- **Build**: Turbopack for fast development builds

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | App Router framework |
| React 18 | UI library |
| TypeScript | Type safety |
| Supabase | Authentication & database |
| LiveKit | Real-time video/audio |
| Tailwind CSS | Styling |
| Vercel | Platform deployment |

## Routes

| Route | Description | Auth Required |
|-------|-------------|--------------|
| `/` | Homepage | No |
| `/landing` | Landing page | No |
| `/auth` | Sign in/up | No |
| `/dashboard` | User dashboard | Yes |
| `/room/[id]` | Video meeting | Yes |
| `/api/health` | Health check | No |
| `/api/livekit/token` | Token generation | No |

## Environment Variables

Required for production:

```
# Supabase (required for auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LiveKit (required for video)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit.io
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

Note: Prefix variables with `NEXT_PUBLIC_` only if needed client-side.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

Vercel automatically deploys on push to the `main` branch. No custom workflow required.

1. Connect repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

**Production Status**: Fully Vercel-native. No GitHub Pages. No Vite runtime. No Express. No legacy deployment.

## Project Structure

```
/workspace/project/Conferly/
├── app/                    # Next.js App Router
│   ├── api/              # API routes
│   │   ├── health/       # Health check endpoint
│   │   └── livekit/     # LiveKit token endpoint
│   ├── auth/            # Authentication page
│   ├── dashboard/       # Protected dashboard
│   ├── landing/        # Landing page
│   ├── room/[id]/      # Meeting room
│   ├── lib/           # Utilities & hooks
│   └── components/     # Reusable components
├── public/             # Static assets
├── middleware.ts      # Auth protection
├── next.config.mjs    # Next.js config
└── package.json      # Dependencies
```

## Production Status

| Component | Status |
|-----------|--------|
| Next.js App Router | ✅ Active |
| Vercel deployment | ✅ Auto-deploy |
| Supabase auth | ✅ Configured |
| LiveKit realtime | ✅ Configured |
| Legacy runtime | ✅ Removed |

---

© 2024 Conferly