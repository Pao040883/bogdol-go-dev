@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM Bogdol GO - Development Docker Setup (Windows)
REM =============================================================================

echo 🐳 Starting Bogdol GO Development Environment...
echo ==================================================

REM Prüfe ob Docker läuft
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker ist nicht gestartet!
    echo Bitte starten Sie Docker Desktop und versuchen Sie es erneut.
    pause
    exit /b 1
)

REM Prüfe ob docker-compose verfügbar ist
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️ docker-compose nicht gefunden, verwende 'docker compose'
    set DOCKER_COMPOSE=docker compose
) else (
    set DOCKER_COMPOSE=docker-compose
)

REM .env Datei prüfen
if not exist .env (
    echo ⚠️ .env Datei nicht gefunden
    if exist .env.template (
        echo 📄 Kopiere .env.template zu .env...
        copy .env.template .env >nul
        echo ✅ .env Datei erstellt. Bitte anpassen falls nötig.
    ) else (
        echo ❌ Keine .env.template gefunden!
        pause
        exit /b 1
    )
)

REM Nginx .htpasswd für Flower erstellen
if not exist nginx\.htpasswd (
    echo 🔐 Erstelle .htpasswd für Flower Monitoring...
    if not exist nginx mkdir nginx
    REM admin:flower123
    echo admin:$apr1$mFLz8Z.K$PYK1dF8VQ1hE.Nz8KvQ8l1 > nginx\.htpasswd
    echo ✅ Flower Login: admin/flower123
)

REM Build und starte alle Services
echo 🔨 Building und Starting Services...
%DOCKER_COMPOSE% down --remove-orphans
%DOCKER_COMPOSE% build --no-cache

echo 🚀 Starting Services...
%DOCKER_COMPOSE% up -d

REM Warte auf Services
echo ⏳ Warte auf Services...
timeout /t 15 /nobreak >nul

REM Prüfe Service Health
echo 🔍 Prüfe Service Health...

echo   📊 Database: 
%DOCKER_COMPOSE% exec db pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo ❌ FAILED
) else (
    echo ✅ OK
)

echo   🔴 Redis: 
%DOCKER_COMPOSE% exec redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ❌ FAILED
) else (
    echo ✅ OK
)

REM Warte bis Backend startet
echo   🐍 Backend: 
timeout /t 10 /nobreak >nul
curl -f http://localhost:8000/api/health/ >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Starting...
) else (
    echo ✅ OK
)

REM Führe Django Setup aus
echo 🔧 Django Setup...
echo   📋 Running migrations...
%DOCKER_COMPOSE% exec backend python manage.py migrate

echo   📊 Collecting static files...
%DOCKER_COMPOSE% exec backend python manage.py collectstatic --noinput

echo   👤 Creating superuser...
%DOCKER_COMPOSE% exec backend python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@bogdol.gmbh', 'admin123') if not User.objects.filter(username='admin').exists() else print('Superuser already exists')"

echo.
echo 🎉 Development Environment Ready!
echo ==================================================
echo 📱 Frontend:         http://localhost:80
echo 🔧 Django Admin:     http://localhost:80/admin/ (admin/admin123)
echo 🌺 Flower (Celery):  http://localhost:5555 (admin/flower123)
echo 🔍 Backend API:      http://localhost:80/api/
echo 📊 Health Check:     http://localhost:80/api/health/
echo 📈 System Stats:     http://localhost:80/api/stats/
echo.
echo 📝 Useful Commands:
echo   🔍 Logs anzeigen:     %DOCKER_COMPOSE% logs -f
echo   🛑 Services stoppen:  %DOCKER_COMPOSE% down
echo   🔄 Services neu:      %DOCKER_COMPOSE% restart
echo   🐚 Backend Shell:     %DOCKER_COMPOSE% exec backend python manage.py shell
echo.
echo ✅ Setup Complete!
pause
