"""
Chat System Models
Unterstützt 1:1 und Gruppenchats mit Dateiupload
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


class ChatConversation(models.Model):
    """
    Konversation (1:1 oder Gruppe)
    """
    CONVERSATION_TYPES = [
        ('direct', 'Direktchat'),
        ('group', 'Gruppenchat'),
    ]
    
    conversation_type = models.CharField(
        'Typ',
        max_length=20,
        choices=CONVERSATION_TYPES,
        default='direct'
    )
    
    # Participants
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='conversations',
        verbose_name='Teilnehmer'
    )
    
    # Gruppenchat-spezifisch
    name = models.CharField(
        'Gruppenname',
        max_length=200,
        blank=True,
        help_text='Nur für Gruppenchats'
    )
    description = models.TextField(
        'Beschreibung',
        blank=True
    )
    avatar = models.ImageField(
        'Gruppenbild',
        upload_to='chat/group_avatars/',
        null=True,
        blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_conversations',
        verbose_name='Erstellt von'
    )
    
    # Admins (für Gruppenchats)
    admins = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='administered_conversations',
        verbose_name='Administratoren',
        blank=True
    )
    
    # Metadata
    last_message_at = models.DateTimeField(
        'Letzte Nachricht',
        null=True,
        blank=True
    )
    is_archived = models.BooleanField(
        'Archiviert',
        default=False
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Chat-Konversation'
        verbose_name_plural = 'Chat-Konversationen'
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['conversation_type', '-last_message_at']),
            models.Index(fields=['is_archived']),
        ]
    
    def __str__(self):
        if self.conversation_type == 'group':
            return f"Gruppe: {self.name or f'#{self.id}'}"
        else:
            participants = self.participants.all()[:2]
            if len(participants) == 2:
                return f"Chat: {participants[0].username} & {participants[1].username}"
            return f"Chat #{self.id}"
    
    def get_unread_count(self, user):
        """Anzahl ungelesener Nachrichten für einen User"""
        return self.messages.filter(
            is_deleted=False
        ).exclude(
            sender=user
        ).exclude(
            read_by=user
        ).count()
    
    def mark_as_read(self, user):
        """Markiert alle Nachrichten als gelesen für einen User"""
        unread = self.messages.exclude(sender=user).exclude(
            read_by=user
        )
        for message in unread:
            message.read_by.add(user)
    
    def get_other_participant(self, user):
        """Bei Direktchat: gibt den anderen Teilnehmer zurück"""
        if self.conversation_type == 'direct':
            participants = self.participants.exclude(id=user.id)
            return participants.first()
        return None


class ChatMessage(models.Model):
    """
    Einzelne Chat-Nachricht
    """
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('file', 'Datei'),
        ('image', 'Bild'),
        ('system', 'Systemnachricht'),
        ('absence_request', 'Abwesenheitsantrag'),
        ('absence_decision', 'Abwesenheitsentscheidung'),
    ]
    
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name='Konversation'
    )
    
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages',
        verbose_name='Absender'
    )
    
    message_type = models.CharField(
        'Nachrichtentyp',
        max_length=20,
        choices=MESSAGE_TYPES,
        default='text'
    )
    
    # Text-Nachricht
    content = models.TextField(
        'Inhalt',
        blank=True
    )
    
    # Datei-Anhang
    file = models.FileField(
        'Datei',
        upload_to='chat/files/%Y/%m/',
        null=True,
        blank=True
    )
    file_name = models.CharField(
        'Dateiname',
        max_length=255,
        blank=True
    )
    file_size = models.BigIntegerField(
        'Dateigröße (Bytes)',
        null=True,
        blank=True
    )
    file_type = models.CharField(
        'MIME-Type',
        max_length=100,
        blank=True
    )
    
    # Thumbnail für Bilder
    thumbnail = models.ImageField(
        'Vorschau',
        upload_to='chat/thumbnails/%Y/%m/',
        null=True,
        blank=True
    )
    
    # Antwort auf andere Nachricht (Threading)
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
        verbose_name='Antwort auf'
    )
    
    # Gelesen-Status (M2M für Gruppenchats)
    read_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='read_messages',
        verbose_name='Gelesen von',
        blank=True
    )
    
    # Reaktionen (Emojis)
    reactions = models.JSONField(
        'Reaktionen',
        default=dict,
        blank=True,
        help_text='{"👍": [user_id1, user_id2], "❤️": [user_id3]}'
    )
    
    # Metadata für spezielle Nachrichtentypen (z.B. Abwesenheitsanträge)
    metadata = models.JSONField(
        'Metadaten',
        default=dict,
        blank=True,
        help_text='Zusätzliche Daten für absence_request, absence_decision, etc.'
    )
    
    # End-to-End Encryption
    is_encrypted = models.BooleanField(
        'Verschlüsselt',
        default=False,
        help_text='Whether this message is end-to-end encrypted'
    )
    
    # Bearbeitung & Löschung
    is_edited = models.BooleanField(
        'Bearbeitet',
        default=False
    )
    edited_at = models.DateTimeField(
        'Bearbeitet am',
        null=True,
        blank=True
    )
    is_deleted = models.BooleanField(
        'Gelöscht',
        default=False
    )
    deleted_at = models.DateTimeField(
        'Gelöscht am',
        null=True,
        blank=True
    )
    
    # Timestamps
    sent_at = models.DateTimeField(
        'Gesendet',
        default=timezone.now,
        db_index=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Chat-Nachricht'
        verbose_name_plural = 'Chat-Nachrichten'
        ordering = ['sent_at']
        indexes = [
            models.Index(fields=['conversation', '-sent_at']),
            models.Index(fields=['sender', '-sent_at']),
            models.Index(fields=['is_deleted']),
        ]
    
    def __str__(self):
        sender_name = self.sender.username if self.sender else 'System'
        preview = self.content[:50] if self.content else f'[{self.get_message_type_display()}]'
        return f"{sender_name}: {preview}"
    
    def mark_as_read_by(self, user):
        """Markiert Nachricht als gelesen"""
        if self.sender != user:
            self.read_by.add(user)
    
    def add_reaction(self, user, emoji):
        """Fügt Emoji-Reaktion hinzu"""
        if emoji not in self.reactions:
            self.reactions[emoji] = []
        if user.id not in self.reactions[emoji]:
            self.reactions[emoji].append(user.id)
            self.save(update_fields=['reactions', 'updated_at'])
    
    def remove_reaction(self, user, emoji):
        """Entfernt Emoji-Reaktion"""
        if emoji in self.reactions and user.id in self.reactions[emoji]:
            self.reactions[emoji].remove(user.id)
            if not self.reactions[emoji]:
                del self.reactions[emoji]
            self.save(update_fields=['reactions', 'updated_at'])
    
    def soft_delete(self):
        """Soft Delete - Nachricht wird nicht wirklich gelöscht"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.content = ''  # Inhalt entfernen
        self.save(update_fields=['is_deleted', 'deleted_at', 'content', 'updated_at'])


class ChatTypingIndicator(models.Model):
    """
    Zeigt an, wer gerade tippt (kurzlebig, für Realtime)
    """
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='typing_indicators'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    started_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Tipp-Indikator'
        verbose_name_plural = 'Tipp-Indikatoren'
        unique_together = ['conversation', 'user']
        indexes = [
            models.Index(fields=['conversation', '-started_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} tippt in {self.conversation}"
    
    def is_recent(self, seconds=5):
        """Prüft ob Indikator noch aktuell ist (< 5 Sekunden alt)"""
        from django.utils import timezone
        age = (timezone.now() - self.started_at).total_seconds()
        return age < seconds


class ChatConversationHidden(models.Model):
    """
    Versteckt/gelöscht eine Konversation für einen spezifischen User
    (WhatsApp-Style: Nur für mich löschen)
    """
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='hidden_for_users'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hidden_conversations'
    )
    hidden_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Versteckte Konversation'
        verbose_name_plural = 'Versteckte Konversationen'
        unique_together = [['conversation', 'user']]
    
    def __str__(self):
        return f"{self.user.username} hat {self.conversation} versteckt"
