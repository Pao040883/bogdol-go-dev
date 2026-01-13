# Development Setup mit Hot-Reload

Dieses Setup ermöglicht die Entwicklung ohne ständige Rebuilds. Änderungen werden automatisch übernommen.

## Quick Start

```powershell
# Services starten
.\scripts\docker-dev.ps1

# Mit Rebuild (beim ersten Start oder nach Dependency-Änderungen)
.\scripts\docker-dev.ps1 -Build
```

## URLs

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api/
- **Django Admin**: http://localhost/admin/
- **Flower (Celery Monitoring)**: http://localhost:5555

## Features

### ✅ Hot-Reload
- **Frontend**: Änderungen an TypeScript/HTML/SCSS werden sofort im Browser sichtbar
- **Backend**: Änderungen an Python-Code werden automatisch erkannt und Django startet neu

### ✅ Volume Mounting
- Source Code wird als Volume gemountet (nicht kopiert)
- Änderungen auf dem Host sind sofort im Container verfügbar
- Kein Rebuild notwendig bei Code-Änderungen

### ✅ WebSocket Support
- Angular Dev Server mit WebSocket für Live-Reload
- Browser aktualisiert sich automatisch bei Änderungen

### ✅ Separate Dev-Umgebung
- Eigene Container-Namen (`_dev` Suffix)
- Eigene Volumes (keine Konflikte mit Prod)
- Eigenes Netzwerk (172.21.0.0/16)

## Befehle

```powershell
# Services starten
.\scripts\docker-dev.ps1

# Mit Rebuild
.\scripts\docker-dev.ps1 -Build

# Services stoppen
.\scripts\docker-dev.ps1 -Down

# Logs anzeigen (live)
.\scripts\docker-dev.ps1 -Logs

# Services neu starten
.\scripts\docker-dev.ps1 -Restart

# Einzelne Services neu starten
docker-compose -f docker-compose.dev.yml restart frontend
docker-compose -f docker-compose.dev.yml restart backend

# In Container einloggen
docker exec -it bogdol_go_backend_dev bash
docker exec -it bogdol_go_frontend_dev sh

# Django Befehle ausführen
docker exec bogdol_go_backend_dev python manage.py migrate
docker exec bogdol_go_backend_dev python manage.py createsuperuser
docker exec bogdol_go_backend_dev python manage.py shell

# npm Befehle ausführen
docker exec bogdol_go_frontend_dev npm install <package>
```

## Workflow

### 1. Backend-Entwicklung
```powershell
# Code in backend/go/ bearbeiten
# Django erkennt Änderungen automatisch
# Server startet bei .py Änderungen neu
```

### 2. Frontend-Entwicklung
```powershell
# Code in frontend/src/ bearbeiten
# Browser lädt automatisch neu
# Kein manuelles Refresh notwendig
```

### 3. Dependency-Updates

**Backend** (requirements.txt geändert):
```powershell
.\scripts\docker-dev.ps1 -Down
.\scripts\docker-dev.ps1 -Build
```

**Frontend** (package.json geändert):
```powershell
docker-compose -f docker-compose.dev.yml down frontend
docker-compose -f docker-compose.dev.yml up -d --build frontend
```

### 4. Database Migrations
```powershell
# Migration erstellen
docker exec bogdol_go_backend_dev python manage.py makemigrations

# Migration ausführen
docker exec bogdol_go_backend_dev python manage.py migrate
```

## Nginx Proxy Routing

### Frontend (Angular Dev Server)
- `http://localhost/` → `http://frontend:4200`
- WebSocket für Hot-Reload wird durchgeleitet
- Caching deaktiviert

### Backend (Django Runserver)
- `http://localhost/api/` → `http://backend:8000/api/`
- `http://localhost/admin/` → `http://backend:8000/admin/`
- Caching deaktiviert

### Static & Media Files
- `http://localhost/static/` → Django Static Files
- `http://localhost/media/` → User Uploads

## Unterschiede zu Production

| Feature | Development | Production |
|---------|------------|------------|
| Code | Volume Mount | Baked into Image |
| Frontend Server | Angular Dev Server | Nginx Static |
| Backend Server | Django Runserver | Gunicorn |
| Hot-Reload | ✅ Aktiv | ❌ Deaktiviert |
| Caching | ❌ Deaktiviert | ✅ Aktiv |
| Build | Nur bei Start | Bei jedem Deploy |
| Debugging | ✅ Einfach | ❌ Schwierig |
| Performance | Langsamer | Schneller |

## Troubleshooting

### Frontend lädt nicht
```powershell
# Container Logs prüfen
docker logs bogdol_go_frontend_dev

# Node Modules neu installieren
docker exec bogdol_go_frontend_dev rm -rf node_modules
docker-compose -f docker-compose.dev.yml up -d --build frontend
```

### Backend startet nicht
```powershell
# Logs prüfen
docker logs bogdol_go_backend_dev

# Dependencies neu installieren
docker-compose -f docker-compose.dev.yml up -d --build backend
```

### Hot-Reload funktioniert nicht (Windows)
```powershell
# CHOKIDAR_USEPOLLING ist bereits gesetzt
# Falls Probleme: Polling-Intervall erhöhen
# In docker-compose.dev.yml bei frontend:
# environment:
#   - CHOKIDAR_INTERVAL=2000
```

### Port bereits belegt
```powershell
# Alte Container stoppen
.\scripts\docker-dev.ps1 -Down

# Oder Production Container stoppen
docker-compose -f docker-compose.yml down
```

## Best Practices

1. **Immer Dev-Mode für Entwicklung nutzen**
   - Schneller Workflow
   - Sofortiges Feedback
   - Kein Build-Overhead

2. **Production-Mode vor Deployment testen**
   ```powershell
   .\scripts\docker-prod.sh
   ```

3. **Logs regelmäßig checken**
   ```powershell
   .\scripts\docker-dev.ps1 -Logs
   ```

4. **Bei Problemen: Clean Restart**
   ```powershell
   .\scripts\docker-dev.ps1 -Down
   .\scripts\docker-dev.ps1 -Build
   ```

## Nächste Schritte

Nach dem Setup:

1. Backend Admin anlegen:
   ```powershell
   docker exec -it bogdol_go_backend_dev python manage.py createsuperuser
   ```

2. Browser öffnen:
   - http://localhost
   - http://localhost/admin/

3. Entwickeln:
   - Code bearbeiten
   - Speichern
   - Browser aktualisiert sich automatisch

4. Testen:
   - Änderungen werden sofort sichtbar
   - Kein manueller Reload notwendig
