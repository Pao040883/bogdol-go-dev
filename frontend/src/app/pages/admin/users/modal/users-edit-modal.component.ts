import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonChip,
  IonCheckbox,
  IonFooter,
  ModalController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, trash, create, star, close, checkmarkCircle } from 'ionicons/icons';
import { UsersService } from 'src/app/core/services/users.service';
import { IntranetApiService } from 'src/app/services/intranet-api.service';
import { OrganizationService } from 'src/app/core/services/organization.service';
import { BadgeService } from 'src/app/services/badge.service';
import { Users } from 'src/app/core/interfaces/users';
import { Department, Company, DepartmentRole } from 'src/app/models/intranet.models';
import { Specialty } from 'src/app/models/organization.model';
import { environment } from 'src/environments/environment';

interface DepartmentMembership {
  id?: number;
  company: number;
  company_name?: string;
  department: number;
  department_name?: string;
  role: number;
  role_name?: string;
  position_title?: string;
  is_primary: boolean;
  is_staff_position: boolean;
  is_active: boolean;
  reports_to?: number | null;
}

interface MemberSpecialty {
  id?: number;
  member: number;
  specialty: number;
  specialty_name?: string;
  specialty_code?: string;
  is_active: boolean;
}

@Component({
  selector: 'app-users-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonNote,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonChip,

    IonFooter,
  ],
  templateUrl: './users-edit-modal.component.html',
})
export class UsersEditModalComponent implements OnInit {
  @Input() user!: Users; // kommt von außen
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly http = inject(HttpClient);
  readonly userService = inject(UsersService);
  private readonly intranetApi = inject(IntranetApiService);
  private readonly organizationService = inject(OrganizationService);
  private readonly badgeService = inject(BadgeService);

  companies: Company[] = [];
  departments: Department[] = [];
  roles: DepartmentRole[] = [];
  specialties: Specialty[] = [];
  isLoadingData = false;
  
  // DepartmentMember Verwaltung
  departmentMemberships: DepartmentMembership[] = [];
  newMembership: Partial<DepartmentMembership> = {};
  editingMembership: DepartmentMembership | null = null;
  
  // Specialty Verwaltung pro Membership
  memberSpecialtiesMap: Map<number, MemberSpecialty[]> = new Map(); // membership.id -> specialties
  selectedSpecialtiesMap: Map<number, number[]> = new Map(); // membership.id -> selected specialty IDs
  
  get currentMembership(): Partial<DepartmentMembership> {
    return this.editingMembership || this.newMembership;
  }

