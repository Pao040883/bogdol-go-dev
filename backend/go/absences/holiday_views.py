"""
API View für Feiertage
"""
from rest_framework.views import APIView
from rest_framework import permissions
from django.http import JsonResponse
from django.utils import timezone


class PublicHolidaysView(APIView):
    """
    API-Endpoint für deutsche Feiertage (Hamburg)
    GET /api/absences/api/public-holidays/?year=2025
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from .signals import get_german_holidays
        
        year = request.query_params.get('year')
        if year:
            try:
                year = int(year)
            except ValueError:
                return JsonResponse({'error': 'Invalid year parameter'}, status=400)
        else:
            year = timezone.now().year
        
        holidays = get_german_holidays(year)
        
        # Konvertiere zu JSON-serialisierbarem Format
        holidays_data = [
            {
                'date': holiday_date.isoformat(),
                'name': holiday_name,
                'year': year
            }
            for holiday_date, holiday_name in holidays
        ]
        
        return JsonResponse({
            'year': year,
            'holidays': holidays_data,
            'count': len(holidays_data)
        })
