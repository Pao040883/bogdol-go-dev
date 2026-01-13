"""
KI-Embedding Service für semantische Suche mit Fuzzy Matching & Learning
Generiert Vektor-Embeddings aus User-Profil-Feldern
"""
import json
import os
from typing import List, Optional, Dict, Tuple, Set
from abc import ABC, abstractmethod
from functools import lru_cache
import logging

from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from rapidfuzz import fuzz, process
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False
    logger.warning("rapidfuzz not installed - fuzzy matching disabled")


# ============================================================================
# ABSTRACT BASE CLASS
# ============================================================================

class EmbeddingProvider(ABC):
    """
    Abstract Base Class für verschiedene Embedding-Provider
    Subklassen implementieren: generate() und search()
    """
    
    @abstractmethod
    def generate(self, text: str) -> Optional[List[float]]:
        """
        Generiert Embedding-Vektor aus Text
        
        Args:
            text: Text zum Embedding
            
        Returns:
            List[float]: Embedding-Vektor (z.B. 384 oder 768 dims)
        """
        pass
    
    @abstractmethod
    def search(self, query_vector: List[float], corpus_vectors: List[List[float]],
               top_k: int = 5) -> List[Tuple[int, float]]:
        """
        Sucht Top-K ähnlichste Vektoren in Corpus
        
        Args:
            query_vector: Query-Embedding
            corpus_vectors: Liste von Corpus-Embeddings
            top_k: Anzahl der Top-Ergebnisse
            
        Returns:
            List[Tuple[int, float]]: List of (index, similarity_score)
        """
        pass
    
    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Berechnet Cosine Similarity zwischen zwei Vektoren"""
        if not vec1 or not vec2:
            return 0.0
        
        if not HAS_NUMPY:
            # Fallback ohne numpy
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            norm1 = sum(a * a for a in vec1) ** 0.5
            norm2 = sum(b * b for b in vec2) ** 0.5
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return float(dot_product / (norm1 * norm2))
        
        # Mit numpy
        a = np.array(vec1)
        b = np.array(vec2)
        
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# ============================================================================
# PROVIDER: SENTENCE TRANSFORMERS (LOKAL)
# ============================================================================

@lru_cache(maxsize=1)
def _get_sentence_transformer_model(model_name: str = "all-MiniLM-L6-v2"):
    """
    Gecachte Funktion zum Laden des SentenceTransformer Models.
    Model wird nur einmal geladen und dann wiederverwendet.
    """
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(model_name)
        logger.info(f"✅ SentenceTransformers MODEL GELADEN (cached): {model_name}")
        return model
    except ImportError:
        raise ImportError(
            "sentence-transformers nicht installiert!\n"
            "Installiere: pip install sentence-transformers"
        )

class SentenceTransformersProvider(EmbeddingProvider):
    """
    Provider mit Sentence Transformers - lokal, keine API nötig!
    Modell: all-MiniLM-L6-v2 (384 dims) oder all-mpnet-base-v2 (768 dims)
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialisiere Sentence Transformer
        
        Args:
            model_name: HuggingFace Modell-Name (default: schnell, 384 dims)
        """
        self.model = _get_sentence_transformer_model(model_name)
        self.model_name = model_name
        logger.info(f"✅ SentenceTransformers Provider bereit: {model_name}")
    
    def generate(self, text: str) -> Optional[List[float]]:
        """Generiert Embedding mit Sentence Transformers"""
        if not text or not isinstance(text, str):
            return None
        
        try:
            # Text bereinigen
            text = text.strip()[:512]  # Max 512 Zeichen
            if not text:
                return None
            
            # Embedding generieren
            embedding = self.model.encode(text, convert_to_numpy=False)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding-Fehler: {e}")
            return None
    
    def search(self, query_vector: List[float], corpus_vectors: List[List[float]],
               top_k: int = 5) -> List[Tuple[int, float]]:
        """Cosine Similarity Search"""
        if not query_vector or not corpus_vectors:
            return []
        
        scores = []
        for idx, vec in enumerate(corpus_vectors):
            if vec:  # Skip None/empty vectors
                similarity = self.cosine_similarity(query_vector, vec)
                scores.append((idx, similarity))
        
        # Sort by similarity (descending) und return top-k
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]


# ============================================================================
# PROVIDER: OLLAMA (Local LLM)
# ============================================================================

class OllamaProvider(EmbeddingProvider):
    """
    Provider mit Ollama (lokal, offline, kostenfrei)
    Nutzt lokale LLM-Modelle für Embeddings
    """
    
    def __init__(self, base_url: str = "http://localhost:11434", 
                 model: str = "nomic-embed-text"):
        """
        Initialisiere Ollama Client
        
        Args:
            base_url: Ollama API URL
            model: Model name (default: nomic-embed-text)
        """
        self.base_url = base_url
        self.model = model
        self.available = self._check_connectivity()
        
        if self.available:
            logger.info(f"✅ Ollama verbunden: {model}")
        else:
            logger.warning(f"⚠️  Ollama nicht erreichbar unter {base_url}")
    
    def _check_connectivity(self) -> bool:
        """Prüft ob Ollama erreichbar ist"""
        try:
            import requests
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def generate(self, text: str) -> Optional[List[float]]:
        """Generiert Embedding mit Ollama"""
        if not self.available or not text:
            return None
        
        try:
            import requests
            
            response = requests.post(
                f"{self.base_url}/api/embed",
                json={
                    "model": self.model,
                    "input": text[:512]
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data['embeddings'][0] if data.get('embeddings') else None
            else:
                logger.error(f"Ollama API Error: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Ollama Embedding-Fehler: {e}")
            return None
    
    def search(self, query_vector: List[float], corpus_vectors: List[List[float]],
               top_k: int = 5) -> List[Tuple[int, float]]:
        """Cosine Similarity Search"""
        return super().search(query_vector, corpus_vectors, top_k)


# ============================================================================
# PROVIDER: OPENAI (Online, kostenpflichtig)
# ============================================================================

class OpenAIProvider(EmbeddingProvider):
    """
    Provider mit OpenAI Embeddings API (Text-embedding-3-small)
    Braucht OPENAI_API_KEY in Umgebung
    """
    
    def __init__(self, model: str = "text-embedding-3-small"):
        """
        Initialisiere OpenAI Client
        
        Args:
            model: Model name (default: text-embedding-3-small)
        """
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY nicht gesetzt!")
        
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=api_key)
            self.model = model
            logger.info(f"✅ OpenAI Client initialisiert: {model}")
        except ImportError:
            raise ImportError("openai nicht installiert! pip install openai")
    
    def generate(self, text: str) -> Optional[List[float]]:
        """Generiert Embedding mit OpenAI"""
        if not text:
            return None
        
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text[:2000]
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI Embedding-Fehler: {e}")
            return None
    
    def search(self, query_vector: List[float], corpus_vectors: List[List[float]],
               top_k: int = 5) -> List[Tuple[int, float]]:
        """Cosine Similarity Search"""
        return super().search(query_vector, corpus_vectors, top_k)


# ============================================================================
# EMBEDDING MANAGER (Singleton)
# ============================================================================

class EmbeddingManager:
    """
    Zentraler Manager für Embedding-Operationen
    Verwaltet Provider und cacht Embeddings
    """
    
    _instance = None
    _provider = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._load_provider()
    
    def _load_provider(self):
        """Wählt Provider basierend auf Settings"""
        embedding_config = getattr(settings, 'EMBEDDING_CONFIG', {})
        provider_type = embedding_config.get('provider', 'sentence_transformers')
        
        try:
            if provider_type == 'sentence_transformers':
                model = embedding_config.get('model', 'all-MiniLM-L6-v2')
                self._provider = SentenceTransformersProvider(model)
            
            elif provider_type == 'ollama':
                base_url = embedding_config.get('base_url', 'http://localhost:11434')
                model = embedding_config.get('model', 'nomic-embed-text')
                self._provider = OllamaProvider(base_url, model)
            
            elif provider_type == 'openai':
                model = embedding_config.get('model', 'text-embedding-3-small')
                self._provider = OpenAIProvider(model)
            
            else:
                raise ValueError(f"Unbekannter Provider: {provider_type}")
            
            logger.info(f"✅ Embedding-Provider geladen: {provider_type}")
        
        except Exception as e:
            logger.error(f"❌ Fehler beim Laden des Embedding-Providers: {e}")
            # Fallback: Dummy-Provider
            self._provider = None
    
    def is_available(self) -> bool:
        """Prüft ob Provider verfügbar ist"""
        return self._provider is not None
    
    def generate(self, text: str) -> Optional[List[float]]:
        """
        Generiert Embedding für Text
        
        Args:
            text: Text zum Embedding
            
        Returns:
            List[float] oder None
        """
        if not self.is_available():
            logger.warning("Embedding-Provider nicht verfügbar")
            return None
        
        return self._provider.generate(text)
    
    def search_profiles(self, query: str, top_k: int = 5):
        """
        Sucht nach ähnlichen User-Profilen
        
        Args:
            query: Such-Query (wird zu Embedding konvertiert)
            top_k: Anzahl der Ergebnisse
            
        Returns:
            QuerySet mit Top-K Profilen
        """
        if not self.is_available():
            logger.warning("Embedding-Search nicht verfügbar")
            return None
        
        # Query-Embedding generieren
        query_embedding = self.generate(query)
        if not query_embedding:
            return None
        
        # Alle Profile mit Embeddings laden
        from .profile_models import UserProfile
        
        profiles = UserProfile.objects.filter(
            is_searchable=True,
            embedding_vector__isnull=False
        ).values('id', 'embedding_vector')
        
        # Similarities berechnen
        results = []
        for profile in profiles:
            try:
                corpus_vec = json.loads(profile['embedding_vector'])
                sim = self._provider.cosine_similarity(query_embedding, corpus_vec)
                results.append((profile['id'], sim))
            except (json.JSONDecodeError, TypeError):
                continue
        
        # Sort und return Top-K
        results.sort(key=lambda x: x[1], reverse=True)
        top_ids = [r[0] for r in results[:top_k]]
        
        return UserProfile.objects.filter(id__in=top_ids)
    
    def generate_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generiert Embeddings für mehrere Texte (optimiert)
        
        Args:
            texts: Liste von Texten
            
        Returns:
            Liste von Embeddings
        """
        if not self.is_available():
            return [None] * len(texts)
        
        return [self.generate(text) for text in texts]


