// sofortmeldung-dashboard.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular';
import { SofortmeldungService } from '../core/services/sofortmeldung.service';
import { Sofortmeldung } from '../core/interfaces/sofortmeldung';
import { HRAssignmentModalComponent } from '../components/hr-assignment-modal/hr-assignment-modal.component';

@Component({
  selector: 'app-sofortmeldung-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h1>Sofortmeldungen Dashboard</h1>
      
      <!-- Statistiken -->
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Gesamt</h3>
          <div class="stat-number">{{ statistics().total }}</div>
        </div>
        
        <div class="stat-card success">
          <h3>Erfolgreich</h3>
          <div class="stat-number">{{ statistics().successful }}</div>
          <div class="stat-percent">{{ statistics().successRate }}%</div>
        </div>
        
        <div class="stat-card warning">
          <h3>In Bearbeitung</h3>
          <div class="stat-number">{{ statistics().processing }}</div>
        </div>
        
        <div class="stat-card error">
          <h3>Fehlgeschlagen</h3>
          <div class="stat-number">{{ statistics().failed }}</div>
        </div>
      </div>
      
      <!-- Live-Tracking Übersicht -->
      @if (activeTrackings().size > 0) {
        <div class="live-tracking">
          <h2>🔄 Live-Tracking</h2>
          <div class="tracking-list">
            @for (trackingEntry of getTrackingArray(); track trackingEntry.id) {
              <div class="tracking-item" [class]="trackingEntry.status">
                <span class="id">ID {{ trackingEntry.id }}</span>
                <span class="status">{{ getStatusText(trackingEntry.status) }}</span>
                <button 
                  (click)="stopTracking(trackingEntry.id)" 
                  class="btn-stop">
                  Stoppen
                </button>
              </div>
            }
          </div>
          
          <button (click)="stopAllTracking()" class="btn-stop-all">
            Alle Trackings stoppen
          </button>
        </div>
      }
      
      <!-- Sofortmeldungen Liste -->
      <div class="meldungen-section">
        <div class="section-header">
          <h2>Alle Sofortmeldungen</h2>
          <div class="header-actions">
            <button (click)="openHRAssignmentModal()" class="btn-hr-assignment">
              👥 HR-Zuweisungen
            </button>
            <button (click)="refreshData()" class="btn-refresh">
              🔄 Aktualisieren
            </button>
          </div>
        </div>
        
        @if (sofortmeldungService.loading$()) {
          <div class="loading">Laden...</div>
        } @else if (sofortmeldungService.error$()) {
          <div class="error">{{ sofortmeldungService.error$() }}</div>
        } @else {
          <div class="meldungen-grid">
            @for (meldung of sofortmeldungService.sofortmeldungen$(); track meldung.id) {
              <div class="meldung-card" [class]="getMeldungStatusClass(meldung)">
                <div class="meldung-header">
                  <h3>{{ meldung.first_name }} {{ meldung.last_name }}</h3>
                  <span class="meldung-status">{{ getMeldungStatusText(meldung) }}</span>
                </div>
                
                <div class="meldung-details">
                  <div><strong>Start:</strong> {{ meldung.start_date | date:'dd.MM.yyyy' }}</div>
                  <div><strong>Erstellt:</strong> {{ meldung.createdAt | date:'dd.MM.yyyy HH:mm' }}</div>
                  
                  @if (meldung.tan) {
                    <div><strong>TAN:</strong> {{ meldung.tan }}</div>
                  }
                  
                  @if (meldung.url) {
                    <a [href]="meldung.url" target="_blank" class="pdf-link">
                      📄 Bestätigung herunterladen
                    </a>
                  }
                </div>
                
                <div class="meldung-actions">
                  @if (!meldung.status) {
                    <button 
                      (click)="resendMeldung(meldung.id!)" 
                      class="btn-resend">
                      🔄 Erneut senden
                    </button>
                    
                    @if (!isTracking(meldung.id!)) {
                      <button 
                        (click)="startTracking(meldung.id!)" 
                        class="btn-track">
                        👁️ Status verfolgen
                      </button>
                    }
                  }
                  
                  <button 
                    (click)="checkStatus(meldung.id!)" 
                    class="btn-check">
                    🔍 Status prüfen
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
      
      <!-- Performance Stats (für Debugging) -->
      @if (showDebugInfo()) {
        <div class="debug-section">
          <h3>Debug-Informationen</h3>
          <pre>{{ getPerformanceStats() | json }}</pre>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      padding: 20px;
      background: white;
      border-radius: 8px;
      border-left: 4px solid #6c757d;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .stat-card.success {
      border-left-color: #28a745;
    }
    
    .stat-card.warning {
      border-left-color: #ffc107;
    }
    
    .stat-card.error {
      border-left-color: #dc3545;
    }
    
    .stat-card h3 {
      margin: 0 0 10px 0;
      color: #495057;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-number {
      font-size: 32px;
      font-weight: bold;
      color: #343a40;
    }
    
    .stat-percent {
      font-size: 14px;
      color: #6c757d;
      margin-top: 5px;
    }
    
    .live-tracking {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .tracking-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 15px 0;
    }
    
    .tracking-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }
    
    .tracking-item.processing {
      border-color: #ffc107;
      background: #fff;
    }
    
    .tracking-item.completed {
      border-color: #28a745;
      background: #d4edda;
    }
    
    .tracking-item.failed {
      border-color: #dc3545;
      background: #f8d7da;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .header-actions {
      display: flex;
      gap: 10px;
    }
    
    .btn-hr-assignment {
      padding: 10px 16px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    
    .btn-hr-assignment:hover {
      background: #4f46e5;
    }
    
    .meldungen-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    
    .meldung-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid #6c757d;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .meldung-card.success {
      border-left-color: #28a745;
    }
    
    .meldung-card.pending {
      border-left-color: #ffc107;
    }
    
    .meldung-card.failed {
      border-left-color: #dc3545;
    }
    
    .meldung-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    
    .meldung-header h3 {
      margin: 0;
      color: #343a40;
    }
    
    .meldung-status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #e9ecef;
      color: #495057;
    }
    
    .meldung-details {
      margin-bottom: 15px;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .meldung-details div {
      margin-bottom: 5px;
    }
    
    .meldung-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .btn-refresh,
    .btn-resend,
    .btn-track,
    .btn-check,
    .btn-stop,
    .btn-stop-all {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .btn-refresh {
      background: #007bff;
      color: white;
    }
    
    .btn-resend {
      background: #28a745;
      color: white;
    }
    
    .btn-track {
      background: #17a2b8;
      color: white;
    }
    
    .btn-check {
      background: #6f42c1;
      color: white;
    }
    
    .btn-stop,
    .btn-stop-all {
      background: #dc3545;
      color: white;
    }
    
    .btn-refresh:hover,
    .btn-resend:hover,
    .btn-track:hover,
    .btn-check:hover,
    .btn-stop:hover,
    .btn-stop-all:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    
    .pdf-link {
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
    }
    
    .pdf-link:hover {
      text-decoration: underline;
    }
    
    .loading,
    .error {
      text-align: center;
      padding: 40px;
      color: #6c757d;
    }
    
    .error {
      color: #dc3545;
    }
    
    .debug-section {
      margin-top: 40px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }
    
    .debug-section pre {
      background: white;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
    }
  `]
})
export class SofortmeldungDashboardComponent implements OnInit {
  sofortmeldungService = inject(SofortmeldungService);
  private modalController = inject(ModalController);
  
  statistics = signal({
    total: 0,
    successful: 0,
    processing: 0,
    failed: 0,
    successRate: 0
  });
  
  activeTrackings = signal(new Map());
  showDebugInfo = signal(false);
  
  ngOnInit() {
    this.loadData();
    this.updateStatistics();
    
    // Periodische Updates der Trackings
    setInterval(() => {
      this.activeTrackings.set(this.sofortmeldungService.trackingStatuses$());
    }, 1000);
  }
  
  async loadData() {
    await this.sofortmeldungService.fetchAll(false);
    this.updateStatistics();
  }
  
  async refreshData() {
    await this.loadData();
  }
  
  updateStatistics() {
    const meldungen = this.sofortmeldungService.sofortmeldungen$();
    const trackings = this.sofortmeldungService.trackingStatuses$();
    
    const total = meldungen.length;
    const successful = meldungen.filter(m => m.status).length;
    const processing = Array.from(trackings.values()).filter(status => status === 'processing').length;
    const failed = meldungen.filter(m => !m.status && m.tan).length; // Hat TAN aber Status false
    
    this.statistics.set({
      total,
      successful,
      processing,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    });
  }
  
  getMeldungStatusClass(meldung: Sofortmeldung): string {
    if (meldung.status) return 'success';
    if (meldung.tan && !meldung.status) return 'failed';
    return 'pending';
  }
  
  getMeldungStatusText(meldung: Sofortmeldung): string {
    if (meldung.status) return 'Erfolgreich';
    if (meldung.tan && !meldung.status) return 'Fehlgeschlagen';
    return 'Ausstehend';
  }
  
  isTracking(id: number): boolean {
    return this.sofortmeldungService.getTrackingStatus(id) !== null;
  }
  
  startTracking(id: number) {
    this.sofortmeldungService.trackExistingStatus(id);
  }
  
  stopTracking(id: number) {
    // Service-Methode aufrufen um Tracking zu stoppen
    // this.sofortmeldungService.stopTracking(id);
  }
  
  stopAllTracking() {
    this.sofortmeldungService.stopAllTracking();
  }
  
  async resendMeldung(id: number) {
    try {
      const response = await fetch(`/api/sofortmeldungen/${id}/resend/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // JWT Token hier hinzufügen
        }
      });
      
      if (response.ok) {
        // Tracking starten
        this.startTracking(id);
        // Daten aktualisieren
        await this.refreshData();
      }
    } catch (error) {
      console.error('Resend fehlgeschlagen:', error);
    }
  }
  
  async checkStatus(id: number) {
    try {
      const response = await fetch(`/api/sofortmeldungen/${id}/check_status/`);
      const result = await response.json();
      console.log('Status-Check Ergebnis:', result);
      
      // Nach kurzer Zeit Daten aktualisieren
      setTimeout(() => this.refreshData(), 2000);
    } catch (error) {
      console.error('Status-Check fehlgeschlagen:', error);
    }
  }
  
  getTrackingArray() {
    const trackings = this.activeTrackings();
    return Array.from(trackings.entries()).map(([id, status]) => ({ id, status }));
  }
  
  getStatusText(status: string): string {
    switch (status) {
      case 'processing': return 'Wird verarbeitet';
      case 'completed': return 'Abgeschlossen';
      case 'failed': return 'Fehlgeschlagen';
      default: return 'Wartend';
    }
  }
  
  getPerformanceStats() {
    return this.sofortmeldungService.getPerformanceStats();
  }
  
  toggleDebugInfo() {
    this.showDebugInfo.update(show => !show);
  }
  
  async openHRAssignmentModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: HRAssignmentModalComponent,
      cssClass: 'hr-assignment-modal'
    });
    await modal.present();
  }
}
