#!/bin/bash

# =============================================================================
# Bogdol GO - Development Docker Setup
# =============================================================================

set -e  # Exit on any error

echo "🐳 Starting Bogdol GO Development Environment..."
echo "=================================================="

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prüfe ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker ist nicht gestartet!${NC}"
    echo "Bitte starten Sie Docker und versuchen Sie es erneut."
    exit 1
fi

# Prüfe ob docker-compose verfügbar ist
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  docker-compose nicht gefunden, verwende 'docker compose'${NC}"
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# .env Datei prüfen
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env Datei nicht gefunden${NC}"
    if [ -f .env.template ]; then
        echo "📄 Kopiere .env.template zu .env..."
        cp .env.template .env
        echo -e "${GREEN}✅ .env Datei erstellt. Bitte anpassen falls nötig.${NC}"
    else
        echo -e "${RED}❌ Keine .env.template gefunden!${NC}"
        exit 1
    fi
fi

# Nginx .htpasswd für Flower erstellen
if [ ! -f nginx/.htpasswd ]; then
    echo "🔐 Erstelle .htpasswd für Flower Monitoring..."
    mkdir -p nginx
    # admin:flower123
    echo 'admin:$apr1$mFLz8Z.K$PYK1dF8VQ1hE.Nz8KvQ8l1' > nginx/.htpasswd
    echo -e "${GREEN}✅ Flower Login: admin/flower123${NC}"
fi

# Build und starte alle Services
echo "🔨 Building und Starting Services..."
$DOCKER_COMPOSE down --remove-orphans
$DOCKER_COMPOSE build --no-cache

echo "🚀 Starting Services..."
$DOCKER_COMPOSE up -d

# Warte auf Services
echo "⏳ Warte auf Services..."
sleep 15

# Prüfe Service Health
echo "🔍 Prüfe Service Health..."

# Database Health Check
echo -n "  📊 Database: "
if $DOCKER_COMPOSE exec db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Redis Health Check
echo -n "  🔴 Redis: "
if $DOCKER_COMPOSE exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Backend Health Check
echo -n "  🐍 Backend: "
sleep 10  # Warte bis Backend startet
if curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️  Starting...${NC}"
fi

# Führe Django Setup aus
echo "🔧 Django Setup..."
echo "  📋 Running migrations..."
$DOCKER_COMPOSE exec backend python manage.py migrate

echo "  📊 Collecting static files..."
$DOCKER_COMPOSE exec backend python manage.py collectstatic --noinput

echo "  👤 Creating superuser..."
$DOCKER_COMPOSE exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@bogdol.gmbh', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('✅ Superuser already exists')
"

# Celery Beat Setup
echo "  ⏰ Setting up Celery Beat..."
$DOCKER_COMPOSE exec backend python manage.py shell -c "
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule
import json

# Stündlich - Blink Sync
schedule, created = IntervalSchedule.objects.get_or_create(
    every=60,
    period=IntervalSchedule.MINUTES,
)
PeriodicTask.objects.get_or_create(
    name='Sync Blink Data',
    task='blink_integration.tasks.sync_blink_data',
    interval=schedule,
)

print('✅ Celery Beat tasks configured')
"

echo ""
echo -e "${GREEN}🎉 Development Environment Ready!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Frontend:${NC}         http://localhost:80"
echo -e "${BLUE}🔧 Django Admin:${NC}     http://localhost:80/admin-go/ (admin/admin123)"
echo -e "${BLUE}🌺 Flower (Celery):${NC}  http://localhost:5555 (admin/flower123)"
echo -e "${BLUE}🔍 Backend API:${NC}      http://localhost:80/api/"
echo -e "${BLUE}📊 Health Check:${NC}     http://localhost:80/api/health/"
echo -e "${BLUE}📈 System Stats:${NC}     http://localhost:80/api/stats/"
echo ""
echo -e "${YELLOW}📝 Useful Commands:${NC}"
echo "  🔍 Logs anzeigen:     $DOCKER_COMPOSE logs -f"
echo "  🛑 Services stoppen:  $DOCKER_COMPOSE down"
echo "  🔄 Services neu:      $DOCKER_COMPOSE restart"
echo "  🐚 Backend Shell:     $DOCKER_COMPOSE exec backend python manage.py shell"
echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
