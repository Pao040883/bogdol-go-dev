import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonLabel, IonItem, IonList, IonIcon, IonBadge } from '@ionic/angular/standalone';
import { AuthService } from 'src/app/core/services/auth.service';
import { JwtUtilsService } from 'src/app/core/services/jwt-utils.service';
import { IconService } from 'src/app/core/services/icon.service';
import { BadgeService } from 'src/app/services/badge.service';
import { UserFeaturesService } from 'src/app/services/user-features.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss'],
  imports: [IonIcon, IonLabel, IonItem, IonList, RouterLink, IonBadge, CommonModule],
})
export class NavigationComponent implements OnInit {
  private auth = inject(AuthService);
  private jwtUtils = inject(JwtUtilsService);
  private iconService = inject(IconService);
  badgeService = inject(BadgeService);
  readonly userFeatures = inject(UserFeaturesService);

  // Sichere computed Eigenschaft für Superuser-Status
  isSuperuser = computed(() => {
    const token = this.auth.accessToken();
    if (!token) return false;
    
    const userInfo = this.jwtUtils.getUserFromToken(token);
    return userInfo?.is_superuser ?? false;
  });

  constructor() {
    // Icons werden jetzt über den IconService verwaltet
  }

  ngOnInit() {
    // Features laden
    this.userFeatures.loadFeatures().subscribe();
    
    // Debug: Badge-Status loggen
    this.badgeService.badges$.subscribe(badges => {
      console.log('🔔 Navigation: Badge-Update empfangen', badges);
    });
    
    this.badgeService.appBadges$.subscribe(appBadges => {
      console.log('🔔 Navigation: App-Badges Summe', appBadges);
    });
  }

  logout() {
    this.auth.logout();
  }
}
