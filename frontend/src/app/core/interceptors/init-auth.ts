import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { JwtUtilsService } from '../services/jwt-utils.service';
import { CookieDebugService } from '../services/cookie-debug.service';

export function appInitializer(): Promise<unknown> {
  const auth = inject(AuthService);
  const router = inject(Router);
  const jwtUtils = inject(JwtUtilsService);
  const cookieDebug = inject(CookieDebugService);

  return new Promise((resolve) => {
    // Debug: Cookie-Status beim App-Start
    cookieDebug.debugPageLoadCookies();
    
    // Warte, bis die Router-URL initialisiert ist
    setTimeout(() => {
      const url = window.location.pathname;

      if (url.startsWith('/login') || url.startsWith('/set-password') || url.startsWith('/reset-password')) {
        // Kein Refresh auf der Login-Seite
        console.log('🔐 On login page - skipping token refresh');
        resolve(true);
      } else {
        // Prüfe vorhandenes Token
        const existingToken = auth.accessToken();
        
        console.log('🔍 App Initializer - Token check:', {
          hasToken: !!existingToken,
          hasRefreshCookie: cookieDebug.hasCookie('refresh_token'),
          currentUrl: url
        });
        
        if (existingToken) {
          // Prüfe ob Token noch gültig ist
          const isExpired = jwtUtils.isTokenExpired(existingToken);
          
          if (!isExpired) {
            // Token ist noch gültig, lade User-Daten falls nicht vorhanden
            if (!auth.activeUser()) {
              console.log('🔄 Valid token but no user - loading user data');
              firstValueFrom(auth.loadCurrentUser())
                .catch(() => {}) // Fehler ignorieren
                .finally(() => resolve(true));
            } else {
              console.log('✅ Valid token and user data present');
              resolve(true);
            }
          } else {
            // Token ist abgelaufen, versuche Refresh
            console.log('🔄 Token expired - attempting refresh');
            firstValueFrom(auth.refreshToken())
              .catch(() => {}) // Fehler ignorieren, App soll trotzdem starten
              .finally(() => resolve(true));
          }
        } else {
          // Kein Token vorhanden, versuche Refresh (falls Cookie da ist)
          console.log('🔄 No token in memory - attempting refresh from cookie');
          firstValueFrom(auth.refreshToken())
            .catch(() => {}) // Fehler ignorieren, App soll trotzdem starten
            .finally(() => resolve(true));
        }
      }
    }, 0); // delay nötig, damit Router initialisiert ist
  });
}