  constructor() {
    addIcons({close,add,star,checkmarkCircle,create,trash});
  }

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    first_name: [''],
    last_name: [''],
    // Organisation
    companies: [[] as number[]],
    // KI-Suche Felder
    responsibilities: [''],
    expertise_areas: [''],
    phone_number: [''],
    mobile_number: [''],
    is_active: [true],
    is_staff: [false],
    supervisor: [null as number | null],
    // Blink Integration Fields
    blink_id: [null as number | null],
    blink_company: [null as number | null],
    // Urlaubsfelder
    vacation_entitlement: [30],
    carryover_vacation: [0],
  });

  ngOnInit(): void {
    this.loadData();
    this.loadDepartmentMemberships();
    
    const u = this.user;
    const supervisorId =
      (u as any)?.supervisor && typeof (u as any).supervisor === 'object'
        ? (u as any).supervisor.id
        : (u as any).supervisor ?? null;

    const companyIds = (u as any)?.companies ?? [];

    this.form.patchValue({
      username: u.username ?? '',
      email: u.email ?? '',
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      companies: companyIds,
      responsibilities: (u as any).responsibilities ?? '',
      expertise_areas: (u as any).expertise_areas ?? '',
      phone_number: u.phone_number ?? '',
      mobile_number: u.mobile_number ?? '',
      is_active: !!u.is_active,
      is_staff: !!u.is_staff,
      supervisor: supervisorId,
      // Blink Integration Fields
      blink_id: u.blink_id ?? null,
      blink_company: u.blink_company ?? null,
      // Urlaubsfelder
      vacation_entitlement: (u as any).vacation_entitlement ?? 30,
      carryover_vacation: (u as any).carryover_vacation ?? 0,
    });
  }

  loadData(): void {
    this.isLoadingData = true;
    
    // Load Companies
    this.intranetApi.getCompanies().subscribe({
      next: (response) => {
        this.companies = Array.isArray(response) ? response : (response.results || []);
      },
      error: (err) => console.error('Error loading companies:', err)
    });
    
    // Load Departments
    this.intranetApi.getDepartments().subscribe({
      next: (response) => {
        this.departments = Array.isArray(response) ? response : (response.results || []);
      },
      error: (err) => console.error('Error loading departments:', err)
    });
    
    // Load Roles
    this.intranetApi.getDepartmentRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => console.error('Error loading roles:', err)
    });

    // Load Specialties (all, will be filtered in UI based on department)
    this.organizationService.getSpecialties().subscribe({
      next: (specialties) => {
        this.specialties = specialties;
        this.isLoadingData = false;
      },
      error: (err) => {
        console.error('Error loading specialties:', err);
        this.isLoadingData = false;
      }
    });
  }

  // DepartmentMember Verwaltung
  loadDepartmentMemberships(): void {
    if (!this.user?.id) return;
    
    this.http.get<any>(`${environment.apiUrl}/org-members/?user=${this.user.id}`)
      .subscribe({
        next: (response) => {
          this.departmentMemberships = response.results || [];
          // Lade Specialties für jede Membership
          this.departmentMemberships.forEach(membership => {
            if (membership.id) {
              this.loadMemberSpecialties(membership.id);
            }
          });
        },
        error: (err) => console.error('Error loading memberships:', err)
      });
  }

  // MemberSpecialty Verwaltung
  loadMemberSpecialties(membershipId: number): void {
    console.log(`📥 Loading ALL specialties (active + inactive) for membership ${membershipId}...`);
    // Backend lädt jetzt standardmäßig ALLE (aktive UND inaktive) und sendet direktes Array (keine Pagination)
    this.http.get<any>(`${environment.apiUrl}/member-specialties/?member=${membershipId}`)
      .subscribe({
        next: (response) => {
          // Backend sendet jetzt direktes Array (pagination_class = None)
          const specialties = Array.isArray(response) ? response : (response.results || []);
          console.log(`✅ Loaded ${specialties.length} specialties for membership ${membershipId}:`, specialties);
          this.memberSpecialtiesMap.set(membershipId, specialties);
          // Extrahiere IDs der AKTIVEN Specialties für die Auswahl
          const selected = specialties
            .filter((ms: MemberSpecialty) => ms.is_active)
            .map((ms: MemberSpecialty) => ms.specialty);
          this.selectedSpecialtiesMap.set(membershipId, selected);
          console.log(`🎯 Active specialties for membership ${membershipId}:`, selected);
          console.log(`🗺️ Map now contains:`, {
            memberSpecialtiesMap: Array.from(this.memberSpecialtiesMap.keys()),
            selectedSpecialtiesMap: Array.from(this.selectedSpecialtiesMap.entries())
          });
        },
        error: (err) => {
          console.error('❌ Error loading member specialties:', err);
        }
      });
  }

  toggleSpecialty(membershipId: number, specialtyId: number): void {
    const selected = this.selectedSpecialtiesMap.get(membershipId) || [];
    const index = selected.indexOf(specialtyId);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(specialtyId);
    }
    this.selectedSpecialtiesMap.set(membershipId, selected);
  }

  isSpecialtySelected(membershipId: number, specialtyId: number): boolean {
    const selected = this.selectedSpecialtiesMap.get(membershipId) || [];
    return selected.includes(specialtyId);
  }

  getSelectedSpecialties(membershipId: number): number[] {
    const result = this.selectedSpecialtiesMap.get(membershipId) || [];
    console.log(`🔍 getSelectedSpecialties(${membershipId}) returning:`, result);
    return result;
  }

  getSelectedSpecialtiesForEdit(): number[] {
    if (!this.editingMembership?.id) return [];
    return this.selectedSpecialtiesMap.get(this.editingMembership.id) || [];
  }

  setSelectedSpecialtiesForEdit(specialtyIds: number[]): void {
    if (!this.editingMembership?.id) return;
    this.selectedSpecialtiesMap.set(this.editingMembership.id, specialtyIds || []);
  }

  saveSpecialtiesForMembership(membershipId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentSpecialties = this.memberSpecialtiesMap.get(membershipId) || [];
      const selectedIds = this.selectedSpecialtiesMap.get(membershipId) || [];
      
      console.log(`Saving specialties for membership ${membershipId}:`, {
        current: currentSpecialties.map(s => ({id: s.id, specialty: s.specialty, active: s.is_active})),
        selected: selectedIds
      });
      
      const promises: Promise<any>[] = [];

      // Durchlaufe alle bestehenden MemberSpecialties
      currentSpecialties.forEach(ms => {
        const shouldBeActive = selectedIds.includes(ms.specialty);
        
        // Wenn sich der Status ändern muss
        if (ms.is_active !== shouldBeActive && ms.id) {
          console.log(`Updating specialty ${ms.specialty} to is_active=${shouldBeActive}`);
          promises.push(
            this.http.patch(`${environment.apiUrl}/member-specialties/${ms.id}/`, {
              is_active: shouldBeActive
            }).toPromise()
          );
        }
      });

      // Finde Specialties die neu hinzugefügt werden müssen (nicht in currentSpecialties)
      const currentSpecialtyIds = currentSpecialties.map(ms => ms.specialty);
      const toCreate = selectedIds.filter(specId => !currentSpecialtyIds.includes(specId));

      // Erstelle neue MemberSpecialties
      toCreate.forEach(specId => {
        console.log(`Creating new specialty ${specId}`);
        promises.push(
          this.http.post(`${environment.apiUrl}/member-specialties/`, {
            member: membershipId,
            specialty: specId,
            is_active: true
          }).toPromise()
        );
      });

      if (promises.length === 0) {
        console.log('No changes needed for specialties');
        resolve();
        return;
      }

      Promise.all(promises)
        .then(() => {
          console.log(`✅ Specialties updated for membership ${membershipId}`);
          this.loadMemberSpecialties(membershipId);
          resolve();
        })
        .catch((err) => {
          console.error('Error updating specialties:', err);
          reject(err);
        });
    });
  }

  getSpecialtyName(specialtyId: number): string {
    const name = this.specialties.find(s => s.id === specialtyId)?.name || '';
    console.log(`🏷️ getSpecialtyName(${specialtyId}) = "${name}"`);
    return name;
  }

  saveMemberSpecialties(): Promise<void> {
    return new Promise((resolve, reject) => {
      const savePromises: Promise<any>[] = [];

      // Für jede Membership die Specialties speichern
      this.departmentMemberships.forEach(membership => {
        if (!membership.id) return;

        const memberId = membership.id;
        const currentSpecialties = this.memberSpecialtiesMap.get(memberId) || [];
        const selectedIds = this.selectedSpecialtiesMap.get(memberId) || [];
        
        // Bestimme was gelöscht und was hinzugefügt werden muss
        const currentSpecialtyIds = currentSpecialties.map(ms => ms.specialty);
        const toDelete = currentSpecialties.filter(
          ms => !selectedIds.includes(ms.specialty)
        );
        const toAdd = selectedIds.filter(
          specId => !currentSpecialtyIds.includes(specId)
        );

        // DELETE Requests
        toDelete.forEach(ms => {
          if (ms.id) {
            savePromises.push(
              this.http.delete(`${environment.apiUrl}/member-specialties/${ms.id}/`).toPromise()
            );
          }
        });

        // POST Requests
        toAdd.forEach(specId => {
          savePromises.push(
            this.http.post(`${environment.apiUrl}/member-specialties/`, {
              member: memberId,
              specialty: specId,
              is_active: true
            }).toPromise()
          );
        });
      });

      // Führe alle Requests aus
      if (savePromises.length === 0) {
        resolve();
        return;
      }

      Promise.all(savePromises)
        .then(() => {
          console.log('✅ Member specialties updated successfully for all memberships');
          // Reload specialties für alle Memberships
          this.departmentMemberships.forEach(m => {
            if (m.id) this.loadMemberSpecialties(m.id);
          });
          resolve();
        })
        .catch((err) => {
          console.error('Error updating member specialties:', err);
          reject(err);
        });
    });
  }

  toggleCompany(companyId: number): void {
    const current = this.form.value.companies || [];
    const index = current.indexOf(companyId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(companyId);
    }
    this.form.patchValue({ companies: [...current] });
  }

  getCompanyName(companyId: number): string {
    return this.companies.find(c => c.id === companyId)?.name || `ID ${companyId}`;
  }

  getCompanyCode(companyId: number): string {
    return this.companies.find(c => c.id === companyId)?.code || '';
  }

  getFilteredDepartments(): Department[] {
    const selectedCompany = this.newMembership.company || this.editingMembership?.company;
    if (!selectedCompany) return [];
    return this.departments.filter(d => d.company === selectedCompany);
  }

  startAddMembership(): void {
    this.newMembership = {
      company: 0,
      department: 0,
      role: 0,
      position_title: '',
      is_primary: false,
      is_staff_position: false,
      is_active: true,
      reports_to: null
    };
    this.editingMembership = null;
  }

  startEditMembership(membership: DepartmentMembership): void {
    this.editingMembership = { ...membership };
    this.newMembership = {};
    // IMMER Specialties neu laden beim Bearbeiten, um aktuelle Daten zu haben
    if (membership.id) {
      console.log(`🔄 Starting edit for membership ${membership.id}, reloading specialties...`);
      this.loadMemberSpecialties(membership.id);
    }
  }

  cancelEdit(): void {
    this.editingMembership = null;
    this.newMembership = {};
  }

  saveMembership(): void {
    if (!this.user?.id) return;

    const membership = this.editingMembership || this.newMembership;
    
    if (!membership.company || !membership.department || !membership.role) {
      alert('Bitte Gesellschaft, Abteilung und Rolle auswählen');
      return;
    }

    const payload = {
      user: this.user.id,
      company: membership.company,
      department: membership.department,
      role: membership.role,
      position_title: membership.position_title || '',
      is_primary: membership.is_primary || false,
      is_staff_position: membership.is_staff_position || false,
      is_active: membership.is_active !== false,
      reports_to: membership.reports_to || null
    };

    if (this.editingMembership?.id) {
      // Update existing
      const membershipId = this.editingMembership.id;
      this.http.put(`${environment.apiUrl}/org-members/${membershipId}/`, payload)
        .subscribe({
          next: () => {
            console.log('✅ Membership updated, now saving specialties...');
            // Speichere Specialties für diese Membership
            this.saveSpecialtiesForMembership(membershipId)
              .then(() => {
                console.log('✅ Specialties saved successfully');
                this.loadDepartmentMemberships();
                this.cancelEdit();
              })
              .catch((err) => {
                console.error('❌ Error saving specialties:', err);
                this.loadDepartmentMemberships();
                this.cancelEdit();
              });
          },
          error: (err) => console.error('Error updating membership:', err)
        });
    } else {
      // Create new
      this.http.post(`${environment.apiUrl}/org-members/`, payload)
        .subscribe({
          next: () => {
            this.loadDepartmentMemberships();
            this.cancelEdit();
          },
          error: (err) => console.error('Error creating membership:', err)
        });
    }
  }

  deleteMembership(membership: DepartmentMembership): void {
    if (!membership.id) return;
    
    if (!confirm(`Zuordnung zu "${membership.department_name}" wirklich löschen?`)) {
      return;
    }

    this.http.delete(`${environment.apiUrl}/org-members/${membership.id}/`)
      .subscribe({
        next: () => {
          this.loadDepartmentMemberships();
        },
        error: (err) => console.error('Error deleting membership:', err)
      });
  }

  getDepartmentName(deptId: number): string {
    return this.departments.find(d => d.id === deptId)?.name || `ID ${deptId}`;
  }

  getRoleName(roleId: number): string {
    return this.roles.find(r => r.id === roleId)?.name || `ID ${roleId}`;
  }

  getCompanyNameForMembership(companyId: number): string {
    return this.companies.find(c => c.id === companyId)?.name || `ID ${companyId}`;
  }

  getCompaniesWithoutAssignments(): Company[] {
    const assignedCompanyIds = this.departmentMemberships.map(m => m.company);
    const selectedCompanyIds = this.form.value.companies || [];
    return this.companies.filter(c => 
      selectedCompanyIds.includes(c.id) && !assignedCompanyIds.includes(c.id)
    );
  }

  getMembershipsForCompany(companyId: number): DepartmentMembership[] {
    return this.departmentMemberships.filter(m => m.company === companyId);
  }

  startAddMembershipForCompany(companyId: number): void {
    this.newMembership = {
      company: companyId,
      department: 0,
      role: 0,
      position_title: '',
      is_primary: false,
      is_staff_position: false,
      is_active: true,
      reports_to: null
    };
    this.editingMembership = null;
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  save() {
    if (!this.user?.id) {
      console.error('No user ID');
      return;
    }
    
    if (this.form.invalid) {
      console.error('Form invalid');
      return;
    }

    const payload: any = {
      ...this.form.value,
      supervisor: this.form.value.supervisor ?? null,
      blink_id: this.form.value.blink_id ?? null,
      blink_company: this.form.value.blink_company ?? null,
      companies: this.form.value.companies ?? [],
      responsibilities: this.form.value.responsibilities ?? null,
      expertise_areas: this.form.value.expertise_areas ?? null,
      vacation_entitlement: this.form.value.vacation_entitlement ?? 30,
      carryover_vacation: this.form.value.carryover_vacation ?? 0,
      vacation_year: new Date().getFullYear(),
    };

    this.http.patch<Users>(`${environment.apiUrl}/admin/users/${this.user.id}/`, payload)
      .subscribe({
        next: (updatedUser) => {
          // Update im Service
          this.userService.users.update((list) =>
            list.map((u) => (u.id === this.user.id ? updatedUser : u))
          );
          
          // Badge aktualisieren
          const activeUsers = this.userService.activeUsers();
          const usersWithoutSupervisor = activeUsers.filter(u => !u.supervisor);
          this.badgeService.setBadge('users', usersWithoutSupervisor.length);
          
          // Specialties speichern
          this.saveMemberSpecialties()
            .then(() => {
              this.modalCtrl.dismiss(updatedUser);
            })
            .catch(() => {
              // User wurde gespeichert, aber Specialties nicht - trotzdem schließen
              this.modalCtrl.dismiss(updatedUser);
            });
        },
        error: (err) => {
          console.error('Error updating user:', err);
          alert('Fehler beim Speichern des Benutzers');
        }
      });
  }
}
