import { Injectable, signal, computed, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Subject, BehaviorSubject, interval, fromEvent } from 'rxjs';
import { takeWhile, filter, debounceTime } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { AppStateService } from './app-state.service';
import { AuthService } from '../auth/auth.service';
import { BadgeService } from '../../services/badge.service';

export interface RealtimeNotification {
  id: string;
  type: 'absence_request' | 'absence_approval' | 'sofortmeldung' | 'system' | 'urgent';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiresAction?: boolean;
  actionUrl?: string;
  userId?: number;
  groupId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RealtimeNotificationsService {
  private notificationService = inject(NotificationService);
  private appStateService = inject(AppStateService);
  private authService = inject(AuthService);
  private platform = inject(Platform);
  private badgeService = inject(BadgeService);

  // WebSocket connection for real-time updates
  private webSocket?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private isConnected = signal(false);
  
  // Notification state
  private incomingNotifications = signal<RealtimeNotification[]>([]);
  private connectionStatus = signal<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  
  // Push notifications
  private pushNotificationsEnabled = signal(false);
  private notificationPermission = signal<'granted' | 'denied' | 'default'>('default');
  
  // Service Worker for background sync
  private swRegistration?: ServiceWorkerRegistration;
  
  // Public computed signals
  unreadNotifications = computed(() => 
    this.incomingNotifications().filter(n => !n.data?.read)
  );
  
  urgentNotifications = computed(() => 
    this.unreadNotifications().filter(n => n.priority === 'urgent')
  );
  
  connectionState = computed(() => ({
    isConnected: this.isConnected(),
    status: this.connectionStatus(),
    hasUrgent: this.urgentNotifications().length > 0,
    unreadCount: this.unreadNotifications().length
  }));

  // Event streams
  private notificationReceived = new Subject<RealtimeNotification>();
  private connectionStateChanged = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    
    // Initialize based on platform
    if (this.platform.is('hybrid')) {
      await this.initializeMobileNotifications();
    } else {
      await this.initializeWebNotifications();
    }
    
    // Setup WebSocket connection
    this.setupWebSocketConnection();
    
    // Setup background sync
    await this.setupServiceWorker();
    
    // Listen for auth state changes
    this.authService.currentUser().subscribe(user => {
      if (user) {
        this.connectWebSocket();
      } else {
        this.disconnectWebSocket();
      }
    });
  }

