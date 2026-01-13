import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, computed } from '@angular/core';
import { catchError, of, tap, throwError, Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Users } from '../interfaces/users';
import { BadgeService } from '../../services/badge.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
private readonly http = inject(HttpClient);
  private readonly badgeService = inject(BadgeService);
  private readonly baseUrl = `${environment.apiUrl}/admin/users/`;

  /** Signal: Liste aller Benutzer */
  readonly users = signal<Users[]>([]);
  
  /** Computed: Nur aktive Benutzer */
  readonly activeUsers = computed(() => this.users().filter(u => u.is_active));
  
  /** Computed: Aktive Benutzer ohne Vorgesetzten */
  readonly usersWithoutSupervisor = computed(() => 
    this.activeUsers().filter(u => !u.supervisor)
  );
  
  /** Signal: Aktueller Benutzer */
  readonly selectedUser = signal<Users | null>(null);
  /** Signal: Lade-/Fehlerstatus */
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Kein automatisches Laden hier - wird von app.component.ts gesteuert
  }

  /**
   * Lädt Badge-Counts für Benutzer ohne Vorgesetzten beim App-Start
   * Macht Backend-Call und setzt Badge
   */
  loadBadgeCounts(): Observable<void> {
    return this.http.get<Users[]>(this.baseUrl).pipe(
      tap((users) => {
        // Zähle aktive Benutzer ohne Vorgesetzten
        const activeUsers = users.filter(u => u.is_active);
        const usersWithoutSupervisor = activeUsers.filter(u => !u.supervisor);
        const count = usersWithoutSupervisor.length;
        
        this.badgeService.setBadge('users', count);
        console.log(`👥 Benutzer-Badges: ${count} ohne Vorgesetzten`);
      }),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  /**
   * Aktualisiert Badge-Count basierend auf aktuell geladenen Benutzern
   */
  private updateBadgeCount(): void {
    const count = this.usersWithoutSupervisor().length;
    this.badgeService.setBadge('users', count);
    console.log(`👥 Badge aktualisiert: ${count} Benutzer ohne Vorgesetzten`);
  }

  /** Alle Benutzer laden */
  loadUsers(): void {
    this.isLoading.set(true);
    this.http.get<Users[]>(this.baseUrl)
      .pipe(
        tap((data) => {
          this.users.set(data);
          this.error.set(null);
          // Badge aktualisieren nach dem Laden
          this.updateBadgeCount();
        }),
        catchError((err) => {
          // Don't catch 401 errors - let auth interceptor handle token refresh
          if (err.status === 401) {
            return throwError(() => err);
          }
          this.error.set('Fehler beim Laden der Benutzer');
          return of([]);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Benutzer erstellen */
  createUser(user: Partial<Users>): void {
    this.isLoading.set(true);
    this.http.post<Users>(this.baseUrl, user)
      .pipe(
        tap((newUser) => {
          this.users.update((list) => [...list, newUser]);
          this.error.set(null);
        }),
        catchError((err) => {
          // Don't catch 401 errors - let auth interceptor handle token refresh
          if (err.status === 401) {
            return throwError(() => err);
          }
          this.error.set('Fehler beim Erstellen');
          return of(null);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Benutzer aktualisieren */
  updateUser(id: number, data: Partial<Users>): void {
    this.isLoading.set(true);
    this.http.patch<Users>(`${this.baseUrl}${id}/`, data)
      .pipe(
        tap((updated) => {
          this.users.update((list) =>
            list.map((u) => (u.id === id ? updated : u))
          );
          this.selectedUser.set(updated);
          this.error.set(null);
          // Badge aktualisieren nach Update
          this.updateBadgeCount();
        }),
        catchError((err) => {
          // Don't catch 401 errors - let auth interceptor handle token refresh
          if (err.status === 401) {
            return throwError(() => err);
          }
          this.error.set('Fehler beim Aktualisieren');
          return of(null);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Benutzer löschen */
  deleteUser(id: number): void {
    this.http.delete<void>(`${this.baseUrl}${id}/`)
      .pipe(
        tap(() => {
          this.users.update((list) => list.filter((u) => u.id !== id));
          this.error.set(null);
        }),
        catchError((err) => {
          // Don't catch 401 errors - let auth interceptor handle token refresh
          if (err.status === 401) {
            return throwError(() => err);
          }
          this.error.set('Fehler beim Löschen');
          return of();
        })
      )
      .subscribe();
  }

  /** Einzelnen Benutzer laden */
  loadUser(id: number): void {
    this.http.get<Users>(`${this.baseUrl}${id}/`)
      .pipe(
        tap((user) => {
          this.selectedUser.set(user);
          this.error.set(null);
        }),
        catchError((err) => {
          // Don't catch 401 errors - let auth interceptor handle token refresh
          if (err.status === 401) {
            return throwError(() => err);
          }
          this.error.set('Fehler beim Laden des Benutzers');
          return of(null);
        })
      )
      .subscribe();
  }
}
