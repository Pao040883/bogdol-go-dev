import { Component, OnInit, inject, HostListener } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { BadgeService } from './services/badge.service';
import { AuthService } from './core/services/auth.service';
import { IntranetWebSocketService } from './services/intranet-websocket.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private badgeService = inject(BadgeService);
  private authService = inject(AuthService);
  private wsService = inject(IntranetWebSocketService);

  ngOnInit() {
    // Badges nur laden wenn User eingeloggt ist
    if (this.authService.activeUser()) {
      this.loadAllBadges();
      
      // Presence WebSocket beim App-Start verbinden (für Online-Status)
      const token = this.authService.accessToken() || '';
      this.wsService.connectToPresence(token);
    }
  }

  /**
   * Trenne WebSocket beim Browser-Close / Tab-Close
   */
  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.wsService.disconnectAll();
  }

  private loadAllBadges() {
    // Nur den zentralen Badge-Endpoint verwenden
    this.badgeService.loadAllBadges().subscribe();
  }
}
