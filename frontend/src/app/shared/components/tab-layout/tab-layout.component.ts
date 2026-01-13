import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonTabs, IonTab, IonTabBar, IonTabButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  listOutline, addOutline, archiveOutline, settingsOutline,
  statsChartOutline, peopleOutline, documentTextOutline, calendarOutline,
  list, add, archive
} from 'ionicons/icons';

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

/**
 * Wiederverwendbare Tab-Layout Komponente
 * 
 * Verwendung:
 * <app-tab-layout [tabs]="tabConfig">
 *   <ng-template tab-content="list">
 *     <!-- Content für Tab 1 -->
 *   </ng-template>
 *   <ng-template tab-content="new">
 *     <!-- Content für Tab 2 -->
 *   </ng-template>
 * </app-tab-layout>
 */
@Component({
  selector: 'app-tab-layout',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonTabs, IonTab, IonTabBar, IonTabButton, IonIcon
  ],
  templateUrl: './tab-layout.component.html',
  styleUrls: ['./tab-layout.component.scss']
})
export class TabLayoutComponent {
  @Input() tabs: TabConfig[] = [];
  @Input() tabBarColor: string = 'primary';
  @Input() selectedTab = signal<string>('');

  constructor() {
    addIcons({
      listOutline, addOutline, archiveOutline, settingsOutline,
      statsChartOutline, peopleOutline, documentTextOutline, calendarOutline,
      list, add, archive
    });
  }
}
