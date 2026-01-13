#!/usr/bin/env python
"""
Debug-Script für Badge-Berechnung
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.badge_helpers import get_user_badge_counts
from auth_user.chat_models import ChatConversation, ChatMessage
from workorders.models import RecurringWorkOrderChecklist
from auth_user.permissions import PermissionService

User = get_user_model()

def test_user_badges(email):
    """Testet Badge-Berechnung für einen User"""
    print(f"\n{'='*80}")
    print(f"BADGE-BERECHNUNG FÜR: {email}")
    print(f"{'='*80}\n")
    
    try:
        user = User.objects.get(email=email)
        print(f"✅ User gefunden: {user.first_name} {user.last_name} (ID: {user.id})")
        print(f"   is_superuser: {user.is_superuser}")
        print(f"   is_staff: {user.is_staff}")
        
        # Permission Service
        perm_service = PermissionService.for_user(user)
        checklist_scope = perm_service.get_permission_scope('can_view_checklist')
        print(f"\n📋 Checklist Permission Scope: {checklist_scope}")
        
        # Chat Debug
        print(f"\n💬 CHAT-BADGES:")
        conversations = ChatConversation.objects.filter(participants=user)
        print(f"   Anzahl Konversationen: {conversations.count()}")
        
        total_unread = 0
        for conv in conversations:
            unread = ChatMessage.objects.filter(
                conversation=conv,
                is_deleted=False
            ).exclude(
                read_by=user
            ).exclude(
                sender=user
            ).count()
            
            if unread > 0:
                print(f"   - Konversation {conv.id}: {unread} ungelesene Nachrichten")
                total_unread += unread
        
        print(f"   ➡️  Gesamt ungelesene Nachrichten: {total_unread}")
        
        # Arbeitsscheine Debug
        print(f"\n📄 ARBEITSSCHEINE-BADGES:")
        print(f"   Permission Scope: {checklist_scope}")
        
        # Alle aktiven Checklisten
        all_active = RecurringWorkOrderChecklist.objects.filter(is_active=True)
        print(f"   Gesamt aktive Checklisten: {all_active.count()}")
        
        # Nicht abgehakte für aktuellen Monat
        not_checked = all_active.filter(checked_this_month=False)
        print(f"   Nicht abgehakte (checked_this_month=False): {not_checked.count()}")
        
        if checklist_scope == 'OWN':
            assigned = RecurringWorkOrderChecklist.objects.filter(
                service_manager=user,
                is_active=True,
                checked_this_month=False
            ) | RecurringWorkOrderChecklist.objects.filter(
                assigned_billing_user=user,
                is_active=True,
                checked_this_month=False
            )
            assigned = assigned.distinct()
            print(f"   Als Service Manager zugewiesen: {RecurringWorkOrderChecklist.objects.filter(service_manager=user, is_active=True).count()}")
            print(f"   Als Billing User zugewiesen: {RecurringWorkOrderChecklist.objects.filter(assigned_billing_user=user, is_active=True).count()}")
            print(f"   ➡️  Gesamt zugewiesene (OWN): {assigned.count()}")
        
        # Finale Badge-Counts
        print(f"\n🔔 FINALE BADGE-COUNTS:")
        badges = get_user_badge_counts(user)
        for key, value in badges.items():
            print(f"   {key}: {value}")
        
    except User.DoesNotExist:
        print(f"❌ User mit Email '{email}' nicht gefunden")
    except Exception as e:
        print(f"❌ Fehler: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    # Teste für verschiedene User
    test_users = [
        'p.off@bogdol.de',  # Dein User
    ]
    
    for email in test_users:
        test_user_badges(email)
    
    print(f"\n{'='*80}\n")
