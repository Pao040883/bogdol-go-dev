from .models import Absence, AbsenceType, AbsenceConflict
from .serializers import (
    AbsenceSerializer, AbsenceCreateSerializer, AbsenceApprovalSerializer, 
    AbsenceHRSerializer, AbsenceTypeSerializer, AbsenceConflictSerializer
)
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import JsonResponse
from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class AbsenceTypeViewSet(viewsets.ModelViewSet):
    """ViewSet für Abwesenheitstypen - voller CRUD-Zugriff für Admins"""
    queryset = AbsenceType.objects.filter(is_active=True)
    serializer_class = AbsenceTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """Nur Admins dürfen erstellen, aktualisieren oder löschen"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def perform_destroy(self, instance):
        """Soft Delete - setze is_active auf False"""
        instance.is_active = False
        instance.save()


class IsSupervisorPermission(permissions.BasePermission):
    """
    Permission für Vorgesetzte
    
    Prüft:
    1. UserProfile.direct_supervisor (Legacy)
    2. Department-Hierarchie (AL/BL für ihre Department-Mitglieder)
    3. Vertretungen bei Abwesenheit
    """
    def has_permission(self, request, view):
        user = request.user
        
        # Superuser/Staff haben immer Zugriff
        if user.is_superuser or user.is_staff:
            return True
        
        # Check 1: Hat User direkte Untergebene? (Legacy)
        if hasattr(user, 'direct_reports') and user.direct_reports.exists():
            return True
        
        # Check 2: Ist User AL oder BL in einem Department?
        from auth_user.models import DepartmentMember
        is_leader = DepartmentMember.objects.filter(
            user=user,
            role__code__in=['AL', 'BL', 'GF', 'GF_OPS'],
            is_active=True
        ).exists()
        
        return is_leader

    def has_object_permission(self, request, view, obj):
        """
        Prüft ob User die Abwesenheit von obj.user genehmigen darf
        
        Berechtigt sind:
        1. Direct Supervisor (UserProfile.direct_supervisor)
        2. AL/BL vom gleichen Department
        3. Vertretung bei aktiver Abwesenheit
        """
        user = request.user
        employee = obj.user  # Der Mitarbeiter der die Abwesenheit beantragt
        
        # Superuser/Staff haben immer Zugriff
        if user.is_superuser or user.is_staff:
            return True
        
        # Check 1: Direct Supervisor (Legacy)
        if hasattr(employee, 'profile') and employee.profile.direct_supervisor == user:
            return True
        
        # Check 2: Department-Hierarchie
        # Hole alle Departments des Mitarbeiters
        from auth_user.models import DepartmentMember
        
        employee_departments = DepartmentMember.objects.filter(
            user=employee,
            is_active=True
        ).values_list('department_id', flat=True)
        
        # Ist User AL/BL in einem dieser Departments?
        is_department_leader = DepartmentMember.objects.filter(
            user=user,
            department_id__in=employee_departments,
            role__code__in=['AL', 'BL', 'GF', 'GF_OPS'],
            role__hierarchy_level__lte=2,  # Level 1-2 = Führungskräfte
            is_active=True
        ).exists()
        
        if is_department_leader:
            return True
        
        # Check 3: Vertretung bei Abwesenheit
        # Wenn User als Vertretung für den Vorgesetzten eingetragen ist
        from django.utils import timezone
        today = timezone.now().date()
        
        # Finde Vorgesetzte des Mitarbeiters
        if hasattr(employee, 'profile') and employee.profile.direct_supervisor:
            supervisor = employee.profile.direct_supervisor
            
            # Ist User Vertretung für den Supervisor?
            from absences.models import Absence
            active_absence = Absence.objects.filter(
                user=supervisor,
                representative=user,
                start_date__lte=today,
                end_date__gte=today,
                status='approved'
            ).exists()
            
            if active_absence:
                return True
        
        return False


class IsHRPermission(permissions.BasePermission):
    """Permission für HR-Mitarbeiter"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or  # Superuser haben immer Zugriff
            request.user.is_staff or 
            request.user.groups.filter(name='HR').exists()
        )


