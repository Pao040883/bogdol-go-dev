import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonList, IonItem, IonLabel, IonIcon, IonListHeader, IonChip, IonInput, IonSelect, IonSelectOption, ModalController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, addOutline, createOutline, trashOutline,
  listOutline, archiveOutline,
  // Alle möglichen Abwesenheitstyp-Icons
  medkitOutline, bandageOutline, fitnessOutline, bodyOutline, pulseOutline, thermometerOutline,
  airplaneOutline, carOutline, trainOutline, boatOutline, bicycleOutline, walkOutline,
  mapOutline, compassOutline, locationOutline, navigateOutline,
  homeOutline, briefcaseOutline, businessOutline, desktopOutline, laptopOutline,
  constructOutline, buildOutline, hammerOutline,
  timeOutline, timerOutline, stopwatchOutline, alarmOutline, calendarOutline,
  calendarNumberOutline, todayOutline,
  schoolOutline, bookOutline, libraryOutline, newspaperOutline, readerOutline, glassesOutline,
  peopleOutline, personOutline, manOutline, womanOutline, maleOutline, femaleOutline,
  heartOutline, giftOutline, balloonOutline, ribbonOutline,
  happyOutline, sadOutline, checkmarkCircleOutline, closeCircleOutline, warningOutline,
  alertCircleOutline, informationCircleOutline, helpCircleOutline,
  mailOutline, chatbubbleOutline, callOutline, videocamOutline, notificationsOutline,
  documentOutline, documentTextOutline, clipboardOutline, folderOutline, archiveOutline as archiveIcon, printOutline,
  cafeOutline, restaurantOutline, beerOutline, wineOutline, pizzaOutline, fastFoodOutline,
  bedOutline, moonOutline, sunnyOutline, cloudOutline, rainyOutline, snowOutline,
  thunderstormOutline, umbrellaOutline, flashlightOutline, keyOutline, lockClosedOutline,
  shieldOutline, medalOutline, trophyOutline, starOutline, flameOutline,
  musicalNotesOutline, headsetOutline, cameraOutline, imageOutline, colorPaletteOutline, chevronForwardOutline } from 'ionicons/icons';
import { AbsenceService } from '../../../core/services/absence.service';
import { AbsenceType } from '../../../core/interfaces/absence.types';
import { AbsenceTypeModalComponent } from '../../../shared/components/absence-type-modal/absence-type-modal.component';
import { TabLayoutComponent, TabConfig } from '../../../shared/components/tab-layout/tab-layout.component';

interface IconOption {
  name: string;
  label: string;
}

interface ColorOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-absence-types',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonList, IonItem, IonLabel, IonIcon, IonListHeader, IonChip, IonInput, IonSelect, IonSelectOption,
    TabLayoutComponent
  ],
  templateUrl: './absence-types.page.html',
  styleUrls: ['./absence-types.page.scss']
})
export class AbsenceTypesPage implements OnInit {
  absenceService = inject(AbsenceService); // public für Template-Zugriff
  private modalCtrl = inject(ModalController);
  
  // Verwende direkt das Signal vom Service
  absenceTypes = this.absenceService.absenceTypes;
  
  // Form Signals für "Neu erstellen" Tab
  formName = signal('');
  formDisplayName = signal('');
  formDescription = signal('');
  formIcon = signal('calendar-outline');
  formColor = signal('#3880ff');
  formRequiresApproval = signal(false);
  formDeductFromVacation = signal(false);
  
  // Tab-Konfiguration
  tabConfig: TabConfig[] = [
    { id: 'list', label: 'Liste', icon: 'list-outline' },
    { id: 'new', label: 'Neu', icon: 'add-outline' },
    { id: 'archive', label: 'Archiv', icon: 'archive-outline' }
  ];

