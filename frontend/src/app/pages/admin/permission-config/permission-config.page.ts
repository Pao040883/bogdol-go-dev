import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonSegment, IonSegmentButton, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent, IonList,
  IonItem, IonLabel, IonCheckbox, IonButton, IonSpinner,
  IonNote, IonSearchbar, IonChip, IonIcon, IonAccordionGroup,
  IonAccordion, IonSelect, IonSelectOption, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  saveOutline, refreshOutline, trashOutline, 
  checkmarkCircle, closeCircle, businessOutline,
  peopleOutline, briefcaseOutline, ribbonOutline, arrowBackOutline, informationCircleOutline, layersOutline } from 'ionicons/icons';

import { PermissionConfigService } from '../../../services/permission-config.service';
import { IntranetApiService } from '../../../services/intranet-api.service';
import { OrganizationService } from '../../../core/services/organization.service';
import {
  PermissionCode,
  PermissionMapping,
  EntityType,
  BulkPermissionUpdate,
  PermissionScope
} from '../../../models/permission.model';
import { Department, DepartmentRole } from '../../../models/intranet.models';
import { Specialty } from '../../../models/organization.model';

type ViewMode = 'departments' | 'roles' | 'specialties';

@Component({
  selector: 'app-permission-config',
  templateUrl: './permission-config.page.html',
  styleUrls: ['./permission-config.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonBackButton, IonSegment, IonSegmentButton, IonCard,
    IonCardHeader, IonCardTitle, IonCardContent, IonList,
    IonItem, IonLabel, IonCheckbox, IonButton, IonSpinner,
    IonNote, IonSearchbar, IonChip, IonIcon, IonAccordionGroup,
    IonAccordion, IonSelect, IonSelectOption
  ]
})
export class PermissionConfigPage implements OnInit {
  private readonly permissionService = inject(PermissionConfigService);
  private readonly intranetApi = inject(IntranetApiService);
  private readonly organizationService = inject(OrganizationService);
  private readonly toastController = inject(ToastController);

  // View State
  readonly viewMode = signal<ViewMode>('departments');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly searchTerm = signal('');

  // Data
  readonly permissionsByCategory = signal<{ [key: string]: PermissionCode[] }>({});
  readonly departments = signal<Department[]>([]);
  readonly roles = signal<DepartmentRole[]>([]);
  readonly specialties = signal<Specialty[]>([]);

  // Selected Entity
  readonly selectedEntityId = signal<number | null>(null);
  readonly selectedEntityType = signal<EntityType | null>(null);
  readonly selectedPermissions = signal<Set<string>>(new Set());
  readonly permissionScopes = signal<Map<string, PermissionScope | null>>(new Map());

  // Available entities for current view
  readonly currentEntities = signal<any[]>([]);
  
  // Scope Options
  readonly scopeOptions = [
    { value: null, label: 'Standard (aus Permission)' },
    { value: PermissionScope.OWN, label: 'Nur eigene' },
    { value: PermissionScope.DEPARTMENT, label: 'Eigene Abteilung' },
    { value: PermissionScope.ALL, label: 'Alle' }
  ];

  constructor() {
    addIcons({businessOutline,peopleOutline,ribbonOutline,informationCircleOutline,checkmarkCircle,saveOutline,layersOutline,arrowBackOutline,refreshOutline,trashOutline,closeCircle,briefcaseOutline});
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);

