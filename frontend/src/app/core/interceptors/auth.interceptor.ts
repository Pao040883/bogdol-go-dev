import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { JwtUtilsService } from '../services/jwt-utils.service';
import { ErrorHandlingService } from '../services/error-handling.service';
import { environment } from '../../../environments/environment';

const AUTH_PATHS = [
  '/api/auth/token/',
  '/api/auth/token/refresh/',
  '/api/auth/logout/',
  '/api/auth/reset-password/',
  '/api/auth/reset-password-confirm/',
  '/api/auth/set-password/',
  '/api/blink/', // Blink API ist öffentlich verfügbar
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const jwtUtils = inject(JwtUtilsService);
  const errorHandler = inject(ErrorHandlingService);

  const isPublic = AUTH_PATHS.some(
    (path) => req.url.endsWith(path) || req.url.includes(path)
  );

  if (isPublic) {
    return next(req); // keine Token-Verarbeitung, kein Refresh
  }

  const token = auth.accessToken();
  
  // Wenn kein Token vorhanden, Request ohne Token senden
  if (!token) {
    return next(req);
  }

  // Token-Gültigkeit prüfen und ggf. proaktiv refreshen
  const timeUntilExpiry = jwtUtils.getTimeUntilExpiry(token);
  if (timeUntilExpiry !== null && timeUntilExpiry < environment.tokenRefreshThreshold) {
    return auth.refreshToken().pipe(
      switchMap((newToken) => {
        const authReq = req.clone({
          setHeaders: { Authorization: `Bearer ${newToken || token}` }
        });
        return next(authReq);
      }),
      catchError(() => {
        // Bei Refresh-Fehler mit altem Token versuchen
        const authReq = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        });
        return next(authReq);
      })
    );
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(authReq).pipe(
    catchError((err) => {
      // Bei 401-Fehler Token-Refresh versuchen (aber NUR EINMAL)
      if (err.status === 401 && !req.url.includes('/token/refresh/')) {
        console.log('🔒 Got 401 error, attempting token refresh...');
        
        return auth.refreshToken().pipe(
          switchMap((newToken) => {
            if (newToken) {
              console.log('✅ Retry request with new token');
              const retry = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(retry);
            }
            console.warn('⚠️ Token refresh returned null');
            return throwError(() => err);
          }),
          catchError((refreshErr) => {
            // Refresh fehlgeschlagen - nur ausloggen wenn nicht auf öffentlicher Seite
            const publicUrl = [
              '/login',
              '/reset-password',
              '/set-password',
            ].some((path) => router.url.startsWith(path));
            
            if (!publicUrl) {
              console.warn('❌ Token refresh failed permanently, logging out user');
              // Timeout um zu verhindern, dass logout weitere Requests auslöst
              setTimeout(() => {
                auth.logout();
                router.navigate(['/login']);
              }, 100);
            }
            return throwError(() => refreshErr);
          })
        );
      }
      
      // Bei 401 auf /token/refresh/ direkt ausloggen (Refresh-Token ungültig)
      if (err.status === 401 && req.url.includes('/token/refresh/')) {
        console.warn('❌ Refresh token invalid or expired, logging out');
        const publicUrl = ['/login', '/reset-password', '/set-password'].some((path) => router.url.startsWith(path));
        
        if (!publicUrl) {
          setTimeout(() => {
            auth.logout();
            router.navigate(['/login']);
          }, 100);
        }
        return throwError(() => err);
      }
      
      // Andere Fehler weiterwerfen
      return throwError(() => err);
    })
  );
};
