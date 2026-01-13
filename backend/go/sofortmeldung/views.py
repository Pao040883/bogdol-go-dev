# views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
import logging

from .models import Sofortmeldung
from .serializers import SofortmeldungSerializer
from .tasks import process_sofortmeldung, check_sofortmeldung_status

logger = logging.getLogger(__name__)

class SofortmeldungViewSet(viewsets.ModelViewSet):
    queryset = Sofortmeldung.objects.none()  # Für Router-Registrierung, wird von get_queryset() überschrieben
    serializer_class = SofortmeldungSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        from auth_user.scope_filters import ScopeQuerySetMixin
        
        base_queryset = Sofortmeldung.objects.select_related(
            'createdBy'
        ).all().order_by('-start_date')
        
        # Wende Permission-Scope-Filter an
        return ScopeQuerySetMixin.filter_sofortmeldungen_by_scope(
            base_queryset, 
            self.request.user
        )

    def perform_create(self, serializer):
        """Speichere neue Sofortmeldung mit dem aktuellen Benutzer"""
        serializer.save(createdBy=self.request.user)
        logger.info(f"Neue Sofortmeldung erstellt von {self.request.user.username}")

    @action(detail=True, methods=['post'])
    def resend(self, request, pk=None):
        """
        Sendet eine Sofortmeldung erneut an die API
        
        POST /api/sofortmeldungen/{id}/resend/
        """
        sofortmeldung = get_object_or_404(Sofortmeldung, pk=pk)
        
        # Reset status and URLs
        sofortmeldung.status = False
        sofortmeldung.tan = ''
        sofortmeldung.url = ''
        sofortmeldung.save()
        
        # Task erneut einreihen
        process_sofortmeldung.delay(sofortmeldung.id)
        
        logger.info(f"Sofortmeldung {pk} zum erneuten Senden eingereiht")
        
        return Response({
            'message': 'Sofortmeldung wurde zum erneuten Senden eingereiht',
            'status': 'queued'
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def check_status(self, request, pk=None):
        """
        Prüft den aktuellen Status einer Sofortmeldung
        
        GET /api/sofortmeldungen/{id}/check_status/
        """
        sofortmeldung = get_object_or_404(Sofortmeldung, pk=pk)
        
        if not sofortmeldung.tan:
            return Response({
                'error': 'Keine TAN vorhanden. Sofortmeldung wurde noch nicht erfolgreich übermittelt.',
                'status': 'no_tan'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Status-Check Task starten
        task_result = check_sofortmeldung_status.delay(sofortmeldung.id)
        
        return Response({
            'message': 'Status-Überprüfung gestartet',
            'task_id': task_result.id,
            'tan': sofortmeldung.tan
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Zeigt Statistiken über Sofortmeldungen
        
        GET /api/sofortmeldungen/statistics/
        """
        total_count = Sofortmeldung.objects.count()
        successful_count = Sofortmeldung.objects.filter(status=True).count()
        pending_count = Sofortmeldung.objects.filter(status=False, tan__isnull=True).count()
        failed_count = Sofortmeldung.objects.filter(status=False, tan__isnull=False).count()
        
        return Response({
            'total': total_count,
            'successful': successful_count,
            'pending': pending_count,
            'failed': failed_count,
            'success_rate': round((successful_count / total_count * 100) if total_count > 0 else 0, 2)
        })

    @action(detail=False, methods=['post'])
    def bulk_resend(self, request):
        """
        Sendet alle fehlgeschlagenen Sofortmeldungen erneut
        
        POST /api/sofortmeldungen/bulk_resend/
        """
        failed_meldungen = Sofortmeldung.objects.filter(status=False)
        
        count = 0
        for meldung in failed_meldungen:
            # Reset status
            meldung.status = False
            meldung.tan = ''
            meldung.url = ''
            meldung.save()
            
            # Task einreihen
            process_sofortmeldung.delay(meldung.id)
            count += 1
        
        logger.info(f"{count} fehlgeschlagene Sofortmeldungen zum erneuten Senden eingereiht")
        
        return Response({
            'message': f'{count} Sofortmeldungen zum erneuten Senden eingereiht',
            'count': count
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def request_cancellation(self, request, pk=None):
        """
        Stornierungsanfrage für eine Sofortmeldung
        
        POST /api/sofortmeldungen/{id}/request_cancellation/
        Body: { "cancellation_reason": "Grund..." }
        
        Berechtigung:
        - Ersteller (createdBy)
        - HR-Mitarbeiter
        - Zugewiesener HR-MA (assigned_hr)
        """
        from .models import SofortmeldungStatus
        from django.utils import timezone
        
        sofortmeldung = get_object_or_404(Sofortmeldung, pk=pk)
        
        # Permission Check
        is_creator = sofortmeldung.createdBy == request.user
        is_hr = request.user.groups.filter(name='HR').exists() or request.user.is_staff
        is_assigned_hr = sofortmeldung.assigned_hr == request.user
        
        if not (is_creator or is_hr or is_assigned_hr):
            return Response(
                {'error': 'Keine Berechtigung für Stornierungsanfrage'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check: Bereits storniert oder Anfrage gestellt?
        if sofortmeldung.status_detail == SofortmeldungStatus.STORNIERT:
            return Response(
                {'error': 'Sofortmeldung ist bereits storniert'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if sofortmeldung.cancellation_requested:
            return Response(
                {'error': 'Stornierungsanfrage wurde bereits gestellt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check: Wurde überhaupt schon gesendet?
        if sofortmeldung.status_detail == SofortmeldungStatus.IN_BEARBEITUNG:
            return Response(
                {'error': 'Sofortmeldung wurde noch nicht gesendet - kann direkt gelöscht werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Stornierungsgrund
        cancellation_reason = request.data.get('cancellation_reason', '')
        if not cancellation_reason:
            return Response(
                {'error': 'Stornierungsgrund ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Stornierungsanfrage setzen
        sofortmeldung.cancellation_requested = True
        sofortmeldung.cancellation_requested_at = timezone.now()
        sofortmeldung.cancellation_requested_by = request.user
        sofortmeldung.cancellation_reason = cancellation_reason
        sofortmeldung.status_detail = SofortmeldungStatus.STORNIERUNG_ANGEFRAGT
        sofortmeldung.save()
        
        logger.info(
            f"Stornierungsanfrage für Sofortmeldung {pk} von {request.user.username}: {cancellation_reason}"
        )
        
        # TODO: E-Mail an HR oder zuständigen HR-MA senden
        # TODO: Notification erstellen
        
        return Response({
            'message': 'Stornierungsanfrage erfolgreich gestellt',
            'status_detail': sofortmeldung.status_detail,
            'cancellation_requested_at': sofortmeldung.cancellation_requested_at
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def approve_cancellation(self, request, pk=None):
        """
        Genehmigt eine Stornierungsanfrage (nur HR/Admin)
        
        POST /api/sofortmeldungen/{id}/approve_cancellation/
        
        Hinweis: Tatsächliche Stornierung bei DEÜV muss manuell erfolgen!
        """
        from .models import SofortmeldungStatus
        
        sofortmeldung = get_object_or_404(Sofortmeldung, pk=pk)
        
        if not sofortmeldung.cancellation_requested:
            return Response(
                {'error': 'Keine Stornierungsanfrage vorhanden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Status auf STORNIERT setzen
        sofortmeldung.status_detail = SofortmeldungStatus.STORNIERT
        sofortmeldung.status = False  # Legacy
        sofortmeldung.save()
        
        logger.info(
            f"Stornierung genehmigt für Sofortmeldung {pk} durch {request.user.username}"
        )
        
        return Response({
            'message': 'Stornierung genehmigt',
            'status_detail': sofortmeldung.status_detail,
            'info': 'Bitte Stornierung manuell bei DEÜV durchführen!'
        }, status=status.HTTP_200_OK)
