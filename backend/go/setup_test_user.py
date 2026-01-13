import os
import sys
import django

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.models import CustomUser

def configure_test_user():
    # Ersten User holen oder erstellen
    user = CustomUser.objects.first()
    
    if not user:
        # Test-User erstellen
        user = CustomUser.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        print(f'✅ Test-User erstellt: {user.username}')
    
    # Blink Konfiguration setzen
    user.blink_id = 12345
    user.blink_company = 67890
    user.save()
    
    print(f'✅ User konfiguriert:')
    print(f'   Username: {user.username}')
    print(f'   Blink ID: {user.blink_id}')
    print(f'   Blink Company: {user.blink_company}')
    
    return user

if __name__ == '__main__':
    configure_test_user()
