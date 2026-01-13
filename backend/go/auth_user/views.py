from django.conf import settings
from django.db import models
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, UserAdminSerializer, UserPhonebookSerializer
from .hr_assignment_serializer import HRAssignmentSerializer
from .faktura_assignment_serializer import FakturaAssignmentSerializer
from .user_features_serializer import UserFeaturesSerializer
from .models import CustomUser
from rest_framework import generics, permissions
from .permissions import PermissionService
from .permissions_classes import IsHRPermission
from .profile_models import HRAssignment, FakturaAssignment
User = get_user_model()

COOKIE_NAME = 'refresh_token'

class CookieTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    """
    Bei erfolgreichem Login: setzt den Refresh-Token als HTTP-only Cookie
    und gibt den Access-Token im JSON-Body zurück.
    """
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except (AuthenticationFailed, TokenError):
            return Response(
                {"message": "Benutzername oder Passwort ist ungültig."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        data = serializer.validated_data

        # User-Daten mit UserAdminSerializer hinzufügen
        user_serializer = UserAdminSerializer(serializer.user)
        
        response = Response({
            'access': data.get('access'),
            'user': user_serializer.data
        }, status=status.HTTP_200_OK)

        # Debug: Cookie wird gesetzt
        print(f"🍪 DEBUG: Setting refresh token cookie")
        
        response.set_cookie(
            key=COOKIE_NAME,
            value=data.get('refresh'),
            httponly=True,
            secure=False,  # False für Development über HTTP
            # samesite='Lax',  # Temporarily commented out for debugging
            max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
            path='/',
            domain=None,  # Keine Domain-Restriction für localhost
        )

        return response

class CookieTokenRefreshView(TokenRefreshView):
    """
    Holt den Refresh-Token ganz automatisch aus dem HTTP-only Cookie.
    Antwort wie oben: neuer Access-Token im Body, rotierten Refresh-Token im Cookie.
    """
    def get_token_from_cookie(self, request):
        return request.COOKIES.get(COOKIE_NAME)

    def post(self, request, *args, **kwargs):
        # token aus Cookie injizieren
        refresh = self.get_token_from_cookie(request)
        
        if not refresh:
            print(f"❌ ERROR: No refresh token in cookie!")
            return Response({'detail': 'Refresh token fehlt im Cookie.'}, status=401)
        
        request.data['refresh'] = refresh
        
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as e:
            print(f"❌ ERROR: Token refresh failed with exception: {type(e).__name__}: {str(e)}")
            # Check if token is blacklisted or invalid
            from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
            if isinstance(e, (TokenError, InvalidToken)):
                print(f"⚠️ Token is invalid/blacklisted - this could be due to token rotation race condition")
            raise
        
        if response.status_code == 200:
            new_refresh = response.data.get('refresh')
            response.set_cookie(
                key=COOKIE_NAME,
                value=new_refresh,
                httponly=True,
                secure=False,  # False für Development über HTTP
                # samesite='Lax',  # Temporarily commented out for debugging
                max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                path='/',
                domain=None,  # Keine Domain-Restriction für localhost
            )
            response.data.pop('refresh', None)
            
            # User-Daten hinzufügen
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from django.contrib.auth import get_user_model
                
                User = get_user_model()
                token = UntypedToken(refresh)
                user_id = token.get('user_id')
                user = User.objects.get(id=user_id)
                
                user_serializer = UserAdminSerializer(user)
                response.data['user'] = user_serializer.data
            except Exception as e:
                # Falls User-Daten nicht geladen werden können, trotzdem Token zurückgeben
                print(f"Warning: Could not load user data in token refresh: {e}")
        else:
            print(f"❌ Token refresh failed: {response.status_code} - {response.data}")
                
        return response
                
        return response


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    # Jeder darf hier POSTen, wir validieren selbst den Cookie
    permission_classes = [AllowAny]
    authentication_classes = []   # keine Header-Auth

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(COOKIE_NAME)
        if refresh:
            try:
                token = RefreshToken(refresh)
                token.blacklist()
            except Exception:
                # Token war schon ungültig/abgelaufen; ignoriere
                pass

        # Cookie löschen, Pfad/Domain ggf. anpassen
        response = Response(status=204)
        response.delete_cookie(
            key=COOKIE_NAME,
            path='/',
            domain=None,  # Keine Domain-Restriction für localhost
        )
        return response


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'E-Mail ist erforderlich.'}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': 'Falls der Nutzer existiert, wurde eine E-Mail versendet.'})

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        reset_link = f"http://localhost:8100/set-password/{uid}/{token}"

        send_mail(
            subject="Passwort zurücksetzen",
            message=f"Klicke auf den folgenden Link, um dein Passwort zurückzusetzen:\n\n{reset_link}",
            from_email=None,
            recipient_list=[user.email],
        )

        return Response({'message': 'Passwort-Reset-Link gesendet.'})



class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        password1 = request.data.get('new_password1')
        password2 = request.data.get('new_password2')

        if not all([uidb64, token, password1, password2]):
            return Response({'error': 'Alle Felder sind erforderlich.'}, status=400)

        if password1 != password2:
            return Response({'error': 'Die Passwörter stimmen nicht überein.'}, status=400)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Ungültiger Benutzer.'}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Ungültiger oder abgelaufener Token.'}, status=400)

        user.set_password(password1)
        user.save()

        return Response({'message': 'Passwort erfolgreich zurückgesetzt.'})

class RegisterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Benutzer erfolgreich registriert.'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_superuser


class UserAdminListCreateView(generics.ListCreateAPIView):
    queryset = CustomUser.objects.select_related('profile').prefetch_related('profile__companies')
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]


class UserAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CustomUser.objects.select_related('profile').prefetch_related('profile__companies')
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]


class UserPermissionMatrixView(APIView):
    """
    GET /api/auth/admin/users/{id}/permission_matrix/
    Returns comprehensive permission matrix for user based on PermissionService
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]
    
    def get(self, request, pk):
        from django.contrib.auth.models import Group
        from guardian.shortcuts import get_objects_for_user
        from guardian.models import UserObjectPermission
        from .profile_models import Department, DepartmentRole, HRAssignment, WorkorderAssignment
        from .permission_service import PermissionService
        from .permission_models import PermissionCode
        from .permission_serializers import UserPermissionMatrixSerializer
        import traceback
        
        try:
            user = CustomUser.objects.get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            # Initialize PermissionService
            perm_service = PermissionService.for_user(user)
        
            # === USER BASIC INFO ===
            user_info = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_superuser': user.is_superuser,
                'is_staff': user.is_staff,
                'is_active': user.is_active
            }
        
            # === HAS FULL ACCESS ===
            has_full_access = perm_service.has_full_access()
        
            # === PERMISSION MAPPINGS (DETAILED) ===
            permissions_with_sources = perm_service.get_permissions_with_sources()
            permission_mappings = []
        
            for perm_code, sources in permissions_with_sources.items():
                try:
                    perm_obj = PermissionCode.objects.get(code=perm_code, is_active=True)
                
                    for source in sources:
                        permission_mappings.append({
                            'permission': {
                                'id': perm_obj.id,
                                'code': perm_obj.code,
                                'name': perm_obj.name,
                                'category': perm_obj.category,
                                'supports_scope': perm_obj.supports_scope,
                                'default_scope': perm_obj.default_scope,
                                'is_active': perm_obj.is_active
                            },
                            'source_type': source['type'],
                            'source': {
                                'id': source['id'],
                                'name': source['name'],
                                'code': source.get('code'),
                                'display': f"{source['type']}: {source['name']}"
                            },
                            'scope': source['scope'],
                            'is_effective': True,
                            'mapping_id': source['mapping_id']
                        })
                except PermissionCode.DoesNotExist:
                    continue
        
            # === EFFECTIVE PERMISSIONS (AGGREGATED) ===
            effective_permissions = []
            all_permissions = list(perm_service.get_all_permissions(use_cache=False))
        
            for perm_code in all_permissions:
                try:
                    perm_obj = PermissionCode.objects.get(code=perm_code, is_active=True)
                    scope = perm_service.get_permission_scope(perm_code)
                
                    # Collect all sources
                    sources = []
                    if perm_code in permissions_with_sources:
                        sources = [
                            f"{s['type']}:{s['name']}" 
                            for s in permissions_with_sources[perm_code]
                        ]
                
                    effective_permissions.append({
                        'code': perm_obj.code,
                        'name': perm_obj.name,
                        'category': perm_obj.category,
                        'scope': scope,
                        'sources': sources,
                        'supports_scope': perm_obj.supports_scope
                    })
                except PermissionCode.DoesNotExist:
                    continue
        
            # === ENTITY-ZUORDNUNGEN MIT PERMISSIONS ===
            mappings_by_entity = perm_service.get_mappings_for_user()
        
            # Convert objects to dictionaries
            departments_data = []
            for dept_data in mappings_by_entity['departments']:
                dept = dept_data['department_obj']
                role = dept_data['role_obj']
                departments_data.append({
                    'department': {
                        'id': dept.id,
                        'name': dept.name,
                        'code': dept.code
                    },
                    'role': {
                        'id': role.id,
                        'name': role.name,
                        'code': role.code
                    } if role else None,
                    'is_primary': dept_data['is_primary'],
                    'permissions_from_department': dept_data['permissions_from_department'],
                    'permissions_from_role': dept_data['permissions_from_role']
                })
        
            specialties_data = []
            for spec_data in mappings_by_entity['specialties']:
                spec = spec_data['specialty_obj']
                specialties_data.append({
                    'specialty': {
                        'id': spec.id,
                        'name': spec.name,
                        'code': spec.code
                    },
                    'is_primary': spec_data['is_primary'],
                    'proficiency_level': spec_data['proficiency_level'],
                    'permissions_from_specialty': spec_data['permissions_from_specialty']
                })
        
            groups_data = []
            for group_data in mappings_by_entity['groups']:
                group = group_data['group_obj']
                groups_data.append({
                    'group': {
                        'id': group.id,
                        'name': group.name
                    },
                    'permissions_from_group': group_data['permissions_from_group']
                })
        
            # === SUMMARY ===
            summary = perm_service.get_detailed_summary()
        
            # === LEGACY DATA (OPTIONAL) ===
            # HR Assignments (alte Struktur)
            hr_assignments = []
            for assignment in HRAssignment.objects.filter(hr_processor=user, is_active=True).select_related('employee', 'department'):
                hr_assignments.append({
                    'id': assignment.id,
                    'employee': {
                        'id': assignment.employee.id,
                        'username': assignment.employee.username,
                        'name': assignment.employee.get_full_name()
                    },
                    'department': {
                        'id': assignment.department.id,
                        'name': assignment.department.name,
                        'code': assignment.department.code
                    } if assignment.department else None,
                    'valid_from': assignment.valid_from,
                    'valid_until': assignment.valid_until
                })
        
            # Workorder Assignments (alte Struktur)
            workorder_assignments = []
            for assignment in WorkorderAssignment.objects.filter(processor=user, is_active=True).select_related('submitter', 'specialty'):
                workorder_assignments.append({
                    'id': assignment.id,
                    'submitter': {
                        'id': assignment.submitter.id,
                        'username': assignment.submitter.username,
                        'name': assignment.submitter.get_full_name()
                    },
                    'specialty': {
                        'id': assignment.specialty.id,
                        'name': assignment.specialty.name,
                        'code': assignment.specialty.code
                    },
                    'is_auto_assigned': assignment.is_auto_assigned,
                    'valid_from': assignment.valid_from,
                    'valid_until': assignment.valid_until
                })
        
            # Guardian Object Permissions
            object_permissions = []
            user_obj_perms = UserObjectPermission.objects.filter(user=user).select_related('content_type')
        
            # Deduplicate by (content_type, object_pk)
            seen_objects = set()
            for perm in user_obj_perms:
                content_type = perm.content_type
                obj_key = (content_type.id, perm.object_pk)
            
                if obj_key in seen_objects:
                    continue
                seen_objects.add(obj_key)
            
                obj = content_type.get_object_for_this_type(pk=perm.object_pk)
            
                # Get all permissions for this object
                perms_list = UserObjectPermission.objects.filter(
                    user=user,
                    content_type=content_type,
                    object_pk=perm.object_pk
                ).values_list('permission__codename', flat=True)
            
                object_permissions.append({
                    'model': f'{content_type.app_label}.{content_type.model}',
                    'object_id': perm.object_pk,
                    'object_repr': str(obj),
                    'permissions': list(perms_list)
                })
        
            # === RESPONSE DATA ===
            response_data = {
                'user': user_info,
                'has_full_access': has_full_access,
                'permission_mappings': permission_mappings,
                'effective_permissions': sorted(effective_permissions, key=lambda x: (x['category'], x['name'])),
                'departments': departments_data,
                'specialties': specialties_data,
                'groups': groups_data,
                'summary': summary,
                'legacy': {
                    'hr_assignments': hr_assignments,
                    'workorder_assignments': workorder_assignments,
                    'object_permissions': object_permissions
                }
            }
        
            # Serialize and return
            serializer = UserPermissionMatrixSerializer(data=response_data)
            if serializer.is_valid():
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                # Fallback ohne Serializer-Validierung
                return Response(response_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            # Return detailed error for debugging
            return Response({
                'error': str(e),
                'traceback': traceback.format_exc(),
                'type': type(e).__name__
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserPhonebookView(generics.ListAPIView):
    serializer_class = UserPhonebookSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Nutzt die AI-Suche wenn query vorhanden, sonst alle User"""
        from .embedding_service import search_profiles_semantic
        
        query = self.request.query_params.get('query', '').strip()
        
        if query:
            # Nutze AI-Suche
            results = search_profiles_semantic(query, top_k=20, user=self.request.user)
            # Extrahiere User IDs in der richtigen Reihenfolge
            user_ids = [r['profile'].user.id for r in results]
            
            # Hole User in der richtigen Reihenfolge
            users = CustomUser.objects.filter(id__in=user_ids, is_active=True)
            # Sortiere nach der Reihenfolge aus der Suche
            user_dict = {u.id: u for u in users}
            return [user_dict[uid] for uid in user_ids if uid in user_dict]
        else:
            # Ohne query: alle aktiven User
            return CustomUser.objects.filter(is_active=True)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    """Gibt die aktuellen User-Daten zurück"""
    serializer = UserAdminSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_features_view(request):
    """
    Gibt Feature-Flags für den aktuellen User zurück
    Bestimmt, welche Dashboard-Kacheln/Features der User sehen darf
    """
    serializer = UserFeaturesSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([])  # Öffentlich für Debug