# ============================================================================
# SEARCH HELPERS - FUZZY MATCHING & SYNONYMS
# ============================================================================

# Deutsche Stopwords (Füllwörter die ignoriert werden)
GERMAN_STOPWORDS = {
    # Fragewörter
    'wer', 'was', 'wo', 'wann', 'wie', 'warum', 'welche', 'welcher', 'welches',
    # Verben (häufig)
    'ist', 'sind', 'war', 'waren', 'hat', 'haben', 'macht', 'machen', 'gibt', 'kann', 'können',
    'wird', 'werden', 'sein', 'tut', 'tun', 'geht', 'gehen', 'kommt', 'kommen',
    # Artikel
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
    # Pronomen
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'sich', 'uns', 'euch',
    'mir', 'dir', 'ihm', 'ihr', 'ihnen', 'mein', 'dein', 'sein', 'unser', 'euer',
    # Präpositionen
    'in', 'an', 'auf', 'bei', 'mit', 'nach', 'von', 'zu', 'aus', 'für', 'um', 'über',
    'unter', 'vor', 'zwischen', 'durch', 'gegen', 'ohne', 'bis',
    # Konjunktionen
    'und', 'oder', 'aber', 'denn', 'weil', 'dass', 'ob', 'wenn', 'als', 'dann', 'doch',
    # Sonstiges
    'nicht', 'auch', 'nur', 'noch', 'schon', 'mal', 'hier', 'da', 'dort', 'jetzt',
    'alle', 'alles', 'viel', 'viele', 'mehr', 'sehr', 'so', 'diese', 'dieser', 'dieses'
}


