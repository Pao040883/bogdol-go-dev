# Production Deployment Guide

## Vorbereitung

### 1. .env.production erstellen
```bash
cp .env.production.template .env.production
```

Folgende Werte **MÜSSEN** geändert werden:
- `DJANGO_SECRET_KEY` - Generiere einen sicheren Key
- `POSTGRES_PASSWORD` - Starkes DB Passwort (wird vom Postgres-Container genutzt)
- `DATABASE_URL` - Production DB Credentials (muss zu `POSTGRES_*` passen)
- `ALLOWED_HOSTS` - Deine Domain(en)
- `CORS_ALLOWED_ORIGINS` - Deine Domain(en)
- `BLINK_USERNAME` und `BLINK_PASSWORD`
- Email Settings
- `DJANGO_SUPERUSER_PASSWORD`

### 2. SSL Zertifikate vorbereiten
```bash
# Let's Encrypt Zertifikate
mkdir -p nginx/ssl
# Zertifikate nach nginx/ssl kopieren:
# - fullchain.pem
# - privkey.pem
```

### 3. Nginx htpasswd erstellen (für Flower)
```bash
# Mit htpasswd tool
htpasswd -c nginx/.htpasswd admin

# Oder online generieren:
# https://www.web2generators.com/apache-tools/htpasswd-generator
```

### 4. Domain in nginx/conf.d/prod.conf anpassen
Ersetze `yourdomain.com` mit deiner echten Domain.

## Deployment

### Erste Installation
```bash
# 1. Code auf Server klonen
git clone https://github.com/your-org/bogdol-go.git
cd bogdol-go

# 2. .env.production konfigurieren
nano .env.production

# 3. SSL Zertifikate platzieren
# nginx/ssl/fullchain.pem
# nginx/ssl/privkey.pem

# 4. Domain in nginx config anpassen
nano nginx/conf.d/prod.conf

# 5. Build & Start
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 6. Logs prüfen
docker-compose -f docker-compose.prod.yml logs -f

# 7. Initial Setup (nur beim ersten Mal)
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### Updates deployen
```bash
# 1. Code aktualisieren
git pull origin main

# 2. Rebuild (nur wenn Dockerfile geändert)
docker-compose -f docker-compose.prod.yml build

# 3. Restart
docker-compose -f docker-compose.prod.yml up -d

# 4. Migrations (falls vorhanden)
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 5. Static Files
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

### Zero-Downtime Deployment
```bash
# 1. Build neue Images
docker-compose -f docker-compose.prod.yml build

# 2. Scale up mit neuen Containern
docker-compose -f docker-compose.prod.yml up -d --scale backend=2

# 3. Alte Container entfernen
docker-compose -f docker-compose.prod.yml up -d --scale backend=1 --remove-orphans
```

## Monitoring

### Logs anschauen
```bash
# Alle Services
docker-compose -f docker-compose.prod.yml logs -f

# Nur Backend
docker-compose -f docker-compose.prod.yml logs -f backend

# Nur Nginx
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Status prüfen
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Flower (Celery Monitoring)
```
https://yourdomain.com/flower/
Username/Password: Siehe .htpasswd
```

## Backup

### Datenbank Backup
```bash
# Backup erstellen
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres bogdol_go_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres bogdol_go_production < backup.sql
```

### Media Files Backup
```bash
# Backup
docker run --rm -v bogdol_go_prod_media_prod_volume:/data -v $(pwd):/backup alpine tar czf /backup/media_backup_$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v bogdol_go_prod_media_prod_volume:/data -v $(pwd):/backup alpine tar xzf /backup/media_backup.tar.gz -C /
```

## Troubleshooting

### Container neu starten
```bash
docker-compose -f docker-compose.prod.yml restart backend
```

### Shell in Container
```bash
docker-compose -f docker-compose.prod.yml exec backend sh
```

### Django Shell
```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell
```

### Nginx Config testen
```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Permissions Problem
```bash
docker-compose -f docker-compose.prod.yml exec backend chown -R django:django /app/media
```

## Security Checklist

- [ ] DJANGO_SECRET_KEY geändert
- [ ] DEBUG=0 in .env.production
- [ ] ALLOWED_HOSTS korrekt gesetzt
- [ ] SSL Zertifikate installiert
- [ ] Firewall konfiguriert (nur Port 80, 443 offen)
- [ ] .htpasswd für Flower erstellt
- [ ] Database Passwort stark
- [ ] Admin Passwort stark
- [ ] CORS_ALLOWED_ORIGINS nur eigene Domain
- [ ] Regelmäßige Backups eingerichtet
- [ ] Monitoring (z.B. Sentry) konfiguriert

## Performance Tuning

### Backend Skalierung (ASGI/Daphne)
- Das Backend läuft in Production als ASGI (Daphne), damit `/ws/` (Django Channels) funktioniert.
- Skalierung erfolgt am einfachsten über mehrere Backend-Container:
	`docker-compose -f docker-compose.prod.yml up -d --scale backend=2`

### Redis Memory Limit
In docker-compose.prod.yml redis command:
```
--maxmemory 2gb --maxmemory-policy allkeys-lru
```

### Nginx Cache aktivieren
Bereits konfiguriert in nginx.prod.conf

## Maintenance Mode

### Wartungsmodus aktivieren
```bash
# Erstelle maintenance.html
echo "<h1>Wartungsarbeiten</h1>" > nginx/maintenance.html

# Nginx config anpassen um traffic auf maintenance.html zu leiten
```

## Support

Bei Problemen siehe Logs oder kontaktiere den Administrator.
