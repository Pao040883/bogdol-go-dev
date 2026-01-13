// sofortmeldung.service.ts
import { Injectable, inject, signal, WritableSignal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EnvironmentService } from './environment.service';
import { ErrorHandlingService } from './error-handling.service';
import { CacheService } from './cache.service';
import { PerformanceService } from './performance.service';
import { Sofortmeldung } from '../interfaces/sofortmeldung';

@Injectable({ providedIn: 'root' })
export class SofortmeldungService {
  private http = inject(HttpClient);
  private envService = inject(EnvironmentService);
  private errorHandlingService = inject(ErrorHandlingService);
  private cacheService = inject(CacheService);
  private performanceService = inject(PerformanceService);
  
  // Computed Signal für dynamische URL
  private readonly baseUrl = computed(() => `${this.envService.apiUrl()}/sofortmeldungen/`);

  private sofortmeldungen: WritableSignal<Sofortmeldung[]> = signal([]);
  private loading = signal(false);
  private error = signal<string | null>(null);
  private trackingStatuses = signal<Map<number, 'pending' | 'processing' | 'completed' | 'failed'>>(new Map());

  readonly sofortmeldungen$ = this.sofortmeldungen.asReadonly();
  readonly loading$ = this.loading.asReadonly();
  readonly error$ = this.error.asReadonly();
  readonly trackingStatuses$ = this.trackingStatuses.asReadonly();

  // Aktive Polling-Intervals verwalten
  private activePolls = new Map<number, number>();

  /** Lade alle Meldungen mit Caching */
  async fetchAll(useCache: boolean = true): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const url = this.baseUrl();
      
      let data: Sofortmeldung[];
      
      if (useCache) {
        // Mit Performance-Messung und Caching
        data = await this.performanceService.measureAsyncFunction(
          'fetchAllSofortmeldungen',
          () => firstValueFrom(this.cacheService.get<Sofortmeldung[]>(url, {
            ttl: 2 * 60 * 1000, // 2 Minuten Cache
            strategy: 'cache-first'
          }))
        );
      } else {
        // Ohne Cache, direkt vom Server
        data = await this.performanceService.measureAsyncFunction(
          'fetchAllSofortmeldungenDirect',
          () => firstValueFrom(this.http.get<Sofortmeldung[]>(url))
        );
        
        // Cache invalidieren für nächste Anfragen
        this.cacheService.invalidate(url);
      }
      
