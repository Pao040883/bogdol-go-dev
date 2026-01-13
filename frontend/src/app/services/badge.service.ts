import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BadgeState {
  chat: number;
  arbeitsscheine: number;
  sofortmeldungen: number;
  absences: number;
  users?: number; // Benutzer ohne Vorgesetzten (optional)
  [key: string]: number | undefined; // Erweiterbar für zukünftige Module
}

@Injectable({
  providedIn: 'root'
})
export class BadgeService {
  private http = inject(HttpClient);
  
  private badgeState = new BehaviorSubject<BadgeState>({
    chat: 0,
    arbeitsscheine: 0,
    sofortmeldungen: 0,
    absences: 0,
    users: 0
  });

  /**
   * Observable für alle Badge-Counts
   */
  badges$: Observable<BadgeState> = this.badgeState.asObservable();

  /**
   * Observable für Gesamtzahl aller Badges
   */
  totalBadges$: Observable<number> = this.badges$.pipe(
    map(badges => 
      badges.chat + 
      badges.arbeitsscheine + 
      badges.sofortmeldungen + 
      badges.absences + 
      (badges.users ?? 0)
    )
  );

  /**
   * Observable für Summe aller App-Badges (ohne Chat)
   * Wird in der Navigation für den Apps-Menüpunkt verwendet
   */
  appBadges$: Observable<number> = this.badges$.pipe(
    map(badges => 
      (badges.arbeitsscheine ?? 0) + 
      (badges.sofortmeldungen ?? 0) + 
      (badges.absences ?? 0)
    )
  );

  constructor() { }

  /**
   * Lädt initial alle Badge-Counts
   * Sollte beim App-Start aufgerufen werden
   */
  loadAllBadges(): Observable<BadgeState> {
    return this.http.get<BadgeState>(`${environment.apiUrl}/profiles/badges/`).pipe(
      tap(badges => {
        this.badgeState.next(badges);
      }),
      catchError(error => {
        console.error('❌ Fehler beim Laden der Badges:', error);
        // Fallback zu leeren Badges
        const emptyBadges: BadgeState = {
          chat: 0,
          arbeitsscheine: 0,
          organigramm: 0,
          sofortmeldungen: 0,
          absences: 0,
          users: 0
        };
        this.badgeState.next(emptyBadges);
        return of(emptyBadges);
      })
    );
  }


  /**
   * Setzt Badge-Count für ein bestimmtes Modul
   * @param source Name des Moduls (z.B. 'chat', 'arbeitsscheine')
   * @param count Anzahl der Badges
   */
  setBadge(source: keyof BadgeState, count: number): void {
    const current = this.badgeState.value;
    this.badgeState.next({
      ...current,
      [source]: Math.max(0, count) // Keine negativen Werte
    });
  }

  /**
   * Erhöht Badge-Count um einen bestimmten Wert
   * @param source Name des Moduls
   * @param increment Inkrement (Standard: 1)
   */
  incrementBadge(source: keyof BadgeState, increment: number = 1): void {
    const current = this.badgeState.value;
    this.setBadge(source, (current[source] ?? 0) + increment);
  }

  /**
   * Verringert Badge-Count um einen bestimmten Wert
   * @param source Name des Moduls
   * @param decrement Dekrement (Standard: 1)
   */
  decrementBadge(source: keyof BadgeState, decrement: number = 1): void {
    const current = this.badgeState.value;
    this.setBadge(source, Math.max(0, (current[source] ?? 0) - decrement));
  }

  /**
   * Setzt Badge-Count für ein Modul auf 0
   * @param source Name des Moduls
   */
  clearBadge(source: keyof BadgeState): void {
    this.setBadge(source, 0);
  }

  /**
   * Gibt aktuellen Badge-Count für ein Modul zurück
   * @param source Name des Moduls
   * @returns Observable mit Badge-Count
   */
  getBadge(source: keyof BadgeState): Observable<number> {
    return this.badges$.pipe(
      map(badges => badges[source] ?? 0)
    );
  }

  /**
   * Gibt aktuellen Badge-Count für ein Modul als direkten Wert zurück
   * @param source Name des Moduls
   * @returns Badge-Count
   */
  getBadgeValue(source: keyof BadgeState): number {
    return this.badgeState.value[source] ?? 0;
  }

  /**
   * Setzt alle Badge-Counts auf 0
   */
  clearAllBadges(): void {
    this.badgeState.next({
      chat: 0,
      arbeitsscheine: 0,
      sofortmeldungen: 0,
      absences: 0,
      users: 0
    });
  }

  /**
   * Gibt aktuellen Gesamtwert aller Badges zurück
   * @returns Gesamtzahl aller Badges
   */
  getTotalBadgesValue(): number {
    const badges = this.badgeState.value;
    return badges.chat + badges.arbeitsscheine + badges.sofortmeldungen + badges.absences + (badges.users ?? 0);
  }
}
