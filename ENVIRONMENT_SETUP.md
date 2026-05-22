# ENVIRONMENT_SETUP.md

Purpose: Document environment variables and how to configure them for local, staging, and production.

Required Environment Variables (server-only)
- `SUPABASE_URL` — Supabase project URL (server)
- `SUPABASE_ANON_KEY` — Supabase anon/public key (server). Use service role keys only on trusted servers.

Optional Monitoring
- `MONITORING_ENDPOINT` — URL to ingest monitoring events
- `MONITORING_KEY` — API key for monitoring ingestion

Local Development
- Copy `.env.example` to `.env.local` and populate values for local testing.
- `.env.local` is gitignored.

Production (Vercel)
- Add environment variables in Vercel project settings.
- Ensure `NODE_ENV` is `production` for production deployments.

Security Notes
- Never commit `.env.local` or other secret files.
- Rotate keys regularly and use least-privilege keys for production.
