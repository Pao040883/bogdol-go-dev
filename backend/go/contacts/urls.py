from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContactProfileViewSet

router = DefaultRouter()
router.register(r'contacts', ContactProfileViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
]
