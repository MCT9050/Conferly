# PRODUCTION_CHECKLIST.md

A concise checklist to validate Conferly before replacing `origin/main` and deploying to production.

Pre-push validation
- [ ] Confirm `git status` is clean and there are no generated artifacts staged.
- [ ] Ensure `.next/`, `.vercel/`, `.env*`, `*.tsbuildinfo`, and build artifacts are ignored.
- [ ] Verify required environment variables are documented and not committed.
- [ ] Run `npm ci` on a clean checkout.
- [ ] Run `npm run lint` and ensure there are no blocking errors.
- [ ] Run `npm run type-check` and confirm TypeScript passes.
- [ ] Run `npm run build` successfully.
- [ ] Run `npm start` locally in production mode and verify the app responds.

Pre-deploy and staging
- [ ] Configure Vercel production variables from `ENVIRONMENT_SETUP.md`.
- [ ] Deploy a preview or staging environment first.
- [ ] Confirm `/api/health`, `/api/deployment-check`, and auth routes return expected responses.
- [ ] Confirm PWA entry points are available: `/manifest.json`, `/sw.js`, and icon assets.
- [ ] Verify the production Next.js App Router structure on the deployed domain.

Post-deploy production
- [ ] Review Vercel deployment logs and confirm the build completed successfully.
- [ ] Validate live auth sign-in and session flow against production Supabase.
- [ ] Monitor errors and latency; confirm monitoring ingestion if configured.
- [ ] Keep rollback instructions available in `OPERATIONAL_READINESS.md`.

Notes
- Use the Vercel dashboard for rollback if the deployment is faulty.
- Keep environment secrets in Vercel, not in Git.
