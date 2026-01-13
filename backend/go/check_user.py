from auth_user.models import CustomUser

user = CustomUser.objects.first()
if user:
    print(f'User: {user.username}')
    print(f'Blink ID: {getattr(user, "blink_id", "NICHT GESETZT")}')
    print(f'Blink Company: {getattr(user, "blink_company", "NICHT GESETZT")}')
    
    # Blink Konfiguration setzen für Tests
    if not hasattr(user, 'blink_id') or not user.blink_id:
        user.blink_id = 'testuser123'
        user.blink_company = 'testcompany'
        user.save()
        print('✅ Blink Konfiguration für Test gesetzt!')
        print(f'Neue Blink ID: {user.blink_id}')
        print(f'Neue Blink Company: {user.blink_company}')
else:
    print('❌ Kein User gefunden!')
