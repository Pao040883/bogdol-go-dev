import { Component, inject, signal, computed, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonSpinner, IonBadge, IonItem, IonLabel, IonDatetime, IonModal, IonCheckbox, IonSearchbar, IonList, IonAccordionGroup, IonAccordion, IonProgressBar, IonChip, IonCardSubtitle } from '@ionic/angular/standalone';
import { TileGridComponent } from '../../shared/components/tile-grid/tile-grid.component';
import type { TileConfig } from '../../shared/components/tile-grid/tile-grid.component';
import { addIcons } from 'ionicons';
import { analyticsOutline, downloadOutline, settingsOutline, refreshOutline, trendingUpOutline, peopleOutline, locationOutline, timeOutline, warningOutline, checkmarkCircleOutline, alertCircleOutline, informationCircleOutline, calendarOutline, filterOutline, statsChartOutline, documentTextOutline, eyeOutline, listOutline, close, chevronUpOutline, chevronDownOutline, statsChart } from 'ionicons/icons';
import { BlinkEvaluationConfig, BlinkEvaluationResult, BackendServiceManager } from '../../core/services/secure-blink-evaluation.service';
import { SecureBlinkEvaluationService } from '../../core/services/secure-blink-evaluation.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { ChartService } from '../../shared/services/chart.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ToastService } from '../../core/services/toast.service';

Chart.register(...registerables);

