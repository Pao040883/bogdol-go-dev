import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonBadge,
  IonToggle,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  settingsOutline, 
  moonOutline, 
  sunnyOutline, 
  globeOutline,
  notificationsOutline,
  speedometerOutline,
  wifiOutline,
  refreshOutline,
  informationCircleOutline,
  analyticsOutline
} from 'ionicons/icons';
import { ModernAppStateService } from '../../../core/services/modern-app-state.service';

/**
 * Moderne Angular 20 Komponente
 * Demonstriert Best Practices:
 * - Signals für reactivity
 * - inject() für Dependency Injection 
 * - OnPush Change Detection
 * - Standalone Components
 * - Computed Properties
 */
@Component({
  selector: 'app-modern-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonButton,
    IonIcon,
    IonBadge,
    IonToggle,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption
  ],
  template: `
    <ion-card class="modern-settings-card">
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="settings-outline"></ion-icon>
          Moderne Einstellungen
          <ion-badge 
            [color]="healthStatusColor()"
            slot="end">
            {{ healthStatusText() }}
          </ion-badge>
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- System Status -->
        <div class="status-section">
          <h3>System Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <ion-icon 
                [name]="isOnline() ? 'wifi-outline' : 'wifi-outline'"
                [color]="isOnline() ? 'success' : 'danger'">
              </ion-icon>
              <span>{{ isOnline() ? 'Online' : 'Offline' }}</span>
            </div>

            <div class="status-item">
              <ion-icon name="speedometer-outline" color="primary"></ion-icon>
              <span>{{ averageResponseTime() }}ms</span>
            </div>

            <div class="status-item">
              <ion-icon name="analytics-outline" color="secondary"></ion-icon>
              <span>{{ errorRate() }}% Fehler</span>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <ion-list>
          <ion-item>
            <ion-icon name="moon-outline" slot="start"></ion-icon>
            <ion-label>
              <h3>Theme</h3>
              <p>{{ currentThemeText() }}</p>
            </ion-label>
            <ion-select 
              [value]="currentTheme()"
              (ionChange)="onThemeChange($event)"
              slot="end">
              <ion-select-option value="light">Hell</ion-select-option>
              <ion-select-option value="dark">Dunkel</ion-select-option>
              <ion-select-option value="auto">Automatisch</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-icon name="globe-outline" slot="start"></ion-icon>
            <ion-label>
              <h3>Sprache</h3>
              <p>{{ currentLanguage() }}</p>
            </ion-label>
            <ion-select 
              [value]="currentLanguage()"
              (ionChange)="onLanguageChange($event)"
              slot="end">
              <ion-select-option value="de">Deutsch</ion-select-option>
              <ion-select-option value="en">English</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-icon name="notifications-outline" slot="start"></ion-icon>
            <ion-label>
              <h3>Benachrichtigungen</h3>
              <p>Push-Nachrichten erhalten</p>
            </ion-label>
            <ion-toggle 
              [checked]="notificationsEnabled()"
              (ionChange)="onNotificationsToggle($event)"
              slot="end">
            </ion-toggle>
          </ion-item>

          <ion-item>
            <ion-icon name="speedometer-outline" slot="start"></ion-icon>
            <ion-label>
              <h3>Analytics</h3>
              <p>Performance-Tracking aktivieren</p>
            </ion-label>
            <ion-toggle 
              [checked]="analyticsEnabled()"
              (ionChange)="onAnalyticsToggle($event)"
              slot="end">
            </ion-toggle>
          </ion-item>
        </ion-list>

        <!-- Actions -->
        <div class="action-buttons">
          <ion-button 
            (click)="syncData()" 
            [disabled]="isLoading()"
            fill="outline"
            size="small">
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            Synchronisieren
          </ion-button>

          <ion-button 
            (click)="resetSettings()" 
            fill="clear" 
            color="medium"
            size="small">
            Zurücksetzen
          </ion-button>
        </div>

        <!-- Advanced Features Notice -->
        <div class="feature-notice" *ngIf="!canUseAdvancedFeatures()">
          <ion-icon name="information-circle-outline" color="warning"></ion-icon>
          <p>Erweiterte Features sind aufgrund der aktuellen Systemleistung deaktiviert.</p>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .modern-settings-card {
      margin: 16px;
    }

    .status-section {
      margin-bottom: 24px;
    }

    .status-section h3 {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--ion-color-dark);
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 8px;
      font-size: 0.9em;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .feature-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      background: var(--ion-color-warning-tint);
      border-radius: 8px;
      border-left: 4px solid var(--ion-color-warning);
    }

    .feature-notice p {
      margin: 0;
      font-size: 0.9em;
      color: var(--ion-color-warning-shade);
    }

    ion-list {
      background: transparent;
    }

    ion-item {
      --inner-padding-end: 0;
      --padding-start: 0;
    }

    @media (max-width: 768px) {
      .status-grid {
        grid-template-columns: 1fr;
      }
      
      .action-buttons {
        flex-direction: column;
      }
    }
  `]
})
export class ModernSettingsComponent {
  private readonly appStateService = inject(ModernAppStateService);

