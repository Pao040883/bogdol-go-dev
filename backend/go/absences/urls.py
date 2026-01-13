from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AbsenceViewSet, AbsenceTypeViewSet,
    # Legacy Views für Rückwärtskompatibilität
    AbsenceListCreateView, AbsenceDetailView, AbsenceApprovalView, PendingAbsenceApprovalsView
)
from .holiday_views import PublicHolidaysView

# Neue REST API mit ViewSets
router = DefaultRouter()
router.register(r'absences', AbsenceViewSet, basename='absence')
router.register(r'absence-types', AbsenceTypeViewSet, basename='absencetype')

urlpatterns = [
    # Neue API-Endpoints
    path('api/', include(router.urls)),
    path('api/public-holidays/', PublicHolidaysView.as_view(), name='public-holidays'),
    
    # Legacy Endpoints für Rückwärtskompatibilität
    path('', AbsenceListCreateView.as_view(), name='absence-list-create'),
    path('<int:pk>/', AbsenceDetailView.as_view(), name='absence-detail'),
    path('<int:pk>/approve/', AbsenceApprovalView.as_view(), name='absence-approve'),
    path('pending-approvals/', PendingAbsenceApprovalsView.as_view(), name='pending-approvals'),
]