@Component({
  selector: 'app-auswertungen',
  templateUrl: './auswertungen.component.html',
  styleUrls: ['./auswertungen.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonGrid, IonRow, IonCol, IonButton, IonIcon, IonSpinner, IonBadge, IonItem, IonLabel,
    IonDatetime, IonModal, IonCheckbox, IonSearchbar, IonList,
    IonAccordionGroup, IonAccordion, IonChip, IonCardSubtitle,
    TileGridComponent
  ]
})
export class AuswertungenComponent implements OnInit, AfterViewInit {
  actionTiles = signal<TileConfig[]>([
    {
      id: 'run-evaluation',
      title: 'Auswertung starten',
      subtitle: 'Daten von Blink abrufen',
      icon: 'analytics-outline',
      color: 'primary'
    },
    {
      id: 'export-json',
      title: 'JSON exportieren',
      subtitle: 'Rohdaten herunterladen',
      icon: 'download-outline',
      color: 'secondary',
      disabled: false
    },
    {
      id: 'export-csv',
      title: 'CSV exportieren',
      subtitle: 'Tabelle herunterladen',
      icon: 'stats-chart',
      color: 'tertiary',
      disabled: false
    },
    {
      id: 'configure',
      title: 'Konfiguration',
      subtitle: 'Einstellungen anpassen',
      icon: 'settings-outline',
      color: 'medium'
    }
  ]);
  private blinkService = inject(SecureBlinkEvaluationService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private chartService = inject(ChartService);
  private formBuilder = inject(FormBuilder);
  private toastService = inject(ToastService);

  // ViewChild Referenzen für Chart Canvas-Elemente
  @ViewChild('performanceChart') performanceChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('locationChart') locationChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChartRef?: ElementRef<HTMLCanvasElement>;

  // Form Management
  configForm: FormGroup;
  
  // State Management
  isConfigModalOpen = signal(false);
  selectedTab = signal<'overview' | 'details' | 'charts'>('overview');
  sortBy = signal<'name' | 'percentage' | 'locations'>('percentage');
  sortDirection = signal<'asc' | 'desc'>('desc');
  searchTerm = signal('');
  selectedLocations = signal<string[]>([]);
  
  // Computed Properties
  isLoading = computed(() => this.blinkService.isLoading());
  isReady = computed(() => this.blinkService.isReady());
  currentResult = computed(() => this.blinkService.currentResult());
  
  // Chart references
  private performanceChart?: Chart;
  private locationChart?: Chart;
  private statusChart?: Chart;

  constructor() {
    addIcons({analyticsOutline,settingsOutline,refreshOutline,documentTextOutline,peopleOutline,locationOutline,trendingUpOutline,eyeOutline,listOutline,statsChartOutline,warningOutline,alertCircleOutline,downloadOutline,close,timeOutline,checkmarkCircleOutline,informationCircleOutline,calendarOutline,filterOutline,chevronUpOutline,chevronDownOutline,statsChart});

    this.configForm = this.formBuilder.group({
      startDate: [this.getDefaultStartDate(), Validators.required],
      endDate: [this.getDefaultEndDate(), Validators.required],
      selectedAreas: [[]],
      selectedManagers: [[]],
      includeInactive: [false]
    });
  }

  ngOnInit() {
    // ✅ Kleine Verzögerung, damit App-Initializer Zeit hat User zu laden
    setTimeout(() => {
      this.checkAuthenticationAndSetup();
    }, 100);
  }

  ngAfterViewInit() {
    // ✅ KRITISCHER FIX: Charts erst initialisieren wenn DOM garantiert geladen ist
    // Warte kurz bis alle Canvas-Elemente verfügbar sind
    setTimeout(() => {
      if (this.currentResult()) {
        this.initializeCharts();
      }
    }, 50);
  }

  private async checkAuthenticationAndSetup(): Promise<void> {
    // ✅ ROBUSTE USER-PRÜFUNG: Versuche Token-Refresh falls kein User geladen
    let currentUser = this.authService.activeUser();
    
    // ✅ Falls kein User im Signal, versuche Token refresh
    if (!currentUser && this.authService.isLoggedIn) {
      try {
        await this.authService.refreshToken().toPromise();
        currentUser = this.authService.activeUser();
      } catch (error) {
        console.warn('❌ Token refresh failed:', error);
      }
    }
    
    // ✅ VERBESSERTE PRÜFUNG: Berücksichtige dass User eingeloggt ist
    if (!currentUser) {
      console.warn('❌ No user available despite being on protected route');
      // ✅ Da wir auf einer geschützten Route sind, sollte das nicht passieren
      // Prüfe ob wir trotzdem ein Access Token haben
      if (this.authService.isLoggedIn && this.authService.accessToken()) {
        this.notificationService.showToast(
          'Benutzerdaten nicht vollständig geladen. Versuche trotzdem fortzufahren...',
          'info',
          3000
        );
        // ✅ Versuche trotzdem fortzufahren, da Token vorhanden
        // Das Backend sollte die User-Identifikation via Token machen können
        return;
      } else {
        this.notificationService.showToast(
          'Benutzerdaten konnten nicht geladen werden. Bitte Seite neu laden.',
          'warning',
          5000
        );
        return;
      }
    }
    
    // ✅ VERBESSERTE PRÜFUNG: Berücksichtige null vs undefined vs 0
    const hasBlinkId = currentUser.blink_id != null && currentUser.blink_id !== 0;
    const hasBlinkCompany = currentUser.blink_company != null && currentUser.blink_company !== 0;
    
    if (!hasBlinkId || !hasBlinkCompany) {
      console.warn('❌ Blink Configuration missing:', {
        hasBlinkId,
        hasBlinkCompany,
        blink_id: currentUser.blink_id,
        blink_company: currentUser.blink_company
      });
      
      this.notificationService.showToast(
        'Blink Integration nicht konfiguriert. Bitte Blink ID und Company ID in den Benutzereinstellungen hinterlegen.',
        'warning',
        5000
      );
      return;
    }

  }

  /**
   * Handle tile click events
   */
  onTileClick(tileId: string): void {
    switch (tileId) {
      case 'run-evaluation':
        this.runEvaluation();
        break;
      case 'export-json':
        this.exportJSON();
        break;
      case 'export-csv':
        this.exportCSV();
        break;
      case 'configure':
        this.openConfigModal();
        break;
    }
  }

  /**
   * Open configuration modal
   */
  openConfigModal(): void {
    this.isConfigModalOpen.set(true);
  }

  /**
   * Update tile disabled states based on current result
   */
  private updateTileStates(): void {
    const hasResult = !!this.currentResult();
    this.actionTiles.update(tiles => 
      tiles.map(tile => ({
        ...tile,
        disabled: (tile.id === 'export-json' || tile.id === 'export-csv') ? !hasResult : tile.disabled
      }))
    );
  }

  /**
   * Run evaluation with current form configuration
   */
  async runEvaluation(): Promise<void> {
    if (!this.configForm.valid) {
      this.notificationService.showToast(
        'Bitte alle erforderlichen Felder ausfüllen',
        'warning',
        3000
      );
      return;
    }

    const formValue = this.configForm.value;
    const config: BlinkEvaluationConfig = {
      startDate: new Date(formValue.startDate),
      endDate: new Date(formValue.endDate),
      selectedAreas: formValue.selectedAreas || [],
      selectedManagers: formValue.selectedManagers || [],
      includeInactive: formValue.includeInactive || false
    };

    try {
      await this.blinkService.runEvaluation(config);
      this.isConfigModalOpen.set(false);
      this.updateTileStates();
      this.initializeCharts();
    } catch (error) {
      console.error('❌ Evaluation failed:', error);
    }
  }

  /**
   * Test Backend-Authentifizierung
   */
  async testBackendAuth() {
    try {
      const result = await this.blinkService.testAuthentication().toPromise();
      this.toastService.success('Backend-Authentifizierung erfolgreich!');
    } catch (error) {
      console.error('❌ Backend-Test fehlgeschlagen:', error);
      this.toastService.error('Backend-Authentifizierung fehlgeschlagen!');
    }
  }

  /**
   * Get filtered and sorted service managers
   */
  getFilteredManagers = computed(() => {
    const result = this.currentResult();
    if (!result) return [];

    let managers = result.serviceManagers;

    // Apply search filter
    const search = this.searchTerm().toLowerCase();
    if (search) {
      managers = managers.filter(manager =>
        manager.fullName.toLowerCase().includes(search) ||
        manager.firstName.toLowerCase().includes(search) ||
        manager.lastName.toLowerCase().includes(search)
      );
    }

    // Apply location filter
    const selectedLocations = this.selectedLocations();
    if (selectedLocations.length > 0) {
      managers = managers.filter(manager =>
        manager.locations.some(location => selectedLocations.includes(location.Name))
      );
    }

    // Apply sorting
    const sortBy = this.sortBy();
    const direction = this.sortDirection();
    
    managers.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.fullName.localeCompare(b.fullName);
          break;
        case 'percentage':
          const aPercentage = a.statistics?.exportPercentage ?? 0;
          const bPercentage = b.statistics?.exportPercentage ?? 0;
          comparison = aPercentage - bPercentage;
          break;
        case 'locations':
          const aLocations = a.statistics?.uniqueLocations ?? 0;
          const bLocations = b.statistics?.uniqueLocations ?? 0;
          comparison = aLocations - bLocations;
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });

    return managers;
  });

  /**
   * Get all unique locations from current result
   */
  getAvailableLocations = computed(() => {
    const result = this.currentResult();
    if (!result) return [];

    const locations = new Set<string>();
    result.locations.forEach(location => {
      locations.add(location.Name);
    });

    return Array.from(locations).sort();
  });

  /**
   * Chart initialization
   */
  private initializeCharts(): void {
    // ✅ KRITISCHER FIX: Kein setTimeout mehr - DOM ist garantiert geladen durch AfterViewInit
    this.createPerformanceChart();
    this.createLocationChart();
    this.createStatusChart();
  }

  private createPerformanceChart(): void {
    const canvas = this.performanceChartRef?.nativeElement || document.getElementById('performanceChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('⚠️ Performance chart canvas not found');
      return;
    }

    const result = this.currentResult();
    if (!result) return;

    if (this.performanceChart) {
      this.chartService.destroyChart(this.performanceChart);
    }

    const config = this.chartService.createPerformanceChart(result.serviceManagers);
    this.performanceChart = new Chart(canvas, config);
  }

  private createLocationChart(): void {
    const canvas = this.locationChartRef?.nativeElement || document.getElementById('locationChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('⚠️ Location chart canvas not found');
      return;
    }

    const result = this.currentResult();
    if (!result) return;

    if (this.locationChart) {
      this.chartService.destroyChart(this.locationChart);
    }

    // Create location-based chart data
    const locationData = this.aggregateLocationData(result);
    const config = this.chartService.createLocationChart(locationData);
    this.locationChart = new Chart(canvas, config);
  }

  private createStatusChart(): void {
    const canvas = this.statusChartRef?.nativeElement || document.getElementById('statusChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('⚠️ Status chart canvas not found');
      return;
    }

    const result = this.currentResult();
    if (!result) return;

    if (this.statusChart) {
      this.chartService.destroyChart(this.statusChart);
    }

    // Aggregate status counts across all managers
    const statusCounts = { New: 0, Exported: 0, Approved: 0, Billed: 0 };
    result.serviceManagers.forEach(manager => {
      if (manager.statistics?.statusCounts) {
        Object.entries(manager.statistics.statusCounts).forEach(([status, count]) => {
          if (status in statusCounts) {
            statusCounts[status as keyof typeof statusCounts] += count as number;
          }
        });
      }
    });

    const config = this.chartService.createStatusChart(
      statusCounts, 
      (status: string) => this.translateStatus(status)
    );
    this.statusChart = new Chart(canvas, config);
  }

  private aggregateLocationData(result: BlinkEvaluationResult): any {
    const locationMap = new Map<string, { worklogs: number, minutes: number }>();
    
    result.serviceManagers.forEach(manager => {
      manager.locations.forEach(location => {
        const existing = locationMap.get(location.Name) || { worklogs: 0, minutes: 0 };
        const totalWorklogs = manager.statistics?.totalWorklogs ?? 0;
        const totalMinutes = manager.statistics?.totalMinutes ?? 0;
        locationMap.set(location.Name, {
          worklogs: existing.worklogs + totalWorklogs,
          minutes: existing.minutes + totalMinutes
        });
      });
    });

    return Array.from(locationMap.entries()).map(([name, data]) => ({
      name,
      worklogs: data.worklogs,
      minutes: data.minutes
    }));
  }

  /**
   * Utility functions
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30 days ago
    return date.toISOString();
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString();
  }

  getPerformanceColor(percentage: number): string {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  }

  getPerformanceIcon(percentage: number): string {
    if (percentage >= 80) return 'checkmark-circle-outline';
    if (percentage >= 60) return 'warning-outline';
    return 'alert-circle-outline';
  }

  toggleSort(field: 'name' | 'percentage' | 'locations'): void {
    if (this.sortBy() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set('desc');
    }
  }

  toggleLocationFilter(location: string): void {
    const current = this.selectedLocations();
    if (current.includes(location)) {
      this.selectedLocations.set(current.filter(l => l !== location));
    } else {
      this.selectedLocations.set([...current, location]);
    }
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedLocations.set([]);
  }

  refreshData(): void {
    if (this.configForm.valid) {
      this.runEvaluation();
    }
  }

  /**
   * Status translation helper
   */
  translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'New': 'Neu',
      'Exported': 'Exportiert',
      'Approved': 'Genehmigt',
      'Billed': 'Abgerechnet',
      'Nicht bearbeitet': 'Nicht bearbeitet'  // ✅ HINZUGEFÜGT
    };
    return translations[status] || status;
  }

  /**
   * Template helper methods
   */
  trackByManagerId(index: number, manager: BackendServiceManager): number {
    return manager.id;
  }

  getStatusEntries(statusCounts: Record<string, number>): Array<{key: string, value: number}> {
    return Object.entries(statusCounts).map(([key, value]) => ({ key, value }));
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'New': return 'danger';
      case 'Exported': return 'warning';
      case 'Approved': return 'success';
      case 'Billed': return 'primary';
      case 'Nicht bearbeitet': return 'dark';  // ✅ HINZUGEFÜGT
      default: return 'medium';
    }
  }

  getManagerLocations(manager: BackendServiceManager): string {
    return manager.locations.map(l => l.Name).join(', ');
  }

  // Make blinkService public for template access
  get blinkEvaluationService() {
    return this.blinkService;
  }

  /**
   * Location-spezifische Methoden (wie im Blink-System)
   */
  isLocationFullyExported(location: any): boolean {
    // ✅ Wenn keine Worklog-Daten vorhanden sind, ist es NICHT exportiert
    if (!location.statuses || !location.hasData) return false;
    
    // ✅ LOCATION-BASIERTE LOGIK: SOBALD EIN WORKLOG NICHT EXPORTIERT IST, IST DIE GANZE LOCATION NICHT VOLLSTÄNDIG
    const exportStatuses = ['Exported', 'Approved', 'Billed'];
    
    // Prüfe jeden Status der Location
    for (const [status, count] of Object.entries(location.statuses)) {
      const statusCount = count as number;
      if (statusCount > 0 && !exportStatuses.includes(status)) {
        // ✅ SOBALD EIN NICHT-EXPORTIERTER STATUS GEFUNDEN WIRD, IST DIE LOCATION NICHT VOLLSTÄNDIG
        return false;
      }
    }
    
    // ✅ Alle gefundenen Statuses sind exportiert - Location ist vollständig
    const totalWorklogs = Object.values(location.statuses).reduce((sum: number, count: any) => sum + count, 0);
    return totalWorklogs > 0 && location.hasData;
  }

  /**
   * Suchfunktion für Input-Events
   */
  onSearchInput(event: any): void {
    const value = event.detail.value || '';
    this.searchTerm.set(value);
  }

  /**
   * Export functionality
   */
  exportJSON(): void {
    const result = this.currentResult();
    if (!result) {
      this.notificationService.notifyError('Keine Daten zum Exportieren vorhanden');
      return;
    }

    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blink-auswertung-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.notificationService.notifySuccess('JSON erfolgreich exportiert');
  }

  exportCSV(): void {
    const result = this.currentResult();
    if (!result) {
      this.notificationService.notifyError('Keine Daten zum Exportieren vorhanden');
      return;
    }

    // CSV Header
    let csv = 'Service Manager;Standort;Exportiert;Nicht Exportiert;Export-Quote\n';
    
    // Daten
    result.serviceManagers.forEach(manager => {
      manager.locations.forEach(location => {
        const exported = location.statuses?.['Exported'] || 0;
        const notExported = location.statuses?.['New'] || 0;
        const total = exported + notExported;
        const percentage = total > 0 ? ((exported / total) * 100).toFixed(1) : '0';
        
        csv += `${manager.fullName};${location.Name};${exported};${notExported};${percentage}%\n`;
      });
    });

    const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blink-auswertung-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.notificationService.notifySuccess('CSV erfolgreich exportiert');
  }
}
