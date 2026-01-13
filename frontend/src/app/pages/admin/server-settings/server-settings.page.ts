import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonChip,
  IonNote,
  IonText,
} from '@ionic/angular/standalone';
import { EnvironmentService } from 'src/app/core/services/environment.service';
import { ServerSelectorComponent } from 'src/app/shared/components/server-selector/server-selector.component';
import { serverOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-server-settings',
  templateUrl: './server-settings.page.html',
  styleUrls: ['./server-settings.page.scss'],
  standalone: true,
  imports: [
    IonText,
    IonNote,
    IonChip,
    IonIcon,
    IonButton,
    IonLabel,
    IonItem,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonCard,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    ServerSelectorComponent,
  ],
})
export class ServerSettingsPage {
  private envService = inject(EnvironmentService);

  // Readonly Signals für die View
  readonly currentServer = this.envService.currentServer;
  readonly apiUrl = this.envService.apiUrl;
  readonly isConnected = this.envService.isConnected;

  constructor() {
    addIcons({ serverOutline, checkmarkCircleOutline });
  }

  async testConnection() {
    await this.envService.testConnection();
  }

  resetToDefault() {
    this.envService.setApiUrl('http://127.0.0.1:8000/api');
  }
}
