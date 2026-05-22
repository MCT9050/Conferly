# DEPLOYMENT.md

Purpose: Steps and checklist to deploy Conferly to Vercel (production).

Prerequisites
- Vercel account and project connected to this repository.
- Environment variables configured in Vercel (see `ENVIRONMENT_SETUP.md`).

Quick Deploy Steps
1. Ensure `origin/main` contains the finalized Next.js codebase.
2. Push the branch to `origin` and open a PR if required by policy.
3. In Vercel, set the project to use Node.js 20 (or compatible) and the standard Next.js build.
4. Configure Environment Variables (see `ENVIRONMENT_SETUP.md`).
5. Trigger a deployment and monitor build logs.

Smoke Tests (post-deploy)
- Visit the app root and confirm 200 response.
- Verify `/api/health` and `/api/deployment-check` endpoints.
- Ensure PWA assets are served (manifest, sw.js).
- Run basic auth/sign-in flow against production Supabase keys (use a staging Supabase project).

Rollback
- Use Vercel's deployments page to rollback to previous deployment if needed.

Notes
- Do not commit secrets to repo. Use Vercel environment variables.
- For real traffic, use a staging deployment first.
