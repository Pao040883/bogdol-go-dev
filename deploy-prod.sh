#!/bin/bash

# =============================================================================
# Bogdol GO - Production Deployment Script
# =============================================================================

set -e  # Exit on error

echo "🚀 Starting Bogdol GO Production Deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ Error: .env.production file not found!${NC}"
    echo "Please create .env.production from .env.production.template"
    exit 1
fi

# Check if SSL certificates exist
if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
    echo -e "${YELLOW}⚠️  Warning: SSL certificates not found in nginx/ssl/${NC}"
    echo "Production deployment should use HTTPS. Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        exit 1
    fi
fi

# Check if .htpasswd exists
if [ ! -f nginx/.htpasswd ]; then
    echo -e "${YELLOW}⚠️  Warning: nginx/.htpasswd not found${NC}"
    echo "Flower monitoring will not be password protected!"
fi

# Pull latest code
echo -e "${GREEN}📥 Pulling latest code...${NC}"
git pull origin main

# Build Docker images
echo -e "${GREEN}🔨 Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop old containers
echo -e "${GREEN}🛑 Stopping old containers...${NC}"
docker-compose -f docker-compose.prod.yml down

# Start new containers
echo -e "${GREEN}🚀 Starting new containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo -e "${GREEN}⏳ Waiting for database...${NC}"
sleep 10

# Run migrations
echo -e "${GREEN}🔄 Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput

# Collect static files
echo -e "${GREEN}📦 Collecting static files...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# Check health
echo -e "${GREEN}🏥 Checking service health...${NC}"
sleep 5

# Check if backend is healthy
if docker-compose -f docker-compose.prod.yml exec -T backend curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs backend"
    exit 1
fi

# Show running containers
echo -e "${GREEN}📊 Running containers:${NC}"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "  - Check logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Visit: https://yourdomain.com"
echo "  - Admin: https://yourdomain.com/admin-go/"
echo "  - Flower: https://yourdomain.com/flower/"
echo ""
