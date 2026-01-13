import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { 
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonSegment, IonSegmentButton, IonLabel,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonList, IonItem, IonBadge, IonGrid, IonRow, IonCol,
  IonButton, IonIcon, IonChip, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonAvatar, IonCheckbox, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  eye, eyeOff, create, trash, closeCircle, add, checkmark, save, createOutline, trashOutline } from 'ionicons/icons';
import { environment } from '../../../environments/environment';

interface AnalyticsOverview {
  period_days: number;
  total_searches: number;
  total_clicks: number;
  avg_click_rate: number;
  avg_results_per_query: number;
  top_queries: any[];
  trending_queries: any[];
  zero_result_queries: any[];
}

interface ClickAnalytics {
  period_days: number;
  most_clicked_profiles: any[];
  avg_click_position: number;
  position_distribution: any;
}

interface Synonym {
  id?: number;
  term: string;
  synonyms_list: string[];
  weight: number;
  scope: string;
  is_active: boolean;
}

@Component({
  selector: 'app-search-analytics',
  templateUrl: './search-analytics.page.html',
  styleUrls: ['./search-analytics.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonSegment, IonSegmentButton, IonLabel,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonList, IonItem, IonBadge, IonGrid, IonRow, IonCol,
    IonButton, IonIcon, IonChip, IonInput, IonSelect, IonSelectOption,
    IonSpinner, IonAvatar, IonCheckbox
  ]
})
export class SearchAnalyticsPage implements OnInit {
  selectedTab: string = 'overview';
  periodDays: number = 30;
  loading: boolean = false;

  // Analytics Data
  overview: AnalyticsOverview | null = null;
  clickAnalytics: ClickAnalytics | null = null;
  synonyms: Synonym[] = [];
  queryHistory: any[] = [];

  // Profile Mappings
  profileMappings: any[] = [];
  editingMapping: any = null;
  searchProfileQuery: string = '';
  searchProfileResults: any[] = [];
  isSearchingProfiles: boolean = false;
  private searchDebounceTimer: any;

  // Synonym Editor
  editingSynonym: Synonym | null = null;
  newSynonym: Synonym = {
    term: '',
    synonyms_list: [],
    weight: 1.0,
    scope: 'global',
    is_active: true
  };

  constructor(
    private http: HttpClient,
    private alertController: AlertController
  ) {
    addIcons({add,closeCircle,save,create,trash,createOutline,trashOutline,eye,eyeOff,checkmark});
  }

  ngOnInit() {
    this.loadOverview();
  }

  segmentChanged(event: any) {
    this.selectedTab = event.detail.value;
    
    switch(this.selectedTab) {
      case 'overview':
        this.loadOverview();
        break;
      case 'clicks':
        this.loadClickAnalytics();
        break;
      case 'mappings':
        this.loadProfileMappings();
        break;
      case 'synonyms':
        this.loadSynonyms();
        break;
      case 'history':
        this.loadQueryHistory();
        break;
    }
  }

  periodChanged(event: any) {
    this.periodDays = parseInt(event.detail.value);
    this.loadOverview();
    this.loadClickAnalytics();
  }

