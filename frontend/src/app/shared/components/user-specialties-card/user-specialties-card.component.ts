import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonLabel,
  IonIcon,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  starOutline, 
  star, 
  batteryHalfOutline,
  sparklesOutline,
  flashOutline,
  ribbonOutline,
  calendarOutline,
} from 'ionicons/icons';
import { OrganizationService } from '../../../core/services/organization.service';
import { MemberSpecialty } from '../../../models/organization.model';

@Component({
  selector: 'app-user-specialties-card',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonLabel,
    IonIcon,
    IonSpinner,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="ribbon-outline"></ion-icon>
          Fachbereiche
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @if (isLoading()) {
          <div class="loading-container">
            <ion-spinner></ion-spinner>
            <p>Lade Fachbereiche...</p>
          </div>
        } @else if (specialties().length === 0) {
          <div class="empty-state">
            <ion-icon name="ribbon-outline"></ion-icon>
            <p>Keine Fachbereiche zugeordnet</p>
          </div>
        } @else {
          <div class="specialties-list">
            @for (specialty of specialties(); track specialty.id) {
              <div class="specialty-item" [class.primary]="specialty.is_primary" [class.inactive]="!specialty.is_active">
                <div class="specialty-header">
                  <div class="specialty-name">
                    @if (specialty.is_primary) {
                      <ion-icon name="star" class="primary-icon"></ion-icon>
                    }
                    {{ specialty.specialty_data?.name || 'Unbekannt' }}
                  </div>
                  <ion-chip [color]="getProficiencyColor(specialty.proficiency_level)">
                    <ion-icon [name]="getProficiencyIcon(specialty.proficiency_level)"></ion-icon>
                    <ion-label>{{ getProficiencyLabel(specialty.proficiency_level) }}</ion-label>
                  </ion-chip>
                </div>
                
                @if (specialty.specialty_data?.code) {
                  <div class="specialty-code">Code: {{ specialty.specialty_data?.code }}</div>
                }
                
                @if (specialty.valid_from || specialty.valid_until) {
                  <div class="validity-dates">
                    <ion-icon name="calendar-outline"></ion-icon>
                    @if (specialty.valid_from) {
                      <span>Von: {{ specialty.valid_from | date: 'dd.MM.yyyy' }}</span>
                    }
                    @if (specialty.valid_until) {
                      <span>Bis: {{ specialty.valid_until | date: 'dd.MM.yyyy' }}</span>
                    }
                  </div>
                }
                
                @if (specialty.notes) {
                  <div class="specialty-notes">{{ specialty.notes }}</div>
                }
              </div>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      
      ion-icon {
        font-size: 20px;
        color: var(--ion-color-primary);
      }
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      
      ion-spinner {
        margin-bottom: 10px;
      }
      
      p {
        color: var(--ion-color-medium);
        margin: 0;
      }
    }
    
    .empty-state {
      text-align: center;
      padding: 30px 20px;
      color: var(--ion-color-medium);
      
      ion-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      
      p {
        margin: 0;
        font-size: 14px;
      }
    }
    
    .specialties-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .specialty-item {
      padding: 12px;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 8px;
      background: var(--ion-color-light);
      transition: all 0.3s ease;
      
      &.primary {
        background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%);
        border-color: var(--ion-color-warning);
        border-width: 2px;
        
        .specialty-name {
          color: var(--ion-color-warning-shade);
          font-weight: 700;
        }
      }
      
      &.inactive {
        opacity: 0.6;
        
        .specialty-name {
          text-decoration: line-through;
        }
      }
    }
    
    .specialty-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .specialty-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--ion-color-dark);
      display: flex;
      align-items: center;
      gap: 6px;
      
      .primary-icon {
        color: var(--ion-color-warning);
        font-size: 18px;
      }
    }
    
    .specialty-code {
      font-size: 12px;
      color: var(--ion-color-medium);
      font-family: monospace;
      background: rgba(0, 0, 0, 0.05);
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 6px;
    }
    
    .validity-dates {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--ion-color-medium-shade);
      margin-top: 6px;
      
      ion-icon {
        font-size: 14px;
      }
      
      span {
        margin-right: 10px;
      }
    }
    
    .specialty-notes {
      margin-top: 8px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 4px;
      font-size: 13px;
      color: var(--ion-color-dark);
      font-style: italic;
    }
    
    ion-chip {
      margin: 0;
      height: 24px;
      
      ion-icon {
        font-size: 14px;
      }
      
      ion-label {
        font-size: 11px;
        font-weight: 600;
      }
    }
  `],
})
export class UserSpecialtiesCardComponent implements OnInit {
  @Input() userId?: number;
  @Input() memberId?: number;
  
  specialties = signal<MemberSpecialty[]>([]);
  isLoading = signal(false);

  constructor(private organizationService: OrganizationService) {
    addIcons({ 
      starOutline, 
      star, 
      batteryHalfOutline, 
      sparklesOutline, 
      flashOutline, 
      ribbonOutline,
      calendarOutline,
    });
  }

  ngOnInit() {
    this.loadSpecialties();
  }

  loadSpecialties() {
    if (!this.userId && !this.memberId) return;
    
    this.isLoading.set(true);
    
    const filters: any = {};
    if (this.memberId) filters.member_id = this.memberId;
    if (this.userId) filters.user_id = this.userId;
    
    this.organizationService.getMemberSpecialties(filters).subscribe({
      next: (data) => {
        this.specialties.set(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading member specialties:', error);
        this.isLoading.set(false);
      },
    });
  }

  getProficiencyLabel(level: number): string {
    switch (level) {
      case 1: return 'Grundkenntnisse';
      case 2: return 'Fortgeschritten';
      case 3: return 'Erweitert';
      case 4: return 'Experte';
      default: return 'Unbekannt';
    }
  }

  getProficiencyIcon(level: number): string {
    switch (level) {
      case 1: return 'battery-half-outline';
      case 2: return 'flash-outline';
      case 3: return 'sparkles-outline';
      case 4: return 'ribbon-outline';
      default: return 'help-outline';
    }
  }

  getProficiencyColor(level: number): string {
    switch (level) {
      case 1: return 'medium';
      case 2: return 'primary';
      case 3: return 'secondary';
      case 4: return 'success';
      default: return 'medium';
    }
  }
}
