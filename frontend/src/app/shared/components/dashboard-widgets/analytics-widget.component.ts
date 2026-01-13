import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { AdvancedAnalyticsService, AnalyticsDashboard } from '../../services/advanced-analytics.service';
import { RealtimeNotificationsService } from '../../services/realtime-notifications.service';
import { MobileFeatureService } from '../../services/mobile-features.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-analytics-widget',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  template: `
    <ion-card class="analytics-widget">
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="analytics-outline"></ion-icon>
          Live Analytics
          <ion-badge [color]="connectionStatusColor()" slot="end">
            {{ connectionStatus() }}
          </ion-badge>
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Real-time Status -->
        <div class="status-grid">
          <div class="status-item">
            <ion-icon name="pulse-outline" [color]="isOnline() ? 'success' : 'danger'"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ isOnline() ? 'Online' : 'Offline' }}</span>
              <span class="status-label">Status</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="notifications-outline" color="primary"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ notificationStats().unread }}</span>
              <span class="status-label">Ungelesene</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="time-outline" color="warning"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ formatDuration(sessionDuration()) }}</span>
              <span class="status-label">Session</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="speedometer-outline" color="secondary"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ averageResponseTime() }}ms</span>
              <span class="status-label">API Speed</span>
            </div>
          </div>
        </div>

        <!-- Analytics Charts -->
        <div class="charts-section">
          <ion-segment [(ngModel)]="selectedChart" (ionChange)="onChartChange($event)">
            <ion-segment-button value="performance">
              <ion-label>Performance</ion-label>
            </ion-segment-button>
            <ion-segment-button value="usage">
              <ion-label>Nutzung</ion-label>
            </ion-segment-button>
            <ion-segment-button value="errors">
              <ion-label>Fehler</ion-label>
            </ion-segment-button>
          </ion-segment>

          <!-- Performance Chart -->
          <div *ngIf="selectedChart === 'performance'" class="chart-container">
            <div class="chart-header">
              <h3>Performance Metriken</h3>
              <ion-badge color="success">{{ performanceScore() }}/100</ion-badge>
            </div>
            
            <div class="performance-metrics">
              <div class="metric-item">
                <div class="metric-bar">
                  <div class="metric-progress" 
                       [style.width.%]="(dashboard()?.performanceMetrics.pageLoadTime || 0) / 50"
                       [style.background-color]="getPerformanceColor(dashboard()?.performanceMetrics.pageLoadTime || 0)">
                  </div>
                </div>
                <span class="metric-label">Page Load: {{ dashboard()?.performanceMetrics.pageLoadTime || 0 }}ms</span>
              </div>

              <div class="metric-item" *ngFor="let api of topApiCalls()">
                <div class="metric-bar">
                  <div class="metric-progress" 
                       [style.width.%]="api.avgTime / 10"
                       [style.background-color]="getPerformanceColor(api.avgTime)">
                  </div>
                </div>
                <span class="metric-label">{{ api.name }}: {{ api.avgTime }}ms</span>
              </div>
            </div>
          </div>

          <!-- Usage Chart -->
          <div *ngIf="selectedChart === 'usage'" class="chart-container">
            <div class="chart-header">
              <h3>Nutzungsstatistiken</h3>
              <ion-badge color="primary">{{ dashboard()?.totalEvents || 0 }} Events</ion-badge>
            </div>
            
            <div class="usage-stats">
              <div class="stat-grid">
                <div class="stat-item">
                  <ion-icon name="eye-outline" color="primary"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">{{ dashboard()?.popularPages.length || 0 }}</span>
                    <span class="stat-label">Besuchte Seiten</span>
                  </div>
                </div>

                <div class="stat-item">
                  <ion-icon name="hand-left-outline" color="secondary"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">{{ dashboard()?.userActions.length || 0 }}</span>
                    <span class="stat-label">User Actions</span>
                  </div>
                </div>

                <div class="stat-item">
                  <ion-icon name="analytics-outline" color="success"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">{{ dashboard()?.bounceRate.toFixed(1) || 0 }}%</span>
                    <span class="stat-label">Bounce Rate</span>
                  </div>
                </div>
              </div>

              <div class="popular-pages">
                <h4>Beliebte Seiten</h4>
                <div class="page-list">
                  <div class="page-item" *ngFor="let page of dashboard()?.popularPages.slice(0, 5)">
                    <span class="page-name">{{ formatPageName(page.page) }}</span>
                    <ion-badge color="primary">{{ page.views }}</ion-badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Chart -->
          <div *ngIf="selectedChart === 'errors'" class="chart-container">
            <div class="chart-header">
              <h3>Fehler Übersicht</h3>
              <ion-badge [color]="getErrorRateColor()">{{ dashboard()?.errorRate.toFixed(2) || 0 }}%</ion-badge>
            </div>
            
            <div class="error-stats">
              <div class="error-rate-indicator">
                <div class="rate-circle" [class]="getErrorRateClass()">
                  <span class="rate-value">{{ dashboard()?.errorRate.toFixed(1) || 0 }}%</span>
                  <span class="rate-label">Error Rate</span>
                </div>
              </div>

              <div class="error-trends">
                <h4>Fehler Trends</h4>
                <div class="trend-list">
                  <div class="trend-item good">
                    <ion-icon name="trending-down-outline" color="success"></ion-icon>
                    <span>API Fehler: -15% (letzte Stunde)</span>
                  </div>
                  <div class="trend-item warning">
                    <ion-icon name="trending-up-outline" color="warning"></ion-icon>
                    <span>UI Fehler: +5% (letzte Stunde)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <ion-button 
            fill="clear" 
            size="small" 
            (click)="exportAnalytics()"
            [disabled]="!dashboard()">
            <ion-icon name="download-outline" slot="start"></ion-icon>
            Export
          </ion-button>

          <ion-button 
            fill="clear" 
            size="small" 
            (click)="refreshData()"
            [disabled]="isRefreshing">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            Aktualisieren
          </ion-button>

          <ion-button 
            fill="clear" 
            size="small" 
            (click)="clearAnalytics()"
            color="danger">
            <ion-icon name="trash-outline" slot="start"></ion-icon>
            Löschen
          </ion-button>
        </div>

        <!-- Device Info -->
        <div class="device-info" *ngIf="deviceInfo()">
          <h4>Geräteinformationen</h4>
          <div class="device-grid">
            <div class="device-item">
              <span class="device-label">Platform:</span>
              <span class="device-value">{{ deviceInfo()?.platform || 'Web' }}</span>
            </div>
            <div class="device-item">
              <span class="device-label">OS:</span>
              <span class="device-value">{{ deviceInfo()?.operatingSystem || 'Unknown' }}</span>
            </div>
            <div class="device-item">
              <span class="device-label">Version:</span>
              <span class="device-value">{{ deviceInfo()?.osVersion || 'Unknown' }}</span>
            </div>
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .analytics-widget {
      height: 100%;
      margin: 0;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 8px;
    }

    .status-info {
      display: flex;
      flex-direction: column;
    }

    .status-value {
      font-weight: 600;
      font-size: 1.1em;
      color: var(--ion-color-dark);
    }

    .status-label {
      font-size: 0.8em;
      color: var(--ion-color-medium);
    }

    .charts-section {
      margin: 20px 0;
    }

    .chart-container {
      margin-top: 16px;
      min-height: 200px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .chart-header h3 {
      margin: 0;
      font-size: 1.2em;
      color: var(--ion-color-dark);
    }

    .performance-metrics {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .metric-bar {
      width: 100%;
      height: 8px;
      background: var(--ion-color-light);
      border-radius: 4px;
      overflow: hidden;
    }

    .metric-progress {
      height: 100%;
      transition: width 0.3s ease;
    }

    .metric-label {
      font-size: 0.9em;
      color: var(--ion-color-medium);
    }

    .usage-stats {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 8px;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-weight: 600;
      font-size: 1.2em;
    }

    .stat-label {
      font-size: 0.8em;
      color: var(--ion-color-medium);
    }

    .popular-pages h4 {
      margin: 0 0 12px 0;
      font-size: 1em;
      color: var(--ion-color-dark);
    }

    .page-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .page-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--ion-color-light);
      border-radius: 6px;
    }

    .page-name {
      font-size: 0.9em;
      color: var(--ion-color-dark);
    }

    .error-stats {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .error-rate-indicator {
      display: flex;
      justify-content: center;
    }

    .rate-circle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 4px solid;
    }

    .rate-circle.good {
      border-color: var(--ion-color-success);
      color: var(--ion-color-success);
    }

    .rate-circle.warning {
      border-color: var(--ion-color-warning);
      color: var(--ion-color-warning);
    }

    .rate-circle.danger {
      border-color: var(--ion-color-danger);
      color: var(--ion-color-danger);
    }

    .rate-value {
      font-weight: 600;
      font-size: 1.3em;
    }

    .rate-label {
      font-size: 0.8em;
      margin-top: 4px;
    }

    .error-trends h4 {
      margin: 0 0 12px 0;
      font-size: 1em;
      color: var(--ion-color-dark);
    }

    .trend-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .trend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--ion-color-light);
      border-radius: 6px;
      font-size: 0.9em;
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      margin: 20px 0;
      flex-wrap: wrap;
    }

    .device-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--ion-color-light);
    }

    .device-info h4 {
      margin: 0 0 12px 0;
      font-size: 1em;
      color: var(--ion-color-dark);
    }

    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }

    .device-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--ion-color-light);
      border-radius: 6px;
      font-size: 0.9em;
    }

    .device-label {
      color: var(--ion-color-medium);
      font-weight: 500;
    }

    .device-value {
      color: var(--ion-color-dark);
    }

    @media (max-width: 768px) {
      .status-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .stat-grid {
        grid-template-columns: 1fr;
      }
      
      .device-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AnalyticsWidgetComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AdvancedAnalyticsService);
  private notificationsService = inject(RealtimeNotificationsService);
  private mobileService = inject(MobileFeatureService);

  selectedChart = 'performance';
  isRefreshing = false;
  private refreshSubscription?: Subscription;

  // Mock dashboard data for now (will be replaced with real service)
  private dashboardDataSignal = signal<AnalyticsDashboard | null>(null);

  // Analytics data
  dashboard = computed(() => this.dashboardDataSignal());
  
  // Real-time data
  connectionStatus = computed(() => 
    this.notificationsService.connectionState().status
  );
  
  connectionStatusColor = computed(() => {
    const status = this.connectionStatus();
    return status === 'connected' ? 'success' : 
           status === 'reconnecting' ? 'warning' : 'danger';
  });

  isOnline = computed(() => this.mobileService.isOnline());
  notificationStats = computed(() => this.notificationsService.getNotificationStats());
  
  sessionDuration = computed(() => Date.now() - Date.now() + 300000); // Mock 5 minutes
  
  deviceInfo = computed(() => this.mobileService.device());

  // Performance metrics
  averageResponseTime = computed(() => {
    const metrics = this.dashboard()?.performanceMetrics;
    if (!metrics?.apiResponseTimes) return 0;
    
    const allTimes = Object.values(metrics.apiResponseTimes).flat();
    if (allTimes.length === 0) return 0;
    
    return Math.round(allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length);
  });

  performanceScore = computed(() => {
    const loadTime = this.dashboard()?.performanceMetrics.pageLoadTime || 0;
    const apiTime = this.averageResponseTime();
    
    let score = 100;
    if (loadTime > 3000) score -= 30;
    else if (loadTime > 1000) score -= 15;
    
    if (apiTime > 1000) score -= 20;
    else if (apiTime > 500) score -= 10;
    
    return Math.max(0, score);
  });

  topApiCalls = computed(() => {
    const metrics = this.dashboard()?.performanceMetrics;
    if (!metrics?.apiResponseTimes) return [];
    
    return Object.entries(metrics.apiResponseTimes)
      .map(([url, times]) => ({
        name: this.formatApiName(url),
        avgTime: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length)
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);
  });

  ngOnInit() {
    // Refresh data every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.refreshData();
    });

    // Initial data load
    this.refreshData();
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
  }

  onChartChange(event: any) {
    this.selectedChart = event.detail.value;
    this.analyticsService.trackUserAction('chart_view', 'analytics_widget', {
      chart: this.selectedChart
    });
  }

  async refreshData() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      // Generate mock dashboard data
      const mockDashboard: AnalyticsDashboard = {
        totalEvents: 150,
        uniqueUsers: 25,
        sessionDuration: 300000,
        bounceRate: 12.5,
        popularPages: [
          { page: '/dashboard', views: 45 },
          { page: '/absences', views: 32 },
          { page: '/sofo', views: 28 }
        ],
        userActions: [
          { action: 'click', count: 89 },
          { action: 'scroll', count: 156 },
          { action: 'form_submit', count: 23 }
        ],
        performanceMetrics: {
          pageLoadTime: 1200,
          apiResponseTimes: {
            '/api/absences': [250, 300, 275],
            '/api/users': [180, 220, 195]
          },
          componentRenderTimes: {
            'dashboard': 150,
            'absence-list': 85
          }
        },
        errorRate: 2.1,
        conversionFunnels: [
          { step: 'page_view', completion: 100 },
          { step: 'form_interaction', completion: 65 },
          { step: 'form_submission', completion: 45 }
        ]
      };
      
      this.dashboardDataSignal.set(mockDashboard);
      
      // Haptic feedback on mobile
      if (this.mobileService.isMobile()) {
        await this.mobileService.triggerHapticFeedback('light');
      }
    } catch (error) {
      console.error('Error refreshing analytics data:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  async exportAnalytics() {
    try {
      const data = this.analyticsService.getAnalyticsData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      if (this.mobileService.isMobile()) {
        // Use Capacitor share on mobile
        await this.mobileService.share({
          title: 'Analytics Export',
          text: 'Analytics data export',
          files: [URL.createObjectURL(blob)]
        });
      } else {
        // Download on web
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      this.analyticsService.trackUserAction('export_analytics', 'analytics_widget');
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  }

  clearAnalytics() {
    this.analyticsService.clearData();
    this.analyticsService.trackUserAction('clear_analytics', 'analytics_widget');
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  formatPageName(path: string): string {
    return path.split('/').filter(Boolean).pop() || 'Home';
  }

  formatApiName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').filter(Boolean).join('/');
    } catch {
      return url.substring(0, 20) + (url.length > 20 ? '...' : '');
    }
  }

  getPerformanceColor(time: number): string {
    if (time < 200) return 'var(--ion-color-success)';
    if (time < 500) return 'var(--ion-color-warning)';
    return 'var(--ion-color-danger)';
  }

  getErrorRateColor(): string {
    const rate = this.dashboard()?.errorRate || 0;
    if (rate < 1) return 'success';
    if (rate < 5) return 'warning';
    return 'danger';
  }

  getErrorRateClass(): string {
    const rate = this.dashboard()?.errorRate || 0;
    if (rate < 1) return 'good';
    if (rate < 5) return 'warning';
    return 'danger';
  }
}
