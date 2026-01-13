import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MemberSpecialty, ProficiencyLevel } from '../../../models/organization.model';

@Component({
  selector: 'app-specialty-badge',
  template: `
    <ion-chip
      [color]="getColor()"
      [outline]="!specialty.is_primary"
      [class.primary-badge]="specialty.is_primary">
      <ion-icon
        *ngIf="specialty.is_primary"
        name="star"
        color="warning">
      </ion-icon>
      <ion-icon
        *ngIf="showProficiency"
        [name]="getProficiencyIcon()">
      </ion-icon>
      <ion-label>{{ specialty.specialty_data?.name || 'Unbekannt' }}</ion-label>
      <ion-badge *ngIf="showCode" color="light" class="code-badge">
        {{ specialty.specialty_data?.code }}
      </ion-badge>
    </ion-chip>
  `,
  styles: [`
    ion-chip {
      margin: 0.25rem;
      
      &.primary-badge {
        font-weight: 600;
        border: 2px solid var(--ion-color-warning);
      }

      .code-badge {
        margin-left: 0.25rem;
        font-family: 'Courier New', monospace;
        font-size: 0.7rem;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SpecialtyBadgeComponent {
  @Input() specialty!: MemberSpecialty;
  @Input() showProficiency = false;
  @Input() showCode = false;

  getColor(): string {
    if (!this.specialty.is_active) return 'medium';
    
    switch (this.specialty.proficiency_level) {
      case ProficiencyLevel.EXPERT: return 'success';
      case ProficiencyLevel.ADVANCED: return 'secondary';
      case ProficiencyLevel.INTERMEDIATE: return 'primary';
      case ProficiencyLevel.BASIC: return 'medium';
      default: return 'primary';
    }
  }

  getProficiencyIcon(): string {
    switch (this.specialty.proficiency_level) {
      case ProficiencyLevel.EXPERT: return 'sparkles';
      case ProficiencyLevel.ADVANCED: return 'battery-full';
      case ProficiencyLevel.INTERMEDIATE: return 'battery-charging';
      case ProficiencyLevel.BASIC: return 'battery-half';
      default: return 'battery-half';
    }
  }
}