def remove_stopwords(query: str) -> str:
    """
    Entfernt Stopwords aus Query
    
    Args:
        query: Such-Query
        
    Returns:
        Query ohne Stopwords
    """
    words = query.lower().split()
    filtered_words = [w for w in words if w not in GERMAN_STOPWORDS and len(w) >= 2]
    return ' '.join(filtered_words) if filtered_words else query  # Fallback auf Original


def expand_query_with_synonyms(query: str) -> Set[str]:
    """
    Erweitert Query mit Synonymen aus DB
    
    Args:
        query: Original Such-Query (bereits ohne Stopwords)
        
    Returns:
        Set mit Original-Query + Synonymen
    """
    from .search_models import SearchSynonym
    
    expanded_terms = set([query.lower()])
    query_words = [w.strip().lower() for w in query.split() if len(w) >= 3]
    
    for word in query_words:
        # Suche exakte Treffer in Synonymen
        synonyms = SearchSynonym.objects.filter(
            term__iexact=word,
            is_active=True
        ).first()
        
        if synonyms:
            expanded_terms.update(synonyms.get_synonym_list())
    
    return expanded_terms


def fuzzy_match_in_text(query_word: str, text: str, threshold: int = 75) -> bool:
    """
    Prüft ob query_word fuzzy in text vorkommt
    
    Args:
        query_word: Such-Wort
        text: Text zum Durchsuchen
        threshold: Mindest-Ähnlichkeit (0-100)
        
    Returns:
        True wenn fuzzy match gefunden
    """
    if not HAS_RAPIDFUZZ or not text:
        # Fallback: Einfache substring-Suche
        return query_word.lower() in text.lower()
    
    # Split text in Wörter und prüfe Ähnlichkeit
    text_words = text.lower().split()
    
    for text_word in text_words:
        similarity = fuzz.ratio(query_word.lower(), text_word)
        if similarity >= threshold:
            return True
    
    return False


