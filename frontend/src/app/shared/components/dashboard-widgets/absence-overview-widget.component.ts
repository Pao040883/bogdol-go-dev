import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonIcon, IonBadge, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { AbsenceManagementService } from '../../../features/absence-management/absence-management.service';
import { addIcons } from 'ionicons';
import { calendar, checkmark, close, time } from 'ionicons/icons';

@Component({
  selector: 'app-absence-overview-widget',
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="calendar"></ion-icon>
          Urlaubsübersicht
        </ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">{{ stats().total }}</div>
            <div class="stat-label">Gesamt</div>
          </div>
          
          <div class="stat-item pending">
            <div class="stat-number">
              {{ stats().pending }}
              <ion-badge color="warning" *ngIf="stats().pending > 0">
                <ion-icon name="time"></ion-icon>
              </ion-badge>
            </div>
            <div class="stat-label">Ausstehend</div>
          </div>
          
          <div class="stat-item approved">
            <div class="stat-number">
              {{ stats().approved }}
              <ion-badge color="success" *ngIf="stats().approved > 0">
                <ion-icon name="checkmark"></ion-icon>
              </ion-badge>
            </div>
            <div class="stat-label">Genehmigt</div>
          </div>
          
          <div class="stat-item current-month">
            <div class="stat-number">{{ stats().currentMonth }}</div>
            <div class="stat-label">Dieser Monat</div>
          </div>
        </div>
        
        <div class="quick-actions" *ngIf="pendingApprovals().length > 0">
          <h4>Ausstehende Genehmigungen</h4>
          <ion-list>
            <ion-item *ngFor="let absence of pendingApprovals().slice(0, 3); let i = index" 
                     [routerLink]="['/apps/absences/approval']">
              <ion-label>
                <h3>{{ absence.user.first_name }} {{ absence.user.last_name }}</h3>
                <p>{{ absence.start_date | date }} - {{ absence.end_date | date }}</p>
              </ion-label>
              <ion-badge slot="end" color="warning">Pending</ion-badge>
            </ion-item>
          </ion-list>
          
          <ion-button 
            *ngIf="pendingApprovals().length > 3"
            expand="block" 
            fill="outline" 
            size="small"
            [routerLink]="['/apps/absences/approval']">
            Alle {{ pendingApprovals().length }} anzeigen
          </ion-button>
        </div>
        
        <div class="widget-actions">
          <ion-button 
            fill="outline" 
            size="small"
            [routerLink]="['/apps/absences']">
            Alle Abwesenheiten
          </ion-button>
          
          <ion-button 
            fill="outline" 
            size="small"
            (click)="exportData()">
            Export
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .stat-item {
      text-align: center;
      padding: 1rem;
      border-radius: 8px;
      background: var(--ion-color-light);
    }
    
    .stat-number {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--ion-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: var(--ion-color-medium);
      margin-top: 0.25rem;
    }
    
    .stat-item.pending .stat-number {
      color: var(--ion-color-warning);
    }
    
    .stat-item.approved .stat-number {
      color: var(--ion-color-success);
    }
    
    .quick-actions {
      margin: 1rem 0;
    }
    
    .quick-actions h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      color: var(--ion-color-dark);
    }
    
    .widget-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .widget-actions ion-button {
      flex: 1;
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
    IonBadge,
    IonList,
    IonItem,
    IonLabel
  ]
})
export class AbsenceOverviewWidgetComponent {
  private absenceManagement = inject(AbsenceManagementService);
  
  readonly stats = this.absenceManagement.stats$;
  readonly pendingApprovals = this.absenceManagement.pendingApprovals$;
  
  constructor() {
    addIcons({ calendar, checkmark, close, time });
  }
  
  async exportData(): Promise<void> {
    await this.absenceManagement.exportAbsences(false);
  }
}
