import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/angular/standalone';
import { TileGridComponent, TileConfig } from 'src/app/shared/components/tile-grid/tile-grid.component';

@Component({
  selector: 'app-intranet',
  templateUrl: './intranet.page.html',
  styleUrls: ['./intranet.page.scss'],
  standalone: true,
  imports: [
    IonCol,
    IonRow,
    IonGrid,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    TileGridComponent
  ]
})
export class IntranetPage {
  tiles: TileConfig[] = [
    {
      id: 'chat',
      title: 'Chat',
      subtitle: 'Nachrichten & Kommunikation',
      icon: 'chatbubbles-outline',
      color: 'primary',
      route: '/intranet/chat'
    },
    {
      id: 'organigramm',
      title: 'Organigramm',
      subtitle: 'Organisationsstruktur',
      icon: 'git-network-outline',
      color: 'tertiary',
      route: '/apps/intranet/organigramm'
    }
  ];

  constructor(private router: Router) {}

  onTileClick(tileId: string) {
    const tile = this.tiles.find(t => t.id === tileId);
    if (tile?.route) {
      this.router.navigate([tile.route]);
    }
  }
}