  constructor(private alertController: AlertController) {
    addIcons({arrowBackOutline,trashOutline,chevronForwardOutline,addOutline,createOutline,listOutline,archiveOutline:archiveIcon,medkitOutline,bandageOutline,fitnessOutline,bodyOutline,pulseOutline,thermometerOutline,airplaneOutline,carOutline,trainOutline,boatOutline,bicycleOutline,walkOutline,mapOutline,compassOutline,locationOutline,navigateOutline,homeOutline,briefcaseOutline,businessOutline,desktopOutline,laptopOutline,constructOutline,buildOutline,hammerOutline,timeOutline,timerOutline,stopwatchOutline,alarmOutline,calendarOutline,calendarNumberOutline,todayOutline,schoolOutline,bookOutline,libraryOutline,newspaperOutline,readerOutline,glassesOutline,peopleOutline,personOutline,manOutline,womanOutline,maleOutline,femaleOutline,heartOutline,giftOutline,balloonOutline,ribbonOutline,happyOutline,sadOutline,checkmarkCircleOutline,closeCircleOutline,warningOutline,alertCircleOutline,informationCircleOutline,helpCircleOutline,mailOutline,chatbubbleOutline,callOutline,videocamOutline,notificationsOutline,documentOutline,documentTextOutline,clipboardOutline,folderOutline,printOutline,cafeOutline,restaurantOutline,beerOutline,wineOutline,pizzaOutline,fastFoodOutline,bedOutline,moonOutline,sunnyOutline,cloudOutline,rainyOutline,snowOutline,thunderstormOutline,umbrellaOutline,flashlightOutline,keyOutline,lockClosedOutline,shieldOutline,medalOutline,trophyOutline,starOutline,flameOutline,musicalNotesOutline,headsetOutline,cameraOutline,imageOutline,colorPaletteOutline});
  }

  ngOnInit() {
    this.loadAbsenceTypes();
  }

  async loadAbsenceTypes() {
    // Lädt die Abwesenheitsarten vom Service neu
    this.absenceService.loadAbsenceTypes();
  }

  async openIconPicker() {
    const { IconPickerModalComponent } = await import('../../../shared/components/icon-picker-modal/icon-picker-modal.component');
    
    const modal = await this.modalCtrl.create({
      component: IconPickerModalComponent,
      componentProps: {
        selectedIcon: this.formIcon(),
        selectedColor: this.formColor()
      }
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    
    if (data?.icon) {
      this.formIcon.set(data.icon);
    }
  }

  getSelectedIconLabel(): string {
    const icon = this.formIcon();
    // Formatiere Icon-Namen für Anzeige (z.B. "calendar-outline" → "Calendar Outline")
    return icon
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async createNew() {
    if (!this.formName() || !this.formDisplayName()) return;

    const data = {
      name: this.formName(),
      display_name: this.formDisplayName(),
      description: this.formDescription() || '',
      icon: this.formIcon(),
      color: this.formColor(),
      requires_approval: this.formRequiresApproval(),
      deduct_from_vacation: this.formDeductFromVacation()
    };

    await this.absenceService.createAbsenceType(data);

    // Formular zurücksetzen
    this.formName.set('');
    this.formDisplayName.set('');
    this.formDescription.set('');
    this.formIcon.set('calendar-outline');
    this.formColor.set('#3880ff');
    this.formRequiresApproval.set(false);
    this.formDeductFromVacation.set(false);
  }

  async openNew() {
    const modal = await this.modalCtrl.create({
      component: AbsenceTypeModalComponent
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'save' && data) {
      await this.absenceService.createAbsenceType(data);
    }
  }

  async openEdit(type: AbsenceType) {
    const modal = await this.modalCtrl.create({
      component: AbsenceTypeModalComponent,
      componentProps: {
        absenceType: type
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'save' && data) {
      await this.absenceService.updateAbsenceType(type.id, data);
    }
  }

  async delete(type: AbsenceType) {
    const alert = await this.alertController.create({
      header: 'Abwesenheitsart löschen',
      message: `Möchten Sie die Abwesenheitsart "${type.display_name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.absenceService.deleteAbsenceType(type.id);
            } catch (error) {
              console.error('Fehler beim Löschen:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
