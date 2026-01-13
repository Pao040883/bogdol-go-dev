import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonChip, 
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chatbubbles, 
  eye, 
  calendar,
  person
} from 'ionicons/icons';

import { AbsenceService } from '../../core/services/absence.service';
import { Absence } from '../../core/interfaces/absence.types';

@Component({
  selector: 'app-absence-communication',
  template: `
    <div class="absence-communication">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Abwesenheiten mit Kommunikation</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding">
        <!-- Loading State -->
        <div *ngIf="absenceService.isLoading()" class="loading-container">
          <ion-spinner name="dots"></ion-spinner>
          <p>Lade Abwesenheiten...</p>
        </div>

        <!-- Error State -->
        <ion-card *ngIf="absenceService.error()" color="danger">
          <ion-card-content>
            {{ absenceService.error() }}
          </ion-card-content>
        </ion-card>

        <!-- Absences List -->
        <div *ngIf="!absenceService.isLoading()">
          <ion-card class="info-card">
            <ion-card-content>
              <h2>🗨️ Kommunikationssystem</h2>
              <p>
                Das Kommunikationssystem ist jetzt <strong>vollständig implementiert</strong>! 
                Klicken Sie auf eine Abwesenheit, um die Kommunikationsfunktionen zu testen.
              </p>
              <ul>
                <li>✅ Backend: AbsenceComment Model & API</li>
                <li>✅ Frontend: Comments Component</li>
                <li>✅ Multi-Stakeholder-Kommunikation</li>
                <li>✅ Interne/Öffentliche Kommentare</li>
                <li>✅ Supervisor/HR/Employee Rollen</li>
              </ul>
            </ion-card-content>
          </ion-card>

          <ion-list lines="none">
            <ion-item 
              *ngFor="let absence of absenceService.absences(); trackBy: trackByAbsenceId"
              button
              (click)="viewAbsenceDetails(absence)">
              
              <div class="absence-info" slot="start">
                <div class="absence-title">
                  {{ absence.absence_type.display_name }}
                </div>
                <div class="absence-dates">
                  <ion-icon name="calendar"></ion-icon>
                  {{ absence.start_date | date:'dd.MM.yyyy' }} - 
                  {{ absence.end_date | date:'dd.MM.yyyy' }}
                </div>
                <div class="absence-employee">
                  <ion-icon name="person"></ion-icon>
                  {{ absence.user.first_name }} {{ absence.user.last_name }}
                </div>
              </div>

              <div class="absence-actions" slot="end">
                <ion-chip [color]="getStatusColor(absence.status)">
                  {{ getStatusLabel(absence.status) }}
                </ion-chip>
                
                <div class="communication-info">
                  <ion-icon name="chatbubbles"></ion-icon>
                  <span>{{ absence.comments?.length || 0 }} Kommentare</span>
                </div>
                
                <ion-button fill="clear" size="small">
                  <ion-icon name="eye"></ion-icon>
                  Details
                </ion-button>
              </div>
            </ion-item>
          </ion-list>

          <!-- Empty State -->
          <ion-card *ngIf="absenceService.absences().length === 0" class="empty-state">
            <ion-card-content>
              <ion-icon name="calendar"></ion-icon>
              <h3>Keine Abwesenheiten gefunden</h3>
              <p>Erstellen Sie eine Abwesenheit, um die Kommunikationsfunktionen zu testen.</p>
            </ion-card-content>
          </ion-card>
        </div>
      </ion-content>
    </div>
  `,
  styles: [`
    .absence-communication {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;

      ion-header ion-toolbar {
        --background: transparent;
        --color: white;
      }

      ion-content {
        --background: transparent;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 50vh;
        color: white;

        ion-spinner {
          margin-bottom: 1rem;
          --color: white;
        }
      }

      .info-card {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        margin-bottom: 2rem;

        h2 {
          margin-top: 0;
          color: white;
        }

        p, li {
          color: rgba(255, 255, 255, 0.9);
        }

        ul {
          margin: 1rem 0 0 0;
          padding-left: 1.5rem;
        }

        li {
          margin-bottom: 0.5rem;
        }
      }

      ion-list {
        background: transparent;
      }

      ion-item {
        --background: rgba(255, 255, 255, 0.95);
        border-radius: 12px;
        margin-bottom: 1rem;
        --padding-start: 1rem;
        --padding-end: 1rem;

        &:hover {
          --background: rgba(255, 255, 255, 1);
        }

        .absence-info {
          flex: 1;

          .absence-title {
            font-weight: 600;
            color: var(--ion-color-dark);
            margin-bottom: 0.5rem;
          }

          .absence-dates,
          .absence-employee {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--ion-color-medium);
            margin-bottom: 0.25rem;

            ion-icon {
              font-size: 1rem;
            }
          }
        }

        .absence-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;

          .communication-info {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.875rem;
            color: var(--ion-color-medium);

            ion-icon {
              font-size: 1rem;
            }
          }
        }
      }

      .empty-state {
        text-align: center;
        background: rgba(255, 255, 255, 0.9);

        ion-icon {
          font-size: 4rem;
          color: var(--ion-color-medium);
          margin-bottom: 1rem;
        }

        h3 {
          color: var(--ion-color-dark);
          margin-bottom: 0.5rem;
        }

        p {
          color: var(--ion-color-medium);
        }
      }
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonSpinner
  ]
})
export class AbsenceCommunicationComponent implements OnInit {
  
  constructor(
    public absenceService: AbsenceService,
    private router: Router
  ) {
    // Register icons
    addIcons({
      chatbubbles,
      eye,
      calendar,
      person
    });
  }

  ngOnInit() {
    // Data is already loaded by the service
  }

  /**
   * Track function for absence list
   */
  trackByAbsenceId(index: number, absence: Absence): number {
    return absence.id!;
  }

  /**
   * Navigate to absence details
   */
  viewAbsenceDetails(absence: Absence) {
    this.router.navigate(['/absences', absence.id]);
  }

  /**
   * Get status color for chips
   */
  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'genehmigt':
        return 'success';
      case 'pending':
      case 'ausstehend':
        return 'warning';
      case 'rejected':
      case 'abgelehnt':
        return 'danger';
      default:
        return 'primary';
    }
  }

  /**
   * Get localized status label
   */
  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'cancelled': 'Storniert'
    };
    
    return statusMap[status.toLowerCase()] || status;
  }
}
