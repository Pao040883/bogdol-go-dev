"""
Models für Search-Tracking und KI-Learning
"""
import logging
from django.db import models
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class SearchQuery(models.Model):
    """
    Tracking von Such-Anfragen für späteres Learning
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='search_queries',
        verbose_name='Benutzer'
    )
    query_text = models.CharField('Such-Query', max_length=500)
    result_count = models.IntegerField('Anzahl Ergebnisse', default=0)
    
    # Durchschnittliche Relevanz der Top-5 Ergebnisse
    avg_score = models.FloatField('Durchschnittlicher Score', null=True, blank=True)
    
    # Wurde ein Ergebnis angeklickt?
    has_click = models.BooleanField('Ergebnis angeklickt', default=False)
    
    # Session-Info
    session_key = models.CharField('Session Key', max_length=100, blank=True)
    ip_address = models.GenericIPAddressField('IP-Adresse', null=True, blank=True)
    
    created_at = models.DateTimeField('Zeitpunkt', auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = 'Such-Anfrage'
        verbose_name_plural = 'Such-Anfragen'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['query_text', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.query_text} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class SearchClick(models.Model):
    """
    Tracking welche Ergebnisse angeklickt wurden (für Relevanz-Learning)
    """
    search_query = models.ForeignKey(
        SearchQuery,
        on_delete=models.CASCADE,
        related_name='clicks',
        verbose_name='Such-Anfrage'
    )
    clicked_profile = models.ForeignKey(
        'auth_user.UserProfile',
        on_delete=models.CASCADE,
        related_name='search_clicks',
        verbose_name='Angeklicktes Profil'
    )
    
    # Position in den Suchergebnissen (1-based)
    position = models.IntegerField('Position', default=0)
    
    # Relevanz-Score den das Ergebnis hatte
    relevance_score = models.FloatField('Relevanz-Score')
    
    # Wie lange blieb der User auf dem Profil? (Indikator für Relevanz)
    time_on_page = models.IntegerField('Zeit auf Seite (Sekunden)', null=True, blank=True)
    
    created_at = models.DateTimeField('Zeitpunkt', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Such-Klick'
        verbose_name_plural = 'Such-Klicks'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['search_query', 'position']),
            models.Index(fields=['clicked_profile', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.search_query.query_text} → {self.clicked_profile}"


class SearchSynonym(models.Model):
    """
    Synonym-Mapping für bessere Suche
    Kann manuell gepflegt oder durch Learning generiert werden
    """
    term = models.CharField('Begriff', max_length=100, unique=True)
    synonyms = models.TextField(
        'Synonyme',
        help_text='Komma-separierte Liste von Synonymen'
    )
    
    # Automatisch durch Learning erstellt oder manuell?
    is_auto_generated = models.BooleanField('Automatisch generiert', default=False)
    
    # Gewichtung (wie stark soll das Synonym berücksichtigt werden?)
    weight = models.FloatField('Gewichtung', default=0.8, help_text='0.0 - 1.0')
    
    # Nur für bestimmte Bereiche?
    scope = models.CharField(
        'Gültigkeitsbereich',
        max_length=50,
        blank=True,
        help_text='z.B. "IT", "Verwaltung", leer = global'
    )
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Such-Synonym'
        verbose_name_plural = 'Such-Synonyme'
        ordering = ['term']
        indexes = [
            models.Index(fields=['term', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.term} → {self.synonyms}"
    
    def get_synonym_list(self):
        """Gibt Synonyme als Liste zurück"""
        return [s.strip() for s in self.synonyms.split(',') if s.strip()]


class SearchProfileMapping(models.Model):
    """
    Manuelle Zuordnung von Suchbegriffen zu Profilen
    Admin kann damit gezielt Profile für bestimmte Queries festlegen
    """
    query_term = models.CharField(
        'Suchbegriff',
        max_length=255,
        help_text='z.B. "drucker problem", "rechnung", "urlaub"'
    )
    
    profile = models.ForeignKey(
        'auth_user.UserProfile',
        on_delete=models.CASCADE,
        related_name='search_mappings',
        verbose_name='Zugeordnetes Profil'
    )
    
    # Boost-Wert (wie stark soll dieses Profil gepusht werden?)
    boost_score = models.FloatField(
        'Boost-Wert',
        default=0.3,
        help_text='0.0 - 1.0, wird zum Score addiert'
    )
    
    # Priorität (bei mehreren Zuordnungen)
    priority = models.IntegerField(
        'Priorität',
        default=1,
        help_text='Höhere Zahl = höhere Priorität'
    )
    
    # Notizen für Admin
    notes = models.TextField('Notizen', blank=True, help_text='Warum diese Zuordnung?')
    
    is_active = models.BooleanField('Aktiv', default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_mappings',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField('Erstellt am', auto_now_add=True)
    updated_at = models.DateTimeField('Aktualisiert am', auto_now=True)
    
    class Meta:
        verbose_name = 'Such-Zuordnung'
        verbose_name_plural = 'Such-Zuordnungen'
        ordering = ['-priority', 'query_term']
        indexes = [
            models.Index(fields=['query_term', 'is_active']),
            models.Index(fields=['-priority']),
        ]
        unique_together = ['query_term', 'profile']
    
    def __str__(self):
        return f"{self.query_term} → {self.profile.user.get_full_name()} (+{self.boost_score})"