def get_field_weight(field_name: str) -> float:
    """
    Gibt Gewichtung für verschiedene Felder zurück
    Höhere Werte = wichtiger für Suche
    """
    weights = {
        'responsibilities': 0.50,      # Höchste Priorität
        'expertise_areas': 0.45,
        'job_title': 0.40,
        'position_title': 0.40,
        'role_name': 0.35,
        'role_keywords': 0.35,
        'specialty_name': 0.30,
        'specialty_keywords': 0.30,
        'department_keywords': 0.25,
        'department_name': 0.20,
        'team_name': 0.15,
        'office_location': 0.10,
    }
    return weights.get(field_name, 0.20)


# ============================================================================
# SHORTCUT FUNCTIONS
# ============================================================================

def get_embedding_manager() -> EmbeddingManager:
    """Gibt Singleton-Instanz des EmbeddingManagers"""
    return EmbeddingManager()


def generate_profile_embedding(profile) -> Optional[List[float]]:
    """
    Generiert Embedding für User-Profil aus relevanten Feldern
    
    Args:
        profile: UserProfile-Instanz
        
    Returns:
        Embedding-Vektor oder None
    """
    manager = get_embedding_manager()
    if not manager.is_available():
        return None
    
    # Kombiniere relevante Felder
    parts = []
    
    # User basics
    if profile.user:
        full_name = profile.user.get_full_name()
        if full_name:
            parts.append(f"Name: {full_name}")
    
    if profile.display_name:
        parts.append(f"Anzeigename: {profile.display_name}")
    if profile.job_title:
        parts.append(f"Position: {profile.job_title}")
    
    # Companies (ManyToMany)
    companies = profile.companies.all()
    if companies:
        company_names = ", ".join([c.name for c in companies])
        parts.append(f"Gesellschaft: {company_names}")
    
    # ALL Department Memberships (nicht nur primary!)
    all_memberships = profile.get_all_department_memberships()
    if all_memberships:
        for membership in all_memberships:
            # Department Info
            dept = membership.department
            parts.append(f"Abteilung: {dept.name}")
            if dept.search_keywords:
                parts.append(f"Bereich: {dept.search_keywords}")
            if dept.parent:
                parts.append(f"Hauptabteilung: {dept.parent.name}")
            
            # Role Info
            role = membership.role
            parts.append(f"Rolle: {role.name}")
            if role.search_keywords:
                parts.append(f"Aufgaben: {role.search_keywords}")
            
            # Position Title (zusätzlich zur Rolle)
            if membership.position_title:
                parts.append(f"Positionsbezeichnung: {membership.position_title}")
            
            # Specialty Assignments für dieses Membership
            specialty_assignments = membership.specialty_assignments.filter(
                is_active=True
            ).select_related('specialty')
            
            if specialty_assignments:
                for assignment in specialty_assignments:
                    specialty = assignment.specialty
                    parts.append(f"Fachbereich: {specialty.name}")
                    if specialty.search_keywords:
                        parts.append(f"Fachgebiet-Keywords: {specialty.search_keywords}")
                    if specialty.parent:
                        parts.append(f"Hauptfachbereich: {specialty.parent.name}")
                    
                    # Kompetenzstufe
                    proficiency_label = dict(assignment.PROFICIENCY_CHOICES).get(
                        assignment.proficiency_level, ''
                    )
                    if proficiency_label:
                        parts.append(f"Kompetenz {specialty.name}: {proficiency_label}")
    
    # Teams
    teams = profile.user.teams.filter(is_active=True).select_related('department')
    if teams:
        team_names = ", ".join([f"{t.name} ({t.department.name})" for t in teams])
        parts.append(f"Teams: {team_names}")
    
    # Led Teams (ist Team-Lead)
    led_teams = profile.user.led_teams.filter(is_active=True).select_related('department')
    if led_teams:
        led_team_names = ", ".join([f"{t.name} ({t.department.name})" for t in led_teams])
        parts.append(f"Team-Lead: {led_team_names}")
    
    if profile.responsibilities:
        parts.append(f"Verantwortung: {profile.responsibilities}")
    if profile.expertise_areas:
        parts.append(f"Expertise: {profile.expertise_areas}")
    if profile.office_location:
        parts.append(f"Standort: {profile.office_location}")
    
    # Zusätzliche Kontextinformationen
    if profile.contract_type:
        contract_label = dict(profile._meta.get_field('contract_type').choices).get(
            profile.contract_type, ''
        )
        if contract_label:
            parts.append(f"Vertragsart: {contract_label}")
    
    combined_text = " | ".join(parts)
    return manager.generate(combined_text)


