import { Component, inject, signal, Input, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonIcon, IonChip, IonFooter, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  // Icons für Buttons
  saveOutline, closeOutline,
  // Gesundheit & Medizin
  medkitOutline, bandageOutline, fitnessOutline, bodyOutline, pulseOutline, thermometerOutline,
  // Urlaub & Reisen
  airplaneOutline, carOutline, trainOutline, boatOutline, bicycleOutline, walkOutline,
  mapOutline, compassOutline, locationOutline, navigateOutline,
  // Arbeit & Büro
  homeOutline, briefcaseOutline, businessOutline, desktopOutline, laptopOutline,
  constructOutline, buildOutline, hammerOutline,
  // Zeit & Kalender
  timeOutline, timerOutline, stopwatchOutline, alarmOutline, calendarOutline,
  calendarNumberOutline, todayOutline,
  // Bildung & Lernen
  schoolOutline, bookOutline, libraryOutline, newspaperOutline, readerOutline, glassesOutline,
  // Personen & Familie
  peopleOutline, personOutline, manOutline, womanOutline, maleOutline, femaleOutline,
  heartOutline, giftOutline, balloonOutline, ribbonOutline,
  // Emotionen & Status
  happyOutline, sadOutline, checkmarkCircleOutline, closeCircleOutline, warningOutline,
  alertCircleOutline, informationCircleOutline, helpCircleOutline,
  // Kommunikation
  mailOutline, chatbubbleOutline, callOutline, videocamOutline, notificationsOutline,
  // Dokumente & Dateien
  documentOutline, documentTextOutline, clipboardOutline, folderOutline, archiveOutline, printOutline,
  // Sonstiges
  cafeOutline, restaurantOutline, beerOutline, wineOutline, pizzaOutline, fastFoodOutline,
  bedOutline, moonOutline, sunnyOutline, cloudOutline, rainyOutline, snowOutline,
  thunderstormOutline, umbrellaOutline, flashlightOutline, keyOutline, lockClosedOutline,
  shieldOutline, medalOutline, trophyOutline, starOutline, flameOutline,
  musicalNotesOutline, headsetOutline, cameraOutline, imageOutline, colorPaletteOutline
} from 'ionicons/icons';
import { AbsenceType } from '../../../core/interfaces/absence.types';

interface IconOption {
  name: string;
  label: string;
}

