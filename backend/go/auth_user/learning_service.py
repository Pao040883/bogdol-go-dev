"""
Machine Learning Service für Click-basiertes Re-Ranking und Personalisierung
"""
import logging
from typing import List, Dict, Optional
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Avg, Q

logger = logging.getLogger(__name__)


def calculate_click_boost(profile_id: int, query_text: str) -> float:
    """
    Berechnet Boost basierend auf Click-History
    
    Args:
        profile_id: ID des Profils
        query_text: Such-Query
        
    Returns:
        Boost-Wert (0.0 - 0.3)
    """
    from .search_models import SearchClick, SearchQuery
    
    # Prüfe wie oft dieses Profil bei ähnlichen Queries geklickt wurde
    # Zeitfenster: letzte 90 Tage
    cutoff_date = timezone.now() - timedelta(days=90)
    
    # Exakte Query-Matches
    exact_clicks = SearchClick.objects.filter(
        search_query__query_text__iexact=query_text,
        clicked_profile_id=profile_id,
        search_query__created_at__gte=cutoff_date
    ).count()
    
    # Ähnliche Queries (enthält Query-Wörter)
    query_words = set(query_text.lower().split())
    if len(query_words) >= 2:
        similar_clicks = SearchClick.objects.filter(
            clicked_profile_id=profile_id,
            search_query__created_at__gte=cutoff_date
        ).annotate(
            query_lower=Q(search_query__query_text__icontains=list(query_words)[0])
        ).count()
    else:
        similar_clicks = 0
    
    # Berechne Boost
    # - Exakte Query: 0.05 pro Click (max 0.25)
    # - Ähnliche Query: 0.01 pro Click (max 0.05)
    exact_boost = min(exact_clicks * 0.05, 0.25)
    similar_boost = min(similar_clicks * 0.01, 0.05)
    
    total_boost = exact_boost + similar_boost
    
    if total_boost > 0:
        logger.debug(f"Profile {profile_id} click boost: {total_boost:.3f} (exact: {exact_clicks}, similar: {similar_clicks})")
    
    return min(total_boost, 0.3)  # Max 30% Boost


def calculate_position_penalty(clicked_position: int, relevance_score: float) -> float:
    """
    Berechnet Penalty wenn niedrig gerankte Ergebnisse geklickt werden
    
    Wenn User Position 5 klickt obwohl Score niedrig war,
    deutet das auf schlechtes Ranking hin.
    
    Args:
        clicked_position: Position des geklickten Ergebnisses (1-based)
        relevance_score: Original Relevanz-Score
        
    Returns:
        Penalty-Wert (negativ oder 0)
    """
    # Wenn niedrige Position (>3) aber niedriger Score (<0.3) geklickt wurde
    # → Ranking war zu niedrig
    if clicked_position > 3 and relevance_score < 0.3:
        # Je niedriger der Score war, desto größer die Korrektur
        correction = (0.3 - relevance_score) * 0.5  # Max +15% Boost
        return correction
    
    return 0.0


def calculate_personalization_boost(searcher_profile_id: int, found_profile_id: int) -> float:
    """
    Berechnet Personalisierungs-Boost basierend auf Beziehung zwischen Suchenden und Gefundenem
    
    Args:
        searcher_profile_id: ID des suchenden Users
        found_profile_id: ID des gefundenen Profils
        
    Returns:
        Boost-Wert (0.0 - 0.25)
    """
    from .profile_models import UserProfile
    
    try:
        searcher = UserProfile.objects.get(pk=searcher_profile_id)
        found = UserProfile.objects.get(pk=found_profile_id)
    except UserProfile.DoesNotExist:
        return 0.0
    
    boost = 0.0
    
    # BOOST 1: Gleiche primäre Abteilung (+10%)
    searcher_dept = searcher.primary_department
    found_dept = found.primary_department
    if searcher_dept and found_dept and searcher_dept.id == found_dept.id:
        boost += 0.10
        logger.debug(f"Same department boost: +0.10")
    
    # BOOST 2: Direkter Vorgesetzter (+15%)
    if searcher.direct_supervisor and searcher.direct_supervisor.id == found.user.id:
        boost += 0.15
        logger.debug(f"Direct supervisor boost: +0.15")
    
    # BOOST 3: Direkter Untergebener (+12%)
    if found.direct_supervisor and found.direct_supervisor.id == searcher.user.id:
        boost += 0.12
        logger.debug(f"Direct report boost: +0.12")
    
    # BOOST 4: Gleicher Standort (+5%)
    if (searcher.office_location and found.office_location and 
        searcher.office_location.lower() == found.office_location.lower()):
        boost += 0.05
        logger.debug(f"Same location boost: +0.05")
    
    # BOOST 5: Gleiche Teams (+8%)
    searcher_teams = set(searcher.user.teams.filter(is_active=True).values_list('id', flat=True))
    found_teams = set(found.user.teams.filter(is_active=True).values_list('id', flat=True))
    if searcher_teams & found_teams:  # Intersection
        boost += 0.08
        logger.debug(f"Shared teams boost: +0.08")
    
    return min(boost, 0.25)  # Max 25% Personalisierungs-Boost