def search_profiles_semantic(query: str, top_k: int = 5, user=None, track_query: bool = True):
    """
    Semantische Suche nach Profilen mit Relevanz-Scores, Fuzzy Matching & Synonymen
    
    Args:
        query: Such-Query
        top_k: Anzahl der Ergebnisse
        user: User der die Suche durchführt (für Tracking)
        track_query: Query für Learning tracken?
        
    Returns:
        List mit (profile, score, matched_fields) Tuples
    """
    from .profile_models import UserProfile
    from .search_models import SearchQuery
    
    # SCHRITT 0: Stopwords entfernen (wer, was, macht, ist, etc.)
    original_query = query
    query_cleaned = remove_stopwords(query)
    
    logger.info(f"Original query: '{original_query}' → Cleaned: '{query_cleaned}'")
    
    # Query vorverarbeiten & erweitern
    query_lower = query_cleaned.lower().strip()
    original_words = [w.strip() for w in query_cleaned.split() if len(w) >= 2]
    
    # Synonym-Expansion (nur auf bereinigte Query)
    expanded_terms = expand_query_with_synonyms(query_cleaned)
    logger.info(f"Query '{query_cleaned}' expanded to: {expanded_terms}")
    
    # SCHRITT 1: Prüfe ob nach Name oder E-Mail gesucht wird (mit Fuzzy)
    query_lower = query.lower().strip()
    
    # Suche nach exakten Übereinstimmungen in Namen/E-Mail (nur aktive User)
    name_matches = UserProfile.objects.filter(
        is_searchable=True,
        user__is_active=True
    ).select_related('user').filter(
        models.Q(user__first_name__icontains=query_lower) |
        models.Q(user__last_name__icontains=query_lower) |
        models.Q(user__email__icontains=query_lower) |
        models.Q(user__username__icontains=query_lower)
    )
    
    # Wenn Name/E-Mail-Treffer gefunden: Nur diese zurückgeben mit 100% Relevanz
    if name_matches.exists():
        results = []
        for profile in name_matches:
            matched_fields = []
            
            # Zeige welches Feld gematched hat
            if query_lower in profile.user.first_name.lower():
                matched_fields.append(('Vorname', profile.user.first_name))
            if query_lower in profile.user.last_name.lower():
                matched_fields.append(('Nachname', profile.user.last_name))
            if query_lower in profile.user.email.lower():
                matched_fields.append(('E-Mail', profile.user.email))
            if query_lower in profile.user.username.lower():
                matched_fields.append(('Username', profile.user.username))
            
            results.append({
                'profile': profile,
                'score': 1.0,  # 100% Relevanz für exakte Namens-Treffer
                'matched_fields': matched_fields
            })
        
        # WICHTIG: Auch bei Name-Matches Learning-Boosts anwenden!
        from .learning_service import apply_learning_boosts
        results = apply_learning_boosts(
            results[:top_k],
            searcher_user=user,
            query_text=original_query
        )
        
        return results
    
    # SCHRITT 2: Keine Namens-Treffer → Normale semantische Suche
    manager = get_embedding_manager()
    if not manager.is_available():
        return []
    
    # Query-Embedding generieren (mit bereinigter Query!)
    query_embedding = manager.generate(query_cleaned)
    if not query_embedding:
        return []
    
    # Alle Profile mit Embeddings laden (nur aktive User)
    profiles = UserProfile.objects.filter(
        is_searchable=True,
        user__is_active=True,
        embedding_vector__isnull=False
    ).select_related('user')
    
    # Similarities berechnen mit Details
    results = []
    for profile in profiles:
        try:
            # embedding_vector ist bereits eine Liste, nicht JSON
            corpus_vec = profile.embedding_vector
            if isinstance(corpus_vec, str):
                corpus_vec = json.loads(corpus_vec)
            
            similarity = manager._provider.cosine_similarity(query_embedding, corpus_vec)
            
            # KEYWORD BOOST mit Fuzzy Matching & Synonym-Support
            keyword_boost = 0.0
            query_words = list(expanded_terms)  # Inkl. Synonyme
            
            # Get primary department for boost fields
            primary_dept = profile.primary_department
            dept_keywords = primary_dept.search_keywords if primary_dept and primary_dept.search_keywords else ''
            
            primary_role = profile.primary_role
            role_keywords = primary_role.search_keywords if primary_role and primary_role.search_keywords else ''
            
            # Prüfe wichtige Felder auf Keyword-Matches (inkl. Fuzzy)
            boost_fields = [
                ('responsibilities', profile.responsibilities or ''),
                ('expertise_areas', profile.expertise_areas or ''),
                ('role_keywords', role_keywords),
                ('department_keywords', dept_keywords),
                ('job_title', profile.job_title or ''),
            ]
            
            for field_name, field_text in boost_fields:
                if not field_text:
                    continue
                    
                field_weight = get_field_weight(field_name)
                matches = 0
                
                for word in query_words:
                    if len(word) < 3:
                        continue
                    # Fuzzy match mit 75% threshold
                    if fuzzy_match_in_text(word, field_text, threshold=75):
                        matches += 1
                
                if matches > 0:
                    # Boost proportional zu Anzahl Matches * Feldgewichtung
                    keyword_boost += field_weight * (matches / len(query_words))
            
            # Kombiniere Semantic Score + Keyword Boost (max 100%)
            final_score = min(similarity + keyword_boost, 1.0)
            
            # Matched fields identifizieren (für "Warum dieser Treffer?")
            matched_fields = []
            
            # Sammle alle durchsuchbaren Felder
            primary_dept = profile.primary_department
            dept_name = primary_dept.name if primary_dept else ''
            dept_keywords = primary_dept.search_keywords if primary_dept and primary_dept.search_keywords else ''
            
            primary_role = profile.primary_role
            role_name = primary_role.name if primary_role else ''
            role_keywords = primary_role.search_keywords if primary_role and primary_role.search_keywords else ''
            
            primary_specs = profile.primary_specialties
            spec_names = ', '.join([s.name for s in primary_specs]) if primary_specs else ''
            
            searchable_fields = [
                ('Position', profile.job_title or ''),
                ('Abteilung', dept_name),
                ('Bereich', dept_keywords),
                ('Rolle', role_name),
                ('Rollenaufgaben', role_keywords),
                ('Fachbereich', spec_names),
                ('Verantwortung', profile.responsibilities or ''),
                ('Expertise', profile.expertise_areas or ''),
            ]
            
            # Prüfe jedes Feld auf Übereinstimmung
            for field_name, field_value in searchable_fields:
                if not field_value:
                    continue
                    
                field_lower = field_value.lower()
                
                # Prüfe ob irgendein Query-Wort im Feld vorkommt
                for word in query_words:
                    if word in field_lower:
                        matched_fields.append((field_name, field_value))
                        break
            
            # Fallback: Wenn keine exakten Matches, zeige wichtigste Felder
            if not matched_fields and final_score >= 0.15:
                # Zeige Department und wichtigstes User-Feld
                primary_dept = profile.primary_department
                if primary_dept:
                    matched_fields.append(('Abteilung', primary_dept.name))
                if profile.responsibilities:
                    matched_fields.append(('Verantwortung', profile.responsibilities))
                elif profile.expertise_areas:
                    matched_fields.append(('Expertise', profile.expertise_areas))
                elif profile.job_title:
                    matched_fields.append(('Position', profile.job_title))
            
            results.append({
                'profile': profile,
                'score': round(final_score, 3),
                'matched_fields': matched_fields,
                'user_id': profile.user.id,
                'display_name': profile.display_name,
            })
        except (json.JSONDecodeError, TypeError, AttributeError) as e:
            logger.warning(f"Profile {profile.user_id} skip: {e}")
            continue
    
    # Filter: Nur Ergebnisse über Threshold (12% - niedrig für max Abdeckung mit Fuzzy)
    RELEVANCE_THRESHOLD = 0.12
    results = [r for r in results if r['score'] >= RELEVANCE_THRESHOLD]
    
    # Sort by similarity
    results.sort(key=lambda x: x['score'], reverse=True)
    top_results = results[:top_k]
    
    # TRACKING: Speichere Query für späteres Learning (Original-Query!)
    if track_query:
        try:
            avg_score = sum(r['score'] for r in top_results) / len(top_results) if top_results else 0.0
            SearchQuery.objects.create(
                user=user,
                query_text=original_query,  # Original-Query speichern
                result_count=len(top_results),
                avg_score=avg_score
            )
        except Exception as e:
            logger.warning(f"Query tracking failed: {e}")
    
    # ===== LEARNING & PERSONALIZATION BOOSTS =====
    from .learning_service import apply_learning_boosts
    
    top_results = apply_learning_boosts(
        top_results,
        searcher_user=user,
        query_text=original_query
    )
    
    logger.info(f"Search completed: {len(top_results)} results after learning boosts applied")
    
    return top_results
