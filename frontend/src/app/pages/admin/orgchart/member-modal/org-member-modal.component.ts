import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';

import { IntranetApiService } from '../../../../services/intranet-api.service';
import {
  Department,
  DepartmentRole,
  DepartmentMember
} from '../../../../models/intranet.models';

@Component({
  selector: 'app-org-member-modal',
  templateUrl: './org-member-modal.component.html',
  styleUrls: ['./org-member-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class OrgMemberModalComponent implements OnInit {
  @Input() member?: DepartmentMember;
  @Input() department!: Department;
  @Input() roles: DepartmentRole[] = [];
  @Input() users: any[] = [];
  @Input() existingMembers: DepartmentMember[] = [];

  isEditMode = false;
  availableUsers: any[] = [];
  sortedRoles: DepartmentRole[] = [];
  potentialSupervisors: DepartmentMember[] = [];

  formData = {
    id: 0,
    user: 0,
    department: 0,
    role: 0,
    position_title: '',
    reports_to: null as number | null,
    is_primary: true,
    is_staff_position: false,
    is_active: true,
    display_order: 0
  };

  constructor(
    private modalCtrl: ModalController,
    private apiService: IntranetApiService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.member;

    // Sort roles by hierarchy level
    this.sortedRoles = [...this.roles].sort((a, b) => a.hierarchy_level - b.hierarchy_level);

    // Filter potential supervisors (exclude self if editing)
    this.potentialSupervisors = this.existingMembers.filter(m => 
      this.isEditMode ? m.id !== this.member?.id : true
    );

    if (this.isEditMode && this.member) {
      this.formData = {
        id: this.member.id,
        user: this.member.user,
        department: this.member.department,
        role: this.member.role,
        position_title: this.member.position_title || '',
        reports_to: this.member.reports_to || null,
        is_primary: this.member.is_primary,
        is_staff_position: this.member.is_staff_position || false,
        is_active: this.member.is_active,
        display_order: this.member.display_order
      };
      // Only show active users in edit mode
      this.availableUsers = this.users.filter(u => u.is_active);
    } else {
      this.formData.department = this.department.id;
      // Filter out users who are already members and only show active users
      const memberUserIds = this.existingMembers.map(m => m.user);
      this.availableUsers = this.users.filter(u => u.is_active && !memberUserIds.includes(u.id));
    }
  }

  get selectedRole(): DepartmentRole | undefined {
    return this.roles.find(r => r.id === this.formData.role);
  }

  getRoleBadgeColor(level: number): string {
    if (level === 1) return 'danger';
    if (level === 2) return 'warning';
    if (level === 3) return 'primary';
    if (level === 4) return 'success';
    return 'medium';
  }

  isFormValid(): boolean {
    return this.formData.user > 0 && this.formData.role > 0;
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async save() {
    if (!this.isFormValid()) return;

    const payload = {
      user: this.formData.user,
      department: this.formData.department,
      role: this.formData.role,
      position_title: this.formData.position_title || '',
      reports_to: this.formData.reports_to,
      is_primary: this.formData.is_primary,
      is_staff_position: this.formData.is_staff_position,
      is_active: this.formData.is_active,
      display_order: this.formData.display_order
    };

    const request$ = this.isEditMode
      ? this.apiService.updateDepartmentMember(this.formData.id, payload)
      : this.apiService.createDepartmentMember(payload);

    request$.subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: this.isEditMode ? 'Mitglied aktualisiert' : 'Mitglied hinzugefügt',
          duration: 2000,
          color: 'success'
        });
        toast.present();
        this.modalCtrl.dismiss({
          [this.isEditMode ? 'updated' : 'created']: true
        });
      },
      error: async (err) => {
        console.error('Error saving member:', err);
        const toast = await this.toastCtrl.create({
          message: 'Fehler beim Speichern',
          duration: 2000,
          color: 'danger'
        });
        toast.present();
      }
    });
  }
}
