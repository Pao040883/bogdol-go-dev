#!/usr/bin/env python
import os
import sys
import django

# Add the project directory to the Python path
sys.path.append('/backend/go')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django.setup()

from auth_user.models import CustomUser
from absences.models import Absence, AbsenceComment, AbsenceType
from datetime import date, timedelta

def create_test_comments():
    print("🗨️ Creating Test Communication System...")
    print("=" * 60)
    
    # Get first user and absence
    user = CustomUser.objects.first()
    absence = Absence.objects.first()
    
    if not user or not absence:
        print("❌ No user or absence found - please create some test data first")
        return
    
    print(f"📋 Using Absence #{absence.id}: {absence.start_date} to {absence.end_date}")
    print(f"👤 For User: {user.username}")
    
    # Create test comments
    comments_data = [
        {
            'content': 'Ich möchte gerne Urlaub beantragen für diese Zeit.',
            'comment_type': 'user_comment',
            'is_internal': False
        },
        {
            'content': 'Der Antrag wurde geprüft und ist genehmigungsfähig.',
            'comment_type': 'supervisor_note',
            'is_internal': True
        },
        {
            'content': 'Bitte beachten Sie, dass in dieser Zeit ein wichtiges Projekt läuft.',
            'comment_type': 'supervisor_note',
            'is_internal': False
        },
        {
            'content': 'HR-Prüfung: Urlaubsanspruch ist ausreichend vorhanden.',
            'comment_type': 'hr_note',
            'is_internal': True
        },
        {
            'content': 'Vielen Dank für die schnelle Bearbeitung!',
            'comment_type': 'user_comment',
            'is_internal': False
        }
    ]
    
    # Delete existing comments for this absence
    AbsenceComment.objects.filter(absence=absence).delete()
    
    # Create new comments
    for i, comment_data in enumerate(comments_data):
        comment = AbsenceComment.objects.create(
            absence=absence,
            author=user,
            **comment_data
        )
        print(f"✅ Comment #{comment.id}: {comment.comment_type} - {comment.content[:50]}...")
    
    print(f"\n📊 Statistics:")
    print(f"   Total Comments: {AbsenceComment.objects.filter(absence=absence).count()}")
    print(f"   Public Comments: {AbsenceComment.objects.filter(absence=absence, is_internal=False).count()}")
    print(f"   Internal Comments: {AbsenceComment.objects.filter(absence=absence, is_internal=True).count()}")
    print(f"   User Comments: {AbsenceComment.objects.filter(absence=absence, comment_type='user_comment').count()}")
    print(f"   Supervisor Notes: {AbsenceComment.objects.filter(absence=absence, comment_type='supervisor_note').count()}")
    print(f"   HR Notes: {AbsenceComment.objects.filter(absence=absence, comment_type='hr_note').count()}")
    
    print(f"\n🌐 API Test URLs:")
    print(f"   GET /api/absences/{absence.id}/  # Absence with comments")
    print(f"   POST /api/absences/{absence.id}/add_comment/  # Add new comment")
    
    print(f"\n🎯 Frontend Test:")
    print(f"   Navigate to: /absences/{absence.id}")
    print(f"   Test commenting functionality")
    print(f"   Test different user roles (employee, supervisor, HR)")
    
    print("\n🎉 Communication System Test Data Created!")
    print("=" * 60)

def test_api_endpoints():
    """Test the API endpoints for comments"""
    print("\n🔧 Testing API Endpoints...")
    
    from django.test import Client
    from django.contrib.auth import authenticate
    import json
    
    client = Client()
    user = CustomUser.objects.first()
    absence = Absence.objects.first()
    
    if not user or not absence:
        print("❌ No test data available")
        return
    
    # Login (simplified for testing)
    client.force_login(user)
    
    # Test GET absence with comments
    response = client.get(f'/api/absences/{absence.id}/')
    if response.status_code == 200:
        data = response.json()
        print(f"✅ GET /api/absences/{absence.id}/ - Status: {response.status_code}")
        print(f"   Comments in response: {len(data.get('comments', []))}")
    else:
        print(f"❌ GET /api/absences/{absence.id}/ - Status: {response.status_code}")
    
    # Test POST add comment
    comment_data = {
        'content': 'Test comment from API',
        'comment_type': 'user_comment',
        'is_internal': False
    }
    
    response = client.post(
        f'/api/absences/{absence.id}/add_comment/',
        data=json.dumps(comment_data),
        content_type='application/json'
    )
    
    if response.status_code in [200, 201]:
        print(f"✅ POST add_comment - Status: {response.status_code}")
        print(f"   New comment created successfully")
    else:
        print(f"❌ POST add_comment - Status: {response.status_code}")
        if hasattr(response, 'json'):
            print(f"   Error: {response.json()}")

if __name__ == '__main__':
    create_test_comments()
    test_api_endpoints()
