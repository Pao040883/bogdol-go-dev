"""
Debug Script für Badge-Berechnung
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.badge_helpers import get_user_badge_counts
from auth_user.permission_service import PermissionService
from django.db.models import Q

User = get_user_model()
user = User.objects.get(username='poffermanns')

print('=' * 80)
print(f'DEBUG: Badge-Berechnung für User: {user.username} (ID: {user.id})')
print('=' * 80)

# Permission Service
perm_service = PermissionService.for_user(user)
print(f'\nPermission Scope für can_view_checklist: {perm_service.get_permission_scope("can_view_checklist")}')
print(f'Permission für can_use_chat: {perm_service.has_permission("can_use_chat")}')

# Chat Debug
print('\n--- CHAT DEBUG ---')
from auth_user.chat_models import ChatConversation, ChatMessage

conversations = ChatConversation.objects.filter(participants=user, is_archived=False)
print(f'Anzahl Konversationen: {conversations.count()}')

total_unread = 0
unread_conversations = 0
for conv in conversations:
    unread = ChatMessage.objects.filter(
        conversation=conv,
        is_deleted=False
    ).exclude(sender=user).exclude(read_by=user)
    count = unread.count()
    total_unread += count
    
    # Hat die Konversation ungelesene Nachrichten?
    if count > 0:
        unread_conversations += 1
        print(f'  Konversation {conv.id} ({conv.name}): {count} ungelesene Nachrichten')
        # Prüfe hidden_for_users
        if user in conv.hidden_for_users.all():
            print(f'    ⚠️ VERSTECKT für User!')
        for msg in unread[:3]:
            read_by_users = list(msg.read_by.all())
            print(f'    - Nachricht {msg.id} von {msg.sender.username}: is_deleted={msg.is_deleted}, read_by={[u.username for u in read_by_users]}')

print(f'\nGESAMT Ungelesene Nachrichten: {total_unread}')
print(f'GESAMT Konversationen mit ungelesenen Nachrichten: {unread_conversations}')

# Arbeitsscheine Debug
print('\n--- ARBEITSSCHEINE DEBUG ---')
from workorders.models import RecurringWorkOrderChecklist, WorkOrder

checklist_scope = perm_service.get_permission_scope('can_view_checklist')
print(f'Checklist Scope: {checklist_scope}')
print(f'User is_superuser: {user.is_superuser}')
print(f'User is_staff: {user.is_staff}')

# ECHTE Arbeitsscheine (WorkOrder)
print('\n=== ECHTE ARBEITSSCHEINE (WorkOrder) ===')
submitted_orders = WorkOrder.objects.filter(status='submitted')
print(f'Eingereichte Arbeitsscheine (submitted): {submitted_orders.count()}')
for order in submitted_orders[:10]:
    print(f'  - Order {order.id}: {order.work_type} - Status: {order.status}')

print('\n=== HAKLISTE (RecurringWorkOrderChecklist) ===')
if checklist_scope:
    all_active = RecurringWorkOrderChecklist.objects.filter(is_active=True, checked_this_month=False)
    print(f'Alle aktiven, nicht abgehakten Checklisten: {all_active.count()}')
    
    if checklist_scope == 'ALL' or user.is_superuser:
        print(f'Alle Checklisten (ALL scope): {all_active.count()}')

# Finale Badge-Berechnung
print('\n--- FINALE BADGE-COUNTS ---')
badges = get_user_badge_counts(user)
for key, value in badges.items():
    print(f'{key}: {value}')