  // ✅ Lokale Signals für UI State
  private readonly _selectedTheme = signal<'light' | 'dark' | 'auto'>('auto');

  // ✅ Computed Properties basierend auf Service Signals
  readonly settings = this.appStateService.settings;
  readonly systemStatus = this.appStateService.systemStatus;
  readonly isLoading = this.appStateService.isLoading;
  readonly canUseAdvancedFeatures = this.appStateService.canUseAdvancedFeatures;

  // ✅ Abgeleitete Computed Properties
  readonly currentTheme = computed(() => this.settings().theme);
  readonly currentLanguage = computed(() => this.settings().language);
  readonly notificationsEnabled = computed(() => this.settings().notifications);
  readonly analyticsEnabled = computed(() => this.settings().performance.enableAnalytics);

  readonly isOnline = computed(() => this.systemStatus().isOnline);
  readonly averageResponseTime = computed(() => 
    Math.round(this.systemStatus().performance.averageResponseTime)
  );
  readonly errorRate = computed(() => 
    Math.round(this.systemStatus().performance.errorRate * 10) / 10
  );

  readonly currentThemeText = computed(() => {
    const theme = this.currentTheme();
    switch (theme) {
      case 'light': return 'Helles Design';
      case 'dark': return 'Dunkles Design';
      case 'auto': return 'Automatisch (System)';
      default: return 'Unbekannt';
    }
  });

  readonly healthStatusColor = computed(() => {
    if (!this.isOnline()) return 'danger';
    if (this.errorRate() > 5) return 'warning';
    if (this.averageResponseTime() > 1000) return 'warning';
    return 'success';
  });

  readonly healthStatusText = computed(() => {
    if (!this.isOnline()) return 'Offline';
    if (this.errorRate() > 5 || this.averageResponseTime() > 1000) return 'Langsam';
    return 'Optimal';
  });

  constructor() {
    // ✅ Icons registrieren
    addIcons({
      settingsOutline,
      moonOutline,
      sunnyOutline,
      globeOutline,
      notificationsOutline,
      speedometerOutline,
      wifiOutline,
      refreshOutline,
      informationCircleOutline,
      analyticsOutline
    });
  }

  // ✅ Event Handler Methods
  onThemeChange(event: any): void {
    const theme = event.detail.value as 'light' | 'dark' | 'auto';
    this.appStateService.updateSettings({ theme });
  }

  onLanguageChange(event: any): void {
    const language = event.detail.value as string;
    this.appStateService.updateSettings({ language });
  }

  onNotificationsToggle(event: any): void {
    const notifications = event.detail.checked as boolean;
    this.appStateService.updateSettings({ notifications });
  }

  onAnalyticsToggle(event: any): void {
    const enableAnalytics = event.detail.checked as boolean;
    this.appStateService.updateSettings({
      performance: {
        ...this.settings().performance,
        enableAnalytics
      }
    });
  }

  syncData(): void {
    this.appStateService.syncWithServer();
  }

  resetSettings(): void {
    this.appStateService.updateSettings({
      theme: 'auto',
      language: 'de',
      notifications: true,
      performance: {
        enableAnalytics: true,
        cacheTimeout: 300000
      }
    });
  }
}
