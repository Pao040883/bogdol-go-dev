# E2E-Verschlüsselung für GO Chat System

## Backend-Anpassungen erforderlich

### 1. User-Modell erweitern (auth_user/models.py)

```python
# In UserProfile Modell hinzufügen:
class UserProfile(models.Model):
    # ... bestehende Felder ...
    
    # E2E Encryption
    public_key = models.TextField(
        blank=True,
        null=True,
        help_text="RSA public key for end-to-end encryption (base64 encoded)"
    )
    public_key_updated_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When the public key was last updated"
    )
```

### 2. Migration erstellen

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

### 3. API-Endpoint für Public Key Upload (auth_user/profile_views.py)

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

@action(detail=False, methods=['post'])
def upload_public_key(self, request):
    """
    Upload user's public key for E2E encryption
    POST /api/profiles/upload_public_key/
    Body: { "public_key": "base64_encoded_key" }
    """
    public_key = request.data.get('public_key')
    if not public_key:
        return Response({'error': 'public_key required'}, status=400)
    
    profile = request.user.profile
    profile.public_key = public_key
    profile.public_key_updated_at = timezone.now()
    profile.save()
    
    return Response({
        'status': 'success',
        'message': 'Public key uploaded'
    })

@action(detail=False, methods=['get'])
def get_public_keys(self, request):
    """
    Get public keys for multiple users
    GET /api/profiles/get_public_keys/?user_ids=1,2,3
    """
    user_ids = request.GET.get('user_ids', '').split(',')
    if not user_ids:
        return Response({'error': 'user_ids required'}, status=400)
    
    profiles = UserProfile.objects.filter(
        user_id__in=user_ids
    ).select_related('user')
    
    keys = {}
    for profile in profiles:
        if profile.public_key:
            keys[str(profile.user.id)] = {
                'username': profile.user.username,
                'public_key': profile.public_key,
                'updated_at': profile.public_key_updated_at.isoformat() if profile.public_key_updated_at else None
            }
    
    return Response(keys)
```

### 4. ChatMessage Modell erweitern (auth_user/chat_models.py)

```python
class ChatMessage(models.Model):
    # ... bestehende Felder ...
    
    # E2E Encryption
    is_encrypted = models.BooleanField(
        default=False,
        help_text="Whether this message is end-to-end encrypted"
    )
    
    # encrypted_content wird im content Feld gespeichert
    # Format: JSON string mit {key, iv, content}
```

### 5. Serializer anpassen (auth_user/serializers.py)

```python
class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            # ... bestehende Felder ...
            'is_encrypted',
        ]
```

### 6. UserBasicSerializer erweitern

```python
class UserBasicSerializer(serializers.ModelSerializer):
    public_key = serializers.CharField(source='profile.public_key', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'avatar', 'online_status', 'public_key']
```

## Frontend-Integration

Die Frontend-Services sind bereits erstellt. Nächste Schritte:

1. **Bei Login**: Key-Pair generieren oder aus Storage laden
2. **Public Key hochladen**: Zum Server senden
3. **Vor dem Senden**: Nachricht verschlüsseln mit Empfänger-Public-Key
4. **Nach dem Empfang**: Nachricht entschlüsseln mit eigenem Private-Key

## Sicherheitshinweise

- Private Keys werden **nur im Browser** gespeichert (localStorage)
- Server hat **keinen Zugriff** auf Private Keys
- Nachrichten werden vor dem Senden verschlüsselt
- Server speichert nur verschlüsselte Daten
- Hybrid-Verschlüsselung: RSA für Key-Exchange, AES-GCM für Content

## Migration bestehender Nachrichten

Bestehende unverschlüsselte Nachrichten bleiben lesbar (is_encrypted=False).
Neue Nachrichten werden automatisch verschlüsselt.
