# blink_integration/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('test/', views.test_endpoint, name='blink_test'),
    path('test-auth/', views.test_auth_endpoint, name='blink_test_auth'),
    path('check-config/', views.check_config_endpoint, name='blink_check_config'),
    path('evaluation/', views.run_blink_evaluation, name='blink_evaluation'),
]
