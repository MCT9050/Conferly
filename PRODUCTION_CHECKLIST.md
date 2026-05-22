# PRODUCTION_CHECKLIST.md

A concise checklist to validate the application before pushing to `origin/main` and deploying to production.

Pre-push
- [ ] Create `backup/pre-cleanup-<date>` branch locally
- [ ] Ensure `.env.example` present and no `.env.*` files committed
- [ ] Delete or ensure `.next/` is ignored
- [ ] Run `npm ci` on a clean checkout
- [ ] Run `npm run lint` and fix errors
- [ ] Run `npm run build` successfully
- [ ] Run `npm start` locally in production mode and verify endpoints

Post-push / Pre-deploy
- [ ] Configure Vercel environment variables
- [ ] Deploy to a staging Vercel environment
- [ ] Run smoke tests (health endpoint, auth, PWA assets)
- [ ] Run performance & reconnection tests on mobile

Post-deploy
- [ ] Verify monitoring events arrive
- [ ] Set up alerts for error spikes and high latency
- [ ] Execute rollback drill

Notes
- Keep deployment runbooks up-to-date in `OPERATIONAL_READINESS.md`.
