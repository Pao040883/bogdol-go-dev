import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton,
  IonTabs, IonTab, IonTabBar, IonTabButton, IonIcon, IonLabel,
  IonList, IonItem, IonBadge, IonButton, IonListHeader,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent,
  IonSpinner, IonChip, IonInput, IonModal, IonProgressBar, AlertController, ToastController, NavController, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  listOutline, cloudUploadOutline, archiveOutline, documentTextOutline, documentText,
  checkmarkCircle, timeOutline, camera, addOutline, trash, eye, eyeOff,
  add, closeCircle, scan, checkboxOutline, warning, pricetag, download, arrowBack, people, 
  documentsOutline} from 'ionicons/icons';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { WorkOrderService } from '../../../core/services/workorder.service';
import { WorkOrder } from '../../../core/interfaces/workorder.types';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import jsPDF from 'jspdf';
import { WorkOrderDetailModalComponent } from './workorder-detail-modal/workorder-detail-modal.component';
import { WorkorderListWithBulkComponent } from './components/workorder-list-with-bulk.component';
import { ChecklistViewComponent } from './components/checklist-view.component';
import { BadgeService } from '../../../services/badge.service';
import { FakturaAssignmentModalComponent } from '../../../components/faktura-assignment-modal/faktura-assignment-modal.component';
import { UserFeaturesService } from '../../../services/user-features.service';

