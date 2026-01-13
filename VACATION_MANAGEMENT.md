# Urlaubsverwaltung - Automatischer Jahreswechsel

## Übersicht

Das System verwaltet automatisch Urlaubsansprüche über mehrere Jahre hinweg. Zum Jahreswechsel werden:
- Resturlaubstage aus dem Vorjahr berechnet
- Automatisch ins neue Jahr übertragen
- Optional begrenzt (z.B. maximal 5 Tage Resturlaub)

## Automatischer Jahreswechsel

### Celery Beat (Automatisch)

Der Jahreswechsel wird automatisch am **1. Januar** jeden Jahres durch eine Celery Beat Task ausgeführt:

```python
# In config/celery.py
'update-vacation-year': {
    'task': 'auth_user.tasks.update_vacation_year',
    'schedule': 86400.0,  # Täglich geprüft, nur am 1. Januar ausgeführt
}
```

Die Task prüft täglich, führt aber nur am 1. Januar die Aktualisierung aus.

### Manueller Jahreswechsel

Falls der automatische Jahreswechsel nicht funktioniert oder für Tests benötigt wird:

```bash
# Dry-Run (Simulation ohne Speichern)
python manage.py update_vacation_year --dry-run

# Jahreswechsel ausführen
python manage.py update_vacation_year

# Für spezifisches Jahr
python manage.py update_vacation_year --year 2026

# Mit Begrenzung des Resturlaubs
python manage.py update_vacation_year --limit-carryover 5

# Erzwinge Update auch für bereits aktualisierte Benutzer
python manage.py update_vacation_year --force
```

## User Model Felder

### Urlaubsfelder im CustomUser Model

```python
class CustomUser(AbstractUser):
    vacation_entitlement = models.PositiveIntegerField(
        default=30,
        help_text="Urlaubsanspruch in Tagen für das aktuelle Jahr"
    )
    carryover_vacation = models.PositiveIntegerField(
        default=0,
        help_text="Resturlaub aus dem Vorjahr"
    )
    vacation_year = models.PositiveIntegerField(
        default=2025,
        help_text="Jahr für das der Urlaubsanspruch gilt"
    )
```

### Berechnungsmethoden

```python
# Verwendete Urlaubstage für ein Jahr
used_days = user.get_used_vacation_days(year=2025)

# Verbleibende Urlaubstage
remaining = user.get_remaining_vacation_days(year=2025)

# Prüfe ob Urlaub genommen werden kann
can_take = user.can_take_vacation(days=5, year=2025)
```

## Jahreswechsel-Logik

### Berechnung des Resturlaubs

```python
# Beispiel: User hat 30 Tage Anspruch, 5 Tage Resturlaub = 35 Tage gesamt
# Bereits genommen: 20 Tage
# Verbleibend: 35 - 20 = 15 Tage

# Am 1. Januar:
user.carryover_vacation = 15  # Verbleibende Tage werden Resturlaub
user.vacation_year = 2026     # Jahr wird erhöht
user.vacation_entitlement = 30  # Bleibt gleich

# Neuer Anspruch 2026: 30 + 15 = 45 Tage gesamt
```

### Optional: Begrenzung des Resturlaubs

Standardmäßig wird der gesamte Resturlaub übertragen. Optional kann dies begrenzt werden:

```python
# In auth_user/tasks.py
# Zeile auskommentieren für Begrenzung auf 5 Tage:
remaining_days = min(remaining_days, 5)
```

Oder via Management Command:

```bash
python manage.py update_vacation_year --limit-carryover 5
```

## Resturlaub-Warnungen

### Monatliche Prüfung

Eine weitere Celery Task warnt Benutzer mit hohem Resturlaub im Oktober/November:

```python
'check-vacation-expiry': {
    'task': 'auth_user.tasks.check_vacation_expiry',
    'schedule': 2592000.0,  # Monatlich
}
```

Die Task:
- Läuft ab Oktober
- Warnt bei mehr als 10 verbleibenden Urlaubstagen
- Kann E-Mail-Benachrichtigungen senden (TODO)

## Frontend Integration

### Absences Page

Die Urlaubsübersicht (`absences.page.ts`) berechnet automatisch:

```typescript
vacationStats = computed(() => {
  const currentUser = activeUser as User;
  const entitlement = currentUser?.vacation_entitlement || 30;
  const carryover = currentUser?.carryover_vacation || 0;
  const totalAvailable = entitlement + carryover;
  const remaining = totalAvailable - usedDays;
  
  return { entitlement, carryover, totalAvailable, usedDays, remaining };
});
```

### Admin User Management

Administratoren können Urlaubsfelder manuell anpassen:

- `vacation_entitlement`: Jährlicher Anspruch
- `carryover_vacation`: Resturlaub aus Vorjahr
- `vacation_year`: Gültiges Jahr

## Testing

### Test-Szenario 1: Normaler Jahreswechsel

```bash
# 1. Prüfe aktuellen Stand
docker-compose exec backend python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> u = User.objects.get(username='testuser')
>>> print(f"Jahr: {u.vacation_year}, Anspruch: {u.vacation_entitlement}, Resturlaub: {u.carryover_vacation}")

# 2. Simuliere Jahreswechsel
docker-compose exec backend python manage.py update_vacation_year --year 2026 --dry-run

# 3. Führe aus
docker-compose exec backend python manage.py update_vacation_year --year 2026
```

### Test-Szenario 2: Begrenzter Resturlaub

```bash
# User hat 30 Tage übrig
docker-compose exec backend python manage.py update_vacation_year --year 2026 --limit-carryover 5

# User bekommt nur 5 Tage Resturlaub, rest verfällt
```

## Troubleshooting

### Problem: Jahreswechsel wurde nicht ausgeführt

```bash
# Prüfe Celery Beat Logs
docker-compose logs celery-beat | grep vacation

# Führe manuell aus
docker-compose exec backend python manage.py update_vacation_year
```

### Problem: Falsche Urlaubstage

```bash
# Prüfe User-Daten
docker-compose exec backend python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> u = User.objects.get(username='username')
>>> print(f"Anspruch: {u.vacation_entitlement}")
>>> print(f"Resturlaub: {u.carryover_vacation}")
>>> print(f"Jahr: {u.vacation_year}")
>>> print(f"Verwendet: {u.get_used_vacation_days()}")
>>> print(f"Verbleibend: {u.get_remaining_vacation_days()}")

# Korrigiere manuell
>>> u.carryover_vacation = 5
>>> u.save()
```

### Problem: User auf falsches Jahr setzen

```bash
# Setze alle User auf bestimmtes Jahr
docker-compose exec backend python manage.py shell
>>> from auth_user.tasks import sync_vacation_data_for_year
>>> sync_vacation_data_for_year(2025)
```

## Deployment Checklist

- [ ] Celery Worker läuft
- [ ] Celery Beat läuft
- [ ] Task `auth_user.tasks.update_vacation_year` ist registriert
- [ ] Task `auth_user.tasks.check_vacation_expiry` ist registriert
- [ ] Zeitzone korrekt konfiguriert (UTC in celery.py)
- [ ] Alle User haben korrekte `vacation_year` Werte
- [ ] Management Command getestet

## Migration von Alt-Daten

Falls User noch alte Daten haben (z.B. vacation_year = 2023):

```bash
# Option 1: Setze alle auf aktuelles Jahr
docker-compose exec backend python manage.py update_vacation_year --force

# Option 2: SQL Update
docker-compose exec backend python manage.py dbshell
UPDATE auth_user_customuser SET vacation_year = 2025 WHERE vacation_year < 2025;
```
