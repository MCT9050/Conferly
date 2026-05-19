# Conferly — Deployment Guide

Conferly is now designed to be deployed primarily on **Vercel** for both frontend and backend logic, with **Supabase** as the primary auth/data layer and **Peach Payments** + **n8n** integrated through Vercel-friendly flows.

---

## Recommended Production Architecture

### Frontend
- **Vercel Static Frontend**
- React + TypeScript app built from the root project
- PWA enabled with service worker and manifest

### Backend
- **Vercel Serverless Functions** under `/api/*`
- Same-origin API calls from the frontend
- Secure payment initiation for Peach Payments
- Profile, meetings, subscription, and payment history endpoints

### Data / Auth
- **Supabase**
- Auth, profiles, meetings, transcripts, notes, payments

### Automation
- **n8n** (optional but recommended)
- Webhook-driven emails, reminders, and analytics

---

## What changed from the previous model

Conferly no longer relies on GitHub Pages as the primary deployment target.

Instead:
- frontend is deployed on Vercel
- backend endpoints are deployed on Vercel under `/api`
- Supabase remains the source of truth for auth and core data
- Peach Payments secrets stay server-side via Vercel environment variables

This gives you:
- one platform for frontend + backend
- same-origin communication
- simpler configuration
- easier debugging
- better security for payment secrets

---

## Vercel Environment Variables

Set these in **Vercel Project → Settings → Environment Variables**:

### Required for Supabase
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required for Peach Payments
- `VITE_PEACH_ENTITY_ID`
- `VITE_PEACH_SECRET`
- `VITE_PEACH_MODE`

### Optional for automation
- `VITE_N8N_WEBHOOK_URL`

### Optional custom API override
- `VITE_API_URL`

If `VITE_API_URL` is not set, the frontend defaults to `/api` automatically, which is ideal for Vercel.

---

## Vercel API Routes Included

The repository includes these Vercel functions:

- `/api/health`
- `/api/profile`
- `/api/subscription`
- `/api/subscription-upgrade`
- `/api/payments`
- `/api/payments-checkout`
- `/api/meetings`
- `/api/meetings-end`

These endpoints allow the frontend to communicate with a backend without running a separate server process.

---

## How to Deploy on Vercel

1. Push the repository to GitHub
2. Import the repository into Vercel
3. In Vercel project settings, add all required environment variables
4. Deploy
5. Point your custom domain (`www.conferly.site`) to Vercel
6. Verify:
   - auth works
   - onboarding works
   - dashboard loads
   - payment checkout redirects properly
   - PWA install prompt appears

---

## Domain Recommendation

- Primary frontend: `https://www.conferly.site`
- Optional automation subdomain: `https://automation.conferly.site`

---

## Local Development

You can still use:
- `npm run dev` for frontend
- Docker Compose for local integrated testing
- Supabase cloud project for auth/data

But production should now be treated as:

**Vercel + Supabase + Peach Payments + optional n8n**

---

## Final Recommendation

Use **Vercel** as the official deployment platform for Conferly.
It is now the cleanest way to unify frontend and backend communication while keeping payments secure and integrations manageable.

---

**Conferly — Connecting with Purpose.**
