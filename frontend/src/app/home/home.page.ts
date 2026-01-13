import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonSplitPane,
  IonMenu,
  IonImg,
  IonRouterOutlet,
} from '@ionic/angular/standalone';
import { NavigationComponent } from './navigation/navigation.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonRouterOutlet,
    IonImg,
    IonSplitPane,
    IonHeader,
    IonToolbar,
    IonContent,
    IonMenu,
    NavigationComponent,
  ],
})
export class HomePage {
  constructor() {}
}
