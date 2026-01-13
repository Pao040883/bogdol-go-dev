# Development Docker Startup Script for PowerShell
# Starts all services in Development-Mode with Hot-Reload

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Bogdol GO - Development Mode  " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Parameter
param(
    [switch]$Build,
    [switch]$Down,
    [switch]$Logs,
    [switch]$Restart
)

$ErrorActionPreference = "Stop"

# Docker Compose File
$ComposeFile = "docker-compose.dev.yml"

# Functions
function Show-Help {
    Write-Host "Verwendung:" -ForegroundColor Yellow
    Write-Host "  .\scripts\docker-dev.ps1              # Services starten" -ForegroundColor White
    Write-Host "  .\scripts\docker-dev.ps1 -Build       # Mit Rebuild" -ForegroundColor White
    Write-Host "  .\scripts\docker-dev.ps1 -Down        # Services stoppen" -ForegroundColor White
    Write-Host "  .\scripts\docker-dev.ps1 -Logs        # Logs anzeigen" -ForegroundColor White
    Write-Host "  .\scripts\docker-dev.ps1 -Restart     # Services neu starten" -ForegroundColor White
    Write-Host ""
    Write-Host "URLs nach dem Start:" -ForegroundColor Yellow
    Write-Host "  Frontend:  http://localhost" -ForegroundColor Green
    Write-Host "  Backend:   http://localhost/api/" -ForegroundColor Green
    Write-Host "  Admin:     http://localhost/admin-go/" -ForegroundColor Green
    Write-Host "  Flower:    http://localhost:5555" -ForegroundColor Green
    Write-Host ""
}

# Down
if ($Down) {
    Write-Host "Stoppe Development Services..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile down
    Write-Host "Services gestoppt!" -ForegroundColor Green
    exit 0
}

# Logs
if ($Logs) {
    Write-Host "Zeige Logs (Ctrl+C zum Beenden)..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile logs -f
    exit 0
}

# Restart
if ($Restart) {
    Write-Host "Starte Services neu..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile restart
    Write-Host "Services neu gestartet!" -ForegroundColor Green
    Show-Help
    exit 0
}

# Build & Start
if ($Build) {
    Write-Host "Baue und starte Development Services..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile up --build -d
} else {
    Write-Host "Starte Development Services..." -ForegroundColor Yellow
    docker-compose -f $ComposeFile up -d
}

Write-Host ""
Write-Host "Warte auf Services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Status check
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
docker-compose -f $ComposeFile ps

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Development Mode AKTIV!       " -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Show-Help

Write-Host "Hinweise:" -ForegroundColor Cyan
Write-Host "  - Code-Aenderungen werden automatisch uebernommen" -ForegroundColor White
Write-Host "  - Kein Build notwendig bei Code-Aenderungen" -ForegroundColor White
Write-Host "  - Frontend: Hot-Reload aktiv" -ForegroundColor White
Write-Host "  - Backend: Auto-Reload aktiv" -ForegroundColor White
Write-Host ""
Write-Host "Logs anzeigen: .\scripts\docker-dev.ps1 -Logs" -ForegroundColor Yellow
Write-Host "Services stoppen: .\scripts\docker-dev.ps1 -Down" -ForegroundColor Yellow
Write-Host ""
