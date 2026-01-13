#!/usr/bin/env python
"""Prüfe und fixe Chat-Konversations-Participants"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.chat_models import ChatConversation
from auth_user.models import CustomUser

print("🔍 CHAT-KONVERSATIONEN")
print("=" * 60)

conversations = ChatConversation.objects.all().prefetch_related('participants')

for conv in conversations:
    print(f"\nKonversation #{conv.id} ({conv.conversation_type})")
    print(f"  Erstellt: {conv.created_at}")
    print(f"  Participants:")
    for user in conv.participants.all():
        print(f"    - {user.username} ({user.get_full_name()})")
    
    if conv.conversation_type == 'direct':
        # Direct Chat sollte genau 2 Participants haben
        if conv.participants.count() != 2:
            print(f"  ⚠️ WARNING: Direct Chat hat {conv.participants.count()} Participants!")

# Spezialcheck für Conversation 7
print("\n" + "=" * 60)
print("🔍 KONVERSATION #7 Details:")
print("=" * 60)

try:
    conv7 = ChatConversation.objects.get(id=7)
    participants = list(conv7.participants.all())
    print(f"Participants: {[p.username for p in participants]}")
    
    # Check if testuser should be in it
    testuser = CustomUser.objects.filter(username='testuser').first()
    if testuser:
        if testuser in participants:
            print(f"✅ testuser IST Participant")
        else:
            print(f"❌ testuser ist NICHT Participant!")
            
            # Frage ob fixen
            print("\n🔧 Soll testuser hinzugefügt werden? (y/n)")
            # response = input().strip().lower()
            # if response == 'y':
            #     conv7.participants.add(testuser)
            #     print("✅ testuser hinzugefügt!")
    else:
        print("❌ testuser existiert nicht!")
        
except ChatConversation.DoesNotExist:
    print("❌ Konversation #7 existiert nicht!")
