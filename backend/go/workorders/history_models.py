"""
WorkOrder History Model für Transparenz
Trackt alle Statusänderungen und Aktionen
"""
from django.db import models
from django.conf import settings
from .models import WorkOrder


class WorkOrderHistory(models.Model):
    """
    Audit Trail für WorkOrders
    Zeigt wer wann was gemacht hat
    """
    
    ACTION_CHOICES = [
        ('created', 'Erstellt'),
        ('updated', 'Aktualisiert'),
        ('submitted', 'Eingereicht'),
        ('billed', 'Abgerechnet'),
        ('status_changed', 'Status geändert'),
        ('assigned', 'Zugewiesen'),
        ('document_uploaded', 'Dokument hochgeladen'),
        ('cancelled', 'Storniert'),
    ]
    
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='history',
        verbose_name='Arbeitsschein'
    )
    
    action = models.CharField(
        'Aktion',
        max_length=50,
        choices=ACTION_CHOICES
    )
    
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Durchgeführt von'
    )
    
    performed_at = models.DateTimeField(
        'Zeitpunkt',
        auto_now_add=True
    )
    
    old_status = models.CharField(
        'Alter Status',
        max_length=20,
        blank=True
    )
    
    new_status = models.CharField(
        'Neuer Status',
        max_length=20,
        blank=True
    )
    
    notes = models.TextField(
        'Notizen',
        blank=True
    )
    
    # Zusätzliche Metadaten
    metadata = models.JSONField(
        'Metadaten',
        default=dict,
        blank=True,
        help_text='Zusätzliche Informationen (z.B. Dateiname, IP-Adresse)'
    )
    
    class Meta:
        verbose_name = 'Arbeitsschein-Historie'
        verbose_name_plural = 'Arbeitsschein-Historien'
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['work_order', '-performed_at']),
            models.Index(fields=['performed_by', '-performed_at']),
        ]
    
    def __str__(self):
        return f"{self.work_order.order_number} - {self.get_action_display()} am {self.performed_at.strftime('%d.%m.%Y %H:%M')}"
