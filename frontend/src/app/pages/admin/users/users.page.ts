import { Users } from './../../../core/interfaces/users';
import { Component, computed, effect, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonSearchbar,
  IonLabel,
  IonListHeader,
  IonInput,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonNote,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonBadge,
  IonCheckbox,
  ModalController,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { createOutline, shieldCheckmarkOutline, banOutline, close, add, star, trash, warningOutline, create, ellipseOutline } from 'ionicons/icons';
import { UsersService } from 'src/app/core/services/users.service';
import { IntranetApiService } from 'src/app/services/intranet-api.service';
import { IntranetWebSocketService } from 'src/app/services/intranet-websocket.service';
import { AuthService } from 'src/app/core/services/auth.service';

import { OrganizationService } from 'src/app/core/services/organization.service';
import { Company, Department, DepartmentRole } from 'src/app/models/intranet.models';
import { Specialty } from 'src/app/models/organization.model';
import { UsersEditModalComponent } from './modal/users-edit-modal.component';
import { TabLayoutComponent, TabConfig } from 'src/app/shared/components/tab-layout/tab-layout.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonInput,
    IonListHeader,
    IonLabel,
    IonSearchbar,
    IonItem,
    IonList,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonSelect,
    IonSelectOption,
    ReactiveFormsModule,
    IonToggle,
    IonNote,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonBadge,

    TabLayoutComponent,
  ],
})
export class UsersPage implements OnInit, OnDestroy {
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);
  readonly userService = inject(UsersService);
  private readonly intranetApi = inject(IntranetApiService);
  private readonly organizationService = inject(OrganizationService);
  private readonly wsService = inject(IntranetWebSocketService);
  private readonly authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  
  // Online-Status Tracking: Set mit Usernames der online User
  onlineUsers = signal<Set<string>>(new Set());
  
  companies: Company[] = [];
  departments: Department[] = [];
  roles: DepartmentRole[] = [];
  specialties: Specialty[] = [];
  
  tabConfig: TabConfig[] = [
    { id: 'active', label: 'Aktive', icon: 'list' },
    { id: 'new', label: 'Neu', icon: 'add' },
    { id: 'archive', label: 'Archiv', icon: 'archive' },
  ];
  
  /** Abgeleitete Signale */
  readonly archivedUsers = computed(() =>
    this.userService.users().filter((u) => !u.is_active)
  );
  readonly activeUsers = computed(() =>
    this.userService.users().filter((u) => u.is_active)
  );
  
  readonly usersWithoutSupervisor = computed(() =>
    this.activeUsers().filter((u) => !u.supervisor)
  );

  // DepartmentMember Verwaltung für neuen User
  newUserMemberships: any[] = [];
  newMembership: any = {};
  editingMembership: any = null;

  get currentNewMembership(): any {
    return this.editingMembership || this.newMembership;
  }

  // Reactive Form fürs Anlegen
  readonly createForm = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    first_name: [''],
    last_name: [''],
    // Organisation
    companies: [[] as number[]],
    phone_number: [''],
    mobil_number: [''],
    password: ['', Validators.required], // beim Anlegen Pflicht
    is_active: [true],
    is_staff: [false],
    supervisor: [null as number | null], // FK-ID oder null
    blink_id: [null as number | null],
    blink_company: [null as number | null],
    vacation_entitlement: [30],
    carryover_vacation: [0],
    vacation_year: [new Date().getFullYear()],
  });

  private readonly modalCtrl = inject(ModalController);

  async openEditUser(user: Users) {
    const modal = await this.modalCtrl.create({
      component: UsersEditModalComponent,
      componentProps: { user },
      cssClass: 'large-desktop-modal',
    });
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    if (data) {
      // Liste wurde bereits im Modal aktualisiert, nichts zu tun
    }
  }

  openPermissionMatrix(userId: number) {
    this.router.navigate(['/admin/permissions', userId]);
  }

  async deactivateUser(user: Users) {
    const alert = await this.alertController.create({
      header: 'Benutzer deaktivieren',
      message: `Möchten Sie ${user.username} wirklich deaktivieren?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Deaktivieren',
          role: 'destructive',
          handler: async () => {
            try {
              await this.userService.updateUser(user.id, { is_active: false });
              await this.toastController.create({
                message: 'Benutzer wurde deaktiviert',
                duration: 2000,
                color: 'success'
              }).then(toast => toast.present());
            } catch (error) {
              await this.toastController.create({
                message: 'Fehler beim Deaktivieren',
                duration: 2000,
                color: 'danger'
              }).then(toast => toast.present());
            }
          }
        }
      ]
    });
    await alert.present();
  }

  constructor() {
    addIcons({warningOutline,createOutline,shieldCheckmarkOutline,banOutline,close,add,star,create,trash,ellipseOutline});
    
  }

  ngOnInit() {
    // Verbinde zu Presence WebSocket
    const token = this.authService.accessToken() || '';
    this.wsService.connectToPresence(token);
    
    // Subscribe zu Online-User-Liste (wird beim Connect gesendet)
    this.wsService.getOnlineUsers$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((usernames) => {
        this.onlineUsers.set(new Set(usernames));
      });

    // Subscribe zu Status-Änderungen in Realtime
    this.wsService.getStatusChanges$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        const currentOnline = this.onlineUsers();
        const newSet = new Set(currentOnline);
        
        if (update.status !== 'offline') {
          newSet.add(update.username);
        } else {
          newSet.delete(update.username);
        }
        
        this.onlineUsers.set(newSet);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isUserOnline(username: string): boolean {
    return this.onlineUsers().has(username);
  }

  ionViewWillEnter() {
    this.userService.loadUsers();
    this.loadOrganizationData();
  }

  loadOrganizationData() {
    this.intranetApi.getCompanies().subscribe({
      next: (response) => this.companies = Array.isArray(response) ? response : (response.results || []),
      error: (err) => console.error('Error loading companies:', err)
    });
    
    this.intranetApi.getDepartments().subscribe({
      next: (response) => this.departments = Array.isArray(response) ? response : (response.results || []),
      error: (err) => console.error('Error loading departments:', err)
    });
    
    this.intranetApi.getDepartmentRoles().subscribe({
      next: (roles) => this.roles = roles,
      error: (err) => console.error('Error loading roles:', err)
    });

    this.organizationService.getSpecialties().subscribe({
      next: (specialties) => this.specialties = specialties,
      error: (err) => console.error('Error loading specialties:', err)
    });
  }

  getFilteredDepartments(): Department[] {
    const selectedCompany = this.newMembership.company || this.editingMembership?.company;
    if (!selectedCompany) return [];
    return this.departments.filter(d => d.company === selectedCompany);
  }

  toggleCompany(companyId: number): void {
    const current = this.createForm.value.companies || [];
    const index = current.indexOf(companyId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(companyId);
    }
    this.createForm.patchValue({ companies: [...current] });
  }

  startAddMembershipForNewUser(companyId?: number): void {
    this.newMembership = {
      company: companyId || 0,
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

  cancelEditNewUser(): void {
    this.editingMembership = null;
    this.newMembership = {};
  }

  saveNewUserMembership(): void {
    const membership = this.editingMembership || this.newMembership;
    
    if (!membership.company || !membership.department || !membership.role) {
      alert('Bitte Gesellschaft, Abteilung und Rolle auswählen');
      return;
    }

    if (this.editingMembership) {
      const index = this.newUserMemberships.findIndex(m => m === this.editingMembership);
      if (index > -1) {
        this.newUserMemberships[index] = { ...membership };
      }
    } else {
      this.newUserMemberships.push({ ...membership });
    }

    this.cancelEditNewUser();
  }

  deleteNewUserMembership(membership: any): void {
    const index = this.newUserMemberships.indexOf(membership);
    if (index > -1) {
      this.newUserMemberships.splice(index, 1);
    }
  }

  startEditNewUserMembership(membership: any): void {
    this.editingMembership = { ...membership };
    this.newMembership = {};
  }

  getDepartmentName(deptId: number): string {
    return this.departments.find(d => d.id === deptId)?.name || `ID ${deptId}`;
  }

  getRoleName(roleId: number): string {
    return this.roles.find(r => r.id === roleId)?.name || `ID ${roleId}`;
  }

  getCompanyName(companyId: number): string {
    return this.companies.find(c => c.id === companyId)?.name || `ID ${companyId}`;
  }

  getCompanyCode(companyId: number): string {
    return this.companies.find(c => c.id === companyId)?.code || '';
  }

  getMembershipsForCompany(companyId: number): any[] {
    return this.newUserMemberships.filter(m => m.company === companyId);
  }

  async onCreateUser() {
    if (this.createForm.invalid) return;

    // Erst User erstellen
    const userPayload = {
      ...this.createForm.value,
      supervisor: this.createForm.value.supervisor ?? null,
      blink_id: this.createForm.value.blink_id ?? null,
      blink_company: this.createForm.value.blink_company ?? null,
      companies: this.createForm.value.companies ?? [],
    };

    // User anlegen
    this.userService.createUser(userPayload);

    // Warte kurz bis User erstellt ist, dann DepartmentMemberships anlegen
    // TODO: Besser wäre ein Observable/Signal von userService
    setTimeout(async () => {
      const createdUser = this.userService.users().find(u => u.username === userPayload.username);
      if (createdUser && this.newUserMemberships.length > 0) {
        // DepartmentMemberships für den neuen User anlegen
        const membershipPromises = this.newUserMemberships.map(membership => {
          const payload = {
            user: createdUser.id,
            company: membership.company,
            department: membership.department,
            role: membership.role,
            position_title: membership.position_title || '',
            is_primary: membership.is_primary || false,
            is_staff_position: membership.is_staff_position || false,
            is_active: membership.is_active !== false,
            reports_to: membership.reports_to || null
          };
          
          return this.intranetApi.createDepartmentMember(payload).toPromise();
        });

        try {
          await Promise.all(membershipPromises);
          const toast = await this.toastController.create({
            message: 'User und Abteilungszuordnungen erstellt',
            duration: 2000,
            color: 'success'
          });
          toast.present();
        } catch (err) {
          console.error('Fehler beim Erstellen der Abteilungszuordnungen:', err);
          const toast = await this.toastController.create({
            message: 'Fehler bei Abteilungszuordnungen',
            duration: 2000,
            color: 'warning'
          });
          toast.present();
        }
      }

      // Formular zurücksetzen
      this.createForm.reset({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        companies: [],
        phone_number: '',
        mobil_number: '',
        password: '',
        is_active: true,
        is_staff: false,
        supervisor: null,
        blink_id: null,
        blink_company: null,
        vacation_entitlement: 30,
        carryover_vacation: 0,
        vacation_year: new Date().getFullYear(),
      });
      
      this.newUserMemberships = [];
      this.newMembership = {};
      this.editingMembership = null;
    }, 1000);
  }
}
