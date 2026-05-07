#!/bin/bash
# Deployment script for Conferly (Frontend + Backend)
set -e

echo "🚀 Starting Conferly deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%T)] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +%T)] WARNING: $1${NC}"; }

# Project directory
PROJECT_DIR="/workspace/project/Conferly"
cd "$PROJECT_DIR"

log "Installing frontend dependencies..."
npm install

log "Building frontend..."
npm run build

log "Running tests..."
npm test

log "Frontend build complete!"

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
  log "Deploying Supabase edge functions..."
  supabase functions deploy verify-turnstile
  log "Edge functions deployed!"
else
  warn "Supabase CLI not found - skipping edge function deployment"
  warn "To deploy edge functions manually:"
  echo "  1. Install Supabase CLI"
  echo "  2. Run: supabase functions deploy verify-turnstile"
fi

echo ""
echo "=========================================="
echo "✅ Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  - Deploy to your hosting provider (Vercel, Netlify, etc.)"
echo "  - Set environment variables:"
echo "      SUPABASE_URL, SUPABASE_ANON_KEY"
echo "      TURNSTILE_SECRET_KEY"
echo "      JWT_SECRET"
echo ""