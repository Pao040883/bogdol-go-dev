import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton } from '@ionic/angular/standalone';
import { TileGridComponent, TileConfig } from 'src/app/shared/components/tile-grid/tile-grid.component';

@Component({
  selector: 'app-external-links',
  templateUrl: './external-links.page.html',
  styleUrls: ['./external-links.page.scss'],
  standalone: true,
  imports: [IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonMenuButton, TileGridComponent]
})
export class ExternalLinksPage implements OnInit {

  externalLinkTiles: TileConfig[] = [
    {
      id: 'zeiterfassung',
      title: 'Zeiterfassung',
      subtitle: 'Personal',
      icon: 'time-outline',
      color: 'primary',
      externalUrl: 'https://bogdol.blink.online'
    },
    {
      id: 'jobportal',
      title: 'Jobportal',
      subtitle: 'Personal',
      icon: 'person-add-outline',
      color: 'primary',
      externalUrl: 'https://ich-reinige.de'
    },
    {
      id: 'qualitaet',
      title: 'Qualität',
      subtitle: 'Betrieb',
      icon: 'checkbox-outline',
      color: 'primary',
      externalUrl: 'https://bogdol-check.blink.online/'
    },
    {
      id: 'elearning',
      title: 'E-Learning',
      subtitle: 'Personal',
      icon: 'book-outline',
      color: 'primary',
      externalUrl: 'https://bogdol.keelearning.de/'
    }
  ];

  constructor() { 
    // Icons werden in der TileGrid-Komponente registriert
  }

  ngOnInit() {
  }

}
