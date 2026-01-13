"""
Sync UserProfile.department to DepartmentMember entries
This script migrates old department assignments to the new DepartmentMember system
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.models import UserProfile
from auth_user.profile_models import DepartmentMember, DepartmentRole

def sync_department_members():
    """Create DepartmentMember entries for users who have a department assigned"""
    
    # Get users with department but no DepartmentMember entry
    users_with_dept = UserProfile.objects.filter(department__isnull=False).select_related('department', 'user')
    
    created_count = 0
    skipped_count = 0
    
    # Get or create a default role for members without a specific role
    default_role, _ = DepartmentRole.objects.get_or_create(
        code='MITARBEITER',
        defaults={
            'name': 'Mitarbeitende',
            'hierarchy_level': 999,
            'org_type': 'both'
        }
    )
    
    for profile in users_with_dept:
        # Check if DepartmentMember already exists
        existing = DepartmentMember.objects.filter(
            user=profile.user,
            department=profile.department
        ).first()
        
        if existing:
            print(f"⏭️  Skipping {profile.user.get_full_name()} - already has DepartmentMember")
            skipped_count += 1
            continue
        
        # Use profile.role if available, otherwise use default role
        role = profile.role if profile.role else default_role
        
        # Create DepartmentMember
        member = DepartmentMember.objects.create(
            user=profile.user,
            department=profile.department,
            role=role,
            position_title=profile.user.get_full_name(),
            is_primary=True,
            is_active=True
        )
        
        print(f"✅ Created DepartmentMember: {profile.user.get_full_name()} -> {profile.department.name} ({role.name})")
        created_count += 1
    
    print(f"\n📊 Summary:")
    print(f"   Created: {created_count}")
    print(f"   Skipped: {skipped_count}")
    print(f"   Total:   {created_count + skipped_count}")

if __name__ == '__main__':
    print("🔄 Syncing UserProfile.department to DepartmentMember...\n")
    sync_department_members()
    print("\n✨ Done!")
