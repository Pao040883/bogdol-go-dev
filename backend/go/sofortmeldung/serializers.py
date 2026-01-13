# serializers.py
from rest_framework import serializers
from .models import Sofortmeldung

class SofortmeldungSerializer(serializers.ModelSerializer):
    createdBy = serializers.ReadOnlyField(source='createdBy.username')
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Sofortmeldung
        fields = '__all__'
        
    def get_status_display(self, obj):
        """Gibt eine benutzerfreundliche Status-Beschreibung zurück"""
        if obj.status and obj.tan:
            return 'Erfolgreich übermittelt'
        elif not obj.status and obj.tan:
            return 'Übermittlung fehlgeschlagen'
        elif not obj.status and not obj.tan:
            return 'Ausstehend'
        else:
            return 'Unbekannt'
    
    def validate_insurance_number(self, value):
        """Validiert die Sozialversicherungsnummer"""
        if value and len(value) != 12:
            raise serializers.ValidationError(
                "Sozialversicherungsnummer muss 12 Zeichen lang sein"
            )
        return value
    
    def validate_group(self, value):
        """Validiert den Personengruppenschlüssel"""
        if value and (value < 100 or value > 999):
            raise serializers.ValidationError(
                "Personengruppenschlüssel muss zwischen 100 und 999 liegen"
            )
        return value
    
    def validate_citizenship(self, value):
        """Validiert die Staatsangehörigkeit"""
        if value and (value < 0 or value > 999):
            raise serializers.ValidationError(
                "Staatsangehörigkeit muss zwischen 0 und 999 liegen"
            )
        return value

class SofortmeldungCreateSerializer(SofortmeldungSerializer):
    """Serializer für das Erstellen von Sofortmeldungen"""
    
    class Meta(SofortmeldungSerializer.Meta):
        read_only_fields = ('createdAt', 'createdBy', 'status', 'tan', 'url')

class SofortmeldungListSerializer(serializers.ModelSerializer):
    """Vereinfachter Serializer für Listen-Ansichten"""
    createdBy = serializers.ReadOnlyField(source='createdBy.username')
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Sofortmeldung
        fields = [
            'id', 'first_name', 'last_name', 'start_date', 
            'status', 'status_display', 'tan', 'createdAt', 'createdBy'
        ]
        
    def get_status_display(self, obj):
        """Gibt eine benutzerfreundliche Status-Beschreibung zurück"""
        if obj.status and obj.tan:
            return 'Erfolgreich'
        elif not obj.status and obj.tan:
            return 'Fehlgeschlagen'
        elif not obj.status and not obj.tan:
            return 'Ausstehend'
        else:
            return 'Unbekannt'
