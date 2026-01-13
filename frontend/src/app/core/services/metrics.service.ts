import { Injectable, signal, computed } from '@angular/core';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  target?: number;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private _metrics = signal<PerformanceMetric[]>([]);
  
  readonly metrics$ = this._metrics.asReadonly();
  
  // Key Performance Indicators
  readonly kpis$ = computed(() => {
    const metrics = this.metrics$();
    return {
      avgResponseTime: metrics.find(m => m.name === 'avg_response_time')?.value || 0,
      errorRate: metrics.find(m => m.name === 'error_rate')?.value || 0,
      userSatisfaction: metrics.find(m => m.name === 'user_satisfaction')?.value || 0,
      featureAdoption: metrics.find(m => m.name === 'feature_adoption')?.value || 0
    };
  });

  recordMetric(name: string, value: number, unit: string, target?: number): void {
    const existingMetric = this._metrics().find(m => m.name === name);
    const trend = this.calculateTrend(existingMetric?.value, value);
    
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      trend,
      target,
      timestamp: new Date()
    };
    
    this._metrics.update(metrics => 
      metrics.filter(m => m.name !== name).concat(metric)
    );
  }

  private calculateTrend(oldValue?: number, newValue?: number): 'up' | 'down' | 'stable' {
    if (!oldValue || !newValue) return 'stable';
    const change = ((newValue - oldValue) / oldValue) * 100;
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  // Weekly Report
  generateWeeklyReport(): string {
    const kpis = this.kpis$();
    return `
📊 Wöchentlicher Performance-Report

🚀 Response Time: ${kpis.avgResponseTime}ms
❌ Error Rate: ${kpis.errorRate}%
😊 User Satisfaction: ${kpis.userSatisfaction}/10
📈 Feature Adoption: ${kpis.featureAdoption}%

Ziele für nächste Woche:
- Response Time < 1000ms
- Error Rate < 2%
- User Satisfaction > 8/10
    `;
  }
}
