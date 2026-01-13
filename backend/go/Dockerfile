FROM python:3.11-slim

# Umgebungsvariablen
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1

# Arbeitsverzeichnis setzen
WORKDIR /app

# System-Dependencies installieren
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Python-Dependencies installieren
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application Code kopieren
COPY . .

# Static Files und Media Directories erstellen
RUN mkdir -p /app/staticfiles /app/media

# Permissions für entrypoint script
RUN chmod +x /app/docker-entrypoint.sh || true

# Non-root user erstellen für Security
RUN groupadd -r django && useradd -r -g django django
RUN chown -R django:django /app
USER django

# Gesundheitscheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# Port freigeben
EXPOSE 8000

# Default Command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
