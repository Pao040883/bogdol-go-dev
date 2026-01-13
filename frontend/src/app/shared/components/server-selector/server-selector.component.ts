import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonItem, 
  IonLabel, 
  IonList, 
  IonRadio, 
  IonRadioGroup, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonBadge
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { EnvironmentService } from '../../../core/services/environment.service';

@Component({
  selector: 'app-server-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonList,
    IonRadio,
    IonRadioGroup,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonBadge
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Server-Konfiguration</ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <p>Aktuelle API URL: <ion-badge color="primary">{{ envService.apiUrl() }}</ion-badge></p>
        
        <ion-radio-group [(ngModel)]="selectedUrl" (ionChange)="onServerChange($event)">
          <ion-list>
            @for (config of envService.serverConfigs; track config.url) {
              <ion-item>
                <ion-radio slot="start" [value]="config.url"></ion-radio>
                <ion-label>
                  <h3>{{ config.name }}</h3>
                  <p>{{ config.url }}</p>
                  @if (connectionStatus[config.url] !== undefined) {
                    <ion-badge [color]="connectionStatus[config.url] ? 'success' : 'danger'">
                      {{ connectionStatus[config.url] ? 'Erreichbar' : 'Nicht erreichbar' }}
                    </ion-badge>
                  }
                </ion-label>
              </ion-item>
            }
          </ion-list>
        </ion-radio-group>
        
        <div class="ion-margin-top">
          <ion-button 
            expand="block" 
            fill="outline" 
            (click)="testAllConnections()"
            [disabled]="isTesting"
          >
            <ion-icon name="refresh-outline" slot="start"></ion-icon>
            {{ isTesting ? 'Teste...' : 'Alle Server testen' }}
          </ion-button>
          
          <ion-button 
            expand="block" 
            color="secondary"
            (click)="autoConfigureServer()"
            [disabled]="isAutoConfiguring"
          >
            <ion-icon name="flash-outline" slot="start"></ion-icon>
            {{ isAutoConfiguring ? 'Konfiguriere...' : 'Auto-Konfiguration' }}
          </ion-button>
          
          <ion-button 
            expand="block" 
            color="tertiary"
            fill="clear"
            (click)="resetToDefault()"
          >
            <ion-icon name="home-outline" slot="start"></ion-icon>
            Auf Standard zurücksetzen
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    ion-badge {
      margin-left: 8px;
    }
    
    .ion-margin-top {
      margin-top: 16px;
    }
    
    ion-button {
      margin-bottom: 8px;
    }
  `]
})
export class ServerSelectorComponent {
  envService = inject(EnvironmentService);
  
  selectedUrl = this.envService.apiUrl();
  connectionStatus: { [url: string]: boolean } = {};
  isTesting = false;
  isAutoConfiguring = false;

  async onServerChange(event: any) {
    const newUrl = event.detail.value;
    this.envService.setApiUrl(newUrl);
    this.selectedUrl = newUrl;
  }

  async testAllConnections() {
    this.isTesting = true;
    this.connectionStatus = {};
    
    for (const config of this.envService.serverConfigs) {
      try {
        const isReachable = await this.envService.testApiConnection(config.url);
        this.connectionStatus[config.url] = isReachable;
      } catch {
        this.connectionStatus[config.url] = false;
      }
    }
    
    this.isTesting = false;
  }

  async autoConfigureServer() {
    this.isAutoConfiguring = true;
    
    try {
      await this.envService.autoConfigureServer();
      this.selectedUrl = this.envService.apiUrl();
    } catch (error) {
      console.error('Auto-Konfiguration fehlgeschlagen:', error);
    }
    
    this.isAutoConfiguring = false;
  }

  resetToDefault() {
    this.envService.resetApiUrl();
    this.selectedUrl = this.envService.apiUrl();
  }
}
