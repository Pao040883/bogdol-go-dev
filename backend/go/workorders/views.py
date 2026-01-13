from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from django_filters import CharFilter, MultipleChoiceFilter
from django.utils import timezone
import hashlib
import re

from .models import (
    WorkOrderClient, WorkObject, WorkOrder, WorkOrderTemplate,
    RecurringWorkOrderChecklist
)
from .history_models import WorkOrderHistory
from .serializers import (
    ClientSerializer, WorkObjectSerializer, 
    WorkOrderSerializer, WorkOrderSignatureSerializer,
    WorkOrderTemplateSerializer, CreateFromTemplateSerializer,
    WorkOrderHistorySerializer, RecurringWorkOrderChecklistSerializer,
    WorkorderAssignmentSerializer
)
from .permissions import CanManageWorkorderAssignments
from auth_user.profile_models import WorkorderAssignment


class WorkOrderFilter(FilterSet):
    """Custom FilterSet für WorkOrders mit Multi-Status Support"""
    status = CharFilter(method='filter_status')
    
    class Meta:
        model = WorkOrder
        fields = ['client', 'work_object', 'assigned_to']
    
    def filter_status(self, queryset, name, value):
        """
        Unterstützt komma-separierte Status-Werte:
        ?status=billed oder ?status=billed,cancelled
        """
        if not value:
            return queryset
        
        statuses = [s.strip() for s in value.split(',')]
        return queryset.filter(status__in=statuses)


class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet für Kunden"""
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'city', 'email']
    filterset_fields = ['is_active']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        return WorkOrderClient.objects.all()


class WorkObjectViewSet(viewsets.ModelViewSet):
    """ViewSet für Objekte"""
    serializer_class = WorkObjectSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'client__name', 'city', 'contact_person']
    filterset_fields = ['client', 'is_active']
    ordering_fields = ['name', 'created_at']
    ordering = ['client__name', 'name']
    
    def get_queryset(self):
        return WorkObject.objects.select_related('client').all()
    
    @action(detail=False, methods=['get'])
    def by_client(self, request):
        """Get all objects for a specific client"""
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response(
                {'error': 'client_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        objects = self.get_queryset().filter(client_id=client_id, is_active=True)
        serializer = self.get_serializer(objects, many=True)
        return Response(serializer.data)


class WorkOrderTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet für Arbeitsschein-Vorlagen"""
    serializer_class = WorkOrderTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'client__name', 'work_type']
    filterset_fields = ['client', 'work_object', 'is_active']
    ordering_fields = ['name', 'created_at']
    ordering = ['client__name', 'name']
    
    def get_queryset(self):
        return WorkOrderTemplate.objects.select_related(
            'client', 'work_object'
        ).filter(is_active=True)
    
    @action(detail=True, methods=['post'])
    def create_work_order(self, request, pk=None):
        """Erstelle einen Arbeitsschein aus dieser Vorlage"""
        template = self.get_object()
        
        serializer = CreateFromTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Template is already validated in serializer
        validated_template = serializer.validated_data['template_id']
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        project_number = serializer.validated_data.get('project_number', '')
        
        # Create work order from template
        work_order = validated_template.create_work_order(
            start_date=start_date,
            end_date=end_date,
            project_number=project_number
        )
        
        return Response({
            'message': 'Arbeitsschein erfolgreich erstellt',
            'work_order': WorkOrderSerializer(work_order).data
        }, status=status.HTTP_201_CREATED)


