import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { OrganizationService } from '../../../../core/services/organization.service';
import { MemberSpecialty, Specialty, ProficiencyLevel } from '../../../../models/organization.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-member-specialty-modal',
  templateUrl: './member-specialty-modal.component.html',
  styleUrls: ['./member-specialty-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class MemberSpecialtyModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() memberSpecialty?: MemberSpecialty;
  @Input() memberId?: number;
  @Input() departmentId?: number;

  formData = signal<Partial<MemberSpecialty>>({
    member: undefined,
    specialty: undefined,
    proficiency_level: ProficiencyLevel.INTERMEDIATE,
    is_primary: false,
    notes: '',
    valid_from: null,
    valid_until: null,
    is_active: true
  });

  specialties = signal<Specialty[]>([]);
  isSaving = signal<boolean>(false);
  
  proficiencyLevels = [
    { value: ProficiencyLevel.BASIC, label: 'Grundkenntnisse', icon: 'battery-half-outline' },
    { value: ProficiencyLevel.INTERMEDIATE, label: 'Fortgeschritten', icon: 'battery-charging-outline' },
    { value: ProficiencyLevel.ADVANCED, label: 'Erweitert', icon: 'battery-full-outline' },
    { value: ProficiencyLevel.EXPERT, label: 'Experte', icon: 'sparkles-outline' }
  ];

  constructor(
    private modalController: ModalController,
    private organizationService: OrganizationService,
    private toastController: ToastController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.memberSpecialty) {
      this.formData.set({ ...this.memberSpecialty });
    } else if (this.mode === 'create' && this.memberId) {
      this.formData.update(data => ({ ...data, member: this.memberId }));
    }
    
    this.loadSpecialties();
  }

  loadSpecialties() {
    const departmentId = this.departmentId;
    
    this.organizationService.getSpecialties(departmentId).subscribe({
      next: (data) => {
        this.specialties.set(data.filter(s => s.is_active));
      },
      error: (error) => {
        console.error('Error loading specialties:', error);
        this.showToast('Fehler beim Laden der Fachbereiche', 'danger');
      }
    });
  }

  async save() {
    const data = this.formData();
    
    // Validation
    if (!data.specialty || !data.member) {
      await this.showToast('Bitte wählen Sie einen Fachbereich', 'warning');
      return;
    }

    this.isSaving.set(true);

    const request = this.mode === 'create'
      ? this.organizationService.createMemberSpecialty(data)
      : this.organizationService.updateMemberSpecialty(this.memberSpecialty!.id, data);

    request.subscribe({
      next: async () => {
        await this.showToast(
          this.mode === 'create' ? 'Fachbereich zugeordnet' : 'Fachbereich aktualisiert',
          'success'
        );
        this.modalController.dismiss({ reload: true });
      },
      error: async (error) => {
        console.error('Error saving member specialty:', error);
        await this.showToast('Fehler beim Speichern', 'danger');
        this.isSaving.set(false);
      }
    });
  }

  cancel() {
    this.modalController.dismiss();
  }

  updateFormField(field: keyof MemberSpecialty, value: any) {
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  getProficiencyIcon(level: ProficiencyLevel): string {
    const item = this.proficiencyLevels.find(p => p.value === level);
    return item?.icon || 'battery-half-outline';
  }

  async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