interface ScannedFile {
  file: File;
  objectNumber: string;
  projectNumber: string;
  previewUrl?: string;
  isOcrRunning?: boolean;
  ocrProgress?: number;
  isDuplicate?: boolean;
  duplicateInfo?: { existingOrder: string; contentHash: string };
  ocrWarning?: string; // Warnung bei unsicherer OCR-Erkennung
  ocrConfidence?: number; // OCR-Qualität in Prozent
  leistungsmonat?: string; // Monat für den die Leistung abgerechnet wird (YYYY-MM)
  leistungsmonat_confidence?: number | null; // OCR-Konfidenz für Leistungsmonat
  leistungsmonat_warning?: string; // Warnung wenn Monat zu alt
}

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
    IonTabs, IonTab, IonTabBar, IonTabButton, IonIcon, IonLabel,
    IonList, IonItem, IonBadge, IonButton, IonListHeader,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonFab, IonFabButton, IonRefresher, IonRefresherContent,
    IonSpinner, IonChip, IonInput, IonModal, IonProgressBar,
    WorkOrderDetailModalComponent,
    WorkorderListWithBulkComponent,
    ChecklistViewComponent
  ],
  templateUrl: './workorders.page.html',
  styleUrls: ['./workorders.page.scss']
})
export class WorkordersPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private workOrderService = inject(WorkOrderService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private badgeService = inject(BadgeService);
  private modalController = inject(ModalController);
  readonly userFeatures = inject(UserFeaturesService);

  // State
  selectedTab = signal<'billing' | 'submit' | 'checklist' | 'archive'>('billing');
  selectedWorkOrder = signal<WorkOrder | null>(null);
  isDetailModalOpen = signal(false);
  scannedFiles = signal<ScannedFile[]>([]);
  isUploading = signal(false);
  isPreviewModalOpen = signal(false);
  previewScan = signal<ScannedFile | null>(null);
  
  // Toggle state for show all/own workorders
  showAll = signal(false);
  canViewAllItems = computed(() => 
    this.userFeatures.features()?.can_toggle_all_workorders === true
  );
  
  // Computed: Check if all scans have O and P numbers
  isSubmitDisabled = computed(() => {
    const scans = this.scannedFiles();
    if (scans.length === 0) return true;
    
    // Prüfe auf fehlende Nummern
    const hasMissingNumbers = scans.some(scan => 
      !this.isValidObjectNumber(scan.objectNumber) || 
      !this.isValidProjectNumber(scan.projectNumber)
    );
    
    // Prüfe auf Duplikate
    const hasDuplicates = scans.some(scan => scan.isDuplicate === true);
    
    return hasMissingNumbers || hasDuplicates;
  });

  constructor() {
    addIcons({arrowBack,people,eye,eyeOff,documentText,warning,scan,trash,cloudUploadOutline,camera,checkmarkCircle,add,documentTextOutline,checkboxOutline,archiveOutline,closeCircle,pricetag,download,listOutline,timeOutline,addOutline, documentsOutline});
  }

  async openFakturaAssignmentModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: FakturaAssignmentModalComponent,
      cssClass: 'faktura-assignment-modal'
    });
    await modal.present();
  }

  // Computed: Offene Arbeitsscheine (completed, aber nicht submitted)
  openWorkOrders = computed(() => {
    return this.workOrderService.workOrders().filter(
      wo => wo.status === 'completed' && !wo.submitted_at
    ).sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  });

  // Computed: Zur Abrechnung (submitted - wartet auf Faktura)
  billingWorkOrders = computed(() => {
    return this.workOrderService.workOrders().filter(
      wo => wo.status === 'submitted'
    ).sort((a, b) => {
      const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return dateB - dateA;
    });
  });

  // Computed: Archivierte Arbeitsscheine (billed + cancelled)
  archivedWorkOrders = computed(() => {
    return this.workOrderService.workOrders().filter(
      wo => wo.status === 'billed' || wo.status === 'cancelled'
    ).sort((a, b) => {
      const dateA = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0;
      const dateB = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0;
      return dateB - dateA;
    });
  });

  ngOnInit() {
    // Load only submitted work orders initially (for billing tab)
    this.loadWorkOrdersByStatus('submitted');
    
    // Lade auch completed work orders für Badge-Berechnung
    this.workOrderService.loadWorkOrders({ status: 'completed' }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.updateWorkOrderBadge();
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWorkOrders(event?: any) {
    // Load based on current tab
    const currentTab = this.selectedTab();
    let status: string | undefined;
    
    if (currentTab === 'billing') {
      status = 'submitted';
    } else if (currentTab === 'archive') {
      status = 'billed';
    }
    
    this.loadWorkOrdersByStatus(status, event);
  }

  private loadWorkOrdersByStatus(status?: string, event?: any) {
    const filters = status ? { status } : undefined;
    
    // Only pass showAll if user has permission
    const showAllParam = this.canViewAllItems() ? this.showAll() : undefined;
    
    this.workOrderService.loadWorkOrders(filters, showAllParam).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        // Update badge count (offene + submitted)
        this.updateWorkOrderBadge();
        if (event) {
          event.target.complete();
        }
      },
      error: (err) => {
        console.error('Error loading work orders:', err);
        if (event) {
          event.target.complete();
        }
      }
    });
  }

  onTabChange(tab: 'billing' | 'submit' | 'checklist' | 'archive') {
    this.selectedTab.set(tab);
    
    // Load appropriate data when switching to billing or archive
    if (tab === 'billing') {
      this.loadWorkOrdersByStatus('submitted');
    } else if (tab === 'archive') {
      // Load both billed and cancelled for archive
      this.loadArchiveWorkOrders();
    }
    // checklist tab handles its own loading
  }

  getCurrentMonth(): string {
    const now = new Date();
    return now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  private loadArchiveWorkOrders(event?: any) {
    // Load billed and cancelled work orders using multi-status filter
    // Only pass showAll if user has permission
    const showAllParam = this.canViewAllItems() ? this.showAll() : undefined;
    
    this.workOrderService.loadWorkOrders({ status: 'billed,cancelled' }, showAllParam).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        // Update badge count
        this.updateWorkOrderBadge();
        if (event) {
          event.target.complete();
        }
      },
      error: (err) => {
        console.error('Error loading work orders:', err);
        if (event) {
          event.target.complete();
        }
      }
    });
  }

  async viewWorkOrder(workOrder: WorkOrder) {
    this.selectedWorkOrder.set(workOrder);
    this.isDetailModalOpen.set(true);
  }

  onDetailModalDismiss() {
    this.isDetailModalOpen.set(false);
    this.selectedWorkOrder.set(null);
  }

  onWorkOrderUpdated() {
    this.loadWorkOrders();
  }

  onNavigateToChat(conversationId: number) {
    // Close modal first
    this.isDetailModalOpen.set(false);
    this.selectedWorkOrder.set(null);
    
    // Navigate immediately - the modal close animation will play in background
    this.router.navigate(['/chat', conversationId], {
      replaceUrl: false,
      state: { reload: true }
    }).then(() => {
      console.log('✅ Navigation successful to conversation:', conversationId);
    }).catch(err => {
      console.error('❌ Navigation failed:', err);
    });
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  async submitScans() {
    if (this.scannedFiles().length === 0) {
      await this.showToast('Keine Scans zum Einreichen', 'warning');
      return;
    }

    // Prüfe ob alle Nummern valide sind
    const invalidScans = this.scannedFiles().filter(scan => 
      !this.isValidObjectNumber(scan.objectNumber) || 
      !this.isValidProjectNumber(scan.projectNumber) ||
      !scan.leistungsmonat || scan.leistungsmonat.trim() === ''
    );

    if (invalidScans.length > 0) {
      await this.showToast('Bitte fülle alle O-, P-Nummern und Leistungsmonat korrekt aus', 'danger');
      return;
    }

    this.isUploading.set(true);

    try {
      const scans = this.scannedFiles().map(scan => ({
        file: scan.file,
        objectNumber: scan.objectNumber,
        projectNumber: scan.projectNumber,
        leistungsmonat: scan.leistungsmonat,
        leistungsmonat_confidence: scan.leistungsmonat_confidence
      }));

      await firstValueFrom(this.workOrderService.bulkSubmitScansWithNumbers(scans));
      
      await this.showToast(`${scans.length} Arbeitsschein(e) erfolgreich eingereicht`, 'success');
      this.scannedFiles.set([]);
      this.updateWorkOrderBadge();
      
      // Wechsle zum Archiv-Tab
      this.selectedTab.set('archive');
    } catch (error) {
      console.error('Submit error:', error);
      await this.showToast('Fehler beim Einreichen der Scans', 'danger');
    } finally {
      this.isUploading.set(false);
    }
  }

  private isValidObjectNumber(value: string | undefined): boolean {
    if (!value) return false;
    // O- gefolgt von genau 6 Ziffern
    const regex = /^O-\d{6}$/;
    return regex.test(value);
  }

  private isValidProjectNumber(value: string | undefined): boolean {
    if (!value) return false;
    // P gefolgt von genau 7 Ziffern
    const regex = /^P\d{7}$/;
    return regex.test(value);
  }

  // Debounce-Timer für manuelle Eingabe
  private inputDebounceTimers: Map<number, any> = new Map();

  handleObjectNumberInput(event: any, index: number): void {
    let value = event.target.value || '';
    
    // Stelle sicher, dass O- am Anfang steht
    if (!value.startsWith('O-')) {
      value = 'O-';
    }
    
    // Entferne alles nach O- was keine Ziffer ist
    const afterPrefix = value.substring(2).replace(/\D/g, '');
    
    // Begrenze auf 6 Ziffern
    const limitedDigits = afterPrefix.substring(0, 6);
    
    const newValue = 'O-' + limitedDigits;
    
    this.scannedFiles.update(files => {
      const updated = [...files];
      updated[index] = { ...updated[index], objectNumber: newValue };
      return updated;
    });

    // Duplikat-Check nach manueller Eingabe (mit Debounce)
    this.scheduleManualCheck(index);
  }

  handleProjectNumberInput(event: any, index: number): void {
    let value = event.target.value || '';
    
    // Stelle sicher, dass P am Anfang steht
    if (!value.startsWith('P')) {
      value = 'P';
    }
    
    // Entferne alles nach P was keine Ziffer ist
    const afterPrefix = value.substring(1).replace(/\D/g, '');
    
    // Begrenze auf 7 Ziffern
    const limitedDigits = afterPrefix.substring(0, 7);
    
    const newValue = 'P' + limitedDigits;
    
    this.scannedFiles.update(files => {
      const updated = [...files];
      updated[index] = { ...updated[index], projectNumber: newValue };
      return updated;
    });

    // Duplikat-Check nach manueller Eingabe (mit Debounce)
    this.scheduleManualCheck(index);
  }

  handleLeistungsmonatInput(event: any, index: number): void {
    const value = event.target.value || '';
    
    this.scannedFiles.update(files => {
      const updated = [...files];
      updated[index] = { 
        ...updated[index], 
        leistungsmonat: value,
        // Entferne OCR-Konfidenz bei manueller Änderung
        leistungsmonat_confidence: null,
        leistungsmonat_warning: undefined
      };
      return updated;
    });
  }

  handleLeistungsmonatChange(event: any, index: number): void {
    const value = event.detail?.value || event.target?.value;
    if (!value) return;
    
    this.scannedFiles.update(files => {
      const updated = [...files];
      updated[index] = { 
        ...updated[index], 
        leistungsmonat: value,
        // Entferne OCR-Konfidenz bei manueller Änderung
        leistungsmonat_confidence: null,
        leistungsmonat_warning: undefined
      };
      return updated;
    });
  }

  getMonthOptions(): { value: string, label: string }[] {
    const options: { value: string, label: string }[] = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    
    // Generiere Optionen für die letzten 6 Monate und nächsten 3 Monate
    for (let i = -6; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStr = String(month).padStart(2, '0');
      const value = `${year}-${monthStr}`;
      const label = `${monthNames[date.getMonth()]} ${year}`;
      options.push({ value, label });
    }
    
    return options;
  }

  ensureObjectNumberPrefix(index: number): void {
    const currentValue = this.scannedFiles()[index]?.objectNumber || '';
    if (!currentValue.startsWith('O-')) {
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], objectNumber: 'O-' };
        return updated;
      });
    }
  }

  ensureProjectNumberPrefix(index: number): void {
    const currentValue = this.scannedFiles()[index]?.projectNumber || '';
    if (!currentValue.startsWith('P')) {
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], projectNumber: 'P' };
        return updated;
      });
    }
  }

  // ========================================================================
  // OCR HELPERS
  // ========================================================================

  async extractNumbersFromFile(file: File, index: number): Promise<void> {
    // Setze OCR Status auf running
    this.scannedFiles.update(files => {
      const updated = [...files];
      updated[index] = { ...updated[index], isOcrRunning: true, ocrProgress: 0 };
      return updated;
    });
    
    try {

      let imageDataUrl: string;

      if (file.type === 'application/pdf') {
        // Für PDF: Erste Seite in Bild umwandeln
        imageDataUrl = await this.convertPdfPageToImage(file);
      } else {
        // Für Bilder: Direkt verwenden
        imageDataUrl = await this.fileToDataUrl(file);
      }

      // Speichere Preview-URL für Thumbnail-Anzeige
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], previewUrl: imageDataUrl };
        return updated;
      });

      // Bild-Preprocessing für bessere OCR-Qualität
      imageDataUrl = await this.preprocessImageForOCR(imageDataUrl);

      // OCR durchführen - einfacher Single-Pass mit Deutsch
      const { default: Tesseract } = await import('tesseract.js');
      
      const worker = await Tesseract.createWorker('deu', Tesseract.OEM.LSTM_ONLY, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.scannedFiles.update(files => {
              const updated = [...files];
              updated[index] = { ...updated[index], ocrProgress: m.progress };
              return updated;
            });
          }
        }
      });
      
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
      });
      
      const result = await worker.recognize(imageDataUrl);
      await worker.terminate();

      let text = result.data.text;
      
      // Extrahiere Leistungsmonat aus Datum
      const leistungsmonatResult = this.extractLeistungsmonat(text, result.data.confidence);
      
      // Entferne Telefonnummern, Steuernummern und Postleitzahlen, um False Positives zu vermeiden
      // Entferne ganze Zeilen mit Tel/Telefon/Fax (inkl. Ländervorwahl und alle Zahlen)
      text = text.replace(/^.*(?:Tel|Telefon|Fax|Mobile|Mobil|Handy)[:\s\.].*$/gmi, '');
      // Entferne Zeilen mit Steuernummer, HRB-Nr., etc. (alle Varianten)
      text = text.replace(/^.*(?:Steuernummer|St\.?-?Nr\.?|USt-ID|Ust-ID|Tax|Handelsregister|HRB\s*Nr\.?|Amtsgericht)[:\s].*$/gmi, '');
      // Entferne Nummern im Format XX/XXX/XXXXX (typisch für Steuernummern/HRB)
      text = text.replace(/\b\d{2,3}\/\d{3,4}\/\d{4,6}\b/g, '');
      // Entferne auch Postleitzahlen (5 Ziffern gefolgt von Ort) 
      text = text.replace(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/g, '');

      // Qualitätsprüfung: Warnung bei niedriger Confidence, aber Werte trotzdem eintragen
      const MIN_CONFIDENCE = 40;
      const hasLowQuality = result.data.confidence < MIN_CONFIDENCE;
      
      // Spezial-Fall: "O-Nr.7304/P-10498" - beide Nummern mit Slash getrennt
      let combinedMatch: RegExpMatchArray | null = text.match(/[O0or]+\.?-?\s*Nr\.?\s*[:.:]?\s*0*(\d{4,6})\s*[\/\\]\s*P\.?-?\s*0*(\d{4,7})/i);
      if (!combinedMatch) {
        // Zweiter Versuch: Weniger strikt, ohne "Nr"
        combinedMatch = text.match(/[O0or][-.]?\s*0*(\d{4,6})\s*[\/\\]\s*P[-.]?\s*0*(\d{4,7})/i);
      }
      
      let oNumberMatch: RegExpMatchArray | null = null;
      let pNumberMatch: RegExpMatchArray | null = null;
      let hasOLabel: boolean = false;
      let hasPLabel: boolean = false;
      
      if (combinedMatch) {
        // Beide Nummern wurden zusammen gefunden
        oNumberMatch = combinedMatch;
        pNumberMatch = combinedMatch;
        hasOLabel = /[O0or]+\s*Nr/i.test(combinedMatch[0]);
        hasPLabel = true;
        
        const oDigits = combinedMatch[1].padStart(6, '0');
        const pDigits = combinedMatch[2].padStart(7, '0');
        
        // Werte IMMER eintragen
        this.scannedFiles.update(files => {
          const updated = [...files];
          const warnings = [];
          if (hasLowQuality) warnings.push(`Niedrige OCR-Qualität: ${Math.round(result.data.confidence)}%`);
          if (!hasOLabel) warnings.push('O-Nr Label unklar');
          
          updated[index] = { 
            ...updated[index], 
            objectNumber: 'O-' + oDigits,
            projectNumber: 'P' + pDigits,
            ocrWarning: warnings.length > 0 ? warnings.join(' • ') + ' - Bitte prüfen' : undefined
          };
          return updated;
        });
      } else {
        
        // Separate Suche nach O-Nummer
        // "O-Nr.: 006004", "O.-Nr.: 6693", "0-Nr.: 006305", "O0-Nr.7304", "ONr 00-6414", "0-006305", "Or 000209"
        oNumberMatch = text.match(/[O0or]+\d?\.?-?\s*Nr\.?\s*[:.]*\s*0*-?0*(\d{4,6})(?:[\/\s]|$)/i);
        hasOLabel = oNumberMatch ? /[O0or]+\d?\.?-?\s*Nr/i.test(oNumberMatch[0]) : false;
        if (!oNumberMatch) {
          // Alternative: "O.Nr.: 6743", "ONr: 6743", "Or... 30"
          oNumberMatch = text.match(/[O0or]+\d?\.?\s*Nr?\.?\s*[:.]*\s*0*-?0*(\d{4,6})(?:[\/\s]|$)/i);
          hasOLabel = oNumberMatch ? /[O0or]+\s*Nr/i.test(oNumberMatch[0]) : false;
        }
        if (!oNumberMatch) {
          // Dritter Versuch: Nur Buchstabe + Ziffern, sehr lose: "Or 000209", "O 6414"
          oNumberMatch = text.match(/\b[O0or]+[:\s.-]*0*-?0*(\d{4,6})(?=[\s,\/]|$)/i);
          hasOLabel = false; // Kein Label gefunden, unsichere Erkennung
        }
        if (oNumberMatch) {
          const digits = oNumberMatch[1].padStart(6, '0');
          const oNumber = 'O-' + digits;
          this.scannedFiles.update(files => {
            const updated = [...files];
            updated[index] = { ...updated[index], objectNumber: oNumber };
            return updated;
          });
        } else {
          // Zeige die Textstelle, wo O-Nr stehen sollte
          const oContext = text.match(/.{0,30}[O0or][-.]?\s*Nr.{0,40}/i);
        }

        // Separate Suche nach P-Nummer
        // "P-Nr.: 0006847", "P.-Nr.: 0000548", "P-8126", "/P-10498", "(P0010755)", "Pan 8743", "Pen 8743", "P,-Nr.", "Benz 8743", "P.20498"
        pNumberMatch = text.match(/(?:P[aen]*|Benz|Ben)[.,]?[-.]?\s*Nr?\.?\s*[:.]?\s*P?0*(\d{4,7})(?:[\/\s\(\)]|$)/i);
        hasPLabel = pNumberMatch ? /P[aen]*\s*Nr/i.test(pNumberMatch[0]) : false;
        if (!pNumberMatch) {
          // Alternative: Slash-getrennt "/P-10498", "/P.20498" oder Klammern "(P0011066)" oder nur "P-8126"
          pNumberMatch = text.match(/[\/\(\s]P[aen]*[-.]?0*(\d{4,7})\)?/i);
          hasPLabel = true; // P- ist explizit vorhanden
        }
        if (!pNumberMatch) {
          // Dritter Versuch: "Pan 8743", "Pen: 8743", "Benz 8743" direkt am Wortanfang
          pNumberMatch = text.match(/\b(?:P[aen]+|Benz|Ben)[:\s]+0*(\d{4,7})(?:[\s,\.]|$)/i);
          hasPLabel = false; // Unsichere Erkennung
        }
        if (!pNumberMatch) {
          // Vierter Versuch: Nur "P" gefolgt von Ziffern, sehr lose
          pNumberMatch = text.match(/\bP[-\s]?0*(\d{4,7})(?=[\s,\/\)]|$)/i);
          hasPLabel = true;
        }
        if (!pNumberMatch) {
          // Letzter Versuch: 5-7 stellige Zahl nach einem Slash (könnte P-Nummer sein)
          const slashNumberMatch = text.match(/\/\s*0*(\d{5,7})(?=[\s,\)]|$)/);
          if (slashNumberMatch) {
            pNumberMatch = slashNumberMatch;
            hasPLabel = false; // Sehr unsicher
          }
        }
        if (pNumberMatch) {
          const digits = pNumberMatch[1].padStart(7, '0');
          const pNumber = 'P' + digits;
          this.scannedFiles.update(files => {
            const updated = [...files];
            updated[index] = { ...updated[index], projectNumber: pNumber };
            return updated;
          });
        } else {
          // Zeige die Textstelle, wo P-Nr stehen sollte
          const pContext = text.match(/.{0,30}P[-.]?\s*Nr.{0,40}/i);
        }
        
        // Setze Warnung nur bei echten Problemen
        const warnings: string[] = [];
        // Label-Warnung nur bei niedriger Qualität UND fehlendem Label
        if (hasLowQuality && !hasOLabel && oNumberMatch) warnings.push('O-Nr. prüfen');
        if (hasLowQuality && !hasPLabel && pNumberMatch) warnings.push('P-Nr. prüfen');
        // Genau angeben welche Nummern fehlen
        if (!oNumberMatch && !pNumberMatch) {
          warnings.push('O-Nr und P-Nr fehlen');
        } else if (!oNumberMatch) {
          warnings.push('O-Nr fehlt');
        } else if (!pNumberMatch) {
          warnings.push('P-Nr fehlt');
        }
        
        if (warnings.length > 0) {
          this.scannedFiles.update(files => {
            const updated = [...files];
            updated[index] = { 
              ...updated[index],
              ocrConfidence: Math.round(result.data.confidence),
              ocrWarning: warnings.join(' • '),
              leistungsmonat: leistungsmonatResult.month,
              leistungsmonat_confidence: leistungsmonatResult.confidence,
              leistungsmonat_warning: leistungsmonatResult.warning
            };
            return updated;
          });
        } else {
          // Auch bei keinen Warnungen: Confidence speichern
          this.scannedFiles.update(files => {
            const updated = [...files];
            updated[index] = { 
              ...updated[index],
              ocrConfidence: Math.round(result.data.confidence),
              ocrWarning: undefined,
              leistungsmonat: leistungsmonatResult.month,
              leistungsmonat_confidence: leistungsmonatResult.confidence,
              leistungsmonat_warning: leistungsmonatResult.warning
            };
            return updated;
          });
        }
      }

      // OCR abgeschlossen
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], isOcrRunning: false, ocrProgress: 1 };
        return updated;
      });

      if (oNumberMatch || pNumberMatch) {
        // Nach OCR-Extraktion: Duplikat-Check durchführen
        await this.checkForDuplicate(index);
      }

    } catch (error) {
      console.error('❌ OCR ERROR:', error);
      // OCR fehlgeschlagen - trotzdem Inputs anzeigen
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], isOcrRunning: false, ocrProgress: 0 };
        return updated;
      });
      await this.showToast('OCR fehlgeschlagen', 'danger');
    }
  }

  /** Extrahiere Leistungsmonat aus OCR-Text */
  private extractLeistungsmonat(text: string, ocrConfidence: number): { month: string, confidence: number | null, warning?: string } {
    const now = new Date();
    
    // Deutsche Monatsnamen
    const monthNames: Record<string, string> = {
      'januar': '01', 'jan': '01',
      'februar': '02', 'feb': '02',
      'märz': '03', 'mar': '03', 'maerz': '03',
      'april': '04', 'apr': '04',
      'mai': '05',
      'juni': '06', 'jun': '06',
      'juli': '07', 'jul': '07',
      'august': '08', 'aug': '08',
      'september': '09', 'sep': '09', 'sept': '09',
      'oktober': '10', 'okt': '10', 'oct': '10',
      'november': '11', 'nov': '11',
      'dezember': '12', 'dez': '12', 'dec': '12'
    };

    // Suche zuerst nach "Monat:" oder "Zeitraum:" Kontext
    // Extrahiere nur Text NACH diesen Schlüsselwörtern
    const contextPatterns = [
      /(?:Monat|monat|MONAT)[:\s]+([^\n]{0,50})/i,
      /(?:Zeitraum|zeitraum|ZEITRAUM)[:\s]+([^\n]{0,50})/i,
      /(?:Leistungsmonat|leistungsmonat|LEISTUNGSMONAT)[:\s]+([^\n]{0,50})/i
    ];
    
    let relevantText = '';
    for (const contextPattern of contextPatterns) {
      const contextMatch = text.match(contextPattern);
      if (contextMatch && contextMatch[1]) {
        relevantText = contextMatch[1];
        break;
      }
    }
    
    // Falls kein Kontext gefunden, verwende gesamten Text (Fallback)
    if (!relevantText) {
      relevantText = text;
    }

    // Regex-Patterns für verschiedene Datumsformate
    const patterns = [
      // "Januar 2026", "Jänner 2026"
      /\b(januar|jänner|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})\b/i,
      // "Jan 2026", "Feb. 2026"
      /\b(jan|feb|mär|mar|apr|mai|jun|jul|aug|sep|sept|okt|oct|nov|dez|dec)\.?\s+(\d{4})\b/i,
      // "Dez 25", "Jan 26" (zweistelliges Jahr)
      /\b(jan|feb|mär|mar|apr|mai|jun|jul|aug|sep|sept|okt|oct|nov|dez|dec)\.?\s+(\d{2})\b/i,
      // "01/2026", "1/2026"
      /\b(\d{1,2})\s*[\/\.\-]\s*(\d{4})\b/,
      // "2026-01", "2026/01"
      /\b(\d{4})\s*[\/\.\-]\s*(\d{1,2})\b/,
      // "20.01.2026", "20-01-2026"
      /\b\d{1,2}\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{4})\b/
    ];

    let extractedMonth: string | null = null;
    let extractedYear: string | null = null;
    let patternConfidence = 0;

    // Durchsuche nur den relevanten Text (nach "Monat:" oder "Zeitraum:")
    for (let i = 0; i < patterns.length; i++) {
      const match = relevantText.match(patterns[i]);
      if (match) {
        if (i === 0) {
          // Voller Monatsname + 4-stelliges Jahr
          const monthName = match[1].toLowerCase();
          extractedMonth = monthNames[monthName] || null;
          extractedYear = match[2];
          patternConfidence = ocrConfidence * 0.9;
        } else if (i === 1) {
          // Abgekürzter Monatsname + 4-stelliges Jahr (Jan 2026)
          const monthName = match[1].toLowerCase();
          extractedMonth = monthNames[monthName] || null;
          extractedYear = match[2];
          patternConfidence = ocrConfidence * 0.9;
        } else if (i === 2) {
          // Abgekürzter Monatsname + 2-stelliges Jahr (Dez 25)
          const monthName = match[1].toLowerCase();
          extractedMonth = monthNames[monthName] || null;
          const twoDigitYear = parseInt(match[2]);
          // 20-99 = 2020-2099, 00-19 = 2000-2019
          extractedYear = twoDigitYear >= 20 ? `20${match[2]}` : `20${match[2]}`;
          patternConfidence = ocrConfidence * 0.85;
        } else if (i === 3) {
          // MM/YYYY
          extractedMonth = match[1].padStart(2, '0');
          extractedYear = match[2];
          patternConfidence = ocrConfidence * 0.8;
        } else if (i === 4) {
          // YYYY/MM
          extractedYear = match[1];
          extractedMonth = match[2].padStart(2, '0');
          patternConfidence = ocrConfidence * 0.8;
        } else if (i === 5) {
          // DD.MM.YYYY
          extractedMonth = match[1].padStart(2, '0');
          extractedYear = match[2];
          patternConfidence = ocrConfidence * 0.7;
        }

        if (extractedMonth && extractedYear) {
          break; // Erste Übereinstimmung verwenden
        }
      }
    }

    // Fallback: Vormonat des aktuellen Datums
    let leistungsmonat: string;
    let confidence: number | null;
    
    // Mindest-Konfidenz für Datumserkennung (50%)
    const MIN_DATE_CONFIDENCE = 50;
    
    if (extractedMonth && extractedYear && patternConfidence >= MIN_DATE_CONFIDENCE) {
      // Validiere Monat (01-12)
      const monthNum = parseInt(extractedMonth);
      if (monthNum >= 1 && monthNum <= 12) {
        leistungsmonat = `${extractedYear}-${extractedMonth}`;
        confidence = Math.round(patternConfidence);
      } else {
        // Ungültiger Monat - Fallback
        leistungsmonat = this.getPreviousMonth();
        confidence = null;
      }
    } else {
      // Kein Datum gefunden oder Konfidenz zu niedrig - Fallback auf Vormonat
      leistungsmonat = this.getPreviousMonth();
      confidence = null;
    }

    // Warnung wenn > 2 Monate alt
    const monthDiff = this.getMonthDifference(leistungsmonat);
    const warning = monthDiff > 2 ? `${monthDiff} Monate alt` : undefined;

    return { month: leistungsmonat, confidence, warning };
  }

  /** Berechne Vormonat im Format YYYY-MM */
  private getPreviousMonth(): string {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  /** Berechne Monatsdifferenz zwischen leistungsmonat und jetzt */
  private getMonthDifference(leistungsmonat: string): number {
    const [year, month] = leistungsmonat.split('-').map(Number);
    const now = new Date();
    const targetDate = new Date(year, month - 1);
    const monthsDiff = (now.getFullYear() - targetDate.getFullYear()) * 12 + (now.getMonth() - targetDate.getMonth());
    return monthsDiff;
  }

  /** Prüfe ob Arbeitsschein bereits existiert (Duplikat-Check nach OCR) */
  private async checkForDuplicate(index: number): Promise<void> {
    const files = this.scannedFiles();
    const scan = files[index];
    
    if (!scan || !scan.objectNumber || !scan.projectNumber) {
      return; // Keine Nummern vorhanden, kein Check möglich
    }

    try {
      const result = await firstValueFrom(
        this.workOrderService.checkDuplicate(scan.objectNumber, scan.projectNumber)
      );

      // Update Scan mit Duplikat-Info und benenne Datei um
      this.scannedFiles.update(files => {
        const updated = [...files];
        const currentScan = updated[index];
        
        // Erstelle neuen Dateinamen: as-o-nummer-pnummer-hashwert.pdf
        const oNummer = currentScan.objectNumber?.replace(/[^0-9]/g, '') || 'unknown';
        const pNummer = currentScan.projectNumber?.replace(/[^0-9]/g, '') || 'unknown';
        const hashValue = result.contentHash || 'nohash';
        const newFileName = `as-${oNummer}-${pNummer}-${hashValue}.pdf`;
        
        // Erstelle neue File-Instanz mit neuem Namen
        const renamedFile = new File([currentScan.file], newFileName, { type: 'application/pdf' });
        
        if (result.isDuplicate) {
          updated[index] = {
            ...updated[index],
            file: renamedFile,
            isDuplicate: true,
            duplicateInfo: {
              existingOrder: result.existingOrder,
              contentHash: result.contentHash
            }
          };
        } else {
          updated[index] = { ...updated[index], file: renamedFile, isDuplicate: false };
        }
        return updated;
      });

      // Zeige Toast-Warnung NACH dem State-Update
      if (result.isDuplicate) {
        await this.showToast(
          `⚠️ Duplikat erkannt: ${result.existingOrder}`,
          'warning',
          5000
        );
      }

    } catch (error) {
      console.error('❌ Duplikat-Check Fehler:', error);
      // Bei Fehler trotzdem erlauben (fail-safe)
      this.scannedFiles.update(files => {
        const updated = [...files];
        updated[index] = { ...updated[index], isDuplicate: false };
        return updated;
      });
    }
  }

  /** Plant Duplikat-Check nach manueller Eingabe (mit 500ms Debounce) */
  private scheduleManualCheck(index: number): void {
    // Clear existing timer
    if (this.inputDebounceTimers.has(index)) {
      clearTimeout(this.inputDebounceTimers.get(index));
    }

    // Set new timer
    const timer = setTimeout(async () => {
      const scan = this.scannedFiles()[index];
      if (scan && this.isValidObjectNumber(scan.objectNumber) && this.isValidProjectNumber(scan.projectNumber)) {
        await this.checkForDuplicate(index);
      }
      this.inputDebounceTimers.delete(index);
    }, 500);

    this.inputDebounceTimers.set(index, timer);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async convertPdfPageToImage(file: File): Promise<string> {
    // Für PDF-OCR: Erste Seite in Canvas rendern und als Bild extrahieren
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    
    // PDF.js Worker konfigurieren - verwende Worker aus node_modules
    // @ts-ignore - Worker wird vom Build-Tool automatisch bereitgestellt
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    // Optimierte Auflösung für OCR (3.0x - Balance zwischen Qualität und Geschwindigkeit)
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;
    
    return canvas.toDataURL('image/png');
  }

  /** Verbessert Bildqualität für bessere OCR-Erkennung - mit konfigurierbarem Threshold */
  private async preprocessImageForOCRWithThreshold(imageDataUrl: string, thresholdValue: number = 135): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        // Verwende Originalgröße (PDF wurde bereits mit 4.0x gerendert)
        canvas.width = img.width;
        canvas.height = img.height;

        // Zeichne Bild
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);

        // Deskewing - erkenne Rotation und korrigiere
        const skewAngle = this.detectSkewAngle(canvas);
        let rotatedCanvas = canvas;
        if (Math.abs(skewAngle) > 0.5) {
          rotatedCanvas = this.rotateCanvas(canvas, -skewAngle);
        }

        // Bild-Verbesserungen
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = rotatedCanvas.width;
        finalCanvas.height = rotatedCanvas.height;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
          resolve(rotatedCanvas.toDataURL('image/png'));
          return;
        }
        finalCtx.drawImage(rotatedCanvas, 0, 0);

        let imageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        let data = imageData.data;

        // Schärfung
        const sharpenKernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        imageData = this.applyConvolution(imageData, sharpenKernel, finalCanvas.width, finalCanvas.height);
        data = imageData.data;

        // Kontrastverstärkung
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (gray < min) min = gray;
          if (gray > max) max = gray;
        }
        const range = max - min;

        // Graustufenkonvertierung mit konfigurierbarem Threshold
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          if (range > 0) {
            gray = ((gray - min) / range) * 255;
          }
          
          const binary = gray < thresholdValue ? 0 : 255;
          data[i] = binary;
          data[i + 1] = binary;
          data[i + 2] = binary;
        }

        finalCtx.putImageData(imageData, 0, 0);
        resolve(finalCanvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  }

  /** Verbessert Bildqualität für bessere OCR-Erkennung - mit Deskewing und Schärfung */
  private async preprocessImageForOCR(imageDataUrl: string): Promise<string> {
    return this.preprocessImageForOCRWithThreshold(imageDataUrl, 135);
  }

  /** Wendet Konvolutionsfilter auf Bilddaten an (z.B. Schärfung) */
  private applyConvolution(imageData: ImageData, kernel: number[], width: number, height: number): ImageData {
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);
    const kSize = Math.sqrt(kernel.length);
    const half = Math.floor(kSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx - half));
            const py = Math.min(height - 1, Math.max(0, y + ky - half));
            const pIndex = (py * width + px) * 4;
            const kValue = kernel[ky * kSize + kx];
            
            r += src[pIndex] * kValue;
            g += src[pIndex + 1] * kValue;
            b += src[pIndex + 2] * kValue;
          }
        }
        
        const dstIndex = (y * width + x) * 4;
        dst[dstIndex] = Math.min(255, Math.max(0, r));
        dst[dstIndex + 1] = Math.min(255, Math.max(0, g));
        dst[dstIndex + 2] = Math.min(255, Math.max(0, b));
        dst[dstIndex + 3] = src[dstIndex + 3]; // Alpha unverändert
      }
    }

    return new ImageData(dst, width, height);
  }

  /** Erkennt Neigungswinkel des Bildes (Skew Detection) */
  private detectSkewAngle(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    // Arbeite mit verkleinertem Bild für Performance
    const maxSize = 800;
    const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = canvas.width * scale;
    smallCanvas.height = canvas.height * scale;
    const smallCtx = smallCanvas.getContext('2d');
    if (!smallCtx) return 0;
    
    smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
    
    // Kantenerkennung mit Sobel-Filter
    const imageData = smallCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
    const edges = this.detectEdges(imageData);
    
    // Hough Transform: Zähle Linien bei verschiedenen Winkeln
    const angleStep = 0.5; // Grad-Schritte
    const angles: { angle: number; score: number }[] = [];
    
    for (let angle = -15; angle <= 15; angle += angleStep) {
      const score = this.houghLineScore(edges, smallCanvas.width, smallCanvas.height, angle);
      angles.push({ angle, score });
    }
    
    // Finde Winkel mit höchstem Score
    angles.sort((a, b) => b.score - a.score);
    return angles[0].angle;
  }

  /** Einfache Kantenerkennung mit Sobel-Operator */
  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const edges = new Uint8ClampedArray(width * height);
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            const kIdx = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kIdx];
            gy += gray * sobelY[kIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 128 ? 255 : 0;
      }
    }
    
    return edges;
  }

  /** Berechnet Hough-Score für einen bestimmten Winkel */
  private houghLineScore(edges: Uint8ClampedArray, width: number, height: number, angleDeg: number): number {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const maxRho = Math.sqrt(width * width + height * height);
    const rhoStep = 2;
    const accumulator = new Map<number, number>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 0) {
          const rho = x * cos + y * sin;
          const rhoKey = Math.round(rho / rhoStep);
          accumulator.set(rhoKey, (accumulator.get(rhoKey) || 0) + 1);
        }
      }
    }
    
    // Summiere die Top-Akkumulator-Werte (starke Linien)
    const scores = Array.from(accumulator.values()).sort((a, b) => b - a);
    return scores.slice(0, 5).reduce((sum, val) => sum + val, 0);
  }

  /** Rotiert Canvas um gegebenen Winkel */
  private rotateCanvas(canvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
    const angleRad = (angleDeg * Math.PI) / 180;
    
    // Berechne neue Canvas-Größe nach Rotation
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const newWidth = canvas.width * cos + canvas.height * sin;
    const newHeight = canvas.width * sin + canvas.height * cos;
    
    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = newWidth;
    rotatedCanvas.height = newHeight;
    
    const ctx = rotatedCanvas.getContext('2d');
    if (!ctx) return canvas;
    
    // Fülle mit Weiß (wichtig für OCR)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, newWidth, newHeight);
    
    // Rotiere um Zentrum
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    
    return rotatedCanvas;
  }

  // ========================================================================
  // SCAN UPLOAD
  // ========================================================================

  async openCamera() {
    // Für Native: Zeige Optionen-Dialog
    if (Capacitor.getPlatform() !== 'web') {
      const alert = await this.alertCtrl.create({
        header: 'Scans hinzufügen',
        message: 'Wie möchten Sie fortfahren?',
        buttons: [
          {
            text: 'Kamera (mehrere Fotos)',
            handler: () => {
              this.takeMultiplePhotos();
            }
          },
          {
            text: 'Aus Galerie wählen',
            handler: () => {
              this.openGallery();
            }
          },
          {
            text: 'Abbrechen',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
    } else {
      this.openFileInput();
    }
  }

  private async takeMultiplePhotos() {
    let continueAdding = true;
    let photoCount = 0;

    while (continueAdding) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          saveToGallery: false
        });

        if (image.base64String) {
          const pdfBlob = await this.convertImageToPdf(image.base64String, image.format);
          const file = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
          const currentIndex = this.scannedFiles().length;
          this.scannedFiles.update(files => [...files, { 
            file, 
            objectNumber: 'O-', 
            projectNumber: 'P', 
            leistungsmonat: this.getPreviousMonth(),
            isOcrRunning: false, 
            ocrProgress: 0 
          }]);
          photoCount++;

          // Automatisches OCR durchführen
          await this.extractNumbersFromFile(file, currentIndex);

          // Frage ob weiteres Foto gemacht werden soll
          const alert = await this.alertCtrl.create({
            header: 'Weiteres Foto?',
            message: `${photoCount} Foto(s) hinzugefügt. Möchten Sie ein weiteres Foto machen?`,
            buttons: [
              {
                text: 'Ja, weiteres Foto',
                handler: () => {
                  continueAdding = true;
                }
              },
              {
                text: 'Fertig',
                handler: () => {
                  continueAdding = false;
                }
              }
            ]
          });
          await alert.present();
          await alert.onDidDismiss();
        } else {
          continueAdding = false;
        }
      } catch (error) {
        console.error('Camera error:', error);
        continueAdding = false;
        if (photoCount === 0) {
          await this.showToast('Fehler beim Öffnen der Kamera', 'danger');
        }
      }
    }

    if (photoCount > 0) {
      await this.showToast(`${photoCount} Foto(s) hinzugefügt`, 'success');
    }
  }

  private async openGallery() {
    // Note: Camera API unterstützt keine Mehrfachauswahl aus Galerie
    // Daher öffnen wir die Galerie einmal und der User kann mehrfach aufrufen
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        saveToGallery: false
      });

      if (image.base64String) {
        const pdfBlob = await this.convertImageToPdf(image.base64String, image.format);
        const file = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
        const currentIndex = this.scannedFiles().length;
        this.scannedFiles.update(files => [...files, {
          file, 
          objectNumber: 'O-', 
          projectNumber: 'P', 
          leistungsmonat: this.getPreviousMonth(),
          isOcrRunning: false, 
          ocrProgress: 0
        }]);
        
        await this.showToast('Foto aus Galerie hinzugefügt', 'success');
        
        // Automatisches OCR durchführen
        await this.extractNumbersFromFile(file, currentIndex);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      await this.showToast('Fehler beim Öffnen der Galerie', 'danger');
    }
  }

  private openFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    // WICHTIG: capture NICHT setzen, sonst kann nur 1 Datei gewählt werden
    
    input.onchange = async (event: any) => {
      const files = Array.from(event.target.files || []) as File[];
      
      let duplicateCount = 0;
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Konvertiere Bild zu PDF
          const pdfBlob = await this.convertImageFileToPdf(file);
          const pdfFile = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
          await this.addPdfFile(pdfFile);
          if (this.scannedFiles()[this.scannedFiles().length - 1]?.isDuplicate) duplicateCount++;
        } else if (file.type === 'application/pdf') {
          // PDF - prüfe ob mehrere Seiten und teile auf
          const pageCount = await this.getPdfPageCount(file);
          if (pageCount > 1) {
            // Mehrseitige PDF - teile auf
            const toast = await this.toastCtrl.create({
              message: `PDF mit ${pageCount} Seiten wird aufgeteilt...`,
              duration: 2000,
              color: 'primary'
            });
            await toast.present();
            
            await this.splitPdfAndAdd(file, pageCount);
          } else {
            // Einzelseite - normal hinzufügen
            await this.addPdfFile(file);
            if (this.scannedFiles()[this.scannedFiles().length - 1]?.isDuplicate) duplicateCount++;
          }
        }
      }
      
      // Zeige Toast nur wenn KEINE Duplikate erkannt wurden
      if (files.length > 0 && duplicateCount === 0) {
        const totalScans = this.scannedFiles().length;
        await this.showToast(`${totalScans} Scan(s) vorhanden`, 'success');
      }
    };
    
    input.click();
  }

  private async convertImageFileToPdf(imageFile: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = () => {
          // Bild komprimieren bevor PDF erstellt wird
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Maximale Breite für Kompression (1200px ist ausreichend für A4-Druck)
          const maxWidth = 1200;
          let targetWidth = img.width;
          let targetHeight = img.height;
          
          if (targetWidth > maxWidth) {
            targetHeight = (targetHeight * maxWidth) / targetWidth;
            targetWidth = maxWidth;
          }
          
          // Canvas mit neuer Größe erstellen
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          // Bild verkleinert auf Canvas zeichnen
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Komprimiertes JPEG erzeugen (75% Qualität)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

          const pdf = new jsPDF({
            orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgRatio = targetWidth / targetHeight;
          const pageRatio = pageWidth / pageHeight;

          let imgWidth, imgHeight;
          if (imgRatio > pageRatio) {
            imgWidth = pageWidth - 20;
            imgHeight = imgWidth / imgRatio;
          } else {
            imgHeight = pageHeight - 20;
            imgWidth = imgHeight * imgRatio;
          }

          const x = (pageWidth - imgWidth) / 2;
          const y = (pageHeight - imgHeight) / 2;

          pdf.addImage(compressedDataUrl, 'JPEG', x, y, imgWidth, imgHeight);
          resolve(pdf.output('blob'));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  private async convertImageToPdf(base64: string, format: string = 'jpeg'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const imgData = `data:image/${format};base64,${base64}`;
      
      img.onload = () => {
        // Bild komprimieren
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        const maxWidth = 1200;
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        if (targetWidth > maxWidth) {
          targetHeight = (targetHeight * maxWidth) / targetWidth;
          targetWidth = maxWidth;
        }
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

        const pdf = new jsPDF({
          orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const aspectRatio = targetWidth / targetHeight;

        let imgWidth, imgHeight;
        if (aspectRatio > pageWidth / pageHeight) {
          imgWidth = pageWidth - 20;
          imgHeight = imgWidth / aspectRatio;
        } else {
          imgHeight = pageHeight - 20;
          imgWidth = imgHeight * aspectRatio;
        }

        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(compressedDataUrl, 'JPEG', x, y, imgWidth, imgHeight);
        resolve(pdf.output('blob'));
      };
      
      img.onerror = reject;
      img.src = imgData;
    });
  }

  removeScan(index: number) {
    this.scannedFiles.update(files => files.filter((_, i) => i !== index));
  }

  openPreviewModal(scan: ScannedFile) {
    this.previewScan.set(scan);
    this.isPreviewModalOpen.set(true);
  }

  closePreviewModal() {
    this.isPreviewModalOpen.set(false);
    this.previewScan.set(null);
  }

  // Trigger signal update when input values change
  updateScannedFiles() {
    this.scannedFiles.set([...this.scannedFiles()]);
  }

  private async uploadScans() {
    this.isUploading.set(true);
    const scans = this.scannedFiles();

    this.workOrderService.bulkSubmitScansWithNumbers(scans).subscribe({
      next: async (response) => {
        this.isUploading.set(false);
        this.scannedFiles.set([]);
        
        const successCount = response.created_orders.length;
        const errorCount = response.errors.length;
        
        let message = `${successCount} Arbeitsschein(e) erfolgreich eingereicht`;
        if (errorCount > 0) {
          message += `\n${errorCount} Fehler`;
        }
        
        await this.showToast(message, 'success');
        this.selectedTab.set('billing'); // Wechsel zu "Zur Abrechnung"
      },
      error: async (err) => {
        this.isUploading.set(false);
        console.error('Upload error:', err);
        await this.showToast('Fehler beim Hochladen', 'danger');
      }
    });
  }

  // ========================================================================
  // BILLING ACTIONS
  // ========================================================================

  async submitWorkOrder(workOrder: WorkOrder) {
    const alert = await this.alertCtrl.create({
      header: 'Arbeitsschein einreichen',
      message: `Arbeitsschein ${workOrder.order_number} zur Abrechnung einreichen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Einreichen',
          handler: () => {
            if (workOrder.id) {
              this.performSubmit(workOrder.id);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async performSubmit(id: number) {
    this.workOrderService.submitWorkOrder(id).subscribe({
      next: async () => {
        await this.showToast('Arbeitsschein eingereicht', 'success');
      },
      error: async (err) => {
        console.error('Submit error:', err);
        await this.showToast('Fehler beim Einreichen', 'danger');
      }
    });
  }

  async markAsBilled(workOrder: WorkOrder) {
    if (!workOrder.can_mark_billed) {
      await this.showToast('Keine Berechtigung', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Abrechnung bestätigen',
      message: `Arbeitsschein ${workOrder.order_number} als abgerechnet markieren?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Bestätigen',
          handler: () => {
            if (workOrder.id) {
              this.performMarkAsBilled(workOrder.id);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async performMarkAsBilled(id: number) {
    this.workOrderService.markAsBilled(id).subscribe({
      next: async () => {
        await this.showToast('Als abgerechnet markiert', 'success');
      },
      error: async (err) => {
        console.error('Mark as billed error:', err);
        await this.showToast('Fehler beim Abrechnen', 'danger');
      }
    });
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'completed': 'warning',
      'submitted': 'primary',
      'billed': 'success',
      'cancelled': 'danger'
    };
    return colors[status] || 'medium';
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'completed': 'time-outline',
      'submitted': 'cloud-upload-outline',
      'billed': 'checkmark-circle',
      'cancelled': 'close-circle'
    };
    return icons[status] || 'document-text-outline';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success', duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Aktualisiert den Arbeitsschein-Badge-Count im BadgeService
   * Summiert offene (completed, nicht submitted) und zur Abrechnung wartende (submitted) Arbeitsscheine
   */
  private updateWorkOrderBadge() {
    const openCount = this.openWorkOrders().length;
    const billingCount = this.billingWorkOrders().length;
    this.badgeService.setBadge('arbeitsscheine', openCount + billingCount);
  }

  /**
   * Fügt eine PDF-Datei hinzu und führt OCR aus
   */
  private async addPdfFile(file: File) {
    const currentIndex = this.scannedFiles().length;
    this.scannedFiles.update(currentFiles => [...currentFiles, { 
      file, 
      objectNumber: 'O-', 
      projectNumber: 'P', 
      leistungsmonat: this.getPreviousMonth(),
      isOcrRunning: false, 
      ocrProgress: 0 
    }]);
    // Automatisches OCR durchführen
    await this.extractNumbersFromFile(file, currentIndex);
  }

  /**
   * Ermittelt die Anzahl der Seiten in einer PDF
   */
  private async getPdfPageCount(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Einfache Methode: Zähle /Page Vorkommen im PDF
          const text = new TextDecoder('latin1').decode(uint8Array);
          const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
          const pageCount = pageMatches ? pageMatches.length : 1;
          
          resolve(pageCount);
        } catch (error) {
          console.error('Error counting PDF pages:', error);
          resolve(1); // Fallback: Einzelseite
        }
      };
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Teilt eine mehrseitige PDF in einzelne Seiten auf und fügt jede als separaten Scan hinzu
   */
  private async splitPdfAndAdd(file: File, pageCount: number) {
    try {
      // Sende PDF ans Backend zum Splitten
      const result = await firstValueFrom(this.workOrderService.splitPdf(file));
      
      // Füge jede Seite als separaten Scan hinzu
      for (let i = 0; i < result.pages.length; i++) {
        const pageBlob = await fetch(result.pages[i].url).then(r => r.blob());
        const pageFile = new File(
          [pageBlob], 
          `${file.name.replace('.pdf', '')}_Seite_${i + 1}.pdf`, 
          { type: 'application/pdf' }
        );
        await this.addPdfFile(pageFile);
      }
      
      const toast = await this.toastCtrl.create({
        message: `PDF in ${pageCount} Arbeitsscheine aufgeteilt`,
        duration: 2000,
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Error splitting PDF:', error);
      // Fallback: Füge Original-PDF als ganzes hinzu
      await this.addPdfFile(file);
      
      const alert = await this.alertCtrl.create({
        header: 'Warnung',
        message: 'PDF konnte nicht automatisch aufgeteilt werden. Bitte manuell einzeln scannen.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
  
  /** Toggle between showing all items or only own items */
  toggleShowAll() {
    this.showAll.update(val => !val);
    
    // Reload data based on current tab
    const currentTab = this.selectedTab();
    if (currentTab === 'billing') {
      this.loadWorkOrdersByStatus('submitted');
    } else if (currentTab === 'archive') {
      this.loadArchiveWorkOrders();
    }
  }
}