    try {
      // Load permissions by category
      this.permissionService.loadPermissionsByCategory().subscribe({
        next: (grouped) => {
          this.permissionsByCategory.set(grouped);
        },
        error: (err) => console.error('Fehler beim Laden der Permissions:', err)
      });

      // Load departments
      this.intranetApi.getDepartments().subscribe({
        next: (response: any) => {
          const depts = response.results || response;
          this.departments.set(depts);
          if (this.viewMode() === 'departments') {
            this.currentEntities.set(depts);
          }
        },
        error: (err: any) => console.error('Fehler beim Laden der Departments:', err)
      });

      // Load roles
      this.intranetApi.getDepartmentRoles().subscribe({
        next: (roles: DepartmentRole[]) => {
          this.roles.set(roles);
          if (this.viewMode() === 'roles') {
            this.currentEntities.set(roles);
          }
        },
        error: (err: any) => console.error('Fehler beim Laden der Rollen:', err)
      });

      // Load specialties
      this.organizationService.getSpecialties().subscribe({
        next: (specs: Specialty[]) => {
          this.specialties.set(specs);
          if (this.viewMode() === 'specialties') {
            this.currentEntities.set(specs);
          }
        },
        error: (err: any) => console.error('Fehler beim Laden der Fachbereiche:', err)
      });

    } finally {
      this.isLoading.set(false);
    }
  }

  onViewModeChange(event: any) {
    const newMode = event.detail.value as ViewMode;
    this.viewMode.set(newMode);
    
    // Update current entities based on view mode
    switch (newMode) {
      case 'departments':
        this.currentEntities.set(this.departments());
        break;
      case 'roles':
        this.currentEntities.set(this.roles());
        break;
      case 'specialties':
        this.currentEntities.set(this.specialties());
        break;
    }

    // Reset selection
    this.selectedEntityId.set(null);
    this.selectedPermissions.set(new Set());
  }

  async selectEntity(entityId: number) {
    this.selectedEntityId.set(entityId);
    
    // Determine entity type
    let entityType: EntityType;
    switch (this.viewMode()) {
      case 'departments':
        entityType = EntityType.DEPARTMENT;
        break;
      case 'roles':
        entityType = EntityType.ROLE;
        break;
      case 'specialties':
        entityType = EntityType.SPECIALTY;
        break;
      default:
        return;
    }
    
    this.selectedEntityType.set(entityType);

    // Load current permissions for this entity
    this.isLoading.set(true);
    this.permissionService.getPermissionsForEntity(entityType, entityId).subscribe({
      next: (mappings) => {
        const codes = this.permissionService.extractPermissionCodes(mappings);
        this.selectedPermissions.set(new Set(codes));
        
        // Load scopes from mappings
        const scopes = new Map<string, PermissionScope | null>();
        mappings.forEach(mapping => {
          if (mapping.permission_detail && mapping.scope) {
            scopes.set(mapping.permission_detail.code, mapping.scope);
          }
        });
        this.permissionScopes.set(scopes);
        
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Entity-Permissions:', err);
        this.isLoading.set(false);
      }
    });
  }

  togglePermission(permissionCode: string) {
    const current = new Set(this.selectedPermissions());
    
    if (current.has(permissionCode)) {
      current.delete(permissionCode);
    } else {
      current.add(permissionCode);
    }
    
    this.selectedPermissions.set(current);
  }

  isPermissionSelected(permissionCode: string): boolean {
    return this.selectedPermissions().has(permissionCode);
  }
  
  getPermissionScope(permissionCode: string): PermissionScope | null {
    return this.permissionScopes().get(permissionCode) ?? null;
  }
  
  setPermissionScope(permissionCode: string, scope: PermissionScope | null) {
    const scopes = new Map(this.permissionScopes());
    if (scope === null) {
      scopes.delete(permissionCode);
    } else {
      scopes.set(permissionCode, scope);
    }
    this.permissionScopes.set(scopes);
  }
  
  supportsScope(permission: PermissionCode): boolean {
    return permission.supports_scope ?? false;
  }
  
  getScopeLabel(permission: PermissionCode): string {
    const scope = this.getPermissionScope(permission.code);
    if (scope) {
      const option = this.scopeOptions.find(o => o.value === scope);
      return option?.label ?? 'Standard';
    }
    return permission.default_scope ?? 'Standard';
  }

  async savePermissions() {
    const entityId = this.selectedEntityId();
    const entityType = this.selectedEntityType();

    if (!entityId || !entityType) {
      await this.showToast('Bitte wähle zuerst eine Entity aus', 'warning');
      return;
    }

    this.isSaving.set(true);

    // Konvertiere Scopes Map zu Object
    const scopesObject: { [key: string]: PermissionScope | null } = {};
    this.permissionScopes().forEach((scope, code) => {
      if (scope !== null) {
        scopesObject[code] = scope;
      }
    });

    const updateData: BulkPermissionUpdate = {
      entity_type: entityType,
      entity_id: entityId,
      permission_codes: Array.from(this.selectedPermissions()),
      permission_scopes: scopesObject  // NEU
    };

    this.permissionService.bulkUpdatePermissions(updateData).subscribe({
      next: async (response) => {
        await this.showToast(
          `Permissions erfolgreich gespeichert (${response.created} neu, ${response.updated} aktualisiert)`,
          'success'
        );
        
        // Clear cache
        this.permissionService.clearCache().subscribe({
          next: () => console.log('✅ Permission-Cache gelöscht'),
          error: (err) => console.error('⚠️ Cache-Löschung fehlgeschlagen:', err)
        });
        
        this.isSaving.set(false);
      },
      error: async (err) => {
        console.error('❌ Fehler beim Speichern:', err);
        await this.showToast('Fehler beim Speichern der Permissions', 'danger');
        this.isSaving.set(false);
      }
    });
  }

  getFilteredEntities() {
    const search = this.searchTerm().toLowerCase();
    const entities = this.currentEntities();

    if (!search) return entities;

    return entities.filter(entity =>
      entity.name?.toLowerCase().includes(search) ||
      entity.code?.toLowerCase().includes(search)
    );
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'APP': 'apps-outline',
      'WORKORDER': 'document-text-outline',
      'ABSENCE': 'calendar-outline',
      'USER': 'person-outline',
      'DEPARTMENT': 'business-outline',
      'ANALYTICS': 'analytics-outline',
      'ADMIN': 'settings-outline',
      'OTHER': 'ellipsis-horizontal-outline'
    };
    return icons[category] || 'help-outline';
  }

  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'APP': 'primary',
      'WORKORDER': 'success',
      'ABSENCE': 'warning',
      'USER': 'tertiary',
      'DEPARTMENT': 'secondary',
      'ANALYTICS': 'medium',
      'ADMIN': 'danger',
      'OTHER': 'dark'
    };
    return colors[category] || 'medium';
  }

  getSelectedCountForCategory(permissions: PermissionCode[]): number {
    if (!permissions) return 0;
    return permissions.filter(p => this.isPermissionSelected(p.code)).length;
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
