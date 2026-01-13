import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  IonGrid, IonRow, IonCol, IonItem, IonIcon, IonLabel, IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline, calendarOutline, documentOutline, callOutline,
  peopleOutline, settingsOutline, statsChartOutline, briefcaseOutline,
  homeOutline, notificationsOutline, mailOutline, folderOutline,
  timeOutline, personAddOutline, checkboxOutline, bookOutline, businessOutline,
  schoolOutline, gitNetworkOutline, shieldCheckmarkOutline, analyticsOutline
} from 'ionicons/icons';

export interface TileConfig {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  color?: string;
  route?: string;
  externalUrl?: string; // Für externe Links
  disabled?: boolean;
  badge?: string | number;
  badge$?: Observable<number>; // Observable für dynamische Badges
}

/**
 * Wiederverwendbare Tile-Grid Komponente für Dashboard/Übersichtsseiten
 * 
 * Verwendung:
 * <app-tile-grid [tiles]="tileConfig" (tileClick)="onTileClick($event)"></app-tile-grid>
 */
@Component({
  selector: 'app-tile-grid',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    IonGrid, IonRow, IonCol, IonItem, IonIcon, IonLabel, IonBadge
  ],
  templateUrl: './tile-grid.component.html',
  styleUrls: ['./tile-grid.component.scss']
})
export class TileGridComponent {
  @Input() tiles: TileConfig[] = [];
  @Input() colSizeXs: number = 12; // Mobile: volle Breite
  @Input() colSizeSm: number = 6;  // Small: halbe Breite
  @Input() colSizeMd: number = 6;  // Tablet: halbe Breite
  @Input() colSizeLg: number = 3;  // Desktop: drittel Breite
  @Input() colSizeXl: number = 3;  // Large Desktop: drittel Breite
  
  @Output() tileClick = new EventEmitter<string>();

  constructor() {
    addIcons({
      personOutline, calendarOutline, documentOutline, callOutline,
      peopleOutline, settingsOutline, statsChartOutline, briefcaseOutline,
      homeOutline, notificationsOutline, mailOutline, folderOutline,
      timeOutline, personAddOutline, checkboxOutline, bookOutline, businessOutline,
      schoolOutline, gitNetworkOutline, shieldCheckmarkOutline, analyticsOutline
    });
  }

  onTileClick(tile: TileConfig, event: Event) {
    if (tile.disabled) {
      event.preventDefault();
      return;
    }
    
    if (!tile.route && !tile.externalUrl) {
      event.preventDefault();
      this.tileClick.emit(tile.id);
    }
  }
}