@Component({
  selector: 'app-absence-type-modal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonIcon, IonFooter
  ],
  templateUrl: './absence-type-modal.component.html',
  styleUrls: ['./absence-type-modal.component.scss']
})
export class AbsenceTypeModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);

  @Input() absenceType?: AbsenceType;

  // Formular-Felder
  formName = signal('');
  formDisplayName = signal('');
  formDescription = signal('');
  formIcon = signal('medkit-outline');
  formColor = signal('#3880ff');
  formRequiresApproval = signal(true);
  formDeductFromVacation = signal(false);
  
  // Select Interface Options mit Icons
  selectInterfaceOptions = {
    header: 'Icon auswählen',
    cssClass: 'icon-select-action-sheet'
  };

  availableIcons: IconOption[] = [
    // Gesundheit & Medizin
    { name: 'medkit-outline', label: 'Krankheit / Medizin' },
    { name: 'bandage-outline', label: 'Verband' },
    { name: 'fitness-outline', label: 'Fitness' },
    { name: 'body-outline', label: 'Körper / Arzt' },
    { name: 'pulse-outline', label: 'Herzschlag' },
    { name: 'thermometer-outline', label: 'Thermometer' },
    
    // Urlaub & Reisen
    { name: 'airplane-outline', label: 'Flugzeug / Urlaub' },
    { name: 'car-outline', label: 'Auto' },
    { name: 'train-outline', label: 'Zug' },
    { name: 'boat-outline', label: 'Boot' },
    { name: 'bicycle-outline', label: 'Fahrrad' },
    { name: 'walk-outline', label: 'Spaziergang' },
    { name: 'map-outline', label: 'Karte' },
    { name: 'compass-outline', label: 'Kompass' },
    { name: 'location-outline', label: 'Ort' },
    { name: 'navigate-outline', label: 'Navigation' },
    
    // Arbeit & Büro
    { name: 'home-outline', label: 'Home / Homeoffice' },
    { name: 'briefcase-outline', label: 'Aktentasche / Geschäft' },
    { name: 'business-outline', label: 'Business' },
    { name: 'desktop-outline', label: 'Desktop' },
    { name: 'laptop-outline', label: 'Laptop' },
    { name: 'construct-outline', label: 'Werkzeuge' },
    { name: 'build-outline', label: 'Bauen' },
    { name: 'hammer-outline', label: 'Hammer' },
    
    // Zeit & Kalender
    { name: 'time-outline', label: 'Zeit / Uhr' },
    { name: 'timer-outline', label: 'Timer' },
    { name: 'stopwatch-outline', label: 'Stoppuhr' },
    { name: 'alarm-outline', label: 'Wecker' },
    { name: 'calendar-outline', label: 'Kalender' },
    { name: 'calendar-number-outline', label: 'Kalender Nummer' },
    { name: 'today-outline', label: 'Heute' },
    
    // Bildung & Lernen
    { name: 'school-outline', label: 'Schule / Fortbildung' },
    { name: 'book-outline', label: 'Buch' },
    { name: 'library-outline', label: 'Bibliothek' },
    { name: 'newspaper-outline', label: 'Zeitung' },
    { name: 'Reader-outline', label: 'Lesen' },
    { name: 'glasses-outline', label: 'Brille' },
    
    // Personen & Familie
    { name: 'people-outline', label: 'Menschen / Team' },
    { name: 'person-outline', label: 'Person' },
    { name: 'man-outline', label: 'Mann' },
    { name: 'woman-outline', label: 'Frau' },
    { name: 'male-outline', label: 'Männlich' },
    { name: 'female-outline', label: 'Weiblich' },
    { name: 'heart-outline', label: 'Herz / Elternzeit' },
    { name: 'gift-outline', label: 'Geschenk' },
    { name: 'balloon-outline', label: 'Ballon' },
    { name: 'ribbon-outline', label: 'Schleife / Feiertag' },
    
    // Emotionen & Status
    { name: 'happy-outline', label: 'Glücklich / Feier' },
    { name: 'sad-outline', label: 'Traurig / Trauerfall' },
    { name: 'checkmark-circle-outline', label: 'Bestätigt' },
    { name: 'close-circle-outline', label: 'Abgelehnt' },
    { name: 'warning-outline', label: 'Warnung' },
    { name: 'alert-circle-outline', label: 'Alarm' },
    { name: 'information-circle-outline', label: 'Information' },
    { name: 'help-circle-outline', label: 'Hilfe' },
    
    // Kommunikation
    { name: 'mail-outline', label: 'E-Mail' },
    { name: 'chatbubble-outline', label: 'Chat' },
    { name: 'call-outline', label: 'Telefon' },
    { name: 'videocam-outline', label: 'Video' },
    { name: 'notifications-outline', label: 'Benachrichtigung' },
    
    // Dokumente & Dateien
    { name: 'document-outline', label: 'Dokument' },
    { name: 'document-text-outline', label: 'Dokument Text' },
    { name: 'clipboard-outline', label: 'Zwischenablage / Sabbatical' },
    { name: 'folder-outline', label: 'Ordner' },
    { name: 'archive-outline', label: 'Archiv' },
    { name: 'print-outline', label: 'Drucken' },
    
    // Sonstiges
    { name: 'cafe-outline', label: 'Kaffee / Pause' },
    { name: 'restaurant-outline', label: 'Restaurant' },
    { name: 'beer-outline', label: 'Bier' },
    { name: 'wine-outline', label: 'Wein' },
    { name: 'pizza-outline', label: 'Pizza' },
    { name: 'fast-food-outline', label: 'Fast Food' },
    { name: 'bed-outline', label: 'Bett / Schlaf' },
    { name: 'moon-outline', label: 'Mond / Nacht' },
    { name: 'sunny-outline', label: 'Sonne / Tag' },
    { name: 'cloud-outline', label: 'Wolke / Wetter' },
    { name: 'rainy-outline', label: 'Regen' },
    { name: 'snow-outline', label: 'Schnee' },
    { name: 'thunderstorm-outline', label: 'Gewitter' },
    { name: 'umbrella-outline', label: 'Regenschirm' },
    { name: 'flashlight-outline', label: 'Taschenlampe' },
    { name: 'key-outline', label: 'Schlüssel' },
    { name: 'lock-closed-outline', label: 'Schloss' },
    { name: 'shield-outline', label: 'Schild' },
    { name: 'medal-outline', label: 'Medaille' },
    { name: 'trophy-outline', label: 'Trophäe' },
    { name: 'star-outline', label: 'Stern' },
    { name: 'flame-outline', label: 'Flamme' },
    { name: 'musical-notes-outline', label: 'Musik' },
    { name: 'headset-outline', label: 'Kopfhörer' },
    { name: 'camera-outline', label: 'Kamera' },
    { name: 'image-outline', label: 'Bild' },
    { name: 'color-palette-outline', label: 'Farbpalette' }
  ];

  constructor() {
    addIcons({
      // Buttons
      saveOutline, closeOutline,
      // Gesundheit & Medizin
      medkitOutline, bandageOutline, fitnessOutline, bodyOutline, pulseOutline, thermometerOutline,
      // Urlaub & Reisen
      airplaneOutline, carOutline, trainOutline, boatOutline, bicycleOutline, walkOutline,
      mapOutline, compassOutline, locationOutline, navigateOutline,
      // Arbeit & Büro
      homeOutline, briefcaseOutline, businessOutline, desktopOutline, laptopOutline,
      constructOutline, buildOutline, hammerOutline,
      // Zeit & Kalender
      timeOutline, timerOutline, stopwatchOutline, alarmOutline, calendarOutline,
      calendarNumberOutline, todayOutline,
      // Bildung & Lernen
      schoolOutline, bookOutline, libraryOutline, newspaperOutline, readerOutline, glassesOutline,
      // Personen & Familie
      peopleOutline, personOutline, manOutline, womanOutline, maleOutline, femaleOutline,
      heartOutline, giftOutline, balloonOutline, ribbonOutline,
      // Emotionen & Status
      happyOutline, sadOutline, checkmarkCircleOutline, closeCircleOutline, warningOutline,
      alertCircleOutline, informationCircleOutline, helpCircleOutline,
      // Kommunikation
      mailOutline, chatbubbleOutline, callOutline, videocamOutline, notificationsOutline,
      // Dokumente & Dateien
      documentOutline, documentTextOutline, clipboardOutline, folderOutline, archiveOutline, printOutline,
      // Sonstiges
      cafeOutline, restaurantOutline, beerOutline, wineOutline, pizzaOutline, fastFoodOutline,
      bedOutline, moonOutline, sunnyOutline, cloudOutline, rainyOutline, snowOutline,
      thunderstormOutline, umbrellaOutline, flashlightOutline, keyOutline, lockClosedOutline,
      shieldOutline, medalOutline, trophyOutline, starOutline, flameOutline,
      musicalNotesOutline, headsetOutline, cameraOutline, imageOutline, colorPaletteOutline
    });
  }

  ngOnInit() {
    if (this.absenceType) {
      // Bearbeitungsmodus - Formular mit Daten füllen
      this.formName.set(this.absenceType.name);
      this.formDisplayName.set(this.absenceType.display_name);
      this.formDescription.set(this.absenceType.description || '');
      this.formIcon.set(this.absenceType.icon || 'medkit-outline');
      this.formColor.set(this.absenceType.color || '#3880ff');
      this.formRequiresApproval.set(this.absenceType.requires_approval ?? true);
      this.formDeductFromVacation.set(this.absenceType.deduct_from_vacation ?? false);
    }
  }

  getSelectedIconLabel(): string {
    const selectedIcon = this.availableIcons.find(icon => icon.name === this.formIcon());
    return selectedIcon ? selectedIcon.label : '';
  }

  async openIconPicker() {
    const { IconPickerModalComponent } = await import('../icon-picker-modal/icon-picker-modal.component');
    
    const modal = await this.modalCtrl.create({
      component: IconPickerModalComponent,
      componentProps: {
        selectedIcon: this.formIcon(),
        previewColor: this.formColor()
      }
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'selected' && data) {
      this.formIcon.set(data);
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    const typeData: Partial<AbsenceType> = {
      name: this.formName(),
      display_name: this.formDisplayName(),
      description: this.formDescription(),
      icon: this.formIcon(),
      color: this.formColor(),
      requires_approval: this.formRequiresApproval(),
      deduct_from_vacation: this.formDeductFromVacation()
    };

    this.modalCtrl.dismiss(typeData, 'save');
  }
}
