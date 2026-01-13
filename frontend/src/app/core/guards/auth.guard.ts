import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

/**
 * Guard für authentifizierte Routen
 * Leitet nicht-authentifizierte Benutzer zur Login-Seite weiter
 * Stellt sicher, dass User-Daten geladen sind bevor Route aktiviert wird
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Prüfe ob eingeloggt
  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  // ✅ KRITISCHER FIX: Stelle sicher dass User-Daten geladen sind
  if (!authService.activeUser()) {
    try {
      console.log('🔄 AuthGuard: Loading user data before route activation...');
      await firstValueFrom(authService.loadUserProfile());
      console.log('✅ AuthGuard: User data loaded successfully');
    } catch (error) {
      console.error('❌ AuthGuard: Failed to load user data:', error);
      // Bei Fehler trotzdem durchlassen - Backend wird 401 werfen wenn nötig
      // Verhindert "Stuck" Zustand
    }
  }

  return true;
};

/**
 * Guard für bereits authentifizierte Benutzer
 * Leitet bereits eingeloggte Benutzer zur Home-Seite weiter
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn) {
    return true;
  }

  router.navigate(['/home']);
  return false;
};
