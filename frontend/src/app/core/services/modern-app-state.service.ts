import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { of, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ModernAppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  performance: {
    enableAnalytics: boolean;
    cacheTimeout: number;
  };
}

export interface SystemStatus {
  isOnline: boolean;
  lastSync: Date | null;
  performance: {
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Modern Angular 20 Service using Signals and inject()
 * Demonstriert Best Practices für moderne Angular-Entwicklung
 */
@Injectable({
  providedIn: 'root'
})
export class ModernAppStateService {
  private readonly http = inject(HttpClient);

  // ✅ Signals für reactive state management
  private readonly _settings = signal<ModernAppSettings>({
    theme: 'auto',
    language: 'de',
    notifications: true,
    performance: {
      enableAnalytics: true,
      cacheTimeout: 300000 // 5 Minuten
    }
  });

  private readonly _systemStatus = signal<SystemStatus>({
    isOnline: navigator.onLine,
    lastSync: null,
    performance: {
      averageResponseTime: 0,
      errorRate: 0
    }
  });

  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ✅ Readonly Signals für öffentliche API
  readonly settings = this._settings.asReadonly();
  readonly systemStatus = this._systemStatus.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // ✅ Computed Properties für abgeleitete Werte
  readonly isDarkMode = computed(() => {
    const theme = this._settings().theme;
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  readonly isSystemHealthy = computed(() => {
    const status = this._systemStatus();
    return status.isOnline && 
           status.performance.errorRate < 5 && 
           status.performance.averageResponseTime < 1000;
  });

  readonly canUseAdvancedFeatures = computed(() => {
    return this._settings().performance.enableAnalytics && 
           this.isSystemHealthy();
  });

  constructor() {
    // ✅ Effects für Side Effects
    effect(() => {
      const theme = this.isDarkMode();
      document.body.classList.toggle('dark-theme', theme);
      console.log(`Theme changed to: ${theme ? 'dark' : 'light'}`);
    });

    // ✅ Online/Offline Detection
    this.setupNetworkListeners();
    
    // ✅ Initialize app
    this.loadSettings();
  }

  // ✅ Moderne Service-Methoden mit Signals
  updateSettings(newSettings: Partial<ModernAppSettings>): void {
    this._settings.update(current => ({
      ...current,
      ...newSettings
    }));
    this.saveSettings();
  }

  updatePerformanceMetrics(responseTime: number, hasError: boolean): void {
    this._systemStatus.update(current => {
      const newErrorRate = hasError ? 
        Math.min(current.performance.errorRate + 1, 100) :
        Math.max(current.performance.errorRate - 0.1, 0);

      return {
        ...current,
        performance: {
          averageResponseTime: (current.performance.averageResponseTime + responseTime) / 2,
          errorRate: newErrorRate
        }
      };
    });
  }

  syncWithServer(): void {
    if (this._isLoading()) return;

    this._isLoading.set(true);
    this._error.set(null);

    this.http.get(`${environment.apiUrl}/sync/status`)
      .pipe(
        map((response: any) => response.data),
        catchError(error => {
          this._error.set('Synchronisation fehlgeschlagen');
          return EMPTY;
        })
      )
      .subscribe({
        next: (data) => {
          this._systemStatus.update(current => ({
            ...current,
            lastSync: new Date(),
            isOnline: true
          }));
          this._isLoading.set(false);
        },
        error: () => {
          this._isLoading.set(false);
        }
      });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this._systemStatus.update(current => ({ ...current, isOnline: true }));
    });

    window.addEventListener('offline', () => {
      this._systemStatus.update(current => ({ ...current, isOnline: false }));
    });
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('modern_app_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this._settings.set(settings);
      }
    } catch (error) {
      console.warn('Could not load settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('modern_app_settings', JSON.stringify(this._settings()));
    } catch (error) {
      console.warn('Could not save settings:', error);
    }
  }

  // ✅ Cleanup method (wenn benötigt)
  destroy(): void {
    // Cleanup logic here
  }
}