class AbsenceViewSet(viewsets.ModelViewSet):
    """Erweiterte ViewSet für Abwesenheiten"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AbsenceCreateSerializer
        elif self.action in ['approve', 'reject']:
            return AbsenceApprovalSerializer
        elif self.action == 'hr_review':
            return AbsenceHRSerializer
        return AbsenceSerializer
    
    def get_queryset(self):
        from auth_user.scope_filters import ScopeQuerySetMixin
        
        user = self.request.user
        base_queryset = Absence.objects.select_related(
            'user', 'absence_type', 'approved_by', 'representative'
        ).all()
        
        # Prüfe ob ein Jahr-Parameter übergeben wurde und erstelle ggf. Feiertage
        year_param = self.request.query_params.get('year')
        if year_param:
            try:
                year = int(year_param)
                # Stelle sicher, dass Feiertage für dieses Jahr existieren
                self._ensure_holidays_for_year(user, year)
            except (ValueError, TypeError):
                pass
        
        # Wende Permission-Scope-Filter an
        return ScopeQuerySetMixin.filter_absences_by_scope(base_queryset, user)
    
    def _ensure_holidays_for_year(self, user, year):
        """Stellt sicher, dass Feiertage für ein bestimmtes Jahr existieren"""
        from .signals import create_holidays_for_user
        try:
            create_holidays_for_user(user, years=[year])
        except Exception as e:
            logger.warning(f"Could not create holidays for year {year}: {e}")
    
    def perform_create(self, serializer):
        absence = serializer.save(user=self.request.user)
        
        # Wenn keine Genehmigung erforderlich ist, direkt genehmigen
        if not absence.absence_type.requires_approval:
            absence.status = Absence.APPROVED
            absence.approved_by = self.request.user
            absence.save()
        
        # Überprüfe Konflikte
        self._check_conflicts(absence)
        
        # Sende Benachrichtigung an Vorgesetzten nur wenn Genehmigung erforderlich
        if absence.status == Absence.PENDING and hasattr(absence.user, 'supervisor') and absence.user.supervisor:
            self._send_approval_request_email(absence)
    
    def perform_update(self, serializer):
        """
        Update-Handler mit Change-Tracking
        - Erkennt Änderungen an genehmigten Abwesenheiten
        - Setzt Status zurück auf PENDING
        - Protokolliert Änderungen in change_history
        - Sendet Benachrichtigung via Chat
        """
        old_instance = self.get_object()
        old_status = old_instance.status
        
        # Felder die getrackt werden sollen
        tracked_fields = ['start_date', 'end_date', 'absence_type', 'reason']
        changes = {}
        
        # Änderungen erkennen
        for field in tracked_fields:
            old_val = getattr(old_instance, field)
            new_val = serializer.validated_data.get(field)
            
            # Bei ForeignKeys (wie absence_type) ID vergleichen
            if hasattr(old_val, 'id'):
                old_val_compare = old_val.id if old_val else None
                new_val_compare = new_val.id if new_val else None
            else:
                old_val_compare = old_val
                new_val_compare = new_val
            
            if new_val is not None and old_val_compare != new_val_compare:
                # Formatierte Darstellung für change_history
                if field == 'absence_type':
                    old_display = old_val.display_name if old_val else ''
                    new_display = new_val.display_name if new_val else ''
                elif field in ['start_date', 'end_date']:
                    old_display = old_val.isoformat() if old_val else ''
                    new_display = new_val.isoformat() if hasattr(new_val, 'isoformat') else str(new_val)
                else:
                    old_display = str(old_val) if old_val else ''
                    new_display = str(new_val) if new_val else ''
                
                changes[field] = {
                    'old': old_display,
                    'new': new_display
                }
        
        # Wenn genehmigte Abwesenheit geändert wird
        if changes and old_status == Absence.APPROVED:
            logger.info(f"Absence {old_instance.id}: Änderungen an genehmigter Abwesenheit erkannt: {changes}")
            
            # Status zurücksetzen
            serializer.validated_data['status'] = Absence.PENDING
            serializer.validated_data['approved_by'] = None
            serializer.validated_data['approval_comment'] = None
            
            # Change History Entry erstellen
            change_reason = self.request.data.get('change_reason', '')
            history_entry = {
                'timestamp': timezone.now().isoformat(),
                'user': self.request.user.get_full_name(),
                'user_id': self.request.user.id,
                'changes': changes,
                'reason': change_reason,
                'previous_status': old_status
            }
            
            # Zur change_history hinzufügen
            if not isinstance(old_instance.change_history, list):
                old_instance.change_history = []
            old_instance.change_history.append(history_entry)
            serializer.validated_data['change_history'] = old_instance.change_history
            
            logger.info(f"Absence {old_instance.id}: Status zurückgesetzt auf PENDING, Change History aktualisiert")
        
        # Speichern
        absence = serializer.save()
        
        # Chat-Benachrichtigung senden wenn Status zurückgesetzt wurde
        if changes and old_status == Absence.APPROVED and absence.conversation:
            try:
                from absences.chat_helpers import send_absence_change_notification
                send_absence_change_notification(
                    conversation=absence.conversation,
                    absence=absence,
                    changed_by=self.request.user,
                    changes=changes
                )
                logger.info(f"Absence {absence.id}: Änderungsbenachrichtigung via Chat gesendet")
            except Exception as e:
                logger.error(f"Fehler beim Senden der Änderungsbenachrichtigung: {str(e)}", exc_info=True)
    
    def _check_conflicts(self, absence):
        """Überprüft Abwesenheitskonflikte"""
        conflicts = []
        
        # Team-Überschneidungen prüfen
        overlapping_absences = Absence.objects.filter(
            user__in=absence.user.team.all() if hasattr(absence.user, 'team') else [],
            status__in=[Absence.APPROVED, Absence.PENDING],
            start_date__lte=absence.end_date,
            end_date__gte=absence.start_date
        ).exclude(id=absence.id)
        
        for overlap in overlapping_absences:
            conflict = AbsenceConflict.objects.create(
                absence=absence,
                conflict_type=AbsenceConflict.TEAM_OVERLAP,
                conflicting_absence=overlap,
                description=f"Überschneidung mit {overlap.user.get_full_name()} vom {overlap.start_date} bis {overlap.end_date}",
                severity='medium'
            )
            conflicts.append(conflict)
        
        # Vertretungskonflikt prüfen
        if absence.representative:
            rep_conflicts = Absence.objects.filter(
                user=absence.representative,
                status__in=[Absence.APPROVED, Absence.PENDING],
                start_date__lte=absence.end_date,
                end_date__gte=absence.start_date
            )
            
            for rep_conflict in rep_conflicts:
                conflict = AbsenceConflict.objects.create(
                    absence=absence,
                    conflict_type=AbsenceConflict.REPRESENTATIVE_CONFLICT,
                    conflicting_absence=rep_conflict,
                    description=f"Vertretung {absence.representative.get_full_name()} ist selbst abwesend",
                    severity='high'
                )
                conflicts.append(conflict)
        
        return conflicts
    
    def _send_approval_request_email(self, absence):
        """Sendet E-Mail-Benachrichtigung an Vorgesetzten"""
        supervisor = None
        if hasattr(absence.user, 'profile') and absence.user.profile.direct_supervisor:
            supervisor = absence.user.profile.direct_supervisor
        
        if supervisor and supervisor.email:
            try:
                send_mail(
                    subject=f"Neue Abwesenheitsanfrage: {absence.user.get_full_name()}",
                    message=f"""
