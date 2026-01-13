import { Injectable, Type, signal, computed, inject } from '@angular/core';
import { AppStateService } from './app-state.service';

export interface DashboardWidget {
  id: string;
  title: string;
  component: Type<any>;
  size: 'small' | 'medium' | 'large';
  permissions?: string[];
  refreshInterval?: number;
  configurable?: boolean;
  defaultConfig?: any;
}

export interface WidgetInstance {
  widget: DashboardWidget;
  position: { row: number; col: number };
  config?: any;
  visible: boolean;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private appState = inject(AppStateService);

  private _availableWidgets = signal<DashboardWidget[]>([]);
  private _userWidgets = signal<WidgetInstance[]>([]);

  readonly availableWidgets$ = this._availableWidgets.asReadonly();
  readonly userWidgets$ = this._userWidgets.asReadonly();
  readonly visibleWidgets$ = computed(() => 
    this.userWidgets$().filter(w => w.visible)
  );

  // Standard-Widgets definieren
  private readonly defaultWidgets: DashboardWidget[] = [
    {
      id: 'absence-overview',
      title: 'Urlaubsübersicht',
      component: null as any, // Wird später gesetzt
      size: 'medium',
      permissions: ['view_absences']
    },
    {
      id: 'pending-approvals',
      title: 'Ausstehende Genehmigungen',
      component: null as any,
      size: 'medium',
      permissions: ['absence_approval']
    },
    {
      id: 'quick-actions',
      title: 'Schnellzugriff',
      component: null as any,
      size: 'small'
    },
    {
      id: 'recent-activities',
      title: 'Letzte Aktivitäten',
      component: null as any,
      size: 'large'
    },
    {
      id: 'team-calendar',
      title: 'Team-Kalender',
      component: null as any,
      size: 'large',
      permissions: ['view_team_calendar']
    },
    {
      id: 'system-stats',
      title: 'System-Statistiken',
      component: null as any,
      size: 'medium',
      permissions: ['admin']
    }
  ];

  constructor() {
    this.initializeWidgets();
    this.loadUserConfiguration();
  }

  private initializeWidgets(): void {
    this._availableWidgets.set(this.defaultWidgets);
  }

  private loadUserConfiguration(): void {
    // Lade Benutzer-spezifische Widget-Konfiguration
    const savedConfig = localStorage.getItem('dashboard-widgets');
    if (savedConfig) {
      try {
        const userConfig = JSON.parse(savedConfig);
        this._userWidgets.set(userConfig);
      } catch (e) {
        console.warn('Failed to load dashboard configuration', e);
        this.setDefaultLayout();
      }
    } else {
      this.setDefaultLayout();
    }
  }

  private setDefaultLayout(): void {
    const defaultLayout: WidgetInstance[] = [
      {
        widget: this.defaultWidgets[0], // absence-overview
        position: { row: 0, col: 0 },
        visible: true
      },
      {
        widget: this.defaultWidgets[1], // pending-approvals
        position: { row: 0, col: 1 },
        visible: true
      },
      {
        widget: this.defaultWidgets[2], // quick-actions
        position: { row: 1, col: 0 },
        visible: true
      }
    ];

    this._userWidgets.set(defaultLayout);
    this.saveUserConfiguration();
  }

  addWidget(widgetId: string, position?: { row: number; col: number }): void {
    const widget = this._availableWidgets().find(w => w.id === widgetId);
    if (!widget) return;

    const newInstance: WidgetInstance = {
      widget,
      position: position || this.findNextAvailablePosition(),
      visible: true
    };

    this._userWidgets.update(widgets => [...widgets, newInstance]);
    this.saveUserConfiguration();
  }

  removeWidget(widgetId: string): void {
    this._userWidgets.update(widgets =>
      widgets.filter(w => w.widget.id !== widgetId)
    );
    this.saveUserConfiguration();
  }

  toggleWidgetVisibility(widgetId: string): void {
    this._userWidgets.update(widgets =>
      widgets.map(w =>
        w.widget.id === widgetId ? { ...w, visible: !w.visible } : w
      )
    );
    this.saveUserConfiguration();
  }

  updateWidgetPosition(widgetId: string, position: { row: number; col: number }): void {
    this._userWidgets.update(widgets =>
      widgets.map(w =>
        w.widget.id === widgetId ? { ...w, position } : w
      )
    );
    this.saveUserConfiguration();
  }

  updateWidgetConfig(widgetId: string, config: any): void {
    this._userWidgets.update(widgets =>
      widgets.map(w =>
        w.widget.id === widgetId ? { ...w, config } : w
      )
    );
    this.saveUserConfiguration();
  }

  private findNextAvailablePosition(): { row: number; col: number } {
    const usedPositions = this._userWidgets().map(w => w.position);
    let row = 0;
    let col = 0;

    while (usedPositions.some(p => p.row === row && p.col === col)) {
      col++;
      if (col > 2) { // Max 3 Spalten
        col = 0;
        row++;
      }
    }

    return { row, col };
  }

  private saveUserConfiguration(): void {
    localStorage.setItem('dashboard-widgets', JSON.stringify(this._userWidgets()));
  }

  resetToDefault(): void {
    this.setDefaultLayout();
  }

  // Widget-Daten für spezifische Widgets
  getAbsenceOverviewData() {
    return computed(() => {
      const stats = this.appState.dashboardStats$();
      return {
        total: stats.totalAbsences,
        recent: stats.recentAbsences,
        pending: stats.pendingApprovals
      };
    });
  }

  getPendingApprovalsData() {
    return computed(() => this.appState.pendingApprovals$());
  }

  getQuickActionsData() {
    return computed(() => [
      { label: 'Urlaub beantragen', icon: 'calendar', action: '/absences/create' },
      { label: 'Sofortmeldung', icon: 'alert', action: '/sofortmeldung/create' },
      { label: 'Team anzeigen', icon: 'people', action: '/team' }
    ]);
  }
}
