import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, of, tap, catchError } from 'rxjs';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheOptions {
  ttl?: number; // Default: 5 minutes
  strategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only';
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  private http = inject(HttpClient);
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 Minuten

  // Signals für Cache-Statistiken
  private _cacheHits = signal(0);
  private _cacheMisses = signal(0);
  private _cacheSize = signal(0);

  readonly cacheHits = this._cacheHits.asReadonly();
  readonly cacheMisses = this._cacheMisses.asReadonly();
  readonly cacheSize = this._cacheSize.asReadonly();

  /**
   * Holt Daten mit Caching-Strategie
   */
  get<T>(url: string, options: CacheOptions = {}): Observable<T> {
    const { ttl = this.DEFAULT_TTL, strategy = 'cache-first' } = options;
    const cacheKey = this.generateCacheKey(url);

    switch (strategy) {
      case 'cache-only':
        return this.getCacheOnly<T>(cacheKey);
      
      case 'network-only':
        return this.getNetworkOnly<T>(url, cacheKey, ttl);
      
      case 'network-first':
        return this.getNetworkFirst<T>(url, cacheKey, ttl);
      
      case 'cache-first':
      default:
        return this.getCacheFirst<T>(url, cacheKey, ttl);
    }
  }

  /**
   * Cache-First-Strategie: Cache zuerst, dann Netzwerk
   */
  private getCacheFirst<T>(url: string, cacheKey: string, ttl: number): Observable<T> {
    const cached = this.getCachedData<T>(cacheKey);
    if (cached) {
      this._cacheHits.update(hits => hits + 1);
      return of(cached);
    }

    this._cacheMisses.update(misses => misses + 1);
    return this.fetchAndCache<T>(url, cacheKey, ttl);
  }

  /**
   * Network-First-Strategie: Netzwerk zuerst, Cache als Fallback
   */
  private getNetworkFirst<T>(url: string, cacheKey: string, ttl: number): Observable<T> {
    return this.fetchAndCache<T>(url, cacheKey, ttl).pipe(
      catchError(() => {
        const cached = this.getCachedData<T>(cacheKey);
        if (cached) {
          this._cacheHits.update(hits => hits + 1);
          console.warn(`Network failed, using cached data for ${url}`);
          return of(cached);
        }
        this._cacheMisses.update(misses => misses + 1);
        throw new Error(`No cached data available for ${url}`);
      })
    );
  }

  /**
   * Cache-Only-Strategie: Nur aus Cache laden
   */
  private getCacheOnly<T>(cacheKey: string): Observable<T> {
    const cached = this.getCachedData<T>(cacheKey);
    if (cached) {
      this._cacheHits.update(hits => hits + 1);
      return of(cached);
    }
    
    this._cacheMisses.update(misses => misses + 1);
    throw new Error(`No cached data available for key: ${cacheKey}`);
  }

  /**
   * Network-Only-Strategie: Immer vom Netzwerk laden
   */
  private getNetworkOnly<T>(url: string, cacheKey: string, ttl: number): Observable<T> {
    return this.fetchAndCache<T>(url, cacheKey, ttl);
  }

  /**
   * Lädt Daten vom Netzwerk und cached sie
   */
  private fetchAndCache<T>(url: string, cacheKey: string, ttl: number): Observable<T> {
    return this.http.get<T>(url).pipe(
      tap((data) => {
        this.setCacheData(cacheKey, data, ttl);
      })
    );
  }

  /**
   * Holt Daten aus dem Cache wenn gültig
   */
  private getCachedData<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      this.updateCacheSize();
      return null;
    }

    return entry.data;
  }

  /**
   * Speichert Daten im Cache
   */
  private setCacheData<T>(cacheKey: string, data: T, ttl: number): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
    this.updateCacheSize();
  }

  /**
   * Generiert einen Cache-Key aus der URL
   */
  private generateCacheKey(url: string): string {
    return `cache_${btoa(url)}`;
  }

  /**
   * Aktualisiert die Cache-Größe
   */
  private updateCacheSize(): void {
    this._cacheSize.set(this.cache.size);
  }

  /**
   * Löscht einen spezifischen Cache-Eintrag
   */
  invalidate(url: string): void {
    const cacheKey = this.generateCacheKey(url);
    this.cache.delete(cacheKey);
    this.updateCacheSize();
    console.log(`Cache invalidated for: ${url}`);
  }

  /**
   * Löscht alle Cache-Einträge
   */
  clear(): void {
    this.cache.clear();
    this._cacheSize.set(0);
    console.log('Cache cleared');
  }

  /**
   * Löscht abgelaufene Cache-Einträge
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.updateCacheSize();
    if (cleaned > 0) {
      console.log(`Cache cleanup: ${cleaned} expired entries removed`);
    }
  }

  /**
   * Gibt Cache-Statistiken zurück
   */
  getStats() {
    const hits = this._cacheHits();
    const misses = this._cacheMisses();
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : '0';

    return {
      hits,
      misses,
      total,
      hitRate: `${hitRate}%`,
      size: this._cacheSize(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Schätzt die Speichernutzung des Caches
   */
  private getMemoryUsage(): string {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimate (UTF-16)
    }
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Führt periodische Cache-Bereinigung durch
   */
  startPeriodicCleanup(intervalMs: number = 10 * 60 * 1000): void {
    setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Preloads eine URL in den Cache
   */
  preload<T>(url: string, options: CacheOptions = {}): Observable<T> {
    return this.get<T>(url, options);
  }

  /**
   * Cache-Status für bestimmte URL prüfen
   */
  isCached(url: string): boolean {
    const cacheKey = this.generateCacheKey(url);
    return this.getCachedData(cacheKey) !== null;
  }
}
