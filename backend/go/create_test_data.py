#!/usr/bin/env python
"""
Erstellt Test-User und Chat-Nachrichten für realistische Chat-Liste
"""
import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.chat_models import ChatConversation, ChatMessage
from auth_user.profile_models import UserProfile

User = get_user_model()

def create_test_users():
    """Erstellt mehrere Testuser mit Profilen"""
    users_data = [
        {
            'username': 'mmueller',
            'email': 'max.mueller@example.com',
            'password': 'test123',
            'first_name': 'Max',
            'last_name': 'Müller',
            'job_title': 'Software Developer'
        },
        {
            'username': 'sschmidt',
            'email': 'sarah.schmidt@example.com',
            'password': 'test123',
            'first_name': 'Sarah',
            'last_name': 'Schmidt',
            'job_title': 'Product Manager'
        },
        {
            'username': 'jbecker',
            'email': 'julia.becker@example.com',
            'password': 'test123',
            'first_name': 'Julia',
            'last_name': 'Becker',
            'job_title': 'UX Designer'
        },
        {
            'username': 'tweber',
            'email': 'thomas.weber@example.com',
            'password': 'test123',
            'first_name': 'Thomas',
            'last_name': 'Weber',
            'job_title': 'DevOps Engineer'
        },
        {
            'username': 'lrichter',
            'email': 'lisa.richter@example.com',
            'password': 'test123',
            'first_name': 'Lisa',
            'last_name': 'Richter',
            'job_title': 'Marketing Manager'
        },
    ]
    
    created_users = []
    
    for user_data in users_data:
        # Check if user exists
        if User.objects.filter(username=user_data['username']).exists():
            user = User.objects.get(username=user_data['username'])
            print(f"  ⚠️  User {user_data['username']} existiert bereits")
        else:
            user = User.objects.create_user(
                username=user_data['username'],
                email=user_data['email'],
                password=user_data['password'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name']
            )
            
            # Update Profile
            profile = user.profile
            profile.job_title = user_data['job_title']
            profile.save()
            
            print(f"  ✅ User erstellt: {user.get_full_name()} ({user.username})")
        
        created_users.append(user)
    
    return created_users


def create_test_conversations(main_user, test_users):
    """Erstellt verschiedene Konversationen mit Nachrichten"""
    
    conversations_data = [
        {
            'partner': test_users[0],  # Max Müller
            'messages': [
                ('partner', 'Hey Patrick, hast du die neue API-Dokumentation gesehen?', 2),
                ('me', 'Ja, sieht gut aus! Wann können wir anfangen?', 2),
                ('partner', 'Ich würde sagen nächste Woche. Passt das bei dir?', 1),
                ('me', 'Perfekt! Lass uns Montag sprechen.', 1),
                ('partner', 'Super, bis dann! 👍', 0.5),
            ]
        },
        {
            'partner': test_users[1],  # Sarah Schmidt
            'messages': [
                ('partner', 'Patrick, kannst du mir das Mockup nochmal schicken?', 5),
                ('me', 'Klar, schicke ich dir gleich per Mail.', 5),
                ('partner', 'Danke! Brauche es für die Präsentation morgen.', 4.5),
                ('me', 'Ist raus! Viel Erfolg morgen 🍀', 4.5),
                ('partner', 'Danke dir!', 4),
            ]
        },
        {
            'partner': test_users[2],  # Julia Becker
            'messages': [
                ('partner', 'Hi! Die neuen Designs sind fertig 🎨', 10),
                ('me', 'Wow, sehen super aus!', 10),
                ('partner', 'Freut mich! Können wir die nächste Woche besprechen?', 9.5),
            ]
        },
        {
            'partner': test_users[3],  # Thomas Weber
            'messages': [
                ('partner', 'Server läuft wieder, Problem behoben! ✅', 0.1),
            ]
        },
        {
            'partner': test_users[4],  # Lisa Richter
            'messages': [
                ('me', 'Hallo Lisa, wegen dem Marketing-Material...', 15),
                ('partner', 'Ja genau! Ich schicke dir heute noch die Entwürfe.', 14.5),
                ('me', 'Super, danke!', 14),
                ('partner', 'Kein Problem! Sag Bescheid wenn du Feedback hast.', 13.5),
                ('me', 'Mach ich!', 13),
                ('partner', 'Achja, brauchst du auch die Logo-Varianten?', 7),
            ]
        },
    ]
    
    for conv_data in conversations_data:
        partner = conv_data['partner']
        
        # Create or get conversation
        conv = ChatConversation.objects.filter(
            conversation_type='direct',
            participants=main_user
        ).filter(
            participants=partner
        ).first()
        
        if not conv:
            conv = ChatConversation.objects.create(
                conversation_type='direct',
                created_by=main_user
            )
            conv.participants.add(main_user, partner)
            print(f"\n  ✅ Konversation erstellt: {main_user.username} ↔ {partner.get_full_name()}")
        else:
            # Alte Nachrichten löschen für sauberen Test
            conv.messages.all().delete()
            print(f"\n  🔄 Konversation aktualisiert: {main_user.username} ↔ {partner.get_full_name()}")
        
        # Create messages
        for sender_type, content, hours_ago in conv_data['messages']:
            sender = main_user if sender_type == 'me' else partner
            sent_at = timezone.now() - timedelta(hours=hours_ago)
            
            msg = ChatMessage.objects.create(
                conversation=conv,
                sender=sender,
                content=content,
                sent_at=sent_at
            )
            
            # Mark messages from me as read by me
            if sender_type == 'me':
                msg.read_by.add(main_user)
            
            sender_display = 'Du' if sender_type == 'me' else partner.first_name
            print(f"     💬 {sender_display}: {content[:50]}... ({hours_ago}h ago)")
        
        # Update last_message_at (wird auch von Signal gemacht, aber sicher ist sicher)
        last_msg = conv.messages.order_by('-sent_at').first()
        if last_msg:
            conv.last_message_at = last_msg.sent_at
            conv.save()


def main():
    print("🚀 Erstelle Test-Daten für Chat-System...\n")
    
    # Get main user (poffermanns)
    try:
        main_user = User.objects.get(username='poffermanns')
        print(f"✅ Hauptuser gefunden: {main_user.get_full_name()}\n")
    except User.DoesNotExist:
        print("❌ User 'poffermanns' nicht gefunden!")
        return
    
    # Create test users
    print("📝 Erstelle Test-User...\n")
    test_users = create_test_users()
    
    # Create conversations with messages
    print("\n💬 Erstelle Konversationen und Nachrichten...\n")
    create_test_conversations(main_user, test_users)
    
    print("\n" + "="*60)
    print("✅ Test-Daten erfolgreich erstellt!")
    print("="*60)
    print(f"\n📊 Zusammenfassung:")
    print(f"   • {len(test_users)} Test-User erstellt")
    print(f"   • 5 Konversationen mit Nachrichten")
    print(f"   • Verschiedene Zeitpunkte (0.1h - 15h alt)")
    print(f"   • Gemischte gelesene/ungelesene Nachrichten\n")


if __name__ == '__main__':
    main()
