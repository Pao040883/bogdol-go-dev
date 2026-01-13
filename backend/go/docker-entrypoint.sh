#!/bin/bash

# Warten auf Database
echo "Waiting for database..."
while ! nc -z db 5432; do
  sleep 0.1
done
echo "Database started"

# Warten auf Redis
echo "Waiting for redis..."
while ! nc -z redis 6379; do
  sleep 0.1
done
echo "Redis started"

# Django Migrationen ausführen
echo "Running migrations..."
python manage.py migrate

# Static Files sammeln
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Superuser erstellen (falls nicht vorhanden)
echo "Creating superuser if not exists..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@bogdol.gmbh', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

# Command ausführen
exec "$@"
