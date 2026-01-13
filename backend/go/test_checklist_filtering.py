#!/usr/bin/env python
"""Test checklist API filtering for different users"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.test import RequestFactory
from workorders.views import RecurringWorkOrderChecklistViewSet

User = get_user_model()

# Erstelle Request Factory
factory = RequestFactory()

# Test für dkomsic (Scope: OWN, ist Faktur für Item ID 2)
print("=== TEST: dkomsic (Faktur für Item 2, Scope OWN) ===")
dkomsic = User.objects.get(username='dkomsic')
request = factory.get('/api/workorders/checklist/')
request.user = dkomsic

viewset = RecurringWorkOrderChecklistViewSet(action='list')
viewset.request = request
viewset.format_kwarg = None

queryset = viewset.get_queryset()
print(f"Anzahl Items: {queryset.count()}")
for item in queryset[:5]:
    sm = item.service_manager.username if item.service_manager else 'None'
    ab = item.assigned_billing_user.username if item.assigned_billing_user else 'None'
    print(f"  ID {item.id}: {item.object_number} | SM: {sm} | Faktur: {ab}")

# Test für eoezbakir (Scope: OWN, ist Service Manager für Item ID 2)
print("\n=== TEST: eoezbakir (Service Manager für Item 2, Scope OWN) ===")
eoezbakir = User.objects.get(username='eoezbakir')
request = factory.get('/api/workorders/checklist/')
request.user = eoezbakir

viewset = RecurringWorkOrderChecklistViewSet(action='list')
viewset.request = request
viewset.format_kwarg = None

queryset = viewset.get_queryset()
print(f"Anzahl Items: {queryset.count()}")
for item in queryset[:5]:
    sm = item.service_manager.username if item.service_manager else 'None'
    ab = item.assigned_billing_user.username if item.assigned_billing_user else 'None'
    print(f"  ID {item.id}: {item.object_number} | SM: {sm} | Faktur: {ab}")

# Test für mreuter (Scope: ALL, Staff)
print("\n=== TEST: mreuter (Staff, Scope ALL) ===")
mreuter = User.objects.get(username='mreuter')
request = factory.get('/api/workorders/checklist/')
request.user = mreuter

viewset = RecurringWorkOrderChecklistViewSet(action='list')
viewset.request = request
viewset.format_kwarg = None

queryset = viewset.get_queryset()
print(f"Anzahl Items: {queryset.count()}")
for item in queryset[:5]:
    sm = item.service_manager.username if item.service_manager else 'None'
    ab = item.assigned_billing_user.username if item.assigned_billing_user else 'None'
    print(f"  ID {item.id}: {item.object_number} | SM: {sm} | Faktur: {ab}")