class WorkOrderViewSet(viewsets.ModelViewSet):
    """ViewSet für Arbeitsscheine mit Scope-basierter Filterung"""
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = WorkOrderFilter
    search_fields = ['order_number', 'project_number', 'client__name', 'work_type']
    ordering_fields = ['created_at', 'start_date', 'order_number']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """
        Filtert Workorders basierend auf Permission-Scope + Business-Logic
        
        - OWN: Eigene erstellte + zugewiesene (FakturAssignment)
        - DEPARTMENT: Abteilungs-Workorders + zugewiesene
        - ALL: Alle Workorders
        
        Toggle-Funktion: User mit can_toggle_all_workorders Permission
        können per show_all=true Parameter alle Workorders sehen (unabhängig von ihrem Scope)
        """
        from auth_user.scope_filters import ScopeQuerySetMixin
        from auth_user.permission_service import PermissionService
        
        user = self.request.user
        
        # Superuser/Staff sehen immer alles
        if user.is_superuser or user.is_staff:
            return WorkOrder.objects.select_related(
                'client', 'work_object', 'assigned_to', 'created_by'
            ).all()
        
        base_queryset = WorkOrder.objects.select_related(
            'client', 'work_object', 'assigned_to', 'created_by'
        ).all()
        
        # Check if user wants to see all items (via query parameter)
        show_all = self.request.query_params.get('show_all', 'false').lower() == 'true'
        
        # Wenn show_all=true und User hat Toggle-Permission → Alle anzeigen
        perm_service = PermissionService.for_user(user)
        if show_all and perm_service.has_permission('can_toggle_all_workorders'):
            return base_queryset
        
        # Ansonsten: Scope-basierte Filterung
        return ScopeQuerySetMixin.filter_workorders_by_scope(
            base_queryset,
            user
        )
    
    def destroy(self, request, *args, **kwargs):
        """DELETE ist deaktiviert - nutze stattdessen cancel"""
        return Response(
            {'error': 'Löschen nicht erlaubt. Bitte stornieren Sie den Arbeitsschein stattdessen.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        """Get work orders assigned to current user"""
        orders = self.get_queryset().filter(assigned_to=request.user)
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            orders = orders.filter(status=status_filter)
        
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Sign work order with customer signature"""
        work_order = self.get_object()
        
        serializer = WorkOrderSignatureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        signature_data = serializer.validated_data['signature_data']
        work_order.sign_by_customer(signature_data)
        
        return Response({
            'message': 'Arbeitsschein erfolgreich unterschrieben',
            'work_order': WorkOrderSerializer(work_order).data
        })
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark work order as completed"""
        work_order = self.get_object()
        
        if work_order.status in ['completed', 'signed', 'invoiced']:
            return Response(
                {'error': 'Arbeitsschein wurde bereits abgeschlossen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        work_order.status = 'completed'
        work_order.completed_at = timezone.now()
        work_order.save()
        
        return Response({
            'message': 'Arbeitsschein als abgeschlossen markiert',
            'work_order': WorkOrderSerializer(work_order).data
        })
    
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Generate PDF for work order"""
        work_order = self.get_object()
        
        # TODO: Implement PDF generation
        return Response({
            'message': 'PDF generation not yet implemented',
            'work_order_id': work_order.id
        }, status=status.HTTP_501_NOT_IMPLEMENTED)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get work order statistics"""
        from django.db.models import Count, Q
        
        stats = self.get_queryset().aggregate(
            total=Count('id'),
            draft=Count('id', filter=Q(status='draft')),
            in_progress=Count('id', filter=Q(status='in_progress')),
            completed=Count('id', filter=Q(status='completed')),
            signed=Count('id', filter=Q(status='signed')),
            invoiced=Count('id', filter=Q(status='invoiced')),
        )
        
        return Response(stats)
    
    @action(detail=False, methods=['post'], url_path='check_duplicate')
    def check_duplicate_by_numbers(self, request):
        """
        Prüfe ob Arbeitsschein mit diesen O/P-Nummern bereits existiert.
        Wird vom Frontend nach OCR-Extraktion aufgerufen.
        """
        object_number = request.data.get('object_number', '')
        project_number = request.data.get('project_number', '')
        
        if not object_number or not project_number:
            return Response(
                {'error': 'object_number und project_number erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generiere Content-Hash (gleicher Algorithmus wie in bulk_submit)
        o_normalized = re.sub(r'^[O0-]+', '', object_number.upper().strip())
        p_normalized = re.sub(r'^[P0-]+', '', project_number.upper().strip())
        hash_input = f"{o_normalized}_{p_normalized}"
        content_hash = hashlib.md5(hash_input.encode()).hexdigest()[:12]
        
        # Prüfe ob Duplikat existiert
        duplicate = WorkOrder.objects.filter(content_hash=content_hash).first()
        
        if duplicate:
            return Response({
                'isDuplicate': True,
                'existingOrder': duplicate.order_number,
                'contentHash': content_hash,
                'message': f'Arbeitsschein mit gleichen Daten existiert bereits (AS-Nr: {duplicate.order_number})'
            })
        else:
            return Response({
                'isDuplicate': False,
                'contentHash': content_hash,
                'message': 'Kein Duplikat gefunden'
            })
    
    @action(detail=False, methods=['post'])
    def bulk_submit(self, request):
        """
        Bulk-Upload von gescannten Arbeitsscheinen.
        Jede Datei wird ein separater WorkOrder-Eintrag mit Status 'submitted'.
        """
        print(f"DEBUG: request.FILES = {request.FILES}")
        print(f"DEBUG: request.data = {request.data}")
        
        files = request.FILES.getlist('scanned_documents')
        
        # Hole individuelle O/P-Nummern und Leistungsmonate für jeden Scan
        object_numbers = {}
        project_numbers = {}
        leistungsmonate = {}
        leistungsmonat_confidences = {}
        for key in request.data.keys():
            if key.startswith('object_numbers['):
                index = int(key.split('[')[1].split(']')[0])
                object_numbers[index] = request.data[key]
            elif key.startswith('project_numbers['):
                index = int(key.split('[')[1].split(']')[0])
                project_numbers[index] = request.data[key]
            elif key.startswith('leistungsmonate['):
                index = int(key.split('[')[1].split(']')[0])
                leistungsmonate[index] = request.data[key]
            elif key.startswith('leistungsmonat_confidences['):
                index = int(key.split('[')[1].split(']')[0])
                conf_value = request.data[key]
                leistungsmonat_confidences[index] = float(conf_value) if conf_value and conf_value != 'null' else None
        
        if not files:
            return Response(
                {'error': 'Keine Dateien hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_orders = []
        errors = []
        
        for idx, file in enumerate(files, 1):
            try:
                print(f"DEBUG: Processing file {idx}: {file.name}")
                
                # Hole individuelle O/P-Nummern und Leistungsmonat für diesen Scan
                object_number = object_numbers.get(idx - 1, '')
                project_number = project_numbers.get(idx - 1, '')
                leistungsmonat = leistungsmonate.get(idx - 1, None)
                leistungsmonat_confidence = leistungsmonat_confidences.get(idx - 1, None)
                
                # Generiere Content-Hash aus O-Nr, P-Nr (für Duplikat-Erkennung)
                # Normalisiere die Werte: entferne führende 0, "O-", "P-", Leerzeichen
                o_normalized = re.sub(r'^[O0-]+', '', object_number.upper().strip())
                p_normalized = re.sub(r'^[P0-]+', '', project_number.upper().strip())
                
                # Hash-Input: O+P (ohne führende Nullen)
                hash_input = f"{o_normalized}_{p_normalized}"
                content_hash = hashlib.md5(hash_input.encode()).hexdigest()[:12]  # Erste 12 Zeichen
                
                print(f"DEBUG: Hash-Input='{hash_input}' -> Hash='{content_hash}'")
                
                # Duplikatsprüfung: Prüfe ob Arbeitsschein mit identischem Hash bereits existiert
                if content_hash:
                    duplicate = WorkOrder.objects.filter(content_hash=content_hash).first()
                    
                    if duplicate:
                        error_msg = f'Exaktes Duplikat erkannt: Identischer Arbeitsschein existiert bereits (AS-Nr: {duplicate.order_number}, Hash: {content_hash})'
                        print(f"DEBUG: {error_msg}")
                        errors.append({
                            'file': file.name,
                            'error': error_msg,
                            'existing_order': duplicate.order_number,
                            'content_hash': content_hash
                        })
                        continue  # Überspringe diesen Scan
                
                # Generiere eindeutige Order Number
                year = timezone.now().year
                # Hole die höchste existierende Nummer für dieses Jahr
                last_order = WorkOrder.objects.filter(
                    order_number__startswith=f'AS-{year}'
                ).order_by('-order_number').first()
                
                if last_order:
                    # Extrahiere die Nummer aus dem letzten order_number (z.B. "AS-2026-0012" -> 12)
                    last_num = int(last_order.order_number.split('-')[-1])
                    count = last_num + 1
                else:
                    count = 1
                
                order_number = f'AS-{year}-{count:04d}'
                
                print(f"DEBUG: Creating WorkOrder {order_number} with O:{object_number}, P:{project_number}, Hash:{content_hash}")
                
                # Erstelle WorkOrder mit minimalen Daten
                work_order = WorkOrder.objects.create(
                    order_number=order_number,
                    object_number=object_number,
                    project_number=project_number,
                    content_hash=content_hash,  # Hash speichern
                    leistungsmonat=leistungsmonat,  # OCR-extrahierter Leistungsmonat
                    leistungsmonat_ocr_confidence=leistungsmonat_confidence,  # OCR-Konfidenz
                    status='submitted',
                    scanned_document=file,
                    submitted_at=timezone.now(),
                    submitted_by=request.user,
                    # Dummy-Werte (können später ergänzt werden)
                    client_id=request.data.get('client_id') if request.data.get('client_id') else None,
                    start_date=timezone.now().date(),
                    end_date=timezone.now().date(),
                    work_days=1,
                    work_type=f'Scan-Upload',
                    work_description='Gescannter Arbeitsschein',
                    created_by=request.user
                )
                
                print(f"DEBUG: WorkOrder created: {work_order.id}")
                
                # Duplikat-Check durchführen
                duplicates = work_order.check_for_duplicates()
                duplicate_info = None
                if duplicates:
                    duplicate_info = {
                        'is_duplicate': True,
                        'count': len(duplicates),
                        'original': duplicates[0].order_number
                    }
                
                # Haklisten-Abgleich
                checklist_match = work_order.match_checklist_item()
                checklist_info = None
                if checklist_match:
                    checklist_info = {
                        'matched': True,
                        'sr_number': checklist_match.sr_number,
                        'notes': checklist_match.notes
                    }
                
                # History-Eintrag
                from .history_models import WorkOrderHistory
                WorkOrderHistory.objects.create(
                    work_order=work_order,
                    action='submitted',
                    performed_by=request.user,
                    new_status='submitted',
                    notes=f'Arbeitsschein via Scan eingereicht ({file.name})',
                    metadata={
                        'filename': file.name, 
                        'size': file.size,
                        'is_duplicate': work_order.is_duplicate,
                        'checklist_matched': checklist_match is not None
                    }
                )
                
                print(f"DEBUG: History created for {work_order.id}")
                
                created_orders.append({
                    'id': work_order.id,
                    'order_number': work_order.order_number,
                    'filename': file.name,
                    'optimized_filename': work_order.get_optimized_filename(),
                    'duplicate_info': duplicate_info,
                    'checklist_info': checklist_info
                })
                
            except Exception as e:
                print(f"DEBUG: Error processing file {file.name}: {str(e)}")
                import traceback
                traceback.print_exc()
                errors.append({
                    'filename': file.name,
                    'error': str(e)
                })
        
        return Response({
            'message': f'{len(created_orders)} Arbeitsscheine zur Abrechnung eingereicht',
            'created_orders': created_orders,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_orders else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Einzelnen Arbeitsschein zur Abrechnung einreichen"""
        work_order = self.get_object()
        
        if work_order.status == 'submitted':
            return Response(
                {'error': 'Arbeitsschein bereits eingereicht'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status
        work_order.status = 'submitted'
        work_order.submitted_at = timezone.now()
        work_order.submitted_by = request.user
        work_order.save()
        
        # History-Eintrag
        from .history_models import WorkOrderHistory
        WorkOrderHistory.objects.create(
            work_order=work_order,
            action='submitted',
            performed_by=request.user,
            old_status=work_order.status,
            new_status='submitted',
            notes='Arbeitsschein zur Abrechnung eingereicht'
        )
        
        return Response({
            'message': 'Arbeitsschein eingereicht',
            'work_order': WorkOrderSerializer(work_order, context={'request': request}).data
        })
    
    @action(detail=True, methods=['post'])
    def mark_billed(self, request, pk=None):
        """Markiere Arbeitsschein als abgerechnet"""
        work_order = self.get_object()
        
        try:
            work_order.mark_as_billed(request.user)
            return Response({
                'message': 'Arbeitsschein als abgerechnet markiert',
                'work_order': WorkOrderSerializer(work_order, context={'request': request}).data
            })
        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Storniere Arbeitsschein
        
        Berechtigung:
        - Ersteller des Arbeitsscheins
        - Faktur-MA (TODO: Via Custom Permission)
        - Vertretung bei Abwesenheit (TODO: Via Custom Permission)
        
        Validierung:
        - PDF darf nicht bereits heruntergeladen sein
        - Stornierungsgrund ist optional aber empfohlen
        """
        work_order = self.get_object()
        
        # Stornierungsgrund aus Request
        reason = request.data.get('cancellation_reason', '')
        
        try:
            work_order.cancel_order(request.user, reason=reason)
            return Response({
                'message': 'Arbeitsschein erfolgreich storniert',
                'work_order': WorkOrderSerializer(work_order, context={'request': request}).data
            })
        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def submitted(self, request):
        """Hole alle eingereichten Arbeitsscheine für den zuständigen Faktura-Mitarbeiter"""
        user = request.user
        
        # Finde alle Arbeitsscheine wo user zuständig ist (direkt oder als Vertretung)
        from absences.models import Absence
        today = timezone.now().date()
        
        # Service Manager die unter diesem Faktura-Mitarbeiter sind
        managed_users = user.managed_service_managers.all()
        
        # Finde auch Users wo dieser User als Vertretung eingesetzt ist
        active_absences = Absence.objects.filter(
            representative=user,
            start_date__lte=today,
            end_date__gte=today,
            status='approved'
        ).select_related('user__profile')
        
        # Sammle alle Users deren Arbeitsscheine gesehen werden sollen
        responsible_for = list(managed_users)
        for absence in active_absences:
            if hasattr(absence.user, 'profile') and absence.user.profile.billing_responsible:
                responsible_for.append(absence.user)
        
        # Hole eingereichte Arbeitsscheine
        submitted_orders = self.get_queryset().filter(
            submitted_by__in=responsible_for,
            status='submitted'
        ).select_related('submitted_by', 'client')
        
        serializer = self.get_serializer(submitted_orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Hole alle History-Einträge für einen Arbeitsschein"""
        work_order = self.get_object()
        
        history_entries = WorkOrderHistory.objects.filter(
            work_order=work_order
        ).select_related('performed_by').order_by('-performed_at')
        
        serializer = WorkOrderHistorySerializer(history_entries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def check_duplicate(self, request, pk=None):
        """Prüft ob dieser Arbeitsschein ein Duplikat ist"""
        work_order = self.get_object()
        duplicates = work_order.check_for_duplicates()
        
        return Response({
            'is_duplicate': work_order.is_duplicate,
            'duplicates_count': len(duplicates),
            'duplicates': [
                {
                    'id': dup.id,
                    'order_number': dup.order_number,
                    'status': dup.status,
                    'created_at': dup.created_at
                } for dup in duplicates
            ]
        })
    
    @action(detail=True, methods=['post'])
    def mark_downloaded(self, request, pk=None):
        """Markiert PDF als heruntergeladen"""
        from auth_user.permission_service import PermissionService
        
        perm_service = PermissionService.for_user(request.user)
        if not perm_service.has_permission('can_download_workorder_pdf'):
            return Response(
                {'error': 'Fehlende Berechtigung: can_download_workorder_pdf'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        work_order = self.get_object()
        work_order.mark_pdf_downloaded(request.user)
        
        return Response({
            'message': 'PDF als heruntergeladen markiert',
            'work_order': WorkOrderSerializer(work_order, context={'request': request}).data
        })
    
    @action(detail=False, methods=['post'])
    def bulk_download(self, request):
        """
        Markiert mehrere Arbeitsscheine als heruntergeladen.
        Body: { "workorder_ids": [1, 2, 3] }
        """
        from auth_user.permission_service import PermissionService
        
        perm_service = PermissionService.for_user(request.user)
        if not perm_service.has_permission('can_download_workorder_pdf'):
            return Response(
                {'error': 'Fehlende Berechtigung: can_download_workorder_pdf'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        workorder_ids = request.data.get('workorder_ids', [])
        
        if not workorder_ids:
            return Response(
                {'error': 'workorder_ids erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workorders = WorkOrder.objects.filter(id__in=workorder_ids)
        updated_count = 0
        
        for wo in workorders:
            wo.mark_pdf_downloaded(request.user)
            updated_count += 1
        
        return Response({
            'message': f'{updated_count} Arbeitsscheine als heruntergeladen markiert',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['post'])
    def merge_pdfs(self, request):
        """
        Erstellt eine zusammengefasste PDF für SR-Rechnungen.
        Body: { "workorder_ids": [1, 2, 3], "sr_number": "SR-123" }
        """
        from django.http import HttpResponse
        from PyPDF2 import PdfMerger
        from auth_user.permission_service import PermissionService
        import io
        
        perm_service = PermissionService.for_user(request.user)
        if not perm_service.has_permission('can_download_workorder_pdf'):
            return Response(
                {'error': 'Fehlende Berechtigung: can_download_workorder_pdf'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        workorder_ids = request.data.get('workorder_ids', [])
        sr_number = request.data.get('sr_number', '')
        
        if not workorder_ids:
            return Response(
                {'error': 'workorder_ids erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workorders = WorkOrder.objects.filter(id__in=workorder_ids)
        
        # Sammle alle PDF-Dateien
        pdf_files = []
        for wo in workorders:
            if wo.scanned_document:
                pdf_files.append(wo.scanned_document.path)
        
        if not pdf_files:
            return Response(
                {'error': 'Keine PDFs zum Zusammenführen gefunden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Merge PDFs
        merger = PdfMerger()
        for pdf_path in pdf_files:
            merger.append(pdf_path)
        
        # Erstelle Response mit merged PDF
        output = io.BytesIO()
        merger.write(output)
        merger.close()
        output.seek(0)
        
        # Markiere alle als heruntergeladen
        for wo in workorders:
            wo.mark_pdf_downloaded(request.user)
        
        filename = f"{sr_number}_Sammelrechnung.pdf" if sr_number else "Zusammengefasst.pdf"
        
        response = HttpResponse(output.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    @action(detail=False, methods=['post'])
    def bulk_mark_billed(self, request):
        """
        Markiert mehrere Arbeitsscheine als abgerechnet (billed).
        Body: { "workorder_ids": [1, 2, 3] }
        """
        from auth_user.permission_service import PermissionService
        
        perm_service = PermissionService.for_user(request.user)
        
        workorder_ids = request.data.get('workorder_ids', [])
        
        if not workorder_ids:
            return Response(
                {'error': 'workorder_ids erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workorders = WorkOrder.objects.filter(id__in=workorder_ids, status='submitted')
        updated_count = 0
        errors = []
        
        for wo in workorders:
            # Prüfe Permission für jeden einzelnen Workorder
            if not perm_service.can_process_workorder(wo):
                errors.append(f'Arbeitsschein {wo.order_number}: Keine Berechtigung')
                continue
            
            try:
                wo.mark_as_billed(request.user)
                updated_count += 1
            except Exception as e:
                errors.append(f'Arbeitsschein {wo.order_number}: {str(e)}')
        
        response_data = {
            'message': f'{updated_count} Arbeitsscheine als abgerechnet markiert',
            'updated_count': updated_count
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data)
    
    @action(detail=False, methods=['post'])
    def split_pdf(self, request):
        """
        Teilt eine mehrseitige PDF in einzelne Seiten auf.
        Body: multipart/form-data mit 'pdf' File
        Returns: { "pages": [{"page_number": 1, "url": "..."}, ...] }
        """
        from PyPDF2 import PdfReader, PdfWriter
        from django.core.files.base import ContentFile
        import io
        import os
        
        pdf_file = request.FILES.get('pdf')
        
        if not pdf_file:
            return Response(
                {'error': 'PDF-Datei erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            reader = PdfReader(pdf_file)
            page_count = len(reader.pages)
            
            if page_count <= 1:
                return Response(
                    {'error': 'PDF hat nur eine Seite'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            pages_data = []
            
            # Erstelle temporäres Verzeichnis für aufgeteilte Seiten
            from django.conf import settings
            temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_pdf_splits', str(request.user.id))
            os.makedirs(temp_dir, exist_ok=True)
            
            # Teile PDF in einzelne Seiten
            for page_num in range(page_count):
                writer = PdfWriter()
                writer.add_page(reader.pages[page_num])
                
                # Speichere Seite als separate PDF
                output_buffer = io.BytesIO()
                writer.write(output_buffer)
                output_buffer.seek(0)
                
                # Erstelle temporäre Datei
                filename = f'page_{page_num + 1}_{int(timezone.now().timestamp())}.pdf'
                filepath = os.path.join(temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                # Erstelle URL für Frontend
                url = f'/media/temp_pdf_splits/{request.user.id}/{filename}'
                
                pages_data.append({
                    'page_number': page_num + 1,
                    'url': url,
                    'filename': filename
                })
            
            return Response({
                'message': f'PDF in {page_count} Seiten aufgeteilt',
                'page_count': page_count,
                'pages': pages_data
            })
            
        except Exception as e:
            return Response(
                {'error': f'Fehler beim Splitten der PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RecurringWorkOrderChecklistViewSet(viewsets.ModelViewSet):
    """ViewSet für Hakliste - nur für Faktur-Mitarbeiter"""
    serializer_class = RecurringWorkOrderChecklistSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['object_number', 'project_number', 'object_description', 'debitor_number', 'notes', 'sr_invoice_number']
    filterset_fields = ['sr_invoice_number', 'checked_this_month', 'is_active', 'current_month', 'service_manager', 'assigned_billing_user']
    ordering_fields = ['object_number', 'project_number', 'last_checked_at', 'created_at']
    ordering = ['object_number', 'project_number']
    
    def get_permissions(self):
        """Schreibzugriff nur mit can_manage_checklist_assignments"""
        from rest_framework import permissions as rest_permissions
        from auth_user.permission_service import PermissionService
        
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Schreibzugriff: Prüfe can_manage_checklist_assignments
            class ManageChecklistPermission(rest_permissions.BasePermission):
                def has_permission(self, request, view):
                    if request.user.is_superuser or request.user.is_staff:
                        return True
                    perm_service = PermissionService.for_user(request.user)
                    return perm_service.has_permission('can_manage_checklist_assignments')
            
            return [rest_permissions.IsAuthenticated(), ManageChecklistPermission()]
        
        return super().get_permissions()
    
    def get_queryset(self):
        """Filtert Checklist-Items basierend auf Permission-Scope"""
        from django.db.models import Q
        from auth_user.permission_service import PermissionService
        
        user = self.request.user
        queryset = RecurringWorkOrderChecklist.objects.select_related(
            'client', 'work_object', 'created_by', 'last_checked_by',
            'service_manager', 'assigned_billing_user'
        )
        
        # Superuser/Staff sehen immer alles
        if user.is_superuser or user.is_staff:
            return queryset.all()
        
        # Check if user wants to see all items (via query parameter)
        show_all = self.request.query_params.get('show_all', 'false').lower() == 'true'
        
        # Hole Scope für can_view_workorder_checklist
        perm_service = PermissionService.for_user(user)
        
        # Wenn show_all=true und User hat can_toggle_all_checklist_items → Alle anzeigen
        if show_all and perm_service.has_permission('can_toggle_all_checklist_items'):
            return queryset.all()
        
        scope = perm_service.get_permission_scope('can_view_workorder_checklist')
        
        if not scope or scope == 'NONE':
            # Keine Berechtigung - KEINE Items anzeigen
            return queryset.none()
        
        if scope == 'ALL':
            # Alle Items anzeigen (inkl. Legacy)
            return queryset.all()
        
        # Toggle-Funktionalität: Wenn User can_toggle_all_checklist_items hat
        # und show_all=true sendet, alle anzeigen
        show_all = self.request.query_params.get('show_all', '').lower() == 'true'
        if show_all and perm_service.has_permission('can_toggle_all_checklist_items'):
            return queryset.all()
        
        if scope == 'DEPARTMENT':
            # Items der eigenen Abteilungen (über client/work_object Department)
            user_departments = user.userprofile.memberships.filter(
                is_active=True
            ).values_list('department_id', flat=True)
            
            return queryset.filter(
                Q(client__department__in=user_departments) |
                Q(work_object__department__in=user_departments) |
                Q(service_manager=user) |
                Q(assigned_billing_user=user)
            ).distinct()
        
        # scope == 'OWN': Nur eigene zugewiesene Items (OHNE Legacy)
        return queryset.filter(
            Q(service_manager=user) | 
            Q(assigned_billing_user=user)
        )
    
    @action(detail=True, methods=['post'])
    def check(self, request, pk=None):
        """Hakt den Eintrag für den aktuellen Monat ab"""
        checklist_item = self.get_object()
        checklist_item.check_for_month(request.user)
        
        return Response({
            'message': 'Eintrag für diesen Monat abgehakt',
            'checklist_item': self.get_serializer(checklist_item).data
        })
    
    @action(detail=True, methods=['post'])
    def uncheck(self, request, pk=None):
        """Entfernt das Häkchen für den aktuellen Monat"""
        checklist_item = self.get_object()
        checklist_item.checked_this_month = False
        checklist_item.save()
        
        return Response({
            'message': 'Häkchen entfernt',
            'checklist_item': self.get_serializer(checklist_item).data
        })
    
    @action(detail=False, methods=['post'])
    def reset_monthly(self, request):
        """Setzt alle Einträge für den neuen Monat zurück (Admin-Funktion)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Nur Admins können monatliche Resets durchführen'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from django.utils import timezone
        current_month = timezone.now().strftime('%Y-%m')
        
        updated_count = 0
        for item in self.get_queryset().filter(is_active=True):
            if item.current_month != current_month:
                item.reset_monthly_check()
                updated_count += 1
        
        return Response({
            'message': f'{updated_count} Einträge für {current_month} zurückgesetzt',
            'updated_count': updated_count,
            'current_month': current_month
        })
    
    @action(detail=False, methods=['get'])
    def by_sr_number(self, request):
        """Gibt alle Haklisten-Einträge für eine SR-Nummer zurück"""
        sr_number = request.query_params.get('sr_number')
        if not sr_number:
            return Response(
                {'error': 'sr_number Parameter erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        items = RecurringWorkOrderChecklist.get_items_for_sr_number(sr_number)
        serializer = self.get_serializer(items, many=True)
        
        return Response({
            'sr_number': sr_number,
            'count': items.count(),
            'items': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def unchecked(self, request):
        """Gibt alle noch nicht abgehakten Einträge für den aktuellen Monat zurück"""
        from django.utils import timezone
        current_month = timezone.now().strftime('%Y-%m')
        
        unchecked = self.get_queryset().filter(
            current_month=current_month,
            checked_this_month=False,
            is_active=True
        )
        
        serializer = self.get_serializer(unchecked, many=True)
        return Response({
            'current_month': current_month,
            'count': unchecked.count(),
            'items': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def sync(self, request):
        """
        Synchronisiert die Hakliste mit den Stammdaten.
        Fügt neue gültige Einträge hinzu und entfernt ungültige.
        """
        from .tasks import sync_checklist_items
        
        # Führe Task asynchron aus
        task = sync_checklist_items.delay()
        
        return Response({
            'message': 'Synchronisation gestartet',
            'task_id': task.id
        }, status=status.HTTP_202_ACCEPTED)
    
    @action(detail=False, methods=['post'])
    def import_preview(self, request):
        """Import-Vorschau - nur für Superuser/Staff"""
        if not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {'error': 'Import ist nur für Administratoren verfügbar'},
                status=status.HTTP_403_FORBIDDEN
            )
        """
        Vorschau des Imports: Liest Excel/CSV-Datei und zeigt Spalten-Mapping an.
        """
        import pandas as pd
        import io
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        sheet_name = request.data.get('sheet_name', 0)  # Default: erstes Sheet
        
        try:
            # Lese Excel oder CSV
            if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
                # Prüfe verfügbare Sheets
                file_bytes = io.BytesIO(file.read())
                excel_file = pd.ExcelFile(file_bytes)
                available_sheets = excel_file.sheet_names
                
                # Wenn sheet_name nicht angegeben, gib Sheet-Liste zurück
                if sheet_name is None or sheet_name == 'detect':
                    return Response({
                        'available_sheets': available_sheets,
                        'requires_sheet_selection': len(available_sheets) > 1
                    })
                
                # Lese das ausgewählte Sheet
                if isinstance(sheet_name, str) and sheet_name.isdigit():
                    sheet_name = int(sheet_name)
                df = pd.read_excel(file_bytes, sheet_name=sheet_name)
            elif file.name.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file.read()))
                available_sheets = ['CSV']
            else:
                return Response(
                    {'error': 'Nur Excel (.xlsx, .xls) oder CSV (.csv) Dateien erlaubt'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verfügbare Spalten aus der Datei - konvertiere zu Strings
            available_columns = [str(col) for col in df.columns.tolist()]
            
            # Pflichtfelder und optionale Felder
            required_fields = [
                {'key': 'object_number', 'label': 'O-Nummer', 'required': True},
                {'key': 'project_number', 'label': 'P-Nummer', 'required': True},
                {'key': 'object_description', 'label': 'Objektbeschreibung', 'required': True},
            ]
            
            optional_fields = [
                {'key': 'debitor_number', 'label': 'Debitor-Nr', 'required': False},
                {'key': 'sr_invoice_number', 'label': 'SR-Rechnungsnummer', 'required': False},
                {'key': 'notes', 'label': 'Bemerkung', 'required': False},
                {'key': 'valid_from', 'label': 'Gültig von', 'required': False},
                {'key': 'valid_until', 'label': 'Gültig bis', 'required': False},
                {'key': 'service_manager_username', 'label': 'Service Manager (Username)', 'required': False},
                {'key': 'billing_user_username', 'label': 'Faktur-MA (Username)', 'required': False},
            ]
            
            # Auto-Mapping: Versuche Spalten automatisch zuzuordnen
            # Erweiterte Synonyme für bessere Erkennung
            field_synonyms = {
                'object_number': ['o-nummer', 'o-nr', 'onr', 'objnr', 'objektnummer', 'object', 'obj'],
                'project_number': ['p-nummer', 'p-nr', 'pnr', 'projektnummer', 'project', 'proj'],
                'object_description': ['objektbeschreibung', 'beschreibung', 'description', 'objekt', 'text'],
                'debitor_number': ['debitor', 'debitornr', 'debitor-nr', 'kundennr', 'kunde'],
                'sr_invoice_number': ['sr-nummer', 'sr', 'sr-nr', 'srnummer', 'sammelrechnung'],
                'notes': ['bemerkung', 'notiz', 'anmerkung', 'hinweis', 'info', 'notes'],
                'valid_from': ['gültig von', 'von', 'start', 'startdatum', 'beginn', 'valid from'],
                'valid_until': ['gültig bis', 'bis', 'ende', 'enddatum', 'valid until'],
                'service_manager_username': ['service manager', 'servicemanager', 'sm', 'verantwortlicher'],
                'billing_user_username': ['faktur', 'faktur-ma', 'billing', 'abrechnung'],
            }
            
            auto_mapping = {}
            for field in required_fields + optional_fields:
                field_key = field['key']
                synonyms = field_synonyms.get(field_key, [field['label'].lower()])
                
                # Suche nach Übereinstimmung mit Synonymen
                for col in available_columns:
                    col_lower = str(col).lower().replace('_', '').replace('-', '').replace(' ', '')
                    
                    # Prüfe alle Synonyme
                    for synonym in synonyms:
                        synonym_normalized = synonym.lower().replace('_', '').replace('-', '').replace(' ', '')
                        if (col_lower == synonym_normalized or 
                            synonym_normalized in col_lower or
                            col_lower in synonym_normalized):
                            auto_mapping[field_key] = col
                            break
                    
                    if field_key in auto_mapping:
                        break
            
            # Erste 5 Zeilen als Vorschau - konvertiere alle Datentypen zu JSON-kompatiblen Strings
            preview_df = df.head(5).copy()
            # Konvertiere Spaltennamen zu Strings (wichtig für JSON-Keys)
            preview_df.columns = [str(col) for col in preview_df.columns]
            # Konvertiere alle Werte zu String, um JSON-Serialisierung zu garantieren
            for col in preview_df.columns:
                preview_df[col] = preview_df[col].astype(str)
            preview_data = preview_df.replace('nan', '').replace('NaT', '').to_dict('records')
            
            return Response({
                'available_columns': available_columns,
                'required_fields': required_fields,
                'optional_fields': optional_fields,
                'auto_mapping': auto_mapping,
                'preview_data': preview_data,
                'total_rows': len(df),
                'available_sheets': available_sheets if file.name.endswith(('.xlsx', '.xls')) else None,
                'selected_sheet': sheet_name
            })
            
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"❌ Import preview error: {str(e)}")
            print(f"❌ Traceback: {error_detail}")
            return Response(
                {'error': f'Fehler beim Lesen der Datei: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def import_execute(self, request):
        """
        Führt den Import mit dem bestätigten Column-Mapping aus.
        Gibt fehlende Pflichtfelder zurück zur manuellen Nachbearbeitung.
        """
        import pandas as pd
        import io
        from datetime import datetime
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        column_mapping_str = request.data.get('column_mapping', '{}')
        sheet_name = request.data.get('sheet_name', 0)
        global_valid_from = request.data.get('global_valid_from', '')
        
        # Parse JSON column_mapping
        try:
            import json
            column_mapping = json.loads(column_mapping_str) if isinstance(column_mapping_str, str) else column_mapping_str
        except json.JSONDecodeError as e:
            print(f"❌ JSON Parse Error: {str(e)}")
            print(f"❌ Column mapping string: {column_mapping_str}")
            return Response(
                {'error': f'Column Mapping ist kein gültiges JSON: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not column_mapping:
            return Response(
                {'error': 'Column Mapping fehlt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Lese Datei
            if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
                if isinstance(sheet_name, str) and sheet_name.isdigit():
                    sheet_name = int(sheet_name)
                df = pd.read_excel(io.BytesIO(file.read()), sheet_name=sheet_name)
            else:
                df = pd.read_csv(io.BytesIO(file.read()))
            
            # Validiere und bereite Daten vor
            import_results = {
                'valid': [],
                'invalid': [],
                'total': len(df)
            }
            
            for index, row in df.iterrows():
                item_data = {
                    'row_number': index + 1,
                    'original_data': {}
                }
                
                # Mappe Spalten
                for field_key, column_name in column_mapping.items():
                    if column_name and column_name in df.columns:
                        value = row[column_name]
                        # Konvertiere NaN zu leerem String
                        if pd.isna(value):
                            value = ''
                        else:
                            value = str(value).strip()
                        item_data['original_data'][column_name] = value
                        item_data[field_key] = value
                
                # Globales Startdatum anwenden, wenn nicht in Spalte vorhanden
                if global_valid_from and not item_data.get('valid_from'):
                    item_data['valid_from'] = global_valid_from
                
                # Validiere Pflichtfelder (valid_from ist jetzt optional)
                missing_fields = []
                if not item_data.get('object_number'):
                    missing_fields.append('O-Nummer')
                if not item_data.get('project_number'):
                    missing_fields.append('P-Nummer')
                if not item_data.get('object_description'):
                    missing_fields.append('Objektbeschreibung')
                # Startdatum ist optional - kann leer bleiben oder im Validierungsschritt ergänzt werden
                
                if missing_fields:
                    item_data['missing_fields'] = missing_fields
                    import_results['invalid'].append(item_data)
                else:
                    import_results['valid'].append(item_data)
            
            return Response({
                'success': True,
                'import_results': import_results
            })
            
        except Exception as e:
            return Response(
                {'error': f'Fehler beim Import: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def import_save(self, request):
        """Import speichern - nur für Superuser/Staff"""
        if not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {'error': 'Import ist nur für Administratoren verfügbar'},
                status=status.HTTP_403_FORBIDDEN
            )
        """
        Speichert die validierten Import-Daten in die Datenbank.
        """
        items_data = request.data.get('items', [])
        
        if not items_data:
            return Response(
                {'error': 'Keine Daten zum Speichern'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_items = []
        updated_items = []
        errors = []
        
        for item_data in items_data:
            try:
                # Resolve Service Manager & Billing User by username
                service_manager = None
                billing_user = None
                
                if item_data.get('service_manager_username'):
                    try:
                        service_manager = User.objects.get(username=item_data['service_manager_username'])
                    except User.DoesNotExist:
                        pass  # Ignoriere ungültige Usernames
                
                if item_data.get('billing_user_username'):
                    try:
                        billing_user = User.objects.get(username=item_data['billing_user_username'])
                    except User.DoesNotExist:
                        pass
                
                # Fallback: Wenn kein billing_user, nutze aktuellen User
                if not billing_user and request.user:
                    billing_user = request.user
                
                # Prüfe ob Eintrag bereits existiert
                existing = RecurringWorkOrderChecklist.objects.filter(
                    object_number=item_data['object_number'],
                    project_number=item_data['project_number']
                ).first()
                
                if existing:
                    # Update
                    existing.object_description = item_data.get('object_description', '')
                    existing.debitor_number = item_data.get('debitor_number', '')
                    existing.notes = item_data.get('notes', '')
                    existing.sr_invoice_number = item_data.get('sr_invoice_number', '')
                    if service_manager:
                        existing.service_manager = service_manager
                    if billing_user:
                        existing.assigned_billing_user = billing_user
                    if request.user:
                        existing.last_checked_by = request.user
                    existing.save()
                    updated_items.append(existing.id)
                else:
                    # Create
                    new_item = RecurringWorkOrderChecklist.objects.create(
                        object_number=item_data['object_number'],
                        project_number=item_data['project_number'],
                        object_description=item_data.get('object_description', ''),
                        debitor_number=item_data.get('debitor_number', ''),
                        notes=item_data.get('notes', ''),
                        sr_invoice_number=item_data.get('sr_invoice_number', ''),
                        service_manager=service_manager,
                        assigned_billing_user=billing_user,
                        created_by=request.user if request.user else None
                    )
                    created_items.append(new_item.id)
                    
            except Exception as e:
                errors.append({
                    'row': item_data.get('row_number'),
                    'error': str(e)
                })
        
        return Response({
            'success': True,
            'created': len(created_items),
            'updated': len(updated_items),
            'errors': errors
        })

class WorkorderAssignmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet für WorkorderAssignment (Einreicher → Faktur-MA)
    Nur Faktur-Mitarbeiter dürfen Zuweisungen verwalten
    """
    serializer_class = WorkorderAssignmentSerializer
    permission_classes = [IsAuthenticated, CanManageWorkorderAssignments]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['submitter__first_name', 'submitter__last_name', 'processor__first_name', 'processor__last_name']
    filterset_fields = ['submitter', 'processor', 'specialty', 'is_active', 'is_auto_assigned']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Alle aktiven Zuweisungen"""
        return WorkorderAssignment.objects.select_related(
            'submitter', 'processor', 'specialty', 'specialty__department'
        ).all()
    
    @action(detail=False, methods=['get'])
    def by_submitter(self, request):
        """Gibt alle Zuweisungen für einen Einreicher zurück"""
        submitter_id = request.query_params.get('submitter_id')
        if not submitter_id:
            return Response(
                {'error': 'submitter_id Parameter erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assignments = self.get_queryset().filter(
            submitter_id=submitter_id,
            is_active=True
        )
        serializer = self.get_serializer(assignments, many=True)
        
        return Response({
            'submitter_id': submitter_id,
            'count': assignments.count(),
            'assignments': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def by_processor(self, request):
        """Gibt alle Zuweisungen für einen Faktur-MA zurück"""
        processor_id = request.query_params.get('processor_id')
        if not processor_id:
            return Response(
                {'error': 'processor_id Parameter erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assignments = self.get_queryset().filter(
            processor_id=processor_id,
            is_active=True
        )
        serializer = self.get_serializer(assignments, many=True)
        
        return Response({
            'processor_id': processor_id,
            'count': assignments.count(),
            'assignments': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deaktiviert eine Zuweisung"""
        assignment = self.get_object()
        assignment.is_active = False
        assignment.save()
        
        return Response({
            'message': 'Zuweisung deaktiviert',
            'assignment': self.get_serializer(assignment).data
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Aktiviert eine Zuweisung wieder"""
        assignment = self.get_object()
        assignment.is_active = True
        assignment.save()
        
        return Response({
            'message': 'Zuweisung aktiviert',
            'assignment': self.get_serializer(assignment).data
        })