import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { OrganizationService } from '../../../core/services/organization.service';
import { MemberSpecialty, Specialty, ProficiencyLevel } from '../../../models/organization.model';
import { DepartmentMember } from '../../../models/department.model';
import { MemberSpecialtyModalComponent } from './modal/member-specialty-modal.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-member-specialties',
  templateUrl: './member-specialties.page.html',
  styleUrls: ['./member-specialties.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class MemberSpecialtiesPage implements OnInit {
  memberSpecialties = signal<MemberSpecialty[]>([]);
  member = signal<DepartmentMember | null>(null);
  memberId = signal<number | null>(null);
  
  isLoading = signal<boolean>(false);
  
  ProficiencyLevel = ProficiencyLevel;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['memberId'];
      if (id) {
        this.memberId.set(parseInt(id));
        this.loadMember();
        this.loadMemberSpecialties();
      }
    });
  }

  loadMember() {
    const id = this.memberId();
    if (!id) return;

    this.http.get<DepartmentMember>(`${environment.apiUrl}/auth_user/org-members/${id}/`).subscribe({
      next: (data) => {
        this.member.set(data);
      },
      error: (error) => {
        console.error('Error loading member:', error);
        this.showToast('Fehler beim Laden des Mitarbeiters', 'danger');
      }
    });
  }

  loadMemberSpecialties() {
    const id = this.memberId();
    if (!id) return;

    this.isLoading.set(true);
    this.organizationService.getMemberSpecialties({ member: id }).subscribe({
      next: (data) => {
        this.memberSpecialties.set(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading member specialties:', error);
        this.showToast('Fehler beim Laden der Fachbereiche', 'danger');
        this.isLoading.set(false);
      }
    });
  }

  async openAddModal() {
    const modal = await this.modalController.create({
      component: MemberSpecialtyModalComponent,
      componentProps: {
        mode: 'create',
        memberId: this.memberId(),
        departmentId: this.member()?.department
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.reload) {
        this.loadMemberSpecialties();
      }
    });

    return await modal.present();
  }

  async openEditModal(memberSpecialty: MemberSpecialty) {
    const modal = await this.modalController.create({
      component: MemberSpecialtyModalComponent,
      componentProps: {
        mode: 'edit',
        memberSpecialty: { ...memberSpecialty }
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.reload) {
        this.loadMemberSpecialties();
      }
    });

    return await modal.present();
  }

  async deleteMemberSpecialty(memberSpecialty: MemberSpecialty) {
    const alert = await this.alertController.create({
      header: 'Fachbereich entfernen',
      message: `Möchten Sie den Fachbereich "${memberSpecialty.specialty_data?.name}" wirklich entfernen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Entfernen',
          role: 'destructive',
          handler: () => {
            this.performDelete(memberSpecialty.id);
          }
        }
      ]
    });

    await alert.present();
  }

  performDelete(id: number) {
    this.organizationService.deleteMemberSpecialty(id).subscribe({
      next: () => {
        this.showToast('Fachbereich erfolgreich entfernt', 'success');
        this.loadMemberSpecialties();
      },
      error: (error) => {
        console.error('Error deleting member specialty:', error);
        this.showToast('Fehler beim Entfernen des Fachbereichs', 'danger');
      }
    });
  }

  async togglePrimary(memberSpecialty: MemberSpecialty) {
    // Set this as primary, unset all others
    this.organizationService.updateMemberSpecialty(memberSpecialty.id, {
      is_primary: true
    }).subscribe({
      next: () => {
        this.showToast('Primärer Fachbereich aktualisiert', 'success');
        this.loadMemberSpecialties();
      },
      error: (error) => {
        console.error('Error updating primary:', error);
        this.showToast('Fehler beim Aktualisieren', 'danger');
      }
    });
  }

  getProficiencyLabel(level: ProficiencyLevel): string {
    switch (level) {
      case ProficiencyLevel.BASIC: return 'Grundkenntnisse';
      case ProficiencyLevel.INTERMEDIATE: return 'Fortgeschritten';
      case ProficiencyLevel.ADVANCED: return 'Erweitert';
      case ProficiencyLevel.EXPERT: return 'Experte';
      default: return 'Unbekannt';
    }
  }

  getProficiencyColor(level: ProficiencyLevel): string {
    switch (level) {
      case ProficiencyLevel.BASIC: return 'medium';
      case ProficiencyLevel.INTERMEDIATE: return 'primary';
      case ProficiencyLevel.ADVANCED: return 'secondary';
      case ProficiencyLevel.EXPERT: return 'success';
      default: return 'medium';
    }
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
