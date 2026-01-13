"""
Analytics & Admin Views für Search Learning System
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db.models import Count, Avg, Sum, F, Q
from django.utils import timezone
from datetime import timedelta
import logging

from .search_models import SearchQuery, SearchClick, SearchSynonym
from .profile_serializers import UserProfileListSerializer

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def search_analytics_overview(request):
    """
    Übersicht über Such-Statistiken
    
    GET /api/admin/search-analytics/overview/
    
    Returns:
        {
            "total_searches": 1234,
            "total_clicks": 567,
            "avg_click_rate": 0.46,
            "avg_results_per_query": 4.2,
            "top_queries": [...],
            "trending_queries": [...],
            "zero_result_queries": [...]
        }
    """
    # Zeitfenster
    days = int(request.GET.get('days', 30))
    since = timezone.now() - timedelta(days=days)
    
    # Basis-Statistiken
    queries = SearchQuery.objects.filter(created_at__gte=since)
    total_searches = queries.count()
    total_clicks = SearchClick.objects.filter(created_at__gte=since).count()
    
    avg_results = queries.aggregate(avg=Avg('result_count'))['avg'] or 0
    click_rate = (total_clicks / total_searches) if total_searches > 0 else 0
    
    # Top Queries (nach Häufigkeit)
    top_queries = queries.values('query_text').annotate(
        count=Count('id'),
        avg_score=Avg('avg_score'),
        avg_results=Avg('result_count')
    ).order_by('-count')[:10]
    
    # Trending Queries (letzte 7 Tage vs. vorherige 7 Tage)
    week_ago = timezone.now() - timedelta(days=7)
    two_weeks_ago = timezone.now() - timedelta(days=14)
    
    recent_queries = SearchQuery.objects.filter(
        created_at__gte=week_ago
    ).values('query_text').annotate(count=Count('id'))
    
    previous_queries = SearchQuery.objects.filter(
        created_at__gte=two_weeks_ago,
        created_at__lt=week_ago
    ).values('query_text').annotate(count=Count('id'))
    
    # Berechne Trend (simplified)
    trending = []
    recent_dict = {q['query_text']: q['count'] for q in recent_queries}
    previous_dict = {q['query_text']: q['count'] for q in previous_queries}
    
    for query_text, recent_count in recent_dict.items():
        previous_count = previous_dict.get(query_text, 0)
        if recent_count > previous_count:
            trending.append({
                'query': query_text,
                'recent_count': recent_count,
                'previous_count': previous_count,
                'growth': recent_count - previous_count
            })
    
    trending.sort(key=lambda x: x['growth'], reverse=True)
    
    # Zero-Result Queries
    zero_results = queries.filter(result_count=0).values('query_text').annotate(
        count=Count('id')
    ).order_by('-count')[:10]
    
    return Response({
        'period_days': days,
        'total_searches': total_searches,
        'total_clicks': total_clicks,
        'avg_click_rate': round(click_rate, 3),
        'avg_results_per_query': round(avg_results, 2),
        'top_queries': list(top_queries),
        'trending_queries': trending[:10],
        'zero_result_queries': list(zero_results)
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def search_click_analytics(request):
    """
    Detaillierte Click-Analysen
    
    GET /api/admin/search-analytics/clicks/
    
    Returns:
        {
            "most_clicked_profiles": [...],
            "avg_click_position": 2.3,
            "position_distribution": {...}
        }
    """
    days = int(request.GET.get('days', 30))
    since = timezone.now() - timedelta(days=days)
    
    clicks = SearchClick.objects.filter(created_at__gte=since)
    
    # Meistgeklickte Profile
    most_clicked = clicks.values(
        'clicked_profile_id',
        'clicked_profile__user__first_name',
        'clicked_profile__user__last_name'
    ).annotate(
        click_count=Count('id'),
        avg_position=Avg('position'),
        avg_relevance=Avg('relevance_score'),
        avg_time_on_page=Avg('time_on_page')
    ).order_by('-click_count')[:20]
    
    # Format results
    most_clicked_formatted = []
    for item in most_clicked:
        most_clicked_formatted.append({
            'profile_id': item['clicked_profile_id'],
            'name': f"{item['clicked_profile__user__first_name']} {item['clicked_profile__user__last_name']}",
            'click_count': item['click_count'],
            'avg_position': round(item['avg_position'], 1),
            'avg_relevance': round(item['avg_relevance'], 3),
            'avg_time_on_page': round(item['avg_time_on_page'] or 0, 1)
        })
    
    # Durchschnittliche Click-Position
    avg_position = clicks.aggregate(avg=Avg('position'))['avg'] or 0
    
    # Position-Verteilung
    position_dist = {}
    for i in range(1, 11):
        count = clicks.filter(position=i).count()
        position_dist[f'pos_{i}'] = count
    
    return Response({
        'period_days': days,
        'most_clicked_profiles': most_clicked_formatted,
        'avg_click_position': round(avg_position, 2),
        'position_distribution': position_dist
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def search_quality_metrics(request):
    """
    Such-Qualitäts-Metriken
    
    GET /api/admin/search-analytics/quality/
    
    Returns:
        {
            "queries_with_clicks": 0.65,
            "avg_time_to_click": 3.4,
            "queries_with_low_scores": [...]
        }
    """
    days = int(request.GET.get('days', 30))
    since = timezone.now() - timedelta(days=days)
    
    queries = SearchQuery.objects.filter(created_at__gte=since)
    total_queries = queries.count()
    
    # Queries mit Clicks
    queries_with_clicks = queries.filter(clicks__isnull=False).distinct().count()
    click_through_rate = queries_with_clicks / total_queries if total_queries > 0 else 0
    
    # Queries mit niedrigen Scores (< 0.3)
    low_score_queries = queries.filter(avg_score__lt=0.3).values('query_text').annotate(
        count=Count('id'),
        avg_score=Avg('avg_score')
    ).order_by('-count')[:20]
    
    # Queries ohne Ergebnisse
    no_results = queries.filter(result_count=0).count()
    no_results_rate = no_results / total_queries if total_queries > 0 else 0
    
    return Response({
        'period_days': days,
        'total_queries': total_queries,
        'click_through_rate': round(click_through_rate, 3),
        'no_results_rate': round(no_results_rate, 3),
        'low_score_queries': list(low_score_queries)
    })


@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def synonym_management(request):
    """
    Synonym-Verwaltung für Admins
    
    GET /api/admin/synonyms/ - Liste aller Synonyme
    POST /api/admin/synonyms/ - Neues Synonym erstellen
    PUT /api/admin/synonyms/<id>/ - Synonym aktualisieren
    DELETE /api/admin/synonyms/<id>/ - Synonym löschen
    """
    if request.method == 'GET':
        synonyms_qs = SearchSynonym.objects.all()
        result = []
        for syn in synonyms_qs:
            result.append({
                'id': syn.id,
                'term': syn.term,
                'synonyms_list': syn.get_synonym_list(),
                'weight': syn.weight,
                'scope': syn.scope,
                'is_active': syn.is_active
            })
        return Response(result)
    
    elif request.method == 'POST':
        data = request.data
        try:
            # synonyms_list kommt als Array vom Frontend, muss zu comma-separated string werden
            synonyms_str = ','.join(data['synonyms_list']) if isinstance(data.get('synonyms_list'), list) else data.get('synonyms_list', '')
            
            synonym = SearchSynonym.objects.create(
                term=data['term'],
                synonyms=synonyms_str,
                weight=data.get('weight', 1.0),
                scope=data.get('scope', 'global'),
                is_active=data.get('is_active', True)
            )
            return Response({
                'id': synonym.id,
                'term': synonym.term,
                'synonyms_list': synonym.get_synonym_list()
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'PUT':
        synonym_id = request.data.get('id')
        try:
            synonym = SearchSynonym.objects.get(pk=synonym_id)
            synonym.term = request.data.get('term', synonym.term)
            
            # Update synonyms wenn vorhanden
            if 'synonyms_list' in request.data:
                synonyms_str = ','.join(request.data['synonyms_list']) if isinstance(request.data['synonyms_list'], list) else request.data['synonyms_list']
                synonym.synonyms = synonyms_str
            
            synonym.weight = request.data.get('weight', synonym.weight)
            synonym.scope = request.data.get('scope', synonym.scope)
            synonym.is_active = request.data.get('is_active', synonym.is_active)
            synonym.save()
            return Response({'success': True})
        except SearchSynonym.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    elif request.method == 'DELETE':
        synonym_id = request.data.get('id')
        try:
            synonym = SearchSynonym.objects.get(pk=synonym_id)
            synonym.delete()
            return Response({'success': True})
        except SearchSynonym.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAdminUser])
def query_history(request):
    """
    Such-Historie abrufen oder löschen
    
    GET /api/admin/search-analytics/history/?limit=50
    DELETE /api/admin/search-analytics/history/ - Löscht Query und alle zugehörigen Klicks
    Body: {"id": 123}
    
    Returns: Liste der letzten N Queries mit Details
    """
    if request.method == 'DELETE':
        query_id = request.data.get('id')
        if not query_id:
            return Response({'error': 'id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            query = SearchQuery.objects.get(pk=query_id)
            # Klicks werden durch CASCADE automatisch gelöscht
            query_text = query.query_text
            query.delete()
            logger.info(f"✅ Query deleted by admin: '{query_text}' (ID: {query_id})")
            return Response({'success': True})
        except SearchQuery.DoesNotExist:
            return Response({'error': 'Query not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # GET
    limit = int(request.GET.get('limit', 50))
    
    queries = SearchQuery.objects.select_related('user').prefetch_related(
        'clicks__clicked_profile__user'
    ).all()[:limit]
    
    results = []
    for q in queries:
        clicks = q.clicks.all()
        click_count = clicks.count()
        
        # Liste der angeklickten Profile
        clicked_profiles = []
        for click in clicks:
            clicked_profiles.append({
                'name': click.clicked_profile.user.get_full_name(),
                'position': click.position,
                'relevance': round(click.relevance_score, 3)
            })
        
        results.append({
            'id': q.id,
            'query_text': q.query_text,
            'user': q.user.get_full_name() if q.user else 'Anonym',
            'result_count': q.result_count,
            'avg_score': round(q.avg_score, 3) if q.avg_score else 0.0,
            'click_count': click_count,
            'clicked_profiles': clicked_profiles,  # NEU!
            'created_at': q.created_at.isoformat()
        })
    
    return Response(results)


@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def profile_mapping_management(request):
    """
    Manuelle Profil-Zuordnungen zu Suchbegriffen
    
    GET /api/admin/profile-mappings/ - Liste aller Zuordnungen
    POST /api/admin/profile-mappings/ - Neue Zuordnung erstellen
    PUT /api/admin/profile-mappings/ - Zuordnung aktualisieren
    DELETE /api/admin/profile-mappings/ - Zuordnung löschen
    """
    from .search_models import SearchProfileMapping
    from .profile_models import UserProfile
    
    if request.method == 'GET':
        mappings = SearchProfileMapping.objects.select_related(
            'profile__user', 'created_by'
        ).all()
        
        results = []
        for m in mappings:
            results.append({
                'id': m.id,
                'query_term': m.query_term,
                'profile_id': m.profile.pk,
                'profile_name': m.profile.user.get_full_name(),
                'boost_score': m.boost_score,
                'priority': m.priority,
                'notes': m.notes,
                'is_active': m.is_active,
                'created_by': m.created_by.get_full_name() if m.created_by else None,
                'created_at': m.created_at.isoformat()
            })
        
        return Response(results)
    
    elif request.method == 'POST':
        try:
            profile = UserProfile.objects.get(pk=request.data['profile_id'])
            
            mapping = SearchProfileMapping.objects.create(
                query_term=request.data['query_term'],
                profile=profile,
                boost_score=request.data.get('boost_score', 0.3),
                priority=request.data.get('priority', 1),
                notes=request.data.get('notes', ''),
                is_active=request.data.get('is_active', True),
                created_by=request.user
            )
            
            return Response({
                'id': mapping.id,
                'query_term': mapping.query_term,
                'profile_name': profile.user.get_full_name()
            }, status=status.HTTP_201_CREATED)
        
        except UserProfile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'PUT':
        try:
            mapping = SearchProfileMapping.objects.get(pk=request.data['id'])
            
            if 'query_term' in request.data:
                mapping.query_term = request.data['query_term']
            if 'profile_id' in request.data:
                mapping.profile = UserProfile.objects.get(pk=request.data['profile_id'])
            if 'boost_score' in request.data:
                mapping.boost_score = request.data['boost_score']
            if 'priority' in request.data:
                mapping.priority = request.data['priority']
            if 'notes' in request.data:
                mapping.notes = request.data['notes']
            if 'is_active' in request.data:
                mapping.is_active = request.data['is_active']
            
            mapping.save()
            return Response({'success': True})
        
        except SearchProfileMapping.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    elif request.method == 'DELETE':
        try:
            mapping = SearchProfileMapping.objects.get(pk=request.data['id'])
            mapping.delete()
            return Response({'success': True})
        except SearchProfileMapping.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def track_search_click(request):
    """
    Tracked einen Klick auf ein Suchergebnis für das Learning-System
    
    POST /api/search/track-click/
    Body: {
        "query": "manager",
        "profile_id": 2,
        "position": 1,
        "score": 0.95
    }
    """
    query_text = request.data.get('query', '').strip()
    profile_id = request.data.get('profile_id')
    position = request.data.get('position', 0)
    score = request.data.get('score', 0.0)
    
    if not query_text or not profile_id:
        return Response(
            {'error': 'query and profile_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        from .models import UserProfile
        
        # Hole oder erstelle SearchQuery (nimm die neueste Query innerhalb von 5 Min)
        recent_queries = SearchQuery.objects.filter(
            user=request.user,
            query_text=query_text,
            created_at__gte=timezone.now() - timedelta(minutes=5)
        ).order_by('-created_at')
        
        if recent_queries.exists():
            search_query = recent_queries.first()
        else:
            search_query = SearchQuery.objects.create(
                user=request.user,
                query_text=query_text,
                result_count=0,
                avg_score=score
            )
        
        # Erstelle SearchClick
        # profile_id kann User-ID oder UserProfile-ID sein - versuche beides
        try:
            profile = UserProfile.objects.get(user_id=profile_id)
        except UserProfile.DoesNotExist:
            try:
                profile = UserProfile.objects.get(pk=profile_id)
            except UserProfile.DoesNotExist:
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Verhindere Duplikate: max 1 Klick pro Query+Profile
        click, created = SearchClick.objects.get_or_create(
            search_query=search_query,
            clicked_profile=profile,
            defaults={
                'position': position,
                'relevance_score': score
            }
        )
        
        # Markiere Query als "hat Klick"
        if not search_query.has_click:
            search_query.has_click = True
            search_query.save(update_fields=['has_click'])
        
        logger.info(f"✅ Search click tracked: '{query_text}' → {profile.user.get_full_name()} (pos={position}, score={score:.3f})")
        
        return Response({
            'success': True,
            'created': created,
            'click_id': click.id
        })
        
    except UserProfile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Click tracking failed: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
