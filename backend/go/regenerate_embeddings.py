"""
Regenerate all embeddings with new keywords
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_user.embedding_tasks import regenerate_all_embeddings_task

print("🔄 Regenerating all user embeddings...")
result = regenerate_all_embeddings_task.delay()
print(f"✅ Task started: {result.id}")
print("⏳ This will run in the background via Celery")
