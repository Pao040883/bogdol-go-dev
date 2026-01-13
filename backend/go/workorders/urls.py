from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'clients', views.ClientViewSet, basename='client')
router.register(r'objects', views.WorkObjectViewSet, basename='workobject')
router.register(r'templates', views.WorkOrderTemplateViewSet, basename='template')
router.register(r'orders', views.WorkOrderViewSet, basename='workorder')
router.register(r'checklist', views.RecurringWorkOrderChecklistViewSet, basename='checklist')
router.register(r'assignments', views.WorkorderAssignmentViewSet, basename='workorder-assignment')

urlpatterns = [
    path('', include(router.urls)),
]
