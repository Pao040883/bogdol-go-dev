import { Injectable, signal, computed, effect } from '@angular/core';
import { fromEvent } from 'rxjs';
import { throttleTime, distinctUntilChanged } from 'rxjs/operators';

interface PerformanceMetrics {
  loadTime?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  memoryUsage?: number;
  connectionType?: string;
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private _metrics = signal<PerformanceMetrics | null>(null);
  private _isOnline = signal(navigator.onLine);
  private _connectionType = signal<string>('unknown');

  readonly metrics = this._metrics.asReadonly();
  readonly isOnline = this._isOnline.asReadonly();
  readonly connectionType = this._connectionType.asReadonly();

  // Computed für Performance-Status
  readonly performanceStatus = computed(() => {
    const metrics = this._metrics();
    if (!metrics?.loadTime) return 'measuring';
    
    if (metrics.loadTime < 1000) return 'excellent';
    if (metrics.loadTime < 3000) return 'good';
    if (metrics.loadTime < 5000) return 'needs-improvement';
    return 'poor';
  });

  constructor() {
    this.initializePerformanceMonitoring();
    this.setupNetworkMonitoring();
  }

  private initializePerformanceMonitoring(): void {
    // Performance Observer für moderne Browser
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.updateNavigationMetrics(entry as PerformanceNavigationTiming);
          } else if (entry.entryType === 'paint') {
            this.updatePaintMetrics(entry as PerformancePaintTiming);
          } else if (entry.entryType === 'largest-contentful-paint') {
            this.updateLCPMetrics(entry as any);
          }
        });
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
    }

    // Fallback für ältere Browser
    if (performance.timing) {
      setTimeout(() => {
        this.updateLegacyMetrics();
      }, 0);
    }

    // Memory Usage (wenn verfügbar)
    this.updateMemoryMetrics();
  }

  private updateNavigationMetrics(timing: PerformanceNavigationTiming): void {
    const loadTime = timing.loadEventEnd - timing.fetchStart;
    this._metrics.update(current => ({
      ...current || {},
      loadTime
    }));
  }

  private updatePaintMetrics(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      this._metrics.update(current => ({
        ...current || {},
        firstContentfulPaint: entry.startTime
      }));
    }
  }

  private updateLCPMetrics(entry: any): void {
    this._metrics.update(current => ({
      ...current || {},
      largestContentfulPaint: entry.startTime
    }));
  }

  private updateLegacyMetrics(): void {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const fcp = timing.domContentLoadedEventEnd - timing.navigationStart;

    this._metrics.set({
      loadTime,
      firstContentfulPaint: fcp,
      largestContentfulPaint: 0, // Nicht verfügbar in Legacy
    });
  }

  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this._metrics.update(current => ({
        ...current || {},
        memoryUsage: memory.usedJSHeapSize
      }));
    }
  }

  private setupNetworkMonitoring(): void {
    // Online/Offline Status
    fromEvent(window, 'online').subscribe(() => this._isOnline.set(true));
    fromEvent(window, 'offline').subscribe(() => this._isOnline.set(false));

    // Connection Type (wenn verfügbar)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this._connectionType.set(connection.effectiveType || 'unknown');

      fromEvent(connection, 'change')
        .pipe(throttleTime(1000))
        .subscribe(() => {
          this._connectionType.set(connection.effectiveType || 'unknown');
        });
    }
  }

  /**
   * Misst die Performance einer Funktion
   */
  measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    console.log(`Performance [${name}]: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  /**
   * Misst die Performance einer async Funktion
   */
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    console.log(`Async Performance [${name}]: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  /**
   * Startet eine Performance-Messung
   */
  startMeasure(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * Beendet eine Performance-Messung
   */
  endMeasure(name: string): number {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    console.log(`Measure [${name}]: ${measure.duration.toFixed(2)}ms`);
    
    return measure.duration;
  }

  /**
   * Gibt Performance-Empfehlungen basierend auf Metriken
   */
  getPerformanceRecommendations(): string[] {
    const metrics = this._metrics();
    const recommendations: string[] = [];

    if (!metrics) {
      return ['Performance-Daten werden noch gesammelt...'];
    }

    if (metrics.loadTime && metrics.loadTime > 3000) {
      recommendations.push('Seitenladezeit optimieren (> 3s)');
    }

    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > 1500) {
      recommendations.push('First Contentful Paint verbessern (> 1.5s)');
    }

    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      recommendations.push('Largest Contentful Paint optimieren (> 2.5s)');
    }

    if (metrics.memoryUsage && metrics.memoryUsage > 50 * 1024 * 1024) {
      recommendations.push('Speicherverbrauch reduzieren (> 50MB)');
    }

    if (this._connectionType() === 'slow-2g' || this._connectionType() === '2g') {
      recommendations.push('Für langsame Verbindungen optimieren');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance ist gut! 🚀');
    }

    return recommendations;
  }
}
