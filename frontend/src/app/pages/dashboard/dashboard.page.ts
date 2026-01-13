import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonBadge,
} from '@ionic/angular/standalone';
import { AbsenceService } from 'src/app/core/services/absence.service';
import { AppStateService } from 'src/app/core/services/app-state.service';
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { BadgeService } from 'src/app/services/badge.service';
import { UserFeaturesService } from 'src/app/services/user-features.service';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  homeOutline, 
  appsOutline, 
  analyticsOutline, 
  settingsOutline, 
  linkOutline, 
  alertCircleOutline,
  constructOutline,
  peopleOutline,
  calendarOutline,
  statsChartOutline,
  personOutline,
  openOutline,
  chevronForwardOutline, 
  businessOutline, 
  chatbubblesOutline, 
  gitNetworkOutline, 
  briefcaseOutline, 
  schoolOutline, 
  timeOutline, 
  personAddOutline, 
  checkboxOutline, 
  bookOutline,
  documentTextOutline, lockClosedOutline } from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonCardContent,
    IonCardTitle,
    IonCardSubtitle,
    IonCardHeader,
    IonCard,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    CommonModule,
    FormsModule,
    IonMenuButton,
    RouterLink,
  ],
})
export class DashboardPage {
  readonly absenceService = inject(AbsenceService);
  readonly appState = inject(AppStateService);
  readonly dashboardService = inject(DashboardService);
  readonly badgeService = inject(BadgeService);
  readonly userFeatures = inject(UserFeaturesService);

  // Computed: Prüft ob User irgendwelche App-Berechtigungen hat
  hasAnyAppPermission = computed(() => {
    const features = this.userFeatures.features();
    return features?.can_view_sofo ||
           features?.can_view_workorders ||
           features?.can_view_work_tickets ||
           features?.can_view_contacts ||
           features?.can_view_absences;
  });

  // Computed: Prüft ob User irgendwelche Intranet-Berechtigungen hat
  hasAnyIntranetPermission = computed(() => {
    const features = this.userFeatures.features();
    return features?.can_view_chat ||
           features?.can_view_organigramm;
  });

  // Computed: Prüft ob User überhaupt irgendwelche Berechtigungen hat
  hasAnyPermission = computed(() => {
    return this.hasAnyAppPermission() ||
           this.hasAnyIntranetPermission() ||
           this.userFeatures.features()?.can_view_analytics ||
           this.userFeatures.features()?.can_view_admin ||
           this.userFeatures.features()?.can_view_external_links;
  });

  constructor() {
    // Icons hinzufügen
    addIcons({homeOutline,lockClosedOutline,appsOutline,alertCircleOutline,chevronForwardOutline,documentTextOutline,constructOutline,peopleOutline,calendarOutline,businessOutline,chatbubblesOutline,gitNetworkOutline,analyticsOutline,statsChartOutline,settingsOutline,personOutline,briefcaseOutline,schoolOutline,linkOutline,timeOutline,openOutline,personAddOutline,checkboxOutline,bookOutline});

    // Features und Daten laden
    this.userFeatures.loadFeatures().subscribe();
    this.absenceService.loadPendingApprovals();
    this.appState.refreshAllData();
  }
}
