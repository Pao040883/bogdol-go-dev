"""
Admin-Interface für Search-Tracking Models
"""
from django.contrib import admin
from .search_models import SearchQuery, SearchClick, SearchSynonym


@admin.register(SearchQuery)
class SearchQueryAdmin(admin.ModelAdmin):
    list_display = ['query_text', 'user', 'result_count', 'avg_score', 'has_click', 'created_at']
    list_filter = ['has_click', 'created_at', 'user']
    search_fields = ['query_text', 'user__username', 'user__email']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(SearchClick)
class SearchClickAdmin(admin.ModelAdmin):
    list_display = ['search_query', 'clicked_profile', 'position', 'relevance_score', 'time_on_page', 'created_at']
    list_filter = ['position', 'created_at']
    search_fields = ['search_query__query_text', 'clicked_profile__user__username']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'search_query', 
            'clicked_profile__user'
        )


@admin.register(SearchSynonym)
class SearchSynonymAdmin(admin.ModelAdmin):
    list_display = ['term', 'synonyms', 'weight', 'scope', 'is_auto_generated', 'is_active']
    list_filter = ['is_auto_generated', 'is_active', 'scope']
    search_fields = ['term', 'synonyms']
    list_editable = ['weight', 'is_active']
    
    actions = ['activate_synonyms', 'deactivate_synonyms']
    
    def activate_synonyms(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} Synonyme aktiviert')
    activate_synonyms.short_description = 'Ausgewählte Synonyme aktivieren'
    
    def deactivate_synonyms(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} Synonyme deaktiviert')
    deactivate_synonyms.short_description = 'Ausgewählte Synonyme deaktivieren'
