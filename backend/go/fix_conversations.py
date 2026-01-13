"""
Repariert bestehende Chat-Konversationen:
- Fügt Sender als Participants hinzu
- Setzt last_message_at
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.chat_models import ChatConversation

print("Repariere Chat-Konversationen...")

for conv in ChatConversation.objects.all():
    updated = False
    
    # Hole alle Nachrichten
    messages = conv.messages.all()
    
    if messages.exists():
        # Setze last_message_at
        last_msg = messages.order_by('-sent_at').first()
        if conv.last_message_at != last_msg.sent_at:
            conv.last_message_at = last_msg.sent_at
            updated = True
            print(f"  Conv {conv.id}: last_message_at gesetzt")
        
        # Füge alle Sender als Participants hinzu
        for msg in messages:
            if msg.sender and not conv.participants.filter(id=msg.sender.id).exists():
                conv.participants.add(msg.sender)
                print(f"  Conv {conv.id}: {msg.sender.username} als Participant hinzugefügt")
                updated = True
    
    if updated:
        conv.save()
        print(f"✅ Conv {conv.id} aktualisiert")

print("\nFertig!")