      this.sofortmeldungen.set(data);
    } catch (err: any) {
      this.errorHandlingService.handleHttpError(err);
      this.error.set('Fehler beim Laden der Sofortmeldungen');
    } finally {
      this.loading.set(false);
    }
  }

  /** Einzelne Meldung laden mit Caching */
  async fetchOne(id: number, useCache: boolean = true): Promise<Sofortmeldung | null> {
    try {
      const url = `${this.baseUrl()}${id}/`;
      
      let result: Sofortmeldung;
      
      if (useCache) {
        result = await firstValueFrom(this.cacheService.get<Sofortmeldung>(url, {
          ttl: 5 * 60 * 1000, // 5 Minuten Cache für einzelne Einträge
          strategy: 'cache-first'
        }));
      } else {
        result = await firstValueFrom(this.http.get<Sofortmeldung>(url));
        this.cacheService.invalidate(url);
      }
      
      return result;
    } catch (err: any) {
      this.errorHandlingService.handleHttpError(err);
      this.error.set('Fehler beim Laden einer Sofortmeldung');
      return null;
    }
  }

  /** Neue Meldung anlegen mit automatischem Status-Tracking */
  async create(data: Partial<Sofortmeldung>): Promise<Sofortmeldung | null> {
    try {
      const url = this.baseUrl();
      const created = await this.performanceService.measureAsyncFunction(
        'createSofortmeldung',
        () => firstValueFrom(this.http.post<Sofortmeldung>(url, data))
      );
      
      // Cache invalidieren da neue Daten vorliegen
      this.cacheService.invalidate(url);
      
      // Lokalen State aktualisieren
      this.sofortmeldungen.update(list => [...list, created]);
      
      // Automatisches Status-Tracking starten falls nicht bereits erfolgreich
      if (!created.status && created.id) {
        this.startStatusTracking(created.id);
      }
      
      return created;
    } catch (err: any) {
      this.errorHandlingService.handleHttpError(err);
      this.error.set('Fehler beim Erstellen');
      return null;
    }
  }

  /** Neue Meldung mit Live-Tracking erstellen */
  async createAndTrack(data: Partial<Sofortmeldung>): Promise<Sofortmeldung | null> {
    const created = await this.create(data);
    
    if (created && created.id && !created.status) {
      // Tracking-Status setzen
      this.setTrackingStatus(created.id, 'processing');
      
      // Info-Notification (falls Toast-Service verfügbar)
      console.log('🔄 Sofortmeldung wird an API übermittelt...');
    }
    
    return created;
  }

  /** Status-Tracking für eine Sofortmeldung starten */
  private startStatusTracking(id: number): void {
    // Verhindere mehrfaches Polling für dieselbe ID
    if (this.activePolls.has(id)) {
      return;
    }

    this.setTrackingStatus(id, 'processing');
    
    const maxAttempts = 36; // 6 Minuten bei 10s Intervall
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        // Status ohne Cache prüfen
        const updated = await this.fetchOne(id, false);
        
        if (updated) {
          // Lokalen State aktualisieren
          this.sofortmeldungen.update(list => 
            list.map(item => item.id === id ? updated : item)
          );
          
          if (updated.status === true) {
            // ✅ Erfolgreich abgeschlossen
            this.setTrackingStatus(id, 'completed');
            this.stopStatusTracking(id);
            
            console.log(`✅ Sofortmeldung ${id} erfolgreich! TAN: ${updated.tan}`);
            
            // Success-Notification
            this.showStatusNotification(id, 'success', `Sofortmeldung erfolgreich! TAN: ${updated.tan}`);
            
          } else if (updated.tan && !updated.status) {
            // ❌ Hat TAN aber Status false = Fehler
            this.setTrackingStatus(id, 'failed');
            this.stopStatusTracking(id);
            
            console.warn(`❌ Sofortmeldung ${id} fehlgeschlagen. TAN vorhanden aber Status false.`);
            this.showStatusNotification(id, 'error', 'Sofortmeldung fehlgeschlagen. Bitte prüfen Sie die Details.');
          }
        }
        
        // Timeout-Check
        if (attempts >= maxAttempts) {
          this.setTrackingStatus(id, 'failed');
          this.stopStatusTracking(id);
          
          console.warn(`⏰ Status-Tracking für Sofortmeldung ${id} nach ${maxAttempts} Versuchen beendet.`);
          this.showStatusNotification(id, 'warning', 'Status-Check Timeout. Bitte prüfen Sie manuell.');
        }
        
      } catch (error) {
        console.error(`Fehler beim Status-Check für Sofortmeldung ${id}:`, error);
        
        // Bei wiederholten Fehlern stoppen
        if (attempts >= 5) {
          this.setTrackingStatus(id, 'failed');
          this.stopStatusTracking(id);
        }
      }
    }, 10000); // Alle 10 Sekunden
    
    this.activePolls.set(id, pollInterval);
  }

  /** Status-Tracking für eine Sofortmeldung stoppen */
  private stopStatusTracking(id: number): void {
    const interval = this.activePolls.get(id);
    if (interval) {
      clearInterval(interval);
      this.activePolls.delete(id);
    }
  }

  /** Tracking-Status für eine Sofortmeldung setzen */
  private setTrackingStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed'): void {
    this.trackingStatuses.update(map => {
      const newMap = new Map(map);
      newMap.set(id, status);
      return newMap;
    });
  }

  /** Status-Notification anzeigen (kann durch Toast-Service ersetzt werden) */
  private showStatusNotification(id: number, type: 'success' | 'error' | 'warning', message: string): void {
    // Hier könnte ein Toast-Service oder Notification-Service aufgerufen werden
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Falls Sie einen Notification-Service haben:
    // this.notificationService.show({ type, message, duration: 5000 });
  }

  /** Tracking-Status für eine Sofortmeldung abrufen */
  getTrackingStatus(id: number): 'pending' | 'processing' | 'completed' | 'failed' | null {
    return this.trackingStatuses().get(id) || null;
  }

  /** Manuelles Status-Tracking für bereits existierende Sofortmeldung starten */
  trackExistingStatus(id: number): void {
    this.startStatusTracking(id);
  }

  /** Alle aktiven Trackings stoppen */
  stopAllTracking(): void {
    this.activePolls.forEach((interval, id) => {
      clearInterval(interval);
    });
    this.activePolls.clear();
    this.trackingStatuses.set(new Map());
  }

  /** Meldung aktualisieren */
  async update(id: number, data: Partial<Sofortmeldung>): Promise<Sofortmeldung | null> {
    try {
      const url = `${this.baseUrl()}${id}/`;
      const updated = await this.performanceService.measureAsyncFunction(
        'updateSofortmeldung',
        () => firstValueFrom(this.http.put<Sofortmeldung>(url, data))
      );
      
      // Cache invalidieren
      this.cacheService.invalidate(this.baseUrl()); // Liste
      this.cacheService.invalidate(url); // Einzelner Eintrag
      
      // Lokalen State aktualisieren
      this.sofortmeldungen.update(list => 
        list.map(item => item.id === id ? updated : item)
      );
      return updated;
    } catch (err: any) {
      this.errorHandlingService.handleHttpError(err);
      this.error.set('Fehler beim Aktualisieren');
      return null;
    }
  }

  /** Meldung löschen */
  async delete(id: number): Promise<boolean> {
    try {
      const url = `${this.baseUrl()}${id}/`;
      await this.performanceService.measureAsyncFunction(
        'deleteSofortmeldung',
        () => firstValueFrom(this.http.delete<void>(url))
      );
      
      // Cache invalidieren
      this.cacheService.invalidate(this.baseUrl()); // Liste
      this.cacheService.invalidate(url); // Einzelner Eintrag
      
      // Lokalen State aktualisieren
      this.sofortmeldungen.update(list => list.filter(item => item.id !== id));
      return true;
    } catch (err: any) {
      this.errorHandlingService.handleHttpError(err);
      this.error.set('Fehler beim Löschen');
      return false;
    }
  }

  /** Cache für diesen Service leeren */
  clearCache(): void {
    const baseUrl = this.baseUrl();
    this.cacheService.invalidate(baseUrl);
    console.log('Sofortmeldung cache cleared');
  }

  /** Preload der Daten für bessere Performance */
  preloadData(): void {
    const url = this.baseUrl();
    this.cacheService.preload<Sofortmeldung[]>(url, {
      ttl: 2 * 60 * 1000,
      strategy: 'network-first'
    }).subscribe({
      next: (data) => console.log(`Preloaded ${data.length} Sofortmeldungen`),
      error: (err) => console.warn('Preload failed:', err)
    });
  }

  /** Gibt Performance-Statistiken zurück */
  getPerformanceStats() {
    return {
      cache: this.cacheService.getStats(),
      performance: this.performanceService.getPerformanceRecommendations(),
      activePolls: this.activePolls.size,
      trackingStatuses: Object.fromEntries(this.trackingStatuses())
    };
  }

  /** Service aufräumen beim Zerstören */
  ngOnDestroy(): void {
    this.stopAllTracking();
  }
}