Hallo {supervisor.get_full_name()},

{absence.user.get_full_name()} hat eine neue Abwesenheit beantragt:

Typ: {absence.absence_type.display_name}
Zeitraum: {absence.start_date} bis {absence.end_date}
Dauer: {absence.duration_days} Tag(e)
Grund: {absence.reason or '—'}

Bitte prüfen Sie die Anfrage in der Anwendung.

Mit freundlichen Grüßen
Das Abwesenheitssystem
                    """.strip(),
                    from_email=None,
                    recipient_list=[supervisor.email],
                    fail_silently=True
                )
            except Exception as e:
                logger.error(f"Fehler beim Senden der E-Mail: {e}")
    
    @action(detail=True, methods=['post'], permission_classes=[IsSupervisorPermission])
    def approve(self, request, pk=None):
        """Genehmigt eine Abwesenheit"""
        absence = self.get_object()
        
        if absence.status != Absence.PENDING:
            return Response(
                {'error': 'Nur ausstehende Abwesenheiten können genehmigt werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        comment = serializer.validated_data.get('comment', '')
        absence.approve(approved_by=request.user, comment=comment)
        
        # E-Mail an Mitarbeiter
        self._send_approval_notification(absence, approved=True)
        
        return Response(AbsenceSerializer(absence).data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsSupervisorPermission])
    def reject(self, request, pk=None):
        """Lehnt eine Abwesenheit ab"""
        absence = self.get_object()
        
        if absence.status != Absence.PENDING:
            return Response(
                {'error': 'Nur ausstehende Abwesenheiten können abgelehnt werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reason = serializer.validated_data.get('reason', '')
        if not reason:
            return Response(
                {'error': 'Eine Begründung für die Ablehnung ist erforderlich.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        absence.reject(rejected_by=request.user, reason=reason)
        
        # E-Mail an Mitarbeiter
        self._send_approval_notification(absence, approved=False)
        
        return Response(AbsenceSerializer(absence).data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsHRPermission])
    def hr_notify(self, request, pk=None):
        """HR-Benachrichtigung für genehmigte Abwesenheit"""
        absence = self.get_object()
        
        if absence.status != Absence.APPROVED:
            return Response(
                {'error': 'Nur genehmigte Abwesenheiten können an HR weitergeleitet werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = request.data.get('hr_comment', '')
        absence.notify_hr(comment=comment)
        
        return Response(AbsenceHRSerializer(absence).data)
    
    def _send_approval_notification(self, absence, approved):
        """Sendet Benachrichtigung über Genehmigung/Ablehnung"""
        if absence.user.email:
            status_text = "genehmigt" if approved else "abgelehnt"
            reason_text = absence.rejection_reason if not approved else absence.approval_comment
            
            try:
                send_mail(
                    subject=f"Abwesenheit {status_text}: {absence.absence_type.display_name}",
                    message=f"""
