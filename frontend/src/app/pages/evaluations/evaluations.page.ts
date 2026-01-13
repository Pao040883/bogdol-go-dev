import { Component, OnInit, signal } from '@angular/core';
import { addIcons } from 'ionicons';
import { timeOutline, analyticsOutline, statsChartOutline } from 'ionicons/icons';
import { IonHeader, IonToolbar, IonButtons, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonMenuButton } from "@ionic/angular/standalone";
import { RouterLink } from '@angular/router';
import { TileGridComponent } from '../../shared/components/tile-grid/tile-grid.component';
import type { TileConfig } from '../../shared/components/tile-grid/tile-grid.component';

@Component({
  selector: 'app-evaluations',
  templateUrl: './evaluations.page.html',
  styleUrls: ['./evaluations.page.scss'],
  standalone: true,
  imports: [IonCardContent, IonCardTitle, IonCardHeader, IonCard, IonContent, IonTitle, IonButtons, IonToolbar, IonHeader, RouterLink, IonMenuButton, TileGridComponent]
})
export class EvaluationsPage implements OnInit {

  evaluationTiles = signal<TileConfig[]>([
    {
      id: 'blink-analysis',
      title: 'Blink Nutzungsanalyse',
      subtitle: 'Service Manager Auswertungen',
      icon: 'time-outline',
      color: 'primary',
      route: '/auswertungen/blink-nutzung'
    },
  ]);

  constructor() { 
    addIcons({timeOutline, analyticsOutline, statsChartOutline});
  }

  ngOnInit() {
  }
}
