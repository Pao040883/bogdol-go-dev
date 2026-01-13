// src/app/services/user-phonebook.service.ts
import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { of, Observable, Subject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserPhonebookEntry } from '../interfaces/user-phonebook.types';

export interface SemanticSearchResult extends UserPhonebookEntry {
  relevance_score?: number;
  matched_fields?: Array<[string, string]>;
}

@Injectable({
  providedIn: 'root',
})
export class UserPhonebookService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/phonebook/`;
  private readonly searchEndpoint = `${environment.apiUrl}/profiles/search/`;

  /** Signal: Telefonbuchdaten */
  readonly entries = signal<UserPhonebookEntry[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  
  /** KI-Suche Signals */
  readonly searchResults = signal<SemanticSearchResult[]>([]);
  readonly isSearching = signal(false);
  readonly useSemanticSearch = signal(true); // KI standardmäßig aktiv
  readonly autocompleteResults = signal<string[]>([]);
  readonly relatedQueries = signal<string[]>([]);

  constructor() {
    this.loadPhonebook();
  }

  /** API laden */
  loadPhonebook(): void {
    this.isLoading.set(true);
    this.http.get<UserPhonebookEntry[]>(this.endpoint)
      .pipe(
        tap((entries) => {
          this.entries.set(entries);
          this.error.set(null);
        }),
        catchError((err) => {
          this.error.set('Fehler beim Laden des Telefonbuchs');
          return of([]);
        }),
        tap(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  /** Einträge filtern (z. B. nur anwesende oder abwesende anzeigen) */
  filterByAbsence(isAbsent: boolean): UserPhonebookEntry[] {
    return this.entries().filter(entry => entry.is_absent === isAbsent);
  }
  /**
   * KI-gestützte Suche nach Mitarbeitern
   * Findet relevante Personen basierend auf natürlicher Sprache
   * Beispiel: "Handy kaputt" → Findet IT-Support
   */
  searchSemantic(query: string): Observable<SemanticSearchResult[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    this.isSearching.set(true);

    const params = new HttpParams()
      .set('q', query.trim())
      .set('semantic', this.useSemanticSearch() ? 'true' : 'false');

    return this.http.get<SemanticSearchResult[]>(this.searchEndpoint, { params })
      .pipe(
        tap((results) => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        }),
        catchError((err) => {
          console.error('Semantic search error:', err);
          this.isSearching.set(false);
          return of([]);
        })
      );
  }

  /**
   * Toggle zwischen KI-Suche und einfacher Textsuche
   */
  toggleSemanticSearch(): void {
    this.useSemanticSearch.set(!this.useSemanticSearch());
  }

  /**
   * Auto-Complete für Such-Queries
   * Gibt Vorschläge während der Eingabe
   */
  getAutocomplete(partialQuery: string): Observable<string[]> {
    if (!partialQuery || partialQuery.trim().length < 2) {
      this.autocompleteResults.set([]);
      return of([]);
    }

    const params = new HttpParams().set('q', partialQuery.trim());

    return this.http.get<{suggestions: string[]}>(`${environment.apiUrl}/search/autocomplete/`, { params })
      .pipe(
        tap((response) => {
          this.autocompleteResults.set(response.suggestions);
        }),
        map((response) => response.suggestions),
        catchError((err) => {
          console.error('Autocomplete error:', err);
          this.autocompleteResults.set([]);
          return of([]);
        })
      );
  }

  /**
   * Verwandte Queries laden
   * Zeigt was andere User auch gesucht haben
   */
  getRelatedQueries(query: string): Observable<string[]> {
    if (!query || query.trim().length < 2) {
      this.relatedQueries.set([]);
      return of([]);
    }

    const params = new HttpParams().set('q', query.trim());

    return this.http.get<{related: string[]}>(`${environment.apiUrl}/search/related/`, { params })
      .pipe(
        tap((response) => {
          this.relatedQueries.set(response.related);
        }),
        map((response) => response.related),
        catchError((err) => {
          console.error('Related queries error:', err);
          this.relatedQueries.set([]);
          return of([]);
        })
      );
  }
}