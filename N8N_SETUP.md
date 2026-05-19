# 🤖 Conferly Automation with n8n

This guide walks you through setting up n8n to automate Conferly's emails, payments, analytics, and notifications. Everything is pre-built — you just import the workflows.

---

## What's already done in the code

✅ Conferly's frontend already fires automation events to n8n at every important moment:

| Event | When it fires |
|---|---|
| `user.signup` | New user creates an account |
| `user.signin` | User signs in |
| `user.signout` | User signs out |
| `user.onboarded` | User completes the individual/organization onboarding |
| `meeting.started` | User joins/creates a meeting |
| `meeting.ended` | Meeting ends (with duration, transcript count, chat count) |
| `payment.completed` | Successful Peach Payments transaction |
| `plan.upgraded` | Plan tier changed |

You don't need to write any code — just spin up n8n, import the workflows, and configure SMTP.

---

## Quick Start (5 minutes)

### Option A: Self-hosted with Docker (recommended)

You already have a `docker-compose.yml` with n8n included. Just run:

```bash
docker compose up -d
```

This starts:
- **Conferly frontend** at http://localhost:8080
- **Conferly backend** at http://localhost:3001
- **n8n automation** at http://localhost:5678

Default n8n login: `admin` / `change-this-password` (change in `.env`)

### Option B: n8n Cloud (managed, no setup)