Hallo {absence.user.get_full_name()},

Ihre Abwesenheit wurde {status_text}:

Typ: {absence.absence_type.display_name}
Zeitraum: {absence.start_date} bis {absence.end_date}
Dauer: {absence.duration_days} Tag(e)

{f'Kommentar: {reason_text}' if reason_text else ''}

Mit freundlichen Grüßen
Das Abwesenheitssystem
                    """.strip(),
                    from_email=None,
                    recipient_list=[absence.user.email],
                    fail_silently=True
                )
            except Exception as e:
                logger.error(f"Fehler beim Senden der E-Mail: {e}")
    
    @action(detail=False, methods=['get'])
    def my_absences(self, request):
        """Eigene Abwesenheiten des Benutzers"""
        queryset = self.get_queryset().filter(
            user=request.user
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsSupervisorPermission])
    def pending_approvals(self, request):
        """Ausstehende Genehmigungen für Vorgesetzte"""
        # Get all UserProfiles where this user is direct_supervisor
        supervised_profiles = request.user.direct_reports.values_list('user_id', flat=True)
        queryset = self.get_queryset().filter(
            user_id__in=supervised_profiles,
            status=Absence.PENDING
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsHRPermission])
    def hr_review(self, request):
        """HR-Übersicht aller Abwesenheiten"""
        # HR sieht alle Abwesenheiten, nicht nur genehmigte
        queryset = self.get_queryset()
        serializer = AbsenceHRSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsHRPermission])
    def hr_process(self, request, pk=None):
        """Von HR als bearbeitet markieren"""
        absence = self.get_object()
        comment = request.data.get('comment', '')
        
        try:
            absence.process_by_hr(request.user, comment)
            serializer = self.get_serializer(absence)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def create_revision(self, request, pk=None):
        """Erstelle eine überarbeitete Version der Abwesenheit"""
        original_absence = self.get_object()
        
        # Nur der Antragsteller kann Revisionen erstellen
        if original_absence.user != request.user:
            raise PermissionDenied("Nur der Antragsteller kann Revisionen erstellen.")
        
        # Erstelle neue Abwesenheit basierend auf der ursprünglichen
        revision_data = request.data.copy()
        revision_data.update({
            'is_revision': True,
            'revision_of': original_absence.id,
            'revision_reason': request.data.get('revision_reason', '')
        })
        
        serializer = AbsenceCreateSerializer(data=revision_data, context={'request': request})
        if serializer.is_valid():
            revision = serializer.save(user=request.user)
            return Response(
                AbsenceSerializer(revision, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Kommentar zu einer Abwesenheit hinzufügen"""
        absence = self.get_object()
        
        # Berechtigung prüfen: Antragsteller, Vorgesetzter oder HR
        user = request.user
        is_supervisor = (
            hasattr(absence.user, 'profile') and 
            absence.user.profile.direct_supervisor and 
            absence.user.profile.direct_supervisor == user
        )
        can_comment = (
            absence.user == user or  # Antragsteller
            is_supervisor or  # Vorgesetzter
            user.is_superuser or user.is_staff or user.groups.filter(name='HR').exists()  # HR
        )
        
        if not can_comment:
            raise PermissionDenied("Keine Berechtigung für Kommentare zu dieser Abwesenheit.")
        
        from .models import AbsenceComment
        comment = AbsenceComment.objects.create(
            absence=absence,
            author=user,
            content=request.data.get('content', ''),
            comment_type=request.data.get('comment_type', 'user_comment'),
            is_internal=request.data.get('is_internal', False)
        )
        
        from .serializers import AbsenceCommentSerializer
        return Response(
            AbsenceCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Kommentare für eine Abwesenheit abrufen"""
        absence = self.get_object()
        comments = absence.comments.all()
        
        # Filter für interne Kommentare je nach Berechtigung
        if not (request.user.has_perm('absences.can_approve') or 
                request.user.has_perm('absences.view_internal_comments') or
                request.user == absence.user):
            comments = comments.filter(is_internal=False)
        
        from .serializers import AbsenceCommentSerializer
        return Response(
            AbsenceCommentSerializer(comments, many=True).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def my_vacation_summary(self, request):
        """Urlaubsübersicht für den aktuellen Benutzer"""
        user = request.user
        current_year = timezone.now().year
        profile = user.profile if hasattr(user, 'profile') else None
        
        vacation_entitlement = profile.vacation_entitlement if profile else 0
        carryover_vacation = profile.carryover_vacation if profile else 0
        vacation_year = profile.vacation_year if profile else current_year
        
        return Response({
            'vacation_entitlement': vacation_entitlement,
            'carryover_vacation': carryover_vacation,
            'vacation_year': vacation_year,
            'used_vacation_days': user.get_used_vacation_days(current_year),
            'remaining_vacation_days': user.get_remaining_vacation_days(current_year),
            'total_entitlement': vacation_entitlement + carryover_vacation
        })
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve_from_chat(self, request, pk=None):
        """
        Genehmigt eine Abwesenheit aus dem Chat heraus
        Body: {comment: optional}
        """
        absence = self.get_object()
        
        # Check permissions: Supervisor, HR, or Admin
        is_supervisor = (
            hasattr(absence.user, 'profile') and 
            absence.user.profile.direct_supervisor and 
            absence.user.profile.direct_supervisor == request.user
        )
        is_hr_or_admin = (
            request.user.is_superuser or 
            request.user.is_staff or 
            request.user.groups.filter(name='HR').exists()
        )
        
        if not (is_supervisor or is_hr_or_admin):
            raise PermissionDenied("Keine Berechtigung zur Genehmigung dieser Abwesenheit.")
        
        # Status-Validierung
        if absence.status not in [Absence.PENDING, Absence.REVISION_REQUESTED]:
            return Response(
                {'error': f'Nur ausstehende Abwesenheiten können genehmigt werden. Aktueller Status: {absence.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Berechtigung prüfen
        user = request.user
        is_supervisor = (
            hasattr(absence.user, 'userprofile') and 
            absence.user.userprofile.direct_supervisor and 
            absence.user.userprofile.direct_supervisor == user
        )
        is_hr_or_admin = user.is_superuser or user.is_staff or user.groups.filter(name='HR').exists()
        
        if not (is_supervisor or is_hr_or_admin):
            return Response(
                {'error': 'Keine Berechtigung zum Genehmigen dieser Abwesenheit.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        comment = request.data.get('comment', '')
        
        try:
            # Abwesenheit genehmigen
            absence.approve(approved_by=user, comment=comment)
            logger.info(f"Absence {absence.id} genehmigt von {user.username} via Chat")
            
            # Chat-Nachricht senden wenn Konversation existiert
            if absence.conversation:
                from absences.chat_helpers import send_absence_decision_message
                send_absence_decision_message(
                    conversation=absence.conversation,
                    absence=absence,
                    decision_maker=user,
                    approved=True,
                    rejection_reason=None
                )
            
            return Response(
                AbsenceSerializer(absence, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Fehler bei Genehmigung von Absence {absence.id}: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Fehler bei Genehmigung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject_from_chat(self, request, pk=None):
        """
        Lehnt eine Abwesenheit aus dem Chat ab
        Body: {rejection_reason: required, comment: optional}
        """
        absence = self.get_object()
        
        # Check permissions: Supervisor, HR, or Admin
        is_supervisor = (
            hasattr(absence.user, 'profile') and 
            absence.user.profile.direct_supervisor and 
            absence.user.profile.direct_supervisor == request.user
        )
        is_hr_or_admin = (
            request.user.is_superuser or 
            request.user.is_staff or 
            request.user.groups.filter(name='HR').exists()
        )
        
        if not (is_supervisor or is_hr_or_admin):
            raise PermissionDenied("Keine Berechtigung zur Ablehnung dieser Abwesenheit.")
        
        # Status-Validierung
        if absence.status not in [Absence.PENDING, Absence.REVISION_REQUESTED]:
            return Response(
                {'error': f'Nur ausstehende Abwesenheiten können abgelehnt werden. Aktueller Status: {absence.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Berechtigung prüfen
        user = request.user
        is_supervisor = (
            hasattr(absence.user, 'userprofile') and 
            absence.user.userprofile.direct_supervisor and 
            absence.user.userprofile.direct_supervisor == user
        )
        is_hr_or_admin = user.is_superuser or user.is_staff or user.groups.filter(name='HR').exists()
        
        if not (is_supervisor or is_hr_or_admin):
            return Response(
                {'error': 'Keine Berechtigung zum Ablehnen dieser Abwesenheit.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        rejection_reason = request.data.get('rejection_reason', '')
        if not rejection_reason:
            return Response(
                {'error': 'Eine Begründung für die Ablehnung ist erforderlich (rejection_reason).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Abwesenheit ablehnen
            absence.reject(rejected_by=user, reason=rejection_reason)
            logger.info(f"Absence {absence.id} abgelehnt von {user.username} via Chat: {rejection_reason}")
            
            # Chat-Nachricht senden wenn Konversation existiert
            if absence.conversation:
                from absences.chat_helpers import send_absence_decision_message
                send_absence_decision_message(
                    conversation=absence.conversation,
                    absence=absence,
                    decision_maker=user,
                    approved=False,
                    rejection_reason=rejection_reason
                )
            
            return Response(
                AbsenceSerializer(absence, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Fehler bei Ablehnung von Absence {absence.id}: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Fehler bei Ablehnung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Legacy Views für Rückwärtskompatibilität
class AbsenceListCreateView(generics.ListCreateAPIView):
    """Legacy View - Verwendet neue AbsenceViewSet"""
    serializer_class = AbsenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Absence.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AbsenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Legacy View - Verwendet neue AbsenceViewSet"""
    serializer_class = AbsenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Absence.objects.filter(user=self.request.user)


class AbsenceApprovalView(generics.UpdateAPIView):
    """Legacy View - Verwendet neue AbsenceViewSet"""
    queryset = Absence.objects.all()
    serializer_class = AbsenceApprovalSerializer
    permission_classes = [IsSupervisorPermission]

    def get_object(self):
        obj = super().get_object()
        is_supervisor = (
            hasattr(obj.user, 'profile') and 
            obj.user.profile.direct_supervisor and 
            obj.user.profile.direct_supervisor == self.request.user
        )
        if not is_supervisor:
            raise PermissionDenied("Nur für unterstellte Nutzer erlaubt.")
        return obj

    def perform_update(self, serializer):
        # Legacy Unterstützung - konvertiert alte approved Boolean zu neuem Status
        action = serializer.validated_data.get('action')
        if action == 'approve':
            absence = self.get_object()
            absence.approve(approved_by=self.request.user, comment=serializer.validated_data.get('comment'))
        elif action == 'reject':
            absence = self.get_object()
            absence.reject(rejected_by=self.request.user, reason=serializer.validated_data.get('reason'))
        else:
            # Normales Update
            absence = serializer.save()
            
            # Wenn der Abwesenheitstyp keine Genehmigung erfordert und Status noch pending ist
            if not absence.absence_type.requires_approval and absence.status == Absence.PENDING:
                absence.status = Absence.APPROVED
                absence.approved_by = self.request.user
                absence.save()


class PendingAbsenceApprovalsView(generics.ListAPIView):
    """Legacy View - Verwendet neue AbsenceViewSet"""
    serializer_class = AbsenceSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisorPermission]

    def get_queryset(self):
        # Get UserProfiles where current user is direct_supervisor
        supervised_profiles = self.request.user.direct_reports.values_list('user_id', flat=True)
        return Absence.objects.filter(
            user_id__in=supervised_profiles,
            status=Absence.PENDING
        )