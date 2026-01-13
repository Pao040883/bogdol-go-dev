import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize, map, tap, throwError, retry, switchMap, BehaviorSubject, Observable, filter, take, of, shareReplay, forkJoin, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Users } from '../interfaces/users';
import { ErrorHandlingService } from './error-handling.service';
import { CookieDebugService } from './cookie-debug.service';
import { CryptoService } from './crypto.service';
import { IntranetApiService } from '../../services/intranet-api.service';
import { UserFeaturesService } from '../../services/user-features.service';
import { BadgeService } from '../../services/badge.service';
import { IntranetWebSocketService } from '../../services/intranet-websocket.service';

interface TokenResponse {
  access: string;
  user: Users;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlingService);
  private cookieDebug = inject(CookieDebugService);
  private cryptoService = inject(CryptoService);
  private intranetApi = inject(IntranetApiService);
  private userFeaturesService = inject(UserFeaturesService);
  private badgeService = inject(BadgeService);
  private wsService = inject(IntranetWebSocketService);
  private baseUrl = `${environment.apiUrl}/auth/`;
  
  activeUser = signal<Users | null>(null);

  /** Signal für das Access-Token - NUR im Memory! */
  accessToken = signal<string | null>(null);

  /** Subject für laufende Token-Refreshes - verhindert parallele Refresh-Anfragen */
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  
  /** Observable für laufenden Refresh - verhindert Race Conditions */
  private currentRefresh$: Observable<string | null> | null = null;

  constructor() {
    // KEINE Persistierung von Tokens im localStorage!
    // Tokens werden nur im Memory gespeichert für maximale Sicherheit
    // Bei Page Reload wird automatisch ein Token Refresh versucht
  }

  /** Sendet Login-Daten, speichert Access-Token im Signal */
  login(username: string, password: string) {
    return this.http
      .post<TokenResponse>(
        `${this.baseUrl}token/`,
        { username, password },
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          console.log('✅ Login successful - setting tokens');
          this.accessToken.set(res.access);
          this.activeUser.set(res.user);
          
          // Debug: Cookie-Status nach Login
          setTimeout(() => {
            console.log('🍪 Cookies after login:', document.cookie);
          }, 100);
        }),
        switchMap((res) => {
          // E2E-Verschlüsselung: Key-Pair generieren oder laden
          return this.initializeE2EKeys(res.user.id);
        }),
        switchMap(() => {
          // User Features und Badges nach erfolgreichem Login laden
          console.log('🔐 Login erfolgreich, lade Features und Badges...');
          return forkJoin({
            features: this.userFeaturesService.loadFeatures(),
            badges: this.badgeService.loadAllBadges()
          });
        }),
        tap(() => {
          console.log('✅ Features und Badges geladen');
        }),
        map(() => void 0),
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handleHttpError(error, 'Login');
          return throwError(() => error);
        })
      );
  }

  resetPassword(email: string) {
    return this.http
      .post<{ message: string }>(
        `${this.baseUrl}reset-password/`,
        { email },
        { withCredentials: true }
      )
      .pipe(
        tap((res) => {
          console.log(res.message);
          this.errorHandler.showSuccessToast('Password-Reset E-Mail wurde versendet');
        }),
        map(() => void 0),
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handleHttpError(error, 'Password Reset');
          return throwError(() => error);
        })
      );
  }

  resetPasswordConfirm(
    uid: string,
    token: string,
    password1: string,
    password2: string
  ) {
    return this.http
      .post<{ message: string }>(
        `${this.baseUrl}reset-password-confirm/`,
        {
          uid: uid,
          token: token,
          new_password1: password1,
          new_password2: password2,
        },
        { withCredentials: true }
      )
      .pipe(
        map((res) => res.message),
        catchError((err) => throwError(() => err))
      );
  }

  /** Holt neuen Access-Token via Refresh-Token-Cookie */
  refreshToken(): Observable<string | null> {
    // Wenn bereits ein Refresh läuft, das bestehende Observable zurückgeben
    // Das verhindert Race Conditions besser als ein Boolean Flag
    if (this.currentRefresh$) {
      console.log('🔄 Refresh already in progress - reusing existing observable');
      return this.currentRefresh$;
    }

    console.log('🔄 Starting token refresh...');
    this.refreshTokenSubject.next(null);

    // Observable erstellen und speichern - WICHTIG: shareReplay(1) damit alle Subscriber
    // das gleiche Result bekommen ohne mehrere HTTP Requests auszulösen
    this.currentRefresh$ = this.http
      .post<TokenResponse>(
        `${this.baseUrl}token/refresh/`,
        {},
        { withCredentials: true }
      )
      .pipe(
        shareReplay(1),
        tap((res) => {
          console.log('✅ Token refresh successful');
          this.accessToken.set(res.access);
          this.refreshTokenSubject.next(res.access);
          
          if (res.user) {
            console.log('✅ User data received in refresh response');
            this.activeUser.set(res.user);
          } else {
            console.log('⚠️ No user data in refresh response - loading separately');
            // Fallback: User-Daten separat laden falls nicht im Response
            this.loadCurrentUser().subscribe({
              error: (error) => console.warn('Failed to load user after token refresh:', error)
            });
          }
        }),
        map((res) => res.access),
        catchError((error: HttpErrorResponse) => {
          console.warn('❌ Token refresh failed:', error.status, error.message);
          
          // Wichtig: refreshTokenSubject mit null setzen, damit wartende Requests einen Fehler bekommen
          this.refreshTokenSubject.next(null);
          
          // Logout NICHT hier - wird vom Interceptor behandelt
          return throwError(() => error);
        }),
        finalize(() => {
          console.log('🔄 Token refresh completed (success or failure)');
          // Observable zurücksetzen, damit nächster Refresh neu starten kann
          this.currentRefresh$ = null;
        })
      );

    // Das gleiche Observable zurückgeben - alle gleichzeitigen Aufrufe bekommen das gleiche
    return this.currentRefresh$;
  }

  /** Debug: Cookie-Status checken */
  private debugCookieStatus(): void {
    // Backend-Debug-Endpoint aufrufen
    this.http.get(`${environment.apiUrl}/debug/cookies/`).subscribe({
      next: (result) => console.log('🍪 Backend Cookie Debug:', result),
      error: (error) => console.warn('🍪 Cookie Debug failed:', error)
    });
  }

  /** Load current user data */
  loadCurrentUser() {
    return this.http.get<Users>(`${environment.apiUrl}/users/current/`).pipe(
      tap((user) => {
        this.activeUser.set(user);
      }),
      catchError((error) => {
        console.warn('Failed to load current user:', error);
        return throwError(() => error);
      })
    );
  }

  /** Load user profile - Alias für loadCurrentUser (für AuthGuard) */
  loadUserProfile() {
    return this.loadCurrentUser();
  }

  /** Prüft, ob eingeloggt */
  get isLoggedIn(): boolean {
    return !!this.accessToken();
  }

  /** Logout: Blacklist-Request und Redirect */
  logout() {
    this.http
      .post(
        `${this.baseUrl}logout/`,
        {},
        { withCredentials: true }
      )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // Auch bei Logout-Fehler den lokalen State clearen
          console.warn('Logout request failed, clearing local state:', error);
          return EMPTY;
        })
      )
      .subscribe({
        complete: () => {
          this.accessToken.set(null);
          this.activeUser.set(null);
          
          // Clear all services on logout
          this.clearAllServiceStates();
          
          this.router.navigate(['/login']);
        },
      });
  }
  
  /**
   * Löscht alle Service-States beim Logout
   */
  private clearAllServiceStates() {
    // Disconnect WebSocket FIRST - damit User als offline markiert wird
    this.wsService.disconnectAll();
    
    // Clear User Features
    this.userFeaturesService.features.set(null);
    
    // Clear Badges
    this.badgeService.clearAllBadges();
    
    console.log('✅ All service states cleared on logout');
  }

  // ========================================================================
  // E2E ENCRYPTION KEY MANAGEMENT
  // ========================================================================

  /**
   * Initialisiert E2E-Verschlüsselungs-Keys beim Login
   * - Lädt bestehende Keys aus localStorage
   * - Oder generiert neue Keys und uploaded Public Key zum Server
   */
  private async initializeE2EKeys(userId: number): Promise<void> {
    try {
      console.log('🔐 Initializing E2E encryption keys for user', userId);
      
      // Versuche Keys aus localStorage zu laden
      let keyPair = await this.cryptoService.retrieveKeyPair(userId);
      
      if (keyPair) {
        console.log('✅ Existing E2E keys loaded from storage');
        
        // Prüfe ob Public Key auf Server vorhanden ist
        try {
          const serverKeys = await this.intranetApi.getPublicKeys([userId]).toPromise();
          if (!serverKeys || !serverKeys[userId]) {
            console.log('⚠️ Public key not found on server, re-uploading...');
            const publicKeyStr = await this.cryptoService.exportPublicKey(keyPair.publicKey);
            await this.intranetApi.uploadPublicKey(publicKeyStr).toPromise();
            console.log('✅ Public key re-uploaded to server');
          }
        } catch (error) {
          console.warn('⚠️ Could not verify public key on server:', error);
        }
      } else {
        console.log('🔑 No existing keys found - generating new key pair...');
        
        // Generiere neues Key-Pair
        keyPair = await this.cryptoService.generateKeyPair();
        console.log('✅ Key pair generated');
        
        // Speichere Private Key lokal
        await this.cryptoService.storeKeyPair(userId, keyPair);
        console.log('✅ Private key stored locally');
        
        // Exportiere Public Key und sende an Server
        const publicKeyStr = await this.cryptoService.exportPublicKey(keyPair.publicKey);
        console.log('✅ Public key exported, uploading to server...');
        
        const uploadResult = await this.intranetApi.uploadPublicKey(publicKeyStr).toPromise();
        console.log('✅ Public key uploaded to server:', uploadResult);
        
        console.log('🎉 New E2E keys generated and public key uploaded successfully');
      }
    } catch (error) {
      console.error('❌ Failed to initialize E2E keys:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      // Fehler wird nicht geworfen, damit Login trotzdem funktioniert
    }
  }

  /**
   * Manuell E2E Keys generieren (für Testing/Debugging)
   */
  async generateE2EKeys(): Promise<void> {
    const user = this.activeUser();
    if (!user) {
      console.error('No active user');
      return;
    }
    
    console.log('🔐 Manually generating E2E keys...');
    await this.initializeE2EKeys(user.id);
  }
}
