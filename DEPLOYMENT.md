# ⚡ Storm — Deployment Guide

**Deploy Storm anywhere that can serve a static HTML file.**

Storm builds to a single `dist/index.html` (~970KB) containing all JS, CSS, and assets inlined. No server-side runtime required. No Node.js needed in production. Just serve the file.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Build the App](#2-build-the-app)
3. [Environment Variables (Optional)](#3-environment-variables-optional)
4. [Deployment Options](#4-deployment-options)
   - [Vercel (Recommended — Free)](#option-a-vercel-recommended)
   - [Netlify (Free)](#option-b-netlify)
   - [Cloudflare Pages (Free)](#option-c-cloudflare-pages)
   - [GitHub Pages (Free)](#option-d-github-pages)
   - [Firebase Hosting (Free)](#option-e-firebase-hosting)
   - [Railway (Free Tier)](#option-f-railway)
   - [Render (Free Tier)](#option-g-render)
   - [AWS S3 + CloudFront](#option-h-aws-s3--cloudfront)
   - [DigitalOcean App Platform](#option-i-digitalocean-app-platform)
   - [Docker (Self-Hosted)](#option-j-docker-self-hosted)
   - [VPS with Nginx](#option-k-vps-with-nginx)
   - [Shared Hosting / cPanel](#option-l-shared-hosting--cpanel)
5. [Custom Domain Setup](#5-custom-domain-setup)
6. [HTTPS Requirement](#6-https-requirement)
7. [Supabase Setup (Optional)](#7-supabase-setup-optional)
8. [Post-Deploy Checklist](#8-post-deploy-checklist)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

On your **development machine** only (not needed on the server):

```bash
node --version   # Must be >= 18
npm --version    # Included with Node
```

---

## 2. Build the App

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This creates a `dist/` folder containing:

```
dist/
├── index.html          # ← The entire app (JS + CSS inlined, ~970KB)
├── manifest.json       # PWA manifest
└── images/
    └── hero-bg.jpg     # Background image
```

**That's it.** The `dist/` folder is your deployment artifact.

---

## 3. Environment Variables (Optional)

Storm works 100% without any environment variables. Authentication falls back to secure offline mode (SHA-256 hashed passwords in localStorage).

To enable Supabase cloud auth, create a `.env` file **before building**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-key-here
```

These are baked into the build at compile time (Vite replaces `import.meta.env.*` during build).

> **Without these variables:** Auth works entirely offline. Users sign up/in with email+password stored locally. No external requests are made.

---

## 4. Deployment Options

### Option A: Vercel (Recommended)

**Cost:** Free | **SSL:** Automatic | **CDN:** Global | **Time:** 2 minutes

The fastest option. Zero configuration needed.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (first time: follow the prompts)
vercel

# For production deployment
vercel --prod
```

Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new):
1. Import your Storm repository
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Click **Deploy**

Add env vars (if using Supabase) in: **Project Settings → Environment Variables**

---

### Option B: Netlify

**Cost:** Free | **SSL:** Automatic | **CDN:** Global | **Time:** 2 minutes

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --dir=dist --prod
```

Or connect your GitHub repo at [app.netlify.com](https://app.netlify.com):
1. **Add new site → Import from Git**
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Click **Deploy site**

Create `netlify.toml` in the project root for SPA routing:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### Option C: Cloudflare Pages

**Cost:** Free | **SSL:** Automatic | **CDN:** Global (fastest) | **Time:** 3 minutes

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create**
2. Connect your Git repository
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Click **Save and Deploy**

Or use the CLI:

```bash
npm i -g wrangler
npm run build
wrangler pages deploy dist --project-name=storm
```

---

### Option D: GitHub Pages

**Cost:** Free | **SSL:** Automatic | **Time:** 5 minutes

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
```

Enable Pages in: **Repo Settings → Pages → Source: GitHub Actions**

> **Note:** If deploying to `username.github.io/storm` (not root), add `base: '/storm/'` to `vite.config.ts`.

---

### Option E: Firebase Hosting

**Cost:** Free (Spark plan) | **SSL:** Automatic | **Time:** 5 minutes

```bash
# Install Firebase CLI
npm i -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# When prompted:
#   Public directory: dist
#   Single-page app: Yes
#   GitHub deploys: No

# Build and deploy
npm run build
firebase deploy
```

---

### Option F: Railway

**Cost:** Free tier ($5 credit/month) | **SSL:** Automatic | **Time:** 3 minutes

1. Go to [railway.app/new](https://railway.app/new)
2. **Deploy from GitHub repo**
3. Railway auto-detects Vite
4. Add env vars if needed
5. Deploys automatically on push

Or use CLI:

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

---

### Option G: Render

**Cost:** Free (static sites) | **SSL:** Automatic | **Time:** 3 minutes

1. Go to [render.com](https://render.com) → **New → Static Site**
2. Connect your GitHub repo
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Click **Create Static Site**

---

### Option H: AWS S3 + CloudFront

**Cost:** ~$0.50/month | **SSL:** ACM (free) | **CDN:** Global | **Time:** 15 minutes

```bash
# Build
npm run build

# Create S3 bucket
aws s3 mb s3://storm-app --region us-east-1

# Enable static website hosting
aws s3 website s3://storm-app --index-document index.html --error-document index.html

# Upload
aws s3 sync dist/ s3://storm-app --delete

# Set public read policy
aws s3api put-bucket-policy --bucket storm-app --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::storm-app/*"
  }]
}'
```

For CloudFront CDN + HTTPS:
1. Create a CloudFront distribution pointing to the S3 website endpoint
2. Set **Default root object:** `index.html`
3. Add custom error response: 403 → `/index.html` (200) for SPA routing
4. Attach an ACM certificate for your domain

---

### Option I: DigitalOcean App Platform

**Cost:** Free (3 static sites) | **SSL:** Automatic | **Time:** 3 minutes

1. Go to [cloud.digitalocean.com/apps/new](https://cloud.digitalocean.com/apps/new)
2. Select your GitHub repo
3. Component type: **Static Site**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Launch App**

---

### Option J: Docker (Self-Hosted)

**Cost:** Your server | **Time:** 5 minutes

Create a `Dockerfile` in the project root:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t storm .
docker run -p 8080:80 storm
```

With Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'
services:
  storm:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

```bash
docker compose up -d
```

Deploy the Docker image to any container platform:
- **AWS ECS / Fargate**
- **Google Cloud Run**
- **Azure Container Apps**
- **Fly.io** (`fly launch`)
- **DigitalOcean Kubernetes**

---

### Option K: VPS with Nginx

**Cost:** $4–6/month (DigitalOcean, Hetzner, Linode) | **Time:** 10 minutes

On your VPS (Ubuntu/Debian):

```bash
# Install Nginx
sudo apt update && sudo apt install -y nginx

# Build locally and copy dist to server
# (on your local machine)
npm run build
scp -r dist/* user@your-server:/var/www/storm/

# Or build on the server directly
ssh user@your-server
sudo apt install -y nodejs npm
git clone https://github.com/YOUR_USERNAME/Storm.git /opt/storm
cd /opt/storm
npm install && npm run build
sudo cp -r dist/* /var/www/storm/
```

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/storm
```

```nginx
server {
    listen 80;
    server_name storm.yourdomain.com;
    root /var/www/storm;
    index index.html;

    # SPA routing — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff2|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(*), microphone=(*), display-capture=(*)" always;
}
```

```bash
# Enable and restart
sudo ln -s /etc/nginx/sites-available/storm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add HTTPS with Let's Encrypt (free)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d storm.yourdomain.com
```

---

### Option L: Shared Hosting / cPanel

**Cost:** $2–5/month | **Time:** 5 minutes

If all you have is a cPanel / shared hosting account:

1. Build locally: `npm run build`
2. Open **cPanel → File Manager**
3. Navigate to `public_html` (or a subfolder)
4. Upload everything from your `dist/` folder
5. Create a `.htaccess` file for SPA routing:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

That's it. It works on any PHP hosting, any Apache server, anything that serves HTML files.

---

## 5. Custom Domain Setup

For any platform, the process is:

1. **Buy a domain** (Namecheap, Cloudflare, Google Domains) — e.g., `stormcall.app`
2. **Add the domain** in your hosting platform's dashboard
3. **Update DNS** — add the records your platform gives you:

| Platform | DNS Record Type | Value |
|---|---|---|
| Vercel | CNAME | `cname.vercel-dns.com` |
| Netlify | CNAME | `your-site.netlify.app` |
| Cloudflare Pages | CNAME | `your-project.pages.dev` |
| AWS CloudFront | CNAME | `d1234.cloudfront.net` |
| VPS | A Record | Your server's IP address |

4. **SSL is automatic** on Vercel, Netlify, Cloudflare, Firebase. For VPS, use Let's Encrypt (see Option K).

---

## 6. HTTPS Requirement

**Storm requires HTTPS in production.** These browser APIs only work on secure origins:

| API | Requires HTTPS |
|---|---|
| `getUserMedia` (camera/mic) | ✅ Yes |
| `getDisplayMedia` (screen share) | ✅ Yes |
| `MediaRecorder` (recording) | ✅ Yes |
| `SpeechRecognition` (transcription) | ✅ Yes |
| `Web Crypto` (password hashing) | ✅ Yes |
| Service Worker (PWA install) | ✅ Yes |

> `localhost` is treated as a secure origin for development. All platforms listed above provide free automatic HTTPS.

---

## 7. Supabase Setup (Optional)

Storm works fully without Supabase. To enable cloud-backed auth:

### 7.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region (pick one close to your users — e.g., **Africa South** if available, or **EU West**)
3. Set a database password
4. Wait for the project to provision (~1 minute)

### 7.2 Get Your Keys

1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### 7.3 Configure Auth

1. Go to **Authentication → Providers**
2. Email provider is enabled by default
3. Optional: disable "Confirm email" for faster testing (**Authentication → Settings → uncheck "Enable email confirmations"**)

### 7.4 Set Environment Variables

Add to your hosting platform's env vars:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

Then rebuild and redeploy.

### 7.5 Self-Host Supabase (Advanced)

For full data sovereignty (e.g., POPIA compliance in South Africa):

```bash
# Clone Supabase Docker setup
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env with your secrets
docker compose up -d
```

Point `VITE_SUPABASE_URL` to your self-hosted instance.

---

## 8. Post-Deploy Checklist

After deploying, verify these work:

| Test | How to Verify |
|---|---|
| ✅ App loads | Open the URL — you should see the Sign In page |
| ✅ Sign up works | Create an account with email + password |
| ✅ Camera/mic | Create a meeting → lobby should show your camera feed |
| ✅ Audio level meter | Speak → green bars should move in the lobby |
| ✅ Video grid | Join meeting → you should see yourself in the grid |
| ✅ Transcription | Open Transcript tab → speak → text should appear (Chrome/Edge only) |
| ✅ Translation | Open Translate tab → type isiZulu text → should translate to English |
| ✅ Screen share | Click screen share → pick a window → should appear in the grid |
| ✅ Recording | Click record → stop → download button should appear |
| ✅ Collaborative notes | Open Notes tab → type → should sync across tabs (open a 2nd tab to test) |
| ✅ Chat | Open Chat tab → send a message → should appear |
| ✅ Reactions | Click reaction → emoji should float above the controls |
| ✅ Pricing page | Click "Pricing" in the nav → all 4 plans should display |
| ✅ Security panel | Open Security tab → toggle password/lock/waiting room |
| ✅ PWA install | Check browser address bar for install icon (Chrome) |
| ✅ HTTPS | URL should start with `https://` |

---

## 9. Troubleshooting

### Camera/mic not working

- **Cause:** Site not served over HTTPS
- **Fix:** Enable SSL. All platforms above provide free automatic HTTPS. `localhost` works for dev.

### "Speech recognition not supported"

- **Cause:** Using Firefox or Safari
- **Fix:** Use Chrome or Edge. This is a browser limitation — `webkitSpeechRecognition` is Chromium-only. Storm shows a graceful warning.

### Translation not working

- **Cause:** MyMemory API blocked by network/firewall
- **Fix:** Ensure the server can reach `api.mymemory.translated.net`. No API key needed.

### Build fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Page is blank / white screen

- **Cause:** JS failed to load, or routing issue
- **Fix:** Check browser console (F12) for errors. Ensure your hosting has SPA fallback routing (serve `index.html` for all paths).

### PWA not installable

- **Cause:** Missing HTTPS, or manifest.json not loading
- **Fix:** Verify `https://your-domain/manifest.json` returns JSON. Chrome DevTools → Application → Manifest should show no errors.

### Large bundle size

The production build is ~970KB (290KB gzipped). This includes TipTap, Yjs, Supabase, and Lucide icons. If size is critical:
- All platforms above serve with gzip/brotli compression automatically
- The single-file output means only **1 HTTP request** total — faster first paint than multi-chunk builds

---

## Quick Reference: Recommended Stack

| Use Case | Platform | Cost | Why |
|---|---|---|---|
| **Fastest setup** | Vercel | Free | 1 command deploy, auto-SSL, global CDN |
| **Best free CDN** | Cloudflare Pages | Free | Fastest global edge network |
| **Most control** | VPS + Nginx + Docker | $4/mo | Full root access, self-host everything |
| **Enterprise / Africa** | AWS S3 + CloudFront (af-south-1) | ~$1/mo | Cape Town edge location for SA users |
| **Simplest possible** | Shared hosting / cPanel | $2/mo | Just upload files, add `.htaccess` |

---

<p align="center"><strong>⚡ Storm — Deploy once, call from anywhere.</strong></p>
