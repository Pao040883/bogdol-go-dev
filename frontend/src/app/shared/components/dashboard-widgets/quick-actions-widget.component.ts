import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { addIcons } from 'ionicons';
import { 
  calendar, 
  alertCircle, 
  people, 
  documents, 
  analytics,
  settings,
  addCircle,
  checkboxOutline
} from 'ionicons/icons';

interface QuickAction {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route?: string;
  action?: () => void;
  permission?: string;
}

@Component({
  selector: 'app-quick-actions-widget',
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="add-circle"></ion-icon>
          Schnellzugriff
        </ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <ion-col size="6" *ngFor="let action of quickActions; let i = index">
              <ion-button 
                expand="block" 
                fill="outline" 
                [color]="action.color"
                [routerLink]="action.route"
                (click)="action.action && action.action()"
                class="quick-action-btn">
                <div class="action-content">
                  <ion-icon [name]="action.icon" class="action-icon"></ion-icon>
                  <div class="action-text">
                    <div class="action-title">{{ action.title }}</div>
                    <div class="action-subtitle">{{ action.subtitle }}</div>
                  </div>
                </div>
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>
        
        <div class="recent-activities" *ngIf="recentActivities.length > 0">
          <h4>Letzte Aktivitäten</h4>
          <div class="activity-list">
            <div *ngFor="let activity of recentActivities.slice(0, 3)" class="activity-item">
              <ion-icon [name]="activity.icon" [color]="activity.color"></ion-icon>
              <div class="activity-content">
                <div class="activity-text">{{ activity.text }}</div>
                <div class="activity-time">{{ activity.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .quick-action-btn {
      height: auto;
      --padding-top: 1rem;
      --padding-bottom: 1rem;
      margin-bottom: 0.5rem;
    }
    
    .action-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }
    
    .action-icon {
      font-size: 1.5rem;
    }
    
    .action-text {
      text-align: center;
    }
    
    .action-title {
      font-weight: 600;
      font-size: 0.875rem;
      line-height: 1.2;
    }
    
    .action-subtitle {
      font-size: 0.75rem;
      opacity: 0.7;
      line-height: 1.2;
    }
    
    .recent-activities {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--ion-color-light);
    }
    
    .recent-activities h4 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      color: var(--ion-color-dark);
    }
    
    .activity-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    
    .activity-content {
      flex: 1;
    }
    
    .activity-text {
      font-size: 0.875rem;
      color: var(--ion-color-dark);
    }
    
    .activity-time {
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }
    
    ion-card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    IonCard, 
    IonCardContent, 
    IonCardHeader, 
    IonCardTitle, 
    IonButton, 
    IonIcon,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class QuickActionsWidgetComponent {
  private notificationService = inject(NotificationService);
  
  quickActions: QuickAction[] = [
    {
      title: 'Urlaub',
      subtitle: 'beantragen',
      icon: 'calendar',
      color: 'primary',
      route: '/apps/absences'
    },
    {
      title: 'Sofort-',
      subtitle: 'meldung',
      icon: 'alert-circle',
      color: 'warning',
      route: '/apps/sofo'
    },
    {
      title: 'Team',
      subtitle: 'anzeigen',
      icon: 'people',
      color: 'secondary',
      route: '/apps/contacts'
    },
    {
      title: 'Berichte',
      subtitle: 'erstellen',
      icon: 'analytics',
      color: 'tertiary',
      route: '/evaluations'
    },
    {
      title: 'Genehmi-',
      subtitle: 'gungen',
      icon: 'checkbox-outline',
      color: 'success',
      route: '/apps/absences/approval'
    },
    {
      title: 'Test',
      subtitle: 'Phase 1',
      icon: 'settings',
      color: 'medium',
      route: '/phase1-test'
    }
  ];
  
  recentActivities = [
    {
      icon: 'calendar',
      color: 'primary',
      text: 'Urlaubsantrag eingereicht',
      time: 'vor 2 Stunden'
    },
    {
      icon: 'checkmark-circle',
      color: 'success', 
      text: 'Antrag von Max Mustermann genehmigt',
      time: 'vor 1 Tag'
    },
    {
      icon: 'alert-circle',
      color: 'warning',
      text: 'Neue Sofortmeldung erhalten',
      time: 'vor 2 Tagen'
    }
  ];
  
  constructor() {
    addIcons({ 
      calendar, 
      alertCircle, 
      people, 
      documents, 
      analytics,
      settings,
      addCircle,
      checkboxOutline
    });
  }
}