  loadOverview() {
    this.loading = true;
    this.http.get<AnalyticsOverview>(
      `${environment.apiUrl}/admin/search-analytics/overview/?days=${this.periodDays}`
    ).subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Übersicht laden fehlgeschlagen:', err);
        this.loading = false;
      }
    });
  }

  loadClickAnalytics() {
    this.loading = true;
    this.http.get<ClickAnalytics>(
      `${environment.apiUrl}/admin/search-analytics/clicks/?days=${this.periodDays}`
    ).subscribe({
      next: (data) => {
        this.clickAnalytics = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Click-Analysen laden fehlgeschlagen:', err);
        this.loading = false;
      }
    });
  }

  loadSynonyms() {
    this.loading = true;
    this.http.get<Synonym[]>(`${environment.apiUrl}/admin/synonyms/`).subscribe({
      next: (data) => {
        this.synonyms = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Synonyme laden fehlgeschlagen:', err);
        this.loading = false;
      }
    });
  }

  loadQueryHistory() {
    this.loading = true;
    this.http.get<any[]>(
      `${environment.apiUrl}/admin/search-analytics/history/?limit=100`
    ).subscribe({
      next: (data) => {
        this.queryHistory = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Such-Historie laden fehlgeschlagen:', err);
        this.loading = false;
      }
    });
  }

  // PROFILE MAPPINGS
  loadProfileMappings() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/admin/profile-mappings/`).subscribe({
      next: (data) => {
        this.profileMappings = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Profil-Zuordnungen laden fehlgeschlagen:', err);
        this.loading = false;
      }
    });
  }

  startNewMapping() {
    this.editingMapping = {
      id: null,
      query_term: '',
      profile_id: null,
      profile_name: '',
      boost_score: 0.3,
      priority: 1,
      notes: '',
      is_active: true
    };
  }

  startEditMapping(mapping: any) {
    this.editingMapping = { ...mapping };
    // Setze Suchfeld auf den Profil-Namen für bessere UX
    if (mapping.profile_name) {
      this.searchProfileQuery = mapping.profile_name;
    }
  }

  cancelMapping() {
    this.editingMapping = null;
    this.searchProfileResults = [];
    this.searchProfileQuery = '';
  }

  searchProfiles() {
    // Clear vorheriger Timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // Wenn Eingabe zu kurz: Liste leeren
    if (!this.searchProfileQuery || this.searchProfileQuery.length < 1) {
      this.searchProfileResults = [];
      return;
    }

    // Debouncing: Warte 300ms nach letzter Eingabe
    this.searchDebounceTimer = setTimeout(() => {
      this.isSearchingProfiles = true;
      this.http.get<any[]>(
        `${environment.apiUrl}/phonebook/?query=${encodeURIComponent(this.searchProfileQuery)}`
      ).subscribe({
        next: (response) => {
          this.searchProfileResults = response || [];
          this.isSearchingProfiles = false;
        },
        error: (err) => {
          console.error('Profil-Suche fehlgeschlagen:', err);
          this.searchProfileResults = [];
          this.isSearchingProfiles = false;
        }
      });
    }, 300);
  }

  selectProfile(profile: any) {
    if (this.editingMapping) {
      this.editingMapping.profile_id = profile.id;
      this.editingMapping.profile_name = `${profile.first_name} ${profile.last_name}`;
      this.searchProfileResults = [];
      this.searchProfileQuery = ''; // Suchfeld leeren, nur Chip zeigen
      
      // Clear Timer
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
    }
  }

  async saveMapping() {
    if (!this.editingMapping) return;

    // Validierung
    if (!this.editingMapping.query_term || !this.editingMapping.profile_id) {
      const alert = await this.alertController.create({
        header: 'Fehler',
        message: 'Suchbegriff und Profil sind Pflichtfelder',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const url = `${environment.apiUrl}/admin/profile-mappings/`;
    const request = this.editingMapping.id 
      ? this.http.put(url, this.editingMapping)
      : this.http.post(url, this.editingMapping);

    request.subscribe({
      next: () => {
        this.loadProfileMappings();
        this.cancelMapping();
      },
      error: async (err) => {
        console.error('Zuordnung speichern fehlgeschlagen:', err);
        const alert = await this.alertController.create({
          header: 'Fehler',
          message: 'Fehler beim Speichern der Zuordnung',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  async deleteMapping(mapping: any) {
    const alert = await this.alertController.create({
      header: 'Zuordnung löschen',
      message: `Zuordnung "${mapping.query_term} → ${mapping.profile_name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.confirmDeleteMapping(mapping);
          }
        }
      ]
    });
    await alert.present();
  }

  private confirmDeleteMapping(mapping: any) {

    this.http.delete(
      `${environment.apiUrl}/admin/profile-mappings/`,
      { body: { id: mapping.id } }
    ).subscribe({
      next: () => {
        this.loadProfileMappings();
      },
      error: async (err) => {
        console.error('Zuordnung löschen fehlgeschlagen:', err);
        const alert = await this.alertController.create({
          header: 'Fehler',
          message: 'Fehler beim Löschen der Zuordnung',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  toggleMapping(mapping: any) {
    mapping.is_active = !mapping.is_active;
    this.http.put(
      `${environment.apiUrl}/admin/profile-mappings/`,
      mapping
    ).subscribe({
      next: () => {
        this.loadProfileMappings();
      },
      error: (err) => {
        console.error('Zuordnung aktivieren/deaktivieren fehlgeschlagen:', err);
      }
    });
  }

  // SYNONYMS

  createSynonymFromQuery(queryText: string) {
    // Wechsel zum Synonyme-Tab und erstelle neues Synonym mit der Query
    this.selectedTab = 'synonyms';
    this.newSynonym = {
      term: queryText,
      synonyms_list: [],
      weight: 1.0,
      scope: 'global',
      is_active: true
    };
    this.loadSynonyms();
  }

  editSynonym(synonym: Synonym) {
    this.editingSynonym = { ...synonym };
  }

  saveSynonym(synonym: Synonym) {
    if (synonym.id) {
      // Update existing
      this.http.put(`${environment.apiUrl}/admin/synonyms/`, synonym).subscribe({
        next: () => {
          this.loadSynonyms();
          this.editingSynonym = null;
        },
        error: (err) => console.error('Synonym aktualisieren fehlgeschlagen:', err)
      });
    } else {
      // Create new
      this.http.post(`${environment.apiUrl}/admin/synonyms/`, synonym).subscribe({
        next: () => {
          this.loadSynonyms();
          this.newSynonym = {
            term: '',
            synonyms_list: [],
            weight: 1.0,
            scope: 'global',
            is_active: true
          };
        },
        error: (err) => console.error('Synonym erstellen fehlgeschlagen:', err)
      });
    }
  }

  async deleteSynonym(synonym: Synonym) {
    const alert = await this.alertController.create({
      header: 'Synonym löschen',
      message: `Synonym "${synonym.term}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.http.request('delete', `${environment.apiUrl}/admin/synonyms/`, {
              body: { id: synonym.id }
            }).subscribe({
              next: () => this.loadSynonyms(),
              error: (err) => console.error('Synonym löschen fehlgeschlagen:', err)
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // QUERY HISTORY

  async deleteQuery(query: any) {
    const alert = await this.alertController.create({
      header: 'Query löschen',
      message: `Such-Query "${query.query_text}" wirklich löschen? Alle zugehörigen Klicks werden auch gelöscht.`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.http.request('delete', `${environment.apiUrl}/admin/search-analytics/history/`, {
              body: { id: query.id }
            }).subscribe({
              next: () => {
                this.loadQueryHistory();
                // Reload overview wenn auf dem Tab
                if (this.selectedTab === 'overview') {
                  this.loadOverview();
                }
              },
              error: (err) => console.error('Query löschen fehlgeschlagen:', err)
            });
          }
        }
      ]
    });
    await alert.present();
  }

  cancelEdit() {
    this.editingSynonym = null;
  }

  addSynonymToList(event: any, synonym: Synonym) {
    const value = event.target.value.trim();
    if (value && !synonym.synonyms_list.includes(value)) {
      synonym.synonyms_list.push(value);
      event.target.value = '';
    }
  }

  removeSynonymFromList(synonym: Synonym, index: number) {
    synonym.synonyms_list.splice(index, 1);
  }

  getPositionChartData() {
    if (!this.clickAnalytics) return [];
    
    const dist = this.clickAnalytics.position_distribution;
    return Object.keys(dist).map(key => ({
      position: key.replace('pos_', ''),
      clicks: dist[key]
    }));
  }
}