def calculate_temporal_boost(profile_id: int) -> float:
    """
    Berechnet Boost für kürzlich aktive/gesuchte Profile
    
    Args:
        profile_id: ID des Profils
        
    Returns:
        Boost-Wert (0.0 - 0.10)
    """
    from .search_models import SearchClick
    
    # Profile die in letzten 7 Tagen oft geklickt wurden → "Trending"
    week_ago = timezone.now() - timedelta(days=7)
    recent_clicks = SearchClick.objects.filter(
        clicked_profile_id=profile_id,
        created_at__gte=week_ago
    ).count()
    
    # 1 Click = +2% Boost (max 10%)
    boost = min(recent_clicks * 0.02, 0.10)
    
    if boost > 0:
        logger.debug(f"Profile {profile_id} temporal boost: {boost:.3f} ({recent_clicks} recent clicks)")
    
    return boost


def apply_learning_boosts(results: List[Dict], searcher_user=None, query_text: str = "") -> List[Dict]:
    """
    Wendet alle Learning-Boosts auf Suchergebnisse an
    
    Args:
        results: Liste von Suchergebnissen
        searcher_user: User der die Suche durchführt
        query_text: Such-Query
        
    Returns:
        Modifizierte Ergebnisse mit angepassten Scores (inkl. Profile aus manuellen Mappings!)
    """
    # NICHT früh returnen - manuelle Mappings können Profile hinzufügen!
    if results is None:
        results = []
    
    searcher_profile_id = searcher_user.profile.pk if searcher_user and hasattr(searcher_user, 'profile') else None
    
    # MANUELLE MAPPINGS: Prüfe ob Admin manuelle Zuordnungen erstellt hat
    manual_boosts = {}
    if query_text:
        from .search_models import SearchProfileMapping
        
        logger.info(f"Checking manual mappings for query: '{query_text}'")
        
        # Exakte und Partial Matches
        mappings = SearchProfileMapping.objects.filter(
            is_active=True
        ).filter(
            query_term__icontains=query_text
        ).select_related('profile')
        
        logger.info(f"Found {mappings.count()} active mappings")
        
        for mapping in mappings:
            # Exakter Match = voller Boost, Partial Match = reduzierter Boost
            if mapping.query_term.lower() == query_text.lower():
                boost_multiplier = 1.0
            else:
                # Partial Match: Boost proportional zur Übereinstimmung
                boost_multiplier = len(query_text) / len(mapping.query_term) if len(mapping.query_term) > 0 else 0.5
            
            profile_id = mapping.profile.pk
            current_boost = manual_boosts.get(profile_id, 0)
            new_boost = mapping.boost_score * boost_multiplier
            
            # Nehme höchsten Boost wenn mehrere Mappings existieren
            if new_boost > current_boost:
                manual_boosts[profile_id] = new_boost
                logger.info(
                    f"Manual mapping: '{mapping.query_term}' → {mapping.profile.user.get_full_name()} "
                    f"(+{new_boost:.3f}, multiplier: {boost_multiplier:.2f})"
                )
    
    # CLICK-LEARNING: Finde Profile mit Click-History für diese Query
    learned_profiles = {}
    if query_text:
        from .search_models import SearchClick, SearchQuery
        
        # Zeitfenster: letzte 90 Tage
        cutoff_date = timezone.now() - timedelta(days=90)
        
        # Finde alle Profile mit Klicks auf exakte Query
        clicks = SearchClick.objects.filter(
            search_query__query_text__iexact=query_text,
            search_query__created_at__gte=cutoff_date
        ).values('clicked_profile_id').annotate(
            click_count=Count('id')
        ).filter(click_count__gte=1)  # Mindestens 1 Klick
        
        for click_data in clicks:
            profile_id = click_data['clicked_profile_id']
            click_count = click_data['click_count']
            
            # Berechne Boost: 0.15 pro Klick (deutlicher als vorher 0.05)
            click_boost = min(click_count * 0.15, 0.5)  # Max 50% Boost
            learned_profiles[profile_id] = click_boost
            
            logger.info(f"Click-learned profile: ID {profile_id} (+{click_boost:.3f} from {click_count} clicks)")
    
    # WICHTIG: Füge Profile mit manuellen Mappings ODER Click-Learning hinzu, auch wenn nicht in results!
    existing_profile_ids = {r['profile'].pk for r in results}
    
    # Manuelle Mappings hinzufügen
    if manual_boosts:
        for profile_id, boost in manual_boosts.items():
            if profile_id not in existing_profile_ids:
                from .models import UserProfile
                try:
                    profile = UserProfile.objects.get(pk=profile_id)
                    results.append({
                        'profile': profile,
                        'score': boost,
                        'original_score': 0.0,
                        'manual_boost': boost,
                        'matched_fields': [('Manuelle Zuordnung', 'Admin-definiert')],
                        'added_by_manual_mapping': True
                    })
                    existing_profile_ids.add(profile_id)
                    logger.info(f"✨ Added by manual mapping: {profile.user.get_full_name()} (score={boost:.3f})")
                except UserProfile.DoesNotExist:
                    pass
    
    # Click-gelernte Profile hinzufügen
    if learned_profiles:
        for profile_id, boost in learned_profiles.items():
            if profile_id not in existing_profile_ids and boost >= 0.15:  # Mindestens 1 Klick
                from .models import UserProfile
                try:
                    profile = UserProfile.objects.get(pk=profile_id)
                    results.append({
                        'profile': profile,
                        'score': boost,
                        'original_score': 0.0,
                        'click_boost': boost,
                        'matched_fields': [('Click-Learning', f'{int(boost/0.15)} Klick(s)')],
                        'added_by_click_learning': True
                    })
                    existing_profile_ids.add(profile_id)
                    logger.info(f"✨ Added by click-learning: {profile.user.get_full_name()} (score={boost:.3f})")
                except UserProfile.DoesNotExist:
                    pass
    
    for result in results:
        profile = result['profile']
        original_score = result['score']
        
        total_boost = 0.0
        
        # BOOST 0: Manuelle Admin-Zuordnung (höchste Priorität!)
        manual_boost = manual_boosts.get(profile.pk, 0.0)
        if manual_boost > 0:
            total_boost += manual_boost
        
        # BOOST 1: Click-basiertes Re-Ranking
        if query_text:
            click_boost = calculate_click_boost(profile.pk, query_text)
            total_boost += click_boost
        
        # BOOST 2: Personalisierung
        if searcher_profile_id:
            person_boost = calculate_personalization_boost(searcher_profile_id, profile.pk)
            total_boost += person_boost
        
        # BOOST 3: Temporal (Trending)
        temporal_boost = calculate_temporal_boost(profile.pk)
        total_boost += temporal_boost
        
        # Wende Boost an (max Score = 1.0)
        result['score'] = min(original_score + total_boost, 1.0)
        result['original_score'] = original_score
        result['learning_boost'] = total_boost
        result['manual_boost'] = manual_boost
        
        if total_boost > 0:
            boost_details = []
            if manual_boost > 0:
                boost_details.append(f"manual: +{manual_boost:.3f}")
            if total_boost > manual_boost:
                boost_details.append(f"other: +{total_boost - manual_boost:.3f}")
            
            logger.info(
                f"Profile {profile.user.get_full_name()}: "
                f"{original_score:.3f} → {result['score']:.3f} ({', '.join(boost_details)})"
            )
    
    # Re-sort nach neuen Scores
    results.sort(key=lambda x: x['score'], reverse=True)
    
    return results