def debug_cookies_view(request):
    """Debug: Zeigt verfügbare Cookies"""
    cookies = request.COOKIES
    refresh_token = cookies.get(COOKIE_NAME)
    
    return Response({
        'cookies_present': list(cookies.keys()),
        'refresh_token_present': refresh_token is not None,
        'refresh_token_length': len(refresh_token) if refresh_token else 0,
        'user_agent': request.META.get('HTTP_USER_AGENT', 'Unknown'),
        'origin': request.META.get('HTTP_ORIGIN', 'Unknown'),
    })


class PermissionCheckView(APIView):
    """
    Endpoint zur Überprüfung von Berechtigungen für das Frontend
    
    GET /api/auth_user/permissions/check/?action=view_workorder&workorder_id=123
    GET /api/auth_user/permissions/check/?action=has_specialty&specialty_code=FIN-FAK
    GET /api/auth_user/permissions/check/?action=my_specialties
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        action = request.query_params.get('action')
        perms = PermissionService.for_user(request.user)
        
        if not action:
            return Response({'error': 'Parameter "action" erforderlich'}, status=400)
        
        # Vollzugriff prüfen
        if action == 'full_access':
            return Response({'has_access': perms.has_full_access()})
        
        # Fachbereich-Zugehörigkeit prüfen
        if action == 'has_specialty':
            specialty_code = request.query_params.get('specialty_code')
            if not specialty_code:
                return Response({'error': 'Parameter "specialty_code" erforderlich'}, status=400)
            return Response({'has_specialty': perms.has_specialty(specialty_code)})
        
        # Alle Fachbereiche des Users abrufen
        if action == 'my_specialties':
            department_id = request.query_params.get('department')
            active_only = request.query_params.get('active_only', 'true').lower() == 'true'
            
            specialties = perms.get_user_specialties(
                department=department_id,
                active_only=active_only
            )
            
            return Response({
                'specialties': [
                    {
                        'id': s.id,
                        'code': s.code,
                        'name': s.name,
                        'department': s.department.name
                    } for s in specialties
                ]
            })
        
        # Aktive Vertretungen abrufen
        if action == 'active_substitutions':
            from django.utils import timezone
            date_str = request.query_params.get('date')
            
            if date_str:
                from datetime import datetime
                date = datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                date = timezone.now().date()
            
            substitutions = perms.get_active_substitutions(date)
            
            return Response({
                'substitutions': [
                    {
                        'id': sub.id,
                        'original_user': sub.original_user.get_full_name(),
                        'substitute_user': sub.substitute_user.get_full_name(),
                        'specialties': [s.code for s in sub.specialties.all()],
                        'absence_start': sub.absence.start_date if sub.absence else None,
                        'absence_end': sub.absence.end_date if sub.absence else None,
                    } for sub in substitutions
                ]
            })
        
        # Arbeitsschein-Berechtigung prüfen
        if action in ['can_process_workorder', 'can_view_workorder', 'can_reassign_workorder']:
            workorder_id = request.query_params.get('workorder_id')
            if not workorder_id:
                return Response({'error': 'Parameter "workorder_id" erforderlich'}, status=400)
            
            try:
                from workorders.models import WorkOrder
                workorder = WorkOrder.objects.get(id=workorder_id)
            except WorkOrder.DoesNotExist:
                return Response({'error': 'Arbeitsschein nicht gefunden'}, status=404)
            
            if action == 'can_process_workorder':
                return Response({'can_process': perms.can_process_workorder(workorder)})
            elif action == 'can_view_workorder':
                return Response({'can_view': perms.can_view_workorder(workorder)})
            elif action == 'can_reassign_workorder':
                return Response({'can_reassign': perms.can_reassign_workorder(workorder)})
        
        # Abwesenheit-Berechtigung prüfen
        if action in ['can_approve_absence', 'can_view_absence']:
            absence_id = request.query_params.get('absence_id')
            if not absence_id:
                return Response({'error': 'Parameter "absence_id" erforderlich'}, status=400)
            
            try:
                from absences.models import Absence
                absence = Absence.objects.get(id=absence_id)
            except Absence.DoesNotExist:
                return Response({'error': 'Abwesenheit nicht gefunden'}, status=404)
            
            if action == 'can_approve_absence':
                return Response({'can_approve': perms.can_approve_absence(absence)})
            elif action == 'can_view_absence':
                return Response({'can_view': perms.can_view_absence(absence)})
        
        return Response({'error': f'Unbekannte Action: {action}'}, status=400)

class HRAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = HRAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsHRPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee__first_name', 'employee__last_name', 'hr_processor__first_name', 'hr_processor__last_name']
    filterset_fields = ['employee', 'hr_processor', 'department', 'is_active']
    ordering_fields = ['created_at', 'updated_at', 'valid_from']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.is_staff or user.groups.filter(name='HR').exists():
            return HRAssignment.objects.select_related('employee', 'hr_processor', 'department').all()
        return HRAssignment.objects.select_related('employee', 'hr_processor', 'department').filter(employee=user)
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        Get assignments where current user is the hr_processor
        GET /api/hr-assignments/my/
        """
        assignments = HRAssignment.objects.filter(
            hr_processor=request.user,
            is_active=True
        ).select_related('employee', 'hr_processor', 'department')
        
        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """
        Automatically set hr_processor to current user when creating
        """
        serializer.save(hr_processor=self.request.user)


class FakturaAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = FakturaAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee__first_name', 'employee__last_name', 'faktura_processor__first_name', 'faktura_processor__last_name']
    filterset_fields = ['employee', 'faktura_processor', 'department', 'is_active']
    ordering_fields = ['created_at', 'updated_at', 'valid_from']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        # Superuser/Staff can see all
        if user.is_superuser or user.is_staff:
            return FakturaAssignment.objects.select_related('employee', 'faktura_processor', 'department').all()
        # Faktura users can see assignments they're involved in
        if user.groups.filter(name='Faktura').exists():
            return FakturaAssignment.objects.select_related('employee', 'faktura_processor', 'department').filter(
                models.Q(employee=user) | models.Q(faktura_processor=user)
            )
        # Regular users can only see their own
        return FakturaAssignment.objects.select_related('employee', 'faktura_processor', 'department').filter(employee=user)
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        Get assignments where current user is the faktura_processor
        GET /api/faktura/assignments/my/
        """
        assignments = FakturaAssignment.objects.filter(
            faktura_processor=request.user,
            is_active=True
        ).select_related('employee', 'faktura_processor', 'department')
        
        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def employees(self, request):
        """
        Get all employees that can be assigned (for Faktura users)
        GET /api/faktura/assignments/employees/
        
        Zeigt:
        - Alle zuweisbaren Mitarbeiter (can_receive_faktura_assignments=True)
        - Bereits zugewiesene Mitarbeiter mit ihrem faktura_processor
        - Flag ob eigene Zuweisung oder von anderem Faktura-Prozessor
        
        Berechtigung: can_assign_workorders
        """
        # Permission-Check
        from .permission_service import PermissionService
        perm_service = PermissionService.for_user(request.user)
        
        if not perm_service.has_permission('can_assign_workorders'):
            return Response({
                'detail': 'Fehlende Berechtigung: can_assign_workorders'
            }, status=403)
        
        from .profile_models import DepartmentMember
        
        # Finde alle User mit department_memberships, die eine Rolle haben mit can_receive_faktura_assignments=True
        assignable_user_ids = DepartmentMember.objects.filter(
            is_active=True,
            role__can_receive_faktura_assignments=True,
            role__is_active=True
        ).values_list('user_id', flat=True).distinct()
        
        # Hole diese User (außer den eigenen)
        users = CustomUser.objects.filter(
            id__in=assignable_user_ids,
            is_active=True
        ).exclude(
            id=request.user.id
        ).select_related('profile').prefetch_related(
            'department_memberships__department',
            'department_memberships__role'
        )
        
        # Hole ALLE aktiven Zuweisungen für diese User
        all_assignments = FakturaAssignment.objects.filter(
            employee_id__in=[u.id for u in users],
            is_active=True
        ).select_related('faktura_processor')
        
        # Mapping: employee_id -> assignment info
        assignment_map = {}
        for assignment in all_assignments:
            assignment_map[assignment.employee_id] = {
                'assignment_id': assignment.id,
                'faktura_processor_id': assignment.faktura_processor_id,
                'faktura_processor_name': assignment.faktura_processor.get_full_name() or assignment.faktura_processor.username,
                'is_my_assignment': assignment.faktura_processor_id == request.user.id,
                'created_at': assignment.created_at
            }
        
        # Simplified response
        data = []
        for user in users:
            departments = []
            roles = []
            if hasattr(user, 'department_memberships'):
                for m in user.department_memberships.filter(is_active=True).select_related('department', 'role'):
                    departments.append({
                        'id': m.department.id,
                        'name': m.department.name
                    })
                    if m.role and m.role.can_receive_faktura_assignments:
                        roles.append({
                            'id': m.role.id,
                            'name': m.role.name
                        })
            
            employee_data = {
                'id': user.id,
                'username': user.username,
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'department': departments[0] if departments else None,
                'roles': roles
            }
            
            # Füge Zuweisungs-Info hinzu falls vorhanden
            if user.id in assignment_map:
                employee_data['assignment'] = assignment_map[user.id]
            
            data.append(employee_data)
        
        return Response(data)
    
    def perform_create(self, serializer):
        """
        Automatically set faktura_processor to current user when creating
        """
        serializer.save(faktura_processor=self.request.user)

