// sofortmeldung-form.component.ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SofortmeldungService } from '../core/services/sofortmeldung.service';
import { Sofortmeldung } from '../core/interfaces/sofortmeldung';

@Component({
  selector: 'app-sofortmeldung-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="sofortmeldung-form">
      <h2>Neue Sofortmeldung</h2>
      
      <form [formGroup]="sofortmeldungForm" (ngSubmit)="onSubmit()">
        <div class="form-grid">
          <!-- Persönliche Daten -->
          <div class="form-section">
            <h3>Persönliche Daten</h3>
            
            <div class="form-field">
              <label for="firstName">Vorname *</label>
              <input 
                id="firstName" 
                formControlName="first_name" 
                type="text" 
                required>
            </div>
            
            <div class="form-field">
              <label for="lastName">Nachname *</label>
              <input 
                id="lastName" 
                formControlName="last_name" 
                type="text" 
                required>
            </div>
            
            <div class="form-field">
              <label for="startDate">Startdatum *</label>
              <input 
                id="startDate" 
                formControlName="start_date" 
                type="date" 
                required>
            </div>
            
            <div class="form-field">
              <label for="birthDate">Geburtsdatum</label>
              <input 
                id="birthDate" 
                formControlName="birth_date" 
                type="date">
            </div>
            
            <div class="form-field">
              <label for="birthPlace">Geburtsort</label>
              <input 
                id="birthPlace" 
                formControlName="birth_place" 
                type="text">
            </div>
            
            <div class="form-field">
              <label for="gender">Geschlecht</label>
              <select id="gender" formControlName="birth_gender">
                <option value="">Bitte wählen</option>
                <option value="M">Männlich</option>
                <option value="W">Weiblich</option>
                <option value="D">Divers</option>
                <option value="X">Keine Angabe</option>
              </select>
            </div>
          </div>
          
          <!-- Adresse -->
          <div class="form-section">
            <h3>Adresse</h3>
            
            <div class="form-field">
              <label for="street">Straße</label>
              <input 
                id="street" 
                formControlName="street_name" 
                type="text">
            </div>
            
            <div class="form-field">
              <label for="zipCode">PLZ</label>
              <input 
                id="zipCode" 
                formControlName="zip_code" 
                type="text" 
                pattern="[0-9]{5}">
            </div>
            
            <div class="form-field">
              <label for="city">Stadt</label>
              <input 
                id="city" 
                formControlName="city_name" 
                type="text">
            </div>
            
            <div class="form-field">
              <label for="countryCode">Land</label>
              <select id="countryCode" formControlName="country_code">
                <option value="D">Deutschland</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
              </select>
            </div>
          </div>
          
          <!-- Beschäftigungsdaten -->
          <div class="form-section">
            <h3>Beschäftigungsdaten</h3>
            
            <div class="form-field">
              <label for="group">Gruppe</label>
              <select id="group" formControlName="group">
                <option value="101">Gruppe 101</option>
                <option value="102">Gruppe 102</option>
                <option value="103">Gruppe 103</option>
              </select>
            </div>
            
            <div class="form-field">
              <label for="citizenship">Staatsangehörigkeit</label>
              <select id="citizenship" formControlName="citizenship">
                <option value="154">Deutschland</option>
                <option value="040">Österreich</option>
                <option value="756">Schweiz</option>
              </select>
            </div>
            
            <div class="form-field">
              <label for="insuranceNumber">Versicherungsnummer</label>
              <input 
                id="insuranceNumber" 
                formControlName="insurance_number" 
                type="text" 
                placeholder="Optional">
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="submit" 
            [disabled]="!sofortmeldungForm.valid || isSubmitting()"
            class="btn-primary">
            @if (isSubmitting()) {
              🔄 Wird verarbeitet...
            } @else {
              Sofortmeldung senden
            }
          </button>
          
          <button 
            type="button" 
            (click)="resetForm()" 
            class="btn-secondary">
            Zurücksetzen
          </button>
        </div>
      </form>
      
      <!-- Live Status-Updates -->
      @if (createdMeldungen().length > 0) {
        <div class="status-tracking">
          <h3>Live-Status</h3>
          
          @for (meldung of createdMeldungen(); track meldung.id) {
            <div class="status-item" [class]="getStatusClass(meldung.id!)">
              <div class="status-header">
                <span class="name">{{ meldung.first_name }} {{ meldung.last_name }}</span>
                <span class="status-badge">{{ getStatusText(meldung.id!) }}</span>
              </div>
              
              @if (meldung.status) {
                <div class="success-details">
                  ✅ Erfolgreich übermittelt!<br>
                  <strong>TAN:</strong> {{ meldung.tan }}<br>
                  @if (meldung.url) {
                    <a [href]="meldung.url" target="_blank" class="pdf-link">
                      📄 Bestätigung herunterladen
                    </a>
                  }
                </div>
              } @else if (getTrackingStatus(meldung.id!) === 'processing') {
                <div class="processing-details">
                  🔄 Wird an Sofortmelder.de übermittelt...
                </div>
              } @else if (getTrackingStatus(meldung.id!) === 'failed') {
                <div class="error-details">
                  ❌ Übermittlung fehlgeschlagen. 
                  <button (click)="retryMeldung(meldung.id!)" class="btn-retry">
                    Erneut versuchen
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .sofortmeldung-form {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 30px;
      margin-bottom: 30px;
    }
    
    .form-section {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    
    .form-section h3 {
      margin: 0 0 20px 0;
      color: #495057;
    }
    
    .form-field {
      margin-bottom: 15px;
    }
    
    .form-field label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #495057;
    }
    
    .form-field input,
    .form-field select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .form-field input:focus,
    .form-field select:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
    
    .form-actions {
      display: flex;
      gap: 15px;
      justify-content: flex-start;
    }
    
    .btn-primary,
    .btn-secondary,
    .btn-retry {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #0056b3;
    }
    
    .btn-primary:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background-color: #545b62;
    }
    
    .btn-retry {
      background-color: #dc3545;
      color: white;
      font-size: 12px;
      padding: 5px 10px;
    }
    
    .status-tracking {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    
    .status-item {
      margin-bottom: 15px;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #6c757d;
    }
    
    .status-item.processing {
      border-left-color: #ffc107;
      background: #fff3cd;
    }
    
    .status-item.completed {
      border-left-color: #28a745;
      background: #d4edda;
    }
    
    .status-item.failed {
      border-left-color: #dc3545;
      background: #f8d7da;
    }
    
    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .name {
      font-weight: 600;
    }
    
    .status-badge {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #e9ecef;
      color: #495057;
    }
    
    .success-details,
    .processing-details,
    .error-details {
      font-size: 14px;
      line-height: 1.4;
    }
    
    .pdf-link {
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
    }
    
    .pdf-link:hover {
      text-decoration: underline;
    }
  `]
})
export class SofortmeldungFormComponent {
  private fb = inject(FormBuilder);
  private sofortmeldungService = inject(SofortmeldungService);
  
  isSubmitting = signal(false);
  createdMeldungen = signal<Sofortmeldung[]>([]);
  
  sofortmeldungForm: FormGroup;
  
  constructor() {
    this.sofortmeldungForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      start_date: ['', Validators.required],
      birth_date: [''],
      birth_place: [''],
      birth_gender: [''],
      street_name: [''],
      zip_code: ['', Validators.pattern(/^[0-9]{5}$/)],
      city_name: [''],
      country_code: ['D'],
      group: ['101'],
      citizenship: ['154'],
      insurance_number: ['']
    });
  }
  
  async onSubmit(): Promise<void> {
    if (this.sofortmeldungForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      try {
        const formData = this.sofortmeldungForm.value;
        
        // Company Number hinzufügen (aus Settings oder hart kodiert)
        const sofortmeldungData = {
          ...formData,
          companyNumber: '15308598'
        };
        
        // Mit Live-Tracking erstellen
        const created = await this.sofortmeldungService.createAndTrack(sofortmeldungData);
        
        if (created) {
          // Zur Liste der erstellten Meldungen hinzufügen
          this.createdMeldungen.update(list => [...list, created]);
          
          // Formular zurücksetzen für nächste Eingabe
          this.sofortmeldungForm.reset({
            country_code: 'D',
            group: '101',
            citizenship: '154'
          });
        }
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }
  
  resetForm(): void {
    this.sofortmeldungForm.reset({
      country_code: 'D',
      group: '101',
      citizenship: '154'
    });
  }
  
  getTrackingStatus(id: number): string {
    return this.sofortmeldungService.getTrackingStatus(id) || 'pending';
  }
  
  getStatusClass(id: number): string {
    const status = this.getTrackingStatus(id);
    const meldung = this.createdMeldungen().find(m => m.id === id);
    
    if (meldung?.status) return 'completed';
    if (status === 'processing') return 'processing';
    if (status === 'failed') return 'failed';
    return '';
  }
  
  getStatusText(id: number): string {
    const status = this.getTrackingStatus(id);
    const meldung = this.createdMeldungen().find(m => m.id === id);
    
    if (meldung?.status) return 'Abgeschlossen';
    if (status === 'processing') return 'Wird verarbeitet';
    if (status === 'failed') return 'Fehlgeschlagen';
    return 'Wartend';
  }
  
  async retryMeldung(id: number): Promise<void> {
    // Retry über Backend-Endpoint
    try {
      // API-Call zum Retry-Endpoint
      const response = await fetch(`/api/sofortmeldungen/${id}/resend/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // JWT Token hier hinzufügen falls nötig
        }
      });
      
      if (response.ok) {
        // Neues Tracking starten
        this.sofortmeldungService.trackExistingStatus(id);
      }
    } catch (error) {
      console.error('Retry fehlgeschlagen:', error);
    }
  }
}
