#!/usr/bin/env python
"""
E2E Encryption Key Generator für User ohne Frontend-Zugang

Generiert RSA-Schlüsselpaare für User und speichert den Public Key in der DB.
Da E2E-Keys normalerweise im Browser generiert werden, nutzt dieses Script
die gleichen Krypto-Standards (RSA-OAEP 2048-bit).

Verwendung:
    docker compose exec backend python generate_e2e_keys.py --user-id 6
    docker compose exec backend python generate_e2e_keys.py --all
"""

import os
import sys
import django
import base64
import argparse
from datetime import datetime

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from auth_user.profile_models import UserProfile

User = get_user_model()

try:
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("❌ ERROR: 'cryptography' library not installed")
    print("Install it with: pip install cryptography")
    sys.exit(1)


def generate_rsa_keypair():
    """
    Generiert ein RSA-Schlüsselpaar (2048-bit)
    Entspricht dem Frontend: crypto.subtle.generateKey("RSA-OAEP", 2048, ...)
    """
    print("🔑 Generating RSA-2048 key pair...")
    
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    public_key = private_key.public_key()
    
    return private_key, public_key


def export_public_key_spki(public_key):
    """
    Exportiert Public Key im SPKI-Format (SubjectPublicKeyInfo) als Base64
    Entspricht dem Frontend: crypto.subtle.exportKey("spki", publicKey)
    """
    spki_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    # Base64 encode (wie im Browser)
    spki_base64 = base64.b64encode(spki_bytes).decode('utf-8')
    
    return spki_base64


def save_public_key_for_user(user_id, public_key_b64):
    """
    Speichert den Public Key in der UserProfile-Datenbank
    """
    try:
        user = User.objects.get(id=user_id)
        profile, created = UserProfile.objects.get_or_create(user=user)
        
        profile.public_key = public_key_b64
        profile.public_key_updated_at = datetime.now()
        profile.save()
        
        print(f"✅ Public key saved for user {user.username} (ID: {user_id})")
        print(f"   Key length: {len(public_key_b64)} characters")
        print(f"   First 50 chars: {public_key_b64[:50]}...")
        
        return True
    
    except User.DoesNotExist:
        print(f"❌ ERROR: User with ID {user_id} not found")
        return False
    except Exception as e:
        print(f"❌ ERROR saving key: {e}")
        return False


def generate_keys_for_user(user_id):
    """
    Generiert Keys für einen spezifischen User
    """
    print(f"\n{'='*60}")
    print(f"Generating E2E keys for User ID: {user_id}")
    print(f"{'='*60}\n")
    
    # Generate keypair
    private_key, public_key = generate_rsa_keypair()
    
    # Export public key
    public_key_b64 = export_public_key_spki(public_key)
    
    # Save to database
    success = save_public_key_for_user(user_id, public_key_b64)
    
    if success:
        print(f"\n🎉 SUCCESS! E2E keys generated for User {user_id}")
        print(f"\n⚠️  IMPORTANT:")
        print(f"   - The PRIVATE key is NOT saved (it's client-side only)")
        print(f"   - This user can RECEIVE encrypted messages")
        print(f"   - But they CANNOT DECRYPT them without the private key")
        print(f"   - For full E2E: User must login via browser to generate keys")
        print(f"\n   This script is useful for:")
        print(f"   - Enabling OTHER users to send encrypted messages to this user")
        print(f"   - Testing E2E encryption with dummy accounts")
    
    return success


def generate_keys_for_all_users():
    """
    Generiert Keys für alle User ohne Public Key
    """
    print(f"\n{'='*60}")
    print(f"Generating E2E keys for all users without keys")
    print(f"{'='*60}\n")
    
    users_without_keys = User.objects.filter(
        profile__public_key__isnull=True
    ) | User.objects.filter(
        profile__public_key=''
    )
    
    count = users_without_keys.count()
    
    if count == 0:
        print("✅ All users already have public keys!")
        return
    
    print(f"Found {count} users without public keys:\n")
    
    success_count = 0
    for user in users_without_keys:
        print(f"Processing: {user.username} (ID: {user.id})")
        
        private_key, public_key = generate_rsa_keypair()
        public_key_b64 = export_public_key_spki(public_key)
        
        if save_public_key_for_user(user.id, public_key_b64):
            success_count += 1
        
        print()  # Empty line between users
    
    print(f"\n{'='*60}")
    print(f"✅ Generated keys for {success_count}/{count} users")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Generate E2E encryption keys for users'
    )
    
    parser.add_argument(
        '--user-id',
        type=int,
        help='Generate keys for specific user ID'
    )
    
    parser.add_argument(
        '--all',
        action='store_true',
        help='Generate keys for all users without keys'
    )
    
    args = parser.parse_args()
    
    if args.user_id:
        generate_keys_for_user(args.user_id)
    elif args.all:
        generate_keys_for_all_users()
    else:
        parser.print_help()
        print("\n❌ ERROR: Please specify --user-id or --all")
        sys.exit(1)


if __name__ == '__main__':
    main()
