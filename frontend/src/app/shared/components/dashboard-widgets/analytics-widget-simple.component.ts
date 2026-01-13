import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';

export interface SimplifiedAnalytics {
  totalEvents: number;
  sessionDuration: number;
  performanceScore: number;
  errorRate: number;
  popularPages: { page: string; views: number }[];
  userActions: { action: string; count: number }[];
}

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
          <ion-badge [color]="getStatusColor()" slot="end">
            {{ isOnline ? 'Online' : 'Offline' }}
          </ion-badge>
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Real-time Status -->
        <div class="status-grid">
          <div class="status-item">
            <ion-icon name="pulse-outline" [color]="isOnline ? 'success' : 'danger'"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ isOnline ? 'Online' : 'Offline' }}</span>
              <span class="status-label">Status</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="notifications-outline" color="primary"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ analytics().totalEvents }}</span>
              <span class="status-label">Events</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="time-outline" color="warning"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ formatDuration(analytics().sessionDuration) }}</span>
              <span class="status-label">Session</span>
            </div>
          </div>

          <div class="status-item">
            <ion-icon name="speedometer-outline" color="secondary"></ion-icon>
            <div class="status-info">
              <span class="status-value">{{ analytics().performanceScore }}/100</span>
              <span class="status-label">Performance</span>
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
          @if (selectedChart === 'performance') {
          <div class="chart-container">
            <div class="chart-header">
              <h3>Performance Metriken</h3>
              <ion-badge [color]="getPerformanceBadgeColor()">{{ analytics().performanceScore }}/100</ion-badge>
            </div>
            
            <div class="performance-metrics">
              <div class="metric-item">
                <div class="metric-bar">
                  <div class="metric-progress" 
                       [style.width.%]="analytics().performanceScore"
                       [style.background-color]="getPerformanceColor(analytics().performanceScore)">
                  </div>
                </div>
                <span class="metric-label">Overall Score: {{ analytics().performanceScore }}/100</span>
              </div>

              <div class="metric-item">
                <div class="metric-bar">
                  <div class="metric-progress" 
                       [style.width.%]="85"
                       [style.background-color]="getPerformanceColor(85)">
                  </div>
                </div>
                <span class="metric-label">Page Load: 850ms</span>
              </div>

              <div class="metric-item">
                <div class="metric-bar">
                  <div class="metric-progress" 
                       [style.width.%]="92"
                       [style.background-color]="getPerformanceColor(92)">
                  </div>
                </div>
                <span class="metric-label">API Response: 180ms</span>
              </div>
            </div>
          </div>
          }

          <!-- Usage Chart -->
          @if (selectedChart === 'usage') {
          <div class="chart-container">
            <div class="chart-header">
              <h3>Nutzungsstatistiken</h3>
              <ion-badge color="primary">{{ analytics().totalEvents }} Events</ion-badge>
            </div>
            
            <div class="usage-stats">
              <div class="stat-grid">
                <div class="stat-item">
                  <ion-icon name="eye-outline" color="primary"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">{{ analytics().popularPages.length }}</span>
                    <span class="stat-label">Besuchte Seiten</span>
                  </div>
                </div>

                <div class="stat-item">
                  <ion-icon name="hand-left-outline" color="secondary"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">{{ analytics().userActions.length }}</span>
                    <span class="stat-label">User Actions</span>
                  </div>
                </div>

                <div class="stat-item">
                  <ion-icon name="analytics-outline" color="success"></ion-icon>
                  <div class="stat-info">
                    <span class="stat-value">12.5%</span>
                    <span class="stat-label">Bounce Rate</span>
                  </div>
                </div>
              </div>

              <div class="popular-pages">
                <h4>Beliebte Seiten</h4>
                <div class="page-list">
                  @for (page of analytics().popularPages; track page.page) {
                  <div class="page-item">
                    <span class="page-name">{{ page.page }}</span>
                    <ion-badge color="primary">{{ page.views }}</ion-badge>
                  </div>
                  }
                </div>
              </div>
            </div>
          </div>
          }

          <!-- Error Chart -->
          @if (selectedChart === 'errors') {
          <div class="chart-container">
            <div class="chart-header">
              <h3>Fehler Übersicht</h3>
              <ion-badge [color]="getErrorRateColor()">{{ analytics().errorRate.toFixed(2) }}%</ion-badge>
            </div>
            
            <div class="error-stats">
              <div class="error-rate-indicator">
                <div class="rate-circle" [class]="getErrorRateClass()">
                  <span class="rate-value">{{ analytics().errorRate.toFixed(1) }}%</span>
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
          }
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <ion-button 
            fill="clear" 
            size="small" 
            (click)="exportAnalytics()"
            [disabled]="isRefreshing">
            <ion-icon name="download-outline" slot="start"></ion-icon>
            Export
          </ion-button>

          <ion-button 
            fill="clear" 
            size="small" 
            (click)="refreshData()"
            [disabled]="isRefreshing">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            {{ isRefreshing ? 'Lädt...' : 'Aktualisieren' }}
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

        <!-- Session Info -->
        <div class="session-info">
          <h4>Session Informationen</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Browser:</span>
              <span class="info-value">{{ getBrowserInfo() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Platform:</span>
              <span class="info-value">{{ getPlatformInfo() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Session ID:</span>
              <span class="info-value">{{ sessionId.slice(0, 8) }}...</span>
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

    .session-info {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--ion-color-light);
    }

    .session-info h4 {
      margin: 0 0 12px 0;
      font-size: 1em;
      color: var(--ion-color-dark);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--ion-color-light);
      border-radius: 6px;
      font-size: 0.9em;
    }

    .info-label {
      color: var(--ion-color-medium);
      font-weight: 500;
    }

    .info-value {
      color: var(--ion-color-dark);
    }

    @media (max-width: 768px) {
      .status-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .stat-grid {
        grid-template-columns: 1fr;
      }
      
      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AnalyticsWidgetComponent implements OnInit, OnDestroy {
  selectedChart = 'performance';
  isRefreshing = false;
  isOnline = true;
  sessionId = this.generateSessionId();
  private refreshSubscription?: Subscription;

  // Simplified analytics data
  private analyticsData = signal<SimplifiedAnalytics>({
    totalEvents: 0,
    sessionDuration: 0,
    performanceScore: 95,
    errorRate: 1.2,
    popularPages: [],
    userActions: []
  });

  analytics = computed(() => this.analyticsData());

  ngOnInit() {
    // Refresh data every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.refreshData();
    });

    // Initial data load
    this.refreshData();

    // Monitor online status
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
  }

  onChartChange(event: any) {
    this.selectedChart = event.detail.value;
  }

  async refreshData() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate dynamic mock data
      const mockData: SimplifiedAnalytics = {
        totalEvents: Math.floor(Math.random() * 200) + 100,
        sessionDuration: Date.now() - Date.now() + Math.random() * 1800000, // Random session time
        performanceScore: Math.floor(Math.random() * 20) + 80, // 80-100
        errorRate: Math.random() * 3, // 0-3%
        popularPages: [
          { page: '/dashboard', views: Math.floor(Math.random() * 50) + 20 },
          { page: '/absences', views: Math.floor(Math.random() * 30) + 15 },
          { page: '/sofo', views: Math.floor(Math.random() * 25) + 10 },
          { page: '/users', views: Math.floor(Math.random() * 20) + 5 }
        ],
        userActions: [
          { action: 'click', count: Math.floor(Math.random() * 100) + 50 },
          { action: 'scroll', count: Math.floor(Math.random() * 150) + 75 },
          { action: 'form_submit', count: Math.floor(Math.random() * 30) + 10 },
          { action: 'navigation', count: Math.floor(Math.random() * 40) + 20 }
        ]
      };
      
      this.analyticsData.set(mockData);
    } catch (error) {
      console.error('Error refreshing analytics data:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  async exportAnalytics() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        analytics: this.analytics(),
        browser: this.getBrowserInfo(),
        platform: this.getPlatformInfo()
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  }

  clearAnalytics() {
    this.analyticsData.set({
      totalEvents: 0,
      sessionDuration: 0,
      performanceScore: 100,
      errorRate: 0,
      popularPages: [],
      userActions: []
    });
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  getPlatformInfo(): string {
    const platform = navigator.platform;
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Mac')) return 'macOS';
    if (platform.includes('Linux')) return 'Linux';
    if (platform.includes('Android')) return 'Android';
    if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  getStatusColor(): string {
    return this.isOnline ? 'success' : 'danger';
  }

  getPerformanceColor(score: number): string {
    if (score >= 90) return 'var(--ion-color-success)';
    if (score >= 70) return 'var(--ion-color-warning)';
    return 'var(--ion-color-danger)';
  }

  getPerformanceBadgeColor(): string {
    const score = this.analytics().performanceScore;
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'danger';
  }

  getErrorRateColor(): string {
    const rate = this.analytics().errorRate;
    if (rate < 1) return 'success';
    if (rate < 5) return 'warning';
    return 'danger';
  }

  getErrorRateClass(): string {
    const rate = this.analytics().errorRate;
    if (rate < 1) return 'good';
    if (rate < 5) return 'warning';
    return 'danger';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
