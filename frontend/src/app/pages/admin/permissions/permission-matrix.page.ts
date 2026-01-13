import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonBadge, IonIcon,
  IonSpinner, IonAccordion, IonAccordionGroup, IonCardSubtitle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  shieldCheckmarkOutline, businessOutline,
  schoolOutline, peopleOutline,
  layersOutline, gitBranchOutline, statsChartOutline } from 'ionicons/icons';
import {
  PermissionMatrixService,
  UserPermissionMatrix,
  PermissionScope
} from './services/permission-matrix.service';

@Component({
  selector: 'app-permission-matrix',
  templateUrl: './permission-matrix.page.html',
  styleUrls: ['./permission-matrix.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonList, IonItem, IonLabel, IonBadge, IonIcon,
    IonSpinner, IonAccordion, IonAccordionGroup, IonCardSubtitle
  ],
})
export class PermissionMatrixPage implements OnInit {
  userId = signal<number>(0);
  matrix = signal<UserPermissionMatrix | null>(null);
  loading = signal(true);
  error = signal<string>('');

  // Computed categories for effective permissions
  permissionCategories = computed(() => {
    const m = this.matrix();
    if (!m) return [];
    
    const categories = new Set(m.effective_permissions.map(p => p.category));
    return Array.from(categories).sort();
  });

  constructor(
    private route: ActivatedRoute,
    private permissionService: PermissionMatrixService
  ) {
    addIcons({shieldCheckmarkOutline,businessOutline,schoolOutline,peopleOutline,layersOutline,gitBranchOutline,statsChartOutline});
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('userId');
    if (id) {
      this.userId.set(parseInt(id, 10));
      this.loadMatrix();
    }
  }

  async loadMatrix() {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.permissionService
        .getUserPermissionMatrix(this.userId())
        .toPromise();
      
      if (data) {
        this.matrix.set(data);
      }
    } catch (error: any) {
      console.error('Failed to load permission matrix:', error);
      this.error.set(error?.error?.message || 'Fehler beim Laden der Berechtigungen');
    } finally {
      this.loading.set(false);
    }
  }

  getScopeColor(scope: PermissionScope | string | null): string {
    switch (scope) {
      case 'ALL':
        return 'success';
      case 'DEPARTMENT':
        return 'primary';
      case 'OWN':
        return 'warning';
      case 'NONE':
        return 'medium';
      default:
        return 'medium';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'ADMIN':
        return 'shield-checkmark-outline';
      case 'WORKORDER':
      case 'ABSENCE':
        return 'business-outline';
      case 'HR':
        return 'people-outline';
      case 'ANALYTICS':
        return 'stats-chart-outline';
      default:
        return 'layers-outline';
    }
  }

  getPermissionsByCategory(category: string) {
    const m = this.matrix();
    if (!m) return [];
    return m.effective_permissions.filter(p => p.category === category);
  }
}
