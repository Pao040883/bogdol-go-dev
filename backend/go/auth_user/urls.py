from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserPhonebookView, RegisterView, CookieTokenObtainPairView, LogoutView,
    CookieTokenRefreshView, PasswordResetRequestView, PasswordResetConfirmView,
    UserAdminListCreateView, UserAdminDetailView, UserPermissionMatrixView, current_user_view, user_features_view, debug_cookies_view,
    PermissionCheckView, HRAssignmentViewSet, FakturaAssignmentViewSet
)
from .profile_views import (
    CompanyViewSet, DepartmentViewSet, TeamViewSet, 
    DepartmentRoleViewSet, DepartmentMemberViewSet,
    UserProfileViewSet, UserPresenceViewSet,
    ChatConversationViewSet, ChatMessageViewSet
)
from .specialty_views import (
    SpecialtyViewSet, MemberSpecialtyViewSet,
    WorkorderAssignmentViewSet, SubstituteAssignmentViewSet
)
from .permission_views import (
    PermissionCodeViewSet, PermissionMappingViewSet
)
from .autocomplete_views import query_autocomplete, related_queries
from .analytics_views import (
    search_analytics_overview, search_click_analytics,
    search_quality_metrics, synonym_management, query_history,
    profile_mapping_management, track_search_click
)

# REST API Router für neue Endpoints
router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'org-roles', DepartmentRoleViewSet, basename='org-role')
router.register(r'org-members', DepartmentMemberViewSet, basename='org-member')
router.register(r'profiles', UserProfileViewSet, basename='profile')
router.register(r'presence', UserPresenceViewSet, basename='presence')
router.register(r'chats', ChatConversationViewSet, basename='chat')
router.register(r'messages', ChatMessageViewSet, basename='message')

# Specialty & Organization Router
router.register(r'specialties', SpecialtyViewSet, basename='specialty')
router.register(r'member-specialties', MemberSpecialtyViewSet, basename='member-specialty')
router.register(r'workorder-assignments', WorkorderAssignmentViewSet, basename='workorder-assignment')
router.register(r'substitute-assignments', SubstituteAssignmentViewSet, basename='substitute-assignment')

# Permission System Router
router.register(r'permission-codes', PermissionCodeViewSet, basename='permission-code')
router.register(r'permission-mappings', PermissionMappingViewSet, basename='permission-mapping')

# HR Assignment Router
router.register(r'hr-assignments', HRAssignmentViewSet, basename='hr-assignment')

# Faktura Assignment Router
router.register(r'faktura/assignments', FakturaAssignmentViewSet, basename='faktura-assignment')

urlpatterns = [
    # Auth & Legacy Endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='token_logout'),
    path('auth/reset-password/', PasswordResetRequestView.as_view(), name='reset-password'),
    path('auth/reset-password-confirm/', PasswordResetConfirmView.as_view(), name='reset-password-confirm'),
    
    # Admin Endpoints
    path('admin/users/', UserAdminListCreateView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', UserAdminDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/permission_matrix/', UserPermissionMatrixView.as_view(), name='admin-user-permission-matrix'),
    
    # Permission Check Endpoint
    path('permissions/check/', PermissionCheckView.as_view(), name='permission-check'),
    
    # Search Auto-Complete & Related Queries
    path('search/autocomplete/', query_autocomplete, name='search-autocomplete'),
    path('search/related/', related_queries, name='search-related'),
    path('search/track-click/', track_search_click, name='search-track-click'),
    
    # Admin: Search Analytics
    path('admin/search-analytics/overview/', search_analytics_overview, name='search-analytics-overview'),
    path('admin/search-analytics/clicks/', search_click_analytics, name='search-analytics-clicks'),
    path('admin/search-analytics/quality/', search_quality_metrics, name='search-analytics-quality'),
    path('admin/search-analytics/history/', query_history, name='search-query-history'),
    path('admin/synonyms/', synonym_management, name='synonym-management'),
    path('admin/profile-mappings/', profile_mapping_management, name='profile-mapping-management'),
    
    # Legacy Endpoints
    path('phonebook/', UserPhonebookView.as_view(), name='user-phonebook'),
    path('users/current/', current_user_view, name='current-user'),
    path('users/features/', user_features_view, name='user-features'),
    path('debug/cookies/', debug_cookies_view, name='debug-cookies'),
    
    # REST API Endpoints (Router-generiert)
    path('', include(router.urls)),
]