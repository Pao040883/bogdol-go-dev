import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton } from '@ionic/angular/standalone';
import { TileGridComponent, TileConfig } from 'src/app/shared/components/tile-grid/tile-grid.component';
import { BadgeService } from 'src/app/services/badge.service';
import { UserFeaturesService } from 'src/app/services/user-features.service';
import { map, combineLatest } from 'rxjs';

@Component({
  selector: 'app-apps',
  templateUrl: './apps.page.html',
  styleUrls: ['./apps.page.scss'],
  standalone: true,
  imports: [IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonMenuButton, TileGridComponent]
})
export class AppsPage {
  private badgeService = inject(BadgeService);
  readonly userFeatures = inject(UserFeaturesService);

  // Basis-Tiles ohne Badges
  private baseAppTiles: TileConfig[] = [
    {
      id: 'sofo',
      title: 'Sofortmeldung',
      subtitle: 'Personal',
      icon: 'person-outline',
      color: 'primary',
      route: '/apps/sofo',
    },
    {
      id: 'work-tickets',
      title: 'Arbeitsscheine',
      subtitle: 'Faktur',
      icon: 'document-outline',
      color: 'primary',
      route: '/apps/workorders'
    },
    {
      id: 'contacts',
      title: 'Telefonbuch',
      subtitle: 'Verwaltung',
      icon: 'call-outline',
      color: 'primary',
      route: '/apps/contacts-list'
    },
    {
      id: 'absences',
      title: 'Abwesenheiten',
      subtitle: 'Personal',
      icon: 'calendar-outline',
      color: 'primary',
      route: '/apps/absences'
    },
    {
      id: 'organigramm',
      title: 'Organigramm',
      subtitle: 'Organisation',
      icon: 'git-network-outline',
      color: 'primary',
      route: '/apps/organigramm'
    }
  ];

  // Tiles mit dynamischen Badges und Permission-Filter
  appTiles$ = combineLatest([
    this.badgeService.badges$
  ]).pipe(
    map(([badges]) => {
      const features = this.userFeatures.features();
      
      // Filtere Tiles basierend auf Permissions
      const filteredTiles = this.baseAppTiles.filter(tile => {
        switch(tile.id) {
          case 'sofo':
            return features?.can_view_sofo ?? false;
          case 'work-tickets':
            return features?.can_view_workorders ?? false;
          case 'contacts':
            return features?.can_view_contacts ?? false;
          case 'absences':
            return features?.can_view_absences ?? false;
          case 'organigramm':
            return features?.can_view_organigramm ?? false;
          default:
            return false;
        }
      });
      
      return filteredTiles.map(tile => {
        // Mappe Tile-IDs zu Badge-Keys
        const badgeMap: Record<string, keyof typeof badges> = {
          'work-tickets': 'arbeitsscheine',
          'organigramm': 'organigramm',
          'sofo': 'sofortmeldungen',
          'absences': 'absences'
        };

        const badgeKey = badgeMap[tile.id];
        const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;

        return {
          ...tile,
          badge: badgeCount > 0 ? badgeCount : undefined
        };
      });
    })
  );

  constructor() { 
    // Icons werden in der TileGrid-Komponente registriert
    // Features laden
    this.userFeatures.loadFeatures().subscribe();
  }

}