  private async initializeMobileNotifications() {
    try {
      // Request permission for local notifications
      const permission = await LocalNotifications.requestPermissions();
      this.notificationPermission.set(permission.display);
      this.pushNotificationsEnabled.set(permission.display === 'granted');
      
      // Listen for notification events
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        this.handleLocalNotificationReceived(notification);
      });
      
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        this.handleNotificationAction(notification);
      });
      
    } catch (error) {
      console.error('Error initializing mobile notifications:', error);
    }
  }

  private async initializeWebNotifications() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.notificationPermission.set(permission);
      this.pushNotificationsEnabled.set(permission === 'granted');
      
    }
  }

  private setupWebSocketConnection() {
    // Setup automatic reconnection
    interval(this.reconnectInterval).pipe(
      takeWhile(() => this.authService.currentUser().value !== null),
      filter(() => !this.isConnected() && this.reconnectAttempts < this.maxReconnectAttempts)
    ).subscribe(() => {
      this.connectWebSocket();
    });
  }

  private connectWebSocket() {
    const user = this.authService.currentUser().value;
    if (!user) return;

    try {
      // Use secure WebSocket in production
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications/${user.id}/`;
      
      this.webSocket = new WebSocket(wsUrl);
      this.connectionStatus.set('reconnecting');

      this.webSocket.onopen = () => {
        this.isConnected.set(true);
        this.connectionStatus.set('connected');
        this.reconnectAttempts = 0;
        this.connectionStateChanged.next(true);
      };

      this.webSocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.webSocket.onclose = () => {
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
        this.connectionStateChanged.next(false);
        this.reconnectAttempts++;
      };

      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
      };

    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  }

  private disconnectWebSocket() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = undefined;
      this.isConnected.set(false);
      this.connectionStatus.set('disconnected');
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      
      // Badge-Update direkt verarbeiten
      if (data.type === 'badge_update') {
        this.handleBadgeUpdate(data.badges);
        return;
      }
      
      const notification: RealtimeNotification = {
        id: data.id || this.generateNotificationId(),
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        timestamp: new Date(data.timestamp || Date.now()),
        priority: data.priority || 'normal',
        requiresAction: data.requiresAction,
        actionUrl: data.actionUrl,
        userId: data.userId,
        groupId: data.groupId
      };

      this.processIncomingNotification(notification);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  private handleBadgeUpdate(badges: any) {
    
    // Alle Badge-Counts aktualisieren
    if (badges.chat !== undefined) {
      this.badgeService.setBadge('chat', badges.chat);
    }
    if (badges.arbeitsscheine !== undefined) {
      this.badgeService.setBadge('arbeitsscheine', badges.arbeitsscheine);
    }
    if (badges.organigramm !== undefined) {
      this.badgeService.setBadge('organigramm', badges.organigramm);
    }
    if (badges.sofortmeldungen !== undefined) {
      this.badgeService.setBadge('sofortmeldungen', badges.sofortmeldungen);
    }
    if (badges.absences !== undefined) {
      this.badgeService.setBadge('absences', badges.absences);
    }
    if (badges.users !== undefined) {
      this.badgeService.setBadge('users', badges.users);
    }
  }

  private async processIncomingNotification(notification: RealtimeNotification) {
    // Add to notification list
    this.incomingNotifications.update(notifications => [notification, ...notifications]);
    
    // Show immediate notification based on priority
    if (notification.priority === 'urgent') {
      await this.showUrgentNotification(notification);
    } else if (notification.priority === 'high') {
      await this.showHighPriorityNotification(notification);
    } else {
      await this.showRegularNotification(notification);
    }
    
    // Emit event for components to react
    this.notificationReceived.next(notification);
    
    // Update app state if needed
    this.updateAppStateFromNotification(notification);
  }

  private async showUrgentNotification(notification: RealtimeNotification) {
    // Use different strategies based on platform
    if (this.platform.is('hybrid')) {
      await this.showMobileNotification(notification, {
        sound: 'default',
        vibrate: [200, 100, 200],
        priority: 5,
        ongoing: true
      });
    } else {
      await this.showWebNotification(notification);
      
      // Also show in-app alert for urgent notifications
      this.notificationService.showConfirmation({
        header: '🚨 Dringende Benachrichtigung',
        message: `${notification.title}\n\n${notification.message}`,
        buttons: [
          {
            text: 'Später',
            role: 'cancel'
          },
          {
            text: 'Jetzt anzeigen',
            handler: () => this.navigateToNotification(notification)
          }
        ]
      });
    }
  }

  private async showHighPriorityNotification(notification: RealtimeNotification) {
    if (this.platform.is('hybrid')) {
      await this.showMobileNotification(notification, {
        sound: 'default',
        priority: 3
      });
    } else {
      await this.showWebNotification(notification);
    }
    
    // Show toast notification
    this.notificationService.showToast({
      message: `${notification.title}: ${notification.message}`,
      duration: 5000,
      color: 'warning',
      position: 'top',
      buttons: notification.requiresAction ? [
        {
          text: 'Anzeigen',
          handler: () => this.navigateToNotification(notification)
        }
      ] : undefined
    });
  }

  private async showRegularNotification(notification: RealtimeNotification) {
    if (this.platform.is('hybrid')) {
      await this.showMobileNotification(notification);
    }
    
    // Show subtle toast
    this.notificationService.showToast({
      message: notification.title,
      duration: 3000,
      color: 'primary',
      position: 'bottom'
    });
  }

  private async showMobileNotification(notification: RealtimeNotification, options: any = {}) {
    if (!this.pushNotificationsEnabled()) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: parseInt(notification.id.slice(-6), 16), // Convert to number
          title: notification.title,
          body: notification.message,
          schedule: { at: new Date(Date.now() + 1000) }, // Show immediately
          sound: options.sound || undefined,
          attachments: options.attachments || undefined,
          actionTypeId: notification.requiresAction ? 'action_required' : undefined,
          extra: {
            notificationId: notification.id,
            actionUrl: notification.actionUrl,
            type: notification.type
          },
          ...options
        }]
      });
    } catch (error) {
      console.error('Error scheduling mobile notification:', error);
    }
  }

  private async showWebNotification(notification: RealtimeNotification) {
    if (!this.pushNotificationsEnabled() || !('Notification' in window)) return;

    try {
      const webNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/icon/favicon.png',
        badge: '/assets/icon/badge.png',
        tag: notification.id,
        data: notification,
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'low'
      });

      webNotification.onclick = () => {
        this.navigateToNotification(notification);
        webNotification.close();
      };

      // Auto-close after 10 seconds unless urgent
      if (notification.priority !== 'urgent') {
        setTimeout(() => webNotification.close(), 10000);
      }
    } catch (error) {
      console.error('Error showing web notification:', error);
    }
  }

  private async setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'BACKGROUND_SYNC':
        this.handleBackgroundSync(data);
        break;
      case 'PUSH_NOTIFICATION':
        this.handlePushNotification(data);
        break;
    }
  }

  private handleBackgroundSync(data: any) {
    // Handle background synchronization
    this.appStateService.refreshAllData();
  }

  private handlePushNotification(data: any) {
    // Handle push notification from service worker
    const notification: RealtimeNotification = {
      ...data,
      id: this.generateNotificationId(),
      timestamp: new Date()
    };
    
    this.processIncomingNotification(notification);
  }

  private handleLocalNotificationReceived(notification: any) {
  }

  private handleNotificationAction(notification: any) {
    const extra = notification.notification.extra;
    if (extra?.actionUrl) {
      this.navigateToNotification({
        ...extra,
        actionUrl: extra.actionUrl
      } as RealtimeNotification);
    }
  }

  private navigateToNotification(notification: RealtimeNotification) {
    if (notification.actionUrl) {
      // Use Angular Router to navigate
      window.location.hash = notification.actionUrl;
    }
  }

  private updateAppStateFromNotification(notification: RealtimeNotification) {
    // Trigger app state refresh for relevant notifications
    switch (notification.type) {
      case 'absence_request':
      case 'absence_approval':
        this.appStateService.refreshAllData();
        break;
      case 'sofortmeldung':
        this.appStateService.refreshAllData();
        break;
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async sendTestNotification() {
    const testNotification: RealtimeNotification = {
      id: this.generateNotificationId(),
      type: 'system',
      title: 'Test Benachrichtigung',
      message: 'Dies ist eine Test-Benachrichtigung für das Real-time System.',
      timestamp: new Date(),
      priority: 'normal'
    };

    await this.processIncomingNotification(testNotification);
  }

  markNotificationAsRead(notificationId: string) {
    this.incomingNotifications.update(notifications =>
      notifications.map(n =>
        n.id === notificationId
          ? { ...n, data: { ...n.data, read: true } }
          : n
      )
    );
  }

  clearAllNotifications() {
    this.incomingNotifications.set([]);
  }

  getNotificationStream() {
    return this.notificationReceived.asObservable();
  }

  getConnectionStateStream() {
    return this.connectionStateChanged.asObservable();
  }

  // Enable/disable push notifications
  async togglePushNotifications(enabled: boolean) {
    if (enabled && this.notificationPermission() === 'default') {
      if (this.platform.is('hybrid')) {
        const permission = await LocalNotifications.requestPermissions();
        this.notificationPermission.set(permission.display);
        this.pushNotificationsEnabled.set(permission.display === 'granted');
      } else if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        this.notificationPermission.set(permission);
        this.pushNotificationsEnabled.set(permission === 'granted');
      }
    } else {
      this.pushNotificationsEnabled.set(enabled && this.notificationPermission() === 'granted');
    }
  }

  // Get notification statistics
  getNotificationStats() {
    const notifications = this.incomingNotifications();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: notifications.length,
      unread: this.unreadNotifications().length,
      urgent: this.urgentNotifications().length,
      today: notifications.filter(n => n.timestamp >= today).length,
      byType: notifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
