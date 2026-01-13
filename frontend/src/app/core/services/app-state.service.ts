import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AbsenceService } from './absence.service';
import { SofortmeldungService } from './sofortmeldung.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export interface AppState {
  user: any;
  absences: any[];
  sofortmeldungen: any[];
  pendingApprovals: any[];
  loading: {
    absences: boolean;
    sofortmeldungen: boolean;
    auth: boolean;
  };
  errors: {
    absences: string | null;
    sofortmeldungen: string | null;
    auth: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private absenceService = inject(AbsenceService);
  private sofortmeldungService = inject(SofortmeldungService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  // Zentrale State Signals
  private _state = signal<AppState>({
    user: null,
    absences: [],
    sofortmeldungen: [],
    pendingApprovals: [],
    loading: {
      absences: false,
      sofortmeldungen: false,
      auth: false
    },
    errors: {
      absences: null,
      sofortmeldungen: null,
      auth: null
    }
  });

  // Public readonly state
  readonly state$ = this._state.asReadonly();

  // Computed selectors
  readonly user$ = computed(() => this.state$().user);
  readonly absences$ = computed(() => this.state$().absences);
  readonly sofortmeldungen$ = computed(() => this.state$().sofortmeldungen);
  readonly pendingApprovals$ = computed(() => this.state$().pendingApprovals);
  readonly isLoading$ = computed(() => {
    const loading = this.state$().loading;
    return loading.absences || loading.sofortmeldungen || loading.auth;
  });
  readonly hasErrors$ = computed(() => {
    const errors = this.state$().errors;
    return !!(errors.absences || errors.sofortmeldungen || errors.auth);
  });

  constructor() {
    this.initializeState();
  }

  private initializeState(): void {
    // Sync mit bestehenden Services
    effect(() => {
      this.updateState({
        user: this.authService.activeUser(),
        absences: this.absenceService.absences(),
        sofortmeldungen: this.sofortmeldungService.sofortmeldungen$(),
        pendingApprovals: this.absenceService.pendingApprovals(),
        loading: {
          absences: this.absenceService.isLoading(),
          sofortmeldungen: this.sofortmeldungService.loading$(),
          auth: false // AuthService hat kein loading signal
        },
        errors: {
          absences: this.absenceService.error(),
          sofortmeldungen: this.sofortmeldungService.error$(),
          auth: null
        }
      });
    });
  }

  private updateState(partialState: Partial<AppState>): void {
    this._state.update(currentState => ({
      ...currentState,
      ...partialState
    }));
  }

  // Actions
  async refreshAllData(): Promise<void> {
    try {
      await Promise.all([
        this.absenceService.load(),
        this.sofortmeldungService.fetchAll(false), // ohne Cache
        this.absenceService.loadPendingApprovals()
      ]);
      
      this.notificationService.notifySuccess('Daten erfolgreich aktualisiert');
    } catch (error) {
      this.notificationService.notifyError('Fehler beim Aktualisieren der Daten');
    }
  }

  // Selectors für spezifische Daten
  getAbsenceById(id: number) {
    return computed(() => 
      this.absences$().find(absence => absence.id === id)
    );
  }

  getSofortmeldungById(id: number) {
    return computed(() => 
      this.sofortmeldungen$().find(meldung => meldung.id === id)
    );
  }

  // Dashboard-spezifische Selectors
  readonly dashboardStats$ = computed(() => {
    const state = this.state$();
    return {
      totalAbsences: state.absences.length,
      pendingApprovals: state.pendingApprovals.length,
      totalSofortmeldungen: state.sofortmeldungen.length,
      recentAbsences: state.absences
        .filter(a => new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .length
    };
  });

  // Reset functions
  clearErrors(): void {
    this.updateState({
      errors: {
        absences: null,
        sofortmeldungen: null,
        auth: null
      }
    });
  }

  resetState(): void {
    this._state.set({
      user: null,
      absences: [],
      sofortmeldungen: [],
      pendingApprovals: [],
      loading: {
        absences: false,
        sofortmeldungen: false,
        auth: false
      },
      errors: {
        absences: null,
        sofortmeldungen: null,
        auth: null
      }
    });
  }
}
