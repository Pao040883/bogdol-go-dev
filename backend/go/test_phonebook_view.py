#!/usr/bin/env python
"""Teste UserPhonebookView mit query Parameter"""

import os, sys, django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.views import UserPhonebookView
from django.test import RequestFactory
from django.contrib.auth import get_user_model

User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()

factory = RequestFactory()

# Test 1: Mit query
print("\n🔍 Test 1: query='offermanns'\n")
request = factory.get('/api/phonebook/', {'query': 'offermanns'})
request.user = admin

view = UserPhonebookView.as_view()
response = view(request)
response.render()

import json
data = json.loads(response.content)
print(f"Anzahl Ergebnisse: {len(data)}")
for user in data:
    print(f"  - {user['first_name']} {user['last_name']}")

# Test 2: Ohne query
print("\n🔍 Test 2: ohne query (sollte alle zurückgeben)\n")
request2 = factory.get('/api/phonebook/')
request2.user = admin

response2 = view(request2)
response2.render()

data2 = json.loads(response2.content)
print(f"Anzahl Ergebnisse: {len(data2)}")

# Test 3: Mit anderem Begriff
print("\n🔍 Test 3: query='it'\n")
request3 = factory.get('/api/phonebook/', {'query': 'it'})
request3.user = admin

response3 = view(request3)
response3.render()

data3 = json.loads(response3.content)
print(f"Anzahl Ergebnisse: {len(data3)}")
for user in data3[:3]:  # Nur erste 3
    print(f"  - {user['first_name']} {user['last_name']} ({user['department']})")
