# urls.py (innerhalb deiner App)
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SofortmeldungViewSet

router = DefaultRouter()
router.register(r'sofortmeldungen', SofortmeldungViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
