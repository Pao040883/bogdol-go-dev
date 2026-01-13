# =============================================================================
# BOGDOL GO - DOCKER SETUP DOCUMENTATION
# =============================================================================

## 🚀 Quick Start

### Development Setup

1. **Voraussetzungen**
   - Docker Desktop installiert und gestartet
   - Git (für Repository)

2. **Repository Setup**
   ```bash
   git clone <repository-url>
   cd bogdol-go
   ```

3. **Environment konfigurieren**
   ```bash
   # Windows
   copy .env.template .env
   
   # Linux/Mac  
   cp .env.template .env
   ```

4. **Development starten**
   ```bash
   # Windows
   scripts\docker-dev.bat
   
   # Linux/Mac
   chmod +x scripts/docker-dev.sh
   ./scripts/docker-dev.sh
   ```

## 🐳 Services

### Development URLs
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:80/api/
- **Django Admin**: http://localhost:80/admin/ (admin/admin123)
- **Flower (Celery)**: http://localhost:5555 (admin/flower123)
- **Health Check**: http://localhost:80/api/health/
- **System Stats**: http://localhost:80/api/stats/

### Service Übersicht
```yaml
db          # PostgreSQL 15 Database
redis       # Redis Cache & Message Broker  
backend     # Django REST API
celery      # Celery Worker
celery-beat # Celery Scheduler
flower      # Celery Monitoring
frontend    # Angular/Ionic SPA
nginx       # Reverse Proxy
```

## 📋 Development Commands

```bash
# Alle Services starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f [service_name]

# Services stoppen
docker-compose down

# Service neustarten
docker-compose restart [service_name]

# Backend Shell
docker-compose exec backend python manage.py shell

# Django Migrations
docker-compose exec backend python manage.py migrate

# Static Files sammeln
docker-compose exec backend python manage.py collectstatic

# Database Reset (Vorsicht!)
docker-compose down -v
```

## 🔧 Backend Tasks & Features

### Celery Tasks
- **Blink Sync**: Stündliche Synchronisation der Blink-Daten
- **Absence Reminders**: Erinnerungen für ausstehende Genehmigungen  
- **Weekly Reports**: Automatische wöchentliche Berichte
- **System Cleanup**: Tägliche Bereinigung alter Daten

### API Endpoints
- `/api/health/` - System Health Check
- `/api/info/` - API Information
- `/api/stats/` - System Statistiken
- `/api/absences/` - Abwesenheitssystem
- `/api/blink/` - Blink Integration

## 🚀 Production Deployment

### 1. Environment Setup
```bash
cp .env.production.template .env.production
# Konfigurieren Sie alle Production Values
```

### 2. SSL Zertifikate
```bash
# Platzieren Sie SSL Zertifikate in:
nginx/ssl/cert.pem
nginx/ssl/key.pem
```

### 3. Production Start
```bash
./scripts/docker-prod.sh
```

## 🔒 Security Features

### Development
- Basic Authentication für Flower
- CORS konfiguriert für localhost
- Debug-Modus aktiviert

### Production
- SSL/TLS Encryption
- Security Headers (HSTS, CSP, etc.)
- Rate Limiting
- Secure Cookies
- Debug-Modus deaktiviert

## 📊 Monitoring & Health

### Health Checks
Alle Services haben integrierte Health Checks:
- Database Connectivity
- Redis Connectivity  
- Celery Worker Status
- Disk Space Monitoring

### Flower Monitoring
- Real-time Task Monitoring
- Worker Performance
- Queue Statistics
- Task History

## 🗄️ Database Management

### Backup erstellen
```bash
docker-compose exec db pg_dump -U postgres bogdol_go_new > backup.sql
```

### Backup wiederherstellen
```bash
docker-compose exec -T db psql -U postgres bogdol_go_new < backup.sql
```

### Migration zurücksetzen
```bash
docker-compose exec backend python manage.py migrate app_name zero
docker-compose exec backend python manage.py migrate
```

## 🐛 Troubleshooting

### Port bereits in Verwendung
```bash
# Prüfen welcher Service Port 80 verwendet
netstat -tulpn | grep :80

# Docker Services stoppen
docker-compose down
```

### Permission Denied (Linux/Mac)
```bash
# Scripts ausführbar machen
chmod +x scripts/*.sh

# Docker ohne sudo
sudo usermod -aG docker $USER
```

### Container startet nicht
```bash
# Container Logs prüfen
docker-compose logs [service_name]

# Container Status prüfen
docker-compose ps

# Volumes löschen (Vorsicht!)
docker-compose down -v
```

### Frontend Build Fehler
```bash
# Node modules neu installieren
docker-compose exec frontend npm ci
docker-compose restart frontend
```

## 📁 Wichtige Dateien

```
├── docker-compose.yml              # Haupt Docker Compose
├── .env.template                   # Environment Template
├── scripts/
│   ├── docker-dev.bat             # Windows Development
│   ├── docker-dev.sh              # Linux/Mac Development  
│   └── docker-prod.sh             # Production Setup
├── nginx/
│   ├── nginx.conf                 # Nginx Hauptkonfiguration
│   └── conf.d/default.conf        # Reverse Proxy Konfiguration
├── backend/go/
│   ├── Dockerfile                 # Django Container
│   ├── requirements.txt           # Python Dependencies
│   └── docker-entrypoint.sh       # Container Startup
└── frontend/
    ├── Dockerfile                 # Angular Container
    └── nginx.conf                 # Frontend Nginx Config
```

## 🎯 Next Steps

1. **SSL Zertifikate** für Production einrichten
2. **CI/CD Pipeline** für automatische Deployments
3. **Backup Strategy** implementieren
4. **Monitoring Dashboard** mit Grafana
5. **Log Aggregation** mit ELK Stack

## 📞 Support

Bei Problemen:
1. Logs prüfen: `docker-compose logs -f`
2. Health Check: http://localhost:80/api/health/
3. System Stats: http://localhost:80/api/stats/
