# DEPLOYMENT.md

Purpose: Steps and checklist to deploy Conferly to Vercel for production.

Vercel project setup
- Create or connect the Vercel project to this GitHub repository.
- Set the root directory to `/` and enable the Next.js framework preset.
- Confirm the build command is `npm run build` and the install command is `npm ci`.
- Configure the Node.js version to `20.x` or compatible.
- Ensure the output directory is left blank for Next.js App Router.

Branch and deployment policy
- Deploy from `origin/main` only once the branch is finalized.
- Use Vercel Preview deployments for PR validation before merging to `main`.
- Keep `main` protected if possible and use pull requests or manual approvals for production pushes.

Environment variables
- Add required values from `ENVIRONMENT_SETUP.md` in Vercel project settings.
- Use Production environment scope for live deployments.
- Do not store secrets in source control.

Auth and Supabase
- Confirm Supabase Auth redirect URLs match the deployed Vercel domain.
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct for the production Supabase project.
- Ensure server-only keys are kept out of client builds.

PWA and static assets
- Confirm `public/manifest.json`, `public/sw.js`, and icon assets are deployed.
- Validate that the service worker is registered successfully in production.
- Ensure Vercel serves the correct static assets and there is no legacy SPA `index.html` file.

Smoke tests (post-deploy)
- Visit `/` and confirm the page loads with HTTP 200.
- Verify `/api/health` returns a healthy status.
- Verify `/api/deployment-check` reports environment and deployment readiness.
- Confirm login and registration flows against the production Supabase project.
- Confirm PWA assets are reachable: `/manifest.json`, `/sw.js`, and icon assets.

Rollback and monitoring
- Use the Vercel deployments dashboard to rollback to the prior working deployment if issues occur.
- Monitor build logs on deploy and review any warnings.
- Keep documentation aligned with `OPERATIONAL_READINESS.md` for incident response.
