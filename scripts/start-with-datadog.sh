#!/bin/bash
# scripts/start-with-datadog.sh
# Datadog-enabled startup script for Conferly Next.js application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Datadog Conferly Startup Script ===${NC}"

# Check if .env.local exists
if [ -f .env.local ]; then
    echo -e "${GREEN}✓ Loading environment variables from .env.local${NC}"
    export $(grep -v '^#' .env.local | xargs)
else
    echo -e "${YELLOW}! Warning: .env.local not found${NC}"
fi

# Verify Datadog configuration
echo -e "${GREEN}✓ Verifying Datadog configuration...${NC}"
if [ -z "$DD_API_KEY" ]; then
    echo -e "${RED}✗ DD_API_KEY is not set${NC}"
    exit 1
fi

if [ -z "$DD_SITE" ]; then
    echo -e "${YELLOW}! DD_SITE not set, defaulting to datadoghq.com${NC}"
fi

echo -e "${GREEN}  - DD_SITE: ${DD_SITE:-datadoghq.com}${NC}"
echo -e "${GREEN}  - DD_ENV: ${DD_ENV:-dev}${NC}"
echo -e "${GREEN}  - DD_SERVICE: ${DD_SERVICE:-conferly-next}${NC}"
echo -e "${GREEN}  - DD_RUM_ENABLED: ${DD_RUM_ENABLED:-false}${NC}"

# Check if Datadog agent is installed and start it
if command -v datadog-agent &> /dev/null; then
    echo -e "${GREEN}✓ Datadog agent found, checking status...${NC}"
    if pgrep -x "datadog-agent" > /dev/null; then
        echo -e "${GREEN}✓ Datadog agent is already running${NC}"
    else
        echo -e "${YELLOW}! Starting Datadog agent...${NC}"
        sudo systemctl start datadog-agent 2>/dev/null || sudo service datadog-agent start 2>/dev/null || echo -e "${YELLOW}! Could not start Datadog agent (requires sudo)${NC}"
    fi
else
    echo -e "${YELLOW}! Datadog agent not installed - using dd-trace library only${NC}"
fi

# Parse command line argument for environment
MODE=${1:-prod}

# Start the application
echo -e "${GREEN}=== Starting application ===${NC}"

if [ "$MODE" == "dev" ]; then
    echo -e "${GREEN}Starting in development mode with Datadog APM...${NC}"
    npm run dev
else
    echo -e "${GREEN}Building and starting in production mode with Datadog APM...${NC}"
    npm run build
    npm run start
fi