def get_query_suggestions(partial_query: str, limit: int = 5) -> List[str]:
    """
    Gibt Auto-Complete Vorschläge basierend auf häufigen Queries
    
    Args:
        partial_query: Teil-String der Query
        limit: Anzahl der Vorschläge
        
    Returns:
        Liste von vorgeschlagenen Queries
    """
    from .search_models import SearchQuery
    
    if len(partial_query) < 2:
        return []
    
    # Finde häufigste Queries die mit partial_query beginnen
    # Zeitfenster: letzte 90 Tage
    cutoff_date = timezone.now() - timedelta(days=90)
    
    suggestions = SearchQuery.objects.filter(
        query_text__istartswith=partial_query,
        created_at__gte=cutoff_date
    ).values('query_text').annotate(
        count=Count('id'),
        avg_results=Avg('result_count')
    ).filter(
        avg_results__gt=0  # Nur Queries die Ergebnisse lieferten
    ).order_by('-count')[:limit]
    
    return [s['query_text'] for s in suggestions]


def get_related_queries(query_text: str, limit: int = 5) -> List[str]:
    """
    Findet verwandte Queries ("User die X suchten, suchten auch Y")
    
    Args:
        query_text: Aktuelle Query
        limit: Anzahl der Vorschläge
        
    Returns:
        Liste verwandter Queries
    """
    from .search_models import SearchQuery
    
    # Finde User die diese Query nutzten
    cutoff_date = timezone.now() - timedelta(days=90)
    
    users_with_query = SearchQuery.objects.filter(
        query_text__iexact=query_text,
        created_at__gte=cutoff_date,
        user__isnull=False
    ).values_list('user_id', flat=True).distinct()
    
    if not users_with_query:
        return []
    
    # Finde andere Queries dieser User
    related = SearchQuery.objects.filter(
        user_id__in=list(users_with_query),
        created_at__gte=cutoff_date
    ).exclude(
        query_text__iexact=query_text
    ).values('query_text').annotate(
        count=Count('id')
    ).order_by('-count')[:limit]
    
    return [r['query_text'] for r in related]