1. Sign up at [n8n.cloud](https://n8n.cloud) (free tier: 5,000 executions/month)
2. Note your webhook URL (format: `https://YOUR-INSTANCE.app.n8n.cloud/webhook/conferly`)
3. Add to your Conferly `.env` as `VITE_N8N_WEBHOOK_URL`
4. Rebuild frontend: `npm run build`

### Option C: Railway / Render / Fly.io

All three have one-click n8n templates. Same as Option B for the webhook URL.

---

## Configure environment variables

Create a `.env` file in your project root (for local development) or use Vercel Environment Variables in production:

```env
# n8n authentication
N8N_USER=admin
N8N_PASSWORD=your-strong-password-here

# n8n public URL (set this when you deploy to a real domain)
N8N_HOST=automation.conferly.site
N8N_PROTOCOL=https
N8N_PUBLIC_URL=https://automation.conferly.site/

# Where Conferly sends events to n8n
N8N_WEBHOOK_URL=https://automation.conferly.site/webhook/conferly

# Supabase service role key (for n8n to write to your database)
# Get it from Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key

# SMTP for sending emails (use SendGrid, Mailgun, AWS SES, or any SMTP provider)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@conferly.site

# Conferly frontend env vars
VITE_N8N_WEBHOOK_URL=https://automation.conferly.site/webhook/conferly
VITE_SUPABASE_URL=https://neymqmyzmsberwlowlpw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_PEACH_ENTITY_ID=
VITE_PEACH_SECRET=
VITE_PEACH_MODE=sandbox
```

---

## Import the pre-built workflows

There are **5 ready-made workflows** in `n8n/workflows/`:

| File | What it does | Trigger |
|---|---|---|
| `01-welcome-email.json` | Sends a beautiful welcome email when someone signs up | Webhook (`user.signup`) |
| `02-payment-confirmation.json` | Sends a payment receipt + logs to Supabase | Webhook (`payment.completed`) |
| `03-meeting-summary.json` | Emails the user a summary after each meeting (>1 min) | Webhook (`meeting.ended`) |
| `04-trial-expiry-reminder.json` | Reminds trial users 3 days before expiry | Daily 9am SAST |
| `05-daily-analytics.json` | Sends you daily revenue/usage report | Daily 6pm SAST |

### How to import

1. Open n8n at http://localhost:5678 (or your cloud URL)
2. Sign in with your credentials
3. Click **Workflows** in the left sidebar
4. Click the **3-dot menu** (top right) → **Import from File**
5. Select each `.json` file from `n8n/workflows/` one at a time
6. After importing, click **Activate** (top-right toggle) on each workflow

### Configure SMTP credentials in n8n

The email workflows need SMTP credentials:

1. In n8n, go to **Credentials** (left sidebar)
2. Click **Add Credential** → search for **SMTP**
3. Fill in your SMTP details (use the same values as your `.env`):
   - Host: `smtp.sendgrid.net` (or your provider)
   - Port: `587`
   - User: `apikey` (for SendGrid) or your username
   - Password: your SMTP password / API key
   - From email: `noreply@conferly.site`
4. Click **Save** and name it `Conferly SMTP`
5. n8n will auto-link this to all email workflows

---

## How to test the setup

### 1. Test the webhook manually

```bash
curl -X POST http://localhost:5678/webhook/conferly \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user.signup",
    "timestamp": "2026-01-15T10:30:00Z",
    "userId": "test-user-id",
    "email": "your-test-email@example.com",
    "displayName": "Test User"
  }'
```

If everything works, you'll get a welcome email within seconds.

### 2. Test from the actual app

1. Open Conferly at http://localhost:8080
2. Sign up with a real email address
3. Check your inbox — the welcome email should arrive in 5–10 seconds
4. Check n8n's **Executions** tab to see the workflow run

### 3. Check the n8n dashboard

- **Executions tab** shows every workflow that ran (success/error)
- Click any execution to see exactly what data was received and what was sent
- Errors are clearly highlighted with the failing step

---

## Recommended SMTP providers

| Provider | Free tier | Best for |
|---|---|---|
| **SendGrid** | 100 emails/day | Production (most reliable) |
| **Mailgun** | 5,000/month for 3 months | Production |
| **AWS SES** | $0.10 per 1,000 | High volume, very cheap |
| **Resend** | 3,000/month | Modern API, beautiful templates |
| **Gmail SMTP** | 500/day | Personal/testing only |

I recommend **SendGrid** — sign up at [sendgrid.com](https://sendgrid.com), verify your domain (`conferly.site`), and put the API key in your `.env`.

---

## What if I don't deploy n8n?

Conferly works perfectly without n8n. The automation events are fire-and-forget — if `VITE_N8N_WEBHOOK_URL` isn't set, the events are silently skipped. No errors, no broken features.

You can add n8n later anytime — just set the env var and rebuild.

---

## Adding more workflows later

n8n has 400+ pre-built integrations. Common additions for Conferly:

| Integration | Use case |
|---|---|
| **Slack** | Send alerts to your team Slack channel |
| **Discord** | Community notifications |
| **Telegram/WhatsApp** | SMS-style notifications |
| **HubSpot/Salesforce** | Push new organization signups to CRM |
| **Google Sheets** | Auto-log all transactions to a spreadsheet |
| **Notion** | Create a Notion page for each meeting |
| **OpenAI/Claude** | Enhance AI summaries with deeper analysis |
| **Twilio** | SMS reminders for trial expiry |

To add a new workflow:
1. Click **+ New Workflow** in n8n
2. Drag a **Webhook** node, set path to `conferly`
3. Add an **IF** node to filter for the event you care about
4. Add the integration node (Slack, etc.) and configure it
5. Activate the workflow

---

## Production deployment

When you deploy Conferly to `www.conferly.site`, deploy n8n to `automation.conferly.site`:

### 1. Get a small VPS (Hetzner, DigitalOcean, Linode — $4–6/month)

### 2. Point DNS
- `automation.conferly.site` → A record pointing to your VPS IP

### 3. Deploy with Docker Compose
```bash
git clone https://github.com/YOUR_USERNAME/conferly.git
cd conferly
nano .env  # Fill in production values
docker compose up -d
```

### 4. Add HTTPS with Caddy or Nginx + Let's Encrypt
n8n requires HTTPS in production for webhooks to work properly.

### 5. Update Conferly's frontend env var
```env
VITE_N8N_WEBHOOK_URL=https://automation.conferly.site/webhook/conferly
```

### 6. Rebuild and redeploy
```bash
npm run build
```

---

## Troubleshooting

**Q: Workflows show executions but no email arrives**
A: Check your SMTP credentials in n8n. Make sure the "from" email is verified with your provider (SendGrid requires domain verification).

**Q: n8n at localhost:5678 won't load**
A: Run `docker compose logs n8n` to see startup errors. Usually a port conflict — change `5678:5678` in docker-compose.yml.

**Q: Webhook returns 404**
A: Make sure the workflow is **active** (toggle at top-right of the workflow editor).

**Q: Conferly app doesn't fire events**
A: Check that `VITE_N8N_WEBHOOK_URL` is set before building. Verify in browser DevTools → Network tab — you should see POST requests to your n8n URL.

**Q: Trial expiry workflow doesn't trigger**
A: That one's on a daily schedule (9am SAST). It only fires for users with `plan_tier = 'trial'` and 3 or fewer days left. Check the **Executions** tab to see when it last ran.

---

<p align="center"><strong>Conferly + n8n — Automate everything. Touch nothing.</strong></p>
