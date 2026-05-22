# ENVIRONMENT_SETUP.md

Purpose: Document environment variables and how to configure them for local development, staging, and production.

Required server environment variables
- `NODE_ENV` — should be `development`, `production`, or `test`.
- `SUPABASE_URL` — the production Supabase project URL.
- `SUPABASE_ANON_KEY` — the published Supabase anon/public key.

Optional monitoring variables
- `MONITORING_ENDPOINT` — URL for event ingestion or monitoring service.
- `MONITORING_KEY` — API key used to authenticate monitoring requests.

Local development setup
- Copy `.env.example` to `.env.local` and fill in the required values.
- Use `npm ci` after updating dependencies.
- Run the app locally with `npm run dev` or `npm run build && npm start`.
- Keep `.env.local` and any `.env.*` files out of source control; they are ignored by `.gitignore`.

Vercel production setup
- Add the same required variables in the Vercel project dashboard under Production.
- Ensure the production Vercel environment uses `NODE_ENV=production`.
- Do not set private Supabase keys in public scope; only server-side variables should be used for production backend code.

Supabase auth configuration
- Confirm the Supabase Auth settings include the Vercel production URL as an allowed redirect.
- Confirm sign-in and sign-out callback URLs match the deployed domain.
- Use a dedicated Supabase project for production if possible.

Deployment readiness notes
- After deployment, verify the Vercel project has the required environment variables set.
- Use `vercel env pull .env.local production` for local reproduction if needed.
- Keep secrets in the Vercel dashboard, not in repository files.
