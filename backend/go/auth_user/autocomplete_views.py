"""
Auto-Complete API für Suche
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

from .learning_service import get_query_suggestions, get_related_queries

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def query_autocomplete(request):
    """
    Auto-Complete für Such-Queries
    
    GET /api/search/autocomplete/?q=blin
    
    Returns:
        {
            "suggestions": ["blink", "blink integration", "blinker"],
            "query": "blin"
        }
    """
    query = request.GET.get('q', '').strip()
    
    if len(query) < 2:
        return Response({
            'suggestions': [],
            'query': query
        })
    
    try:
        suggestions = get_query_suggestions(query, limit=8)
        
        return Response({
            'suggestions': suggestions,
            'query': query
        })
    except Exception as e:
        logger.error(f"Autocomplete error: {e}", exc_info=True)
        return Response(
            {'error': 'Autocomplete failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def related_queries(request):
    """
    Verwandte Such-Queries
    
    GET /api/search/related/?q=drucker
    
    Returns:
        {
            "related": ["scanner", "kopierer", "it support"],
            "query": "drucker"
        }
    """
    query = request.GET.get('q', '').strip()
    
    if not query:
        return Response({
            'related': [],
            'query': query
        })
    
    try:
        related = get_related_queries(query, limit=5)
        
        return Response({
            'related': related,
            'query': query
        })
    except Exception as e:
        logger.error(f"Related queries error: {e}", exc_info=True)
        return Response(
            {'error': 'Related queries failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
