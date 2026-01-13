import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton } from '@ionic/angular/standalone';
import { IconService } from 'src/app/core/services/icon.service';
import { BadgeService } from 'src/app/services/badge.service';
import { TileGridComponent, TileConfig } from 'src/app/shared/components/tile-grid/tile-grid.component';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonMenuButton, TileGridComponent]
})
export class AdminPage {
  private readonly iconService = inject(IconService);
  readonly badgeService = inject(BadgeService);

  adminTiles: TileConfig[] = [
    {
      id: 'users',
      title: 'Benutzer',
      subtitle: 'Verwaltung',
      icon: 'person-outline',
      color: 'primary',
      route: '/admin/users',
      badge$: this.badgeService.getBadge('users')
    },
    {
      id: 'companies',
      title: 'Gesellschaften',
      subtitle: 'Firmenverwaltung',
      icon: 'briefcase-outline',
      color: 'primary',
      route: '/admin/companies'
    },
    {
      id: 'departments',
      title: 'Abteilungen',
      subtitle: 'Strukturverwaltung',
      icon: 'business-outline',
      color: 'primary',
      route: '/admin/departments'
    },
    {
      id: 'roles',
      title: 'Rollen',
      subtitle: 'Rollenverwaltung',
      icon: 'people-outline',
      color: 'primary',
      route: '/admin/roles'
    },
    {
      id: 'absence-types',
      title: 'Abwesenheitsarten',
      subtitle: 'Verwaltung',
      icon: 'calendar-outline',
      color: 'primary',
      route: '/admin/absence-types'
    },
    {
      id: 'specialties',
      title: 'Fachbereiche',
      subtitle: 'Kompetenzverwaltung',
      icon: 'school-outline',
      color: 'primary',
      route: '/admin/specialties'
    },
    {
      id: 'permissions',
      title: 'Berechtigungen',
      subtitle: 'Permission-Konfiguration',
      icon: 'shield-checkmark-outline',
      color: 'primary',
      route: '/admin/permission-config'
    },
    {
      id: 'ai-training',
      title: 'KI-Training',
      subtitle: 'Such-Analytics & Optimierung',
      icon: 'analytics-outline',
      color: 'primary',
      route: '/admin/search-analytics'
    }
  ];

  constructor() { 
    // Icons werden in der TileGrid-Komponente registriert
  }

}
