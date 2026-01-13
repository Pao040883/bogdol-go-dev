import { Injectable, signal, computed, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, timer, EMPTY } from 'rxjs';
import { map, catchError, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AnalyticsEvent {
  id: string;
  type: 'page_view' | 'user_action' | 'performance' | 'error' | 'custom';
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
  userId?: number;
  sessionId: string;
  userAgent: string;
  url: string;
  referrer?: string;
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTimes: Record<string, number[]>;
  componentRenderTimes: Record<string, number>;
  memoryUsage?: MemoryInfo;
  networkTiming?: PerformanceTiming;
}

export interface UserBehaviorMetrics {
  clickHeatmap: Record<string, { x: number; y: number; count: number }[]>;
  scrollDepth: Record<string, number>;
  timeOnPage: Record<string, number>;
  userFlows: string[];
  formInteractions: Record<string, { field: string; interactions: number; errors: number }>;
}

export interface AnalyticsDashboard {
  totalEvents: number;
  uniqueUsers: number;
  sessionDuration: number;
  bounceRate: number;
  popularPages: { page: string; views: number }[];
  userActions: { action: string; count: number }[];
  performanceMetrics: PerformanceMetrics;
  errorRate: number;
  conversionFunnels: { step: string; completion: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class AdvancedAnalyticsService {
  private http = inject(HttpClient);

  // Session management
  private sessionId = this.generateSessionId();
  private sessionStart = Date.now();
  private currentPage = '';
  
  // Event tracking
  private events = signal<AnalyticsEvent[]>([]);
  private eventsQueue: AnalyticsEvent[] = [];
  private batchSize = 10;
  private flushInterval = 30000; // 30 seconds
  
  // Performance tracking
  private performanceMetrics = signal<PerformanceMetrics>({
    pageLoadTime: 0,
    apiResponseTimes: {},
    componentRenderTimes: {}
  });
  
  // User behavior tracking
  private userBehavior = signal<UserBehaviorMetrics>({
    clickHeatmap: {},
    scrollDepth: {},
    timeOnPage: {},
    userFlows: [],
    formInteractions: {}
  });
  
  // Analytics state
  private isEnabled = signal(true);
  private isOfflineMode = signal(false);
  private lastFlushTime = Date.now();
  
  // Computed analytics
  analytics = computed(() => ({
    totalEvents: this.events().length,
    sessionDuration: Date.now() - this.sessionStart,
    currentSession: this.sessionId,
    performanceMetrics: this.performanceMetrics(),
    userBehavior: this.userBehavior(),
    isEnabled: this.isEnabled(),
    queueSize: this.eventsQueue.length
  }));

  constructor() {
    this.initializeAnalytics();
  }

  private initializeAnalytics() {
    
    // Setup automatic event flushing
    this.setupEventFlushing();
    
    // Setup performance monitoring
    this.setupPerformanceMonitoring();
    
    // Setup user behavior tracking
    this.setupUserBehaviorTracking();
    
    // Setup page visibility tracking
    this.setupPageVisibilityTracking();
    
    // Track initial page load
    this.trackPageView(window.location.pathname);
  }

  private setupEventFlushing() {
    timer(this.flushInterval, this.flushInterval).subscribe(() => {
      this.flushEvents();
    });
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushEvents(true);
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.trackPageLoadPerformance();
      }, 100);
    });
    
    // Monitor network performance
    this.monitorNetworkPerformance();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
  }

  private setupUserBehaviorTracking() {
    // Track clicks
    document.addEventListener('click', (event) => {
      this.trackClickEvent(event);
    });
    
    // Track scroll behavior
    window.addEventListener('scroll', debounce(() => {
      this.trackScrollBehavior();
    }, 250));
    
    // Track form interactions
    document.addEventListener('focusin', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        this.trackFormInteraction(event.target);
      }
    });
    
    // Track page time
    this.trackPageTime();
  }

  private setupPageVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent({
          type: 'user_action',
          category: 'engagement',
          action: 'page_hidden',
          label: this.currentPage
        });
      } else {
        this.trackEvent({
          type: 'user_action',
          category: 'engagement',
          action: 'page_visible',
          label: this.currentPage
        });
      }
    });
  }

  private trackPageLoadPerformance() {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const timing = performance.timing;
      
      const metrics = {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
        networkTiming: timing
      };
      
      this.performanceMetrics.update(current => ({
        ...current,
        pageLoadTime: metrics.pageLoadTime,
        networkTiming: metrics.networkTiming
      }));
      
      this.trackEvent({
        type: 'performance',
        category: 'page_load',
        action: 'load_complete',
        value: metrics.pageLoadTime,
        metadata: metrics
      });
    }
  }

  private getFirstPaint(): number {
    const paint = performance.getEntriesByType('paint');
    const firstPaint = paint.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
  }

  private getFirstContentfulPaint(): number {
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : 0;
  }

  private monitorNetworkPerformance() {
    // Monitor API response times
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.trackApiResponseTime(url, duration);
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.trackApiError(url, duration, error);
        throw error;
      }
    };
  }

  private monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.performanceMetrics.update(current => ({
          ...current,
          memoryUsage: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          }
        }));
      }, 60000); // Every minute
    }
  }

  private trackClickEvent(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const page = this.currentPage || window.location.pathname;
    
    // Create click heatmap data
    const clickData = {
      x: event.clientX,
      y: event.clientY,
      count: 1
    };
    
    this.userBehavior.update(current => {
      const heatmap = current.clickHeatmap[page] || [];
      const existingClick = heatmap.find(c => 
        Math.abs(c.x - clickData.x) < 10 && Math.abs(c.y - clickData.y) < 10
      );
      
      if (existingClick) {
        existingClick.count++;
      } else {
        heatmap.push(clickData);
      }
      
      return {
        ...current,
        clickHeatmap: { ...current.clickHeatmap, [page]: heatmap }
      };
    });
    
    // Track click event
    const elementInfo = this.getElementInfo(target);
    this.trackEvent({
      type: 'user_action',
      category: 'interaction',
      action: 'click',
      label: elementInfo.selector,
      metadata: {
        ...elementInfo,
        coordinates: { x: event.clientX, y: event.clientY }
      }
    });
  }

  private trackScrollBehavior() {
    const scrollTop = window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
    
    const page = this.currentPage || window.location.pathname;
    
    this.userBehavior.update(current => ({
      ...current,
      scrollDepth: {
        ...current.scrollDepth,
        [page]: Math.max(current.scrollDepth[page] || 0, scrollPercent)
      }
    }));
    
    // Track scroll milestones
    const milestones = [25, 50, 75, 90, 100];
    const lastMilestone = this.getLastScrollMilestone(page);
    
    for (const milestone of milestones) {
      if (scrollPercent >= milestone && lastMilestone < milestone) {
        this.trackEvent({
          type: 'user_action',
          category: 'engagement',
          action: 'scroll_depth',
          label: page,
          value: milestone
        });
        
        this.setLastScrollMilestone(page, milestone);
        break;
      }
    }
  }

  private trackFormInteraction(element: HTMLInputElement | HTMLTextAreaElement) {
    const formId = element.form?.id || 'unknown_form';
    const fieldName = element.name || element.id || 'unknown_field';
    
    this.userBehavior.update(current => {
      const interactions = current.formInteractions[formId] || { field: fieldName, interactions: 0, errors: 0 };
      interactions.interactions++;
      
      return {
        ...current,
        formInteractions: {
          ...current.formInteractions,
          [formId]: interactions
        }
      };
    });
    
    this.trackEvent({
      type: 'user_action',
      category: 'form',
      action: 'field_focus',
      label: `${formId}.${fieldName}`
    });
  }

  private trackPageTime() {
    let pageStartTime = Date.now();
    
    const trackTime = () => {
      const timeOnPage = Date.now() - pageStartTime;
      const page = this.currentPage || window.location.pathname;
      
      this.userBehavior.update(current => ({
        ...current,
        timeOnPage: {
          ...current.timeOnPage,
          [page]: (current.timeOnPage[page] || 0) + timeOnPage
        }
      }));
      
      pageStartTime = Date.now();
    };
    
    // Track time on page visibility change
    document.addEventListener('visibilitychange', trackTime);
    
    // Track time on page unload
    window.addEventListener('beforeunload', trackTime);
    
    // Track time periodically
    setInterval(trackTime, 30000); // Every 30 seconds
  }

  private trackApiResponseTime(url: string, duration: number) {
    this.performanceMetrics.update(current => {
      const apiTimes = current.apiResponseTimes[url] || [];
      apiTimes.push(duration);
      
      // Keep only last 100 measurements
      if (apiTimes.length > 100) {
        apiTimes.splice(0, apiTimes.length - 100);
      }
      
      return {
        ...current,
        apiResponseTimes: {
          ...current.apiResponseTimes,
          [url]: apiTimes
        }
      };
    });
    
    this.trackEvent({
      type: 'performance',
      category: 'api',
      action: 'response_time',
      label: url,
      value: duration
    });
  }

  private trackApiError(url: string, duration: number, error: any) {
    this.trackEvent({
      type: 'error',
      category: 'api',
      action: 'request_failed',
      label: url,
      value: duration,
      metadata: {
        error: error.message || 'Unknown error',
        stack: error.stack
      }
    });
  }

  private getElementInfo(element: HTMLElement) {
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      id: element.id,
      selector: this.generateSelector(element),
      textContent: element.textContent?.slice(0, 100) || '',
      attributes: this.getElementAttributes(element)
    };
  }

  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      return `.${element.className.split(' ').join('.')}`;
    }
    
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }
      path.unshift(selector);
      current = current.parentElement!;
    }
    
    return path.join(' > ');
  }

  private getElementAttributes(element: HTMLElement) {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
      if (['data-', 'aria-'].some(prefix => attr.name.startsWith(prefix))) {
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }

  private getLastScrollMilestone(page: string): number {
    return parseInt(localStorage.getItem(`scroll_milestone_${page}`) || '0');
  }

  private setLastScrollMilestone(page: string, milestone: number) {
    localStorage.setItem(`scroll_milestone_${page}`, milestone.toString());
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  trackEvent(eventData: Partial<AnalyticsEvent>) {
    if (!this.isEnabled()) return;

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type: eventData.type || 'custom',
      category: eventData.category || 'general',
      action: eventData.action || 'unknown',
      label: eventData.label,
      value: eventData.value,
      metadata: eventData.metadata,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      ...eventData
    };

    this.events.update(events => [...events, event]);
    this.eventsQueue.push(event);

    // Auto-flush if queue is full
    if (this.eventsQueue.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  trackPageView(page: string) {
    this.currentPage = page;
    
    this.trackEvent({
      type: 'page_view',
      category: 'navigation',
      action: 'page_view',
      label: page
    });
    
    // Update user flow
    this.userBehavior.update(current => ({
      ...current,
      userFlows: [...current.userFlows, page]
    }));
  }

  trackComponentRender(componentName: string, renderTime: number) {
    this.performanceMetrics.update(current => ({
      ...current,
      componentRenderTimes: {
        ...current.componentRenderTimes,
        [componentName]: renderTime
      }
    }));
    
    this.trackEvent({
      type: 'performance',
      category: 'component',
      action: 'render_time',
      label: componentName,
      value: renderTime
    });
  }

  trackUserAction(action: string, category: string = 'user_interaction', metadata?: any) {
    this.trackEvent({
      type: 'user_action',
      category,
      action,
      metadata
    });
  }

  trackError(error: Error, context?: string) {
    this.trackEvent({
      type: 'error',
      category: 'application',
      action: 'error_occurred',
      label: context || error.name,
      metadata: {
        message: error.message,
        stack: error.stack,
        context
      }
    });
  }

  private async flushEvents(force: boolean = false) {
    if (this.eventsQueue.length === 0) return;
    
    const now = Date.now();
    if (!force && (now - this.lastFlushTime) < this.flushInterval) return;

    const eventsToSend = [...this.eventsQueue];
    this.eventsQueue = [];
    this.lastFlushTime = now;

    try {
      if (!this.isOfflineMode()) {
        await this.sendEventsToServer(eventsToSend);
      } else {
        this.storeEventsOffline(eventsToSend);
      }
    } catch (error) {
      console.error('Error flushing analytics events:', error);
      // Re-queue events for retry
      this.eventsQueue.unshift(...eventsToSend);
    }
  }

  private async sendEventsToServer(events: AnalyticsEvent[]) {
    // In a real implementation, this would send to your analytics backend
    
    // For development, just log the events
    if (!environment.production) {
      console.table(events.map(e => ({
        type: e.type,
        category: e.category,
        action: e.action,
        label: e.label,
        value: e.value
      })));
    }
  }

  private storeEventsOffline(events: AnalyticsEvent[]) {
    const stored = JSON.parse(localStorage.getItem('analytics_offline') || '[]');
    stored.push(...events);
    localStorage.setItem('analytics_offline', JSON.stringify(stored));
  }

  // Analytics dashboard data
  async generateAnalyticsDashboard(): Promise<AnalyticsDashboard> {
    const events = this.events();
    const performance = this.performanceMetrics();
    const behavior = this.userBehavior();
    
    return {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      sessionDuration: Date.now() - this.sessionStart,
      bounceRate: this.calculateBounceRate(events),
      popularPages: this.calculatePopularPages(events),
      userActions: this.calculateUserActions(events),
      performanceMetrics: performance,
      errorRate: this.calculateErrorRate(events),
      conversionFunnels: this.calculateConversionFunnels(events)
    };
  }

  private calculateBounceRate(events: AnalyticsEvent[]): number {
    const sessions = new Set(events.map(e => e.sessionId));
    const sessionEvents = new Map<string, number>();
    
    events.forEach(e => {
      sessionEvents.set(e.sessionId, (sessionEvents.get(e.sessionId) || 0) + 1);
    });
    
    const bouncedSessions = Array.from(sessionEvents.values()).filter(count => count === 1).length;
    return sessions.size > 0 ? (bouncedSessions / sessions.size) * 100 : 0;
  }

  private calculatePopularPages(events: AnalyticsEvent[]) {
    const pageViews = events.filter(e => e.type === 'page_view');
    const pageCount = new Map<string, number>();
    
    pageViews.forEach(e => {
      const page = e.label || 'unknown';
      pageCount.set(page, (pageCount.get(page) || 0) + 1);
    });
    
    return Array.from(pageCount.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private calculateUserActions(events: AnalyticsEvent[]) {
    const actions = events.filter(e => e.type === 'user_action');
    const actionCount = new Map<string, number>();
    
    actions.forEach(e => {
      actionCount.set(e.action, (actionCount.get(e.action) || 0) + 1);
    });
    
    return Array.from(actionCount.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateErrorRate(events: AnalyticsEvent[]): number {
    const totalEvents = events.length;
    const errorEvents = events.filter(e => e.type === 'error').length;
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  private calculateConversionFunnels(events: AnalyticsEvent[]) {
    // Simplified conversion funnel calculation
    const steps = ['page_view', 'form_interaction', 'form_submission', 'success'];
    const stepCounts = new Map<string, number>();
    
    steps.forEach(step => {
      const count = events.filter(e => e.action === step).length;
      stepCounts.set(step, count);
    });
    
    return steps.map(step => ({
      step,
      completion: stepCounts.get(step) || 0
    }));
  }

  // Control methods
  enable() {
    this.isEnabled.set(true);
  }

  disable() {
    this.isEnabled.set(false);
  }

  setOfflineMode(offline: boolean) {
    this.isOfflineMode.set(offline);
  }

  clearData() {
    this.events.set([]);
    this.eventsQueue = [];
    localStorage.removeItem('analytics_offline');
  }

  getAnalyticsData() {
    return {
      events: this.events(),
      performance: this.performanceMetrics(),
      behavior: this.userBehavior(),
      session: {
        id: this.sessionId,
        start: this.sessionStart,
        duration: Date.now() - this.sessionStart
      }
    };
  }
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: number;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  }) as T;
}
