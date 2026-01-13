#!/bin/bash

# =============================================================================
# Bogdol GO - Production Docker Setup
# =============================================================================

set -e

echo "🚀 Starting Bogdol GO Production Environment..."
echo "================================================="

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Environment Check
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production nicht gefunden!${NC}"
    echo "Bitte erstellen Sie eine .env.production Datei."
    exit 1
fi

# SSL Certificates Check
if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
    echo -e "${YELLOW}⚠️  SSL Zertifikate nicht gefunden in nginx/ssl/${NC}"
    echo "Erstelle selbst-signierte Zertifikate für Development..."
    mkdir -p nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=DE/ST=NRW/L=Duesseldorf/O=Bogdol/CN=bogdol-go.local"
    echo -e "${GREEN}✅ Selbst-signierte SSL Zertifikate erstellt${NC}"
fi

# Docker Compose für Production
DOCKER_COMPOSE="docker-compose -f docker-compose.prod.yml"

# Backup erstellen (falls DB existiert)
if docker volume inspect bogdol_go_postgres_data > /dev/null 2>&1; then
    echo "💾 Erstelle Database Backup..."
    docker run --rm \
        -v bogdol_go_postgres_data:/data \
        -v $(pwd)/backups:/backup \
        postgres:15-alpine \
        pg_dump -h db -U postgres -d bogdol_go_new > backups/backup_$(date +%Y%m%d_%H%M%S).sql || true
fi

# Build und Deploy
echo "🔨 Building Production Images..."
$DOCKER_COMPOSE build --no-cache

echo "🚀 Deploying Production Services..."
$DOCKER_COMPOSE up -d

# Warte auf Services
echo "⏳ Warte auf Services (60s)..."
sleep 60

# Health Checks
echo "🔍 Production Health Checks..."

# Nginx Check
echo -n "  🌐 Nginx: "
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Backend API Check
echo -n "  🐍 Backend API: "
if curl -f http://localhost/api/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Database Migration
echo "📋 Running Production Migrations..."
$DOCKER_COMPOSE exec backend python manage.py migrate

# Static Files
echo "📊 Collecting Static Files..."
$DOCKER_COMPOSE exec backend python manage.py collectstatic --noinput

# Production Superuser
echo "👤 Production Admin Setup..."
$DOCKER_COMPOSE exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
import os
User = get_user_model()
admin_user = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
admin_email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@bogdol.gmbh')
admin_pass = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'change-me-production')

if not User.objects.filter(username=admin_user).exists():
    User.objects.create_superuser(admin_user, admin_email, admin_pass)
    print(f'✅ Production superuser created: {admin_user}')
else:
    print('✅ Production superuser already exists')
"

echo ""
echo -e "${GREEN}🎉 Production Environment Started!${NC}"
echo "================================================="
echo -e "${BLUE}🌐 Website:${NC}          https://localhost"
echo -e "${BLUE}🔧 Admin:${NC}            https://localhost/admin/"
echo -e "${BLUE}🌺 Flower:${NC}           https://localhost/flower/"
echo -e "${BLUE}📊 Health:${NC}           https://localhost/api/health/"
echo ""
echo -e "${YELLOW}📝 Production Commands:${NC}"
echo "  🔍 Logs:              $DOCKER_COMPOSE logs -f"
echo "  🛑 Stop:              $DOCKER_COMPOSE down"
echo "  🔄 Restart:           $DOCKER_COMPOSE restart"
echo "  💾 Backup DB:         ./scripts/backup-db.sh"
echo ""
echo -e "${GREEN}✅ Production Ready!${NC}"
