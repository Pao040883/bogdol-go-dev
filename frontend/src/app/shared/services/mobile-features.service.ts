import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from './notification.service';

export interface DeviceInfo {
  platform: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  webViewVersion: string;
  manufacturer: string;
  isVirtual: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'de' | 'en';
  notifications: boolean;
  haptics: boolean;
  autoSync: boolean;
  offlineMode: boolean;
  biometricAuth: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MobileFeatureService {
  private platform = inject(Platform);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  // Device and network state
  private deviceInfo = signal<DeviceInfo | null>(null);
  private networkStatus = signal<NetworkStatus>({ connected: true, connectionType: 'unknown' });
  private isAppActive = signal(true);
  private batteryLevel = signal<number | null>(null);

  // App settings
  private appSettings = signal<AppSettings>({
    theme: 'auto',
    language: 'de',
    notifications: true,
    haptics: true,
    autoSync: true,
    offlineMode: false,
    biometricAuth: false
  });

  // Computed values
  isMobile = computed(() => this.platform.is('hybrid'));
  isOnline = computed(() => this.networkStatus().connected);
  canUseAdvancedFeatures = computed(() => 
    this.isMobile() && this.isOnline() && this.isAppActive()
  );

  // Platform capabilities
  capabilities = computed(() => ({
    hasCamera: this.platform.is('hybrid'),
    hasGeolocation: 'geolocation' in navigator,
    hasNotifications: this.platform.is('hybrid') || 'Notification' in window,
    hasHaptics: this.platform.is('hybrid'),
    hasShare: this.platform.is('hybrid') || !!navigator.share,
    hasFileSystem: this.platform.is('hybrid'),
    hasBiometrics: this.platform.is('hybrid'),
    hasStatusBar: this.platform.is('hybrid') && !this.platform.is('mobileweb')
  }));

  constructor() {
    this.initializeMobileFeatures();
    this.setupEffects();
  }

  private async initializeMobileFeatures() {

    if (this.platform.is('hybrid')) {
      await this.initializeCapacitorPlugins();
      await this.setupMobileEventListeners();
    }

    await this.loadAppSettings();
    await this.detectDeviceInfo();
    await this.setupNetworkMonitoring();
  }

  private async initializeCapacitorPlugins() {
    try {
      // Initialize status bar
      if (this.capabilities().hasStatusBar) {
        await StatusBar.setStyle({ style: this.appSettings().theme === 'dark' ? 'DARK' : 'LIGHT' });
        await StatusBar.setBackgroundColor({ color: '#3880ff' });
      }

      // Hide splash screen after initialization
      await SplashScreen.hide();

    } catch (error) {
      console.error('Error initializing Capacitor plugins:', error);
    }
  }

  private async setupMobileEventListeners() {
    // App state listeners
    App.addListener('appStateChange', ({ isActive }) => {
      this.isAppActive.set(isActive);
      
      if (isActive) {
        this.onAppResumed();
      } else {
        this.onAppPaused();
      }
    });

    // App URL listeners for deep links
    App.addListener('appUrlOpen', (event) => {
      this.handleDeepLink(event.url);
    });

    // Back button handling
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      }
    });

  }

  private async detectDeviceInfo() {
    if (this.platform.is('hybrid')) {
      try {
        const info = await Device.getInfo();
        this.deviceInfo.set({
          platform: info.platform,
          model: info.model,
          operatingSystem: info.operatingSystem,
          osVersion: info.osVersion,
          webViewVersion: info.webViewVersion,
          manufacturer: info.manufacturer,
          isVirtual: info.isVirtual
        });
        
      } catch (error) {
        console.error('Error detecting device info:', error);
      }
    }
  }

  private async setupNetworkMonitoring() {
    if (this.platform.is('hybrid')) {
      // Initial network status
      const status = await Network.getStatus();
      this.networkStatus.set({
        connected: status.connected,
        connectionType: status.connectionType
      });

      // Listen for network changes
      Network.addListener('networkStatusChange', (status) => {
        this.networkStatus.set({
          connected: status.connected,
          connectionType: status.connectionType
        });
        
        this.handleNetworkChange(status.connected);
      });
    } else {
      // Web fallback
      window.addEventListener('online', () => {
        this.networkStatus.set({ connected: true, connectionType: 'unknown' });
        this.handleNetworkChange(true);
      });
      
      window.addEventListener('offline', () => {
        this.networkStatus.set({ connected: false, connectionType: 'none' });
        this.handleNetworkChange(false);
      });
    }
  }

  private setupEffects() {
    // Auto-save settings when they change
    effect(() => {
      const settings = this.appSettings();
      this.saveAppSettings(settings);
    });

    // Apply theme changes
    effect(() => {
      const theme = this.appSettings().theme;
      this.applyTheme(theme);
    });

    // Handle haptics setting
    effect(() => {
      const hapticsEnabled = this.appSettings().haptics;
      if (this.platform.is('hybrid') && hapticsEnabled) {
        // Enable haptics
      }
    });
  }

  private async loadAppSettings() {
    try {
      const { value } = await Preferences.get({ key: 'app_settings' });
      if (value) {
        const settings = JSON.parse(value);
        this.appSettings.set({ ...this.appSettings(), ...settings });
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
    }
  }

  private async saveAppSettings(settings: AppSettings) {
    try {
      await Preferences.set({
        key: 'app_settings',
        value: JSON.stringify(settings)
      });
    } catch (error) {
      console.error('Error saving app settings:', error);
    }
  }

  private async applyTheme(theme: 'light' | 'dark' | 'auto') {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    document.body.classList.toggle('dark', isDark);
    
    if (this.capabilities().hasStatusBar) {
      try {
        await StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' });
      } catch (error) {
        console.error('Error setting status bar style:', error);
      }
    }
  }

  private onAppResumed() {
    // App came to foreground
    if (this.appSettings().autoSync) {
      // Trigger data sync
      this.triggerDataSync();
    }
    
    // Check for pending notifications
    this.checkPendingNotifications();
  }

  private onAppPaused() {
    // App went to background
    // Save any pending data
    this.savePendingData();
  }

  private handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.notificationService.showToast({
        message: 'Verbindung wiederhergestellt',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      
      if (this.appSettings().autoSync) {
        this.triggerDataSync();
      }
    } else {
      this.notificationService.showToast({
        message: 'Keine Internetverbindung',
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      
      // Enable offline mode if configured
      if (this.appSettings().offlineMode) {
        this.enableOfflineMode();
      }
    }
  }

  private handleDeepLink(url: string) {
    
    // Parse deep link and navigate accordingly
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const params = new URLSearchParams(urlObj.search);
      
      // Handle different deep link patterns
      if (path.includes('/absence/')) {
        const absenceId = params.get('id');
        if (absenceId) {
          // Navigate to absence detail
          window.location.hash = `/tabs/absences/detail/${absenceId}`;
        }
      } else if (path.includes('/sofortmeldung/')) {
        const sofoId = params.get('id');
        if (sofoId) {
          // Navigate to sofortmeldung detail
          window.location.hash = `/tabs/sofo/detail/${sofoId}`;
        }
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  }

  private async triggerDataSync() {
    // Implement data synchronization logic
    // This would typically refresh app state
  }

  private async checkPendingNotifications() {
    // Check for any pending notifications when app resumes
  }

  private async savePendingData() {
    // Save any unsaved data when app goes to background
  }

  private enableOfflineMode() {
    // Enable offline functionality
    this.appSettings.update(settings => ({ ...settings, offlineMode: true }));
  }

  // Public API methods

  async share(content: { title?: string; text?: string; url?: string; files?: string[] }) {
    if (!this.capabilities().hasShare) {
      throw new Error('Share functionality not available');
    }

    try {
      if (this.platform.is('hybrid')) {
        await Share.share(content);
      } else if (navigator.share) {
        await navigator.share(content);
      }
      
      await this.triggerHapticFeedback('light');
    } catch (error) {
      console.error('Error sharing content:', error);
      throw error;
    }
  }

  async triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.capabilities().hasHaptics || !this.appSettings().haptics) {
      return;
    }

    try {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      }[type];

      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  }

  async showAppInfo() {
    const info = await App.getInfo();
    const device = this.deviceInfo();
    
    return {
      appName: info.name,
      appVersion: info.version,
      buildNumber: info.build,
      device: device,
      network: this.networkStatus(),
      capabilities: this.capabilities()
    };
  }

  // Settings management
  updateSettings(updates: Partial<AppSettings>) {
    this.appSettings.update(current => ({ ...current, ...updates }));
  }

  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.appSettings()[key];
  }

  // Utility methods
  async copyToClipboard(text: string) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      this.notificationService.showToast({
        message: 'In Zwischenablage kopiert',
        duration: 2000,
        color: 'success'
      });
      
      await this.triggerHapticFeedback('light');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      throw error;
    }
  }

  async requestPermissions() {
    const permissions = [];
    
    if (this.platform.is('hybrid')) {
      // Request various permissions
      try {
        // Camera permission would be requested here
        // Location permission would be requested here
        // etc.
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    }
    
    return permissions;
  }

  // Computed getters for components
  get settings() {
    return this.appSettings.asReadonly();
  }

  get device() {
    return this.deviceInfo.asReadonly();
  }

  get network() {
    return this.networkStatus.asReadonly();
  }

  get isActive() {
    return this.isAppActive.asReadonly();
  }
}
